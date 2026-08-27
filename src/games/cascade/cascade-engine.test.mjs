import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_CAPACITY,
  CASCADE_LEVELS,
  CHAPTER_SIZE,
  LEVEL_COUNT,
  applyLevelProgress,
  applySwap,
  createBoard,
  createLevelProgress,
  createRng,
  findMatches,
  listLegalMoves,
  objectiveComplete,
  resolveCascades,
} from "../../../public/cascade-engine.js";
import { profileCascadeLevels, runCascadeLevel } from "./cascade-simulator.js";

test("Cascade ships 450 levels on a campaign model sized for 3000", () => {
  assert.equal(LEVEL_COUNT, 450);
  assert.equal(CAMPAIGN_CAPACITY, 3000);
  assert.equal(CHAPTER_SIZE, 30);
  assert.equal(CASCADE_LEVELS.length, 450);
  assert.equal(CASCADE_LEVELS[0].target, 1085);
  assert.equal(CASCADE_LEVELS[0].moves, 20);
  assert.equal(CASCADE_LEVELS[4].target, 2375);
  assert.equal(CASCADE_LEVELS[4].hard, true);

  assert.equal(CASCADE_LEVELS[29].chapter, "special-mastery");
  assert.equal(CASCADE_LEVELS[29].difficulty, "super-hard");

  assert.equal(CASCADE_LEVELS[30].chapter, "ice");
  assert.ok(CASCADE_LEVELS[30].objective.ice);
  assert.equal(CASCADE_LEVELS[30].objective.ice.layers, 1);

  assert.equal(CASCADE_LEVELS[60].chapter, "collection");
  assert.equal(CASCADE_LEVELS[60].objective.collect.length, 1);

  assert.equal(CASCADE_LEVELS[90].chapter, "mixed");
  assert.ok(CASCADE_LEVELS[90].objective.ice);
  assert.equal(CASCADE_LEVELS[90].objective.collect.length, 1);

  assert.equal(CASCADE_LEVELS[120].chapter, "dual-collection");
  assert.equal(CASCADE_LEVELS[120].objective.collect.length, 2);

  assert.equal(CASCADE_LEVELS[150].chapter, "layered-ice");
  assert.equal(CASCADE_LEVELS[150].objective.ice.layers, 2);

  assert.equal(CASCADE_LEVELS[180].chapter, "layered-mix");
  assert.equal(CASCADE_LEVELS[180].objective.ice.layers, 2);
  assert.equal(CASCADE_LEVELS[180].objective.collect.length, 1);

  assert.equal(CASCADE_LEVELS[210].chapter, "precision");
  assert.ok(CASCADE_LEVELS[210].objective.ice);
  assert.ok(CASCADE_LEVELS[210].objective.collect.length > 0);

  assert.equal(CASCADE_LEVELS[240].chapter, "heavy-remix");
  assert.equal(CASCADE_LEVELS[240].objective.collect.length, 2);
  assert.equal(CASCADE_LEVELS[240].objective.ice.layers, 2);

  assert.equal(CASCADE_LEVELS[270].chapter, "expert-remix");
  assert.equal(CASCADE_LEVELS[299].chapter, "capstone");
  assert.equal(CASCADE_LEVELS[299].difficulty, "super-hard");
  assert.equal(CASCADE_LEVELS[299].objective.collect.length, 2);
  assert.equal(CASCADE_LEVELS[299].objective.ice.layers, 2);

  assert.equal(CASCADE_LEVELS[300].chapter, "fish-school");
  assert.ok(CASCADE_LEVELS[300].mechanics.includes("smart-fish"));
  assert.equal(CASCADE_LEVELS[330].chapter, "fish-ice");
  assert.equal(CASCADE_LEVELS[360].chapter, "fish-collection");
  assert.equal(CASCADE_LEVELS[390].chapter, "fish-mix");
  assert.equal(CASCADE_LEVELS[420].chapter, "fish-veteran");
  assert.equal(CASCADE_LEVELS[449].chapter, "fish-capstone");
  assert.equal(CASCADE_LEVELS[449].difficulty, "super-hard");
  assert.equal(CASCADE_LEVELS[449].objective.collect.length, 2);
  assert.equal(CASCADE_LEVELS[449].objective.ice.layers, 2);
});

