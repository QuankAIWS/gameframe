export const BOARD_SIZE = 8;
export const TILE_KINDS = 6;
export const LEVEL_COUNT = 1000;
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
  if (levelNumber >= 651) mechanics.push("locks");
  if (levelNumber >= 701) mechanics.push("recall-locks");
  if (levelNumber >= 751) mechanics.push("memory-blooms");
  if (levelNumber >= 801) mechanics.push("enchanted-ground");
  if (levelNumber >= 901) mechanics.push("producers");
  if (levelNumber >= 951) mechanics.push("color-wards");
  return mechanics;
}

function collectGoal(kind, count) {
  return Object.freeze({ kind, count });
}

function objective({ collect = [], ice = null, drop = null, locks = null, blooms = null, ground = null, producers = null, colorWards = null } = {}) {
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
    locks: locks
      ? Object.freeze({
          count: Math.max(1, Math.floor(Number(locks.count) || 1)),
          layers: Math.max(1, Math.min(2, Math.floor(Number(locks.layers) || 1))),
          pattern: String(locks.pattern || "center"),
          recall: locks.recall === true,
        })
      : null,
    blooms: blooms
      ? Object.freeze({
          pairs: Math.max(1, Math.min(4, Math.floor(Number(blooms.pairs) || 2))),
          pattern: String(blooms.pattern || "center"),
        })
      : null,
    ground: ground
      ? Object.freeze({
          target: Math.max(4, Math.min(BOARD_SIZE * BOARD_SIZE, Math.floor(Number(ground.target) || 16))),
          seeds: Math.max(1, Math.min(8, Math.floor(Number(ground.seeds) || 3))),
          pattern: String(ground.pattern || "center"),
        })
      : null,
    producers: producers
      ? Object.freeze({
          count: Math.max(1, Math.min(8, Math.floor(Number(producers.count) || 3))),
          charges: Math.max(1, Math.min(4, Math.floor(Number(producers.charges) || 2))),
          pattern: String(producers.pattern || "center"),
        })
      : null,
    colorWards: colorWards
      ? Object.freeze({
          count: Math.max(1, Math.min(10, Math.floor(Number(colorWards.count) || 4))),
          pattern: String(colorWards.pattern || "center"),
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
  606: Object.freeze({ moveDelta: 2 }),
  611: Object.freeze({ moveDelta: 2, pattern: "center" }),
  621: Object.freeze({ moveDelta: 2 }),
  623: Object.freeze({ moveDelta: 1, pattern: "center" }),
  629: Object.freeze({ moveDelta: 1, pattern: "center" }),
  641: Object.freeze({ moveDelta: 1 }),
  648: Object.freeze({ moveDelta: 1 }),
  697: Object.freeze({ collectDelta: -1, lockDelta: -1 }),
  700: Object.freeze({ moveDelta: 1 }),
  713: Object.freeze({ lockPattern: "center" }),
  718: Object.freeze({ lockDelta: -1, lockPattern: "center" }),
  723: Object.freeze({ lockDelta: -1, lockPattern: "center" }),
  724: Object.freeze({ lockPattern: "center" }),
  729: Object.freeze({ lockDelta: -1, lockPattern: "center" }),
  734: Object.freeze({ lockPattern: "center" }),
  742: Object.freeze({ collectDelta: -1, lockPattern: "center" }),
  745: Object.freeze({ moveDelta: 1, lockPattern: "center" }),
  747: Object.freeze({ moveDelta: 1, collectDelta: -2, lockDelta: -1, lockPattern: "center" }),
  886: Object.freeze({ moveDelta: 1 }),
  887: Object.freeze({ moveDelta: -2 }),
  888: Object.freeze({ moveDelta: -2 }),
  889: Object.freeze({ moveDelta: 2, lockDelta: -1 }),
  890: Object.freeze({ moveDelta: -2 }),
  891: Object.freeze({ moveDelta: -1 }),
  892: Object.freeze({ moveDelta: 1 }),
  894: Object.freeze({ moveDelta: -2 }),
  895: Object.freeze({ moveDelta: 1 }),
  897: Object.freeze({ moveDelta: -2 }),
  899: Object.freeze({ moveDelta: 1, lockDelta: -1 }),
  900: Object.freeze({ moveDelta: -1 }),
});

function lateLevelTuning(levelNumber) {
  return LATE_LEVEL_TUNING[levelNumber] || Object.freeze({});
}

function applyLateObjectiveTuning(levelNumber, levelObjective) {
  const tuning = lateLevelTuning(levelNumber);
  if (!tuning.collectDelta && !tuning.iceDelta && !tuning.pattern && !tuning.lockDelta && !tuning.lockPattern) return levelObjective;
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
    locks: levelObjective?.locks
      ? {
          ...levelObjective.locks,
          count: Math.max(1, levelObjective.locks.count + Number(tuning.lockDelta || 0)),
          pattern: tuning.lockPattern || levelObjective.locks.pattern,
        }
      : null,
    blooms: levelObjective?.blooms ? { ...levelObjective.blooms } : null,
    ground: levelObjective?.ground ? { ...levelObjective.ground } : null,
    producers: levelObjective?.producers ? { ...levelObjective.producers } : null,
    colorWards: levelObjective?.colorWards ? { ...levelObjective.colorWards } : null,
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
  let bonus = 0;
  if (ice && ice.layers >= 2 && collectGoals > 0) {
    if (difficulty === "relief") bonus += 1;
    if (difficulty === "normal" && (ice.pattern === "edges" || ice.pattern === "diagonal")) bonus += 1;
  }
  const memoryHeavy = levelObjective?.locks?.recall || levelObjective?.blooms;
  if (levelObjective?.locks?.recall) {
    if (difficulty === "relief") bonus += 2;
    else if (difficulty === "normal") bonus += 1;
  } else if (levelObjective?.locks && difficulty === "relief") {
    bonus += 1;
  }
  if (levelObjective?.blooms) {
    if (difficulty === "relief") bonus += 2;
    else if (difficulty === "normal") bonus += 1;
  }
  // Do not stack an extra Ground move subsidy on top of a memory subsidy.
  if (levelObjective?.ground && !memoryHeavy && difficulty === "relief") bonus += 1;
  if (levelObjective?.producers && difficulty === "relief") bonus += 1;
  if (levelObjective?.colorWards && difficulty === "relief") bonus += 1;
  return bonus;
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
  if (levelNumber <= 600) {
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
  if (levelNumber <= 630) {
    return buildSpec({
      levelNumber, start: 601, chapter: "drop-precision-mastery", baseTarget: 18600, targetStep: 105, baseMoves: 34,
      objectiveFactory: ({ phase, within, wave }) => {
        const count = 3 + (phase >= 2 ? 1 : 0);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        return objective({
          drop: dropObjective(levelNumber, count, phase + 1),
          ice: { count: lateIceCount(3 + phase + Math.floor(within / 5), wave.objectiveFactor, pattern, { layers: 1 }), layers: 1, pattern },
        });
      },
    });
  }
  if (levelNumber <= 650) {
    return buildSpec({
      levelNumber, start: 631, chapter: "drop-capstone", baseTarget: 19200, targetStep: 110, baseMoves: 35,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind, secondKind] = twoKinds(levelNumber, 2);
        const collectCount = scaleCount(6 + phase + Math.floor(within / 5), wave.objectiveFactor);
        return objective({
          drop: dropObjective(levelNumber, 3 + (within >= 7 ? 1 : 0), phase + 1),
          collect: [{ kind: firstKind, count: collectCount }, { kind: secondKind, count: collectCount }],
        });
      },
    });
  }
  if (levelNumber <= 680) {
    return buildSpec({
      levelNumber, start: 651, chapter: "lock-intro", baseTarget: 18800, targetStep: 95, baseMoves: 33,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        return objective({
          locks: { count: scaleCount(4 + phase * 2 + Math.floor(within / 4), wave.objectiveFactor), layers: 1, pattern },
        });
      },
    });
  }
  if (levelNumber <= 700) {
    return buildSpec({
      levelNumber, start: 681, chapter: "lock-mix", baseTarget: 19400, targetStep: 100, baseMoves: 34,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind] = twoKinds(levelNumber, 3);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        const masteredPressure = wave.difficulty === "relief" || wave.difficulty === "normal" ? 1 : 0;
        return objective({
          locks: { count: scaleCount(6 + phase + Math.floor(within / 4) + masteredPressure, wave.objectiveFactor), layers: phase >= 1 ? 2 : 1, pattern },
          collect: [{ kind: firstKind, count: scaleCount(7 + phase + Math.floor(within / 5), wave.objectiveFactor) }],
          drop: within >= 5 ? dropObjective(levelNumber, 2, phase) : null,
        });
      },
    });
  }
  if (levelNumber <= 730) {
    return buildSpec({
      levelNumber, start: 701, chapter: "recall-lock-intro", baseTarget: 19000, targetStep: 90, baseMoves: 37,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        const firstTeachingWave = phase === 0;
        const pressureBeat = wave.difficulty === "hard" || wave.difficulty === "super-hard";
        const isRecall = !(firstTeachingWave && pressureBeat);
        const recallCount = wave.difficulty === "relief"
          ? 2
          : phase === 0
            ? 2
            : phase === 1
              ? (within >= 5 ? 3 : 2)
              : 3;
        return objective({
          locks: {
            count: isRecall ? recallCount : 5,
            layers: 1,
            pattern,
            recall: isRecall,
          },
        });
      },
    });
  }
  if (levelNumber <= 750) {
    return buildSpec({
      levelNumber, start: 731, chapter: "recall-lock-mix", baseTarget: 19600, targetStep: 95, baseMoves: 38,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind] = twoKinds(levelNumber, 2);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        return objective({
          locks: { count: wave.difficulty === "relief" ? 2 : phase === 0 ? 2 : 3, layers: 1, pattern, recall: true },
          collect: [{ kind: firstKind, count: scaleCount(5 + phase + Math.floor(within / 6), Math.min(1, wave.objectiveFactor)) }],
          drop: phase >= 1 && within >= 7 ? dropObjective(levelNumber, 1, phase) : null,
        });
      },
    });
  }
  if (levelNumber <= 780) {
    return buildSpec({
      levelNumber, start: 751, chapter: "memory-bloom-intro", baseTarget: 20200, targetStep: 100, baseMoves: 33,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        const firstTeachingWave = phase === 0;
        const pressureBeat = wave.difficulty === "hard" || wave.difficulty === "super-hard";
        if (firstTeachingWave && pressureBeat) {
          return objective({ locks: { count: 5 + (within >= 9 ? 1 : 0), layers: 1, pattern, recall: false } });
        }
        const pairs = wave.difficulty === "relief" ? 2 : phase >= 2 ? 3 : (phase === 1 && within >= 6 ? 3 : 2);
        return objective({ blooms: { pairs, pattern } });
      },
    });
  }
  if (levelNumber <= 800) {
    return buildSpec({
      levelNumber, start: 781, chapter: "memory-bloom-mix", baseTarget: 20800, targetStep: 100, baseMoves: 35,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind] = twoKinds(levelNumber, 2);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        return objective({
          blooms: { pairs: wave.difficulty === "relief" ? 2 : 3, pattern },
          collect: [{ kind: firstKind, count: scaleCount(4 + phase + Math.floor(within / 6), Math.min(1, wave.objectiveFactor)) }],
        });
      },
    });
  }
  if (levelNumber <= 830) {
    return buildSpec({
      levelNumber, start: 801, chapter: "enchanted-ground-intro", baseTarget: 21000, targetStep: 100, baseMoves: 34,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        const firstTeachingWave = phase === 0;
        const pressureBeat = wave.difficulty === "hard" || wave.difficulty === "super-hard";
        if (firstTeachingWave && pressureBeat) {
          return objective({ locks: { count: 6, layers: 1, pattern, recall: false } });
        }
        return objective({
          ground: {
            target: scaleCount(18 + phase * 4 + Math.floor(within / 3), wave.objectiveFactor),
            seeds: 3 + (phase >= 2 ? 1 : 0),
            pattern,
          },
        });
      },
    });
  }
  if (levelNumber <= 850) {
    return buildSpec({
      levelNumber, start: 831, chapter: "enchanted-ground-mix", baseTarget: 21600, targetStep: 105, baseMoves: 35,
      objectiveFactory: ({ phase, within, wave }) => {
        const [firstKind] = twoKinds(levelNumber, 3);
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        return objective({
          ground: {
            target: scaleCount(24 + phase * 4 + Math.floor(within / 3), wave.objectiveFactor),
            seeds: 3 + (phase >= 1 ? 1 : 0),
            pattern,
          },
          collect: [{ kind: firstKind, count: scaleCount(5 + phase + Math.floor(within / 6), Math.min(1, wave.objectiveFactor)) }],
        });
      },
    });
  }
  if (levelNumber <= 870) {
    return buildSpec({
      levelNumber, start: 851, chapter: "bloom-ground-remix", baseTarget: 22000, targetStep: 105, baseMoves: 35,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        return objective({
          blooms: { pairs: wave.difficulty === "relief" ? 2 : 3, pattern },
          ground: {
            target: scaleCount(21 + phase * 3 + Math.floor(within / 4), wave.objectiveFactor),
            seeds: 3 + (phase >= 1 ? 1 : 0),
            pattern,
          },
        });
      },
    });
  }
  if (levelNumber <= 885) {
    return buildSpec({
      levelNumber, start: 871, chapter: "ground-route-remix", baseTarget: 22400, targetStep: 110, baseMoves: 35,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        return objective({
          ground: {
            target: scaleCount(24 + phase * 3 + Math.floor(within / 4), wave.objectiveFactor),
            seeds: 4,
            pattern,
          },
          locks: { count: scaleCount(4 + phase + Math.floor(within / 5), Math.min(1, wave.objectiveFactor)), layers: 1, pattern, recall: false },
          drop: within >= 7 ? dropObjective(levelNumber, 1, phase) : null,
        });
      },
    });
  }
  if (levelNumber <= 900) {
    return buildSpec({
      levelNumber, start: 886, chapter: "cognitive-spatial-remix", baseTarget: 23000, targetStep: 115, baseMoves: 39,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        const useRecall = within % 3 === 0;
        return objective({
          ground: {
            target: scaleCount(22 + phase * 3 + Math.floor(within / 4), wave.objectiveFactor),
            seeds: 4,
            pattern,
          },
          blooms: useRecall ? null : { pairs: wave.difficulty === "relief" ? 2 : 3, pattern },
          locks: useRecall ? { count: wave.difficulty === "relief" ? 2 : 3, layers: 1, pattern, recall: true } : null,
        });
      },
    });
  }
  if (levelNumber <= 930) {
    return buildSpec({
      levelNumber, start: 901, chapter: "producer-intro", baseTarget: 23500, targetStep: 115, baseMoves: 37,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        const firstTeachingWave = phase === 0;
        const pressureBeat = wave.difficulty === "hard" || wave.difficulty === "super-hard";
        if (firstTeachingWave && pressureBeat) {
          return objective({
            ground: {
              target: scaleCount(24 + Math.floor(within / 3), wave.objectiveFactor),
              seeds: 4,
              pattern,
            },
          });
        }
        return objective({
          producers: {
            count: wave.difficulty === "relief" ? 2 : 3,
            charges: 1,
            pattern,
          },
        });
      },
    });
  }
  if (levelNumber <= 950) {
    return buildSpec({
      levelNumber, start: 931, chapter: "producer-routing", baseTarget: 24200, targetStep: 120, baseMoves: 40,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = latePatternFor(levelNumber, phase, wave.difficulty);
        const routeDrops = within >= 5 && within % 2 === 1;
        return objective({
          producers: {
            count: wave.difficulty === "relief" ? 2 : 3,
            charges: wave.difficulty === "super-hard" ? 2 : 1,
            pattern,
          },
          locks: routeDrops ? null : {
            count: scaleCount(3 + phase + Math.floor(within / 6), Math.min(1, wave.objectiveFactor)),
            layers: 1,
            pattern,
            recall: false,
          },
          drop: routeDrops ? dropObjective(levelNumber, wave.difficulty === "super-hard" ? 2 : 1, phase) : null,
        });
      },
    });
  }
  if (levelNumber <= 980) {
    return buildSpec({
      levelNumber, start: 951, chapter: "color-ward-intro", baseTarget: 24800, targetStep: 120, baseMoves: 36,
      objectiveFactory: ({ phase, within, wave }) => {
        const pattern = (wave.difficulty === "relief" || wave.difficulty === "normal")
          ? "center"
          : latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
        const firstTeachingWave = phase === 0;
        const pressureBeat = wave.difficulty === "hard" || wave.difficulty === "super-hard";
        if (firstTeachingWave && pressureBeat) {
          return objective({
            producers: {
              count: 2,
              charges: 1,
              pattern,
            },
          });
        }
        return objective({
          colorWards: {
            count: wave.difficulty === "relief" ? 2 : (wave.difficulty === "super-hard" ? 4 : 3),
            pattern,
          },
        });
      },
    });
  }
  return buildSpec({
    levelNumber, start: 981, chapter: "attention-remix", baseTarget: 25500, targetStep: 125, baseMoves: 39,
    objectiveFactory: ({ phase, within, wave }) => {
      const pattern = (wave.difficulty === "relief" || wave.difficulty === "normal")
        ? "center"
        : latePatternFor(levelNumber, phase, wave.difficulty === "super-hard" ? "normal" : wave.difficulty);
      const useRecall = within % 4 === 0 && wave.difficulty !== "super-hard" && wave.difficulty !== "hard";
      const useProducer = levelNumber === 1000 || within % 3 === 1;
      return objective({
        colorWards: {
          count: wave.difficulty === "relief" ? 2 : (wave.difficulty === "normal" ? 3 : 4),
          pattern,
        },
        producers: useProducer ? {
          count: 2,
          charges: 1,
          pattern,
        } : null,
        locks: useRecall ? {
          count: 2,
          layers: 1,
          pattern,
          recall: true,
        } : null,
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

export function findMatchGroups(board, locked = []) {
  const groups = [];
  const blocked = (index) => Math.max(0, Number(locked?.[index]) || 0) > 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= BOARD_SIZE; col += 1) {
      const index = row * BOARD_SIZE + col; const startIndex = row * BOARD_SIZE + start; const kind = blocked(startIndex) ? null : board[startIndex]; const same = col < BOARD_SIZE && !blocked(index) && kind !== null && board[index] === kind;
      if (same) continue;
      if (kind !== null && col - start >= 3) groups.push({ orientation: "row", kind, indices: Array.from({ length: col - start }, (_, offset) => row * BOARD_SIZE + start + offset) });
      start = col;
    }
  }
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= BOARD_SIZE; row += 1) {
      const index = row * BOARD_SIZE + col; const startIndex = start * BOARD_SIZE + col; const kind = blocked(startIndex) ? null : board[startIndex]; const same = row < BOARD_SIZE && !blocked(index) && kind !== null && board[index] === kind;
      if (same) continue;
      if (kind !== null && row - start >= 3) groups.push({ orientation: "column", kind, indices: Array.from({ length: row - start }, (_, offset) => (start + offset) * BOARD_SIZE + col) });
      start = row;
    }
  }
  return groups;
}
export function findMatches(board, locked = []) { const matched = new Set(); for (const group of findMatchGroups(board, locked)) for (const index of group.indices) matched.add(index); return matched; }
export function listLegalMoves(board, locked = []) {
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    const right = index % BOARD_SIZE < BOARD_SIZE - 1 ? index + 1 : -1; const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) { if (neighbor < 0 || Number(locked?.[index]) > 0 || Number(locked?.[neighbor]) > 0) continue; swap(board, index, neighbor); const matched = findMatches(board, locked).size; swap(board, index, neighbor); if (matched > 0) moves.push({ from: index, to: neighbor, matched }); }
  }
  return moves;
}
export function hasLegalMove(board, locked = []) { return listLegalMoves(board, locked).length > 0; }
function wouldCreateImmediateSquare(candidate, index, board) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  if (row < 1 || col < 1) return false;
  return board[index - 1] === candidate
    && board[index - BOARD_SIZE] === candidate
    && board[index - BOARD_SIZE - 1] === candidate;
}
export function createBoard({ rng, rules = {}, locked = [] }) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const next = [];
    for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) { let candidate = randomKind(rng); let guard = 0; while (
        (wouldCreateImmediateMatch(candidate, index, next) || (rules?.fish === true && wouldCreateImmediateSquare(candidate, index, next)))
        && guard < 20
      ) { candidate = randomKind(rng); guard += 1; } next.push(candidate); }
    if (hasLegalMove(next, locked)) return next;
  }
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => randomKind(rng));
}
export function collapseBoard(board, rng, locked = []) {
  const next = board.slice(); const falls = []; const spawns = [];
  const compactSegment = (col, top, bottom) => {
    if (top > bottom) return;
    const kept = [];
    for (let row = bottom; row >= top; row -= 1) {
      const from = row * BOARD_SIZE + col;
      const kind = next[from];
      if (kind !== null) kept.push({ from, kind });
    }
    for (let row = bottom; row >= top; row -= 1) {
      const to = row * BOARD_SIZE + col;
      const offset = bottom - row;
      const existing = kept[offset];
      if (existing) {
        next[to] = existing.kind;
        if (existing.from !== to) falls.push({ from: existing.from, to, kind: existing.kind });
      } else {
        const kind = randomKind(rng);
        next[to] = kind;
        spawns.push({ to, kind, spawnOffset: offset - kept.length + 1 });
      }
    }
  };
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let bottom = BOARD_SIZE - 1;
    for (let row = BOARD_SIZE - 1; row >= -1; row -= 1) {
      const index = row >= 0 ? row * BOARD_SIZE + col : -1;
      if (row >= 0 && Math.max(0, Number(locked?.[index]) || 0) <= 0) continue;
      compactSegment(col, row + 1, bottom);
      bottom = row - 1;
    }
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

function adjacentIndices(index) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const out = [];
  if (row > 0) out.push(index - BOARD_SIZE);
  if (row < BOARD_SIZE - 1) out.push(index + BOARD_SIZE);
  if (col > 0) out.push(index - 1);
  if (col < BOARD_SIZE - 1) out.push(index + 1);
  return out;
}

