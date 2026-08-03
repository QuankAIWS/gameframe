import assert from "node:assert/strict";
import test from "node:test";
import { MatchSession } from "../../platform/match-session.ts";
import {
  DeterministicMonsterMasterPlayer,
  MONSTER_MASTER_MAX_COMMAND,
  MONSTER_MASTER_MAX_ROUNDS,
  activeMonsterMasterUnitId,
  cloneMonsterMasterState,
  createMonsterMasterState,
  isMonsterMasterDeploymentCoordinate,
  monsterMasterDefinition,
  monsterMasterUnit,
  type MonsterMasterAction,
  type MonsterMasterState,
} from "./index.ts";

function firstAction<Type extends MonsterMasterAction["type"]>(
  state: MonsterMasterState,
  playerId: string,
  type: Type,
): Extract<MonsterMasterAction, { type: Type }> {
  const action = monsterMasterDefinition.listLegalActions(state, playerId)
    .find((candidate) => candidate.type === type);
  assert.ok(action, `Expected a legal ${type} action.`);
  return action as Extract<MonsterMasterAction, { type: Type }>;
}

function apply(state: MonsterMasterState, playerId: string, action: MonsterMasterAction): MonsterMasterState {
  return monsterMasterDefinition.applyAction(state, playerId, action).state;
}

function deployAll(): MonsterMasterState {
  let state = createMonsterMasterState(["alpha", "beta"]);
  for (let deployment = 0; deployment < 6; deployment += 1) {
    const playerId = monsterMasterDefinition.getActivePlayerId(state);
    assert.ok(playerId);
    const actions = monsterMasterDefinition.listLegalActions(state, playerId)
      .filter((action) => action.type === "deploy-unit");
    assert.ok(actions.length > 0);
    const roleOrder = ["master", "bulwark", "emberling"];
    const action = [...actions].sort((left, right) => {
      if (left.type !== "deploy-unit" || right.type !== "deploy-unit") return 0;
      const leftUnit = monsterMasterUnit(state, left.unitId);
      const rightUnit = monsterMasterUnit(state, right.unitId);
      const roleDifference = roleOrder.indexOf(leftUnit.role) - roleOrder.indexOf(rightUnit.role);
      if (roleDifference) return roleDifference;
      return playerId === "alpha"
        ? right.position.x - left.position.x || left.position.y - right.position.y
        : left.position.x - right.position.x || right.position.y - left.position.y;
    })[0];
    state = apply(state, playerId, action);
  }
  return state;
}

function combatScenario(): MonsterMasterState {
  const state = cloneMonsterMasterState(deployAll());
  const positions = {
    "alpha-master": { x: 8, y: 8 },
    "alpha-bulwark": { x: 8, y: 9 },
    "alpha-emberling": { x: 7, y: 8 },
    "beta-master": { x: 11, y: 8 },
    "beta-bulwark": { x: 11, y: 9 },
    "beta-emberling": { x: 12, y: 8 },
  };
  for (const unit of state.board.units) unit.position = { ...positions[unit.id as keyof typeof positions] };
  state.activationOrder = [
    "alpha-emberling",
    "beta-emberling",
    "alpha-master",
    "beta-master",
    "alpha-bulwark",
    "beta-bulwark",
  ];
  state.activeActivationIndex = 2;
  state.round = 2;
  state.movementUsed = false;
  state.primaryActionUsed = false;
  state.lastEffects = [];
  return state;
}

test("Monster Master begins with alternating deployment and stable content rosters", () => {
  const state = createMonsterMasterState(["alpha", "beta"]);
  assert.equal(state.phase, "deployment");
  assert.equal(state.undeployedUnitIds.length, 6);
  assert.equal(monsterMasterDefinition.getActivePlayerId(state), "alpha");
  assert.deepEqual(state.rosters.alpha.map((unit) => unit.role), ["master", "bulwark", "emberling"]);
  assert.deepEqual(state.rosters.beta.map((unit) => unit.role), ["master", "bulwark", "emberling"]);
  assert.equal(new Set([...state.rosters.alpha, ...state.rosters.beta].map((unit) => unit.contentId)).size, 3);

  const alphaActions = monsterMasterDefinition.listLegalActions(state, "alpha");
  const betaActions = monsterMasterDefinition.listLegalActions(state, "beta");
  assert.ok(alphaActions.length > 100);
  assert.equal(betaActions.length, 0);
  assert.ok(alphaActions.every((action) => (
    action.type === "deploy-unit"
    && isMonsterMasterDeploymentCoordinate(state.board.map, 0, action.position)
  )));
});

