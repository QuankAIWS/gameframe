import { rm } from "node:fs/promises";

import { HmacProxyRequestAuthenticator } from "../auth/hmac-proxy-request-authenticator.ts";
import { DevelopmentHeaderAuthenticator } from "../auth/request-authenticator.ts";
import { parseDurableRpgProcessConfig } from "./durable-rpg-process-config.ts";
import { createConfiguredDurableRpgService } from "./durable-rpg-service-lifecycle.ts";
import {
  durableRpgStagingBootstrapForDatabase,
  parseDurableRpgStagingBootstrapConfig,
} from "./durable-rpg-staging-bootstrap.ts";

const config = parseDurableRpgProcessConfig(process.env);
const stagingBootstrapConfig = parseDurableRpgStagingBootstrapConfig(process.env);
const stagingBootstrap = stagingBootstrapConfig
  ? durableRpgStagingBootstrapForDatabase(config.filePath, stagingBootstrapConfig)
  : undefined;
const authenticator = config.authentication.mode === "hmac-proxy"
  ? new HmacProxyRequestAuthenticator({
      proxySecret: config.authentication.proxyHmacSecret,
      serviceToken: config.gmServiceToken,
      maxClockSkewMs: config.authentication.maxClockSkewMs,
      maxReplayEntries: config.authentication.maxReplayEntries,
    })
  : new DevelopmentHeaderAuthenticator();

let lifecycle: ReturnType<typeof createConfiguredDurableRpgService>;
let resetScheduled = false;
let shutdownRequested = false;

async function requestStagingReset(): Promise<void> {
  if (!stagingBootstrapConfig) {
    throw new Error("Staging reset was requested without a configured staging campaign.");
  }
  if (resetScheduled) return;

  const resetUrl = new URL("/v1/staging/reset", config.gmBaseUrl);
  resetUrl.port = "8792";
  const response = await fetch(resetUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.gmServiceToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ campaignId: stagingBootstrapConfig.campaignId }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `RPG GM staging reset request failed (${response.status})${text ? `: ${text}` : ""}`,
    );
  }

  resetScheduled = true;
  setTimeout(() => void performLocalReset(), 150);
}

async function performLocalReset(): Promise<void> {
  try {
    shutdownRequested = true;
    await lifecycle.retire();
    await Promise.all([
      rm(config.filePath, { force: true }),
      rm(`${config.filePath}-wal`, { force: true }),
      rm(`${config.filePath}-shm`, { force: true }),
    ]);
    process.stderr.write(`${JSON.stringify({
      level: "info",
      event: "durable-rpg-staging-state-reset",
      campaignId: stagingBootstrapConfig?.campaignId,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      level: "error",
      event: "durable-rpg-staging-state-reset-failed",
      message: error instanceof Error ? error.message : "unknown failure",
    })}\n`);
  } finally {
    // Restart=on-failure intentionally brings the freshly empty staging service
    // back up, at which point the normal package bootstrap seeds the campaign.
    process.exit(75);
  }
}

lifecycle = createConfiguredDurableRpgService({
  filePath: config.filePath,
  gmBaseUrl: config.gmBaseUrl,
  gmServiceToken: config.gmServiceToken,
  authenticator,
  ...(stagingBootstrap ? { bootstrapCampaigns: [stagingBootstrap] } : {}),
  ...(stagingBootstrapConfig
    ? {
        stagingAdminReset: {
          campaignId: stagingBootstrapConfig.campaignId,
          requestReset: requestStagingReset,
        },
      }
    : {}),
  pollIntervalMs: config.pollIntervalMs,
  deliveryTimeoutMs: config.deliveryTimeoutMs,
});

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
