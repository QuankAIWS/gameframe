import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestAuthenticator } from "../auth/request-authenticator.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const cleanup: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

const discordAuthenticator: RequestAuthenticator = {
  async authenticate() {
    return {
      playerId: "discord:1234",
      source: "discord",
      displayName: "Admin",
    };
  },
};

describe("durable RPG staging administrator reset", () => {
  it("requires an exact confirmation and invokes only the configured reset hook", async () => {
    const directory = mkdtempSync(join(tmpdir(), "gameframe-staging-admin-"));
    cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
    const requestReset = vi.fn();
    const server = createDurableRpgHttpServer({
      filePath: join(directory, "gameframe.sqlite"),
      authenticator: discordAuthenticator,
      stagingAdminReset: {
        campaignId: "monster-master-staging",
        requestReset,
      },
    });
    cleanup.push(() => new Promise<void>((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
    }));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing TCP address");
    const url = `http://127.0.0.1:${address.port}/api/rpg/admin/reset-staging`;

    const rejected = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: "monster-master-staging",
        confirmation: "wrong",
      }),
    });
    expect(rejected.status).toBe(400);
    expect(requestReset).not.toHaveBeenCalled();

    const accepted = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: "monster-master-staging",
        confirmation: "RESET MONSTER MASTER STAGING",
      }),
    });
    expect(accepted.status).toBe(202);
    await expect(accepted.json()).resolves.toEqual({
      status: "resetting",
      campaignId: "monster-master-staging",
    });
    expect(requestReset).toHaveBeenCalledTimes(1);
  });
});
