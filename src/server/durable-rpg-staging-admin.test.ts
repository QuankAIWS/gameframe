import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { RequestAuthenticator } from "../auth/request-authenticator.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const cleanup: Array<() => Promise<void> | void> = [];

test.afterEach(async () => {
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

test("durable RPG staging reset requires exact confirmation and invokes only its reset hook", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-staging-admin-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  let requestResetCount = 0;
  const server = createDurableRpgHttpServer({
    filePath: join(directory, "gameframe.sqlite"),
    authenticator: discordAuthenticator,
    stagingAdminReset: {
      campaignId: "monster-master-staging-v5",
      requestReset() {
        requestResetCount += 1;
      },
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
  assert.equal(wrongCampaign.status, 400);
  assert.equal(requestResetCount, 0);

  const rejected = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      campaignId: "monster-master-staging-v5",
      confirmation: "wrong",
    }),
  });
  assert.equal(rejected.status, 400);
  assert.equal(requestResetCount, 0);

  const accepted = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      campaignId: "monster-master-staging-v5",
      confirmation: "RESET MONSTER MASTER STAGING",
    }),
  });
  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), {
    status: "resetting",
    campaignId: "monster-master-staging-v5",
  });
  assert.equal(requestResetCount, 1);
});

test("browser reset request, cleanup, and reload remain bound to the canonical staging campaign", async () => {
  const source = await readFile(
    new URL("../../public/monster-master-rpg-admin.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /const STAGING_CAMPAIGN_ID = "monster-master-staging-v6"/);
  assert.match(source, /campaignId: STAGING_CAMPAIGN_ID/);
  assert.match(source, /profile\.v1:\$\{STAGING_CAMPAIGN_ID\}/);
  assert.match(source, /url\.searchParams\.set\("campaign", STAGING_CAMPAIGN_ID\)/);
  assert.match(source, /stagingCampaignId: STAGING_CAMPAIGN_ID/);
  assert.doesNotMatch(source, /#mm-rpg-campaign-code/);
  assert.doesNotMatch(source, /new URLSearchParams\(window\.location\.search\)/);
});
