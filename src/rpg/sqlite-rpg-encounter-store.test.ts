import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SqliteRpgCampaignStore } from "./sqlite-rpg-campaign-store.ts";
import {
  SqliteRpgEncounterError,
  SqliteRpgEncounterStore,
  type DurableEncounterLaunchRequest,
  type DurableTerminalOutcome,
} from "./sqlite-rpg-encounter-store.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-encounter-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function initialize(filePath: string): void {
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  campaigns.bootstrap({
    campaignId: "campaign-one",
    title: "Reference campaign",
    status: "active",
    state: {
      gameframeCoordinationRevision: 6,
      presentationSequence: 3,
      linkedNarrativeRevision: 0,
    },
    memberships: [
      {
        playerId: "player:ada",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
      },
      {
        playerId: "player:bryn",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
      },
      {
        playerId: "player:observer",
        role: "observer",
        joinedPresentationSequence: 0,
      },
    ],
    events: [1, 2, 3].map((index) => ({
      eventId: `event:${index}`,
      kind: "scene.presented",
      audience: { kind: "public" as const },
      payload: { index },
      createdAt: `2026-08-04T22:40:0${index}.000Z`,
    })),
    initializedAt: "2026-08-04T22:40:00.000Z",
  });
  campaigns.close();
}

function launch(
  overrides: Partial<DurableEncounterLaunchRequest> = {},
): DurableEncounterLaunchRequest {
  return {
    protocolVersion: 2,
    coordinationMutationId: "coordination:encounter-one",
    expectedGameframeCoordinationRevision: 6,
    runtimeCommit: {
      kind: "runtime.narrative_committed",
      runtimeCommitKind: "runtime.encounter_launch",
      runtimeCommitId: "runtime-commit:encounter-one",
      sourceCommandId: "command-one",
      sourceGameframeCoordinationRevision: 6,
      previousNarrativeRevision: 0,
      narrativeRevision: 1,
    },
    encounterId: "encounter-one",
    campaignId: "campaign-one",
    rulesetId: "monster-master-duel",
    idempotencyKey: "idempotency:encounter-one",
    difficulty: { profile: "normal" },
    participants: [
      {
        participantId: "participant:ada",
        controller: { kind: "player", playerId: "player:ada" },
        teamId: "team:keepers",
      },
      {
        participantId: "participant:bryn",
        controller: { kind: "player", playerId: "player:bryn" },
        teamId: "team:rivals",
      },
    ],
    objectives: [{ objectiveId: "objective:win", kind: "defeat-opposition" }],
    battlefield: { mapId: "academy-gate" },
    ...overrides,
  };
}

function outcome(
  overrides: Partial<DurableTerminalOutcome> = {},
): DurableTerminalOutcome {
  return {
    kind: "encounter.terminal_outcome",
    result: "victory",
    winnerTeamId: "team:keepers",
    objectiveResults: [{ objectiveId: "objective:win", status: "completed" }],
    participantResults: [
      {
        participantId: "participant:ada",
        status: "active",
        healthRemaining: 8,
        conditions: [],
        resourceChanges: { commandEnergy: -1 },
      },
      {
        participantId: "participant:bryn",
        status: "defeated",
        healthRemaining: 0,
        conditions: ["defeated"],
        resourceChanges: {},
      },
    ],
    rewards: [{ rewardId: "reward:crest", kind: "flag", quantity: 1 }],
    ruleset: { id: "monster-master-duel", revision: 1 },
    commit: {
      matchId: "match:encounter-one",
      matchRevision: 14,
      eventCount: 14,
      completedAt: "2026-08-04T22:50:00.000Z",
    },
    ...overrides,
  };
}

function state(filePath: string): Record<string, number> {
  const database = new DatabaseSync(filePath);
  try {
    const row = database.prepare(
      "SELECT gameframe_coordination_revision, presentation_sequence, linked_narrative_revision FROM rpg_campaign_coordination_v1 WHERE campaign_id = ?",
    ).get("campaign-one") as Record<string, number>;
    return { ...row };
  } finally {
    database.close();
  }
}

