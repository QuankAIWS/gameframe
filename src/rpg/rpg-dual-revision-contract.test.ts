import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  InMemoryGameFrameCoordinationLedger,
  RpgRevisionContractError,
  type GameFrameCommandRequest,
  type GameFrameCoordinationState,
  type GameFrameRuntimeLinkRequest,
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

function assertReceipt(actual: JsonRecord, expected: JsonRecord): void {
  for (const [key, value] of Object.entries(expected)) {
    if (key === "exactRetryReturnsSameReceipt") continue;
    assert.deepEqual(actual[key], value, `receipt field ${key}`);
  }
}

test("GameFrame coordinates commands and links runtime receipts without owning narrative truth", () => {
  const fixture = readFixture();
  assert.equal(fixture.fixtureVersion, 2);
  assert.equal(fixture.contract, "rpg-dual-revision-linkage");

  const startingState = record(fixture.startingState, "startingState");
  const ledger = new InMemoryGameFrameCoordinationLedger(
    record(startingState.gameframe, "startingState.gameframe") as GameFrameCoordinationState,
  );

  const playerCase = record(fixture.playerCommandCase, "playerCommandCase");
  const playerRequest = record(
    playerCase.request,
    "playerCommandCase.request",
  ) as GameFrameCommandRequest;
  const playerReceipt = ledger.acceptCommand(playerRequest);
  assertReceipt(playerReceipt, record(playerCase.expected, "playerCommandCase.expected"));
  assert.deepEqual(ledger.acceptCommand(playerRequest), playerReceipt);

  const presentationCase = record(
    fixture.runtimePresentationCommitCase,
    "runtimePresentationCommitCase",
  );
  const presentationLink = record(
    presentationCase.gameframeLink,
    "runtimePresentationCommitCase.gameframeLink",
  );
  const presentationRequest = record(
    presentationLink.request,
    "presentation link request",
  ) as GameFrameRuntimeLinkRequest;
  const presentationReceipt = ledger.acceptRuntimeLink(presentationRequest);
  assertReceipt(
    presentationReceipt,
    record(presentationLink.expected, "presentation link expected"),
  );
  assert.deepEqual(ledger.acceptRuntimeLink(presentationRequest), presentationReceipt);

  const launchCase = record(fixture.encounterLaunchCommitCase, "encounterLaunchCommitCase");
  const launchLink = record(launchCase.gameframeLink, "encounterLaunchCommitCase.gameframeLink");
  const launchRequest = record(
    launchLink.request,
    "encounter launch link request",
  ) as GameFrameRuntimeLinkRequest;
  const launchReceipt = ledger.acceptRuntimeLink(launchRequest);
  assertReceipt(launchReceipt, record(launchLink.expected, "launch link expected"));
  assert.equal(
    launchReceipt.presentationSequence,
    presentationReceipt.presentationSequence,
    "encounter launch is a coordination transaction without a presentation event",
  );
  assert.deepEqual(ledger.acceptRuntimeLink(launchRequest), launchReceipt);

  const conflictCase = record(
    fixture.conflictingCoordinationMutationReuseCase,
    "conflictingCoordinationMutationReuseCase",
  );
  const conflictingRequest = {
    ...launchRequest,
    ...record(conflictCase.requestOverrides, "coordination request overrides"),
  } as GameFrameRuntimeLinkRequest;
  assert.throws(
    () => ledger.acceptRuntimeLink(conflictingRequest),
    (error: unknown) => {
      assert.ok(error instanceof RpgRevisionContractError);
      assert.equal(error.code, record(conflictCase.expected, "conflict expected").code);
      return true;
    },
  );
});

test("GameFrame rejects stale coordination, stale source, and out-of-order narrative linkage separately", () => {
  const staleCommandLedger = new InMemoryGameFrameCoordinationLedger({
    gameframeCoordinationRevision: 4,
    presentationSequence: 8,
    linkedNarrativeRevision: 7,
  });
  assert.throws(
    () =>
      staleCommandLedger.acceptCommand({
        commandId: "command:stale",
        expectedGameframeCoordinationRevision: 3,
        presentationEventCount: 1,
      }),
    (error: unknown) =>
      error instanceof RpgRevisionContractError
      && error.code === "coordination-revision-conflict",
  );

  const staleSourceLedger = new InMemoryGameFrameCoordinationLedger({
    gameframeCoordinationRevision: 4,
    presentationSequence: 8,
    linkedNarrativeRevision: 7,
  });
  assert.throws(
    () =>
      staleSourceLedger.acceptRuntimeLink({
        coordinationMutationId: "coordination:stale-source",
        expectedGameframeCoordinationRevision: 4,
        presentationEventCount: 1,
        runtimeCommit: {
          kind: "runtime.narrative_committed",
          runtimeCommitKind: "runtime.events",
          runtimeCommitId: "runtime-commit:stale-source",
          sourceGameframeCoordinationRevision: 3,
          previousNarrativeRevision: 7,
          narrativeRevision: 8,
        },
      }),
    (error: unknown) =>
      error instanceof RpgRevisionContractError
      && error.code === "runtime-source-revision-conflict",
  );

  const staleNarrativeLedger = new InMemoryGameFrameCoordinationLedger({
    gameframeCoordinationRevision: 4,
    presentationSequence: 8,
    linkedNarrativeRevision: 7,
  });
  assert.throws(
    () =>
      staleNarrativeLedger.acceptRuntimeLink({
        coordinationMutationId: "coordination:stale-narrative",
        expectedGameframeCoordinationRevision: 4,
        presentationEventCount: 1,
        runtimeCommit: {
          kind: "runtime.narrative_committed",
          runtimeCommitKind: "runtime.events",
          runtimeCommitId: "runtime-commit:stale-narrative",
          sourceGameframeCoordinationRevision: 4,
          previousNarrativeRevision: 6,
          narrativeRevision: 7,
        },
      }),
    (error: unknown) =>
      error instanceof RpgRevisionContractError
      && error.code === "narrative-link-conflict",
  );
});

test("GameFrame cannot link one runtime commit through two coordination mutations", () => {
  const ledger = new InMemoryGameFrameCoordinationLedger({
    gameframeCoordinationRevision: 2,
    presentationSequence: 4,
    linkedNarrativeRevision: 1,
  });
  const runtimeCommit = {
    kind: "runtime.narrative_committed" as const,
    runtimeCommitKind: "runtime.events" as const,
    runtimeCommitId: "runtime-commit:single-link",
    sourceGameframeCoordinationRevision: 2,
    previousNarrativeRevision: 1,
    narrativeRevision: 2,
  };
  ledger.acceptRuntimeLink({
    coordinationMutationId: "coordination:first-link",
    expectedGameframeCoordinationRevision: 2,
    presentationEventCount: 1,
    runtimeCommit,
  });
  assert.throws(
    () =>
      ledger.acceptRuntimeLink({
        coordinationMutationId: "coordination:second-link",
        expectedGameframeCoordinationRevision: 3,
        presentationEventCount: 1,
        runtimeCommit: {
          ...runtimeCommit,
          sourceGameframeCoordinationRevision: 3,
        },
      }),
    (error: unknown) =>
      error instanceof RpgRevisionContractError
      && error.code === "runtime-link-conflict",
  );
});