test("deployment alternates seats and enters initiative combat after all six units", () => {
  let state = createMonsterMasterState(["alpha", "beta"]);
  const first = firstAction(state, "alpha", "deploy-unit");
  state = apply(state, "alpha", first);
  assert.equal(state.board.units.length, 1);
  assert.equal(monsterMasterDefinition.getActivePlayerId(state), "beta");
  assert.equal(state.lastEffects[0]?.type, "unit-deployed");

  for (let deployment = 1; deployment < 6; deployment += 1) {
    const playerId = monsterMasterDefinition.getActivePlayerId(state);
    assert.ok(playerId);
    state = apply(state, playerId, firstAction(state, playerId, "deploy-unit"));
  }

  assert.equal(state.phase, "combat");
  assert.equal(state.undeployedUnitIds.length, 0);
  assert.equal(state.board.units.length, 6);
  assert.equal(state.round, 1);
  assert.equal(state.activationOrder.length, 6);
  assert.equal(activeMonsterMasterUnitId(state), "alpha-emberling");
  assert.ok(state.lastEffects.some((effect) => effect.type === "combat-started"));
});

test("Master Mend spends command and heals a damaged friendly unit", () => {
  let state = combatScenario();
  const bulwark = monsterMasterUnit(state, "alpha-bulwark");
  bulwark.health = 6;
  state.commandByPlayer.alpha = 2;

  const mend = monsterMasterDefinition.listLegalActions(state, "alpha")
    .find((action) => action.type === "use-ability" && action.targetUnitId === "alpha-bulwark");
  assert.ok(mend && mend.type === "use-ability");
  assert.equal(mend.abilityId, "mend");
  assert.equal(mend.healing, 3);

  state = apply(state, "alpha", mend);
  assert.equal(monsterMasterUnit(state, "alpha-bulwark").health, 9);
  assert.equal(state.commandByPlayer.alpha, 1);
  assert.equal(state.primaryActionUsed, true);
  assert.deepEqual(state.lastEffects.map((effect) => effect.type), ["command-spent", "unit-healed"]);
  assert.equal(monsterMasterDefinition.listLegalActions(state, "alpha").some((action) => action.type === "use-ability"), false);
});

test("Mend is unavailable at full health, without command, outside range, or without line of sight", () => {
  let state = combatScenario();
  assert.equal(monsterMasterDefinition.listLegalActions(state, "alpha").some((action) => action.type === "use-ability"), false);

  monsterMasterUnit(state, "alpha-bulwark").health = 5;
  state.commandByPlayer.alpha = 0;
  assert.equal(monsterMasterDefinition.listLegalActions(state, "alpha").some((action) => action.type === "use-ability"), false);

  state.commandByPlayer.alpha = 2;
  monsterMasterUnit(state, "alpha-bulwark").position = { x: 8, y: 14 };
  assert.equal(monsterMasterDefinition.listLegalActions(state, "alpha").some((action) => action.type === "use-ability"), false);

  monsterMasterUnit(state, "alpha-bulwark").position = { x: 8, y: 10 };
  monsterMasterUnit(state, "alpha-emberling").position = { x: 8, y: 9 };
  assert.equal(monsterMasterDefinition.listLegalActions(state, "alpha").some((action) => action.type === "use-ability"), false);
});

test("defeating the opposing Master does not end the duel while another enemy survives", () => {
  let state = combatScenario();
  const target = monsterMasterUnit(state, "beta-master");
  target.health = 3;
  const attack = monsterMasterDefinition.listLegalActions(state, "alpha")
    .find((action) => action.type === "attack" && action.targetUnitId === "beta-master");
  assert.ok(attack && attack.type === "attack");

  state = apply(state, "alpha", attack);
  assert.equal(state.winnerPlayerId, null);
  assert.equal(monsterMasterDefinition.getStatus(state).lifecycle, "active");
  assert.equal(state.board.units.some((unit) => unit.id === "beta-master"), false);
  assert.ok(state.board.units.some((unit) => unit.ownerId === "beta"));
  assert.deepEqual(state.lastEffects.map((effect) => effect.type), [
    "unit-damaged",
    "unit-defeated",
  ]);
});

test("defeating the final opposing unit wins the duel", () => {
  let state = combatScenario();
  state.board.units = state.board.units.filter((unit) => unit.ownerId === "alpha" || unit.id === "beta-master");
  state.defeatedUnitIds = ["beta-bulwark", "beta-emberling"];
  const target = monsterMasterUnit(state, "beta-master");
  target.health = 3;
  const attack = monsterMasterDefinition.listLegalActions(state, "alpha")
    .find((action) => action.type === "attack" && action.targetUnitId === "beta-master");
  assert.ok(attack && attack.type === "attack");

  state = apply(state, "alpha", attack);
  assert.equal(state.winnerPlayerId, "alpha");
  assert.equal(monsterMasterDefinition.getStatus(state).lifecycle, "completed");
  assert.equal(state.board.units.some((unit) => unit.ownerId === "beta"), false);
  assert.deepEqual(state.lastEffects.map((effect) => effect.type), [
    "unit-damaged",
    "unit-defeated",
    "duel-completed",
  ]);
});

