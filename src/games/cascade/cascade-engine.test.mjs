import test from "node:test";
import assert from "node:assert/strict";
import {
  CASCADE_LEVELS,
  applySwap,
  createBoard,
  createRng,
  findMatches,
  listLegalMoves,
} from "../../../public/cascade-engine.js";
import { profileCascadeLevels, runCascadeLevel } from "./cascade-simulator.js";

test("Cascade level curve remains the current 20-level opening run", () => {
  assert.equal(CASCADE_LEVELS.length, 20);
  assert.deepEqual(CASCADE_LEVELS[0], { level: 1, target: 1085, moves: 20, hard: false });
  assert.deepEqual(CASCADE_LEVELS[4], { level: 5, target: 2375, moves: 20, hard: true });
  assert.equal(CASCADE_LEVELS[19].hard, true);
});

test("seeded board creation is deterministic, stable, and immediately playable", () => {
  const first = createBoard({ rng: createRng(12345) });
  const second = createBoard({ rng: createRng(12345) });
  assert.deepEqual(first, second);
  assert.equal(first.length, 64);
  assert.equal(findMatches(first).size, 0);
  assert.ok(listLegalMoves(first).length > 0);
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
    assert.ok(step.falls.every((fall) => Number.isInteger(fall.from) && Number.isInteger(fall.to)));
    assert.ok(step.spawns.every((spawn) => Number.isInteger(spawn.to)));
  }
  assert.equal(findMatches(result.board).size, 0);
  assert.ok(listLegalMoves(result.board).length > 0);
});

test("headless bot can execute and clear the current opening run", () => {
  for (const level of CASCADE_LEVELS) {
    const run = runCascadeLevel({ level, seed: 1000 + level.level, strategy: "lookahead" });
    assert.equal(run.win, true, `lookahead failed level ${level.level}`);
    assert.ok(run.moveHistory.length > 0);
    assert.ok(run.maxCascade >= 1);
  }
});

test("batch profiler returns comparable bot tiers for all levels", () => {
  const report = profileCascadeLevels({ runsPerLevel: 2 });
  assert.equal(report.levels.length, 20);
  for (const level of report.levels) {
    assert.ok(level.strategies.random);
    assert.ok(level.strategies.greedy);
    assert.ok(level.strategies.lookahead);
    assert.ok(level.strategies.lookahead.wins > 0, `no lookahead wins on level ${level.level}`);
  }
});