function encounterCount(filePath: string): number {
  const database = new DatabaseSync(filePath);
  try {
    const row = database.prepare(
      "SELECT COUNT(*) AS count FROM rpg_encounters_v1",
    ).get() as { count: number };
    return Number(row.count);
  } finally {
    database.close();
  }
}

function requireError(
  action: () => unknown,
  code: SqliteRpgEncounterError["code"],
): void {
  assert.throws(
    action,
    (error: unknown) => error instanceof SqliteRpgEncounterError && error.code === code,
  );
}

test("launches durably, advances coordination once, and preserves presentation position", () => {
  const filePath = databasePath();
  initialize(filePath);
  const store = new SqliteRpgEncounterStore({ filePath });
  const handle = store.launch(launch(), {
    serviceId: "rpg-gm-runtime",
    createdAt: "2026-08-04T22:45:00.000Z",
  });
  assert.deepEqual(handle, {
    protocolVersion: 2,
    encounterId: "encounter-one",
    campaignId: "campaign-one",
    state: "preparing",
    resumeToken: handle.resumeToken,
    coordinationMutationId: "coordination:encounter-one",
    runtimeCommitId: "runtime-commit:encounter-one",
    gameframeCoordinationRevision: 7,
    presentationSequence: 3,
    linkedNarrativeRevision: 1,
  });
  store.close();
  assert.deepEqual(state(filePath), {
    gameframe_coordination_revision: 7,
    presentation_sequence: 3,
    linked_narrative_revision: 1,
  });
});

test("returns exact launch after restart without another coordination advance", () => {
  const filePath = databasePath();
  initialize(filePath);
  let store = new SqliteRpgEncounterStore({ filePath });
  const first = store.launch(launch(), {
    serviceId: "rpg-gm-runtime",
    createdAt: "2026-08-04T22:45:00.000Z",
  });
  store.close();
  store = new SqliteRpgEncounterStore({ filePath });
  const retry = store.launch(launch(), {
    serviceId: "rpg-gm-runtime",
    createdAt: "2026-08-04T22:46:00.000Z",
  });
  assert.deepEqual(retry, first);
  store.close();
});

test("rejects observer participants and stale revision/narrative linkage without mutation", () => {
  const filePath = databasePath();
  initialize(filePath);
  const store = new SqliteRpgEncounterStore({ filePath });
  requireError(
    () => store.launch(
      launch({
        participants: [{
          participantId: "participant:observer",
          controller: { kind: "player", playerId: "player:observer" },
        }],
      }),
      { serviceId: "rpg-gm-runtime", createdAt: "2026-08-04T22:45:00.000Z" },
    ),
    "participant-not-authorized",
  );
  requireError(
    () => store.launch(
      launch({ expectedGameframeCoordinationRevision: 5 }),
      { serviceId: "rpg-gm-runtime", createdAt: "2026-08-04T22:45:00.000Z" },
    ),
    "coordination-revision-conflict",
  );
  requireError(
    () => store.launch(
      launch({
        runtimeCommit: {
          ...launch().runtimeCommit,
          previousNarrativeRevision: 1,
          narrativeRevision: 2,
        },
      }),
      { serviceId: "rpg-gm-runtime", createdAt: "2026-08-04T22:45:00.000Z" },
    ),
    "narrative-link-conflict",
  );
  store.close();
  assert.equal(encounterCount(filePath), 0);
});

