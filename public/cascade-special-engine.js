import {
  BOARD_SIZE,
  TILE_KINDS,
  LEVEL_COUNT,
  TILE_LABELS,
  CASCADE_LEVELS,
  adjacent,
  createBoard,
  createLevelProgress,
  createRng,
  describeLevelObjective,
  findMatchGroups,
  objectiveComplete,
} from "./cascade-engine.js";

export {
  BOARD_SIZE,
  TILE_KINDS,
  LEVEL_COUNT,
  TILE_LABELS,
  CASCADE_LEVELS,
  adjacent,
  createBoard,
  createLevelProgress,
  createRng,
  describeLevelObjective,
  objectiveComplete,
};

export const SPECIAL = Object.freeze({
  STRIPE_H: "stripe-h",
  STRIPE_V: "stripe-v",
  BOMB: "bomb",
  COLOR: "color",
});

export function emptySpecials() {
  return Array(BOARD_SIZE * BOARD_SIZE).fill(null);
}

function normalizeSpecials(specials) {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const value = specials?.[index];
    return Object.values(SPECIAL).includes(value) ? value : null;
  });
}

function normalizeIce(ice) {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => Math.max(0, Math.floor(Number(ice?.[index]) || 0)));
}

function addKindCounts(target, source) {
  for (let kind = 0; kind < TILE_KINDS; kind += 1) target[kind] += Number(source?.[kind] || 0);
  return target;
}

function kindCounts(board, indices) {
  const counts = Array(TILE_KINDS).fill(0);
  for (const index of indices) {
    const kind = board[index];
    if (Number.isInteger(kind) && kind >= 0 && kind < TILE_KINDS) counts[kind] += 1;
  }
  return counts;
}

function rowOf(index) {
  return Math.floor(index / BOARD_SIZE);
}

function colOf(index) {
  return index % BOARD_SIZE;
}

function rowIndices(row) {
  return Array.from({ length: BOARD_SIZE }, (_, col) => row * BOARD_SIZE + col);
}

function colIndices(col) {
  return Array.from({ length: BOARD_SIZE }, (_, row) => row * BOARD_SIZE + col);
}

function areaAround(index, radius = 1) {
  const out = [];
  const centerRow = rowOf(index);
  const centerCol = colOf(index);
  for (let row = Math.max(0, centerRow - radius); row <= Math.min(BOARD_SIZE - 1, centerRow + radius); row += 1) {
    for (let col = Math.max(0, centerCol - radius); col <= Math.min(BOARD_SIZE - 1, centerCol + radius); col += 1) {
      out.push(row * BOARD_SIZE + col);
    }
  }
  return out;
}

function threeRowsAndColumns(index) {
  const out = new Set();
  const centerRow = rowOf(index);
  const centerCol = colOf(index);
  for (let delta = -1; delta <= 1; delta += 1) {
    const row = centerRow + delta;
    const col = centerCol + delta;
    if (row >= 0 && row < BOARD_SIZE) rowIndices(row).forEach((value) => out.add(value));
    if (col >= 0 && col < BOARD_SIZE) colIndices(col).forEach((value) => out.add(value));
  }
  return [...out];
}

function swapPair(values, from, to) {
  const next = values.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function chipIce(ice, indices) {
  const before = normalizeIce(ice);
  const after = before.slice();
  const hits = [];
  for (const index of indices) {
    if (after[index] <= 0) continue;
    const previous = after[index];
    after[index] = Math.max(0, previous - 1);
    hits.push({ index, before: previous, after: after[index] });
  }
  return { before, after, hits };
}

function collapseState(board, specials, rng) {
  const nextBoard = board.slice();
  const nextSpecials = specials.slice();
  const falls = [];
  const spawns = [];

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const kept = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const from = row * BOARD_SIZE + col;
      if (nextBoard[from] !== null) kept.push({ from, kind: nextBoard[from], special: nextSpecials[from] });
    }

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const to = row * BOARD_SIZE + col;
      const offset = BOARD_SIZE - 1 - row;
      const existing = kept[offset];
      if (existing) {
        nextBoard[to] = existing.kind;
        nextSpecials[to] = existing.special;
        if (existing.from !== to) {
          falls.push({ from: existing.from, to, kind: existing.kind, special: existing.special });
        }
      } else {
        const kind = Math.floor(rng.next() * TILE_KINDS);
        nextBoard[to] = kind;
        nextSpecials[to] = null;
        spawns.push({ to, kind, special: null, spawnOffset: offset - kept.length + 1 });
      }
    }
  }

  return { board: nextBoard, specials: nextSpecials, falls, spawns };
}

