export const BOARD_SIZE = 8;
export const TILE_KINDS = 6;
export const LEVEL_COUNT = 600;
export const CAMPAIGN_CAPACITY = 10000;
export const CAMPAIGN_MILESTONE = 3000;
export const CHAPTER_SIZE = 30;
export const TILE_LABELS = Object.freeze(["pink", "cyan", "yellow", "green", "purple", "orange"]);

const DIFFICULTY_WAVE = Object.freeze([
  Object.freeze({ difficulty: "relief", targetFactor: 0.84, objectiveFactor: 0.85, moveDelta: 2 }),
  Object.freeze({ difficulty: "normal", targetFactor: 0.92, objectiveFactor: 0.92, moveDelta: 1 }),
  Object.freeze({ difficulty: "normal", targetFactor: 0.96, objectiveFactor: 0.96, moveDelta: 1 }),
  Object.freeze({ difficulty: "normal", targetFactor: 1.00, objectiveFactor: 1.00, moveDelta: 0 }),
  Object.freeze({ difficulty: "hard", targetFactor: 1.08, objectiveFactor: 1.08, moveDelta: -1 }),
  Object.freeze({ difficulty: "relief", targetFactor: 0.88, objectiveFactor: 0.86, moveDelta: 2 }),
  Object.freeze({ difficulty: "normal", targetFactor: 0.98, objectiveFactor: 0.96, moveDelta: 1 }),
  Object.freeze({ difficulty: "normal", targetFactor: 1.03, objectiveFactor: 1.02, moveDelta: 0 }),
  Object.freeze({ difficulty: "normal", targetFactor: 1.08, objectiveFactor: 1.06, moveDelta: 0 }),
  Object.freeze({ difficulty: "super-hard", targetFactor: 1.16, objectiveFactor: 1.12, moveDelta: -1 }),
]);

const ICE_PATTERNS = Object.freeze(["checker", "center", "edges", "diagonal", "cross", "columns"]);
const PRECISION_ICE_PATTERNS = Object.freeze(["edges", "columns", "center", "cross"]);
const FAMILY_BETA_PATTERN_OVERRIDES = Object.freeze({
  47: "columns",
  154: "center",
  159: "center",
  182: "center",
});

function mechanicsForLevel(levelNumber) {
  const mechanics = [];
  if (levelNumber >= 2) mechanics.push("power-match");
  if (levelNumber >= 3) mechanics.push("cross-blast");
  if (levelNumber >= 5) mechanics.push("color-sweep");
  if (levelNumber >= 31) mechanics.push("ice-blockers");
  if (levelNumber >= 61) mechanics.push("collection");
  if (levelNumber >= 151) mechanics.push("layered-ice");
  if (levelNumber >= 6) mechanics.push("fish");
  if (levelNumber >= 451) mechanics.push("drop");
  return mechanics;
}

function collectGoal(kind, count) {
  return Object.freeze({ kind, count });
}

function objective({ collect = [], ice = null, drop = null } = {}) {
  return Object.freeze({
    collect: Object.freeze(collect.map((item) => collectGoal(item.kind, item.count))),
    ice: ice ? Object.freeze({ ...ice }) : null,
    drop: drop
      ? Object.freeze({
          count: Math.max(1, Math.floor(Number(drop.count) || 1)),
          columns: Object.freeze((drop.columns || []).map((value) => Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor(Number(value) || 0))))),
          startRows: Object.freeze((drop.startRows || []).map((value) => Math.max(0, Math.min(BOARD_SIZE - 2, Math.floor(Number(value) || 0))))),
        })
      : null,
  });
}

function waveForLevel(levelNumber) {
  return DIFFICULTY_WAVE[(Math.max(1, levelNumber) - 1) % DIFFICULTY_WAVE.length];
}

function roundedTarget(value) {
  return Math.max(500, Math.round(value / 100) * 100);
}

function scaleCount(value, factor) {
  return Math.max(1, Math.round(value * factor));
}

function patternFor(levelNumber, phase = 0, precision = false) {
  const override = FAMILY_BETA_PATTERN_OVERRIDES[levelNumber];
  if (override) return override;
  const patterns = precision ? PRECISION_ICE_PATTERNS : ICE_PATTERNS;
  return patterns[(levelNumber + (phase * 2) + Math.floor(levelNumber / CHAPTER_SIZE)) % patterns.length];
}

const LATE_PATTERN_POOLS = Object.freeze({
  relief: Object.freeze(["checker", "center", "columns", "center"]),
  normal: Object.freeze(["checker", "center", "columns", "cross", "diagonal"]),
  hard: Object.freeze(["columns", "cross", "diagonal", "center"]),
  "super-hard": Object.freeze(["cross", "diagonal", "edges", "columns"]),
});

function latePatternFor(levelNumber, phase = 0, difficulty = "normal") {
  const pool = LATE_PATTERN_POOLS[difficulty] || LATE_PATTERN_POOLS.normal;
  return pool[(levelNumber + phase * 3 + Math.floor(levelNumber / CHAPTER_SIZE)) % pool.length];
}

function tunedIceCount(value, factor, pattern, { layers = 1, precision = false } = {}) {
  let count = scaleCount(value, factor);
  if (pattern === "edges") count -= precision ? 4 : layers === 1 ? 3 : 2;
  if (pattern === "diagonal") {
    if (layers > 1) {
      count -= 3;
      if (factor >= 1.1) count -= 1;
    } else {
      count -= 1;
    }
  }
  return Math.max(2, count);
}

