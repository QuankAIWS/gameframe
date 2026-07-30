import assert from "node:assert/strict";
import test from "node:test";
import { MatchSession } from "../../platform/match-session.ts";
import {
  createTacticalMap,
  type TacticalCell,
  type TacticalCoordinate,
} from "../tactical-core/index.ts";
import {
  DeterministicTacticalCombatPlayer,
  TACTICAL_COMBAT_GAME_ID,
  activeTacticalCombatUnitId,
  createTacticalCombatBoard,
  createTacticalCombatState,
  isSameTacticalCombatAction,
  listTacticalAttackActions,
  tacticalCombatDefinition,
  tacticalCombatInitiativeOrder,
  tacticalCombatLineOfSight,
  tacticalCombatUnit,
  type TacticalCombatAction,
  type TacticalCombatState,
  type TacticalCombatUnit,
} from "./index.ts";

const floor: TacticalCell = { terrain: "floor", movementCost: 1, blocksMovement: false };
const wall: TacticalCell = { terrain: "wall", movementCost: 1, blocksMovement: true };

function combatUnit(input: Partial<TacticalCombatUnit> & {
  id: string;
  ownerId: string;
  position: TacticalCoordinate;
}): TacticalCombatUnit {
  return {
    role: "ranger",
    movement: 4,
    initiative: 10,
    maxHealth: 6,
    health: 6,
    attackRange: 6,
    attackDamage: 2,
    ...input,
  };
}

function combatState(input: {
  units: TacticalCombatUnit[];
  width?: number;
  height?: number;
  overrides?: Array<{ coordinate: TacticalCoordinate; cell: TacticalCell }>;
  activeUnitId?: string;
  movementUsed?: boolean;
  primaryActionUsed?: boolean;
  maxRounds?: number;
}): TacticalCombatState {
  const board = createTacticalCombatBoard(
    createTacticalMap({
      width: input.width ?? 8,
      height: input.height ?? 8,
      defaultCell: floor,
      overrides: input.overrides,
    }),
    input.units,
  );
  const order = tacticalCombatInitiativeOrder(input.units);
  const activeIndex = input.activeUnitId ? order.indexOf(input.activeUnitId) : 0;
  if (activeIndex < 0) throw new Error("Requested active unit is not in the initiative order.");
  return {
    board,
    playerIds: ["alpha", "beta"],
    activationOrder: order,
    activeActivationIndex: activeIndex,
    round: 1,
    movementUsed: input.movementUsed ?? false,
    primaryActionUsed: input.primaryActionUsed ?? false,
    defeatedUnitIds: [],
    winnerPlayerId: null,
    draw: false,
    maxRounds: input.maxRounds ?? 20,
    lastEffects: [],
  };
}

function legalAction<Action extends TacticalCombatAction["type"]>(
  state: TacticalCombatState,
  playerId: string,
  type: Action,
): Extract<TacticalCombatAction, { type: Action }> {
  const action = tacticalCombatDefinition.listLegalActions(state, playerId)
    .find((candidate) => candidate.type === type);
  assert.ok(action, `Expected a legal ${type} action.`);
  return action as Extract<TacticalCombatAction, { type: Action }>;
}

test("the production combat canary has stable initiative and four combatants", () => {
  const state = createTacticalCombatState(["alpha", "beta"]);
  assert.equal(tacticalCombatDefinition.gameId, TACTICAL_COMBAT_GAME_ID);
  assert.equal(state.board.map.width, 24);
  assert.equal(state.board.map.height, 24);
  assert.equal(state.board.units.length, 4);
  assert.deepEqual(state.activationOrder, [
    "alpha-vanguard",
    "beta-vanguard",
    "alpha-ranger",
    "beta-ranger",
  ]);
  assert.equal(activeTacticalCombatUnitId(state), "alpha-vanguard");
  assert.equal(tacticalCombatDefinition.getActivePlayerId(state), "alpha");
});

