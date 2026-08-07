import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKERS_NO_PROGRESS_PLY_LIMIT,
  DeterministicCheckersPlayer,
  checkersDefinition,
  checkersPositionKey,
  createCheckersState,
  isPlayableSquare,
  type CheckersAction,
  type CheckersPiece,
  type CheckersState,
} from "./index.ts";

const players = ["black-player", "red-player"] as const;
const piece = (
  id: string,
  color: "black" | "red",
  square: number,
  rank: "man" | "king" = "man",
): CheckersPiece => ({ id, color, square, rank });
const state = (
  pieces: CheckersPiece[],
  activeColor: "black" | "red" = "black",
  extra: Partial<CheckersState> = {},
) => createCheckersState({
  playerIds: players,
  pieces,
  activeColor,
  noProgressPly: extra.noProgressPly,
  positionCounts: extra.positionCounts,
});

function findAction(actions: readonly CheckersAction[], pieceId: string, path: number[]): CheckersAction {
  const action = actions.find((candidate) =>
    candidate.pieceId === pieceId && candidate.path.join(",") === path.join(",")
  );
  assert.ok(action, `Expected ${pieceId} path ${path.join("-")}`);
  return action;
}

test("initial American Checkers position has twelve men per side and seven black moves", () => {
  const initial = checkersDefinition.createInitialState(players);
  assert.equal(initial.pieces.filter((candidate) => candidate.color === "black").length, 12);
  assert.equal(initial.pieces.filter((candidate) => candidate.color === "red").length, 12);
  assert.ok(initial.pieces.every((candidate) => candidate.rank === "man" && isPlayableSquare(candidate.square)));
  assert.equal(checkersDefinition.getActivePlayerId(initial), players[0]);
  assert.equal(checkersDefinition.listLegalActions(initial, players[0]).length, 7);
  assert.equal(checkersDefinition.listLegalActions(initial, players[1]).length, 0);
});

test("a capture anywhere on the board suppresses every quiet move", () => {
  const current = state([
    piece("black-capturer", "black", 17),
    piece("black-quiet", "black", 21),
    piece("red-target", "red", 26),
  ]);
  const actions = checkersDefinition.listLegalActions(current, players[0]);
  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0], {
    type: "move",
    pieceId: "black-capturer",
    from: 17,
    path: [35],
    capturedPieceIds: ["red-target"],
  });
});

test("men move and capture only forward", () => {
  const current = state([
    piece("black-man", "black", 26),
    piece("red-behind", "red", 17),
  ]);
  const actions = checkersDefinition.listLegalActions(current, players[0]);
  assert.ok(actions.every((action) => action.path[0] > action.from));
  assert.ok(actions.every((action) => action.capturedPieceIds.length === 0));
});

test("multi-jumps are enumerated as complete terminal paths", () => {
  const current = state([
    piece("black-man", "black", 17),
    piece("red-a", "red", 26),
    piece("red-b", "red", 44),
  ]);
  const actions = checkersDefinition.listLegalActions(current, players[0]);
  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0].path, [35, 53]);
  assert.deepEqual(actions[0].capturedPieceIds, ["red-a", "red-b"]);
  const next = checkersDefinition.applyAction(current, players[0], actions[0]).state;
  assert.equal(next.pieces.find((candidate) => candidate.id === "black-man")?.square, 53);
  assert.equal(next.pieces.length, 1);
  assert.equal(next.winnerColor, "black");
});

test("American Checkers allows any available capture sequence rather than requiring the longest", () => {
  const current = state([
    piece("black-short", "black", 17),
    piece("black-long", "black", 19),
    piece("red-short", "red", 26),
    piece("red-long-a", "red", 28),
    piece("red-long-b", "red", 46),
  ]);
  const actions = checkersDefinition.listLegalActions(current, players[0]);
  assert.ok(actions.some((action) => action.pieceId === "black-short" && action.capturedPieceIds.length === 1));
  assert.ok(actions.some((action) => action.pieceId === "black-long" && action.capturedPieceIds.length === 2));
});

test("promotion ends a capture sequence immediately", () => {
  const current = state([
    piece("black-man", "black", 42),
    piece("red-crown", "red", 51),
    piece("red-backward", "red", 53),
  ]);
  const action = checkersDefinition.listLegalActions(current, players[0])[0];
  assert.deepEqual(action.path, [60]);
  assert.deepEqual(action.capturedPieceIds, ["red-crown"]);
  const next = checkersDefinition.applyAction(current, players[0], action).state;
  const crowned = next.pieces.find((candidate) => candidate.id === "black-man");
  assert.equal(crowned?.rank, "king");
  assert.equal(crowned?.square, 60);
  assert.ok(next.pieces.some((candidate) => candidate.id === "red-backward"));
});