function lateIceCount(value, factor, pattern, { layers = 2 } = {}) {
  let count = tunedIceCount(value, factor, pattern, { layers });
  if (pattern === "edges") count -= 2;
  if (pattern === "diagonal") count -= 1;
  return Math.max(2, count);
}

const LATE_LEVEL_TUNING = Object.freeze({
  357: Object.freeze({ iceDelta: -2, pattern: "center" }),
  360: Object.freeze({ collectDelta: -2, iceDelta: -3, pattern: "center" }),
  414: Object.freeze({ pattern: "center" }),
  419: Object.freeze({ pattern: "center" }),
  444: Object.freeze({ moveDelta: 2, pattern: "center" }),
  445: Object.freeze({ moveDelta: 1, iceDelta: -2, pattern: "center" }),
  448: Object.freeze({ collectDelta: -1, iceDelta: -3, pattern: "center" }),
  449: Object.freeze({ moveDelta: 2, collectDelta: -2, iceDelta: -2, pattern: "center" }),
  565: Object.freeze({ moveDelta: 1, iceDelta: -2, pattern: "center" }),
  570: Object.freeze({ moveDelta: 1, iceDelta: -3, pattern: "center" }),
});

function lateLevelTuning(levelNumber) {
  return LATE_LEVEL_TUNING[levelNumber] || Object.freeze({});
}

function applyLateObjectiveTuning(levelNumber, levelObjective) {
  const tuning = lateLevelTuning(levelNumber);
  if (!tuning.collectDelta && !tuning.iceDelta && !tuning.pattern) return levelObjective;
  return objective({
    collect: (levelObjective?.collect || []).map((goal) => ({
      kind: goal.kind,
      count: Math.max(1, goal.count + Number(tuning.collectDelta || 0)),
    })),
    ice: levelObjective?.ice
      ? {
          ...levelObjective.ice,
          count: Math.max(2, levelObjective.ice.count + Number(tuning.iceDelta || 0)),
          pattern: tuning.pattern || levelObjective.ice.pattern,
        }
      : null,
    drop: levelObjective?.drop ? { ...levelObjective.drop } : null,
  });
}

function twoKinds(levelNumber, separation = 2) {
  const first = (levelNumber + Math.floor(levelNumber / CHAPTER_SIZE)) % TILE_KINDS;
  return [first, (first + separation) % TILE_KINDS];
}

function dropColumns(levelNumber, count, phase = 0) {
  const pools = Object.freeze({
    1: Object.freeze([[3], [4], [2], [5]]),
    2: Object.freeze([[2, 5], [1, 6], [0, 7], [3, 5]]),
    3: Object.freeze([[1, 3, 6], [0, 4, 7], [1, 4, 6], [0, 3, 7]]),
    4: Object.freeze([[0, 2, 5, 7], [1, 3, 4, 6], [0, 3, 5, 7], [1, 2, 5, 6]]),
  });
  const safeCount = Math.max(1, Math.min(4, Math.floor(Number(count) || 1)));
  const pool = pools[safeCount];
  return pool[(levelNumber + phase) % pool.length].slice();
}

function dropObjective(levelNumber, count, phase = 0) {
  const columns = dropColumns(levelNumber, count, phase);
  const baseRow = Math.max(3, 5 - Math.max(0, phase));
  const startRows = columns.map((_, index) => Math.min(5, baseRow + ((levelNumber + index) % 2)));
  return { count: columns.length, columns, startRows };
}

function chapterPosition(levelNumber, start) {
  const offset = levelNumber - start;
  return {
    offset,
    phase: Math.floor(offset / 10),
    within: offset % 10,
    wave: waveForLevel(levelNumber),
  };
}

function compoundGeometryMoveBonus(levelObjective, difficulty) {
  const ice = levelObjective?.ice;
  const collectGoals = levelObjective?.collect?.length || 0;
  if (!ice || ice.layers < 2 || collectGoals === 0) return 0;
  if (difficulty === "relief") return 1;
  if (difficulty === "normal" && (ice.pattern === "edges" || ice.pattern === "diagonal")) return 1;
  return 0;
}

function buildSpec({ levelNumber, start, chapter, baseTarget, targetStep, baseMoves, objectiveFactory = null }) {
  const position = chapterPosition(levelNumber, start);
  const authoredObjective = objectiveFactory ? objectiveFactory({ ...position, levelNumber }) : objective();
  const levelObjective = applyLateObjectiveTuning(levelNumber, authoredObjective);
  const tuning = lateLevelTuning(levelNumber);
  const hard = position.wave.difficulty === "hard" || position.wave.difficulty === "super-hard";
  return {
    target: roundedTarget((baseTarget + position.offset * targetStep) * position.wave.targetFactor),
    moves: Math.max(
      12,
      baseMoves
        + position.wave.moveDelta
        + compoundGeometryMoveBonus(levelObjective, position.wave.difficulty)
        + Number(tuning.moveDelta || 0),
    ),
    hard,
    difficulty: position.wave.difficulty,
    chapter,
    objective: levelObjective,
  };
}