test("difficulty uses repeating tension waves instead of a monotonic staircase", () => {
  const wave = CASCADE_LEVELS.slice(30, 40);
  assert.equal(wave[0].difficulty, "relief");
  assert.equal(wave[4].difficulty, "hard");
  assert.equal(wave[5].difficulty, "relief");
  assert.equal(wave[9].difficulty, "super-hard");
  assert.ok(wave[0].moves > wave[4].moves);
  assert.ok(wave[5].moves > wave[9].moves);
  assert.ok(wave[0].target < wave[4].target);
  assert.ok(wave[5].target < wave[9].target);

  for (let start = 30; start < LEVEL_COUNT - 10; start += 10) {
    const ten = CASCADE_LEVELS.slice(start, start + 10);
    assert.equal(ten[0].difficulty, "relief", `level ${start + 1} should open a relief beat`);
    assert.equal(ten[4].difficulty, "hard", `level ${start + 5} should be hard`);
    assert.equal(ten[5].difficulty, "relief", `level ${start + 6} should release tension`);
    assert.equal(ten[9].difficulty, "super-hard", `level ${start + 10} should cap the wave`);
  }
});

test("seeded board creation is deterministic, stable, and immediately playable", () => {
  const first = createBoard({ rng: createRng(12345) });
  const second = createBoard({ rng: createRng(12345) });
  assert.deepEqual(first, second);
  assert.equal(first.length, 64);
  assert.equal(findMatches(first).size, 0);
  assert.ok(listLegalMoves(first).length > 0);
});

test("four and five tile powers unlock only when their level mechanic is active", () => {
  const four = Array.from({ length: 64 }, (_, index) => (Math.floor(index / 8) * 2 + (index % 8)) % 6);
  four[0] = 5;
  four[1] = 5;
  four[2] = 5;
  four[3] = 5;
  const plainFour = resolveCascades(four, createRng(11), { mechanics: [] }).transitions[0];
  const powerFour = resolveCascades(four, createRng(11), { mechanics: ["power-match"] }).transitions[0];
  assert.equal(plainFour.powerClears.length, 0);
  assert.equal(plainFour.matched.length, 4);
  assert.equal(powerFour.powerClears.length, 1);
  assert.deepEqual(powerFour.matched.slice(0, 8), [0, 1, 2, 3, 4, 5, 6, 7]);

  const five = Array.from({ length: 64 }, (_, index) => (Math.floor(index / 8) * 2 + (index % 8)) % 6);
  for (let index = 0; index < 5; index += 1) five[index] = 4;
  const plainFive = resolveCascades(five, createRng(12), { mechanics: ["power-match"] }).transitions[0];
  const sweepFive = resolveCascades(five, createRng(12), { mechanics: ["power-match", "color-sweep"] }).transitions[0];
  assert.equal(plainFive.colorSweeps.length, 0);
  assert.equal(plainFive.matched.length, 5);
  assert.equal(sweepFive.colorSweeps.length, 1);
  assert.ok(sweepFive.matched.length > 5);
});

test("a T or L intersection triggers the legacy area-blast compatibility path", () => {
  const board = Array.from({ length: 64 }, (_, index) => (Math.floor(index / 8) * 2 + (index % 8)) % 6);
  for (const index of [18, 19, 20, 12, 28]) board[index] = 5;
  const plain = resolveCascades(board, createRng(17), { mechanics: ["power-match", "color-sweep"] }).transitions[0];
  const blasted = resolveCascades(board, createRng(17), { mechanics: ["power-match", "color-sweep", "cross-blast"] }).transitions[0];
  assert.equal(plain.crossBlasts.length, 0);
  assert.equal(blasted.crossBlasts.length, 1);
  assert.ok(blasted.crossBlasts[0].cleared.length >= 9);
  assert.ok(blasted.matched.length > plain.matched.length);
});

