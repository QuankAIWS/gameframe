import {
  CASCADE_LEVELS,
  applySwap,
  createBoard,
  createRng,
  listLegalMoves,
} from "../../../public/cascade-engine.js";

const STRATEGIES = new Set(["random", "greedy", "lookahead"]);

function evaluateImmediate(board, move, boardRng) {
  const trialRng = boardRng.clone();
  const result = applySwap(board, move.from, move.to, trialRng);
  return {
    move,
    result,
    rng: trialRng,
    value: result.scoreGained + (result.maxCascade * 20),
  };
}

function chooseRandom(moves, decisionRng) {
  return moves[Math.floor(decisionRng.next() * moves.length)];
}

function chooseGreedy(board, moves, boardRng) {
  let best = null;
  for (const move of moves) {
    const evaluated = evaluateImmediate(board, move, boardRng);
    if (!best || evaluated.value > best.value || (evaluated.value === best.value && move.from < best.move.from)) {
      best = evaluated;
    }
  }
  return best.move;
}

function chooseLookahead(board, moves, boardRng) {
  const firstPass = moves
    .map((move) => evaluateImmediate(board, move, boardRng))
    .sort((a, b) => b.value - a.value || a.move.from - b.move.from || a.move.to - b.move.to)
    .slice(0, 10);

  let best = null;
  for (const candidate of firstPass) {
    const nextMoves = listLegalMoves(candidate.result.board);
    let futureBest = 0;
    for (const nextMove of nextMoves) {
      const nextEval = evaluateImmediate(candidate.result.board, nextMove, candidate.rng);
      if (nextEval.value > futureBest) futureBest = nextEval.value;
    }
    const value = candidate.value + (futureBest * 0.68);
    if (!best || value > best.value || (value === best.value && candidate.move.from < best.move.from)) {
      best = { move: candidate.move, value };
    }
  }
  return best?.move ?? chooseGreedy(board, moves, boardRng);
}

export function chooseMove(strategy, board, moves, boardRng, decisionRng) {
  if (!STRATEGIES.has(strategy)) throw new Error(`Unknown Cascade bot strategy: ${strategy}`);
  if (!moves.length) return null;
  if (strategy === "random") return chooseRandom(moves, decisionRng);
  if (strategy === "greedy") return chooseGreedy(board, moves, boardRng);
  return chooseLookahead(board, moves, boardRng);
}

export function runCascadeLevel({ level, seed, strategy = "lookahead" }) {
  const definition = typeof level === "number" ? CASCADE_LEVELS[level - 1] : level;
  if (!definition) throw new Error(`Unknown Cascade level: ${level}`);

  const baseSeed = (Number(seed) >>> 0) || 1;
  const boardRng = createRng((baseSeed ^ (definition.level * 0x9e3779b1)) >>> 0);
  const decisionRng = createRng((baseSeed ^ 0xa5a5a5a5 ^ (definition.level * 0x85ebca6b)) >>> 0);
  let board = createBoard({ rng: boardRng });
  let score = 0;
  let movesRemaining = definition.moves;
  let cascadeCount = 0;
  let maxCascade = 0;
  let shuffles = 0;
  let branchingTotal = 0;
  const moveHistory = [];

  while (movesRemaining > 0 && score < definition.target) {
    const legalMoves = listLegalMoves(board);
    branchingTotal += legalMoves.length;
    if (!legalMoves.length) throw new Error(`Cascade engine returned a board with no legal moves at level ${definition.level}`);

    const move = chooseMove(strategy, board, legalMoves, boardRng, decisionRng);
    const result = applySwap(board, move.from, move.to, boardRng);
    if (!result.legal) throw new Error(`Cascade bot selected an illegal move ${move.from}->${move.to}`);

    movesRemaining -= 1;
    score += result.scoreGained;
    cascadeCount += result.transitions.length;
    maxCascade = Math.max(maxCascade, result.maxCascade);
    if (result.shuffled) shuffles += 1;
    board = result.board;
    moveHistory.push({
      from: move.from,
      to: move.to,
      gained: result.scoreGained,
      cascades: result.transitions.length,
      maxCascade: result.maxCascade,
      shuffled: result.shuffled,
      score,
      movesRemaining,
    });
  }

  const win = score >= definition.target;
  return {
    level: definition.level,
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
    hard: level.hard,
    target: level.target,
    moves: level.moves,
    strategy,
    runs: runs.length,
    wins: wins.length,
    winRate: wins.length / runs.length,
    medianMovesToWin: percentile(movesToWin, 0.5),
    p90MovesToWin: percentile(movesToWin, 0.9),
    averageScoreMargin: margins.reduce((sum, value) => sum + value, 0) / runs.length,
    averageCascadeCount: runs.reduce((sum, run) => sum + run.cascadeCount, 0) / runs.length,
    maxCascade: Math.max(...runs.map((run) => run.maxCascade)),
    averageBranching: runs.reduce((sum, run) => sum + run.averageBranching, 0) / runs.length,
    shuffleRate: runs.filter((run) => run.shuffles > 0).length / runs.length,
  };
}

export function profileCascadeLevels({ runsPerLevel = 40, strategies = ["random", "greedy", "lookahead"], seedBase = 0xc45cade }) {
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
    const greedy = strategyReports.greedy;
    const lookahead = strategyReports.lookahead;
    levels.push({
      level: level.level,
      hard: level.hard,
      target: level.target,
      moves: level.moves,
      strategies: strategyReports,
      planningSensitivity: greedy && lookahead ? lookahead.winRate - greedy.winRate : null,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    runsPerLevel,
    strategies,
    levels,
  };
}
