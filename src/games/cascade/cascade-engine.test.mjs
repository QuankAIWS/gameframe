import test from "node:test";
import assert from "node:assert/strict";
import {
  CASCADE_LEVELS,
  applySwap,
  createBoard,
  createRng,
  findMatches,
  listLegalMoves,
  resolveCascades,
} from "../../../public/cascade-engine.js";
import { profileCascadeLevels, runCascadeLevel } from "./cascade-simulator.js";

test("Cascade keeps the opening curve and extends the authored run to 30 levels", () => {
  assert.equal(CASCADE_LEVELS.length, 30);
  assert.equal(CASCADE_LEVELS[0].target, 1085);
  assert.equal(CASCADE_LEVELS[0].moves, 20);
  assert.equal(CASCADE_LEVELS[4].target, 2375);
  assert.equal(CASCADE_LEVELS[4].hard, true);
  assert.equal(CASCADE_LEVELS[19].hard, true);
  assert.equal(CASCADE_LEVELS[29].target, 13600);
  assert.equal(CASCADE_LEVELS[29].moves, 14);
  assert.equal(CASCADE_LEVELS[29].hard, true);
});

test("seeded board creation is deterministic, stable, and immediately playable", () => {
  const first = createBoard({ rng: createRng(12345) });
  const second = createBoard({ rng: createRng(12345) });
  assert.deepEqual(first, second);
  assert.equal(first.length, 64);
  assert.equal(findMatches(first).size, 0);
  assert.ok(listLegalMoves(first).length > 0);
});

test("a four-tile match clears its full row or column", () => {
  const board = Array.from({ length: 64 }, (_, index) => (Math.floor(index / 8) * 2 + (index % 8)) % 6);
  board[0] = 5;
  board[1] = 5;
  board[2] = 5;
  board[3] = 5;
  const result = resolveCascades(board, createRng(11));
  const first = result.transitions[0];
  assert.equal(first.powerClears.length, 1);
  assert.equal(first.colorSweeps.length, 0);
  assert.deepEqual(first.matched.slice(0, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(first.gained, first.matched.length * 80);
});

test("a five-plus match sweeps every tile of that color", () => {
  const board = Array.from({ length: 64 }, (_, index) => (Math.floor(index / 8) * 2 + (index % 8)) % 6);
  for (let index = 0; index < 5; index += 1) board[index] = 4;
  const colorCount = board.filter((kind) => kind === 4).length;
  const result = resolveCascades(board, createRng(12));
  const first = result.transitions[0];
  assert.equal(first.colorSweeps.length, 1);
  assert.ok(first.matched.length >= colorCount);
  assert.ok(first.colorSweeps[0].cleared.length >= colorCount);
});

test("a legal swap returns replayable cascade transition records", () => {
  const rng = createRng(24680);
  const board = createBoard({ rng });
  const move = listLegalMoves(board)[0];
  const result = applySwap(board, move.from, move.to, rng);
  assert.equal(result.legal, true);
  assert.ok(result.transitions.length >= 1);
  assert.equal(result.scoreGained, result.transitions.reduce((sum, step) => sum + step.gained, 0));
  for (const step of result.transitions) {
    assert.equal(step.before.length, 64);
    assert.equal(step.after.length, 64);
    assert.ok(step.matched.length >= 3);
    assert.equal(step.gained, step.matched.length * 80 * step.cascade);
    assert.ok(Array.isArray(step.powerClears));
    assert.ok(Array.isArray(step.colorSweeps));
    assert.ok(step.falls.every((fall) => Number.isInteger(fall.from) && Number.isInteger(fall.to)));
    assert.ok(step.spawns.every((spawn) => Number.isInteger(spawn.to)));
  }
  assert.equal(findMatches(result.board).size, 0);
  assert.ok(listLegalMoves(result.board).length > 0);
});

test("lookahead bot can clear the full 30-level authored run on the deterministic canary seeds", () => {
  for (const level of CASCADE_LEVELS) {
    const run = runCascadeLevel({ level, seed: 1000 + level.level, strategy: "lookahead" });
    assert.equal(run.win, true, `lookahead failed level ${level.level}`);
    assert.ok(run.moveHistory.length > 0);
    assert.ok(run.maxCascade >= 1);
  }
});

test("later levels separate random play from the stronger bots", () => {
  const report = profileCascadeLevels({ runsPerLevel: 4 });
  assert.equal(report.levels.length, 30);
  for (const level of report.levels) {
    assert.ok(level.strategies.random);
    assert.ok(level.strategies.greedy);
    assert.ok(level.strategies.lookahead);
    assert.ok(level.strategies.lookahead.wins > 0, `no lookahead wins on level ${level.level}`);
  }
  const lateRun = report.levels.slice(20);
  assert.ok(lateRun.some((level) => level.strategies.random.winRate < level.strategies.lookahead.winRate));
  assert.ok(lateRun.some((level) => level.strategies.random.winRate < 0.75));
});
