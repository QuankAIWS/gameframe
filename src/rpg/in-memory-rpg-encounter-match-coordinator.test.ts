import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryRpgEncounterMatchCoordinator,
  rpgEncounterMatchId,
} from "./in-memory-rpg-encounter-match-coordinator.ts";

function launchRequest() {
  return {
    protocolVersion: 2,
    coordinationMutationId: "coordination:encounter-one",
    expectedGameframeCoordinationRevision: 4,
    runtimeCommit: {
      kind: "runtime.narrative_committed",
      runtimeCommitKind: "runtime.encounter_launch",
      runtimeCommitId: "runtime-commit:encounter-one",
      sourceCommandId: "command-one",
      sourceGameframeCoordinationRevision: 4,
      previousNarrativeRevision: 1,
      narrativeRevision: 2,
    },
    encounterId: "encounter-one",
    campaignId: "campaign-one",
    rulesetId: "monster-master-rpg",
    idempotencyKey: "idempotency:encounter-one",
    difficulty: { profile: "normal" },
    participants: [
      {
        participantId: "participant:player",
        controller: { kind: "player", playerId: "player:ada" },
        teamId: "team:party",
      },
      {
        participantId: "participant:warden",
        controller: { kind: "runtime" },
        teamId: "team:party",
      },
      {
        participantId: "participant:bandit",
        controller: { kind: "runtime" },
        teamId: "team:opposition",
      },
    ],
    objectives: [{ objectiveId: "objective:protect", kind: "defeat-opposition" }],
    battlefield: { mapId: "academy-gate" },
  };
}

function activeView() {
  return {
    gameId: "monster-master-duel",
    matchId: rpgEncounterMatchId("encounter-one"),
    playerIds: ["player:ada", "theo"],
    revision: 3,
    eventCount: 3,
    observation: {
      status: { lifecycle: "active", winnerPlayerId: null, draw: false },
    },
  };
}

function completedView() {
  return {
    ...activeView(),
    revision: 18,
    eventCount: 18,
    observation: {
      status: { lifecycle: "completed", winnerPlayerId: "player:ada", draw: false },
    },
  };
}

class FakeRpgService {
  handle = {
    protocolVersion: 2,
    encounterId: "encounter-one",
    campaignId: "campaign-one",
    state: "preparing",
    resumeToken: "resume:encounter-one",
  };
  launchCalls = 0;
  completion = null;
  completionCalls = [];

  async launchEncounter() {
    this.launchCalls += 1;
    return structuredClone(this.handle);
  }

  async completeEncounter(_encounterId, request, principal) {
    assert.deepEqual(principal, {
      kind: "runtime",
      serviceId: "gameframe-encounter-engine",
    });
    this.completion = structuredClone(request);
    this.completionCalls.push(structuredClone(request));
    this.handle = {
      ...this.handle,
      state: "completed",
      terminalOutcome: structuredClone(request.outcome),
    };
    return structuredClone(this.handle);
  }

  async getEncounter(_encounterId, principal) {
    assert.deepEqual(principal, {
      kind: "runtime",
      serviceId: "rpg-gm-runtime",
    });
    return structuredClone(this.handle);
  }
}

class FakeMatchService {
  created = null;
  viewValue = activeView();

  async createMatch(gameId, playerIds, matchId) {
    if (this.created) {
      throw Object.assign(new Error("already exists"), { code: "match_exists" });
    }
    this.created = { gameId, playerIds: [...playerIds], matchId };
    return structuredClone(this.viewValue);
  }

  async view(matchId, playerId) {
    assert.equal(matchId, rpgEncounterMatchId("encounter-one"));
    assert.equal(playerId, "player:ada");
    return structuredClone(this.viewValue);
  }
}

test("binds one RPG encounter to one recoverable Monster Master match", async () => {
  const rpg = new FakeRpgService();
  const matches = new FakeMatchService();
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({ rpg, matches });

  const launched = await coordinator.launchEncounter(
    launchRequest(),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );
  assert.deepEqual(matches.created, {
    gameId: "monster-master-duel",
    playerIds: ["player:ada", "theo"],
    matchId: "rpg:encounter-one",
  });
  assert.deepEqual(launched.play, {
    gameId: "monster-master-duel",
    matchId: "rpg:encounter-one",
    href: "/monster-master.html?match=rpg%3Aencounter-one&campaign=campaign-one",
  });

  const retry = await coordinator.launchEncounter(
    launchRequest(),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );
  assert.equal(rpg.launchCalls, 2);
  assert.deepEqual(retry.play, launched.play);
});

test("allows encounter participants to retrieve play metadata and rejects outsiders", async () => {
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({
    rpg: new FakeRpgService(),
    matches: new FakeMatchService(),
  });
  await coordinator.launchEncounter(
    launchRequest(),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );

  const player = await coordinator.getEncounterForPrincipal(
    "encounter-one",
    { kind: "player", playerId: "player:ada" },
  );
  assert.equal(player.play.matchId, "rpg:encounter-one");
  await assert.rejects(
    coordinator.getEncounterForPrincipal(
      "encounter-one",
      { kind: "player", playerId: "player:outsider" },
    ),
    (error) => error.code === "forbidden",
  );
});

test("commits a complete structured RPG outcome with exact retry content", async () => {
  const rpg = new FakeRpgService();
  const matches = new FakeMatchService();
  let clockCalls = 0;
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({
    rpg,
    matches,
    clock: () => {
      clockCalls += 1;
      return clockCalls === 1
        ? "2026-08-06T18:10:00.000Z"
        : "2026-08-06T18:11:00.000Z";
    },
  });
  await coordinator.launchEncounter(
    launchRequest(),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );

  await coordinator.synchronizeMatch(completedView());
  await coordinator.synchronizeMatch(completedView());
  assert.equal(clockCalls, 1);
  assert.equal(rpg.completionCalls.length, 2);
  assert.deepEqual(rpg.completionCalls[1], rpg.completionCalls[0]);
  assert.equal(rpg.completion.completionId, "completion:encounter-one");
  assert.equal(rpg.completion.outcome.result, "victory");
  assert.equal(rpg.completion.outcome.winnerTeamId, "team:party");
  assert.deepEqual(
    rpg.completion.outcome.objectiveResults,
    [{ objectiveId: "objective:protect", status: "completed" }],
  );
  assert.deepEqual(
    rpg.completion.outcome.participantResults.map(({ participantId, status }) => ({ participantId, status })),
    [
      { participantId: "participant:player", status: "active" },
      { participantId: "participant:warden", status: "active" },
      { participantId: "participant:bandit", status: "defeated" },
    ],
  );
  assert.deepEqual(rpg.completion.outcome.commit, {
    matchId: "rpg:encounter-one",
    matchRevision: 18,
    eventCount: 18,
    completedAt: "2026-08-06T18:10:00.000Z",
  });
});