function createLockProgress(levelDefinition, dropProgress = null) {
  const spec = levelDefinition?.objective?.locks;
  const layers = Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  const requiredKinds = Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
  if (!spec?.count) return { total: 0, opened: 0, layers, requiredKinds, recall: false };
  const blocked = new Set([
    ...(dropProgress?.tokens || []).map((token) => Number(token.index)),
    ...(dropProgress?.exits || []).map(Number),
  ]);
  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    return { index, score: patternScore(spec.pattern, row, col) };
  }).filter(({ index }) => !blocked.has(index));
  cells.sort((a, b) => a.score - b.score || ((a.index * 23 + levelDefinition.level * 19) % 71) - ((b.index * 23 + levelDefinition.level * 19) % 71));
  const count = Math.min(cells.length, Math.max(1, Math.floor(Number(spec.count) || 1)));
  for (const { index } of cells.slice(0, count)) {
    layers[index] = Math.max(1, Math.min(2, Math.floor(Number(spec.layers) || 1)));
    if (spec.recall === true) requiredKinds[index] = (levelDefinition.level + index * 3 + Math.floor(index / BOARD_SIZE)) % TILE_KINDS;
  }
  return { total: count, opened: 0, layers, requiredKinds, recall: spec.recall === true };
}

export function normalizeLockProgress(value) {
  const layers = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => Math.max(0, Math.min(2, Math.floor(Number(value?.layers?.[index]) || 0))));
  const requiredKinds = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const kind = Math.floor(Number(value?.requiredKinds?.[index]));
    return Number.isInteger(kind) && kind >= 0 && kind < TILE_KINDS ? kind : -1;
  });
  const total = Math.max(0, Math.floor(Number(value?.total) || layers.filter((layer) => layer > 0).length));
  const remaining = layers.filter((layer) => layer > 0).length;
  return {
    total,
    opened: Math.max(0, Math.min(total, Math.floor(Number(value?.opened) || (total - remaining)))),
    layers,
    requiredKinds,
    recall: value?.recall === true || requiredKinds.some((kind) => kind >= 0),
  };
}

