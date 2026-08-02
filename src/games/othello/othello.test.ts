import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOthelloMove,
  chooseDeterministicOthelloMove,
  createInitialOthelloState,
  flipsForMove,
  getLegalOthelloMoves,
  scoreOthelloBoard,
  type OthelloState,
} from "./othello.ts";

test("initial Othello position exposes the canonical four dark moves", () => {
  const state = createInitialOthelloState();
  assert.deepEqual(
    getLegalOthelloMoves(state).map(({ row, column }) => `${row},${column}`),
    ["2,3", "3,2", "4,5", "5,4"],
  );
  assert.deepEqual(scoreOthelloBoard(state.board), { dark: 2, light: 2 });
});

test("a legal move places one disc, flips the bracketed line, and advances the turn", () => {
  const next = applyOthelloMove(createInitialOthelloState(), { row: 2, column: 3 });
  assert.equal(next.board[2][3], "dark");
  assert.equal(next.board[3][3], "dark");
  assert.equal(next.currentPlayer, "light");
  assert.equal(next.moveNumber, 1);
  assert.deepEqual(scoreOthelloBoard(next.board), { dark: 4, light: 1 });
});

test("multi-direction captures are collected without duplicates", () => {
  const state = createInitialOthelloState();
  state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  state.board[3][1] = "dark";
  state.board[3][2] = "light";
  state.board[1][3] = "dark";
  state.board[2][3] = "light";
  state.board[1][1] = "dark";
  state.board[2][2] = "light";
  assert.deepEqual(flipsForMove(state.board, "dark", 3, 3), [
    { row: 2, column: 2 },
    { row: 2, column: 3 },
    { row: 3, column: 2 },
  ]);
});

test("illegal moves fail without mutating the state", () => {
  const state = createInitialOthelloState();
  assert.throws(() => applyOthelloMove(state, { row: 0, column: 0 }), /Illegal/);
  assert.deepEqual(scoreOthelloBoard(state.board), { dark: 2, light: 2 });
});

test("the deterministic chooser strongly prefers an available corner", () => {
  const state = createInitialOthelloState();
  state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  state.currentPlayer = "dark";
  state.board[0][2] = "dark";
  state.board[0][1] = "light";
  state.board[3][3] = "dark";
  state.board[3][4] = "light";
  const choice = chooseDeterministicOthelloMove(state);
  assert.deepEqual(choice && { row: choice.row, column: choice.column }, { row: 0, column: 0 });
});

test("the game completes when neither side has a legal move", () => {
  const state: OthelloState = {
    ...createInitialOthelloState(),
    board: Array.from({ length: 8 }, () => Array(8).fill("dark")),
    currentPlayer: "dark",
  };
  state.board[7][7] = null;
  state.board[7][6] = "light";
  const complete = applyOthelloMove(state, { row: 7, column: 7 });
  assert.equal(complete.status, "completed");
  assert.equal(complete.winner, "dark");
  assert.deepEqual(scoreOthelloBoard(complete.board), { dark: 64, light: 0 });
});
