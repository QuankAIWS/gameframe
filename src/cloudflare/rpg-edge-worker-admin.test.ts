import { describe, expect, it } from "vitest";

import type { RequestAuthenticator } from "../auth/request-authenticator.ts";
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

function authenticator(playerId: string): RequestAuthenticator {
  return {
    async authenticate() {
      return {
        playerId,
        source: "discord",
        displayName: "Tester",
      };
    },
  };
}

describe("RPG edge staging administrator authority", () => {
  it("surfaces the server-derived admin capability in the session", async () => {
    const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator("discord:1234") });
    const response = await worker.fetch(
      new Request("https://staging.gameframe.cc/api/session"),
      environment("1234"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      playerId: "discord:1234",
      admin: true,
    });
  });

  it("rejects a normal allowed player before the privileged request reaches the VM", async () => {
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
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden" });
  });
});
