import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_CAPACITY,
  CAMPAIGN_MILESTONE,
  CASCADE_LEVELS,
  CHAPTER_SIZE,
  LEVEL_COUNT,
  applyLevelProgress,
  applySwap,
  createBoard,
  createLevelProgress,
  createRng,
  dropSupportIndices,
  findMatches,
  listLegalMoves,
  objectiveComplete,
  resolveCascades,
} from "../../../public/cascade-engine.js";
import { chooseMove, profileCascadeLevels, profileCascadeMoveFragility, runCascadeLevel, targetFirstPassBand } from "./cascade-simulator.js";
import { analyzePlaytestExport } from "./cascade-playtest-analysis.js";

test("Cascade ships 750 levels on a campaign model sized for 10000", () => {
  assert.equal(LEVEL_COUNT, 750);
  assert.equal(CAMPAIGN_CAPACITY, 10000);
  assert.equal(CAMPAIGN_MILESTONE, 3000);
  assert.equal(CHAPTER_SIZE, 30);
  assert.equal(CASCADE_LEVELS.length, 750);
  assert.equal(CASCADE_LEVELS[0].target, 1085);
  assert.equal(CASCADE_LEVELS[0].moves, 20);
  assert.equal(CASCADE_LEVELS[4].target, 2375);
  assert.equal(CASCADE_LEVELS[4].hard, true);
  assert.equal(CASCADE_LEVELS[4].mechanics.includes("fish"), false);
  assert.equal(CASCADE_LEVELS[5].mechanics.includes("fish"), true);

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

  assert.equal(CASCADE_LEVELS[300].chapter, "advanced-mastery");
  assert.ok(CASCADE_LEVELS[300].mechanics.includes("fish"));
  assert.equal(CASCADE_LEVELS[330].chapter, "ice-remix");
  assert.equal(CASCADE_LEVELS[360].chapter, "collection-remix");
  assert.equal(CASCADE_LEVELS[390].chapter, "advanced-mix");
  assert.equal(CASCADE_LEVELS[420].chapter, "veteran-remix");
  assert.equal(CASCADE_LEVELS[449].chapter, "veteran-capstone");
  assert.equal(CASCADE_LEVELS[449].difficulty, "super-hard");
  assert.equal(CASCADE_LEVELS[450].chapter, "drop-intro");
  assert.ok(CASCADE_LEVELS[450].mechanics.includes("drop"));
  assert.equal(CASCADE_LEVELS[450].objective.drop.count, 1);
  assert.equal(CASCADE_LEVELS[480].chapter, "drop-ice");
  assert.ok(CASCADE_LEVELS[480].objective.drop);
  assert.ok(CASCADE_LEVELS[480].objective.ice);
  assert.equal(CASCADE_LEVELS[510].chapter, "drop-collection");
  assert.ok(CASCADE_LEVELS[510].objective.collect.length > 0);
  assert.equal(CASCADE_LEVELS[540].chapter, "drop-layered");
  assert.equal(CASCADE_LEVELS[540].objective.ice.layers, 2);
  assert.equal(CASCADE_LEVELS[570].chapter, "drop-mastery");
  assert.ok(CASCADE_LEVELS[599].objective.drop.count >= 3);
  assert.equal(CASCADE_LEVELS[449].objective.collect.length, 2);
  assert.equal(CASCADE_LEVELS[449].objective.ice.layers, 2);
});

test("levels 301-450 stay in the early-campaign difficulty band while preserving outlier fixes", () => {
  assert.equal(CASCADE_LEVELS[300].moves, 26, "advanced mastery should recover the move removed by the obsolete level-900 ramp");
  assert.equal(CASCADE_LEVELS[330].moves, 27, "ice remix gets one additional early-campaign move");
  assert.equal(CASCADE_LEVELS[360].moves, 25, "collection remix should recover the move removed by the obsolete level-900 ramp");
  assert.equal(CASCADE_LEVELS[390].moves, 28, "advanced mix gets one additional early-campaign move");
  assert.equal(CASCADE_LEVELS[420].moves, 28, "veteran remix gets one additional early-campaign move");
  assert.equal(CASCADE_LEVELS[449].moves, 26, "the level-450 capstone should not use mature-campaign pressure");
});