function campaignSpec(levelNumber) {
  if (levelNumber <= 30) {
    return buildSpec({ levelNumber, start: 6, chapter: "special-mastery", baseTarget: 3200, targetStep: 180, baseMoves: 19 });
  }
  if (levelNumber <= 60) {
    return buildSpec({
      levelNumber, start: 31, chapter: "ice", baseTarget: 5200, targetStep: 90, baseMoves: 20,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = patternFor(levelNumber, phase);
        return objective({ ice: { count: tunedIceCount(6 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor, pattern), layers: 1, pattern } });
      },
    });
  }
  if (levelNumber <= 90) {
    return buildSpec({
      levelNumber, start: 61, chapter: "collection", baseTarget: 5800, targetStep: 100, baseMoves: 19,
      objectiveFactory: ({ phase, within, wave }) => objective({ collect: [{ kind: (levelNumber + phase) % TILE_KINDS, count: scaleCount(13 + phase * 3 + Math.floor(within / 2), wave.objectiveFactor) }] }),
    });
  }
  if (levelNumber <= 120) {
    return buildSpec({
      levelNumber, start: 91, chapter: "mixed", baseTarget: 6400, targetStep: 110, baseMoves: 20,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = patternFor(levelNumber, phase);
        return objective({
          collect: [{ kind: (levelNumber + phase + 1) % TILE_KINDS, count: scaleCount(9 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor) }],
          ice: { count: tunedIceCount(5 + phase + Math.floor(within / 4), wave.objectiveFactor, pattern), layers: 1, pattern },
        });
      },
    });
  }
  if (levelNumber <= 150) {
    return buildSpec({
      levelNumber, start: 121, chapter: "dual-collection", baseTarget: 7000, targetStep: 120, baseMoves: 19,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind, secondKind] = twoKinds(levelNumber, 3);
        const count = scaleCount(8 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor);
        return objective({ collect: [{ kind: firstKind, count }, { kind: secondKind, count }] });
      },
    });
  }
  if (levelNumber <= 180) {
    return buildSpec({
      levelNumber, start: 151, chapter: "layered-ice", baseTarget: 7600, targetStep: 125, baseMoves: 21,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = patternFor(levelNumber, phase);
        return objective({ ice: { count: tunedIceCount(4 + phase + Math.floor(within / 3), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern } });
      },
    });
  }
  if (levelNumber <= 210) {
    return buildSpec({
      levelNumber, start: 181, chapter: "layered-mix", baseTarget: 8200, targetStep: 130, baseMoves: 21,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = patternFor(levelNumber, phase);
        return objective({
          collect: [{ kind: (levelNumber + phase + 2) % TILE_KINDS, count: scaleCount(8 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor) }],
          ice: { count: tunedIceCount(3 + phase + Math.floor(within / 4), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern },
        });
      },
    });
  }
  if (levelNumber <= 240) {
    return buildSpec({
      levelNumber, start: 211, chapter: "precision", baseTarget: 8800, targetStep: 135, baseMoves: 20,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = patternFor(levelNumber, phase, true);
        return objective({
          collect: [{ kind: (levelNumber + 2) % TILE_KINDS, count: scaleCount(8 + phase + Math.floor(within / 4), wave.objectiveFactor) }],
          ice: { count: tunedIceCount(4 + phase + Math.floor(within / 3), wave.objectiveFactor, pattern, { layers: 2, precision: true }), layers: 2, pattern },
        });
      },
    });
  }
  if (levelNumber <= 270) {
    return buildSpec({
      levelNumber, start: 241, chapter: "heavy-remix", baseTarget: 9400, targetStep: 140, baseMoves: 21,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind, secondKind] = twoKinds(levelNumber, 2);
        const count = scaleCount(8 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor);
        const pattern = patternFor(levelNumber, phase);
        return objective({
          collect: [{ kind: firstKind, count }, { kind: secondKind, count }],
          ice: { count: tunedIceCount(4 + phase + Math.floor(within / 4), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern },
        });
      },
    });
  }
  if (levelNumber < 300) {
    return buildSpec({
      levelNumber, start: 271, chapter: "expert-remix", baseTarget: 10000, targetStep: 145, baseMoves: 22,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind, secondKind] = twoKinds(levelNumber, 2);
        const count = scaleCount(9 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor);
        const pattern = patternFor(levelNumber, phase);
        return objective({
          collect: [{ kind: firstKind, count }, { kind: secondKind, count }],
          ice: { count: tunedIceCount(5 + phase + Math.floor(within / 3), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern },
        });
      },
    });
  }
  if (levelNumber === 300) {
    const [firstKind, secondKind] = twoKinds(levelNumber, 2);
    return {
      target: 18000, moves: 24, hard: true, difficulty: "super-hard", chapter: "capstone",
      objective: objective({ collect: [{ kind: firstKind, count: 18 }, { kind: secondKind, count: 18 }], ice: { count: 10, layers: 2, pattern: "cross" } }),
    };
  }
  if (levelNumber <= 330) {
    return buildSpec({
      levelNumber, start: 301, chapter: "advanced-mastery", baseTarget: 11800, targetStep: 95, baseMoves: 24,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        const layers = phase === 0 ? 1 : 2;
        return objective({
          collect: [{ kind: (levelNumber + phase) % TILE_KINDS, count: scaleCount(8 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor) }],
          ice: { count: lateIceCount(4 + phase + Math.floor(within / 4), wave.objectiveFactor, pattern, { layers }), layers, pattern },
        });
      },
    });
  }
  if (levelNumber <= 360) {
    return buildSpec({
      levelNumber, start: 331, chapter: "ice-remix", baseTarget: 12600, targetStep: 100, baseMoves: 24,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        return objective({
          collect: [{ kind: (levelNumber + phase + 1) % TILE_KINDS, count: scaleCount(9 + phase + Math.floor(within / 4), wave.objectiveFactor) }],
          ice: { count: lateIceCount(5 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern },
        });
      },
    });
  }
  if (levelNumber <= 390) {
    return buildSpec({
      levelNumber, start: 361, chapter: "collection-remix", baseTarget: 13200, targetStep: 110, baseMoves: 23,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind, secondKind] = twoKinds(levelNumber, 3);
        const count = scaleCount(9 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor);
        return objective({ collect: [{ kind: firstKind, count }, { kind: secondKind, count }] });
      },
    });
  }
  if (levelNumber <= 420) {
    return buildSpec({
      levelNumber, start: 391, chapter: "advanced-mix", baseTarget: 13800, targetStep: 115, baseMoves: 25,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind, secondKind] = twoKinds(levelNumber, 2);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        const count = scaleCount(9 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor);
        return objective({
          collect: [{ kind: firstKind, count }, { kind: secondKind, count }],
          ice: { count: lateIceCount(4 + phase + Math.floor(within / 3), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern },
        });
      },
    });
  }
  if (levelNumber < 450) {
    return buildSpec({
      levelNumber, start: 421, chapter: "veteran-remix", baseTarget: 14600, targetStep: 120, baseMoves: 25,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind, secondKind] = twoKinds(levelNumber, 2);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        const count = scaleCount(10 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor);
        return objective({
          collect: [{ kind: firstKind, count }, { kind: secondKind, count }],
          ice: { count: lateIceCount(5 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern },
        });
      },
    });
  }
  if (levelNumber === 450) {
    const [firstKind, secondKind] = twoKinds(levelNumber, 2);
    return {
      target: 22000, moves: 26, hard: true, difficulty: "super-hard", chapter: "veteran-capstone",
      objective: objective({ collect: [{ kind: firstKind, count: 18 }, { kind: secondKind, count: 18 }], ice: { count: 9, layers: 2, pattern: "cross" } }),
    };
  }
  if (levelNumber <= 480) {
    return buildSpec({
      levelNumber, start: 451, chapter: "drop-intro", baseTarget: 15400, targetStep: 105, baseMoves: 27,
      objectiveFactory: ({ phase, within }) => {
        const count = 1 + (phase >= 1 ? 1 : 0) + (phase >= 2 && within >= 7 ? 1 : 0);
        return objective({ drop: dropObjective(levelNumber, count, phase) });
      },
    });
  }
  if (levelNumber <= 510) {
    return buildSpec({
      levelNumber, start: 481, chapter: "drop-ice", baseTarget: 16000, targetStep: 105, baseMoves: 29,
      objectiveFactory: ({ phase, within, wave }) => {
        const count = 2 + (phase >= 2 ? 1 : 0);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        return objective({
          drop: dropObjective(levelNumber, count, phase),
          ice: { count: lateIceCount(4 + phase + Math.floor(within / 4), wave.objectiveFactor, pattern, { layers: 1 }), layers: 1, pattern },
        });
      },
    });
  }
  if (levelNumber <= 540) {
    return buildSpec({
      levelNumber, start: 511, chapter: "drop-collection", baseTarget: 16600, targetStep: 110, baseMoves: 29,
      objectiveFactory: ({ phase, within, wave }) => {
        const count = 2 + (phase >= 2 ? 1 : 0);
        return objective({
          drop: dropObjective(levelNumber, count, phase),
          collect: [{
            kind: (levelNumber + phase) % TILE_KINDS,
            count: scaleCount(8 + phase * 2 + Math.floor(within / 3), wave.objectiveFactor),
          }],
        });
      },
    });
  }
  if (levelNumber <= 570) {
    return buildSpec({
      levelNumber, start: 541, chapter: "drop-layered", baseTarget: 17200, targetStep: 115, baseMoves: 30,
      objectiveFactory: ({ phase, within, wave }) => {
        const count = 2 + (phase >= 2 ? 1 : 0);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        return objective({
          drop: dropObjective(levelNumber, count, phase),
          ice: { count: lateIceCount(4 + phase + Math.floor(within / 4), wave.objectiveFactor, pattern, { layers: 2 }), layers: 2, pattern },
        });
      },
    });
  }
  return buildSpec({
    levelNumber, start: 571, chapter: "drop-mastery", baseTarget: 18000, targetStep: 120, baseMoves: 31,
    objectiveFactory: ({ phase, within, wave }) => {
      const [firstKind, secondKind] = twoKinds(levelNumber, 3);
      const count = 2 + (phase >= 1 ? 1 : 0);
      const collectCount = scaleCount(7 + phase + Math.floor(within / 4), wave.objectiveFactor);
      const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
      return objective({
        drop: dropObjective(levelNumber, count, phase),
        collect: [{ kind: firstKind, count: collectCount }, { kind: secondKind, count: collectCount }],
        ice: { count: lateIceCount(3 + phase + Math.floor(within / 5), wave.objectiveFactor, pattern, { layers: phase >= 2 ? 2 : 1 }), layers: phase >= 2 ? 2 : 1, pattern },
      });
    },
  });
}

