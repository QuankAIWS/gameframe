import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SqliteRuntimeCommandOutbox } from "./runtime-command-outbox.ts";
import {
  SqliteRpgCommandAcceptanceError,
  SqliteRpgCommandAcceptanceRepository,
  type DurableGameFrameCommandInput,
} from "./sqlite-rpg-command-acceptance.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-command-acceptance-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function commandInput(
  overrides: Partial<DurableGameFrameCommandInput> = {},
): DurableGameFrameCommandInput {
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

function initializedRepository(
  filePath: string,
  faultInjector?: (stage: string) => void,
): SqliteRpgCommandAcceptanceRepository {
  const repository = new SqliteRpgCommandAcceptanceRepository({
    filePath,
    ...(faultInjector ? { faultInjector } : {}),
  });
  repository.initializeCampaign({
    campaignId: "campaign-one",
    state: {
      gameframeCoordinationRevision: 5,
      presentationSequence: 8,
      linkedNarrativeRevision: 2,
    },
    initializedAt: "2026-08-04T22:49:00.000Z",
  });
  return repository;
}

test("atomically commits coordination, presentation, receipt, and outbox custody", () => {
  const filePath = databasePath();
  const repository = initializedRepository(filePath);

  const receipt = repository.acceptCommand(commandInput());
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
  assert.equal(repository.presentationEvents("campaign-one").length, 1);
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  const [pending] = outbox.listPending();
  assert.equal(pending?.delivery.commandId, "command-one");
  assert.equal(pending?.delivery.acceptedGameframeCoordinationRevision, 6);
  outbox.close();
});

test("survives restart and returns exact retry without duplicate state", () => {
  const filePath = databasePath();
  let repository = initializedRepository(filePath);
  const first = repository.acceptCommand(commandInput());
  repository.close();

  repository = new SqliteRpgCommandAcceptanceRepository({ filePath });
  const retry = repository.acceptCommand(commandInput());
  assert.deepEqual(retry, first);
  assert.equal(repository.presentationEvents("campaign-one").length, 1);
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  assert.equal(outbox.listPending().length, 1);
  outbox.close();
});

test("rejects changed reuse and stale revisions without side effects", () => {
  const filePath = databasePath();
  const repository = initializedRepository(filePath);
  repository.acceptCommand(commandInput());

  assert.throws(
    () =>
      repository.acceptCommand(
        commandInput({
          command: {
            kind: "campaign.submit_action",
            visibility: "public",
            text: "Open the academy gate.",
          },
        }),
      ),
    (error: unknown) =>
      error instanceof SqliteRpgCommandAcceptanceError
      && error.code === "command-conflict",
  );
  assert.throws(
    () =>
      repository.acceptCommand(
        commandInput({
          commandId: "command-two",
          expectedGameframeCoordinationRevision: 5,
          presentationEvents: [],
        }),
      ),
    (error: unknown) =>
      error instanceof SqliteRpgCommandAcceptanceError
      && error.code === "coordination-revision-conflict",
  );
  assert.equal(repository.presentationEvents("campaign-one").length, 1);
  repository.close();
});

test("rolls back every authority surface when acceptance fails mid-transaction", () => {
  const filePath = databasePath();
  const repository = initializedRepository(filePath, (stage) => {
    if (stage === "after-outbox-insert") {
      throw new Error("injected crash");
    }
  });

  assert.throws(() => repository.acceptCommand(commandInput()), /injected crash/);
  assert.deepEqual(repository.state("campaign-one"), {
    gameframeCoordinationRevision: 5,
    presentationSequence: 8,
    linkedNarrativeRevision: 2,
  });
  assert.equal(repository.presentationEvents("campaign-one").length, 0);
  repository.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  assert.equal(outbox.listPending().length, 0);
  outbox.close();
});

test("serializes competing repository instances through the revision CAS", async () => {
  const filePath = databasePath();
  const first = initializedRepository(filePath);
  const second = new SqliteRpgCommandAcceptanceRepository({ filePath });

  const results = await Promise.allSettled([
    Promise.resolve().then(() => first.acceptCommand(commandInput())),
    Promise.resolve().then(() =>
      second.acceptCommand(
        commandInput({
          commandId: "command-two",
          presentationEvents: [],
        }),
      ),
    ),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  first.close();
  second.close();
});
