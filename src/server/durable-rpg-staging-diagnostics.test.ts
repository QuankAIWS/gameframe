import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { RequestAuthenticator } from "../auth/request-authenticator.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const CAMPAIGN_ID = "monster-master-staging-v6";
const PLAYER_ID = "discord:diagnostics-admin";

const discordAuthenticator: RequestAuthenticator = {
  async authenticate() {
    return {
      playerId: PLAYER_ID,
      source: "discord",
      displayName: "Diagnostics Admin",
    };
  },
};

const developmentAuthenticator: RequestAuthenticator = {
  async authenticate() {
    return {
      playerId: PLAYER_ID,
      source: "development",
      displayName: "Local Admin",
    };
  },
};

test("staging diagnostics return canonical campaign and pending Runtime delivery evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-staging-diagnostics-"));
  const server = createDurableRpgHttpServer({
    filePath: join(directory, "gameframe.sqlite"),
    authenticator: discordAuthenticator,
    clock: () => "2026-08-15T15:10:00.000Z",
    bootstrapCampaigns: [bootstrap()],
    stagingAdminReset: {
      campaignId: CAMPAIGN_ID,
      requestReset() {},
    },
  });
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = serverBaseUrl(server);

    const command = await fetch(`${baseUrl}/api/rpg/campaigns/${CAMPAIGN_ID}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        protocolVersion: 2,
        campaignId: CAMPAIGN_ID,
        commandId: "command:cart-diagnostics",
        issuedAt: "2026-08-15T15:09:00.000Z",
        command: {
          kind: "campaign.submit_action",
          visibility: "public",
          expectedGameframeCoordinationRevision: 0,
          text: "Uncover the checkpoint cart.",
        },
      }),
    });
    assert.equal(command.status, 200);

    const response = await fetch(`${baseUrl}/api/rpg/admin/staging-diagnostics`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const diagnostics = await response.json() as Record<string, any>;
    assert.equal(diagnostics.schemaVersion, "gameframe.rpg.session-diagnostics.v1");
    assert.equal(diagnostics.campaign.campaignId, CAMPAIGN_ID);
    assert.equal(diagnostics.commands.length, 1);
    assert.equal(diagnostics.commands[0].commandId, "command:cart-diagnostics");
    assert.equal(diagnostics.commands[0].delivery.command.text, "Uncover the checkpoint cart.");
    assert.equal(diagnostics.commands[0].runtime.status, "pending");
    assert.equal(diagnostics.commands[0].runtime.attemptCount, 0);
  } finally {
    await closeServer(server);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("staging diagnostics reject non-Discord origin principals", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-staging-diagnostics-"));
  const server = createDurableRpgHttpServer({
    filePath: join(directory, "gameframe.sqlite"),
    authenticator: developmentAuthenticator,
    bootstrapCampaigns: [bootstrap()],
    stagingAdminReset: {
      campaignId: CAMPAIGN_ID,
      requestReset() {},
    },
  });
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const response = await fetch(`${serverBaseUrl(server)}/api/rpg/admin/staging-diagnostics`);
    assert.equal(response.status, 403);
  } finally {
    await closeServer(server);
    rmSync(directory, { recursive: true, force: true });
  }
});

function bootstrap() {
  return {
    campaignId: CAMPAIGN_ID,
    title: "Monster Master Staging",
    status: "active" as const,
    state: {
      gameframeCoordinationRevision: 0,
      presentationSequence: 1,
      linkedNarrativeRevision: 0,
    },
    memberships: [{
      playerId: PLAYER_ID,
      role: "player" as const,
      joinedPresentationSequence: 0,
    }],
    events: [{
      eventId: "event:staging-intro",
      kind: "scene.presented",
      audience: { kind: "public" as const },
      payload: { text: "The checkpoint blocks the road." },
      createdAt: "2026-08-15T15:00:00.000Z",
    }],
    initializedAt: "2026-08-15T15:00:00.000Z",
  };
}

function serverBaseUrl(server: ReturnType<typeof createDurableRpgHttpServer>): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing TCP address");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: ReturnType<typeof createDurableRpgHttpServer>): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