test("kings move and capture in both diagonal directions", () => {
  const quiet = state([piece("black-king", "black", 35, "king")]);
  const quietDestinations = checkersDefinition.listLegalActions(quiet, players[0])
    .map((action) => action.path[0])
    .sort((left, right) => left - right);
  assert.deepEqual(quietDestinations, [26, 28, 42, 44]);

  const capture = state([
    piece("black-king", "black", 35, "king"),
    piece("red-target", "red", 26),
  ]);
  assert.deepEqual(checkersDefinition.listLegalActions(capture, players[0])[0].path, [17]);
});

test("a player wins when the opponent is blocked", () => {
  const current = state([
    piece("black-man", "black", 49),
    piece("red-man", "red", 8),
    piece("black-block-a", "black", 1),
    piece("black-block-b", "black", 3),
  ]);
  const action = findAction(checkersDefinition.listLegalActions(current, players[0]), "black-man", [56]);
  const next = checkersDefinition.applyAction(current, players[0], action).state;
  assert.equal(next.winnerColor, "black");
  assert.equal(checkersDefinition.getStatus(next).winnerPlayerId, players[0]);
});

test("threefold position repetition is a draw", () => {
  let current = state([
    piece("black-king", "black", 17, "king"),
    piece("red-king", "red", 46, "king"),
  ]);
  const cycle: Array<[string, number[]]> = [
    ["black-king", [26]],
    ["red-king", [37]],
    ["black-king", [17]],
    ["red-king", [46]],
  ];
  for (let round = 0; round < 2; round += 1) {
    for (const [pieceId, path] of cycle) {
      const playerId = checkersDefinition.getActivePlayerId(current)!;
      const action = findAction(checkersDefinition.listLegalActions(current, playerId), pieceId, path);
      current = checkersDefinition.applyAction(current, playerId, action).state;
    }
  }
  assert.equal(current.draw, true);
  assert.equal(checkersDefinition.getStatus(current).draw, true);
});

test("eighty quiet plies trigger the deterministic no-progress draw", () => {
  const current = state([
    piece("black-king", "black", 17, "king"),
    piece("red-king", "red", 46, "king"),
  ], "black", { noProgressPly: CHECKERS_NO_PROGRESS_PLY_LIMIT - 1 });
  const action = findAction(checkersDefinition.listLegalActions(current, players[0]), "black-king", [26]);
  const next = checkersDefinition.applyAction(current, players[0], action).state;
  assert.equal(next.noProgressPly, CHECKERS_NO_PROGRESS_PLY_LIMIT);
  assert.equal(next.draw, true);
});

test("captures and promotions reset the no-progress clock", () => {
  const captureState = state([
    piece("black-man", "black", 17),
    piece("red-target", "red", 26),
    piece("red-survivor", "red", 62),
  ], "black", { noProgressPly: 79 });
  const capture = checkersDefinition.listLegalActions(captureState, players[0])[0];
  assert.equal(checkersDefinition.applyAction(captureState, players[0], capture).state.noProgressPly, 0);

  const promotionState = state([
    piece("black-man", "black", 49),
    piece("red-man", "red", 8),
  ], "black", { noProgressPly: 79 });
  const promotion = findAction(checkersDefinition.listLegalActions(promotionState, players[0]), "black-man", [56]);
  assert.equal(checkersDefinition.applyAction(promotionState, players[0], promotion).state.noProgressPly, 0);
});

test("cloneState isolates pieces and repetition counters", () => {
  const original = checkersDefinition.createInitialState(players);
  const clone = checkersDefinition.cloneState(original);
  clone.pieces[0].square = 63;
  clone.positionCounts[checkersPositionKey(clone)] = 99;
  assert.notEqual(original.pieces[0].square, clone.pieces[0].square);
  assert.notDeepEqual(original.positionCounts, clone.positionCounts);
});

test("the deterministic checkers player always returns a legal stable choice", async () => {
  const current = checkersDefinition.createInitialState(["gameframe-bot", "human"]);
  const observation = checkersDefinition.getObservation(current, "gameframe-bot");
  const agent = new DeterministicCheckersPlayer("gameframe-bot");
  const first = await agent.chooseAction({ observation, legalActions: observation.legalActions });
  const second = await agent.chooseAction({ observation, legalActions: observation.legalActions });
  assert.deepEqual(first, second);
  assert.ok(observation.legalActions.some((candidate) => checkersDefinition.isSameAction(candidate, first)));
});

test("deterministic self-play reaches a win or draw", async () => {
  const black = new DeterministicCheckersPlayer("black-player");
  const red = new DeterministicCheckersPlayer("red-player");
  let current = checkersDefinition.createInitialState(players);
  for (let ply = 0; ply < 400 && checkersDefinition.getStatus(current).lifecycle === "active"; ply += 1) {
    const playerId = checkersDefinition.getActivePlayerId(current)!;
    const observation = checkersDefinition.getObservation(current, playerId);
    const agent = playerId === players[0] ? black : red;
    const action = await agent.chooseAction({ observation, legalActions: observation.legalActions });
    current = checkersDefinition.applyAction(current, playerId, action).state;
  }
  assert.equal(checkersDefinition.getStatus(current).lifecycle, "completed");
});
