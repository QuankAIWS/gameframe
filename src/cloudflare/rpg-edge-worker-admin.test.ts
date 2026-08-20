import assert from "node:assert/strict";
import test from "node:test";

import type { PrincipalSource, RequestAuthenticator } from "../auth/request-authenticator.ts";
import { createRpgEdgeGameFrameWorker } from "./rpg-edge-worker.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

function environment(adminIds: string): GameFrameWorkerEnv {
  return {
    SESSION_SECRET: "s".repeat(48),
    GAMEFRAME_ADMIN_DISCORD_USER_IDS: adminIds,
    GAMEFRAME_RPG_ORIGIN_URL: "https://rpg-origin-staging.gameframe.cc",
    GAMEFRAME_RPG_PROXY_HMAC_SECRET: "h".repeat(48),
    MATCHES: {} as GameFrameWorkerEnv["MATCHES"],
  };
}

function authenticator(playerId: string, source: PrincipalSource = "discord"): RequestAuthenticator {
  return {
    async authenticate() {
      return {
        playerId,
        source,
        displayName: "Tester",
      };
    },
  };
}

test("RPG edge surfaces the server-derived staging admin capability in the session", async () => {
  const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator("discord:1234") });
  const response = await worker.fetch(
    new Request("https://staging.gameframe.cc/api/session"),
    environment("1234"),
  );
  assert.equal(response.status, 200);
  const session = await response.json() as Record<string, unknown>;
  assert.equal(session.authenticated, true);
  assert.equal(session.playerId, "discord:1234");
  assert.equal(session.admin, true);
});

test("RPG edge rejects a normal allowed player before privileged reset requests reach the VM", async () => {
  const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator("discord:5678") });
  const response = await worker.fetch(
    new Request("https://staging.gameframe.cc/api/rpg/admin/reset-staging", {
      method: "POST",
      headers: {
        origin: "https://staging.gameframe.cc",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        campaignId: "monster-master-staging",
        confirmation: "RESET MONSTER MASTER STAGING",
      }),
    }),
    environment("1234"),
  );
  assert.equal(response.status, 403);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.error, "forbidden");
});

test("RPG edge rejects a normal allowed player before diagnostics reach the VM", async () => {
  const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator("discord:5678") });
  const response = await worker.fetch(
    new Request("https://staging.gameframe.cc/api/rpg/admin/staging-diagnostics"),
    environment("1234"),
  );
  assert.equal(response.status, 403);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.error, "forbidden");
});

test("GameFrame player administration rejects non-admin Discord users before reading player state", async () => {
  const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator("discord:5678") });
  const response = await worker.fetch(
    new Request("https://staging.gameframe.cc/api/admin/players/discord%3A1234"),
    environment("1234"),
  );
  assert.equal(response.status, 403);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.error, "forbidden");
});

test("GameFrame player administration does not grant admin authority to a non-Discord identity with the same ID", async () => {
  const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator("discord:1234", "service") });
  const response = await worker.fetch(
    new Request("https://staging.gameframe.cc/api/admin/players/discord%3A1234"),
    environment("1234"),
  );
  assert.equal(response.status, 403);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.error, "forbidden");
});

test("GameFrame match void requires an exact same-origin mutation even for an administrator", async () => {
  const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator("discord:1234") });
  for (const origin of [null, "https://evil.example"]) {
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    const response = await worker.fetch(
      new Request("https://staging.gameframe.cc/api/admin/matches/test-match/void", {
        method: "POST",
        headers,
      }),
      environment("1234"),
    );
    assert.equal(response.status, 403);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.error, "forbidden");
  }
});
