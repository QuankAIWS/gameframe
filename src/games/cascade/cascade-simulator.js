import {
  CASCADE_LEVELS,
  SPECIAL,
  TILE_KINDS,
  applySpecialLevelProgress,
  applySpecialSwap,
  createBoard,
  createLevelProgress,
  createRng,
  emptySpecials,
  findSpecialMatchGroups,
  objectiveComplete,
} from "../../../public/cascade-special-engine.js";
import { objectiveRemaining } from "../../../public/cascade-engine.js";

const STRATEGIES = new Set(["random", "greedy", "lookahead"]);

function specialRules(levelNumber) {
  return {
    stripe: levelNumber >= 2,
    bomb: levelNumber >= 3,
    color: levelNumber >= 5,
    fish: levelNumber >= 301,
  };
}

function swap(values, a, b) {
  [values[a], values[b]] = [values[b], values[a]];
}

function listPlayableMoves(board, specials, rules = {}) {
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    const right = index % 8 < 7 ? index + 1 : -1;
    const down = index + 8 < board.length ? index + 8 : -1;
    for (const neighbor of [right, down]) {
      if (neighbor < 0) continue;
      const a = specials[index];
      const b = specials[neighbor];
      if (a === SPECIAL.COLOR || b === SPECIAL.COLOR || (a && b)) {
        moves.push({ from: index, to: neighbor, matched: 0, specialMove: true });
        continue;
      }
      swap(board, index, neighbor);
      const groups = findSpecialMatchGroups(board, specials, rules);
      swap(board, index, neighbor);
      if (groups.length) {
        moves.push({
          from: index,
          to: neighbor,
          matched: groups.reduce((sum, group) => sum + group.indices.length, 0),
          specialMove: false,
        });
      }
    }
  }
  return moves;
}

function remainingTargetKinds(level, progress) {
  return (level.objective?.collect || [])
    .filter((goal) => Number(progress?.collected?.[goal.kind] || 0) < goal.count)
    .map((goal) => goal.kind);
}

function objectiveAdvanceValue(level, before, after) {
  let value = 0;
  for (const goal of level.objective?.collect || []) {
    const beforeCount = Math.min(goal.count, Number(before?.collected?.[goal.kind] || 0));
    const afterCount = Math.min(goal.count, Number(after?.collected?.[goal.kind] || 0));
    value += Math.max(0, afterCount - beforeCount) * 150;
  }
  const beforeIce = (before?.ice || []).reduce((sum, layers) => sum + Math.max(0, Number(layers) || 0), 0);
  const afterIce = (after?.ice || []).reduce((sum, layers) => sum + Math.max(0, Number(layers) || 0), 0);
  value += Math.max(0, beforeIce - afterIce) * 190;
  return value;
}

function evaluateImmediate(level, progress, board, specials, move, boardRng) {
  const trialRng = boardRng.clone();
  const result = applySpecialSwap(board, specials, move.from, move.to, trialRng, {
    rules: specialRules(level.level),
    ice: progress.ice,
    targetKinds: remainingTargetKinds(level, progress),
  });
  if (!result.legal) return null;
  const nextProgress = applySpecialLevelProgress(level, progress, result);
  const comboCount = result.transitions.filter((transition) => Boolean(transition.combo)).length;
  return {
    move,
    result,
    progress: nextProgress,
    rng: trialRng,
    value: result.scoreGained
      + objectiveAdvanceValue(level, progress, nextProgress)
      + (result.maxCascade * 20)
      + ((result.specialCreatedCount || 0) * 130)
      + ((result.specialTriggeredCount || 0) * 170)
      + (comboCount * 320),
  };
}

function chooseRandom(moves, decisionRng) {
  return moves[Math.floor(decisionRng.next() * moves.length)];
}

function chooseGreedy(level, progress, board, specials, moves, boardRng) {
  let best = null;
  for (const move of moves) {
    const evaluated = evaluateImmediate(level, progress, board, specials, move, boardRng);
    if (!evaluated) continue;
    if (!best || evaluated.value > best.value || (evaluated.value === best.value && move.from < best.move.from)) {
      best = evaluated;
    }
  }
  return best?.move ?? moves[0] ?? null;
}

