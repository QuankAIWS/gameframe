import assert from "node:assert/strict";
import test from "node:test";
import { MatchSession } from "../../platform/match-session.ts";
import {
  DeterministicTacticalMovementPlayer,
  TACTICAL_CANARY_MAP_HEIGHT,
  TACTICAL_CANARY_MAP_WIDTH,
  TACTICAL_CANARY_OBJECTIVE_ID,
  activeTacticalUnitId,
  applyTacticalMove,
  createTacticalBoardState,
  createTacticalCanaryMap,
  createTacticalMap,
  findTacticalPath,
  isSameTacticalMovementAction,
  listTacticalMoveActions,
  listTacticalReachableCells,
  tacticalCellAt,
  tacticalMovementDefinition,
  tacticalUnit,
  type TacticalCell,
  type TacticalCoordinate,
  type TacticalUnit,
} from "./index.ts";

const floor: TacticalCell = { terrain: "floor", movementCost: 1, blocksMovement: false };
const wall: TacticalCell = { terrain: "wall", movementCost: 1, blocksMovement: true };
const difficult = (movementCost = 2): TacticalCell => ({
  terrain: "difficult",
  movementCost,
  blocksMovement: false,
});
const unit = (
  id: string,
  ownerId: string,
  position: TacticalCoordinate,
  movement = 6,
): TacticalUnit => ({ id, ownerId, position, movement });

test("the tactical canary map is larger than its intended viewport and remains semantic", () => {
  const map = createTacticalCanaryMap();
  assert.equal(map.width, TACTICAL_CANARY_MAP_WIDTH);
  assert.equal(map.height, TACTICAL_CANARY_MAP_HEIGHT);
  assert.equal(map.cells.length, 24 * 24);
  const objectives = map.cells.filter((cell) => cell.objectiveId === TACTICAL_CANARY_OBJECTIVE_ID);
  assert.equal(objectives.length, 1);
  assert.equal(objectives[0].terrain, "objective");
  assert.ok(map.cells.some((cell) => cell.terrain === "wall"));
  assert.ok(map.cells.some((cell) => cell.terrain === "difficult"));
  assert.ok(map.cells.every((cell) => !Object.hasOwn(cell, "image")));
});

test("board validation rejects duplicate occupancy and blocked starting cells", () => {
  const map = createTacticalMap({
    width: 3,
    height: 3,
    overrides: [{ coordinate: { x: 1, y: 1 }, cell: wall }],
  });
  assert.throws(() => createTacticalBoardState(map, [
    unit("a", "alice", { x: 0, y: 0 }),
    unit("b", "bob", { x: 0, y: 0 }),
  ]), /cannot share a cell/);
  assert.throws(() => createTacticalBoardState(map, [
    unit("a", "alice", { x: 1, y: 1 }),
  ]), /blocked terrain/);
});

test("weighted pathfinding chooses a longer cheap route over difficult terrain", () => {
  const map = createTacticalMap({
    width: 4,
    height: 3,
    defaultCell: floor,
    overrides: [
      { coordinate: { x: 1, y: 1 }, cell: difficult(4) },
      { coordinate: { x: 2, y: 1 }, cell: difficult(4) },
    ],
  });
  const board = createTacticalBoardState(map, [unit("scout", "alice", { x: 0, y: 1 }, 10)]);
  const path = findTacticalPath(board, "scout", { x: 3, y: 1 }, 10);
  assert.ok(path);
  assert.equal(path.movementCost, 5);
  assert.deepEqual(path.path, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
  ]);
});

test("deterministic pathfinding routes around walls using a stable tie break", () => {
  const map = createTacticalMap({
    width: 5,
    height: 5,
    overrides: [1, 2, 3].map((y) => ({ coordinate: { x: 2, y }, cell: wall })),
  });
  const board = createTacticalBoardState(map, [unit("runner", "alice", { x: 0, y: 2 }, 10)]);
  const first = findTacticalPath(board, "runner", { x: 4, y: 2 }, 10);
  const second = findTacticalPath(board, "runner", { x: 4, y: 2 }, 10);
  assert.deepEqual(first, second);
  assert.equal(first?.movementCost, 8);
  assert.ok(first?.path.some((coordinate) => coordinate.x === 2 && coordinate.y === 0));
  assert.ok(first?.path.every((coordinate) => !tacticalCellAt(map, coordinate).blocksMovement));
});

