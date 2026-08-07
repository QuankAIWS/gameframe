import assert from "node:assert/strict";
import test from "node:test";

import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import {
  InMemoryRpgEncounterMatchCoordinator,
  rpgEncounterMatchId,
  rpgEncounterTeamSeatId,
} from "./in-memory-rpg-encounter-match-coordinator.ts";

function launchRequest({ cooperative = false } = {}) {
  const participants = [
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
  ];
  if (cooperative) {
    participants.splice(1, 0, {
      participantId: "participant:player-two",
      controller: { kind: "player", playerId: "player:grace" },
      teamId: "team:party",
    });
  }
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
    participants,
    objectives: [{ objectiveId: "objective:protect", kind: "defeat-opposition" }],
    battlefield: { mapId: "academy-gate" },
  };
}

function activeView() {
  const teamSeatId = rpgEncounterTeamSeatId("encounter-one");
  return {
    gameId: "monster-master-duel",
    matchId: rpgEncounterMatchId("encounter-one"),
    playerIds: [teamSeatId, GAMEFRAME_BOT_PLAYER_ID],
    revision: 3,
    eventCount: 3,
    observation: {
      phase: "deployment",
      yourPlayerId: teamSeatId,
      playerIds: [teamSeatId, GAMEFRAME_BOT_PLAYER_ID],
      rosters: {
        [teamSeatId]: [
          { id: "alpha-master", ownerId: teamSeatId },
          { id: "alpha-bulwark", ownerId: teamSeatId },
          { id: "alpha-emberling", ownerId: teamSeatId },
        ],
        [GAMEFRAME_BOT_PLAYER_ID]: [
          { id: "beta-master", ownerId: GAMEFRAME_BOT_PLAYER_ID },
        ],
      },
      board: {
        units: [{ id: "alpha-master", ownerId: teamSeatId }],
      },
      activePlayerId: teamSeatId,
      commandByPlayer: {
        [teamSeatId]: 2,
        [GAMEFRAME_BOT_PLAYER_ID]: 2,
      },
      status: { lifecycle: "active", winnerPlayerId: null, draw: false },
      legalActions: [{ type: "deploy-unit", unitId: "alpha-bulwark" }],
      lastEffects: [{ type: "command-spent", playerId: teamSeatId, amount: 1 }],
    },
  };
}

