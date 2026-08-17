import assert from "node:assert/strict";
import test from "node:test";
import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import {
  createMonsterMasterState,
  type MonsterMasterAction,
  type MonsterMasterObservation,
  type MonsterMasterState,
} from "../games/monster-master/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import { MonsterMasterMatchService } from "./monster-master-match-service.ts";

function createService() {
  let id = 0;
  return new MonsterMasterMatchService({
    store: new InMemoryMatchSnapshotStore<MonsterMasterState, MonsterMasterAction>(),
    idGenerator: () => `monster-master-id-${++id}`,
  });
}

function actionOfType<Type extends MonsterMasterAction["type"]>(
  observation: MonsterMasterObservation,
  type: Type,
): Extract<MonsterMasterAction, { type: Type }> {
  const action = observation.legalActions.find((candidate) => candidate.type === type);
  assert.ok(action, `Expected a legal ${type} action.`);
  return action as Extract<MonsterMasterAction, { type: Type }>;
}

test("Monster Master service creates a public Arena deployment match", async () => {
  const service = createService();
  const created = await service.createMatch(["alpha", "beta"], "mm-human");

  assert.equal(created.matchId, "mm-human");
  assert.equal(created.revision, 0);
  assert.equal(created.observation.phase, "deployment");
  assert.equal(created.observation.board.units.length, 0);
  assert.equal(created.observation.undeployedUnitIds.length, 8);
  assert.equal(created.observation.rosters.alpha.length, 4);
  assert.equal(created.observation.rosters.beta.length, 4);
  assert.equal(created.observation.activePlayerId, "alpha");
  assert.ok(created.observation.legalActions.every((action) => action.type === "deploy-unit"));
});

test("explicitly configured Monster Master states retain the base roster instead of Arena reshaping", async () => {
  const service = createService();
  const configured = createMonsterMasterState(["alpha", "beta"]);
  const created = await service.createMatch(["alpha", "beta"], "mm-configured", configured);

  assert.equal(created.observation.undeployedUnitIds.length, 6);
  assert.deepEqual(created.observation.rosters.alpha.map((unit) => unit.role), ["master", "bulwark", "emberling"]);
  assert.deepEqual(created.observation.rosters.beta.map((unit) => unit.role), ["master", "bulwark", "emberling"]);

  const reloaded = await service.view(created.matchId, "alpha");
  assert.equal(reloaded.observation.undeployedUnitIds.length, 6);
});

test("Monster Master BattleBot deploys after each human deployment and Arena combat begins after eight actions", async () => {
  const service = createService();
  let view = await service.createMatch(
    ["human", GAMEFRAME_BOT_PLAYER_ID],
    "mm-bot-deployment",
  );

  for (let humanDeployment = 0; humanDeployment < 4; humanDeployment += 1) {
    const action = actionOfType(view.observation, "deploy-unit");
    view = await service.submitAction({
      matchId: view.matchId,
      playerId: "human",
      actionId: `human-deploy-${humanDeployment}`,
      expectedRevision: view.revision,
      action,
    });
    assert.equal(view.revision, (humanDeployment + 1) * 2);
  }

  assert.equal(view.observation.phase, "combat");
  assert.equal(view.observation.board.units.length, 8);
  assert.equal(view.observation.undeployedUnitIds.length, 0);
  assert.equal(view.observation.activePlayerId, "human");
  assert.equal(view.observation.activeUnitId, "alpha-stormcrest");
  assert.equal(view.eventCount, 8);
});

test("Monster Master BattleBot can own the opening deployment seat", async () => {
  const service = createService();
  const created = await service.createMatch(
    [GAMEFRAME_BOT_PLAYER_ID, "human"],
    "mm-bot-first",
  );

  assert.equal(created.revision, 1);
  assert.equal(created.eventCount, 1);
  assert.equal(created.observation.phase, "deployment");
  assert.equal(created.observation.board.units.length, 1);
  assert.equal(created.observation.activePlayerId, "human");
  assert.equal(created.observation.undeployedUnitIds.length, 7);
});

test("Monster Master Arena advances initiative ties through bounded BattleBot resolution", async () => {
  const service = createService();
  let view = await service.createMatch(
    ["human", GAMEFRAME_BOT_PLAYER_ID],
    "mm-bot-combat",
  );
  for (let deployment = 0; deployment < 4; deployment += 1) {
    view = await service.submitAction({
      matchId: view.matchId,
      playerId: "human",
      actionId: `combat-deploy-${deployment}`,
      expectedRevision: view.revision,
      action: actionOfType(view.observation, "deploy-unit"),
    });
  }
  assert.equal(view.revision, 8);
  assert.equal(view.observation.activeUnitId, "alpha-stormcrest");

  view = await service.submitAction({
    matchId: view.matchId,
    playerId: "human",
    actionId: "human-end-stormcrest",
    expectedRevision: view.revision,
    action: actionOfType(view.observation, "end-activation"),
  });

  assert.ok(view.revision > 9);
  assert.equal(view.observation.activePlayerId, "human");
  assert.equal(view.observation.activeUnitId, "alpha-gloamspore");

  const revisionBeforeGloamspore = view.revision;
  view = await service.submitAction({
    matchId: view.matchId,
    playerId: "human",
    actionId: "human-end-gloamspore",
    expectedRevision: view.revision,
    action: actionOfType(view.observation, "end-activation"),
  });

  assert.ok(view.revision > revisionBeforeGloamspore + 1);
  assert.equal(view.observation.activePlayerId, "human");
  assert.equal(view.observation.activeUnitId, "alpha-master");
  assert.deepEqual(await service.replay(view.matchId), (await service.snapshot(view.matchId)).state);
});

test("Monster Master service persists rejected action IDs", async () => {
  const service = createService();
  const created = await service.createMatch(["alpha", "beta"], "mm-rejection");
  const legal = actionOfType(created.observation, "deploy-unit");
  const illegal = { ...legal, position: { x: 12, y: 12 } };

  await assert.rejects(
    service.submitAction({
      matchId: created.matchId,
      playerId: "alpha",
      actionId: "illegal-center-deploy",
      expectedRevision: 0,
      action: illegal,
    }),
    (error: unknown) => (error as { code?: string }).code === "illegal_action",
  );

  const snapshot = await service.snapshot(created.matchId);
  assert.equal(snapshot.rejectedActions?.[0]?.actionId, "illegal-center-deploy");
});
