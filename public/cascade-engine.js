export const BOARD_SIZE = 8;
export const TILE_KINDS = 6;
export const LEVEL_COUNT = 20;

export const CASCADE_LEVELS = Object.freeze(Array.from({ length: LEVEL_COUNT }, (_, index) => {
  const level = index + 1;
  const hard = level % 5 === 0;
  return Object.freeze({
    level,
    target: 900 + (level * 185) + (hard ? 550 : 0),
    moves: Math.max(14, 20 - Math.floor(level / 4)) + (hard ? 1 : 0),
    hard,
  });
}));

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

export function findMatches(board) {
  const matched = new Set();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= BOARD_SIZE; col += 1) {
      const index = row * BOARD_SIZE + col;
      const startIndex = row * BOARD_SIZE + start;
      const same = col < BOARD_SIZE && board[index] === board[startIndex] && board[index] !== null;
      if (same) continue;
      if (col - start >= 3) {
        for (let fill = start; fill < col; fill += 1) matched.add(row * BOARD_SIZE + fill);
      }
      start = col;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= BOARD_SIZE; row += 1) {
      const index = row * BOARD_SIZE + col;
      const startIndex = start * BOARD_SIZE + col;
      const same = row < BOARD_SIZE && board[index] === board[startIndex] && board[index] !== null;
      if (same) continue;
      if (row - start >= 3) {
        for (let fill = start; fill < row; fill += 1) matched.add(fill * BOARD_SIZE + col);
      }
      start = row;
    }
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

export function resolveCascades(board, rng, { startingCascade = 1 } = {}) {
  let current = board.slice();
  let cascade = startingCascade;
  let scoreGained = 0;
  const transitions = [];

  while (true) {
    const matches = findMatches(current);
    if (!matches.size) break;

    const matched = [...matches].sort((a, b) => a - b);
    const before = current.slice();
    const cleared = current.slice();
    for (const index of matched) cleared[index] = null;

    const gained = matched.length * 80 * cascade;
    scoreGained += gained;
    const collapsed = collapseBoard(cleared, rng);

    transitions.push({
      type: "cascade",
      cascade,
      matched,
      gained,
      before,
      cleared,
      after: collapsed.board.slice(),
      falls: collapsed.falls,
      spawns: collapsed.spawns,
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