function completedView(winnerPlayerId = rpgEncounterTeamSeatId("encounter-one")) {
  return {
    ...activeView(),
    revision: 18,
    eventCount: 18,
    observation: {
      ...activeView().observation,
      activePlayerId: null,
      status: { lifecycle: "completed", winnerPlayerId, draw: false },
      legalActions: [],
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
  viewCalls = [];
  submitCalls = [];

  async createMatch(gameId, playerIds, matchId) {
    if (this.created) {
      throw Object.assign(new Error("already exists"), { code: "match_exists" });
    }
    this.created = { gameId, playerIds: [...playerIds], matchId };
    return structuredClone(this.viewValue);
  }

  async view(matchId, playerId) {
    this.viewCalls.push({ matchId, playerId });
    assert.equal(matchId, rpgEncounterMatchId("encounter-one"));
    assert.equal(playerId, rpgEncounterTeamSeatId("encounter-one"));
    return structuredClone(this.viewValue);
  }

  async submitAction(input) {
    this.submitCalls.push(structuredClone(input));
    return {
      ...structuredClone(this.viewValue),
      revision: input.expectedRevision + 1,
      eventCount: this.viewValue.eventCount + 1,
    };
  }
}

test("binds cooperative RPG players to one synthetic team seat", async () => {
  const rpg = new FakeRpgService();
  const matches = new FakeMatchService();
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({ rpg, matches });

  const launched = await coordinator.launchEncounter(
    launchRequest({ cooperative: true }),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );
  assert.deepEqual(matches.created, {
    gameId: "monster-master-duel",
    playerIds: [rpgEncounterTeamSeatId("encounter-one"), GAMEFRAME_BOT_PLAYER_ID],
    matchId: "rpg:encounter-one",
  });
  assert.deepEqual(launched.play, {
    gameId: "monster-master-duel",
    matchId: "rpg:encounter-one",
    href: "/monster-master.html?match=rpg%3Aencounter-one&campaign=campaign-one",
    control: {
      mode: "shared-team",
      teamId: "team:party",
      playerIds: ["player:ada", "player:grace"],
    },
  });

  const retry = await coordinator.launchEncounter(
    launchRequest({ cooperative: true }),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );
  assert.equal(rpg.launchCalls, 2);
  assert.deepEqual(retry.play, launched.play);
});

test("aliases the shared tactical seat back to each authenticated teammate", async () => {
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({
    rpg: new FakeRpgService(),
    matches: new FakeMatchService(),
  });
  await coordinator.launchEncounter(
    launchRequest({ cooperative: true }),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );

  for (const [playerId, participantId] of [
    ["player:ada", "participant:player"],
    ["player:grace", "participant:player-two"],
  ]) {
    const encounter = await coordinator.getEncounterForPrincipal(
      "encounter-one",
      { kind: "player", playerId },
    );
    assert.equal(encounter.play.matchId, "rpg:encounter-one");

    const view = await coordinator.viewMatchForPrincipal("rpg:encounter-one", playerId);
    assert.deepEqual(view.playerIds, [playerId, GAMEFRAME_BOT_PLAYER_ID]);
    assert.equal(view.observation.yourPlayerId, playerId);
    assert.equal(view.observation.activePlayerId, playerId);
    assert.equal(view.observation.board.units[0].ownerId, playerId);
    assert.equal(view.observation.rosters[playerId][0].ownerId, playerId);
    assert.equal(view.observation.commandByPlayer[playerId], 2);
    assert.equal(view.observation.lastEffects[0].playerId, playerId);
    assert.deepEqual(view.rpgControl, {
      encounterId: "encounter-one",
      campaignId: "campaign-one",
      mode: "shared-team",
      teamId: "team:party",
      playerId,
      teamPlayerIds: ["player:ada", "player:grace"],
      controlledParticipantIds: [participantId],
      controlledUnitIds: ["alpha-master", "alpha-bulwark", "alpha-emberling"],
    });
  }
});

test("submits either teammate through the shared team seat and rejects outsiders", async () => {
  const matches = new FakeMatchService();
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({
    rpg: new FakeRpgService(),
    matches,
  });
  await coordinator.launchEncounter(
    launchRequest({ cooperative: true }),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );

  const view = await coordinator.submitMatchActionForPrincipal({
    matchId: "rpg:encounter-one",
    playerId: "player:grace",
    actionId: "action:grace:one",
    expectedRevision: 3,
    action: { type: "deploy-unit", unitId: "alpha-bulwark" },
  });
  assert.deepEqual(matches.submitCalls, [{
    matchId: "rpg:encounter-one",
    playerId: rpgEncounterTeamSeatId("encounter-one"),
    actionId: "action:grace:one",
    expectedRevision: 3,
    action: { type: "deploy-unit", unitId: "alpha-bulwark" },
  }]);
  assert.deepEqual(view.playerIds, ["player:grace", GAMEFRAME_BOT_PLAYER_ID]);
  assert.equal(view.revision, 4);

  for (const playerId of ["player:outsider", GAMEFRAME_BOT_PLAYER_ID]) {
    await assert.rejects(
      coordinator.viewMatchForPrincipal("rpg:encounter-one", playerId),
      (error) => error.code === "forbidden",
    );
    await assert.rejects(
      coordinator.submitMatchActionForPrincipal({
        matchId: "rpg:encounter-one",
        playerId,
        actionId: "action:forbidden",
        expectedRevision: 3,
        action: { type: "deploy-unit", unitId: "alpha-master" },
      }),
      (error) => error.code === "forbidden",
    );
  }
});

test("rejects player-controlled participants split across tactical teams", async () => {
  const rpg = new FakeRpgService();
  const matches = new FakeMatchService();
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({ rpg, matches });
  const request = launchRequest({ cooperative: true });
  request.participants.find(
    (participant) => participant.controller.playerId === "player:grace",
  ).teamId = "team:opposition";

  await assert.rejects(
    coordinator.launchEncounter(
      request,
      { kind: "runtime", serviceId: "rpg-gm-runtime" },
    ),
    (error) => error.code === "unsupported-encounter-roster",
  );
  assert.equal(rpg.launchCalls, 0);
  assert.equal(matches.created, null);
});

test("rejects more than one opposition team for the two-seat Monster Master engine", async () => {
  const rpg = new FakeRpgService();
  const matches = new FakeMatchService();
  const coordinator = new InMemoryRpgEncounterMatchCoordinator({ rpg, matches });
  const request = launchRequest();
  request.participants.push({
    participantId: "participant:third-team",
    controller: { kind: "runtime" },
    teamId: "team:third",
  });

  await assert.rejects(
    coordinator.launchEncounter(
      request,
      { kind: "runtime", serviceId: "rpg-gm-runtime" },
    ),
    (error) => error.code === "unsupported-encounter-roster",
  );
  assert.equal(rpg.launchCalls, 0);
  assert.equal(matches.created, null);
});

test("commits a complete team outcome with exact retry content", async () => {
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
    launchRequest({ cooperative: true }),
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );

  await coordinator.synchronizeMatch(completedView("player:grace"));
  await coordinator.synchronizeMatch(completedView("player:grace"));
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
      { participantId: "participant:player-two", status: "active" },
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
