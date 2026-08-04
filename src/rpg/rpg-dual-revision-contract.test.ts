import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  InMemoryRpgRevisionLedger,
  RpgRevisionContractError,
  type GameFrameCoordinationCommand,
  type RpgRevisionPosition,
  type RuntimeCommitRequest,
} from "./rpg-dual-revision-contract.ts";

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonRecord;
}

function readFixture(): JsonRecord {
  return JSON.parse(
    readFileSync(
      new URL(
        "../../planning/fixtures/rpg/v1/campaign-revision-linkage.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as JsonRecord;
}

test("dual revision fixture keeps GameFrame coordination and narrative truth independent", () => {
  const fixture = readFixture();
  assert.equal(fixture.contract, "rpg-dual-revision-linkage");
  assert.equal(fixture.slice, "campaign-revision-linkage");

  const startingPosition = record(
    fixture.startingPosition,
    "startingPosition",
  ) as RpgRevisionPosition;
  const ledger = new InMemoryRpgRevisionLedger(startingPosition);

  const playerCase = record(fixture.playerCommandCase, "playerCommandCase");
  const playerPosition = ledger.acceptGameFrameCommand(
    record(playerCase.request, "playerCommandCase.request") as GameFrameCoordinationCommand,
  );
  assert.deepEqual(playerPosition, record(playerCase.expected, "playerCommandCase.expected"));

  const runtimeCase = record(fixture.runtimeEventCommitCase, "runtimeEventCommitCase");
  const runtimeRequest = record(
    runtimeCase.request,
    "runtimeEventCommitCase.request",
  ) as RuntimeCommitRequest;
  const runtimeReceipt = ledger.acceptRuntimeCommit(runtimeRequest);
  const runtimeExpected = record(runtimeCase.expected, "runtimeEventCommitCase.expected");
  assert.equal(
    runtimeReceipt.gameframeCoordinationRevision,
    runtimeExpected.gameframeCoordinationRevision,
  );
  assert.equal(runtimeReceipt.narrativeRevision, runtimeExpected.narrativeRevision);
  assert.equal(runtimeReceipt.runtimeCommitId, runtimeRequest.runtimeCommitId);
  assert.equal(runtimeReceipt.sourceCommandId, runtimeRequest.sourceCommandId);
  assert.deepEqual(ledger.acceptRuntimeCommit(runtimeRequest), runtimeReceipt);

  const launchCase = record(fixture.encounterLaunchCommitCase, "encounterLaunchCommitCase");
  const launchRequest = record(
    launchCase.request,
    "encounterLaunchCommitCase.request",
  ) as RuntimeCommitRequest;
  const launchReceipt = ledger.acceptRuntimeCommit(launchRequest);
  const launchExpected = record(launchCase.expected, "encounterLaunchCommitCase.expected");
  assert.equal(
    launchReceipt.gameframeCoordinationRevision,
    launchExpected.gameframeCoordinationRevision,
  );
  assert.equal(launchReceipt.narrativeRevision, launchExpected.narrativeRevision);
  assert.equal(
    launchReceipt.gameframeCoordinationRevision,
    runtimeReceipt.gameframeCoordinationRevision,
    "encounter launch advances narrative truth without inventing a GameFrame campaign event",
  );
  assert.deepEqual(ledger.acceptRuntimeCommit(launchRequest), launchReceipt);

  const conflictCase = record(
    fixture.conflictingRuntimeCommitReuseCase,
    "conflictingRuntimeCommitReuseCase",
  );
  const conflictingRequest = {
    ...launchRequest,
    ...record(conflictCase.requestOverrides, "requestOverrides"),
  } as RuntimeCommitRequest;
  assert.throws(
    () => ledger.acceptRuntimeCommit(conflictingRequest),
    (error: unknown) => {
      assert.ok(error instanceof RpgRevisionContractError);
      assert.equal(error.code, record(conflictCase.expected, "conflict expected").code);
      return true;
    },
  );
});

test("dual revision ledger rejects stale positions in the correct authority domain", () => {
  const ledger = new InMemoryRpgRevisionLedger({
    gameframeCoordinationRevision: 4,
    narrativeRevision: 7,
  });

  assert.throws(
    () =>
      ledger.acceptGameFrameCommand({
        commandId: "command:stale",
        expectedGameframeCoordinationRevision: 3,
        gameframeEventCount: 1,
      }),
    (error: unknown) =>
      error instanceof RpgRevisionContractError
      && error.code === "coordination-revision-conflict",
  );

  assert.throws(
    () =>
      ledger.acceptRuntimeCommit({
        kind: "runtime.events",
        runtimeCommitId: "runtime-commit:stale-narrative",
        expectedGameframeCoordinationRevision: 4,
        expectedNarrativeRevision: 6,
        gameframeEventCount: 1,
      }),
    (error: unknown) =>
      error instanceof RpgRevisionContractError
      && error.code === "narrative-revision-conflict",
  );
});
