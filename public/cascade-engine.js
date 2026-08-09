export const BOARD_SIZE = 8;
export const TILE_KINDS = 6;
export const LEVEL_COUNT = 30;

function targetFor(level, hard = false) {
  return 900 + (level * 185) + (hard ? 550 : 0);
}

function level(level, { target, moves, hard = false, mechanics = [] } = {}) {
  return Object.freeze({
    level,
    target: target ?? targetFor(level, hard),
    moves: moves ?? (Math.max(14, 20 - Math.floor(level / 4)) + (hard ? 1 : 0)),
    hard,
    mechanics: Object.freeze(mechanics.slice()),
  });
}

export const CASCADE_LEVELS = Object.freeze([
  level(1), level(2), level(3), level(4), level(5, { hard: true }),
  level(6), level(7), level(8, { mechanics: ["power-match"] }), level(9, { mechanics: ["power-match"] }), level(10, { hard: true, mechanics: ["power-match"] }),
  level(11, { mechanics: ["power-match"] }), level(12, { mechanics: ["power-match"] }),
  level(13, { mechanics: ["power-match", "color-sweep"] }), level(14, { mechanics: ["power-match", "color-sweep"] }), level(15, { hard: true, mechanics: ["power-match", "color-sweep"] }),
  level(16, { mechanics: ["power-match", "color-sweep"] }), level(17, { mechanics: ["power-match", "color-sweep"] }), level(18, { mechanics: ["power-match", "color-sweep"] }), level(19, { mechanics: ["power-match", "color-sweep"] }), level(20, { hard: true, mechanics: ["power-match", "color-sweep"] }),
  level(21, { target: 7600, moves: 15, mechanics: ["power-match", "color-sweep"] }),
  level(22, { target: 8200, moves: 15, mechanics: ["power-match", "color-sweep"] }),
  level(23, { target: 8800, moves: 15, mechanics: ["power-match", "color-sweep"] }),
  level(24, { target: 9400, moves: 15, mechanics: ["power-match", "color-sweep"] }),
  level(25, { target: 10200, moves: 15, hard: true, mechanics: ["power-match", "color-sweep"] }),
  level(26, { target: 10800, moves: 14, mechanics: ["power-match", "color-sweep"] }),
  level(27, { target: 11400, moves: 14, mechanics: ["power-match", "color-sweep"] }),
  level(28, { target: 12100, moves: 14, mechanics: ["power-match", "color-sweep"] }),
  level(29, { target: 12800, moves: 14, mechanics: ["power-match", "color-sweep"] }),
  level(30, { target: 13600, moves: 14, hard: true, mechanics: ["power-match", "color-sweep"] }),
]);

export function createRng(seed) {
  let value = (Number(seed) >>> 0) || 1;
  return {
    next() {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      value >>>= 0;
      return value / 4294967296;
    },
    snapshot() {
      return value >>> 0;
    },
    clone() {
      return createRng(value >>> 0);
    },
  };
}

function randomKind(rng) {
  return Math.floor(rng.next() * TILE_KINDS);
}

function wouldCreateImmediateMatch(candidate, index, board) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  if (col >= 2 && board[index - 1] === candidate && board[index - 2] === candidate) return true;
  if (row >= 2 && board[index - BOARD_SIZE] === candidate && board[index - BOARD_SIZE * 2] === candidate) return true;
  return false;
}

export function adjacent(a, b) {
  const ar = Math.floor(a / BOARD_SIZE);
  const ac = a % BOARD_SIZE;
  const br = Math.floor(b / BOARD_SIZE);
  const bc = b % BOARD_SIZE;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

export function swap(board, a, b) {
  [board[a], board[b]] = [board[b], board[a]];
  return board;
}

export function findMatchGroups(board) {
  const groups = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= BOARD_SIZE; col += 1) {
      const index = row * BOARD_SIZE + col;
      const startIndex = row * BOARD_SIZE + start;
      const kind = board[startIndex];
      const same = col < BOARD_SIZE && kind !== null && board[index] === kind;
      if (same) continue;
      if (kind !== null && col - start >= 3) {
        groups.push({
          orientation: "row",
          kind,
          indices: Array.from({ length: col - start }, (_, offset) => row * BOARD_SIZE + start + offset),
        });
      }
      start = col;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= BOARD_SIZE; row += 1) {
      const index = row * BOARD_SIZE + col;
      const startIndex = start * BOARD_SIZE + col;
      const kind = board[startIndex];
      const same = row < BOARD_SIZE && kind !== null && board[index] === kind;
      if (same) continue;
      if (kind !== null && row - start >= 3) {
        groups.push({
          orientation: "column",
          kind,
          indices: Array.from({ length: row - start }, (_, offset) => (start + offset) * BOARD_SIZE + col),
        });
      }
      start = row;
    }
  }

  return groups;
}

export function findMatches(board) {
  const matched = new Set();
  for (const group of findMatchGroups(board)) {
    for (const index of group.indices) matched.add(index);
  }
  return matched;
}

export function listLegalMoves(board) {
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    const right = index % BOARD_SIZE < BOARD_SIZE - 1 ? index + 1 : -1;
    const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) {
      if (neighbor < 0) continue;
      swap(board, index, neighbor);
      const matched = findMatches(board).size;
      swap(board, index, neighbor);
      if (matched > 0) moves.push({ from: index, to: neighbor, matched });
    }
  }
  return moves;
}

