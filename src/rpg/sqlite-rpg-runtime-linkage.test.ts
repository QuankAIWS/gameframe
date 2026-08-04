import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SqliteRpgCommandAcceptanceRepository } from "./sqlite-rpg-command-acceptance.ts";
import {
  SqliteRpgRuntimeLinkError,
  SqliteRpgRuntimeLinkRepository,
  type DurableRuntimeEventBatch,
} from "./sqlite-rpg-runtime-linkage.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-runtime-link-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function initialize(filePath: string) {
  const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
  commands.initializeCampaign({
    campaignId: "campaign-one",
    state: {
      gameframeCoordinationRevision: 6,
      presentationSequence: 9,
      linkedNarrativeRevision: 0,
    },
    initializedAt: "2026-08-04T22:49:00.000Z",
  });
  commands.close();
}

function batch(overrides: Partial<DurableRuntimeEventBatch> = {}): DurableRuntimeEventBatch {
  return {
    protocolVersion: 2,
    coordinationMutationId: "coordination:command-one:result",
    campaignId: "campaign-one",
    expectedGameframeCoordinationRevision: 6,
    runtimeCommit: {
      kind: "runtime.narrative_committed",
      runtimeCommitKind: "runtime.events",
      runtimeCommitId: "runtime-commit:command-one",
      sourceCommandId: "command-one",
      sourceGameframeCoordinationRevision: 6,
      previousNarrativeRevision: 0,
      narrativeRevision: 1,
    },
    events: [
      {
        eventId: "event:command-one:result",
        type: "scene.presented",
        audience: { kind: "public" },
        payload: {
          sceneId: "scene:command-one:result",
          narration: "The action changes the scene.",
        },
        createdAt: "2026-08-04T22:50:01.000Z",
      },
    ],
    ...overrides,
  };
}

test("atomically links runtime narrative and presentation positions", () => {
  const filePath = databasePath();
  initialize(filePath);
  const repository = new SqliteRpgRuntimeLinkRepository({ filePath });

  const receipt = repository.acceptEvents(batch(), {
    linkedAt: "2026-08-04T22:51:00.000Z",
  });
  assert.deepEqual(receipt, {
    protocolVersion: 2,
    kind: "gameframe.runtime_link_committed",
    campaignId: "campaign-one",
    coordinationMutationId: "coordination:command-one:result",
    runtimeCommitId: "runtime-commit:command-one",
    eventIds: ["event:command-one:result"],
    gameframeCoordinationRevision: 7,
    presentationSequence: 10,
    linkedNarrativeRevision: 1,
  });
  repository.close();

  const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
  assert.deepEqual(commands.state("campaign-one"), {
    gameframeCoordinationRevision: 7,
    presentationSequence: 10,
    linkedNarrativeRevision: 1,
  });
  assert.equal(commands.presentationEvents("campaign-one").length, 1);
  commands.close();
});

test("survives restart and returns exact retry without duplicate events", () => {
  const filePath = databasePath();
  initialize(filePath);
  let repository = new SqliteRpgRuntimeLinkRepository({ filePath });
  const first = repository.acceptEvents(batch(), {
    linkedAt: "2026-08-04T22:51:00.000Z",
  });
  repository.close();

  repository = new SqliteRpgRuntimeLinkRepository({ filePath });
  const retry = repository.acceptEvents(batch(), {
    linkedAt: "2026-08-04T23:00:00.000Z",
  });
  assert.deepEqual(retry, first);
  repository.close();

  const database = new DatabaseSync(filePath);
  const count = database.prepare(
    "SELECT COUNT(*) AS count FROM rpg_presentation_events_v1 WHERE campaign_id = ?",
  ).get("campaign-one") as { count: number };
  assert.equal(Number(count.count), 1);
  database.close();
});

test("rejects changed mutation and reused runtime commit identities", () => {
  const filePath = databasePath();
  initialize(filePath);
  const repository = new SqliteRpgRuntimeLinkRepository({ filePath });
  repository.acceptEvents(batch(), { linkedAt: "2026-08-04T22:51:00.000Z" });

  assert.throws(
    () => repository.acceptEvents(
      batch({
        events: [{
          ...batch().events[0]!,
          payload: { narration: "Changed content." },
        }],
      }),
      { linkedAt: "2026-08-04T22:52:00.000Z" },
    ),
    (error: unknown) =>
      error instanceof SqliteRpgRuntimeLinkError
      && error.code === "coordination-mutation-conflict",
  );

  assert.throws(
    () => repository.acceptEvents(
      batch({
        coordinationMutationId: "coordination:other",
        expectedGameframeCoordinationRevision: 7,
        runtimeCommit: {
          ...batch().runtimeCommit,
          sourceGameframeCoordinationRevision: 7,
          previousNarrativeRevision: 1,
          narrativeRevision: 2,
        },
        events: [{
          ...batch().events[0]!,
          eventId: "event:other",
        }],
      }),
      { linkedAt: "2026-08-04T22:52:00.000Z" },
    ),
    (error: unknown) =>
      error instanceof SqliteRpgRuntimeLinkError
      && error.code === "runtime-commit-conflict",
  );
  repository.close();
});

