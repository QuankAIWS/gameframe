import {
  CASCADE_LEVELS,
  SPECIAL,
  TILE_KINDS,
  applySpecialLevelProgress,
  applySpecialSwap,
  createBoard,
  createLevelProgress,
  createRng,
  dropSupportIndices,
  emptySpecials,
  findSpecialMatchGroups,
  objectiveComplete,
  ordinaryLockTargetIndices,
} from "../../../public/cascade-special-engine.js";
import { objectiveRemaining } from "../../../public/cascade-engine.js";

export const HUMAN_PERSONAS = Object.freeze({
  "human-casual": Object.freeze({
    temperature: 3.4,
    lapseRate: 0.12,
    recallRetention: 0.72,
    weights: Object.freeze({
      match: 0.55,
      ice: 1.15,
      collection: 0.95,
      drop: 1.35,
      specialCreation: 1.05,
      specialActivation: 0.65,
      combo: 1.45,
      colorObjective: 1.25,
      lock: 1.3,
      recall: 1.45,
    }),
  }),
  "human-skilled": Object.freeze({
    temperature: 1.35,
    lapseRate: 0.03,
    recallRetention: 0.92,
    weights: Object.freeze({
      match: 0.35,
      ice: 2.05,
      collection: 1.75,
      drop: 2.45,
      specialCreation: 1.75,
      specialActivation: 1.05,
      combo: 2.35,
      colorObjective: 2.4,
      lock: 2.4,
      recall: 2.8,
    }),
  }),
});

const STRATEGIES = new Set(["random", "greedy", "lookahead", ...Object.keys(HUMAN_PERSONAS)]);

const CAMPAIGN_DIFFICULTY_ANCHORS = Object.freeze([
  Object.freeze({
    level: 301,
    phase: "early",
    bands: Object.freeze({
      relief: Object.freeze([0.90, 0.98]),
      normal: Object.freeze([0.82, 0.94]),
      hard: Object.freeze([0.70, 0.84]),
      "super-hard": Object.freeze([0.55, 0.72]),
    }),
  }),
  Object.freeze({
    level: 1000,
    phase: "growth",
    bands: Object.freeze({
      relief: Object.freeze([0.88, 0.96]),
      normal: Object.freeze([0.78, 0.90]),
      hard: Object.freeze([0.64, 0.78]),
      "super-hard": Object.freeze([0.50, 0.68]),
    }),
  }),
  Object.freeze({
    level: 2000,
    phase: "established",
    bands: Object.freeze({
      relief: Object.freeze([0.85, 0.94]),
      normal: Object.freeze([0.73, 0.87]),
      hard: Object.freeze([0.59, 0.74]),
      "super-hard": Object.freeze([0.45, 0.63]),
    }),
  }),
  Object.freeze({
    level: 3000,
    phase: "milestone",
    bands: Object.freeze({
      relief: Object.freeze([0.82, 0.92]),
      normal: Object.freeze([0.68, 0.83]),
      hard: Object.freeze([0.54, 0.70]),
      "super-hard": Object.freeze([0.40, 0.58]),
    }),
  }),
  Object.freeze({
    level: 5000,
    phase: "advanced",
    bands: Object.freeze({
      relief: Object.freeze([0.78, 0.90]),
      normal: Object.freeze([0.60, 0.78]),
      hard: Object.freeze([0.46, 0.64]),
      "super-hard": Object.freeze([0.33, 0.52]),
    }),
  }),
  Object.freeze({
    level: 7500,
    phase: "deep",
    bands: Object.freeze({
      relief: Object.freeze([0.74, 0.87]),
      normal: Object.freeze([0.53, 0.72]),
      hard: Object.freeze([0.39, 0.58]),
      "super-hard": Object.freeze([0.27, 0.46]),
    }),
  }),
  Object.freeze({
    level: 10000,
    phase: "mature",
    bands: Object.freeze({
      relief: Object.freeze([0.70, 0.84]),
      normal: Object.freeze([0.48, 0.68]),
      hard: Object.freeze([0.34, 0.54]),
      "super-hard": Object.freeze([0.23, 0.42]),
    }),
  }),
]);

