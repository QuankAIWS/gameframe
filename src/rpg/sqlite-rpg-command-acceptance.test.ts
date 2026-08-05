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
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-acceptance-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: "campaign-one",
    commandId: "command-one",
    authenticatedPlayerId: "discord:1234",
    expectedGameframeCoordinationRevision: 5,
    issuedAt: "2026-08-04T22:50:00.000Z",
    command: {
      kind: "campaign.submit_action",
      visibility: "public",
      text: "Inspect the academy gate.",
    },
    presentationEvents: [
      {
        eventId: "event:command-one",
        kind: "campaign.action_submitted",
        audience: { kind: "public" },
        payload: { text: "Inspect the academy gate." },
      },
    ],
    ...overrides,
  };
}

function bootstrapEvents() {
  return Array.from({ length: 8 }, (_, index) => ({
    eventId: `event:bootstrap:${index + 1}`,
    kind: "scene.presented",
    audience: { kind: "public" as const },
    payload: { index: index + 1 },
    createdAt: `2026-08-04T22:4${index}:00.000Z`,
  }));
}

function initialized(
  filePath: string,
  faultInjector?: (stage: string) => void,
) {
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  campaigns.bootstrap({
    campaignId: "campaign-one",
    title: "Reference campaign",
    status: "active",
    state: {
      gameframeCoordinationRevision: 5,
      presentationSequence: 8,
      linkedNarrativeRevision: 2,
    },
    memberships: [
      {
        playerId: "discord:1234",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
      },
      {
        playerId: "discord:observer",
        role: "observer",
        joinedPresentationSequence: 0,
      },
    ],
    events: bootstrapEvents(),
    initializedAt: "2026-08-04T22:39:00.000Z",
  });
  campaigns.close();
  return new SqliteRpgCommandAcceptanceRepository({
    filePath,
    ...(faultInjector ? { faultInjector } : {}),
  });
}

test("atomically commits state, events, receipt, and outbox for an active player", () => {
  const filePath = databasePath();
  const repository = initialized(filePath);
  const receipt = repository.acceptCommand(input());
  assert.deepEqual(receipt, {
    kind: "gameframe.command_committed",
    campaignId: "campaign-one",
    commandId: "command-one",
    deliveryId: receipt.deliveryId,
    eventIds: ["event:command-one"],
    gameframeCoordinationRevision: 6,
    presentationSequence: 9,
    linkedNarrativeRevision: 2,
  });
  assert.equal(repository.presentationEvents("campaign-one", 8).length, 1);
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  const [pending] = outbox.listPending();
  assert.equal(pending?.delivery.commandId, "command-one");
  assert.equal(pending?.delivery.acceptedGameframeCoordinationRevision, 6);
  outbox.close();
});

test("survives restart and returns exact retry without duplicates", () => {
  const filePath = databasePath();
  let repository = initialized(filePath);
  const first = repository.acceptCommand(input());
  repository.close();

  repository = new SqliteRpgCommandAcceptanceRepository({ filePath });
  const retry = repository.acceptCommand(input());
  assert.deepEqual(retry, first);
  assert.equal(repository.presentationEvents("campaign-one", 8).length, 1);
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  assert.equal(outbox.listPending().length, 1);
  outbox.close();
});

test("rejects observers and nonmembers before command mutation", () => {
  const filePath = databasePath();
  const repository = initialized(filePath);
  for (const authenticatedPlayerId of ["discord:observer", "discord:outsider"]) {
    assert.throws(
      () => repository.acceptCommand(
        input({
          commandId: `command:${authenticatedPlayerId}`,
          authenticatedPlayerId,
          presentationEvents: [],
        }),
      ),
      (error: unknown) =>
        error instanceof SqliteRpgCommandAcceptanceError
        && error.code === "player-not-authorized",
    );
  }
  assert.deepEqual(repository.state("campaign-one"), {
    gameframeCoordinationRevision: 5,
    presentationSequence: 8,
    linkedNarrativeRevision: 2,
  });
  repository.close();
});

test("rejects changed command reuse and stale revisions without side effects", () => {
  const filePath = databasePath();
  const repository = initialized(filePath);
  repository.acceptCommand(input());
  assert.throws(
    () => repository.acceptCommand(
      input({
        command: {
          kind: "campaign.submit_action",
          visibility: "public",
          text: "Open the gate.",
        },
      }),
    ),
    (error: unknown) =>
      error instanceof SqliteRpgCommandAcceptanceError
      && error.code === "command-conflict",
  );
  assert.throws(
    () => repository.acceptCommand(
      input({
        commandId: "command-two",
        expectedGameframeCoordinationRevision: 5,
        presentationEvents: [],
      }),
    ),
    (error: unknown) =>
      error instanceof SqliteRpgCommandAcceptanceError
      && error.code === "coordination-revision-conflict",
  );
  assert.equal(repository.presentationEvents("campaign-one", 8).length, 1);
  repository.close();
});

test("rolls back every authority surface when acceptance fails mid-transaction", () => {
  const filePath = databasePath();
  const repository = initialized(filePath, (stage) => {
    if (stage === "after-outbox-insert") throw new Error("injected crash");
  });
  assert.throws(() => repository.acceptCommand(input()), /injected crash/);
  assert.deepEqual(repository.state("campaign-one"), {
    gameframeCoordinationRevision: 5,
    presentationSequence: 8,
    linkedNarrativeRevision: 2,
  });
  assert.equal(repository.presentationEvents("campaign-one", 8).length, 0);
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  assert.equal(outbox.listPending().length, 0);
  outbox.close();
});

test("serializes competing repositories through SQLite revision CAS", async () => {
  const filePath = databasePath();
  const first = initialized(filePath);
  const second = new SqliteRpgCommandAcceptanceRepository({ filePath });
  const results = await Promise.allSettled([
    Promise.resolve().then(() => first.acceptCommand(input())),
    Promise.resolve().then(() => second.acceptCommand(
      input({ commandId: "command-two", presentationEvents: [] }),
    )),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  first.close();
  second.close();
});