function chooseLookahead(level, progress, board, specials, moves, boardRng) {
  const firstPass = moves
    .map((move) => evaluateImmediate(level, progress, board, specials, move, boardRng))
    .filter(Boolean)
    .sort((a, b) => b.value - a.value || a.move.from - b.move.from || a.move.to - b.move.to)
    .slice(0, 10);

  let best = null;
  for (const candidate of firstPass) {
    const nextMoves = listPlayableMoves(candidate.result.board.slice(), candidate.result.specials, specialRules(level.level));
    let futureBest = 0;
    for (const nextMove of nextMoves) {
      const nextEval = evaluateImmediate(
        level,
        candidate.progress,
        candidate.result.board,
        candidate.result.specials,
        nextMove,
        candidate.rng,
      );
      if (nextEval && nextEval.value > futureBest) futureBest = nextEval.value;
    }
    const value = candidate.value + (futureBest * 0.68);
    if (!best || value > best.value || (value === best.value && candidate.move.from < best.move.from)) {
      best = { move: candidate.move, value };
    }
  }
  return best?.move ?? chooseGreedy(level, progress, board, specials, moves, boardRng);
}

export function chooseMove(strategy, level, progress, board, specials, moves, boardRng, decisionRng) {
  if (!STRATEGIES.has(strategy)) throw new Error(`Unknown Cascade bot strategy: ${strategy}`);
  if (!moves.length) return null;
  if (strategy === "random") return chooseRandom(moves, decisionRng);
  if (strategy === "greedy") return chooseGreedy(level, progress, board, specials, moves, boardRng);
  return chooseLookahead(level, progress, board, specials, moves, boardRng);
}