function ruleEnabled(rules, key) {
  return rules?.[key] !== false;
}

function preferredAnchor(indices, from, to, specials) {
  for (const candidate of [to, from]) {
    if (indices.includes(candidate) && !specials[candidate]) return candidate;
  }
  const clean = indices.filter((index) => !specials[index]);
  const pool = clean.length ? clean : indices;
  return pool[Math.floor(pool.length / 2)];
}

export function findSpecialMatchGroups(board, specials = []) {
  const matchable = board.map((kind, index) => specials[index] === SPECIAL.COLOR ? null : kind);
  return findMatchGroups(matchable);
}

function detectCreations(groups, from, to, specials, rules) {
  const creations = [];
  const consumed = new Set();

  if (ruleEnabled(rules, "bomb")) {
    const rows = groups.map((group, groupIndex) => ({ group, groupIndex })).filter(({ group }) => group.orientation === "row");
    const columns = groups.map((group, groupIndex) => ({ group, groupIndex })).filter(({ group }) => group.orientation === "column");
    for (const row of rows) {
      for (const column of columns) {
        const intersection = row.group.indices.find((index) => column.group.indices.includes(index));
        if (intersection === undefined) continue;
        if (consumed.has(row.groupIndex) || consumed.has(column.groupIndex)) continue;
        creations.push({ index: intersection, special: SPECIAL.BOMB, source: [...new Set([...row.group.indices, ...column.group.indices])] });
        consumed.add(row.groupIndex);
        consumed.add(column.groupIndex);
      }
    }
  }

  groups.forEach((group, groupIndex) => {
    if (consumed.has(groupIndex)) return;
    if (group.indices.length >= 5 && ruleEnabled(rules, "color")) {
      creations.push({
        index: preferredAnchor(group.indices, from, to, specials),
        special: SPECIAL.COLOR,
        source: group.indices.slice(),
      });
      return;
    }
    if (group.indices.length === 4 && ruleEnabled(rules, "stripe")) {
      creations.push({
        index: preferredAnchor(group.indices, from, to, specials),
        special: group.orientation === "row" ? SPECIAL.STRIPE_H : SPECIAL.STRIPE_V,
        source: group.indices.slice(),
      });
    }
  });

  const byIndex = new Map();
  for (const creation of creations) byIndex.set(creation.index, creation);
  return [...byIndex.values()];
}

function dominantKind(board) {
  const counts = Array(TILE_KINDS).fill(0);
  for (const kind of board) {
    if (Number.isInteger(kind) && kind >= 0 && kind < TILE_KINDS) counts[kind] += 1;
  }
  let best = 0;
  for (let kind = 1; kind < TILE_KINDS; kind += 1) {
    if (counts[kind] > counts[best]) best = kind;
  }
  return best;
}

function specialBlast(index, special, board, colorTarget = null) {
  if (special === SPECIAL.STRIPE_H) return rowIndices(rowOf(index));
  if (special === SPECIAL.STRIPE_V) return colIndices(colOf(index));
  if (special === SPECIAL.BOMB) return areaAround(index, 1);
  if (special === SPECIAL.COLOR) {
    const target = Number.isInteger(colorTarget) && colorTarget >= 0 && colorTarget < TILE_KINDS
      ? colorTarget
      : dominantKind(board);
    return board.flatMap((kind, boardIndex) => kind === target ? [boardIndex] : []);
  }
  return [];
}