export function lockedIndices(progress) {
  return (progress?.locks?.layers || []).flatMap((layer, index) => Number(layer) > 0 ? [index] : []);
}

export function ordinaryLockTargetIndices(progress) {
  const locks = normalizeLockProgress(progress?.locks);
  return locks.layers.flatMap((layer, index) => layer > 0 && locks.requiredKinds[index] < 0 ? [index] : []);
}

export function chipLockProgress(lockProgress, board, clearIndices, { allowRecallDirect = false } = {}) {
  const before = normalizeLockProgress(lockProgress);
  const after = normalizeLockProgress(before);
  const clearSet = new Set((clearIndices || []).filter((index) => Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE));
  const hits = [];
  for (let index = 0; index < after.layers.length; index += 1) {
    if (after.layers[index] <= 0) continue;
    const requiredKind = after.requiredKinds[index];
    const direct = clearSet.has(index);
    const neighbors = adjacentIndices(index).filter((neighbor) => clearSet.has(neighbor));
    const qualifies = requiredKind >= 0
      ? (allowRecallDirect && direct) || neighbors.some((neighbor) => board?.[neighbor] === requiredKind)
      : direct || neighbors.length > 0;
    if (!qualifies) continue;
    const previous = after.layers[index];
    after.layers[index] = Math.max(0, previous - 1);
    hits.push({ index, before: previous, after: after.layers[index], requiredKind });
  }
  after.opened = Math.max(0, after.total - after.layers.filter((layer) => layer > 0).length);
  return { before, after, hits };
}

