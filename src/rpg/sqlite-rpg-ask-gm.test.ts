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
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-ask-gm-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function initialized(filePath: string) {
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  campaigns.bootstrap({
    campaignId: "campaign-ask-gm",
    title: "Ask GM contract",
    status: "active",
    state: {
      gameframeCoordinationRevision: 2,
      presentationSequence: 1,
      linkedNarrativeRevision: 1,
    },
    memberships: [{
      playerId: "discord:1234",
      role: "player",
      joinedPresentationSequence: 0,
    }],
    events: [{
      eventId: "event:opening",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: { narration: "Opening." },
      createdAt: "2026-08-09T21:40:00.000Z",
    }],
    initializedAt: "2026-08-09T21:39:00.000Z",
  });
  campaigns.close();
  return new SqliteRpgCommandAcceptanceRepository({ filePath });
}

test("Ask GM communication survives durable acceptance and outbox custody", () => {
  const filePath = databasePath();
  const repository = initialized(filePath);
  const receipt = repository.acceptCommand({
    campaignId: "campaign-ask-gm",
    commandId: "command:ask-gm",
    authenticatedPlayerId: "discord:1234",
    expectedGameframeCoordinationRevision: 2,
    issuedAt: "2026-08-09T21:41:00.000Z",
    command: {
      kind: "campaign.submit_action",
      visibility: "private-to-runtime",
      communication: "ask-gm",
      text: "What do I actually know about this checkpoint?",
    },
    presentationEvents: [],
  });
  const committed = repository.committedCommand("campaign-ask-gm", "command:ask-gm");
  assert.equal(committed?.receipt.deliveryId, receipt.deliveryId);
  assert.deepEqual(committed?.delivery.command, {
    kind: "campaign.submit_action",
    visibility: "private-to-runtime",
    communication: "ask-gm",
    text: "What do I actually know about this checkpoint?",
  });
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  const [pending] = outbox.listPending();
  assert.equal(pending?.delivery.command.kind, "campaign.submit_action");
  assert.equal(
    pending?.delivery.command.kind === "campaign.submit_action"
      ? pending.delivery.command.communication
      : undefined,
    "ask-gm",
  );
  outbox.close();
});

test("private fictional actions remain distinct and invalid Ask GM combinations fail closed", () => {
  const filePath = databasePath();
  const repository = initialized(filePath);
  repository.acceptCommand({
    campaignId: "campaign-ask-gm",
    commandId: "command:quiet-action",
    authenticatedPlayerId: "discord:1234",
    expectedGameframeCoordinationRevision: 2,
    issuedAt: "2026-08-09T21:42:00.000Z",
    command: {
      kind: "campaign.submit_action",
      visibility: "private-to-runtime",
      text: "I quietly inspect the torn inspection tag.",
    },
    presentationEvents: [],
  });
  const privateAction = repository.committedCommand("campaign-ask-gm", "command:quiet-action");
  assert.deepEqual(privateAction?.delivery.command, {
    kind: "campaign.submit_action",
    visibility: "private-to-runtime",
    text: "I quietly inspect the torn inspection tag.",
  });

  assert.throws(() => repository.acceptCommand({
    campaignId: "campaign-ask-gm",
    commandId: "command:public-ask-gm",
    authenticatedPlayerId: "discord:1234",
    expectedGameframeCoordinationRevision: 3,
    issuedAt: "2026-08-09T21:43:00.000Z",
    command: {
      kind: "campaign.submit_action",
      visibility: "public",
      communication: "ask-gm",
      text: "Answer me privately.",
    },
    presentationEvents: [],
  }), (error: unknown) =>
    error instanceof SqliteRpgCommandAcceptanceError
    && error.code === "invalid-input"
    && /private-to-runtime/.test(error.message));
  repository.close();
});
