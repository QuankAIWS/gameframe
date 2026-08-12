import assert from "node:assert/strict";
import test from "node:test";
import {
  createMonsterMasterArenaState,
  isMonsterMasterArenaState,
  MONSTER_MASTER_ARENA_MONSTER_SLOTS,
  monsterMasterArenaDefinition,
} from "./arena-definition.ts";
import {
  monsterMasterUnit,
  type MonsterMasterAction,
  type MonsterMasterState,
} from "./index.ts";

function apply(state: MonsterMasterState, playerId: string, action: MonsterMasterAction): MonsterMasterState {
  return monsterMasterArenaDefinition.applyAction(state, playerId, action).state;
}

function deployAll(): MonsterMasterState {
  let state = createMonsterMasterArenaState(["alpha", "beta"]);
  while (state.phase === "deployment") {
    const playerId = monsterMasterArenaDefinition.getActivePlayerId(state);
    assert.ok(playerId);
    const action = monsterMasterArenaDefinition.listLegalActions(state, playerId)
      .find((candidate) => candidate.type === "deploy-unit");
    assert.ok(action);
    state = apply(state, playerId, action);
  }
  return state;
}

test("Arena fields one embodied Master plus three monsters per player", () => {
  const state = createMonsterMasterArenaState(["alpha", "beta"]);
  assert.equal(isMonsterMasterArenaState(state), true);
  assert.equal(state.undeployedUnitIds.length, 8);

  for (const playerId of state.playerIds) {
    const roster = state.rosters[playerId];
    assert.equal(roster.filter((unit) => unit.role === "master").length, 1);
    assert.equal(roster.filter((unit) => unit.role !== "master").length, MONSTER_MASTER_ARENA_MONSTER_SLOTS);
    assert.equal(roster.filter((unit) => unit.role === "emberling").length, 2);
  }
});

test("Arena enters combat after all eight combatants deploy", () => {
  const state = deployAll();
  assert.equal(state.phase, "combat");
  assert.equal(state.board.units.length, 8);
  assert.equal(state.undeployedUnitIds.length, 0);
  assert.equal(state.activationOrder.length, 8);
});

test("defeating the opposing Master ends an Arena round while opposing monsters survive", () => {
  let state = deployAll();
  const alphaMaster = monsterMasterUnit(state, "alpha-master");
  const betaMaster = monsterMasterUnit(state, "beta-master");
  alphaMaster.position = { x: 8, y: 8 };
  betaMaster.position = { x: 11, y: 8 };
  betaMaster.health = alphaMaster.attackDamage;
  state.activationOrder = ["alpha-master", ...state.activationOrder.filter((unitId) => unitId !== "alpha-master")];
  state.activeActivationIndex = 0;
  state.movementUsed = false;
  state.primaryActionUsed = false;
  state.lastEffects = [];

  const survivingBetaMonsters = state.board.units.filter((unit) => (
    unit.ownerId === "beta" && unit.role !== "master"
  ));
  assert.equal(survivingBetaMonsters.length, MONSTER_MASTER_ARENA_MONSTER_SLOTS);

  const attack = monsterMasterArenaDefinition.listLegalActions(state, "alpha")
    .find((candidate) => candidate.type === "attack" && candidate.targetUnitId === "beta-master");
  assert.ok(attack);
  state = apply(state, "alpha", attack);

  assert.equal(state.winnerPlayerId, "alpha");
  assert.equal(monsterMasterArenaDefinition.getStatus(state).lifecycle, "completed");
  assert.equal(state.board.units.some((unit) => unit.id === "beta-master"), false);
  assert.equal(state.board.units.filter((unit) => unit.ownerId === "beta").length, MONSTER_MASTER_ARENA_MONSTER_SLOTS);
  assert.deepEqual(state.lastEffects.map((effect) => effect.type), [
    "unit-damaged",
    "unit-defeated",
    "duel-completed",
  ]);
});