function createBloomProgress(levelDefinition, dropProgress = null, lockProgress = null) {
  const spec = levelDefinition?.objective?.blooms;
  const symbols = Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
  if (!spec?.pairs) return { totalPairs: 0, collectedPairs: 0, activeIndex: -1, symbols, lastEvents: [] };
  const blocked = new Set([
    ...(dropProgress?.tokens || []).map((token) => Number(token.index)),
    ...(dropProgress?.exits || []).map(Number),
    ...(lockProgress?.layers || []).flatMap((layer, index) => Number(layer) > 0 ? [index] : []),
  ]);
  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    return { index, score: patternScore(spec.pattern, row, col) };
  }).filter(({ index }) => !blocked.has(index));
  cells.sort((a, b) => a.score - b.score || ((a.index * 29 + levelDefinition.level * 31) % 79) - ((b.index * 29 + levelDefinition.level * 31) % 79));
  const pairCount = Math.min(Math.floor(cells.length / 2), Math.max(1, Math.floor(Number(spec.pairs) || 2)));
  const chosen = cells.slice(0, pairCount * 2);
  for (let pair = 0; pair < pairCount; pair += 1) {
    const symbol = (levelDefinition.level + pair * 2) % TILE_KINDS;
    const first = chosen[pair];
    const second = chosen[pair + pairCount];
    if (first) symbols[first.index] = symbol;
    if (second) symbols[second.index] = symbol;
  }
  return { totalPairs: pairCount, collectedPairs: 0, activeIndex: -1, symbols, lastEvents: [] };
}

