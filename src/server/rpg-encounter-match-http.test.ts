import assert from "node:assert/strict";
import test from "node:test";

import { createGameFrameServer } from "./http-server.ts";

function playerFetch(url: string, playerId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", playerId);
  return fetch(url, { ...init, headers });
}

function serviceFetch(url: string, serviceId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-service-id", serviceId);
  return fetch(url, { ...init, headers });
}

function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

const campaignId = "campaign-monster-master-reference";
const encounterId = "encounter:rpg-bound-checkpoint";
const encounter = {
  protocolVersion: 2,
  coordinationMutationId: "coordination:rpg-bound-checkpoint",
  expectedGameframeCoordinationRevision: 4,
  runtimeCommit: {
    kind: "runtime.narrative_committed",
    runtimeCommitKind: "runtime.encounter_launch",
    runtimeCommitId: "runtime-commit:rpg-bound-checkpoint",
    sourceCommandId: "command:rpg-bound-checkpoint",
    sourceGameframeCoordinationRevision: 4,
    previousNarrativeRevision: 0,
    narrativeRevision: 1,
  },
  encounterId,
  campaignId,
  rulesetId: "monster-master-rpg",
  idempotencyKey: "encounter:rpg-bound-checkpoint:v2",
  difficulty: {
    id: "normal",
    encounterPressure: "standard",
    enemyTacticalIntensity: "competent",
    defeatConsequences: "consequential",
    characterDeathRisk: "real",
    recoverySupport: "standard",
  },
  participants: [
    {
      participantId: "trainer:ada",
      controller: { kind: "player", playerId: "player:ada" },
      teamId: "team:party",
      displayName: "Ada",
      rulesState: { creatureIds: ["creature:emberling:ada"] },
    },
    {
      participantId: "trainer:counterfeit-warden",
      controller: { kind: "runtime" },
      teamId: "team:opposition",
      displayName: "Counterfeit Warden",
      rulesState: { creatureIds: ["creature:bulwark:warden"] },
    },
  ],
  objectives: [
    {
      objectiveId: "objective:protect-travelers",
      kind: "defeat",
      description: "Stop the counterfeit wardens and protect the travelers.",
      rules: { targetTeamId: "team:opposition" },
    },
  ],
  battlefield: {
    theme: "monster-master-crooked-checkpoint",
    environmentTags: ["road", "checkpoint", "rain"],
    layoutHint: "compact-duel",
    assetIds: ["battlefield:crooked-checkpoint:v1"],
  },
};

function activeView() {
  return {
    gameId: "monster-master-duel",
    matchId: `rpg:${encounterId}`,
    playerIds: ["player:ada", "theo"],
    revision: 1,
    eventCount: 1,
    observation: {
      status: { lifecycle: "active", winnerPlayerId: null, draw: false },
    },
  };
}

function completedView() {
  return {
    ...activeView(),
    revision: 12,
    eventCount: 12,
    observation: {
      status: { lifecycle: "completed", winnerPlayerId: "player:ada", draw: false },
    },
  };
}

class TerminalMatchService {
  created = null as null | {
    gameId: string;
    playerIds: string[];
    matchId: string;
  };

  async createMatch(gameId: string, playerIds: readonly string[], requestedMatchId?: string) {
    this.created = {
      gameId,
      playerIds: [...playerIds],
      matchId: String(requestedMatchId),
    };
    return activeView();
  }

  async view(matchId: string, playerId: string) {
    assert.equal(matchId, `rpg:${encounterId}`);
    assert.equal(playerId, "player:ada");
    return completedView();
  }

  async submitAction() {
    throw new Error("This test completes the match through its terminal view.");
  }
}

test("live protocol v2 binds, authorizes, completes, and resumes an RPG encounter", async (context) => {
  const previousCompatibility = process.env.GAMEFRAME_ENABLE_RPG_V1_COMPATIBILITY;
  delete process.env.GAMEFRAME_ENABLE_RPG_V1_COMPATIBILITY;
  context.after(() => {
    if (previousCompatibility === undefined) {
      delete process.env.GAMEFRAME_ENABLE_RPG_V1_COMPATIBILITY;
    } else {
      process.env.GAMEFRAME_ENABLE_RPG_V1_COMPATIBILITY = previousCompatibility;
    }
  });

  const matches = new TerminalMatchService();
  const server = createGameFrameServer(matches as never);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const launch = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    jsonBody(encounter),
  );
  assert.equal(launch.status, 200);
  const launched = await launch.json();
  assert.equal(launched.protocolVersion, 2);
  assert.equal(launched.state, "preparing");
  assert.equal(launched.gameframeCoordinationRevision, 5);
  assert.equal(launched.presentationSequence, 4);
  assert.equal(launched.linkedNarrativeRevision, 1);
  assert.deepEqual(launched.play, {
    gameId: "monster-master-duel",
    matchId: `rpg:${encounterId}`,
    href: `/monster-master.html?match=${encodeURIComponent(`rpg:${encounterId}`)}&campaign=${campaignId}`,
  });
  assert.deepEqual(matches.created, {
    gameId: "monster-master-duel",
    playerIds: ["player:ada", "theo"],
    matchId: `rpg:${encounterId}`,
  });

  const retry = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    jsonBody(encounter),
  );
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), launched);

  const participant = await playerFetch(
    `${base}/api/rpg/encounters/${encodeURIComponent(encounterId)}`,
    "player:ada",
  );
  assert.equal(participant.status, 200);
  assert.equal((await participant.json()).play.matchId, `rpg:${encounterId}`);

  for (const playerId of ["player:outsider", "theo"]) {
    const forbidden = await playerFetch(
      `${base}/api/rpg/encounters/${encodeURIComponent(encounterId)}`,
      playerId,
    );
    assert.equal(forbidden.status, 403);
  }

  const terminalMatch = await playerFetch(
    `${base}/api/matches/${encodeURIComponent(`rpg:${encounterId}`)}`,
    "player:ada",
  );
  assert.equal(terminalMatch.status, 200);
  assert.equal((await terminalMatch.json()).observation.status.lifecycle, "completed");

  const completed = await serviceFetch(
    `${base}/api/rpg/encounters/${encodeURIComponent(encounterId)}`,
    "rpg-gm-runtime",
  );
  assert.equal(completed.status, 200);
  const completedEncounter = await completed.json();
  assert.equal(completedEncounter.protocolVersion, 2);
  assert.equal(completedEncounter.state, "completed");
  assert.equal(completedEncounter.resumeToken, launched.resumeToken);
  assert.equal(completedEncounter.terminalOutcome.result, "victory");
  assert.equal(completedEncounter.terminalOutcome.winnerTeamId, "team:party");
  assert.deepEqual(completedEncounter.terminalOutcome.objectiveResults, [{
    objectiveId: "objective:protect-travelers",
    status: "completed",
  }]);
  assert.equal(launched.play.href.endsWith(`&campaign=${campaignId}`), true);
});
