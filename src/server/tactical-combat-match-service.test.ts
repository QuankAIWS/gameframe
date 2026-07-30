import assert from "node:assert/strict";
import test from "node:test";
import type { TacticalCombatAction, TacticalCombatObservation, TacticalCombatState } from "../games/tactical-combat/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import { TacticalCombatMatchService } from "./tactical-combat-match-service.ts";

function createService() {
  let id = 0;
  return new TacticalCombatMatchService({
    store: new InMemoryMatchSnapshotStore<TacticalCombatState, TacticalCombatAction>(),
    idGenerator: () => `combat-id-${++id}`,
  });
}

function actionOfType<Type extends TacticalCombatAction["type"]>(
  observation: TacticalCombatObservation,
  type: Type,
): Extract<TacticalCombatAction, { type: Type }> {
  const action = observation.legalActions.find((candidate) => candidate.type === type);
  assert.ok(action, `Expected a legal ${type} action.`);
  return action as Extract<TacticalCombatAction, { type: Type }>;
}

test("combat service creates a four-unit authoritative human match", async () => {
  const service = createService();
  const created = await service.createMatch(["alpha", "beta"], "combat-human");

  assert.equal(created.matchId, "combat-human");
  assert.deepEqual(created.playerIds, ["alpha", "beta"]);
  assert.equal(created.revision, 0);
  assert.equal(created.observation.board.map.width, 24);
  assert.equal(created.observation.board.map.height, 24);
  assert.equal(created.observation.board.units.length, 4);
  assert.equal(created.observation.activePlayerId, "alpha");
  assert.equal(created.observation.activeUnitId, "alpha-vanguard");
  assert.ok(created.observation.legalActions.some((action) => action.type === "move"));
  assert.ok(created.observation.legalActions.some((action) => action.type === "end-activation"));
});

test("combat service runs a complete bounded Theo activation after a human ends", async () => {
  const service = createService();
  const created = await service.createMatch(["human", "theo"], "combat-theo-second");
  const ended = actionOfType(created.observation, "end-activation");

  const advanced = await service.submitAction({
    matchId: created.matchId,
    playerId: "human",
    actionId: "human-end-vanguard",
    expectedRevision: 0,
    action: ended,
  });

  assert.equal(advanced.revision, 3);
  assert.equal(advanced.eventCount, 3);
  assert.equal(advanced.observation.activePlayerId, "human");
  assert.equal(advanced.observation.activeUnitId, "alpha-ranger");
  assert.equal(advanced.observation.board.units.find((unit) => unit.id === "beta-vanguard")?.position.x, 14);
  assert.deepEqual(await service.replay(created.matchId), (await service.snapshot(created.matchId)).state);
});

test("combat service completes an opening Theo activation when Theo owns player one", async () => {
  const service = createService();
  const created = await service.createMatch(["theo", "human"], "combat-theo-first");

  assert.equal(created.revision, 2);
  assert.equal(created.eventCount, 2);
  assert.equal(created.observation.activePlayerId, "human");
  assert.equal(created.observation.activeUnitId, "beta-vanguard");
  assert.equal(created.observation.board.units.find((unit) => unit.id === "alpha-vanguard")?.position.x, 9);
});

test("combat service persists rejected action IDs and stale revisions", async () => {
  const service = createService();
  const created = await service.createMatch(["alpha", "beta"], "combat-rejection");
  const illegal = { type: "attack", unitId: "alpha-vanguard", targetUnitId: "beta-vanguard", from: { x: 3, y: 3 }, target: { x: 20, y: 20 }, range: 17, damage: 3 } as const;

  await assert.rejects(
    service.submitAction({
      matchId: created.matchId,
      playerId: "alpha",
      actionId: "illegal-long-range",
      expectedRevision: 0,
      action: illegal,
    }),
    (error: unknown) => (error as { code?: string }).code === "illegal_action",
  );

  const snapshot = await service.snapshot(created.matchId);
  assert.equal(snapshot.rejectedActions?.[0]?.actionId, "illegal-long-range");
  await assert.rejects(
    service.submitAction({
      matchId: created.matchId,
      playerId: "alpha",
      actionId: "illegal-long-range",
      expectedRevision: 0,
      action: illegal,
    }),
    (error: unknown) => (error as { code?: string }).code === "illegal_action",
  );
});
