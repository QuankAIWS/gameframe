import {
  BOARD_SIZE,
  TILE_KINDS,
  LEVEL_COUNT,
  TILE_LABELS,
  CASCADE_LEVELS,
  adjacent,
  applyLevelProgress,
  createBoard,
  createLevelProgress,
  createRng,
  describeLevelObjective,
  dropSupportIndices,
  ordinaryLockTargetIndices,
  producerSupportIndices,
  colorWardSupportIndices,
  colorWardTargetKinds,
  normalizeLockProgress,
  chipLockProgress,
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
  applyLevelProgress,
  createBoard,
  createLevelProgress,
  createRng,
  describeLevelObjective,
  dropSupportIndices,
  ordinaryLockTargetIndices,
  producerSupportIndices,
  colorWardSupportIndices,
  colorWardTargetKinds,
  normalizeLockProgress,
  objectiveComplete,
};

export const SPECIAL = Object.freeze({
  STRIPE_H: "stripe-h",
  STRIPE_V: "stripe-v",
  BOMB: "bomb",
  COLOR: "color",
  FISH: "fish",
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

function collapseState(board, specials, rng, locked = []) {
  const nextBoard = board.slice();
  const nextSpecials = specials.slice();
  const falls = [];
  const spawns = [];

  const compactSegment = (col, top, bottom) => {
    if (top > bottom) return;
    const kept = [];
    for (let row = bottom; row >= top; row -= 1) {
      const from = row * BOARD_SIZE + col;
      if (nextBoard[from] !== null) kept.push({ from, kind: nextBoard[from], special: nextSpecials[from] });
    }
    for (let row = bottom; row >= top; row -= 1) {
      const to = row * BOARD_SIZE + col;
      const offset = bottom - row;
      const existing = kept[offset];
      if (existing) {
        nextBoard[to] = existing.kind;
        nextSpecials[to] = existing.special;
        if (existing.from !== to) falls.push({ from: existing.from, to, kind: existing.kind, special: existing.special });
      } else {
        const kind = Math.floor(rng.next() * TILE_KINDS);
        nextBoard[to] = kind;
        nextSpecials[to] = null;
        spawns.push({ to, kind, special: null, spawnOffset: offset - kept.length + 1 });
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

function findSquareGroups(board) {
  const groups = [];
  for (let row = 0; row < BOARD_SIZE - 1; row += 1) {
    for (let col = 0; col < BOARD_SIZE - 1; col += 1) {
      const topLeft = row * BOARD_SIZE + col;
      const indices = [topLeft, topLeft + 1, topLeft + BOARD_SIZE, topLeft + BOARD_SIZE + 1];
      const kind = board[topLeft];
      if (kind === null || kind === undefined) continue;
      if (indices.every((index) => board[index] === kind)) groups.push({ orientation: "square", kind, indices });
    }
  }
  return groups;
}

export function findSpecialMatchGroups(board, specials = [], rules = {}, locked = []) {
  const matchable = board.map((kind, index) => specials[index] === SPECIAL.COLOR || Number(locked?.[index]) > 0 ? null : kind);
  const groups = findMatchGroups(matchable, locked);
  if (rules?.fish === true) groups.push(...findSquareGroups(matchable));
  return groups;
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
    if (group.orientation === "square" && group.indices.length === 4 && rules?.fish === true) {
      creations.push({
        index: preferredAnchor(group.indices, from, to, specials),
        special: SPECIAL.FISH,
        source: group.indices.slice(),
      });
      return;
    }
    if (group.indices.length >= 5 && ruleEnabled(rules, "color")) {
      creations.push({
        index: preferredAnchor(group.indices, from, to, specials),
        special: SPECIAL.COLOR,
        source: group.indices.slice(),
      });
      return;
    }
    if ((group.orientation === "row" || group.orientation === "column") && group.indices.length === 4 && ruleEnabled(rules, "stripe")) {
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

// The persisted special token remains "fish" for old saves and historical
// simulator evidence, but the player-facing mechanic is Butterfly.
//
// Targeting is intentionally not a solver: Butterfly samples uniformly from
// the highest currently useful objective tier and never scores future cascades,
// geometry, blocker depth, combo value, or expected move value.
function butterflyTargets(board, sourceIndex, { ice = [], targetKinds = [], targetIndices = [], count = 1, exclude = [], rng = null } = {}) {
  const blocked = new Set([sourceIndex, ...exclude]);
  const neededKinds = new Set((targetKinds || []).filter((kind) => Number.isInteger(kind) && kind >= 0 && kind < TILE_KINDS));
  const neededIndices = new Set((targetIndices || []).filter((index) => Number.isInteger(index) && index >= 0 && index < board.length));
  const available = [];
  const directObjective = [];

  for (let index = 0; index < board.length; index += 1) {
    if (blocked.has(index) || board[index] === null) continue;
    available.push(index);
    const hasIce = Math.max(0, Number(ice?.[index]) || 0) > 0;
    const neededColor = neededKinds.has(board[index]);
    const supportsDrop = neededIndices.has(index);
    if (hasIce || neededColor || supportsDrop) directObjective.push(index);
  }

  const selected = [];
  const pick = (pool) => {
    if (!pool.length) return null;
    const random = typeof rng?.next === "function" ? rng.next() : 0;
    const offset = Math.min(pool.length - 1, Math.floor(random * pool.length));
    return pool.splice(offset, 1)[0];
  };

  const highTierPool = directObjective.slice();
  while (selected.length < Math.max(1, count) && highTierPool.length) {
    const target = pick(highTierPool);
    if (target !== null) selected.push(target);
  }

  const fillerPool = available.filter((index) => !selected.includes(index));
  while (selected.length < Math.max(1, count) && fillerPool.length) {
    const target = pick(fillerPool);
    if (target !== null) selected.push(target);
  }

  return selected;
}

function specialBlast(index, special, board, colorTarget = null, targeting = {}) {
  if (special === SPECIAL.STRIPE_H) return rowIndices(rowOf(index));
  if (special === SPECIAL.STRIPE_V) return colIndices(colOf(index));
  if (special === SPECIAL.BOMB) return areaAround(index, 1);
  if (special === SPECIAL.FISH) return butterflyTargets(board, index, targeting);
  if (special === SPECIAL.COLOR) {
    const target = Number.isInteger(colorTarget) && colorTarget >= 0 && colorTarget < TILE_KINDS
      ? colorTarget
      : dominantKind(board);
    return board.flatMap((kind, boardIndex) => kind === target ? [boardIndex] : []);
  }
  return [];
}

function expandTriggeredSpecials({ board, specials, seedIndices, protectedIndices = [], colorTarget = null, ice = [], targetKinds = [], targetIndices = [], rng = null }) {
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
    const blast = specialBlast(index, special, board, colorTarget, { ice, targetKinds, targetIndices, rng });
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

function hasOrdinaryLegalMove(board, specials, rules = {}, locked = []) {
  for (let index = 0; index < board.length; index += 1) {
    const right = colOf(index) < BOARD_SIZE - 1 ? index + 1 : -1;
    const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) {
      if (neighbor < 0 || Number(locked?.[index]) > 0 || Number(locked?.[neighbor]) > 0) continue;
      const swappedBoard = swapPair(board, index, neighbor);
      const swappedSpecials = swapPair(specials, index, neighbor);
      if (findSpecialMatchGroups(swappedBoard, swappedSpecials, rules, locked).length) return true;
    }
  }
  return false;
}

function hasPlayableMove(board, specials, rules = {}, locked = []) {
  if (hasOrdinaryLegalMove(board, specials, rules, locked)) return true;
  for (let index = 0; index < board.length; index += 1) {
    if (Number(locked?.[index]) <= 0 && specials[index] === SPECIAL.COLOR) return true;
    const right = colOf(index) < BOARD_SIZE - 1 ? index + 1 : -1;
    const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) {
      if (neighbor >= 0 && Number(locked?.[index]) <= 0 && Number(locked?.[neighbor]) <= 0 && specials[index] && specials[neighbor]) return true;
    }
  }
  return false;
}

function comboClear(board, specials, from, to, options = {}) {
  const a = specials[from];
  const b = specials[to];
  if (!a || !b) return null;

  if (a === SPECIAL.FISH && b === SPECIAL.FISH) {
    const targets = butterflyTargets(board, to, { ice: options.ice, targetKinds: options.targetKinds, targetIndices: options.targetIndices, count: 3, exclude: [from, to], rng: options.rng });
    return {
      kind: "fish+fish",
      indices: [...new Set([from, to, ...targets])],
      colorTarget: null,
      homingFlights: targets.map((target, index) => ({ from: index % 2 === 0 ? from : to, target })),
    };
  }
  if ((a === SPECIAL.FISH && b === SPECIAL.BOMB) || (b === SPECIAL.FISH && a === SPECIAL.BOMB)) {
    const fishIndex = a === SPECIAL.FISH ? from : to;
    const target = butterflyTargets(board, fishIndex, { ice: options.ice, targetKinds: options.targetKinds, targetIndices: options.targetIndices, count: 1, exclude: [from, to], rng: options.rng })[0] ?? fishIndex;
    return { kind: "fish+bomb", indices: [...new Set([from, to, ...areaAround(target, 1)])], colorTarget: null, homingFlights: [{ from: fishIndex, target }] };
  }
  const fishStripes = [SPECIAL.STRIPE_H, SPECIAL.STRIPE_V];
  if ((a === SPECIAL.FISH && fishStripes.includes(b)) || (b === SPECIAL.FISH && fishStripes.includes(a))) {
    const fishIndex = a === SPECIAL.FISH ? from : to;
    const stripe = a === SPECIAL.FISH ? b : a;
    const target = butterflyTargets(board, fishIndex, { ice: options.ice, targetKinds: options.targetKinds, targetIndices: options.targetIndices, count: 1, exclude: [from, to], rng: options.rng })[0] ?? fishIndex;
    const line = stripe === SPECIAL.STRIPE_H ? rowIndices(rowOf(target)) : colIndices(colOf(target));
    return { kind: "fish+stripe", indices: [...new Set([from, to, ...line])], colorTarget: null, homingFlights: [{ from: fishIndex, target }] };
  }
  if ((a === SPECIAL.FISH && b === SPECIAL.COLOR) || (b === SPECIAL.FISH && a === SPECIAL.COLOR)) {
    const fishIndex = a === SPECIAL.FISH ? from : to;
    const targets = butterflyTargets(board, fishIndex, { ice: options.ice, targetKinds: options.targetKinds, targetIndices: options.targetIndices, count: 5, exclude: [from, to], rng: options.rng });
    return {
      kind: "fish+color",
      indices: [...new Set([from, to, ...targets])],
      colorTarget: null,
      homingFlights: targets.map((target) => ({ from: fishIndex, target })),
    };
  }

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
  locks = null,
  targetKinds = [],
  targetIndices = [],
  startingCascade = 1,
  from = null,
  to = null,
  rules = {},
  forced = null,
} = {}) {
  let currentBoard = board.slice();
  let currentSpecials = normalizeSpecials(specials);
  let currentIce = normalizeIce(ice);
  let currentLocks = normalizeLockProgress(locks);
  let cascade = startingCascade;
  let scoreGained = 0;
  const transitions = [];
  const clearedKindCounts = Array(TILE_KINDS).fill(0);
  let iceHitCount = 0;
  let specialCreatedCount = 0;
  let specialTriggeredCount = 0;
  let forcedStep = forced;

  while (true) {
    const groups = forcedStep ? [] : findSpecialMatchGroups(currentBoard, currentSpecials, rules, currentLocks.layers);
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
      ice: currentIce,
      targetKinds,
      targetIndices,
      rng,
    });
    const requestedClear = [...expanded.clear].sort((a, b) => a - b);
    const lockChip = chipLockProgress(currentLocks, before, requestedClear);
    const matched = requestedClear.filter((index) => Number(currentLocks.layers[index]) <= 0);
    const matchedForProgress = [...new Set([...matched, ...creationIndices])].sort((a, b) => a - b);
    const locksBefore = currentLocks;
    currentLocks = lockChip.after;
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
    const collapsed = collapseState(clearedBoard, clearedSpecials, rng, currentLocks.layers);

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
      homingFlights: forcedStep?.homingFlights || expanded.triggered
        .filter((trigger) => trigger.special === SPECIAL.FISH)
        .flatMap((trigger) => (trigger.cleared || []).map((target) => ({ from: trigger.index, target }))),
      clearedKindCounts: transitionCounts,
      iceBefore: chipped.before,
      iceAfter: chipped.after,
      iceHits: chipped.hits,
      locksBefore,
      locksAfter: currentLocks,
      lockHits: lockChip.hits,
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
  if (!hasPlayableMove(currentBoard, currentSpecials, rules, currentLocks.layers)) {
    const before = currentBoard.slice();
    const lockedValues = currentLocks.layers.flatMap((layer, index) => Number(layer) > 0 ? [{ index, kind: before[index] }] : []);
    let candidate = before.slice();
    let found = false;
    for (let attempt = 0; attempt < 128; attempt += 1) {
      candidate = createBoard({ rng, rules });
      for (const locked of lockedValues) candidate[locked.index] = locked.kind;
      if (hasPlayableMove(candidate, emptySpecials(), rules, currentLocks.layers)) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error("Cascade could not produce a playable shuffle around locked cells");
    }
    currentBoard = candidate;
    currentSpecials = emptySpecials();
    shuffled = true;
    shuffle = { type: "shuffle", before, after: currentBoard.slice() };
  }

  return {
    board: currentBoard,
    specials: currentSpecials,
    ice: currentIce,
    locks: currentLocks,
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
  const cleanLocks = normalizeLockProgress(options.locks);
  if (!adjacent(from, to)) {
    return { legal: false, reason: "not_adjacent", board: board.slice(), specials: cleanSpecials, ice: normalizeIce(options.ice), locks: cleanLocks, scoreGained: 0, transitions: [] };
  }
  if (cleanLocks.layers[from] > 0 || cleanLocks.layers[to] > 0) {
    return { legal: false, reason: "locked", board: board.slice(), specials: cleanSpecials, ice: normalizeIce(options.ice), locks: cleanLocks, scoreGained: 0, transitions: [] };
  }

  const swappedBoard = swapPair(board, from, to);
  const swappedSpecials = swapPair(cleanSpecials, from, to);
  const combo = comboClear(swappedBoard, swappedSpecials, from, to, { ...options, rng })
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

  if (!findSpecialMatchGroups(swappedBoard, swappedSpecials, options.rules, cleanLocks.layers).length) {
    return {
      legal: false,
      reason: "no_match",
      board: board.slice(),
      specials: cleanSpecials,
      ice: normalizeIce(options.ice),
      locks: cleanLocks,
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
  const cleanLocks = normalizeLockProgress(options.locks);
  if (index < 0 || index >= board.length) {
    return { legal: false, reason: "invalid_index", board: board.slice(), specials: cleanSpecials, ice: cleanIce, locks: cleanLocks, scoreGained: 0, transitions: [] };
  }

  if (cleanLocks.layers[index] > 0) {
    const chippedLocks = chipLockProgress(cleanLocks, board, [index], { allowRecallDirect: true });
    const clearedKindCounts = Array(TILE_KINDS).fill(0);
    const before = board.slice();
    const specialsBefore = cleanSpecials.slice();
    const transition = {
      type: "special-combo",
      combo: "hammer-lock",
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
      iceBefore: cleanIce.slice(),
      iceAfter: cleanIce.slice(),
      iceHits: [],
      locksBefore: cleanLocks,
      locksAfter: chippedLocks.after,
      lockHits: chippedLocks.hits,
    };
    return {
      legal: true,
      index,
      board: before,
      specials: specialsBefore,
      ice: cleanIce,
      locks: chippedLocks.after,
      scoreGained: transition.gained,
      transitions: [transition],
      clearedKindCounts,
      iceHitCount: 0,
      specialCreatedCount: 0,
      specialTriggeredCount: 0,
      shuffled: false,
      shuffle: null,
      maxCascade: 1,
    };
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
      locksBefore: cleanLocks,
      locksAfter: cleanLocks,
      lockHits: [],
    };
    return {
      legal: true,
      index,
      board: before,
      specials: specialsBefore,
      ice: chipped.after,
      locks: cleanLocks,
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
  return applyLevelProgress(levelDefinition, progress, result);
}