function expandTriggeredSpecials({ board, specials, seedIndices, protectedIndices = [], colorTarget = null }) {
  const clear = new Set(seedIndices);
  const protectedSet = new Set(protectedIndices);
  const queue = [...clear];
  const triggered = [];
  const seen = new Set();

  while (queue.length) {
    const index = queue.shift();
    if (seen.has(index) || protectedSet.has(index)) continue;
    seen.add(index);
    const special = specials[index];
    if (!special) continue;
    const blast = specialBlast(index, special, board, colorTarget);
    triggered.push({ index, special, cleared: blast.slice() });
    for (const target of blast) {
      if (protectedSet.has(target)) continue;
      if (!clear.has(target)) {
        clear.add(target);
        queue.push(target);
      }
    }
  }

  return { clear, triggered };
}

function hasOrdinaryLegalMove(board, specials) {
  for (let index = 0; index < board.length; index += 1) {
    const right = colOf(index) < BOARD_SIZE - 1 ? index + 1 : -1;
    const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) {
      if (neighbor < 0) continue;
      const swappedBoard = swapPair(board, index, neighbor);
      const swappedSpecials = swapPair(specials, index, neighbor);
      if (findSpecialMatchGroups(swappedBoard, swappedSpecials).length) return true;
    }
  }
  return false;
}

function hasPlayableMove(board, specials) {
  if (hasOrdinaryLegalMove(board, specials)) return true;
  for (let index = 0; index < board.length; index += 1) {
    if (specials[index] === SPECIAL.COLOR) return true;
    const right = colOf(index) < BOARD_SIZE - 1 ? index + 1 : -1;
    const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) {
      if (neighbor >= 0 && specials[index] && specials[neighbor]) return true;
    }
  }
  return false;
}

function comboClear(board, specials, from, to) {
  const a = specials[from];
  const b = specials[to];
  if (!a || !b) return null;

  if (a === SPECIAL.COLOR && b === SPECIAL.COLOR) {
    return { kind: "color+color", indices: board.map((_, index) => index), colorTarget: null };
  }

  if (a === SPECIAL.COLOR || b === SPECIAL.COLOR) {
    const colorIndex = a === SPECIAL.COLOR ? from : to;
    const partnerIndex = colorIndex === from ? to : from;
    const targetKind = board[partnerIndex];
    const indices = new Set([colorIndex, partnerIndex]);
    board.forEach((kind, index) => {
      if (kind === targetKind) indices.add(index);
    });
    return { kind: "color+special", indices: [...indices], colorTarget: targetKind };
  }

  const stripes = [SPECIAL.STRIPE_H, SPECIAL.STRIPE_V];
  if (stripes.includes(a) && stripes.includes(b)) {
    const indices = new Set([from, to]);
    rowIndices(rowOf(from)).forEach((index) => indices.add(index));
    colIndices(colOf(from)).forEach((index) => indices.add(index));
    rowIndices(rowOf(to)).forEach((index) => indices.add(index));
    colIndices(colOf(to)).forEach((index) => indices.add(index));
    return { kind: "stripe+stripe", indices: [...indices], colorTarget: null };
  }

  if ((a === SPECIAL.BOMB && stripes.includes(b)) || (b === SPECIAL.BOMB && stripes.includes(a))) {
    const center = a === SPECIAL.BOMB ? from : to;
    return { kind: "bomb+stripe", indices: threeRowsAndColumns(center), colorTarget: null };
  }

  if (a === SPECIAL.BOMB && b === SPECIAL.BOMB) {
    const indices = new Set([...areaAround(from, 2), ...areaAround(to, 2)]);
    return { kind: "bomb+bomb", indices: [...indices], colorTarget: null };
  }

  return null;
}

function colorSwapClear(board, specials, from, to) {
  const a = specials[from];
  const b = specials[to];
  if (a !== SPECIAL.COLOR && b !== SPECIAL.COLOR) return null;
  const colorIndex = a === SPECIAL.COLOR ? from : to;
  const partnerIndex = colorIndex === from ? to : from;
  const targetKind = board[partnerIndex];
  const indices = new Set([colorIndex]);
  board.forEach((kind, index) => {
    if (kind === targetKind) indices.add(index);
  });
  return { kind: "color", indices: [...indices], colorTarget: targetKind };
}