test("initiative sorts descending with stable unit-ID tie breaks", () => {
  const units = [
    combatUnit({ id: "zulu", ownerId: "alpha", position: { x: 0, y: 0 }, initiative: 7 }),
    combatUnit({ id: "alpha", ownerId: "beta", position: { x: 1, y: 0 }, initiative: 7 }),
    combatUnit({ id: "fast", ownerId: "alpha", position: { x: 2, y: 0 }, initiative: 12 }),
  ];
  assert.deepEqual(tacticalCombatInitiativeOrder(units), ["fast", "alpha", "zulu"]);
});

test("line of sight permits orthogonal and diagonal attacks but rejects off-axis targets", () => {
  const board = createTacticalCombatBoard(createTacticalMap({ width: 8, height: 8 }), [
    combatUnit({ id: "attacker", ownerId: "alpha", position: { x: 1, y: 1 } }),
    combatUnit({ id: "orthogonal", ownerId: "beta", position: { x: 1, y: 5 } }),
    combatUnit({ id: "diagonal", ownerId: "beta", position: { x: 4, y: 4 } }),
    combatUnit({ id: "off-axis", ownerId: "beta", position: { x: 5, y: 3 } }),
  ]);
  const orthogonal = tacticalCombatLineOfSight(board, { x: 1, y: 1 }, { x: 1, y: 5 }, {
    ignoreUnitIds: ["attacker", "orthogonal"],
  });
  assert.equal(orthogonal.aligned, true);
  assert.equal(orthogonal.clear, true);
  assert.equal(orthogonal.distance, 4);

  const diagonal = tacticalCombatLineOfSight(board, { x: 1, y: 1 }, { x: 4, y: 4 }, {
    ignoreUnitIds: ["attacker", "diagonal"],
  });
  assert.equal(diagonal.aligned, true);
  assert.equal(diagonal.clear, true);
  assert.equal(diagonal.distance, 3);

  const offAxis = tacticalCombatLineOfSight(board, { x: 1, y: 1 }, { x: 5, y: 3 });
  assert.equal(offAxis.aligned, false);
  assert.equal(offAxis.clear, false);
});

test("walls and intervening units block tactical line of sight", () => {
  const wallBoard = createTacticalCombatBoard(
    createTacticalMap({
      width: 7,
      height: 3,
      overrides: [{ coordinate: { x: 3, y: 1 }, cell: wall }],
    }),
    [
      combatUnit({ id: "attacker", ownerId: "alpha", position: { x: 1, y: 1 } }),
      combatUnit({ id: "target", ownerId: "beta", position: { x: 5, y: 1 } }),
    ],
  );
  const blockedByWall = tacticalCombatLineOfSight(wallBoard, { x: 1, y: 1 }, { x: 5, y: 1 }, {
    ignoreUnitIds: ["attacker", "target"],
  });
  assert.equal(blockedByWall.clear, false);
  assert.deepEqual(blockedByWall.blockedAt, { x: 3, y: 1 });
  assert.equal(listTacticalAttackActions(wallBoard, "attacker").length, 0);

  const unitBoard = createTacticalCombatBoard(createTacticalMap({ width: 7, height: 3 }), [
    combatUnit({ id: "attacker", ownerId: "alpha", position: { x: 1, y: 1 } }),
    combatUnit({ id: "blocker", ownerId: "alpha", position: { x: 3, y: 1 } }),
    combatUnit({ id: "target", ownerId: "beta", position: { x: 5, y: 1 } }),
  ]);
  const blockedByUnit = tacticalCombatLineOfSight(unitBoard, { x: 1, y: 1 }, { x: 5, y: 1 }, {
    ignoreUnitIds: ["attacker", "target"],
  });
  assert.equal(blockedByUnit.clear, false);
  assert.deepEqual(blockedByUnit.blockedAt, { x: 3, y: 1 });
});

test("attack actions enforce fixed range and damage from authoritative unit stats", () => {
  const board = createTacticalCombatBoard(createTacticalMap({ width: 9, height: 3 }), [
    combatUnit({
      id: "attacker",
      ownerId: "alpha",
      position: { x: 1, y: 1 },
      attackRange: 4,
      attackDamage: 3,
    }),
    combatUnit({ id: "near", ownerId: "beta", position: { x: 4, y: 1 } }),
    combatUnit({ id: "far", ownerId: "beta", position: { x: 7, y: 1 } }),
  ]);
  const actions = listTacticalAttackActions(board, "attacker");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].targetUnitId, "near");
  assert.equal(actions[0].range, 3);
  assert.equal(actions[0].damage, 3);
});