test("completes terminal outcome durably and returns exact completion retry", () => {
  const filePath = databasePath();
  initialize(filePath);
  let store = new SqliteRpgEncounterStore({ filePath });
  store.launch(launch(), {
    serviceId: "rpg-gm-runtime",
    createdAt: "2026-08-04T22:45:00.000Z",
  });
  const request = {
    protocolVersion: 2 as const,
    completionId: "completion:encounter-one",
    encounterId: "encounter-one",
    outcome: outcome(),
  };
  const completed = store.complete("encounter-one", request, {
    serviceId: "gameframe-encounter-engine",
    completedAt: "2026-08-04T22:50:00.000Z",
  });
  assert.equal(completed.state, "completed");
  assert.equal(completed.terminalOutcome?.result, "victory");
  assert.equal(completed.gameframeCoordinationRevision, 7);
  store.close();
  store = new SqliteRpgEncounterStore({ filePath });
  const retry = store.complete("encounter-one", request, {
    serviceId: "gameframe-encounter-engine",
    completedAt: "2026-08-04T22:51:00.000Z",
  });
  assert.deepEqual(retry, completed);
  assert.deepEqual(store.get("encounter-one", { serviceId: "rpg-gm-runtime" }), completed);
  store.close();
});

test("rejects incomplete terminal coverage and conflicting completion reuse", () => {
  const filePath = databasePath();
  initialize(filePath);
  const store = new SqliteRpgEncounterStore({ filePath });
  store.launch(launch(), {
    serviceId: "rpg-gm-runtime",
    createdAt: "2026-08-04T22:45:00.000Z",
  });
  requireError(
    () => store.complete(
      "encounter-one",
      {
        protocolVersion: 2,
        completionId: "completion:bad",
        encounterId: "encounter-one",
        outcome: outcome({ participantResults: outcome().participantResults.slice(0, 1) }),
      },
      { serviceId: "gameframe-encounter-engine", completedAt: "2026-08-04T22:50:00.000Z" },
    ),
    "invalid-terminal-outcome",
  );
  store.complete(
    "encounter-one",
    {
      protocolVersion: 2,
      completionId: "completion:encounter-one",
      encounterId: "encounter-one",
      outcome: outcome(),
    },
    { serviceId: "gameframe-encounter-engine", completedAt: "2026-08-04T22:50:00.000Z" },
  );
  requireError(
    () => store.complete(
      "encounter-one",
      {
        protocolVersion: 2,
        completionId: "completion:encounter-one",
        encounterId: "encounter-one",
        outcome: outcome({ result: "defeat", winnerTeamId: "team:rivals" }),
      },
      { serviceId: "gameframe-encounter-engine", completedAt: "2026-08-04T22:51:00.000Z" },
    ),
    "completion-conflict",
  );
  store.close();
});

test("enforces service ownership for launch, retrieval, and completion", () => {
  const filePath = databasePath();
  initialize(filePath);
  const store = new SqliteRpgEncounterStore({ filePath });
  requireError(
    () => store.launch(launch(), {
      serviceId: "other-runtime",
      createdAt: "2026-08-04T22:45:00.000Z",
    }),
    "encounter-access-denied",
  );
  store.launch(launch(), {
    serviceId: "rpg-gm-runtime",
    createdAt: "2026-08-04T22:45:00.000Z",
  });
  requireError(
    () => store.get("encounter-one", { serviceId: "other-runtime" }),
    "encounter-access-denied",
  );
  requireError(
    () => store.complete(
      "encounter-one",
      {
        protocolVersion: 2,
        completionId: "completion:encounter-one",
        encounterId: "encounter-one",
        outcome: outcome(),
      },
      { serviceId: "rpg-gm-runtime", completedAt: "2026-08-04T22:50:00.000Z" },
    ),
    "encounter-access-denied",
  );
  store.close();
});

test("rolls back coordination and encounter custody on injected launch failure", () => {
  const filePath = databasePath();
  initialize(filePath);
  const store = new SqliteRpgEncounterStore({
    filePath,
    faultInjector(stage) {
      if (stage === "after-encounter-insert") throw new Error("injected crash");
    },
  });
  assert.throws(
    () => store.launch(launch(), {
      serviceId: "rpg-gm-runtime",
      createdAt: "2026-08-04T22:45:00.000Z",
    }),
    /injected crash/,
  );
  store.close();
  assert.deepEqual(state(filePath), {
    gameframe_coordination_revision: 6,
    presentation_sequence: 3,
    linked_narrative_revision: 0,
  });
  assert.equal(encounterCount(filePath), 0);
});