export function normalizeBloomProgress(value) {
  const symbols = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const symbol = Math.floor(Number(value?.symbols?.[index]));
    return Number.isInteger(symbol) && symbol >= 0 && symbol < TILE_KINDS ? symbol : -1;
  });
  const remainingPairs = Math.floor(symbols.filter((symbol) => symbol >= 0).length / 2);
  const totalPairs = Math.max(0, Math.floor(Number(value?.totalPairs) || remainingPairs));
  const activeIndex = Math.floor(Number(value?.activeIndex));
  return {
    totalPairs,
    collectedPairs: Math.max(0, Math.min(totalPairs, Math.floor(Number(value?.collectedPairs) || (totalPairs - remainingPairs)))),
    activeIndex: Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < symbols.length && symbols[activeIndex] >= 0 ? activeIndex : -1,
    symbols,
    lastEvents: Array.isArray(value?.lastEvents) ? value.lastEvents.map((event) => ({ ...event, indices: (event.indices || []).slice(), symbols: (event.symbols || []).slice() })) : [],
  };
}

function bloomTriggerIndices(clearIndices, blooms) {
  const clearSet = new Set((clearIndices || []).filter((index) => Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE));
  const triggered = [];
  for (let index = 0; index < blooms.symbols.length; index += 1) {
    if (blooms.symbols[index] < 0) continue;
    if (clearSet.has(index) || adjacentIndices(index).some((neighbor) => clearSet.has(neighbor))) triggered.push(index);
  }
  return triggered.sort((a, b) => a - b);
}

export function advanceBloomProgress(value, clearIndices) {
  const next = normalizeBloomProgress(value);
  const events = [];
  // One Bloom interaction per cascade step keeps large specials useful without
  // allowing a single board-wide clear to auto-solve the memory objective.
  const index = bloomTriggerIndices(clearIndices, next)[0];
  if (!Number.isInteger(index) || next.symbols[index] < 0) {
    next.lastEvents = events;
    return next;
  }
  if (next.activeIndex < 0) {
    next.activeIndex = index;
    events.push({ type: "open", index, symbol: next.symbols[index], indices: [index], symbols: [next.symbols[index]] });
  } else if (next.activeIndex !== index) {
    const first = next.activeIndex;
    const firstSymbol = next.symbols[first];
    const secondSymbol = next.symbols[index];
    if (firstSymbol === secondSymbol) {
      next.symbols[first] = -1;
      next.symbols[index] = -1;
      next.collectedPairs = Math.min(next.totalPairs, next.collectedPairs + 1);
      next.activeIndex = -1;
      events.push({ type: "match", index, symbol: secondSymbol, indices: [first, index], symbols: [firstSymbol, secondSymbol] });
    } else {
      next.activeIndex = -1;
      events.push({ type: "mismatch", index, symbol: secondSymbol, indices: [first, index], symbols: [firstSymbol, secondSymbol] });
    }
  }
  next.lastEvents = events;
  return next;
}