export function resolveSpecialCascades(board, specials, rng, {
  ice = [],
  startingCascade = 1,
  from = null,
  to = null,
  rules = {},
  forced = null,
} = {}) {
  let currentBoard = board.slice();
  let currentSpecials = normalizeSpecials(specials);
  let currentIce = normalizeIce(ice);
  let cascade = startingCascade;
  let scoreGained = 0;
  const transitions = [];
  const clearedKindCounts = Array(TILE_KINDS).fill(0);
  let iceHitCount = 0;
  let specialCreatedCount = 0;
  let specialTriggeredCount = 0;
  let forcedStep = forced;

  while (true) {
    const groups = forcedStep ? [] : findSpecialMatchGroups(currentBoard, currentSpecials);
    if (!forcedStep && !groups.length) break;

    const before = currentBoard.slice();
    const specialsBefore = currentSpecials.slice();
    const creations = forcedStep ? [] : detectCreations(groups, from, to, currentSpecials, rules);
    const creationIndices = new Set(creations.map((creation) => creation.index));
    const seed = new Set(forcedStep?.indices || groups.flatMap((group) => group.indices));
    creationIndices.forEach((index) => seed.delete(index));

    const expanded = expandTriggeredSpecials({
      board: currentBoard,
      specials: currentSpecials,
      seedIndices: [...seed],
      protectedIndices: [...creationIndices],
      colorTarget: forcedStep?.colorTarget ?? null,
    });
    const matched = [...expanded.clear].sort((a, b) => a - b);
    const matchedForProgress = [...new Set([...matched, ...creationIndices])].sort((a, b) => a - b);
    const transitionCounts = kindCounts(before, matchedForProgress);
    addKindCounts(clearedKindCounts, transitionCounts);
    const chipped = chipIce(currentIce, matchedForProgress);
    currentIce = chipped.after;
    iceHitCount += chipped.hits.length;

    const clearedBoard = currentBoard.slice();
    const clearedSpecials = currentSpecials.slice();
    for (const index of matched) {
      clearedBoard[index] = null;
      clearedSpecials[index] = null;
    }

    for (const creation of creations) {
      clearedBoard[creation.index] = before[creation.index];
      clearedSpecials[creation.index] = creation.special;
    }

    const gained = matchedForProgress.length * 80 * cascade + creations.length * 220 + expanded.triggered.length * 140;
    scoreGained += gained;
    specialCreatedCount += creations.length;
    specialTriggeredCount += expanded.triggered.length;
    const collapsed = collapseState(clearedBoard, clearedSpecials, rng);

    transitions.push({
      type: forcedStep ? "special-combo" : "cascade",
      combo: forcedStep?.kind || null,
      cascade,
      groups,
      matched,
      matchedForProgress,
      gained,
      before,
      specialsBefore,
      cleared: clearedBoard,
      clearedSpecials,
      after: collapsed.board.slice(),
      specialsAfter: collapsed.specials.slice(),
      falls: collapsed.falls,
      spawns: collapsed.spawns,
      createdSpecials: creations,
      triggeredSpecials: expanded.triggered,
      clearedKindCounts: transitionCounts,
      iceBefore: chipped.before,
      iceAfter: chipped.after,
      iceHits: chipped.hits,
    });

    currentBoard = collapsed.board;
    currentSpecials = collapsed.specials;
    forcedStep = null;
    from = null;
    to = null;
    cascade += 1;
  }

  let shuffled = false;
  let shuffle = null;
  if (!hasPlayableMove(currentBoard, currentSpecials)) {
    const before = currentBoard.slice();
    currentBoard = createBoard({ rng });
    currentSpecials = emptySpecials();
    shuffled = true;
    shuffle = { type: "shuffle", before, after: currentBoard.slice() };
  }

  return {
    board: currentBoard,
    specials: currentSpecials,
    ice: currentIce,
    scoreGained,
    transitions,
    clearedKindCounts,
    iceHitCount,
    specialCreatedCount,
    specialTriggeredCount,
    shuffled,
    shuffle,
    maxCascade: transitions.length ? transitions.at(-1).cascade : 0,
  };
}

