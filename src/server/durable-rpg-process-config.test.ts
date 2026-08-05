import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { parseDurableRpgProcessConfig } from "./durable-rpg-process-config.ts";

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GAMEFRAME_ALLOW_DEVELOPMENT_AUTH: "1",
    GAMEFRAME_RPG_DATABASE_PATH: "./state/gameframe.sqlite",
    RPG_GM_BASE_URL: "http://127.0.0.1:8791",
    RPG_GM_SERVICE_TOKEN: "x".repeat(48),
    ...overrides,
  };
}

test("parses the initial single-VM loopback configuration", () => {
  assert.deepEqual(parseDurableRpgProcessConfig(environment()), {
    filePath: resolve("./state/gameframe.sqlite"),
    host: "127.0.0.1",
    port: 8790,
    gmBaseUrl: "http://127.0.0.1:8791/",
    gmServiceToken: "x".repeat(48),
    pollIntervalMs: 250,
    deliveryTimeoutMs: 10_000,
    developmentAuthEnabled: true,
  });
});

test("requires explicit development-auth acknowledgement", () => {
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_ALLOW_DEVELOPMENT_AUTH: undefined,
    })),
    /GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1/,
  );
});

test("rejects non-loopback GameFrame binding while trusted headers are enabled", () => {
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_HOST: "0.0.0.0",
    })),
    /loopback-only/,
  );
});

test("rejects a remote GM endpoint in the initial same-VM deployment", () => {
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      RPG_GM_BASE_URL: "https://gm.example.com",
    })),
    /loopback GM service/,
  );
});

test("requires durable state, GM endpoint, and a bounded service token", () => {
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_DATABASE_PATH: "",
    })),
    /GAMEFRAME_RPG_DATABASE_PATH is required/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      RPG_GM_BASE_URL: "",
    })),
    /RPG_GM_BASE_URL is required/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      RPG_GM_SERVICE_TOKEN: "short",
    })),
    /at least 32 characters/,
  );
});

test("parses bounded port, polling, and delivery timeout overrides", () => {
  const config = parseDurableRpgProcessConfig(environment({
    GAMEFRAME_RPG_PORT: "18890",
    GAMEFRAME_RPG_DELIVERY_POLL_MS: "500",
    GAMEFRAME_RPG_DELIVERY_TIMEOUT_MS: "2500",
  }));
  assert.equal(config.port, 18_890);
  assert.equal(config.pollIntervalMs, 500);
  assert.equal(config.deliveryTimeoutMs, 2_500);

  assert.throws(
    () => parseDurableRpgProcessConfig(environment({ GAMEFRAME_RPG_PORT: "0" })),
    /GAMEFRAME_RPG_PORT/,
  );
  assert.throws(
    () => parseDurableRpgProcessConfig(environment({
      GAMEFRAME_RPG_DELIVERY_POLL_MS: "abc",
    })),
    /GAMEFRAME_RPG_DELIVERY_POLL_MS/,
  );
});