function createGroundProgress(levelDefinition, dropProgress = null, lockProgress = null, bloomProgress = null) {
  const spec = levelDefinition?.objective?.ground;
  const covered = Array(BOARD_SIZE * BOARD_SIZE).fill(false);
  if (!spec?.target) return { target: 0, covered, count: 0, lastSpread: [] };
  const blocked = new Set([
    ...(dropProgress?.exits || []).map(Number),
    ...(lockProgress?.layers || []).flatMap((layer, index) => Number(layer) > 0 ? [index] : []),
  ]);
  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    return { index, score: patternScore(spec.pattern, row, col) };
  }).filter(({ index }) => !blocked.has(index));
  cells.sort((a, b) => a.score - b.score || ((a.index * 37 + levelDefinition.level * 17) % 83) - ((b.index * 37 + levelDefinition.level * 17) % 83));
  const seedCount = Math.min(cells.length, Math.max(1, Math.floor(Number(spec.seeds) || 3)));
  for (const { index } of cells.slice(0, seedCount)) covered[index] = true;
  return {
    target: Math.max(seedCount, Math.min(BOARD_SIZE * BOARD_SIZE, Math.floor(Number(spec.target) || seedCount))),
    covered,
    count: covered.filter(Boolean).length,
    lastSpread: [],
  };
}

export function normalizeGroundProgress(value) {
  const covered = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => value?.covered?.[index] === true);
  const count = covered.filter(Boolean).length;
  return {
    target: Math.max(0, Math.min(BOARD_SIZE * BOARD_SIZE, Math.floor(Number(value?.target) || 0))),
    covered,
    count,
    lastSpread: Array.isArray(value?.lastSpread) ? value.lastSpread.filter((index) => Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE) : [],
  };
}

export function advanceGroundProgress(value, clearIndices) {
  const next = normalizeGroundProgress(value);
  if (!next.target) return next;
  const clearSet = new Set((clearIndices || []).filter((index) => Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE));
  if (![...clearSet].some((index) => next.covered[index])) {
    next.lastSpread = [];
    return next;
  }
  const spread = [];
  for (const index of clearSet) {
    if (!next.covered[index]) {
      next.covered[index] = true;
      spread.push(index);
    }
  }
  next.count = next.covered.filter(Boolean).length;
  next.lastSpread = spread;
  return next;
}

function occupiedObjectiveCells(dropProgress, lockProgress, bloomProgress, producerProgress = null) {
  return new Set([
    ...(dropProgress?.tokens || []).map((token) => Number(token.index)),
    ...(dropProgress?.exits || []).map(Number),
    ...(lockProgress?.layers || []).flatMap((layer, index) => Number(layer) > 0 ? [index] : []),
    ...(bloomProgress?.symbols || []).flatMap((symbol, index) => Number(symbol) >= 0 ? [index] : []),
    ...(producerProgress?.remaining || []).flatMap((charges, index) => Number(charges) > 0 ? [index] : []),
  ]);
}

function createProducerProgress(levelDefinition, dropProgress = null, lockProgress = null, bloomProgress = null) {
  const spec = levelDefinition?.objective?.producers;
  const remaining = Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  const crystals = Array(BOARD_SIZE * BOARD_SIZE).fill(false);
  if (!spec?.count) return { total: 0, produced: 0, collected: 0, remaining, crystals, lastTriggered: [], lastCollected: [] };
  const blocked = occupiedObjectiveCells(dropProgress, lockProgress, bloomProgress);
  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    return { index, score: patternScore(spec.pattern, row, col) };
  }).filter(({ index }) => !blocked.has(index));
  cells.sort((a, b) => a.score - b.score || ((a.index * 41 + levelDefinition.level * 23) % 89) - ((b.index * 41 + levelDefinition.level * 23) % 89));
  const count = Math.min(cells.length, Math.max(1, Math.floor(Number(spec.count) || 1)));
  const charges = Math.max(1, Math.min(4, Math.floor(Number(spec.charges) || 1)));
  for (const { index } of cells.slice(0, count)) remaining[index] = charges;
  return { total: count * charges, produced: 0, collected: 0, remaining, crystals, lastTriggered: [], lastCollected: [] };
}

export function normalizeProducerProgress(value) {
  const remaining = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => Math.max(0, Math.min(4, Math.floor(Number(value?.remaining?.[index]) || 0))));
  const crystals = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => value?.crystals?.[index] === true);
  const remainingTotal = remaining.reduce((sum, charges) => sum + charges, 0);
  const authoredTotal = Math.max(0, Math.floor(Number(value?.total) || remainingTotal));
  const produced = Math.max(0, Math.min(authoredTotal, Math.floor(Number(value?.produced) || (authoredTotal - remainingTotal))));
  const waiting = crystals.filter(Boolean).length;
  const collected = Math.max(0, Math.min(produced, Math.floor(Number(value?.collected) || Math.max(0, produced - waiting))));
  return {
    total: authoredTotal,
    produced,
    collected,
    remaining,
    crystals,
    lastTriggered: Array.isArray(value?.lastTriggered) ? value.lastTriggered.filter((index) => Number.isInteger(index) && index >= 0 && index < remaining.length) : [],
    lastCollected: Array.isArray(value?.lastCollected) ? value.lastCollected.filter((index) => Number.isInteger(index) && index >= 0 && index < remaining.length) : [],
  };
}

export function producerSupportIndices(progress) {
  const producers = normalizeProducerProgress(progress?.producers);
  const targets = [];
  for (let index = 0; index < producers.remaining.length; index += 1) {
    if (producers.crystals[index]) targets.push(index);
    if (producers.remaining[index] > 0 && !producers.crystals[index]) targets.push(...adjacentIndices(index));
  }
  return [...new Set(targets)];
}