test("the first 150 drop levels teach with at most three objects and reachable starting depth", () => {
  for (const definition of CASCADE_LEVELS.slice(450, 600)) {
    assert.ok(definition.objective.drop, `level ${definition.level} should include a drop objective`);
    assert.ok(definition.objective.drop.count >= 1 && definition.objective.drop.count <= 3);
    const progress = createLevelProgress(definition);
    assert.equal(progress.drop.total, definition.objective.drop.count);
    for (const token of progress.drop.tokens) {
      const row = Math.floor(token.index / 8);
      assert.ok(row >= 3 && row <= 5, `level ${definition.level} drop token should start in the teaching depth band`);
      assert.equal(token.index % 8, token.exit % 8);
    }
  }
});

test("drop objectives descend through cleared support cells and complete at exits", () => {
  const definition = CASCADE_LEVELS[450];
  const progress = createLevelProgress(definition);
  assert.equal(progress.drop.total, 1);
  assert.equal(progress.drop.delivered, 0);
  assert.equal(progress.drop.tokens.length, 1);

  const token = progress.drop.tokens[0];
  const col = token.index % 8;
  const startRow = Math.floor(token.index / 8);
  const support = token.index + 8;
  assert.deepEqual(dropSupportIndices(progress), [support]);

  const before = Array.from({ length: 64 }, (_, index) => index % 6);
  const cleared = before.slice();
  cleared[support] = null;
  const after = before.slice();
  const advanced = applyLevelProgress(definition, progress, {
    clearedKindCounts: Array(6).fill(0),
    before,
    cleared,
    after,
    iceAfter: progress.ice,
  });
  assert.equal(Math.floor(advanced.drop.tokens[0].index / 8), startRow + 1);

  let current = advanced;
  while (current.drop.tokens.length) {
    const moving = current.drop.tokens[0];
    const row = Math.floor(moving.index / 8);
    const nextIndex = moving.index + 8;
    const stepBefore = Array.from({ length: 64 }, (_, index) => index % 6);
    const stepCleared = stepBefore.slice();
    if (row < 7) stepCleared[nextIndex] = null;
    current = applyLevelProgress(definition, current, {
      clearedKindCounts: Array(6).fill(0),
      before: stepBefore,
      cleared: stepCleared,
      after: stepBefore,
      iceAfter: current.ice,
    });
  }

  assert.equal(current.drop.delivered, 1);
  assert.equal(objectiveComplete(definition, current, definition.target), true);
  assert.equal(col, current.drop.exits[0] % 8);
});

test("late-campaign outlier smoothing preserves the wave while fixing profiler walls", () => {
  assert.equal(CASCADE_LEVELS[328].moves, 24, "level 329 should recover one move");
  assert.equal(CASCADE_LEVELS[356].objective.ice.count, 5, "level 357 should reduce layered-ice pressure");
  assert.equal(CASCADE_LEVELS[356].objective.ice.pattern, "center");
  assert.equal(CASCADE_LEVELS[359].objective.collect[0].count, 13, "level 360 should reduce collection pressure");
  assert.equal(CASCADE_LEVELS[359].objective.ice.count, 6, "level 360 should reduce edge-ice pressure");
  assert.equal(CASCADE_LEVELS[359].objective.ice.pattern, "center");
  assert.equal(CASCADE_LEVELS[413].moves, 25, "level 414 keeps its early-campaign move slack");
  assert.equal(CASCADE_LEVELS[413].objective.ice.pattern, "center");
  assert.equal(CASCADE_LEVELS[418].objective.ice.pattern, "center");
  assert.equal(CASCADE_LEVELS[419].moves, 24, "level 420 should retain early-campaign move slack");
  assert.equal(CASCADE_LEVELS[443].moves, 27, "level 444 should retain outlier compensation");
  assert.equal(CASCADE_LEVELS[443].objective.ice.pattern, "center");
  assert.equal(CASCADE_LEVELS[444].moves, 25, "level 445 should retain outlier compensation");
  assert.equal(CASCADE_LEVELS[444].objective.ice.count, 9, "level 445 should reduce cross-ice pressure");
  assert.equal(CASCADE_LEVELS[444].objective.ice.pattern, "center");
  assert.equal(CASCADE_LEVELS[447].objective.collect[0].count, 15, "level 448 should reduce collection pressure");
  assert.equal(CASCADE_LEVELS[447].objective.ice.count, 8, "level 448 should reduce cross-ice pressure");
  assert.equal(CASCADE_LEVELS[447].objective.ice.pattern, "center");
  assert.equal(CASCADE_LEVELS[448].moves, 27, "level 449 should retain outlier compensation");
  assert.equal(CASCADE_LEVELS[448].objective.collect[0].count, 15, "level 449 should reduce collection pressure");
  assert.equal(CASCADE_LEVELS[448].objective.ice.count, 6, "level 449 should reduce diagonal-ice pressure");
  assert.equal(CASCADE_LEVELS[448].objective.ice.pattern, "center");
});