function campaignDifficultyAnchor(levelNumber) {
  if (levelNumber <= CAMPAIGN_DIFFICULTY_ANCHORS[0].level) {
    return {
      lower: CAMPAIGN_DIFFICULTY_ANCHORS[0],
      upper: CAMPAIGN_DIFFICULTY_ANCHORS[0],
      progress: 0,
    };
  }

  for (let index = 1; index < CAMPAIGN_DIFFICULTY_ANCHORS.length; index += 1) {
    const upper = CAMPAIGN_DIFFICULTY_ANCHORS[index];
    if (levelNumber <= upper.level) {
      const lower = CAMPAIGN_DIFFICULTY_ANCHORS[index - 1];
      return {
        lower,
        upper,
        progress: (levelNumber - lower.level) / (upper.level - lower.level),
      };
    }
  }

  const mature = CAMPAIGN_DIFFICULTY_ANCHORS.at(-1);
  return { lower: mature, upper: mature, progress: 0 };
}

export function targetFirstPassBand(levelNumber, difficulty = "normal") {
  if (levelNumber <= 300) return null;
  const { lower, upper, progress } = campaignDifficultyAnchor(levelNumber);
  const key = lower.bands[difficulty] ? difficulty : "normal";
  const start = lower.bands[key];
  const end = upper.bands[key];
  const interpolate = (a, b) => a + ((b - a) * progress);
  return Object.freeze({
    min: interpolate(start[0], end[0]),
    max: interpolate(start[1], end[1]),
    phase: lower === upper || progress >= 1 ? upper.phase : `${lower.phase}->${upper.phase}`,
  });
}

function specialRules(levelNumber) {
  return {
    stripe: levelNumber >= 2,
    bomb: levelNumber >= 3,
    color: levelNumber >= 5,
    fish: levelNumber >= 6,
  };
}

function swap(values, a, b) {
  [values[a], values[b]] = [values[b], values[a]];
}