test("matched cells chip fixed ice layers and objective progress tracks collection", () => {
  const definition = CASCADE_LEVELS[180];
  const progress = createLevelProgress(definition);
  assert.ok(progress.ice.some((layers) => layers === 2));

  const board = Array.from({ length: 64 }, (_, index) => (Math.floor(index / 8) * 2 + (index % 8)) % 6);
  board[0] = 3;
  board[1] = 3;
  board[2] = 3;
  const ice = Array(64).fill(0);
  ice[0] = 2;
  ice[1] = 1;
  const result = resolveCascades(board, createRng(20), { mechanics: definition.mechanics, ice });
  const first = result.transitions[0];
  assert.equal(first.iceAfter[0], 1);
  assert.equal(first.iceAfter[1], 0);
  assert.equal(first.iceHits.length, 2);

  const tracked = applyLevelProgress(definition, { collected: Array(6).fill(0), ice }, first);
  assert.ok(tracked.collected[3] >= 3);
  assert.equal(tracked.ice[0], 1);
});

test("a legal swap returns replayable objective-aware cascade transition records", () => {
  const level = CASCADE_LEVELS[185];
  const progress = createLevelProgress(level);
  const rng = createRng(24680);
  const board = createBoard({ rng });
  const move = listLegalMoves(board)[0];
  const result = applySwap(board, move.from, move.to, rng, { mechanics: level.mechanics, ice: progress.ice });
  assert.equal(result.legal, true);
  assert.ok(result.transitions.length >= 1);
  assert.equal(result.scoreGained, result.transitions.reduce((sum, step) => sum + step.gained, 0));
  for (const step of result.transitions) {
    assert.equal(step.before.length, 64);
    assert.equal(step.after.length, 64);
    assert.equal(step.iceBefore.length, 64);
    assert.equal(step.iceAfter.length, 64);
    assert.ok(step.matched.length >= 3);
    assert.equal(step.gained, step.matched.length * 80 * step.cascade);
    assert.ok(Array.isArray(step.powerClears));
    assert.ok(Array.isArray(step.colorSweeps));
    assert.ok(Array.isArray(step.crossBlasts));
    assert.equal(step.clearedKindCounts.length, 6);
    assert.ok(step.falls.every((fall) => Number.isInteger(fall.from) && Number.isInteger(fall.to)));
    assert.ok(step.spawns.every((spawn) => Number.isInteger(spawn.to)));
  }
  assert.equal(findMatches(result.board).size, 0);
  assert.ok(listLegalMoves(result.board).length > 0);
});

test("all 450 levels exercise the objective-aware lookahead bot without engine errors", () => {
  for (const level of CASCADE_LEVELS) {
    const run = runCascadeLevel({ level, seed: 1000 + level.level, strategy: "lookahead" });
    assert.ok(run.moveHistory.length > 0, `lookahead made no moves on level ${level.level}`);
    assert.ok(run.maxCascade >= 1, `lookahead saw no cascade on level ${level.level}`);
    assert.equal(Array.isArray(run.objectiveRemaining), true);
  }
});

test("sample profiling covers all 450 levels and records skill/planning sensitivity", () => {
  const report = profileCascadeLevels({ runsPerLevel: 1 });
  assert.equal(report.levels.length, 450);
  for (const level of report.levels) {
    assert.ok(level.strategies.random);
    assert.ok(level.strategies.greedy);
    assert.ok(level.strategies.lookahead);
    assert.equal(typeof level.strategies.lookahead.objectiveFailureRate, "number");
  }
  const laterRun = report.levels.slice(30);
  assert.ok(laterRun.some((level) => level.skillSensitivity !== 0));
});

test("objectiveComplete requires score plus every authored non-score objective", () => {
  const definition = CASCADE_LEVELS[240];
  const progress = createLevelProgress(definition);
  assert.equal(objectiveComplete(definition, progress, definition.target), false);
  const complete = {
    collected: Array(6).fill(999),
    ice: Array(64).fill(0),
  };
  assert.equal(objectiveComplete(definition, complete, definition.target - 1), false);
  assert.equal(objectiveComplete(definition, complete, definition.target), true);
});
