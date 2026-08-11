import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SqliteRpgCampaignIndex } from "./sqlite-rpg-campaign-index.ts";
import { SqliteRpgCampaignStore, type DurableCampaignBootstrap } from "./sqlite-rpg-campaign-store.ts";

function campaign(input: {
  campaignId: string;
  title: string;
  initializedAt: string;
  playerId: string;
  role?: "player" | "observer";
  leftPresentationSequence?: number;
}): DurableCampaignBootstrap {
  const role = input.role ?? "player";
  return {
    campaignId: input.campaignId,
    title: input.title,
    status: "active",
    state: {
      gameframeCoordinationRevision: 3,
      presentationSequence: 3,
      linkedNarrativeRevision: 1,
    },
    memberships: [{
      playerId: input.playerId,
      role,
      ...(role === "player" ? { partyId: "party:main" } : {}),
      joinedPresentationSequence: 0,
      ...(input.leftPresentationSequence === undefined
        ? {}
        : { leftPresentationSequence: input.leftPresentationSequence }),
    }],
    events: [1, 2, 3].map((sequence) => ({
      eventId: `event:${input.campaignId}:${sequence}`,
      kind: "campaign.index_fixture",
      audience: { kind: "public" as const },
      payload: { sequence },
      createdAt: input.initializedAt,
    })),
    initializedAt: input.initializedAt,
  };
}

test("lists only campaigns with an active membership for the authenticated player", () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-campaign-index-"));
  const filePath = join(directory, "gameframe.sqlite");
  try {
    const store = new SqliteRpgCampaignStore({ filePath });
    store.bootstrap(campaign({
      campaignId: "campaign:active-player",
      title: "Active Player Campaign",
      initializedAt: "2026-08-10T18:00:00.000Z",
      playerId: "player:ada",
    }));
    store.bootstrap(campaign({
      campaignId: "campaign:observer",
      title: "Observer Campaign",
      initializedAt: "2026-08-10T18:05:00.000Z",
      playerId: "player:ada",
      role: "observer",
    }));
    store.bootstrap(campaign({
      campaignId: "campaign:left",
      title: "Former Campaign",
      initializedAt: "2026-08-10T18:10:00.000Z",
      playerId: "player:ada",
      leftPresentationSequence: 2,
    }));
    store.bootstrap(campaign({
      campaignId: "campaign:other-player",
      title: "Someone Else's Campaign",
      initializedAt: "2026-08-10T18:15:00.000Z",
      playerId: "player:bryn",
    }));
    store.close();

    const index = new SqliteRpgCampaignIndex({ filePath });
    assert.deepEqual(index.listForPlayer("player:ada"), {
      protocolVersion: 1,
      kind: "campaign.index",
      playerId: "player:ada",
      campaigns: [
        {
          campaignId: "campaign:observer",
          title: "Observer Campaign",
          status: "active",
          role: "observer",
          gameframeCoordinationRevision: 3,
          presentationSequence: 3,
          linkedNarrativeRevision: 1,
          updatedAt: "2026-08-10T18:05:00.000Z",
        },
        {
          campaignId: "campaign:active-player",
          title: "Active Player Campaign",
          status: "active",
          role: "player",
          partyId: "party:main",
          gameframeCoordinationRevision: 3,
          presentationSequence: 3,
          linkedNarrativeRevision: 1,
          updatedAt: "2026-08-10T18:00:00.000Z",
        },
      ],
    });
    index.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
