import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-configured-terminal-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(): DurableCampaignBootstrap {
  return {
    campaignId: "campaign-terminal",
    title: "Configured terminal proof",
    status: "active",
    state: {
      gameframeCoordinationRevision: 0,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [
      {
        playerId: "player:ada",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
      },
    ],
    events: [],
    initializedAt: "2026-08-07T14:40:00.000Z",
  };
}

function launchRequest() {
  return {
    protocolVersion: 2,
    coordinationMutationId: "coordination:terminal",
    expectedGameframeCoordinationRevision: 0,
    runtimeCommit: {
      kind: "runtime.narrative_committed",
      runtimeCommitKind: "runtime.encounter_launch",
      runtimeCommitId: "runtime-commit:terminal",
      sourceGameframeCoordinationRevision: 0,
      previousNarrativeRevision: 0,
      narrativeRevision: 1,
    },
    encounterId: "encounter-terminal",
    campaignId: "campaign-terminal",
    rulesetId: "monster-master-rpg",
    idempotencyKey: "idempotency:terminal",
    difficulty: { profile: "normal" },
    participants: [
      {
        participantId: "trainer:ada",
        controller: { kind: "player", playerId: "player:ada" },
        teamId: "team:keepers",
        rulesState: { creatureIds: ["creature:emberling:ada"] },
      },
      {
        participantId: "trainer:rival",
        controller: { kind: "runtime" },
        teamId: "team:rivals",
        rulesState: { creatureIds: ["creature:bulwark:rival"] },
      },
    ],
    objectives: [
      {
        objectiveId: "objective:defeat-rival",
        kind: "defeat",
        rules: { targetTeamId: "team:rivals" },
      },
    ],
    battlefield: {
      theme: "monster-master-academy-gate",
      layoutHint: "compact-duel",
      environmentTags: ["rain", "academy"],
      assetIds: ["battlefield:academy-gate:v1"],
    },
  };
}

async function start(filePath: string) {
  const timestamps = Array.from(
    { length: 512 },
    (_, index) => `2026-08-07T14:${String(41 + Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
  );
  let timestamp = 0;
  const server = createDurableRpgHttpServer({
    filePath,
    bootstrapCampaigns: [bootstrap()],
    clock: () => timestamps[Math.min(timestamp++, timestamps.length - 1)]!,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function playerHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    "x-gameframe-player-id": "player:ada",
  };
}

function serviceHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    "x-gameframe-service-id": "rpg-gm-runtime",
  };
}

function post(value: unknown, headers: HeadersInit): RequestInit {
  return { method: "POST", headers, body: JSON.stringify(value) };
}

async function close(server: ReturnType<typeof createDurableRpgHttpServer>): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}

async function json(response: Response): Promise<Record<string, any>> {
  return await response.json() as Record<string, any>;
}

function choosePlayerAction(view: Record<string, any>): Record<string, any> {
  const observation = view.observation;
  const actions = observation.legalActions as Array<Record<string, any>>;
  assert.ok(actions.length > 0, "active configured player must have a legal action");

  const attack = actions.find((action) => action.type === "attack");
  if (attack) return attack;

  if (observation.phase === "deployment") {
    const deployments = actions.filter((action) => action.type === "deploy-unit");
    assert.ok(deployments.length > 0, "configured creature must have a deployment action");
    return deployments.sort((left, right) => (
      right.position.x - left.position.x
      || left.position.y - right.position.y
    ))[0]!;
  }

  const active = observation.board.units.find(
    (unit: Record<string, any>) => unit.id === observation.activeUnitId,
  );
  const enemy = observation.board.units.find(
    (unit: Record<string, any>) => unit.ownerId !== observation.yourPlayerId,
  );
  const moves = actions.filter((action) => action.type === "move");
  if (active && enemy && moves.length > 0) {
    return moves.sort((left, right) => (
      distance(left.path.at(-1), enemy.position) - distance(right.path.at(-1), enemy.position)
      || right.movementCost - left.movementCost
    ))[0]!;
  }

  const end = actions.find((action) => action.type === "end-activation");
  assert.ok(end, "configured player must be able to end a bounded activation");
  return end;
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function expectedParticipantResult(
  view: Record<string, any>,
  participantId: string,
  unitIds: readonly string[],
) {
  const defeated = new Set(view.observation.defeatedUnitIds as string[]);
  let healthRemaining = 0;
  let livingCount = 0;
  for (const unitId of unitIds) {
    const unit = view.observation.board.units.find((candidate: Record<string, any>) => candidate.id === unitId);
    if (unit) {
      healthRemaining += Math.max(0, Number(unit.health));
      if (unit.health > 0) livingCount += 1;
    } else {
      assert.equal(defeated.has(unitId), true, `missing mapped unit ${unitId} must be defeated`);
    }
  }
  const status = livingCount > 0 ? "active" : "defeated";
  return {
    participantId,
    status,
    healthRemaining,
    conditions: status === "defeated" ? ["defeated"] : [],
    resourceChanges: {},
  };
}

test("configured RPG battle returns participant aftermath from exact mapped creature state", async () => {
  const filePath = databasePath();
  const runtime = await start(filePath);
  try {
    const launch = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters`,
      post(launchRequest(), serviceHeaders()),
    );
    assert.equal(launch.status, 200);
    const handle = await json(launch);
    assert.deepEqual(handle.play.control.participantUnitIds, {
      "trainer:ada": ["creature:emberling:ada"],
      "trainer:rival": ["creature:bulwark:rival"],
    });

    const matchPath = `/api/matches/${encodeURIComponent("rpg:encounter-terminal")}`;
    let view = await json(await fetch(`${runtime.baseUrl}${matchPath}`, { headers: playerHeaders() }));
    for (let actionIndex = 0; actionIndex < 160 && view.observation.status.lifecycle === "active"; actionIndex += 1) {
      assert.equal(
        view.observation.activePlayerId,
        "player:ada",
        "BattleBot actions should be drained before the player projection returns",
      );
      const action = choosePlayerAction(view);
      const response = await fetch(
        `${runtime.baseUrl}${matchPath}/actions`,
        post({
          actionId: `action:terminal:${actionIndex}`,
          expectedRevision: view.revision,
          action,
        }, playerHeaders()),
      );
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      view = await json(response);
    }
    assert.equal(view.observation.status.lifecycle, "completed", "configured battle must reach a terminal state");

    const encounterResponse = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters/encounter-terminal`,
      { headers: serviceHeaders() },
    );
    assert.equal(encounterResponse.status, 200);
    const encounter = await json(encounterResponse);
    assert.equal(encounter.state, "completed");
    const outcome = encounter.terminalOutcome;
    assert.equal(outcome.kind, "encounter.terminal_outcome");
    assert.deepEqual(outcome.participantResults, [
      expectedParticipantResult(view, "trainer:ada", ["creature:emberling:ada"]),
      expectedParticipantResult(view, "trainer:rival", ["creature:bulwark:rival"]),
    ]);
    assert.deepEqual(outcome.objectiveResults, [{
      objectiveId: "objective:defeat-rival",
      status: outcome.result === "victory" ? "completed" : outcome.result === "defeat" ? "failed" : "partial",
    }]);
    assert.equal(outcome.commit.matchId, "rpg:encounter-terminal");
    assert.equal(outcome.commit.matchRevision, view.revision);
  } finally {
    await close(runtime.server);
  }
});