export function applySpecialSwap(board, specials, from, to, rng, options = {}) {
  const cleanSpecials = normalizeSpecials(specials);
  if (!adjacent(from, to)) {
    return { legal: false, reason: "not_adjacent", board: board.slice(), specials: cleanSpecials, ice: normalizeIce(options.ice), scoreGained: 0, transitions: [] };
  }

  const swappedBoard = swapPair(board, from, to);
  const swappedSpecials = swapPair(cleanSpecials, from, to);
  const combo = comboClear(swappedBoard, swappedSpecials, from, to)
    || colorSwapClear(swappedBoard, swappedSpecials, from, to);

  if (combo) {
    return {
      legal: true,
      from,
      to,
      swapped: swappedBoard,
      swappedSpecials,
      ...resolveSpecialCascades(swappedBoard, swappedSpecials, rng, { ...options, from, to, forced: combo }),
    };
  }

  if (!findSpecialMatchGroups(swappedBoard, swappedSpecials).length) {
    return {
      legal: false,
      reason: "no_match",
      board: board.slice(),
      specials: cleanSpecials,
      ice: normalizeIce(options.ice),
      swapped: swappedBoard,
      swappedSpecials,
      scoreGained: 0,
      transitions: [],
    };
  }

  return {
    legal: true,
    from,
    to,
    swapped: swappedBoard,
    swappedSpecials,
    ...resolveSpecialCascades(swappedBoard, swappedSpecials, rng, { ...options, from, to }),
  };
}

export function applySpecialHammer(board, specials, index, rng, options = {}) {
  const cleanSpecials = normalizeSpecials(specials);
  const cleanIce = normalizeIce(options.ice);
  if (index < 0 || index >= board.length) {
    return { legal: false, reason: "invalid_index", board: board.slice(), specials: cleanSpecials, ice: cleanIce, scoreGained: 0, transitions: [] };
  }

  if (cleanIce[index] > 0) {
    const chipped = chipIce(cleanIce, [index]);
    const clearedKindCounts = Array(TILE_KINDS).fill(0);
    const before = board.slice();
    const specialsBefore = cleanSpecials.slice();
    const transition = {
      type: "special-combo",
      combo: "hammer",
      cascade: 1,
      groups: [],
      matched: [index],
      matchedForProgress: [],
      gained: 80,
      before,
      specialsBefore,
      cleared: before.slice(),
      clearedSpecials: specialsBefore.slice(),
      after: before.slice(),
      specialsAfter: specialsBefore.slice(),
      falls: [],
      spawns: [],
      createdSpecials: [],
      triggeredSpecials: [],
      clearedKindCounts: clearedKindCounts.slice(),
      iceBefore: chipped.before,
      iceAfter: chipped.after,
      iceHits: chipped.hits,
    };
    return {
      legal: true,
      index,
      board: before,
      specials: specialsBefore,
      ice: chipped.after,
      scoreGained: transition.gained,
      transitions: [transition],
      clearedKindCounts,
      iceHitCount: chipped.hits.length,
      specialCreatedCount: 0,
      specialTriggeredCount: 0,
      shuffled: false,
      shuffle: null,
      maxCascade: 1,
    };
  }

  const forced = { kind: "hammer", indices: [index], colorTarget: null };
  return {
    legal: true,
    index,
    ...resolveSpecialCascades(board, cleanSpecials, rng, { ...options, ice: cleanIce, forced }),
  };
}

export function applySpecialLevelProgress(levelDefinition, progress, result) {
  const next = {
    collected: Array.from({ length: TILE_KINDS }, (_, kind) => Math.max(0, Number(progress?.collected?.[kind]) || 0)),
    ice: normalizeIce(result?.iceAfter ?? result?.ice ?? progress?.ice),
  };
  addKindCounts(next.collected, result?.clearedKindCounts);
  return next;
}
