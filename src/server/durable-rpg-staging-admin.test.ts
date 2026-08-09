import { once } from "node:events";
import { readFile } from "node:fs/promises";
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
        campaignId: "monster-master-staging-v5",
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

    const wrongCampaign = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: "monster-master-staging",
        confirmation: "RESET MONSTER MASTER STAGING",
      }),
    });
    expect(wrongCampaign.status).toBe(400);
    expect(requestReset).not.toHaveBeenCalled();

    const rejected = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: "monster-master-staging-v5",
        confirmation: "wrong",
      }),
    });
    expect(rejected.status).toBe(400);
    expect(requestReset).not.toHaveBeenCalled();

    const accepted = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: "monster-master-staging-v5",
        confirmation: "RESET MONSTER MASTER STAGING",
      }),
    });
    expect(accepted.status).toBe(202);
    await expect(accepted.json()).resolves.toEqual({
      status: "resetting",
      campaignId: "monster-master-staging-v5",
    });
    expect(requestReset).toHaveBeenCalledTimes(1);
  });

  it("binds the browser reset request, confirmation, and reload to the active campaign", async () => {
    const source = await readFile(
      new URL("../../public/monster-master-rpg-admin.js", import.meta.url),
      "utf8",
    );

    expect(source).toContain('document.querySelector("#mm-rpg-campaign-code")');
    expect(source).toContain('new URLSearchParams(window.location.search).get("campaign")');
    expect(source).toContain("let armedCampaignId = null");
    expect(source).toContain("armedCampaignId !== campaignId");
    expect(source).toContain("const confirmedCampaignId = armedCampaignId");
    expect(source).toContain("campaignId: confirmedCampaignId");
    expect(source).toContain("url.searchParams.set(\"campaign\", confirmedCampaignId)");
    expect(source).not.toContain('campaignId: "monster-master-staging"');
    expect(source).not.toContain('profile.v1:monster-master-staging"');
  });
});