test("command energy restores at a new round up to its cap", () => {
  const state = combatScenario();
  state.activationOrder = ["alpha-master", "beta-master"];
  state.activeActivationIndex = 1;
  state.commandByPlayer.alpha = 0;
  state.commandByPlayer.beta = MONSTER_MASTER_MAX_COMMAND;
  const end = firstAction(state, "beta", "end-activation");
  const next = apply(state, "beta", end);

  assert.equal(next.round, 3);
  assert.equal(next.commandByPlayer.alpha, 1);
  assert.equal(next.commandByPlayer.beta, MONSTER_MASTER_MAX_COMMAND);
  assert.ok(next.lastEffects.some((effect) => effect.type === "round-started"));
  assert.equal(next.lastEffects.filter((effect) => effect.type === "command-restored").length, 1);
});

test("bounded draw completes at the end of the configured final round", () => {
  const state = combatScenario();
  state.activationOrder = ["alpha-master", "beta-master"];
  state.activeActivationIndex = 1;
  state.round = MONSTER_MASTER_MAX_ROUNDS;
  state.maxRounds = MONSTER_MASTER_MAX_ROUNDS;
  const end = firstAction(state, "beta", "end-activation");
  const next = apply(state, "beta", end);

  assert.equal(next.round, MONSTER_MASTER_MAX_ROUNDS);
  assert.equal(next.draw, true);
  assert.equal(monsterMasterDefinition.getStatus(next).lifecycle, "completed");
  assert.equal(next.lastEffects.some((effect) => effect.type === "round-started"), false);
  assert.deepEqual(next.lastEffects.map((effect) => effect.type), ["activation-ended", "duel-completed"]);
});

test("movement and primary actions may be used in either order but only once", () => {
  let state = combatScenario();
  const attack = firstAction(state, "alpha", "attack");
  state = apply(state, "alpha", attack);
  assert.equal(state.primaryActionUsed, true);
  assert.equal(state.movementUsed, false);
  assert.ok(monsterMasterDefinition.listLegalActions(state, "alpha").some((action) => action.type === "move"));
  assert.equal(monsterMasterDefinition.listLegalActions(state, "alpha").some((action) => action.type === "attack"), false);

  const move = firstAction(state, "alpha", "move");
  state = apply(state, "alpha", move);
  assert.equal(monsterMasterDefinition.getActivePlayerId(state), "beta");
  assert.equal(activeMonsterMasterUnitId(state), "beta-master");
});

test("configured Monster Master encounters replay and restore from their actual initial state", () => {
  const scenario = combatScenario();
  scenario.board.units = scenario.board.units.filter((unit) => unit.ownerId === "alpha" || unit.id === "beta-master");
  scenario.defeatedUnitIds = ["beta-bulwark", "beta-emberling"];
  monsterMasterUnit(scenario, "beta-master").health = 3;
  const session = new MatchSession({
    matchId: "monster-master-scenario",
    definition: monsterMasterDefinition,
    playerIds: scenario.playerIds,
    snapshot: {
      matchId: "monster-master-scenario",
      gameId: monsterMasterDefinition.gameId,
      playerIds: scenario.playerIds,
      revision: 0,
      state: scenario,
      events: [],
      rejectedActions: [],
    },
  });
  const attack = session.observe("alpha").legalActions
    .find((action) => action.type === "attack" && action.targetUnitId === "beta-master");
  assert.ok(attack);
  const accepted = session.submit({
    actionId: "scenario-final-defeat",
    playerId: "alpha",
    expectedRevision: 0,
    action: attack,
  });
  assert.equal(accepted.accepted, true);
  assert.deepEqual(session.replay(), session.snapshot().state);

  const snapshot = session.snapshot();
  const restored = new MatchSession({
    matchId: snapshot.matchId,
    definition: monsterMasterDefinition,
    playerIds: snapshot.playerIds,
    snapshot,
  });
  assert.deepEqual(restored.snapshot(), snapshot);
  assert.equal(restored.observe("alpha").status.winnerPlayerId, "alpha");
});

test("deterministic Monster Master self-play completes within the action bound", async () => {
  let state = createMonsterMasterState(["alpha", "beta"]);
  const players = {
    alpha: new DeterministicMonsterMasterPlayer("alpha"),
    beta: new DeterministicMonsterMasterPlayer("beta"),
  };

  for (let actionCount = 0; actionCount < 600 && monsterMasterDefinition.getStatus(state).lifecycle === "active"; actionCount += 1) {
    const activePlayerId = monsterMasterDefinition.getActivePlayerId(state);
    assert.ok(activePlayerId === "alpha" || activePlayerId === "beta");
    const observation = monsterMasterDefinition.getObservation(state, activePlayerId);
    const legalActions = monsterMasterDefinition.listLegalActions(state, activePlayerId);
    const action = await players[activePlayerId].chooseAction({ observation, legalActions });
    assert.ok(legalActions.some((candidate) => monsterMasterDefinition.isSameAction(candidate, action)));
    state = apply(state, activePlayerId, action);
  }

  assert.equal(monsterMasterDefinition.getStatus(state).lifecycle, "completed");
  assert.ok(state.winnerPlayerId || state.draw);
  assert.ok(state.round <= state.maxRounds);
});