test("one activation allows one move and one primary attack in either order", () => {
  const base = combatState({
    units: [
      combatUnit({ id: "attacker", ownerId: "alpha", position: { x: 0, y: 0 }, attackRange: 4 }),
      combatUnit({ id: "target", ownerId: "beta", position: { x: 0, y: 3 }, initiative: 5 }),
    ],
    activeUnitId: "attacker",
  });

  const move = tacticalCombatDefinition.listLegalActions(base, "alpha")
    .find((action) => action.type === "move" && action.path.at(-1)?.x === 0 && action.path.at(-1)?.y === 1);
  assert.ok(move && move.type === "move");
  const moved = tacticalCombatDefinition.applyAction(base, "alpha", move).state;
  assert.equal(moved.movementUsed, true);
  assert.equal(moved.primaryActionUsed, false);
  assert.equal(tacticalCombatDefinition.listLegalActions(moved, "alpha").some((action) => action.type === "move"), false);
  const attackAfterMove = legalAction(moved, "alpha", "attack");
  const movedAndAttacked = tacticalCombatDefinition.applyAction(moved, "alpha", attackAfterMove).state;
  assert.equal(movedAndAttacked.primaryActionUsed, true);
  assert.deepEqual(
    tacticalCombatDefinition.listLegalActions(movedAndAttacked, "alpha").map((action) => action.type),
    ["end-activation"],
  );

  const attackFirst = legalAction(base, "alpha", "attack");
  const attacked = tacticalCombatDefinition.applyAction(base, "alpha", attackFirst).state;
  assert.equal(attacked.primaryActionUsed, true);
  assert.equal(attacked.movementUsed, false);
  assert.equal(tacticalCombatDefinition.listLegalActions(attacked, "alpha").some((action) => action.type === "move"), true);
  assert.equal(tacticalCombatDefinition.listLegalActions(attacked, "alpha").some((action) => action.type === "attack"), false);
});

test("fixed damage removes defeated units and completes team victory", () => {
  const state = combatState({
    units: [
      combatUnit({ id: "attacker", ownerId: "alpha", position: { x: 1, y: 1 }, attackDamage: 4 }),
      combatUnit({ id: "target", ownerId: "beta", position: { x: 1, y: 3 }, health: 3, maxHealth: 3, initiative: 5 }),
    ],
    activeUnitId: "attacker",
  });
  const attack = legalAction(state, "alpha", "attack");
  const result = tacticalCombatDefinition.applyAction(state, "alpha", attack);
  assert.equal(result.state.board.units.some((unit) => unit.id === "target"), false);
  assert.deepEqual(result.state.defeatedUnitIds, ["target"]);
  assert.equal(result.state.winnerPlayerId, "alpha");
  assert.equal(tacticalCombatDefinition.getStatus(result.state).lifecycle, "completed");
  assert.deepEqual(result.state.lastEffects.map((effect) => effect.type), [
    "unit-damaged",
    "unit-defeated",
    "combat-completed",
  ]);
});

test("ending activations advances initiative and increments the round on wrap", () => {
  let state = combatState({
    units: [
      combatUnit({ id: "alpha-unit", ownerId: "alpha", position: { x: 0, y: 0 }, initiative: 10 }),
      combatUnit({ id: "beta-unit", ownerId: "beta", position: { x: 7, y: 7 }, initiative: 9 }),
    ],
    activeUnitId: "alpha-unit",
  });
  state = tacticalCombatDefinition.applyAction(
    state,
    "alpha",
    legalAction(state, "alpha", "end-activation"),
  ).state;
  assert.equal(activeTacticalCombatUnitId(state), "beta-unit");
  assert.equal(state.round, 1);

  state = tacticalCombatDefinition.applyAction(
    state,
    "beta",
    legalAction(state, "beta", "end-activation"),
  ).state;
  assert.equal(activeTacticalCombatUnitId(state), "alpha-unit");
  assert.equal(state.round, 2);
  assert.equal(state.lastEffects.some((effect) => effect.type === "round-started"), true);
});