function level(levelNumber, { target, moves, hard = false, difficulty = "normal", chapter = "onboarding", mechanics, objective: levelObjective } = {}) {
  return Object.freeze({ level: levelNumber, target: target ?? 1000, moves: moves ?? 20, hard, difficulty, chapter, mechanics: Object.freeze((mechanics ?? mechanicsForLevel(levelNumber)).slice()), objective: levelObjective ?? objective() });
}

const openingLevels = Object.freeze([
  level(1, { target: 1085, moves: 20, difficulty: "relief" }),
  level(2, { target: 1270, moves: 20 }),
  level(3, { target: 1455, moves: 20 }),
  level(4, { target: 1640, moves: 20 }),
  level(5, { target: 2375, moves: 20, hard: true, difficulty: "hard" }),
]);

export const CASCADE_LEVELS = Object.freeze([
  ...openingLevels,
  ...Array.from({ length: LEVEL_COUNT - openingLevels.length }, (_, index) => {
    const levelNumber = openingLevels.length + index + 1;
    return level(levelNumber, campaignSpec(levelNumber));
  }),
]);

export function createRng(seed) {
  let value = (Number(seed) >>> 0) || 1;
  return {
    next() { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; value >>>= 0; return value / 4294967296; },
    snapshot() { return value >>> 0; },
    clone() { return createRng(value >>> 0); },
  };
}