test("rejects stale source and narrative linkage without side effects", () => {
  const filePath = databasePath();
  initialize(filePath);
  const repository = new SqliteRpgRuntimeLinkRepository({ filePath });

  assert.throws(
    () => repository.acceptEvents(
      batch({ expectedGameframeCoordinationRevision: 5 }),
      { linkedAt: "2026-08-04T22:51:00.000Z" },
    ),
    (error: unknown) =>
      error instanceof SqliteRpgRuntimeLinkError
      && error.code === "coordination-revision-conflict",
  );
  assert.throws(
    () => repository.acceptEvents(
      batch({
        runtimeCommit: {
          ...batch().runtimeCommit,
          sourceGameframeCoordinationRevision: 5,
        },
      }),
      { linkedAt: "2026-08-04T22:51:00.000Z" },
    ),
    (error: unknown) =>
      error instanceof SqliteRpgRuntimeLinkError
      && error.code === "runtime-source-revision-conflict",
  );
  assert.throws(
    () => repository.acceptEvents(
      batch({
        runtimeCommit: {
          ...batch().runtimeCommit,
          previousNarrativeRevision: 1,
          narrativeRevision: 2,
        },
      }),
      { linkedAt: "2026-08-04T22:51:00.000Z" },
    ),
    (error: unknown) =>
      error instanceof SqliteRpgRuntimeLinkError
      && error.code === "narrative-link-conflict",
  );
  repository.close();

  const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
  assert.deepEqual(commands.state("campaign-one"), {
    gameframeCoordinationRevision: 6,
    presentationSequence: 9,
    linkedNarrativeRevision: 0,
  });
  assert.equal(commands.presentationEvents("campaign-one").length, 0);
  commands.close();
});

test("rolls back presentation, positions, and link receipt on injected crash", () => {
  const filePath = databasePath();
  initialize(filePath);
  const repository = new SqliteRpgRuntimeLinkRepository({
    filePath,
    faultInjector(stage) {
      if (stage === "after-coordination-update") throw new Error("injected crash");
    },
  });

  assert.throws(
    () => repository.acceptEvents(batch(), {
      linkedAt: "2026-08-04T22:51:00.000Z",
    }),
    /injected crash/,
  );
  repository.close();

  const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
  assert.deepEqual(commands.state("campaign-one"), {
    gameframeCoordinationRevision: 6,
    presentationSequence: 9,
    linkedNarrativeRevision: 0,
  });
  assert.equal(commands.presentationEvents("campaign-one").length, 0);
  commands.close();

  const database = new DatabaseSync(filePath);
  const count = database.prepare(
    "SELECT COUNT(*) AS count FROM rpg_runtime_link_receipts_v1",
  ).get() as { count: number };
  assert.equal(Number(count.count), 0);
  database.close();
});

test("preserves runtime-only audience exactly in durable custody", () => {
  const filePath = databasePath();
  initialize(filePath);
  const repository = new SqliteRpgRuntimeLinkRepository({ filePath });
  repository.acceptEvents(
    batch({
      events: [{
        ...batch().events[0]!,
        audience: { kind: "runtime" },
      }],
    }),
    { linkedAt: "2026-08-04T22:51:00.000Z" },
  );
  repository.close();

  const database = new DatabaseSync(filePath);
  const row = database.prepare(
    "SELECT event_json FROM rpg_presentation_events_v1 WHERE campaign_id = ?",
  ).get("campaign-one") as { event_json: string };
  const stored = JSON.parse(row.event_json) as { audience: unknown };
  assert.deepEqual(stored.audience, { kind: "runtime" });
  database.close();
});

test("exact retry fails closed when a backing presentation row is corrupted", () => {
  const filePath = databasePath();
  initialize(filePath);
  let repository = new SqliteRpgRuntimeLinkRepository({ filePath });
  repository.acceptEvents(batch(), { linkedAt: "2026-08-04T22:51:00.000Z" });
  repository.close();

  const database = new DatabaseSync(filePath);
  database.prepare(
    "UPDATE rpg_presentation_events_v1 SET event_json = ? WHERE event_id = ?",
  ).run(JSON.stringify({ audience: { kind: "public" } }), "event:command-one:result");
  database.close();

  repository = new SqliteRpgRuntimeLinkRepository({ filePath });
  assert.throws(
    () => repository.acceptEvents(batch(), {
      linkedAt: "2026-08-04T22:52:00.000Z",
    }),
    (error: unknown) =>
      error instanceof SqliteRpgRuntimeLinkError
      && error.code === "corrupt-store",
  );
  repository.close();
});