test("combat actions preserve strict structured equivalence", () => {
  const state = combatState({
    units: [
      combatUnit({ id: "attacker", ownerId: "alpha", position: { x: 1, y: 1 } }),
      combatUnit({ id: "target", ownerId: "beta", position: { x: 1, y: 3 }, initiative: 5 }),
    ],
    activeUnitId: "attacker",
  });
  const attack = legalAction(state, "alpha", "attack");
  assert.equal(isSameTacticalCombatAction(attack, {
    ...attack,
    from: { ...attack.from },
    target: { ...attack.target },
  }), true);
  assert.equal(isSameTacticalCombatAction(attack, { ...attack, damage: attack.damage + 1 }), false);
});

test("MatchSession records multi-action activations and restores combat snapshots", () => {
  const initial = combatState({
    units: [
      combatUnit({ id: "attacker", ownerId: "alpha", position: { x: 0, y: 0 }, attackRange: 4 }),
      combatUnit({ id: "target", ownerId: "beta", position: { x: 0, y: 3 }, initiative: 5 }),
    ],
    activeUnitId: "attacker",
  });
  const session = new MatchSession({
    matchId: "combat-replay",
    definition: tacticalCombatDefinition,
    playerIds: ["alpha", "beta"],
    snapshot: {
      matchId: "combat-replay",
      gameId: tacticalCombatDefinition.gameId,
      playerIds: ["alpha", "beta"],
      revision: 0,
      state: initial,
      events: [],
      processedActions: [],
    },
    now: () => new Date("2026-07-30T00:00:00.000Z"),
  });
  const move = session.observe("alpha").legalActions
    .find((action) => action.type === "move" && action.path.at(-1)?.x === 0 && action.path.at(-1)?.y === 1);
  assert.ok(move);
  assert.equal(session.submit({
    actionId: "combat-move-1",
    playerId: "alpha",
    expectedRevision: 0,
    action: move,
  }).accepted, true);
  const attack = session.observe("alpha").legalActions.find((action) => action.type === "attack");
  assert.ok(attack);
  assert.equal(session.submit({
    actionId: "combat-attack-1",
    playerId: "alpha",
    expectedRevision: 1,
    action: attack,
  }).accepted, true);
  const end = session.observe("alpha").legalActions.find((action) => action.type === "end-activation");
  assert.ok(end);
  assert.equal(session.submit({
    actionId: "combat-end-1",
    playerId: "alpha",
    expectedRevision: 2,
    action: end,
  }).accepted, true);
  assert.equal(session.revision, 3);
  assert.equal(session.snapshot().events.length, 3);
  assert.deepEqual(session.replay(), session.snapshot().state);

  const restored = new MatchSession({
    matchId: "combat-replay",
    definition: tacticalCombatDefinition,
    playerIds: ["alpha", "beta"],
    snapshot: session.snapshot(),
  });
  assert.deepEqual(restored.snapshot(), session.snapshot());
});

test("deterministic tactical combat self-play reaches victory or the round draw bound", async () => {
  const alpha = new DeterministicTacticalCombatPlayer("alpha");
  const beta = new DeterministicTacticalCombatPlayer("beta");
  let state = createTacticalCombatState(["alpha", "beta"]);
  for (let actionCount = 0; actionCount < 500 && tacticalCombatDefinition.getStatus(state).lifecycle === "active"; actionCount += 1) {
    const playerId = tacticalCombatDefinition.getActivePlayerId(state)!;
    const observation = tacticalCombatDefinition.getObservation(state, playerId);
    const action = await (playerId === "alpha" ? alpha : beta).chooseAction({
      observation,
      legalActions: observation.legalActions,
    });
    state = tacticalCombatDefinition.applyAction(state, playerId, action).state;
  }
  const status = tacticalCombatDefinition.getStatus(state);
  assert.equal(status.lifecycle, "completed");
  if (!status.draw) {
    assert.ok(status.winnerPlayerId === "alpha" || status.winnerPlayerId === "beta");
    assert.equal(state.board.units.every((unit) => unit.ownerId === status.winnerPlayerId), true);
  } else {
    assert.ok(state.round > state.maxRounds);
  }
});