function randomKind(rng) { return Math.floor(rng.next() * TILE_KINDS); }
function wouldCreateImmediateMatch(candidate, index, board) {
  const row = Math.floor(index / BOARD_SIZE); const col = index % BOARD_SIZE;
  if (col >= 2 && board[index - 1] === candidate && board[index - 2] === candidate) return true;
  if (row >= 2 && board[index - BOARD_SIZE] === candidate && board[index - BOARD_SIZE * 2] === candidate) return true;
  return false;
}
export function adjacent(a, b) { const ar = Math.floor(a / BOARD_SIZE); const ac = a % BOARD_SIZE; const br = Math.floor(b / BOARD_SIZE); const bc = b % BOARD_SIZE; return Math.abs(ar - br) + Math.abs(ac - bc) === 1; }
export function swap(board, a, b) { [board[a], board[b]] = [board[b], board[a]]; return board; }

export function findMatchGroups(board) {
  const groups = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= BOARD_SIZE; col += 1) {
      const index = row * BOARD_SIZE + col; const startIndex = row * BOARD_SIZE + start; const kind = board[startIndex]; const same = col < BOARD_SIZE && kind !== null && board[index] === kind;
      if (same) continue;
      if (kind !== null && col - start >= 3) groups.push({ orientation: "row", kind, indices: Array.from({ length: col - start }, (_, offset) => row * BOARD_SIZE + start + offset) });
      start = col;
    }
  }
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= BOARD_SIZE; row += 1) {
      const index = row * BOARD_SIZE + col; const startIndex = start * BOARD_SIZE + col; const kind = board[startIndex]; const same = row < BOARD_SIZE && kind !== null && board[index] === kind;
      if (same) continue;
      if (kind !== null && row - start >= 3) groups.push({ orientation: "column", kind, indices: Array.from({ length: row - start }, (_, offset) => (start + offset) * BOARD_SIZE + col) });
      start = row;
    }
  }
  return groups;
}
export function findMatches(board) { const matched = new Set(); for (const group of findMatchGroups(board)) for (const index of group.indices) matched.add(index); return matched; }
export function listLegalMoves(board) {
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    const right = index % BOARD_SIZE < BOARD_SIZE - 1 ? index + 1 : -1; const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) { if (neighbor < 0) continue; swap(board, index, neighbor); const matched = findMatches(board).size; swap(board, index, neighbor); if (matched > 0) moves.push({ from: index, to: neighbor, matched }); }
  }
  return moves;
}
export function hasLegalMove(board) { return listLegalMoves(board).length > 0; }
function wouldCreateImmediateSquare(candidate, index, board) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  if (row < 1 || col < 1) return false;
  return board[index - 1] === candidate
    && board[index - BOARD_SIZE] === candidate
    && board[index - BOARD_SIZE - 1] === candidate;
}
export function createBoard({ rng, rules = {} }) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const next = [];
    for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) { let candidate = randomKind(rng); let guard = 0; while (
        (wouldCreateImmediateMatch(candidate, index, next) || (rules?.fish === true && wouldCreateImmediateSquare(candidate, index, next)))
        && guard < 20
      ) { candidate = randomKind(rng); guard += 1; } next.push(candidate); }
    if (hasLegalMove(next)) return next;
  }
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => randomKind(rng));
}
export function collapseBoard(board, rng) {
  const next = board.slice(); const falls = []; const spawns = [];
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const kept = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) { const from = row * BOARD_SIZE + col; const kind = next[from]; if (kind !== null) kept.push({ from, kind }); }
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) { const to = row * BOARD_SIZE + col; const offset = BOARD_SIZE - 1 - row; const existing = kept[offset]; if (existing) { next[to] = existing.kind; if (existing.from !== to) falls.push({ from: existing.from, to, kind: existing.kind }); } else { const kind = randomKind(rng); next[to] = kind; spawns.push({ to, kind, spawnOffset: offset - kept.length + 1 }); } }
  }
  return { board: next, falls, spawns };
}
function hasMechanic(mechanics, mechanic) { return mechanics.includes(mechanic); }
function areaAround(index, radius = 1) { const centerRow = Math.floor(index / BOARD_SIZE); const centerCol = index % BOARD_SIZE; const area = []; for (let row = Math.max(0, centerRow - radius); row <= Math.min(BOARD_SIZE - 1, centerRow + radius); row += 1) for (let col = Math.max(0, centerCol - radius); col <= Math.min(BOARD_SIZE - 1, centerCol + radius); col += 1) area.push(row * BOARD_SIZE + col); return area; }
function expandPowerMatches(board, groups, mechanics = []) {
  const clearSet = new Set(); const powerClears = []; const colorSweeps = []; const crossBlasts = [];
  for (const group of groups) {
    for (const index of group.indices) clearSet.add(index);
    if (group.indices.length >= 5 && hasMechanic(mechanics, "color-sweep")) { const swept = []; for (let index = 0; index < board.length; index += 1) if (board[index] === group.kind) { clearSet.add(index); swept.push(index); } colorSweeps.push({ kind: group.kind, source: group.indices.slice(), cleared: swept }); continue; }
    if (group.indices.length === 4 && hasMechanic(mechanics, "power-match")) { const anchor = group.indices[Math.floor(group.indices.length / 2)]; const row = Math.floor(anchor / BOARD_SIZE); const col = anchor % BOARD_SIZE; const blast = group.orientation === "row" ? Array.from({ length: BOARD_SIZE }, (_, offset) => row * BOARD_SIZE + offset) : Array.from({ length: BOARD_SIZE }, (_, offset) => offset * BOARD_SIZE + col); blast.forEach((index) => clearSet.add(index)); powerClears.push({ orientation: group.orientation, source: group.indices.slice(), cleared: blast }); }
  }
  if (hasMechanic(mechanics, "cross-blast")) { const rows = groups.filter((group) => group.orientation === "row"); const columns = groups.filter((group) => group.orientation === "column"); const seen = new Set(); for (const rowGroup of rows) for (const columnGroup of columns) { const intersection = rowGroup.indices.find((index) => columnGroup.indices.includes(index)); if (intersection === undefined || seen.has(intersection)) continue; seen.add(intersection); const blast = areaAround(intersection, 1); blast.forEach((index) => clearSet.add(index)); crossBlasts.push({ source: intersection, cleared: blast }); } }
  return { clearSet, powerClears, colorSweeps, crossBlasts };
}
function normalizeIce(ice) { if (!Array.isArray(ice)) return Array(BOARD_SIZE * BOARD_SIZE).fill(0); return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => Math.max(0, Math.floor(Number(ice[index]) || 0))); }
function patternScore(pattern, row, col) { const edge = Math.min(row, col, BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col); const centerDistance = Math.abs(row - 3.5) + Math.abs(col - 3.5); if (pattern === "center") return centerDistance; if (pattern === "edges") return edge; if (pattern === "diagonal") return Math.min(Math.abs(row - col), Math.abs(row + col - (BOARD_SIZE - 1))); if (pattern === "cross") return Math.min(Math.abs(row - 3.5), Math.abs(col - 3.5)); if (pattern === "columns") return Math.abs(col - 3.5) + ((row % 2) * 0.1); return ((row + col) % 2) + (centerDistance * 0.01); }
export function createIceBoard(levelDefinition) { const spec = levelDefinition?.objective?.ice; const ice = Array(BOARD_SIZE * BOARD_SIZE).fill(0); if (!spec?.count) return ice; const count = Math.min(BOARD_SIZE * BOARD_SIZE, Math.max(0, Math.floor(spec.count))); const layers = Math.max(1, Math.floor(spec.layers || 1)); const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => { const row = Math.floor(index / BOARD_SIZE); const col = index % BOARD_SIZE; return { index, score: patternScore(spec.pattern, row, col) }; }); cells.sort((a, b) => a.score - b.score || ((a.index * 17 + levelDefinition.level * 13) % 67) - ((b.index * 17 + levelDefinition.level * 13) % 67)); for (const cell of cells.slice(0, count)) ice[cell.index] = layers; return ice; }
function chipIce(ice, indices) { const before = normalizeIce(ice); const after = before.slice(); const hits = []; for (const index of indices) { if (after[index] <= 0) continue; const previous = after[index]; after[index] = Math.max(0, previous - 1); hits.push({ index, before: previous, after: after[index] }); } return { before, after, hits }; }
function kindCounts(board, indices) { const counts = Array(TILE_KINDS).fill(0); for (const index of indices) { const kind = board[index]; if (Number.isInteger(kind) && kind >= 0 && kind < TILE_KINDS) counts[kind] += 1; } return counts; }
function addKindCounts(target, source) { for (let kind = 0; kind < TILE_KINDS; kind += 1) target[kind] += Number(source?.[kind] || 0); return target; }
export function resolveCascades(board, rng, { startingCascade = 1, mechanics = [], ice = [] } = {}) {
  let current = board.slice(); let currentIce = normalizeIce(ice); let cascade = startingCascade; let scoreGained = 0; const transitions = []; let powerClearCount = 0; let colorSweepCount = 0; let crossBlastCount = 0; let iceHitCount = 0; const clearedKindCounts = Array(TILE_KINDS).fill(0);
  while (true) {
    const groups = findMatchGroups(current); if (!groups.length) break; const originalMatched = new Set(); for (const group of groups) for (const index of group.indices) originalMatched.add(index); const expanded = expandPowerMatches(current, groups, mechanics); const matched = [...expanded.clearSet].sort((a, b) => a - b); const before = current.slice(); const cleared = current.slice(); const transitionKindCounts = kindCounts(before, matched); addKindCounts(clearedKindCounts, transitionKindCounts); const chipped = chipIce(currentIce, matched); currentIce = chipped.after; for (const index of matched) cleared[index] = null; const gained = matched.length * 80 * cascade; scoreGained += gained; powerClearCount += expanded.powerClears.length; colorSweepCount += expanded.colorSweeps.length; crossBlastCount += expanded.crossBlasts.length; iceHitCount += chipped.hits.length; const collapsed = collapseBoard(cleared, rng); transitions.push({ type: "cascade", cascade, matchIndices: [...originalMatched].sort((a, b) => a - b), matched, gained, before, cleared, after: collapsed.board.slice(), falls: collapsed.falls, spawns: collapsed.spawns, powerClears: expanded.powerClears, colorSweeps: expanded.colorSweeps, crossBlasts: expanded.crossBlasts, clearedKindCounts: transitionKindCounts, iceBefore: chipped.before, iceAfter: chipped.after, iceHits: chipped.hits }); current = collapsed.board; cascade += 1;
  }
  let shuffled = false; let shuffle = null; if (!hasLegalMove(current)) { const before = current.slice(); current = createBoard({ rng }); shuffled = true; shuffle = { type: "shuffle", before, after: current.slice() }; }
  return { board: current, ice: currentIce, scoreGained, transitions, powerClearCount, colorSweepCount, crossBlastCount, iceHitCount, clearedKindCounts, shuffled, shuffle, maxCascade: transitions.length ? transitions.at(-1).cascade : 0 };
}
export function applySwap(board, from, to, rng, options = {}) { if (!adjacent(from, to)) return { legal: false, reason: "not_adjacent", board: board.slice(), ice: normalizeIce(options.ice), scoreGained: 0, transitions: [] }; const swapped = board.slice(); swap(swapped, from, to); if (!findMatches(swapped).size) return { legal: false, reason: "no_match", board: board.slice(), ice: normalizeIce(options.ice), swapped, scoreGained: 0, transitions: [] }; const resolved = resolveCascades(swapped, rng, options); return { legal: true, from, to, swapped, ...resolved }; }
export function applyHammer(board, index, rng, options = {}) { if (index < 0 || index >= board.length) return { legal: false, reason: "invalid_index", board: board.slice(), ice: normalizeIce(options.ice), scoreGained: 0, transitions: [] }; const cleared = board.slice(); const directKindCounts = kindCounts(board, [index]); const chipped = chipIce(options.ice, [index]); cleared[index] = null; const collapsed = collapseBoard(cleared, rng); const resolved = resolveCascades(collapsed.board, rng, { ...options, ice: chipped.after }); const totalKindCounts = directKindCounts.slice(); addKindCounts(totalKindCounts, resolved.clearedKindCounts); return { legal: true, index, hammer: { type: "hammer", index, before: board.slice(), cleared, after: collapsed.board.slice(), falls: collapsed.falls, spawns: collapsed.spawns, clearedKindCounts: directKindCounts, iceBefore: chipped.before, iceAfter: chipped.after, iceHits: chipped.hits }, ...resolved, iceHitCount: resolved.iceHitCount + chipped.hits.length, clearedKindCounts: totalKindCounts }; }
function createDropProgress(levelDefinition) {
  const spec = levelDefinition?.objective?.drop;
  if (!spec?.count) return { delivered: 0, total: 0, tokens: [], exits: [] };
  const columns = [...new Set((spec.columns || []).filter((col) => Number.isInteger(col) && col >= 0 && col < BOARD_SIZE))];
  const total = Math.min(Math.max(1, Number(spec.count) || 1), columns.length);
  const startRows = spec.startRows || [];
  const tokens = columns.slice(0, total).map((column, id) => {
    const row = Math.max(0, Math.min(BOARD_SIZE - 2, Math.floor(Number(startRows[id]) || 0)));
    return { id, index: row * BOARD_SIZE + column, exit: (BOARD_SIZE - 1) * BOARD_SIZE + column };
  });
  return { delivered: 0, total: tokens.length, tokens, exits: tokens.map((token) => token.exit) };
}