export function advanceProducerProgress(value, clearIndices) {
  const next = normalizeProducerProgress(value);
  if (!next.total) return next;
  const clearSet = new Set((clearIndices || []).filter((index) => Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE));
  const triggered = [];
  const collected = [];
  for (let index = 0; index < next.remaining.length; index += 1) {
    if (next.crystals[index] && clearSet.has(index)) {
      next.crystals[index] = false;
      next.collected = Math.min(next.total, next.collected + 1);
      collected.push(index);
    }
    if (next.remaining[index] <= 0 || next.crystals[index]) continue;
    if (!clearSet.has(index) && !adjacentIndices(index).some((neighbor) => clearSet.has(neighbor))) continue;
    next.remaining[index] -= 1;
    next.produced = Math.min(next.total, next.produced + 1);
    next.crystals[index] = true;
    triggered.push(index);
  }
  next.lastTriggered = triggered;
  next.lastCollected = collected;
  return next;
}

function createColorWardProgress(levelDefinition, dropProgress = null, lockProgress = null, bloomProgress = null, producerProgress = null) {
  const spec = levelDefinition?.objective?.colorWards;
  const requiredKinds = Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
  if (!spec?.count) return { total: 0, opened: 0, requiredKinds, lastOpened: [] };
  const blocked = occupiedObjectiveCells(dropProgress, lockProgress, bloomProgress, producerProgress);
  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    return { index, score: patternScore(spec.pattern, row, col) };
  }).filter(({ index }) => !blocked.has(index));
  cells.sort((a, b) => a.score - b.score || ((a.index * 43 + levelDefinition.level * 29) % 97) - ((b.index * 43 + levelDefinition.level * 29) % 97));
  const count = Math.min(cells.length, Math.max(1, Math.floor(Number(spec.count) || 1)));
  for (let slot = 0; slot < count; slot += 1) {
    const index = cells[slot].index;
    requiredKinds[index] = (levelDefinition.level + slot * 2 + Math.floor(index / BOARD_SIZE) + index) % TILE_KINDS;
  }
  return { total: count, opened: 0, requiredKinds, lastOpened: [] };
}

export function normalizeColorWardProgress(value) {
  const requiredKinds = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const kind = Math.floor(Number(value?.requiredKinds?.[index]));
    return Number.isInteger(kind) && kind >= 0 && kind < TILE_KINDS ? kind : -1;
  });
  const remaining = requiredKinds.filter((kind) => kind >= 0).length;
  const total = Math.max(0, Math.floor(Number(value?.total) || remaining));
  return {
    total,
    opened: Math.max(0, Math.min(total, Math.floor(Number(value?.opened) || (total - remaining)))),
    requiredKinds,
    lastOpened: Array.isArray(value?.lastOpened) ? value.lastOpened.filter((index) => Number.isInteger(index) && index >= 0 && index < requiredKinds.length) : [],
  };
}

export function colorWardSupportIndices(progress) {
  const wards = normalizeColorWardProgress(progress?.colorWards);
  return [...new Set(wards.requiredKinds.flatMap((kind, index) => kind >= 0 ? adjacentIndices(index) : []))];
}

export function colorWardTargetKinds(progress) {
  const wards = normalizeColorWardProgress(progress?.colorWards);
  return [...new Set(wards.requiredKinds.filter((kind) => kind >= 0))];
}

export function colorWardButterflyTargetIndices(progress, board) {
  const wards = normalizeColorWardProgress(progress?.colorWards);
  const targets = [];
  for (let wardIndex = 0; wardIndex < wards.requiredKinds.length; wardIndex += 1) {
    const requiredKind = wards.requiredKinds[wardIndex];
    if (requiredKind < 0) continue;
    for (const neighbor of adjacentIndices(wardIndex)) {
      if (Number(board?.[neighbor]) === requiredKind) targets.push(neighbor);
    }
  }
  return [...new Set(targets)];
}

export function advanceColorWardProgress(value, boardBefore, clearIndices, { allowDirect = false } = {}) {
  const next = normalizeColorWardProgress(value);
  if (!next.total) return next;
  const clearSet = new Set((clearIndices || []).filter((index) => Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE));
  const opened = [];
  for (let index = 0; index < next.requiredKinds.length; index += 1) {
    const requiredKind = next.requiredKinds[index];
    if (requiredKind < 0) continue;
    const direct = allowDirect && clearSet.has(index);
    const matchingNeighbor = adjacentIndices(index).some((neighbor) => clearSet.has(neighbor) && Number(boardBefore?.[neighbor]) === requiredKind);
    if (!direct && !matchingNeighbor) continue;
    next.requiredKinds[index] = -1;
    next.opened = Math.min(next.total, next.opened + 1);
    opened.push(index);
  }
  next.lastOpened = opened;
  return next;
}

export function createLevelProgress(levelDefinition) {
  const drop = createDropProgress(levelDefinition);
  const locks = createLockProgress(levelDefinition, drop);
  const blooms = createBloomProgress(levelDefinition, drop, locks);
  const ground = createGroundProgress(levelDefinition, drop, locks, blooms);
  const producers = createProducerProgress(levelDefinition, drop, locks, blooms);
  const colorWards = createColorWardProgress(levelDefinition, drop, locks, blooms, producers);
  return { collected: Array(TILE_KINDS).fill(0), ice: createIceBoard(levelDefinition), drop, locks, blooms, ground, producers, colorWards };
}