test("drop-layered walls receive targeted geometry compensation", () => {
  assert.equal(CASCADE_LEVELS[564].objective.ice.pattern, "center");
  assert.ok(CASCADE_LEVELS[564].objective.ice.count <= 6);
  assert.ok(CASCADE_LEVELS[564].moves >= 30);
  assert.equal(CASCADE_LEVELS[569].objective.ice.pattern, "center");
  assert.ok(CASCADE_LEVELS[569].objective.ice.count <= 6);
  assert.ok(CASCADE_LEVELS[569].moves >= 30);
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

test("human personas choose from visible board information without peeking at future RNG", () => {
  const level = CASCADE_LEVELS[30];
  const progress = createLevelProgress(level);
  const board = createBoard({ rng: createRng(424242) });
  const specials = Array(64).fill(null);
  const moves = listLegalMoves(board);
  const first = chooseMove(
    "human-skilled",
    level,
    progress,
    board,
    specials,
    moves,
    createRng(1),
    createRng(777),
  );
  const second = chooseMove(
    "human-skilled",
    level,
    progress,
    board,
    specials,
    moves,
    createRng(0xdeadbeef),
    createRng(777),
  );
  assert.deepEqual(first, second);
});

test("campaign first-pass targets ramp gradually across the 10000-level horizon", () => {
  assert.equal(targetFirstPassBand(300, "normal"), null);

  const opening = targetFirstPassBand(301, "normal");
  const thousand = targetFirstPassBand(1000, "normal");
  const milestone = targetFirstPassBand(3000, "normal");
  const mature = targetFirstPassBand(10000, "normal");
  const beyond = targetFirstPassBand(12000, "normal");

  assert.deepEqual(opening, { min: 0.82, max: 0.94, phase: "early" });
  assert.deepEqual(thousand, { min: 0.78, max: 0.90, phase: "growth" });
  assert.deepEqual(milestone, { min: 0.68, max: 0.83, phase: "milestone" });
  assert.deepEqual(mature, { min: 0.48, max: 0.68, phase: "mature" });
  assert.deepEqual(beyond, mature);
  assert.ok(opening.min > milestone.min);
  assert.ok(milestone.min > mature.min);
});

test("levels 601-750 advance from Drop mastery into Cages and Recall Locks", () => {
  const level601 = CASCADE_LEVELS[600];
  const level651 = CASCADE_LEVELS[650];
  const level701 = CASCADE_LEVELS[700];
  const level750 = CASCADE_LEVELS[749];

  assert.equal(level601.chapter, "drop-precision-mastery");
  assert.ok(level601.objective.drop);
  assert.equal(level651.chapter, "lock-intro");
  assert.ok(level651.objective.locks);
  assert.equal(level651.objective.locks.recall, false);
  assert.ok(level651.mechanics.includes("locks"));
  assert.equal(level701.chapter, "recall-lock-intro");
  assert.equal(level701.objective.locks.recall, true);
  assert.ok(level701.mechanics.includes("recall-locks"));
  assert.equal(level750.chapter, "recall-lock-mix");

  const cageProgress = createLevelProgress(level651);
  assert.equal(cageProgress.locks.total > 0, true);
  assert.equal(cageProgress.locks.layers.filter((layer) => layer > 0).length, cageProgress.locks.total);

  const recallProgress = createLevelProgress(level701);
  const recallCells = recallProgress.locks.layers.flatMap((layer, index) => layer > 0 ? [index] : []);
  assert.ok(recallCells.length >= 2);
  assert.ok(recallCells.every((index) => recallProgress.locks.requiredKinds[index] >= 0));
});

test("all 750 levels exercise the objective-aware lookahead bot without engine errors", () => {
  for (const level of CASCADE_LEVELS) {
    const run = runCascadeLevel({ level, seed: 1000 + level.level, strategy: "lookahead" });
    assert.ok(run.moveHistory.length > 0, `lookahead made no moves on level ${level.level}`);
    assert.ok(run.maxCascade >= 1, `lookahead saw no cascade on level ${level.level}`);
    assert.equal(Array.isArray(run.objectiveRemaining), true);
  }
});

test("ranged profiling preserves absolute campaign level numbers", () => {
  const report = profileCascadeLevels({
    levelDefinitions: CASCADE_LEVELS.slice(300, 303),
    runsPerLevel: 1,
    humanRunsPerLevel: 1,
  });
  assert.equal(report.levels.length, 3);
  assert.deepEqual(report.levelRange, { from: 301, to: 303 });
  assert.deepEqual(report.levels.map((level) => level.level), [301, 302, 303]);
});

test("move fragility profiling uses paired seeds across plus/minus one move", () => {
  const report = profileCascadeMoveFragility({
    levels: CASCADE_LEVELS.slice(30, 32),
    runsPerLevel: 1,
    strategy: "human-skilled",
    seedBase: 1234,
  });
  assert.equal(report.levels.length, 2);
  for (const level of report.levels) {
    assert.equal(typeof level.minusOneWinRate, "number");
    assert.equal(typeof level.baselineWinRate, "number");
    assert.equal(typeof level.plusOneWinRate, "number");
    assert.equal(level.moveSensitivity, level.plusOneWinRate - level.minusOneWinRate);
  }
});

test("sample profiling covers all 750 levels and records solver and human-persona sensitivity", () => {
  const report = profileCascadeLevels({ runsPerLevel: 1, humanRunsPerLevel: 1 });
  assert.equal(report.levels.length, 750);
  for (const level of report.levels) {
    assert.ok(level.strategies.random);
    assert.ok(level.strategies["human-casual"]);
    assert.ok(level.strategies["human-skilled"]);
    assert.ok(level.strategies.greedy);
    assert.ok(level.strategies.lookahead);
    assert.equal(typeof level.strategies.lookahead.objectiveFailureRate, "number");
    assert.equal(typeof level.humanSkillSpread, "number");
  }
  assert.equal(report.levels[299].targetFirstPassBand, null);
  assert.ok(report.levels[300].targetFirstPassBand);
  const laterRun = report.levels.slice(30);
  assert.ok(laterRun.some((level) => level.skillSensitivity !== 0));
});

test("playtest analysis excludes hammer-assisted attempts from intrinsic difficulty", () => {
  const report = analyzePlaytestExport({
    schemaVersion: 1,
    players: [
      {
        displayName: "Orange",
        playerId: "orange",
        summary: { highestLevelStarted: 33, highestLevelCompleted: 32 },
        attempts: [
          { mode: "normal", level: 31, outcome: "win", hammersUsed: 1, startedAt: "2026-08-01T00:00:00Z" },
          { mode: "normal", level: 32, outcome: "failed", hammersUsed: 0, startedAt: "2026-08-01T00:01:00Z" },
          { mode: "normal", level: 32, outcome: "win", hammersUsed: 0, startedAt: "2026-08-01T00:02:00Z" },
        ],
      },
      {
        displayName: "Rose",
        playerId: "rose",
        summary: { highestLevelStarted: 32, highestLevelCompleted: 32 },
        attempts: [
          { mode: "normal", level: 31, outcome: "failed", hammersUsed: 0, startedAt: "2026-08-01T00:00:00Z" },
          { mode: "normal", level: 31, outcome: "win", hammersUsed: 0, startedAt: "2026-08-01T00:01:00Z" },
          { mode: "normal", level: 32, outcome: "win", hammersUsed: 0, startedAt: "2026-08-01T00:02:00Z" },
        ],
      },
    ],
  }, {
    boosterMetricExclusions: {
      Orange: "known live hammer testing",
    },
  });

  assert.equal(report.resolvedNormalAttempts, 6);
  assert.equal(report.unassistedResolvedAttempts, 5);
  assert.equal(report.unassistedWins, 3);
  assert.equal(report.unassistedWinRate, 0.6);
  assert.deepEqual(report.cleanFirstPass.byDifficulty.map((bucket) => ({
    difficulty: bucket.difficulty,
    eligible: bucket.eligible,
    wins: bucket.wins,
  })), [
    { difficulty: "relief", eligible: 1, wins: 0 },
    { difficulty: "normal", eligible: 2, wins: 1 },
  ]);
  const orange = report.players.find((player) => player.displayName === "Orange");
  const rose = report.players.find((player) => player.displayName === "Rose");
  assert.equal(orange.boosterMetrics.excluded, true);
  assert.equal(orange.firstPass.hammerContaminatedLevels, 1);
  assert.equal(orange.unassistedAttemptsPerSuccess.attemptsPerSuccess, 2);
  assert.equal(rose.firstPass.rate, 0.5);
  assert.equal(rose.unassistedAttemptsPerSuccess.attemptsPerSuccess, 1.5);
  assert.equal(report.policy.invalidSwapsUsedAsSkillSignal, false);
  assert.equal(report.policy.deviceClassChangesLevelDifficulty, false);
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