function normalizeDropProgress(levelDefinition, value) {
  const baseline = createDropProgress(levelDefinition);
  if (!baseline.total) return baseline;
  if (!value || !Array.isArray(value.tokens)) return baseline;
  const delivered = Math.max(0, Math.min(baseline.total, Math.floor(Number(value.delivered) || 0)));
  const baselineById = new Map(baseline.tokens.map((token) => [token.id, token]));
  const tokens = value.tokens.flatMap((token) => {
    const id = Math.floor(Number(token?.id));
    const authored = baselineById.get(id);
    const index = Math.floor(Number(token?.index));
    if (!authored || !Number.isInteger(index) || index < 0 || index >= BOARD_SIZE * BOARD_SIZE) return [];
    if (index % BOARD_SIZE !== authored.exit % BOARD_SIZE) return [];
    return [{ id, index, exit: authored.exit }];
  });
  return {
    delivered: Math.min(baseline.total, Math.max(delivered, baseline.total - tokens.length)),
    total: baseline.total,
    tokens,
    exits: baseline.exits.slice(),
  };
}

function dropStepProgress(drop, step) {
  if (!drop?.tokens?.length || !step?.cleared) return drop;
  let delivered = drop.delivered;
  const tokens = [];
  for (const token of drop.tokens) {
    const row = Math.floor(token.index / BOARD_SIZE);
    const col = token.index % BOARD_SIZE;
    let clearedBelow = 0;
    for (let belowRow = row + 1; belowRow < BOARD_SIZE; belowRow += 1) {
      const index = belowRow * BOARD_SIZE + col;
      if (step.before?.[index] !== null && step.cleared?.[index] === null) clearedBelow += 1;
    }
    const nextRow = Math.min(BOARD_SIZE - 1, row + clearedBelow);
    const nextIndex = nextRow * BOARD_SIZE + col;
    if (nextIndex === token.exit) delivered += 1;
    else tokens.push({ ...token, index: nextIndex });
  }
  return { delivered: Math.min(drop.total, delivered), total: drop.total, tokens, exits: drop.exits.slice() };
}