function listPlayableMoves(board, specials, rules = {}, locked = []) {
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    const right = index % 8 < 7 ? index + 1 : -1;
    const down = index + 8 < board.length ? index + 8 : -1;
    for (const neighbor of [right, down]) {
      if (neighbor < 0 || Number(locked?.[index]) > 0 || Number(locked?.[neighbor]) > 0) continue;
      const a = specials[index];
      const b = specials[neighbor];
      if (a === SPECIAL.COLOR || b === SPECIAL.COLOR || (a && b)) {
        moves.push({ from: index, to: neighbor, matched: 0, specialMove: true });
        continue;
      }
      swap(board, index, neighbor);
      const groups = findSpecialMatchGroups(board, specials, rules, locked);
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

function initialRecallKnowledge(personaName, progress, decisionRng) {
  const persona = HUMAN_PERSONAS[personaName];
  if (!persona || progress?.locks?.recall !== true) return null;
  const knowledge = Array(64).fill(-1);
  const layers = progress?.locks?.layers || [];
  const requiredKinds = progress?.locks?.requiredKinds || [];
  for (let index = 0; index < layers.length; index += 1) {
    if (Number(layers[index]) <= 0) continue;
    const requiredKind = Number(requiredKinds[index]);
    if (!Number.isInteger(requiredKind) || requiredKind < 0 || requiredKind >= TILE_KINDS) continue;
    // Every cue is visibly shown at level start. Human-like personas retain only
    // a seeded subset; they do not read hidden engine truth again after it hides.
    if (decisionRng.next() <= Number(persona.recallRetention || 0)) knowledge[index] = requiredKind;
  }
  return knowledge;
}

function dropDistance(progress) {
  return (progress?.drop?.tokens || []).reduce((sum, token) => {
    const row = Math.floor(Number(token.index) / 8);
    return sum + Math.max(0, 7 - row);
  }, 0);
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
  const beforeDrops = Number(before?.drop?.delivered || 0);
  const afterDrops = Number(after?.drop?.delivered || 0);
  value += Math.max(0, afterDrops - beforeDrops) * 420;
  value += Math.max(0, dropDistance(before) - dropDistance(after)) * 170;
  const beforeLocks = (before?.locks?.layers || []).reduce((sum, layer) => sum + Math.max(0, Number(layer) || 0), 0);
  const afterLocks = (after?.locks?.layers || []).reduce((sum, layer) => sum + Math.max(0, Number(layer) || 0), 0);
  value += Math.max(0, beforeLocks - afterLocks) * 300;
  return value;
}

function comboStrength(a, b) {
  if (!a && !b) return 0;
  if (a === SPECIAL.COLOR && b === SPECIAL.COLOR) return 5;
  if (a === SPECIAL.COLOR || b === SPECIAL.COLOR) return 4.4;
  if (a === SPECIAL.BOMB && b === SPECIAL.BOMB) return 4.2;
  if ((a === SPECIAL.BOMB && [SPECIAL.STRIPE_H, SPECIAL.STRIPE_V].includes(b))
    || (b === SPECIAL.BOMB && [SPECIAL.STRIPE_H, SPECIAL.STRIPE_V].includes(a))) return 4;
  if (a === SPECIAL.FISH || b === SPECIAL.FISH) return 3.8;
  if ([SPECIAL.STRIPE_H, SPECIAL.STRIPE_V].includes(a)
    && [SPECIAL.STRIPE_H, SPECIAL.STRIPE_V].includes(b)) return 3.3;
  return 2.6;
}

function visibleMoveFeatures(level, progress, board, specials, move, recallKnowledge = null) {
  const swappedBoard = board.slice();
  const swappedSpecials = specials.slice();
  swap(swappedBoard, move.from, move.to);
  swap(swappedSpecials, move.from, move.to);

  const a = swappedSpecials[move.from];
  const b = swappedSpecials[move.to];
  const neededKinds = new Set(remainingTargetKinds(level, progress));
  const features = {
    match: 0,
    ice: 0,
    collection: 0,
    drop: 0,
    specialCreation: 0,
    specialActivation: 0,
    combo: 0,
    colorObjective: 0,
    lock: 0,
    recall: 0,
  };

  if (a === SPECIAL.COLOR || b === SPECIAL.COLOR) {
    const colorIndex = a === SPECIAL.COLOR ? move.from : move.to;
    const partnerIndex = colorIndex === move.from ? move.to : move.from;
    const targetKind = swappedBoard[partnerIndex];
    const targetCount = swappedBoard.filter((kind) => kind === targetKind).length;
    features.specialActivation = 1;
    features.match = Math.min(8, targetCount) * 0.3;
    if (neededKinds.has(targetKind)) features.colorObjective = Math.min(6, targetCount) * 0.35;
    if (a && b) features.combo = comboStrength(a, b);
    return features;
  }

  if (a && b) {
    features.specialActivation = 1;
    features.combo = comboStrength(a, b);
    return features;
  }

  const groups = findSpecialMatchGroups(swappedBoard, swappedSpecials, specialRules(level.level), progress?.locks?.layers || []);
  const matched = new Set(groups.flatMap((group) => group.indices));
  features.match = Math.min(10, matched.size);

  const dropSupports = new Set(dropSupportIndices(progress));
  for (const index of matched) {
    if (Number(progress?.ice?.[index] || 0) > 0) features.ice += 1;
    if (neededKinds.has(swappedBoard[index])) features.collection += 1;
    if (dropSupports.has(index)) features.drop += 1;
  }

  const lockLayers = progress?.locks?.layers || [];
  const requiredKinds = progress?.locks?.requiredKinds || [];
  for (let lockIndex = 0; lockIndex < lockLayers.length; lockIndex += 1) {
    if (Number(lockLayers[lockIndex]) <= 0) continue;
    const row = Math.floor(lockIndex / 8);
    const col = lockIndex % 8;
    const neighbors = [];
    if (row > 0) neighbors.push(lockIndex - 8);
    if (row < 7) neighbors.push(lockIndex + 8);
    if (col > 0) neighbors.push(lockIndex - 1);
    if (col < 7) neighbors.push(lockIndex + 1);
    const matchedNeighbors = neighbors.filter((index) => matched.has(index));
    if (!matchedNeighbors.length) continue;
    const authoredRequiredKind = Number(requiredKinds[lockIndex]);
    if (authoredRequiredKind >= 0) {
      const rememberedKind = recallKnowledge
        ? Number(recallKnowledge[lockIndex])
        : authoredRequiredKind;
      if (rememberedKind >= 0 && matchedNeighbors.some((index) => swappedBoard[index] === rememberedKind)) features.recall += 1;
    } else {
      features.lock += 1;
    }
  }

  const lineGroups = groups.filter((group) => group.orientation === "row" || group.orientation === "column");
  const squareGroups = groups.filter((group) => group.orientation === "square");
  const createsColor = lineGroups.some((group) => group.indices.length >= 5);
  const createsStripe = lineGroups.some((group) => group.indices.length === 4);
  const createsFish = squareGroups.some((group) => group.indices.length === 4);
  let createsBomb = false;
  const rows = lineGroups.filter((group) => group.orientation === "row");
  const columns = lineGroups.filter((group) => group.orientation === "column");
  for (const row of rows) {
    if (columns.some((column) => row.indices.some((index) => column.indices.includes(index)))) {
      createsBomb = true;
      break;
    }
  }

  features.specialCreation =
    (createsStripe ? 1.0 : 0)
    + (createsFish ? 1.15 : 0)
    + (createsBomb ? 1.65 : 0)
    + (createsColor ? 2.25 : 0);
  return features;
}

export function scoreVisibleMove(personaName, level, progress, board, specials, move, recallKnowledge = null) {
  const persona = HUMAN_PERSONAS[personaName];
  if (!persona) throw new Error(`Unknown Cascade human persona: ${personaName}`);
  const features = visibleMoveFeatures(level, progress, board, specials, move, recallKnowledge);
  const value = Object.entries(features).reduce(
    (sum, [key, featureValue]) => sum + (featureValue * Number(persona.weights[key] || 0)),
    0,
  );
  return { value, features };
}

function chooseHuman(personaName, level, progress, board, specials, moves, decisionRng, recallKnowledge = null) {
  const persona = HUMAN_PERSONAS[personaName];
  if (decisionRng.next() < persona.lapseRate) return chooseRandom(moves, decisionRng);

  const candidates = moves.map((move) => ({
    move,
    ...scoreVisibleMove(personaName, level, progress, board, specials, move, recallKnowledge),
  }));
  const maxValue = Math.max(...candidates.map((candidate) => candidate.value));
  const weighted = candidates.map((candidate) => ({
    ...candidate,
    weight: Math.exp((candidate.value - maxValue) / persona.temperature),
  }));
  const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = decisionRng.next() * total;
  for (const candidate of weighted) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.move;
  }
  return weighted.at(-1)?.move ?? moves[0] ?? null;
}

function evaluateImmediate(level, progress, board, specials, move, boardRng) {
  const trialRng = boardRng.clone();
  const result = applySpecialSwap(board, specials, move.from, move.to, trialRng, {
    rules: specialRules(level.level),
    ice: progress.ice,
    locks: progress.locks,
    targetKinds: remainingTargetKinds(level, progress),
    targetIndices: [...new Set([...dropSupportIndices(progress), ...ordinaryLockTargetIndices(progress)])],
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
    const nextMoves = listPlayableMoves(
      candidate.result.board.slice(),
      candidate.result.specials,
      specialRules(level.level),
      candidate.progress?.locks?.layers || [],
    );
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

export function chooseMove(strategy, level, progress, board, specials, moves, boardRng, decisionRng, recallKnowledge = null) {
  if (!STRATEGIES.has(strategy)) throw new Error(`Unknown Cascade bot strategy: ${strategy}`);
  if (!moves.length) return null;
  if (strategy === "random") return chooseRandom(moves, decisionRng);
  if (strategy === "greedy") return chooseGreedy(level, progress, board, specials, moves, boardRng);
  if (strategy === "lookahead") return chooseLookahead(level, progress, board, specials, moves, boardRng);
  return chooseHuman(strategy, level, progress, board, specials, moves, decisionRng, recallKnowledge);
}

export function runCascadeLevel({ level, seed, strategy = "lookahead" }) {
  const definition = typeof level === "number" ? CASCADE_LEVELS[level - 1] : level;
  if (!definition) throw new Error(`Unknown Cascade level: ${level}`);

  const baseSeed = (Number(seed) >>> 0) || 1;
  const boardRng = createRng((baseSeed ^ (definition.level * 0x9e3779b1)) >>> 0);
  const decisionRng = createRng((baseSeed ^ 0xa5a5a5a5 ^ (definition.level * 0x85ebca6b)) >>> 0);
  let progress = createLevelProgress(definition);
  let board = createBoard({
    rng: boardRng,
    rules: specialRules(definition.level),
    locked: progress?.locks?.layers || [],
  });
  let specials = emptySpecials();
  const recallKnowledge = HUMAN_PERSONAS[strategy]
    ? initialRecallKnowledge(strategy, progress, decisionRng)
    : null;
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
  let dropDeliveredCount = 0;
  let lockHitCount = 0;
  let locksOpenedCount = 0;
  const collectedTotals = Array(TILE_KINDS).fill(0);
  const moveHistory = [];

  while (movesRemaining > 0 && !objectiveComplete(definition, progress, score)) {
    const legalMoves = listPlayableMoves(board.slice(), specials, specialRules(definition.level), progress?.locks?.layers || []);
    branchingTotal += legalMoves.length;
    if (!legalMoves.length) throw new Error(`Cascade special engine returned a board with no playable moves at level ${definition.level}`);

    const move = chooseMove(strategy, definition, progress, board, specials, legalMoves, boardRng, decisionRng, recallKnowledge);
    const result = applySpecialSwap(board, specials, move.from, move.to, boardRng, {
      rules: specialRules(definition.level),
      ice: progress.ice,
      locks: progress.locks,
      targetKinds: remainingTargetKinds(definition, progress),
      targetIndices: [...new Set([...dropSupportIndices(progress), ...ordinaryLockTargetIndices(progress)])],
    });
    if (!result.legal) throw new Error(`Cascade bot selected an illegal move ${move.from}->${move.to}`);

    movesRemaining -= 1;
    score += result.scoreGained;
    const deliveredBefore = Number(progress?.drop?.delivered || 0);
    const openedBefore = Number(progress?.locks?.opened || 0);
    progress = applySpecialLevelProgress(definition, progress, result);
    dropDeliveredCount += Math.max(0, Number(progress?.drop?.delivered || 0) - deliveredBefore);
    locksOpenedCount += Math.max(0, Number(progress?.locks?.opened || 0) - openedBefore);
    lockHitCount += result.transitions.reduce((sum, transition) => sum + (transition.lockHits?.length || 0), 0);
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
      dropsDelivered: Number(progress?.drop?.delivered || 0),
      lockHits: result.transitions.reduce((sum, transition) => sum + (transition.lockHits?.length || 0), 0),
      locksOpened: Number(progress?.locks?.opened || 0),
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
    dropDeliveredCount,
    lockHitCount,
    locksOpenedCount,
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
    averageDropsDelivered: runs.reduce((sum, run) => sum + run.dropDeliveredCount, 0) / runs.length,
    maxCascade: Math.max(...runs.map((run) => run.maxCascade)),
    averageBranching: runs.reduce((sum, run) => sum + run.averageBranching, 0) / runs.length,
    shuffleRate: runs.filter((run) => run.shuffles > 0).length / runs.length,
    objectiveFailureRate: runs.filter((run) => !run.win && run.objectiveRemaining.some((item) => item.type !== "score")).length / runs.length,
  };
}

export function profileCascadeMoveFragility({
  levels = CASCADE_LEVELS,
  runsPerLevel = 8,
  strategy = "human-skilled",
  seedBase = 0xf12a91,
} = {}) {
  if (!STRATEGIES.has(strategy)) throw new Error(`Unknown Cascade fragility strategy: ${strategy}`);
  const reports = [];
  for (const level of levels) {
    const variants = new Map();
    for (const moveDelta of [-1, 0, 1]) {
      const definition = { ...level, moves: Math.max(1, level.moves + moveDelta) };
      const runs = [];
      for (let run = 0; run < runsPerLevel; run += 1) {
        const seed = (seedBase + (level.level * 100003) + (run * 2654435761)) >>> 0;
        runs.push(runCascadeLevel({ level: definition, seed, strategy }));
      }
      variants.set(moveDelta, summarizeRuns(definition, strategy, runs));
    }
    const minusOne = variants.get(-1);
    const baseline = variants.get(0);
    const plusOne = variants.get(1);
    const moveSensitivity = plusOne.winRate - minusOne.winRate;
    reports.push({
      level: level.level,
      chapter: level.chapter,
      difficulty: level.difficulty,
      strategy,
      runsPerVariant: runsPerLevel,
      minusOneWinRate: minusOne.winRate,
      baselineWinRate: baseline.winRate,
      plusOneWinRate: plusOne.winRate,
      moveSensitivity,
      brittle: moveSensitivity >= 0.5,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    strategy,
    runsPerLevel,
    seedBase,
    levels: reports,
  };
}

export function profileCascadeLevels({
  levelDefinitions = CASCADE_LEVELS,
  runsPerLevel = 40,
  humanRunsPerLevel = Math.max(1, Math.floor(runsPerLevel / 2)),
  strategies = ["random", "human-casual", "human-skilled", "greedy", "lookahead"],
  seedBase = 0xc45cade,
} = {}) {
  const levels = [];
  for (const level of levelDefinitions) {
    const strategyReports = {};
    for (const strategy of strategies) {
      const runs = [];
      const strategyRuns = HUMAN_PERSONAS[strategy] ? humanRunsPerLevel : runsPerLevel;
      for (let run = 0; run < strategyRuns; run += 1) {
        const seed = (seedBase + (level.level * 100003) + (run * 2654435761)) >>> 0;
        runs.push(runCascadeLevel({ level, seed, strategy }));
      }
      strategyReports[strategy] = summarizeRuns(level, strategy, runs);
    }
    const random = strategyReports.random;
    const greedy = strategyReports.greedy;
    const lookahead = strategyReports.lookahead;
    const humanCasual = strategyReports["human-casual"];
    const humanSkilled = strategyReports["human-skilled"];
    const targetBand = targetFirstPassBand(level.level, level.difficulty);
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
      humanSkillSpread: humanCasual && humanSkilled ? humanSkilled.winRate - humanCasual.winRate : null,
      targetFirstPassBand: targetBand,
      humanSkilledTargetDelta: humanSkilled && targetBand
        ? humanSkilled.winRate < targetBand.min
          ? humanSkilled.winRate - targetBand.min
          : humanSkilled.winRate > targetBand.max
            ? humanSkilled.winRate - targetBand.max
            : 0
        : null,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    rules: "persistent-specials-v3-butterfly/campaign-wave-v2",
    runsPerLevel,
    humanRunsPerLevel,
    seedBase,
    strategies,
    humanPersonas: HUMAN_PERSONAS,
    levelRange: levelDefinitions.length
      ? { from: levelDefinitions[0].level, to: levelDefinitions.at(-1).level }
      : { from: null, to: null },
    levels,
  };
}