export function runCascadeLevel({ level, seed, strategy = "lookahead" }) {
  const definition = typeof level === "number" ? CASCADE_LEVELS[level - 1] : level;
  if (!definition) throw new Error(`Unknown Cascade level: ${level}`);

  const baseSeed = (Number(seed) >>> 0) || 1;
  const boardRng = createRng((baseSeed ^ (definition.level * 0x9e3779b1)) >>> 0);
  const decisionRng = createRng((baseSeed ^ 0xa5a5a5a5 ^ (definition.level * 0x85ebca6b)) >>> 0);
  let board = createBoard({ rng: boardRng, rules: specialRules(definition.level) });
  let specials = emptySpecials();
  let progress = createLevelProgress(definition);
  let score = 0;
  let movesRemaining = definition.moves;
  let cascadeCount = 0;
  let maxCascade = 0;
  let shuffles = 0;
  let branchingTotal = 0;
  let specialCreatedCount = 0;
  let specialTriggeredCount = 0;
  let comboCount = 0;
  let iceHitCount = 0;
  const collectedTotals = Array(TILE_KINDS).fill(0);
  const moveHistory = [];

  while (movesRemaining > 0 && !objectiveComplete(definition, progress, score)) {
    const legalMoves = listPlayableMoves(board.slice(), specials, specialRules(definition.level));
    branchingTotal += legalMoves.length;
    if (!legalMoves.length) throw new Error(`Cascade special engine returned a board with no playable moves at level ${definition.level}`);

    const move = chooseMove(strategy, definition, progress, board, specials, legalMoves, boardRng, decisionRng);
    const result = applySpecialSwap(board, specials, move.from, move.to, boardRng, {
      rules: specialRules(definition.level),
      ice: progress.ice,
    });
    if (!result.legal) throw new Error(`Cascade bot selected an illegal move ${move.from}->${move.to}`);

    movesRemaining -= 1;
    score += result.scoreGained;
    progress = applySpecialLevelProgress(definition, progress, result);
    cascadeCount += result.transitions.length;
    maxCascade = Math.max(maxCascade, result.maxCascade);
    specialCreatedCount += result.specialCreatedCount || 0;
    specialTriggeredCount += result.specialTriggeredCount || 0;
    comboCount += result.transitions.filter((transition) => Boolean(transition.combo)).length;
    iceHitCount += result.iceHitCount || 0;
    for (let kind = 0; kind < TILE_KINDS; kind += 1) collectedTotals[kind] += Number(result.clearedKindCounts?.[kind] || 0);
    if (result.shuffled) shuffles += 1;
    board = result.board;
    specials = result.specials;
    moveHistory.push({
      from: move.from,
      to: move.to,
      gained: result.scoreGained,
      cascades: result.transitions.length,
      maxCascade: result.maxCascade,
      specialCreatedCount: result.specialCreatedCount || 0,
      specialTriggeredCount: result.specialTriggeredCount || 0,
      comboCount: result.transitions.filter((transition) => Boolean(transition.combo)).length,
      iceHitCount: result.iceHitCount || 0,
      shuffled: result.shuffled,
      score,
      movesRemaining,
      specialsOnBoard: specials.filter(Boolean).length,
      objectiveRemaining: objectiveRemaining(definition, progress, score),
    });
  }

  const win = objectiveComplete(definition, progress, score);
  const remaining = objectiveRemaining(definition, progress, score);
  return {
    level: definition.level,
    chapter: definition.chapter,
    difficulty: definition.difficulty,
    strategy,
    seed: baseSeed,
    win,
    score,
    target: definition.target,
    scoreMargin: score - definition.target,
    movesUsed: definition.moves - movesRemaining,
    movesRemaining,
    cascadeCount,
    maxCascade,
    shuffles,
    specialCreatedCount,
    specialTriggeredCount,
    comboCount,
    iceHitCount,
    collectedTotals,
    objectiveRemaining: remaining,
    objectiveComplete: win,
    averageBranching: moveHistory.length ? branchingTotal / moveHistory.length : 0,
    moveHistory,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function summarizeRuns(level, strategy, runs) {
  const wins = runs.filter((run) => run.win);
  const movesToWin = wins.map((run) => run.movesUsed).sort((a, b) => a - b);
  const margins = runs.map((run) => run.scoreMargin);
  return {
    level: level.level,
    chapter: level.chapter,
    difficulty: level.difficulty,
    hard: level.hard,
    target: level.target,
    moves: level.moves,
    mechanics: level.mechanics,
    objective: level.objective,
    strategy,
    runs: runs.length,
    wins: wins.length,
    winRate: wins.length / runs.length,
    medianMovesToWin: percentile(movesToWin, 0.5),
    p90MovesToWin: percentile(movesToWin, 0.9),
    averageScoreMargin: margins.reduce((sum, value) => sum + value, 0) / runs.length,
    averageCascadeCount: runs.reduce((sum, run) => sum + run.cascadeCount, 0) / runs.length,
    averageSpecialsCreated: runs.reduce((sum, run) => sum + run.specialCreatedCount, 0) / runs.length,
    averageSpecialsTriggered: runs.reduce((sum, run) => sum + run.specialTriggeredCount, 0) / runs.length,
    averageSpecialCombos: runs.reduce((sum, run) => sum + run.comboCount, 0) / runs.length,
    averageIceHits: runs.reduce((sum, run) => sum + run.iceHitCount, 0) / runs.length,
    maxCascade: Math.max(...runs.map((run) => run.maxCascade)),
    averageBranching: runs.reduce((sum, run) => sum + run.averageBranching, 0) / runs.length,
    shuffleRate: runs.filter((run) => run.shuffles > 0).length / runs.length,
    objectiveFailureRate: runs.filter((run) => !run.win && run.objectiveRemaining.some((item) => item.type !== "score")).length / runs.length,
  };
}

export function profileCascadeLevels({ runsPerLevel = 40, strategies = ["random", "greedy", "lookahead"], seedBase = 0xc45cade } = {}) {
  const levels = [];
  for (const level of CASCADE_LEVELS) {
    const strategyReports = {};
    for (const strategy of strategies) {
      const runs = [];
      for (let run = 0; run < runsPerLevel; run += 1) {
        const seed = (seedBase + (level.level * 100003) + (run * 2654435761)) >>> 0;
        runs.push(runCascadeLevel({ level, seed, strategy }));
      }
      strategyReports[strategy] = summarizeRuns(level, strategy, runs);
    }
    const random = strategyReports.random;
    const greedy = strategyReports.greedy;
    const lookahead = strategyReports.lookahead;
    levels.push({
      level: level.level,
      chapter: level.chapter,
      difficulty: level.difficulty,
      hard: level.hard,
      target: level.target,
      moves: level.moves,
      mechanics: level.mechanics,
      objective: level.objective,
      strategies: strategyReports,
      skillSensitivity: random && lookahead ? lookahead.winRate - random.winRate : null,
      planningSensitivity: greedy && lookahead ? lookahead.winRate - greedy.winRate : null,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    rules: "persistent-specials-v2-smart-fish/campaign-wave-v2",
    runsPerLevel,
    strategies,
    levels,
  };
}
