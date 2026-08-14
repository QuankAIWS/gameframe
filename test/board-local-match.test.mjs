import assert from "node:assert/strict";
import test from "node:test";
import { createLocalBoardMatch } from "../public/board-local-match.js";

test("local Tic-Tac-Toe alternates both seats and resolves a win", () => {
  const match = createLocalBoardMatch("tic-tac-toe");
  let view = match.view();
  assert.equal(view.observation.nextPlayerId, "local:x");
  assert.equal(view.observation.legalActions.length, 9);

  for (const cell of [0, 3, 1, 4, 2]) {
    view = match.submit({ type: "place", cell });
  }

  assert.equal(view.revision, 5);
  assert.equal(view.observation.status.lifecycle, "completed");
  assert.equal(view.observation.status.winnerPlayerId, "local:x");
  assert.equal(view.observation.legalActions.length, 0);
});

test("local Checkers starts with canonical legal movement and alternates colors", () => {
  const match = createLocalBoardMatch("american-checkers");
  let view = match.view();
  assert.equal(view.observation.activePlayerId, "local:black");
  assert.equal(view.observation.board.filter(Boolean).length, 24);
  assert.equal(view.observation.legalActions.length, 7);
  assert.equal(view.observation.mustCapture, false);

  const first = view.observation.legalActions[0];
  view = match.submit(first);
  assert.equal(view.revision, 1);
  assert.equal(view.observation.activePlayerId, "local:red");
  assert.equal(view.observation.board.filter(Boolean).length, 24);
  assert.ok(view.observation.legalActions.length > 0);
});