export function dropSupportIndices(progress) {
  return [...new Set((progress?.drop?.tokens || []).flatMap((token) => {
    const row = Math.floor(Number(token.index) / BOARD_SIZE);
    if (!Number.isInteger(row) || row >= BOARD_SIZE - 1) return [];
    return [Number(token.index) + BOARD_SIZE];
  }))];
}

export function createLevelProgress(levelDefinition) {
  return { collected: Array(TILE_KINDS).fill(0), ice: createIceBoard(levelDefinition), drop: createDropProgress(levelDefinition) };
}

export function applyLevelProgress(levelDefinition, progress, result) {
  const next = {
    collected: Array.from({ length: TILE_KINDS }, (_, kind) => Math.max(0, Number(progress?.collected?.[kind]) || 0)),
    ice: normalizeIce(result?.iceAfter ?? result?.ice ?? progress?.ice),
    drop: normalizeDropProgress(levelDefinition, progress?.drop),
  };
  addKindCounts(next.collected, result?.clearedKindCounts);
  const steps = Array.isArray(result?.transitions) ? result.transitions : result?.cleared ? [result] : [];
  if (result?.hammer?.cleared) next.drop = dropStepProgress(next.drop, result.hammer);
  for (const step of steps) next.drop = dropStepProgress(next.drop, step);
  return next;
}