export function applyLevelProgress(levelDefinition, progress, result) {
  const next = {
    collected: Array.from({ length: TILE_KINDS }, (_, kind) => Math.max(0, Number(progress?.collected?.[kind]) || 0)),
    ice: normalizeIce(result?.iceAfter ?? result?.ice ?? progress?.ice),
    drop: normalizeDropProgress(levelDefinition, progress?.drop),
    locks: normalizeLockProgress(result?.locksAfter ?? result?.locks ?? progress?.locks),
    blooms: normalizeBloomProgress(progress?.blooms),
    ground: normalizeGroundProgress(progress?.ground),
    producers: normalizeProducerProgress(progress?.producers),
    colorWards: normalizeColorWardProgress(progress?.colorWards),
  };
  addKindCounts(next.collected, result?.clearedKindCounts);
  const steps = Array.isArray(result?.transitions) ? result.transitions : result?.cleared ? [result] : [];
  const bloomEvents = [];
  const groundSpread = [];
  const producerTriggers = [];
  const wardOpenings = [];
  if (result?.hammer?.cleared) {
    const clearIndices = result.hammer.matchedForProgress || result.hammer.matched || [];
    next.drop = dropStepProgress(next.drop, result.hammer);
    next.blooms = advanceBloomProgress(next.blooms, clearIndices);
    bloomEvents.push(...next.blooms.lastEvents);
    next.ground = advanceGroundProgress(next.ground, clearIndices);
    groundSpread.push(...next.ground.lastSpread);
    next.producers = advanceProducerProgress(next.producers, clearIndices);
    producerTriggers.push(...next.producers.lastTriggered);
    next.colorWards = advanceColorWardProgress(next.colorWards, result.hammer.before, clearIndices, { allowDirect: true });
    wardOpenings.push(...next.colorWards.lastOpened);
  }
  for (const step of steps) {
    next.drop = dropStepProgress(next.drop, step);
    const clearIndices = step.matchedForProgress || step.matched || [];
    next.blooms = advanceBloomProgress(next.blooms, clearIndices);
    bloomEvents.push(...next.blooms.lastEvents);
    next.ground = advanceGroundProgress(next.ground, clearIndices);
    groundSpread.push(...next.ground.lastSpread);
    next.producers = advanceProducerProgress(next.producers, clearIndices);
    producerTriggers.push(...next.producers.lastTriggered);
    next.colorWards = advanceColorWardProgress(next.colorWards, step.before, clearIndices);
    wardOpenings.push(...next.colorWards.lastOpened);
  }
  next.blooms.lastEvents = bloomEvents;
  next.ground.lastSpread = [...new Set(groundSpread)];
  next.producers.lastTriggered = [...new Set(producerTriggers)];
  next.colorWards.lastOpened = [...new Set(wardOpenings)];
  return next;
}

export function objectiveComplete(levelDefinition, progress, score) {
  if (Number(score) < Number(levelDefinition.target || 0)) return false;
  for (const goal of levelDefinition.objective?.collect || []) if ((progress?.collected?.[goal.kind] || 0) < goal.count) return false;
  if (levelDefinition.objective?.ice && (progress?.ice || []).some((layers) => layers > 0)) return false;
  if (levelDefinition.objective?.drop && Number(progress?.drop?.delivered || 0) < Number(levelDefinition.objective.drop.count || 0)) return false;
  if (levelDefinition.objective?.locks && (progress?.locks?.layers || []).some((layer) => Number(layer) > 0)) return false;
  if (levelDefinition.objective?.blooms && Number(progress?.blooms?.collectedPairs || 0) < Number(levelDefinition.objective.blooms.pairs || 0)) return false;
  if (levelDefinition.objective?.ground && Number(progress?.ground?.count || 0) < Number(levelDefinition.objective.ground.target || 0)) return false;
  if (levelDefinition.objective?.producers && Number(progress?.producers?.collected || 0) < Number(progress?.producers?.total || 0)) return false;
  if (levelDefinition.objective?.colorWards && (progress?.colorWards?.requiredKinds || []).some((kind) => Number(kind) >= 0)) return false;
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
  if (levelDefinition.objective?.locks) {
    const count = (progress?.locks?.layers || []).reduce((sum, layer) => sum + Math.max(0, Number(layer) || 0), 0);
    if (count > 0) remaining.push({ type: levelDefinition.objective.locks.recall ? "recall-lock" : "lock", count });
  }
  if (levelDefinition.objective?.blooms) {
    const count = Math.max(0, Number(levelDefinition.objective.blooms.pairs || 0) - Number(progress?.blooms?.collectedPairs || 0));
    if (count > 0) remaining.push({ type: "memory-bloom", count });
  }
  if (levelDefinition.objective?.ground) {
    const count = Math.max(0, Number(levelDefinition.objective.ground.target || 0) - Number(progress?.ground?.count || 0));
    if (count > 0) remaining.push({ type: "ground", count });
  }
  if (levelDefinition.objective?.producers) {
    const count = Math.max(0, Number(progress?.producers?.total || 0) - Number(progress?.producers?.collected || 0));
    if (count > 0) remaining.push({ type: "producer", count });
  }
  if (levelDefinition.objective?.colorWards) {
    const count = (progress?.colorWards?.requiredKinds || []).filter((kind) => Number(kind) >= 0).length;
    if (count > 0) remaining.push({ type: "color-ward", count });
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
  if (levelDefinition.objective?.locks) {
    const remaining = (progress?.locks?.layers || []).reduce((sum, layer) => sum + Math.max(0, Number(layer) || 0), 0);
    parts.push(`${levelDefinition.objective.locks.recall ? "recall locks" : "locks"} ${remaining} left`);
  }
  if (levelDefinition.objective?.blooms) {
    const current = Math.min(Number(levelDefinition.objective.blooms.pairs || 0), Number(progress?.blooms?.collectedPairs || 0));
    parts.push(`blooms ${current}/${levelDefinition.objective.blooms.pairs} pairs`);
  }
  if (levelDefinition.objective?.ground) {
    const current = Math.min(Number(levelDefinition.objective.ground.target || 0), Number(progress?.ground?.count || 0));
    parts.push(`magic ground ${current}/${levelDefinition.objective.ground.target}`);
  }
  if (levelDefinition.objective?.producers) {
    const current = Math.min(Number(progress?.producers?.total || 0), Number(progress?.producers?.collected || 0));
    parts.push(`forge crystals ${current}/${Number(progress?.producers?.total || 0)}`);
  }
  if (levelDefinition.objective?.colorWards) {
    const total = Number(progress?.colorWards?.total || 0);
    const opened = Math.min(total, Number(progress?.colorWards?.opened || 0));
    parts.push(`color wards ${opened}/${total}`);
  }
  return parts.join(" · ");
}