export function hasLegalMove(board) {
  return listLegalMoves(board).length > 0;
}

export function createBoard({ rng }) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const next = [];
    for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
      let candidate = randomKind(rng);
      let guard = 0;
      while (wouldCreateImmediateMatch(candidate, index, next) && guard < 20) {
        candidate = randomKind(rng);
        guard += 1;
      }
      next.push(candidate);
    }
    if (hasLegalMove(next)) return next;
  }
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => randomKind(rng));
}

export function collapseBoard(board, rng) {
  const next = board.slice();
  const falls = [];
  const spawns = [];

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const kept = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const from = row * BOARD_SIZE + col;
      const kind = next[from];
      if (kind !== null) kept.push({ from, kind });
    }

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const to = row * BOARD_SIZE + col;
      const offset = BOARD_SIZE - 1 - row;
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
  }

  return { board: next, falls, spawns };
}

function expandPowerMatches(board, groups) {
  const clearSet = new Set();
  const powerClears = [];
  const colorSweeps = [];

  for (const group of groups) {
    for (const index of group.indices) clearSet.add(index);

    if (group.indices.length >= 5) {
      const swept = [];
      for (let index = 0; index < board.length; index += 1) {
        if (board[index] === group.kind) {
          clearSet.add(index);
          swept.push(index);
        }
      }
      colorSweeps.push({ kind: group.kind, source: group.indices.slice(), cleared: swept });
      continue;
    }

    if (group.indices.length === 4) {
      const anchor = group.indices[Math.floor(group.indices.length / 2)];
      const row = Math.floor(anchor / BOARD_SIZE);
      const col = anchor % BOARD_SIZE;
      const blast = group.orientation === "row"
        ? Array.from({ length: BOARD_SIZE }, (_, offset) => row * BOARD_SIZE + offset)
        : Array.from({ length: BOARD_SIZE }, (_, offset) => offset * BOARD_SIZE + col);
      blast.forEach((index) => clearSet.add(index));
      powerClears.push({ orientation: group.orientation, source: group.indices.slice(), cleared: blast });
    }
  }

  return { clearSet, powerClears, colorSweeps };
}

export function resolveCascades(board, rng, { startingCascade = 1 } = {}) {
  let current = board.slice();
  let cascade = startingCascade;
  let scoreGained = 0;
  const transitions = [];
  let powerClearCount = 0;
  let colorSweepCount = 0;

  while (true) {
    const groups = findMatchGroups(current);
    if (!groups.length) break;

    const originalMatched = new Set();
    for (const group of groups) {
      for (const index of group.indices) originalMatched.add(index);
    }
    const expanded = expandPowerMatches(current, groups);
    const matched = [...expanded.clearSet].sort((a, b) => a - b);
    const before = current.slice();
    const cleared = current.slice();
    for (const index of matched) cleared[index] = null;

    const gained = matched.length * 80 * cascade;
    scoreGained += gained;
    powerClearCount += expanded.powerClears.length;
    colorSweepCount += expanded.colorSweeps.length;
    const collapsed = collapseBoard(cleared, rng);

    transitions.push({
      type: "cascade",
      cascade,
      matchIndices: [...originalMatched].sort((a, b) => a - b),
      matched,
      gained,
      before,
      cleared,
      after: collapsed.board.slice(),
      falls: collapsed.falls,
      spawns: collapsed.spawns,
      powerClears: expanded.powerClears,
      colorSweeps: expanded.colorSweeps,
    });

    current = collapsed.board;
    cascade += 1;
  }

  let shuffled = false;
  let shuffle = null;
  if (!hasLegalMove(current)) {
    const before = current.slice();
    current = createBoard({ rng });
    shuffled = true;
    shuffle = { type: "shuffle", before, after: current.slice() };
  }

  return {
    board: current,
    scoreGained,
    transitions,
    powerClearCount,
    colorSweepCount,
    shuffled,
    shuffle,
    maxCascade: transitions.length ? transitions.at(-1).cascade : 0,
  };
}

export function applySwap(board, from, to, rng) {
  if (!adjacent(from, to)) {
    return { legal: false, reason: "not_adjacent", board: board.slice(), scoreGained: 0, transitions: [] };
  }

  const swapped = board.slice();
  swap(swapped, from, to);
  if (!findMatches(swapped).size) {
    return {
      legal: false,
      reason: "no_match",
      board: board.slice(),
      swapped,
      scoreGained: 0,
      transitions: [],
    };
  }

  const resolved = resolveCascades(swapped, rng);
  return {
    legal: true,
    from,
    to,
    swapped,
    ...resolved,
  };
}

export function applyHammer(board, index, rng) {
  if (index < 0 || index >= board.length) {
    return { legal: false, reason: "invalid_index", board: board.slice(), scoreGained: 0, transitions: [] };
  }
  const cleared = board.slice();
  cleared[index] = null;
  const collapsed = collapseBoard(cleared, rng);
  const resolved = resolveCascades(collapsed.board, rng);
  return {
    legal: true,
    index,
    hammer: {
      type: "hammer",
      index,
      before: board.slice(),
      cleared,
      after: collapsed.board.slice(),
      falls: collapsed.falls,
      spawns: collapsed.spawns,
    },
    ...resolved,
  };
}