test("occupied cells block movement without blocking the moving unit's origin", () => {
  const map = createTacticalMap({ width: 4, height: 3 });
  const board = createTacticalBoardState(map, [
    unit("runner", "alice", { x: 0, y: 1 }, 6),
    unit("blocker", "bob", { x: 1, y: 1 }, 6),
  ]);
  const path = findTacticalPath(board, "runner", { x: 2, y: 1 });
  assert.ok(path);
  assert.equal(path.movementCost, 4);
  assert.ok(path.path.every((coordinate) => !(coordinate.x === 1 && coordinate.y === 1)));
  assert.equal(findTacticalPath(board, "runner", { x: 1, y: 1 }), null);
});

test("reachable cells and move actions are deterministic and bounded by movement allowance", () => {
  const map = createTacticalMap({ width: 5, height: 5 });
  const board = createTacticalBoardState(map, [unit("center", "alice", { x: 2, y: 2 }, 2)]);
  const first = listTacticalReachableCells(board, "center");
  const second = listTacticalReachableCells(board, "center");
  assert.deepEqual(first, second);
  assert.equal(first.length, 12);
  assert.ok(first.every((reachable) => reachable.movementCost <= 2));
  const actions = listTacticalMoveActions(board, "center");
  assert.equal(actions.length, first.length);
  assert.ok(actions.every((action) => action.from.x === 2 && action.from.y === 2));
});

test("applying a canonical move clones the board and preserves the submitted path", () => {
  const map = createTacticalMap({ width: 5, height: 5 });
  const board = createTacticalBoardState(map, [unit("runner", "alice", { x: 0, y: 0 }, 4)]);
  const action = listTacticalMoveActions(board, "runner")
    .find((candidate) => candidate.path.at(-1)?.x === 2 && candidate.path.at(-1)?.y === 1);
  assert.ok(action);
  const next = applyTacticalMove(board, action);
  assert.deepEqual(tacticalUnit(board, "runner").position, { x: 0, y: 0 });
  assert.deepEqual(tacticalUnit(next, "runner").position, { x: 2, y: 1 });
  assert.ok(isSameTacticalMovementAction(action, {
    ...action,
    from: { ...action.from },
    path: action.path.map((coordinate) => ({ ...coordinate })),
  }));
});

test("the movement canary records complete tactical paths through MatchSession replay", () => {
  const session = new MatchSession({
    matchId: "tactical-replay",
    definition: tacticalMovementDefinition,
    playerIds: ["alice", "bob"],
    now: () => new Date("2026-07-30T00:00:00.000Z"),
  });
  const action = session.observe("alice").legalActions[0];
  const result = session.submit({
    actionId: "tactical-move-1",
    playerId: "alice",
    expectedRevision: 0,
    action,
  });
  assert.equal(result.accepted, true);
  assert.equal(session.revision, 1);
  assert.equal(activeTacticalUnitId(session.snapshot().state), "unit-beta");
  assert.deepEqual(session.replay(), session.snapshot().state);
  assert.deepEqual(session.snapshot().events[0].action, action);

  const restored = new MatchSession({
    matchId: "tactical-replay",
    definition: tacticalMovementDefinition,
    playerIds: ["alice", "bob"],
    snapshot: session.snapshot(),
  });
  assert.deepEqual(restored.snapshot(), session.snapshot());
});

test("deterministic tactical self-play reaches the central objective", async () => {
  const alpha = new DeterministicTacticalMovementPlayer("alpha");
  const beta = new DeterministicTacticalMovementPlayer("beta");
  let state = tacticalMovementDefinition.createInitialState(["alpha", "beta"]);
  for (let activation = 0; activation < 40 && tacticalMovementDefinition.getStatus(state).lifecycle === "active"; activation += 1) {
    const playerId = tacticalMovementDefinition.getActivePlayerId(state)!;
    const observation = tacticalMovementDefinition.getObservation(state, playerId);
    const action = await (playerId === "alpha" ? alpha : beta).chooseAction({
      observation,
      legalActions: observation.legalActions,
    });
    state = tacticalMovementDefinition.applyAction(state, playerId, action).state;
  }
  const status = tacticalMovementDefinition.getStatus(state);
  assert.equal(status.lifecycle, "completed");
  assert.equal(status.draw, false);
  assert.ok(status.winnerPlayerId === "alpha" || status.winnerPlayerId === "beta");
  const winnerUnit = state.board.units.find((candidate) => candidate.ownerId === status.winnerPlayerId)!;
  assert.equal(tacticalCellAt(state.board.map, winnerUnit.position).objectiveId, TACTICAL_CANARY_OBJECTIVE_ID);
});