export function objectiveComplete(levelDefinition, progress, score) {
  if (Number(score) < Number(levelDefinition.target || 0)) return false;
  for (const goal of levelDefinition.objective?.collect || []) if ((progress?.collected?.[goal.kind] || 0) < goal.count) return false;
  if (levelDefinition.objective?.ice && (progress?.ice || []).some((layers) => layers > 0)) return false;
  if (levelDefinition.objective?.drop && Number(progress?.drop?.delivered || 0) < Number(levelDefinition.objective.drop.count || 0)) return false;
  return true;
}

export function objectiveRemaining(levelDefinition, progress, score) {
  const remaining = [];
  const scoreLeft = Math.max(0, Number(levelDefinition.target || 0) - Number(score || 0));
  if (scoreLeft > 0) remaining.push({ type: "score", count: scoreLeft });
  for (const goal of levelDefinition.objective?.collect || []) {
    const count = Math.max(0, goal.count - Number(progress?.collected?.[goal.kind] || 0));
    if (count > 0) remaining.push({ type: "collect", kind: goal.kind, count });
  }
  if (levelDefinition.objective?.ice) {
    const count = (progress?.ice || []).reduce((sum, layers) => sum + Math.max(0, Number(layers) || 0), 0);
    if (count > 0) remaining.push({ type: "ice", count });
  }
  if (levelDefinition.objective?.drop) {
    const count = Math.max(0, Number(levelDefinition.objective.drop.count || 0) - Number(progress?.drop?.delivered || 0));
    if (count > 0) remaining.push({ type: "drop", count });
  }
  return remaining;
}

export function describeLevelObjective(levelDefinition, progress, score = 0) {
  const parts = [`${Math.min(Number(score) || 0, levelDefinition.target).toLocaleString()}/${levelDefinition.target.toLocaleString()} pts`];
  for (const goal of levelDefinition.objective?.collect || []) {
    const current = Math.min(goal.count, Number(progress?.collected?.[goal.kind] || 0));
    parts.push(`${TILE_LABELS[goal.kind]} ${current}/${goal.count}`);
  }
  if (levelDefinition.objective?.ice) {
    const remaining = (progress?.ice || []).reduce((sum, layers) => sum + Math.max(0, Number(layers) || 0), 0);
    parts.push(`ice ${remaining} left`);
  }
  if (levelDefinition.objective?.drop) {
    const delivered = Math.min(Number(levelDefinition.objective.drop.count || 0), Number(progress?.drop?.delivered || 0));
    parts.push(`drops ${delivered}/${levelDefinition.objective.drop.count}`);
  }
  return parts.join(" · ");
}
