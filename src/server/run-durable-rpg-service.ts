import { HmacProxyRequestAuthenticator } from "../auth/hmac-proxy-request-authenticator.ts";
import { DevelopmentHeaderAuthenticator } from "../auth/request-authenticator.ts";
import { parseDurableRpgProcessConfig } from "./durable-rpg-process-config.ts";
import { createConfiguredDurableRpgService } from "./durable-rpg-service-lifecycle.ts";
import {
  durableRpgStagingBootstrap,
  parseDurableRpgStagingBootstrapConfig,
} from "./durable-rpg-staging-bootstrap.ts";

const config = parseDurableRpgProcessConfig(process.env);
const stagingBootstrapConfig = parseDurableRpgStagingBootstrapConfig(process.env);
const authenticator = config.authentication.mode === "hmac-proxy"
  ? new HmacProxyRequestAuthenticator({
      proxySecret: config.authentication.proxyHmacSecret,
      serviceToken: config.gmServiceToken,
      maxClockSkewMs: config.authentication.maxClockSkewMs,
      maxReplayEntries: config.authentication.maxReplayEntries,
    })
  : new DevelopmentHeaderAuthenticator();
const lifecycle = createConfiguredDurableRpgService({
  filePath: config.filePath,
  gmBaseUrl: config.gmBaseUrl,
  gmServiceToken: config.gmServiceToken,
  authenticator,
  ...(stagingBootstrapConfig
    ? { bootstrapCampaigns: [durableRpgStagingBootstrap(stagingBootstrapConfig)] }
    : {}),
  pollIntervalMs: config.pollIntervalMs,
  deliveryTimeoutMs: config.deliveryTimeoutMs,
});

let shutdownRequested = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownRequested) return;
  shutdownRequested = true;
  process.stderr.write(`${JSON.stringify({
    level: "info",
    event: "durable-rpg-service-retiring",
    signal,
  })}\n`);
  try {
    await lifecycle.retire();
  } catch (error) {
    process.exitCode = 1;
    process.stderr.write(`${JSON.stringify({
      level: "error",
      event: "durable-rpg-service-retirement-failed",
      message: error instanceof Error ? error.message : "unknown failure",
    })}\n`);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  const address = await lifecycle.start({
    host: config.host,
    port: config.port,
  });
  process.stdout.write(`${JSON.stringify({
    level: "info",
    event: "durable-rpg-service-started",
    host: address.host,
    port: address.port,
    databasePath: config.filePath,
    gmBaseUrl: config.gmBaseUrl,
    authentication: config.authentication.mode,
    ...(stagingBootstrapConfig
      ? { stagingCampaignId: stagingBootstrapConfig.campaignId }
      : {}),
  })}\n`);
  await lifecycle.waitUntilTerminated();
} catch (error) {
  process.exitCode = 1;
  process.stderr.write(`${JSON.stringify({
    level: "error",
    event: "durable-rpg-service-failed",
    message: error instanceof Error ? error.message : "unknown failure",
  })}\n`);
  await lifecycle.retire().catch(() => undefined);
}
