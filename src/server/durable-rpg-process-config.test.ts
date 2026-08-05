import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { parseDurableRpgProcessConfig } from "./durable-rpg-process-config.ts";

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GAMEFRAME_RPG_AUTH_MODE: "hmac-proxy",
    GAMEFRAME_RPG_PROXY_HMAC_SECRET: "p".repeat(48),
    GAMEFRAME_RPG_DATABASE_PATH: "./state/gameframe.sqlite",
    RPG_GM_BASE_URL: "http://127.0.0.1:8791",
    RPG_GM_SERVICE_TOKEN: "x".repeat(48),
    ...overrides,
  };
}

test("parses the production single-VM HMAC proxy configuration", () => {
  assert.deepEqual(parseDurableRpgProcessConfig(environment()), {
    filePath: resolve("./state/gameframe.sqlite"),
    host: "127.0.0.1",
    port: 8790,
    gmBaseUrl: "http://127.0.0.1:8791/",
    gmServiceToken: "x".repeat(48),
    pollIntervalMs: 250,
    deliveryTimeoutMs: 10_000,
    authentication: {
      mode: "hmac-proxy",
      proxyHmacSecret: "p".repeat(48),
      maxClockSkewMs: 60_000,
      maxReplayEntries: 10_000,
    },
  });
});

test("development headers remain explicit and loopback-only", () => {
  assert.deepEqual(parseDurableRpgProcessConfig(environment({
    GAMEFRAME_RPG_AUTH_MODE: "development-header",
    GAMEFRAME_RPG_PROXY_HMAC_SECRET: undefined,
    GAMEFRAME_ALLOW_DEVELOPMENT_AUTH: "1",
  })).authentication, { mode: "development-header" });
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_AUTH_MODE: "development-header",
      GAMEFRAME_RPG_PROXY_HMAC_SECRET: undefined,
      GAMEFRAME_ALLOW_DEVELOPMENT_AUTH: undefined,
    })),
    /GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({ GAMEFRAME_RPG_HOST: "0.0.0.0" })),
    /loopback-only/,
  );
});

test("HMAC mode fails closed on missing or weak proxy secrets", () => {
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_PROXY_HMAC_SECRET: undefined,
    })),
    /GAMEFRAME_RPG_PROXY_HMAC_SECRET is required/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_PROXY_HMAC_SECRET: "short",
    })),
    /at least 32 bytes/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_AUTH_MODE: "unknown",
    })),
    /development-header or hmac-proxy/,
  );
});

test("rejects a remote GM endpoint and weak service token", () => {
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      RPG_GM_BASE_URL: "https://gm.example.com",
    })),
    /loopback GM service/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      RPG_GM_SERVICE_TOKEN: "short",
    })),
    /at least 32 bytes/,
  );
});

test("parses bounded service and HMAC replay overrides", () => {
  const config = parseDurableRpgProcessConfig(environment({
    GAMEFRAME_RPG_PORT: "18890",
    GAMEFRAME_RPG_DELIVERY_POLL_MS: "500",
    GAMEFRAME_RPG_DELIVERY_TIMEOUT_MS: "2500",
    GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS: "45000",
    GAMEFRAME_RPG_PROXY_MAX_REPLAY_ENTRIES: "25000",
  }));
  assert.equal(config.port, 18_890);
  assert.equal(config.pollIntervalMs, 500);
  assert.equal(config.deliveryTimeoutMs, 2_500);
  assert.deepEqual(config.authentication, {
    mode: "hmac-proxy",
    proxyHmacSecret: "p".repeat(48),
    maxClockSkewMs: 45_000,
    maxReplayEntries: 25_000,
  });

  assert.throws(
    () => parseDurableRpgProcessConfig(environment({ GAMEFRAME_RPG_PORT: "0" })),
    /GAMEFRAME_RPG_PORT/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS: "999",
    })),
    /GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS/,
  );
});
