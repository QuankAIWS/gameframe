import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SqliteRuntimeCommandOutbox } from "./runtime-command-outbox.ts";
import { SqliteRpgCampaignStore } from "./sqlite-rpg-campaign-store.ts";
import {
  SqliteRpgCommandAcceptanceError,
  SqliteRpgCommandAcceptanceRepository,
} from "./sqlite-rpg-command-acceptance.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-travel-acceptance-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function initialized(filePath: string): SqliteRpgCommandAcceptanceRepository {
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  campaigns.bootstrap({
    campaignId: "campaign-one",
    title: "Travel acceptance regression",
    status: "active",
    state: {
      gameframeCoordinationRevision: 0,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [
      {
        playerId: "discord:1234",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
      },
    ],
    events: [],
    initializedAt: "2026-08-11T20:00:00.000Z",
  });
  campaigns.close();
  return new SqliteRpgCommandAcceptanceRepository({ filePath });
}

function travelCommand() {
  return {
    kind: "campaign.submit_action" as const,
    visibility: "public" as const,
    text: "Travel west.",
    interaction: {
      kind: "travel" as const,
      routeId: "route.west-woods",
    },
  };
}

test("preserves Travel routeId through durable command and Runtime outbox custody", () => {
  const filePath = databasePath();
  const repository = initialized(filePath);
  const command = travelCommand();

  const receipt = repository.acceptCommand({
    campaignId: "campaign-one",
    commandId: "command:travel-west",
    authenticatedPlayerId: "discord:1234",
    expectedGameframeCoordinationRevision: 0,
    issuedAt: "2026-08-11T20:01:00.000Z",
    command,
    presentationEvents: [],
  });

  const committed = repository.committedCommand("campaign-one", "command:travel-west");
  assert.equal(committed?.receipt.deliveryId, receipt.deliveryId);
  assert.deepEqual(committed?.delivery.command, command);
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  const [pending] = outbox.listPending();
  assert.equal(pending?.delivery.commandId, "command:travel-west");
  assert.deepEqual(pending?.delivery.command, command);
  outbox.close();
});

test("Travel rejects fields outside the canonical routeId interaction", () => {
  const filePath = databasePath();
  const repository = initialized(filePath);

  assert.throws(
    () => repository.acceptCommand({
      campaignId: "campaign-one",
      commandId: "command:forged-travel",
      authenticatedPlayerId: "discord:1234",
      expectedGameframeCoordinationRevision: 0,
      issuedAt: "2026-08-11T20:01:00.000Z",
      command: {
        ...travelCommand(),
        interaction: {
          kind: "travel",
          routeId: "route.west-woods",
          destinationSceneId: "scene.forged",
        },
      },
      presentationEvents: [],
    }),
    (error: unknown) =>
      error instanceof SqliteRpgCommandAcceptanceError
      && error.code === "invalid-input"
      && /unsupported fields/.test(error.message),
  );

  repository.close();
});
