export const SPIDER_GAME_ID = "spider-solitaire";
export const SPIDER_STATE_VERSION = 1;
export const SPIDER_COLUMN_COUNT = 10;
export const SPIDER_COMPLETE_RUN_LENGTH = 13;
export const SPIDER_WIN_RUNS = 8;

export const SPIDER_SUITS = Object.freeze(["spades", "hearts", "diamonds", "clubs"]);
export const SPIDER_DIFFICULTIES = Object.freeze([1, 2, 4]);

function clone(value) {
  return structuredClone(value);
}

function assertDifficulty(difficulty) {
  if (!SPIDER_DIFFICULTIES.includes(difficulty)) {
    throw new Error("Spider difficulty must be 1, 2, or 4 suits.");
  }
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let value = hashSeed(seed) || 0x9e3779b9;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function suitSetForDifficulty(difficulty) {
  if (difficulty === 1) return ["spades"];
  if (difficulty === 2) return ["spades", "hearts"];
  return [...SPIDER_SUITS];
}

export function createSpiderDeck(difficulty) {
  assertDifficulty(difficulty);
  const suits = suitSetForDifficulty(difficulty);
  const copiesPerSuitRank = 8 / suits.length;
  const deck = [];
  let serial = 0;
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      for (let copyIndex = 0; copyIndex < copiesPerSuitRank; copyIndex += 1) {
        serial += 1;
        deck.push({
          id: `${suit}-${rank}-${copyIndex + 1}-${serial}`,
          suit,
          rank,
          faceUp: false,
        });
      }
    }
  }
  return deck;
}

export function shuffleSpiderDeck(deck, seed) {
  const shuffled = deck.map((card) => ({ ...card }));
  const random = randomFromSeed(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function stateCardCount(state) {
  return state.stock.length
    + state.tableau.reduce((sum, column) => sum + column.length, 0)
    + state.completedRuns.length * SPIDER_COMPLETE_RUN_LENGTH;
}

export function validateSpiderState(state) {
  if (!state || typeof state !== "object") throw new Error("Spider state is required.");
  if (state.version !== SPIDER_STATE_VERSION) throw new Error("Unsupported Spider state version.");
  assertDifficulty(state.difficulty);
  if (!Array.isArray(state.tableau) || state.tableau.length !== SPIDER_COLUMN_COUNT) {
    throw new Error("Spider tableau must have exactly 10 columns.");
  }
  if (!Array.isArray(state.stock) || state.stock.length % SPIDER_COLUMN_COUNT !== 0) {
    throw new Error("Spider stock must contain complete 10-card deals.");
  }
  if (!Array.isArray(state.completedRuns) || state.completedRuns.length > SPIDER_WIN_RUNS) {
    throw new Error("Spider completed runs are invalid.");
  }
  if (!Number.isInteger(state.moveCount) || state.moveCount < 0) throw new Error("Spider move count is invalid.");
  if (state.status !== "playing" && state.status !== "won") throw new Error("Spider status is invalid.");
  if (state.status === "won" && state.completedRuns.length !== SPIDER_WIN_RUNS) {
    throw new Error("A won Spider state must contain eight completed runs.");
  }
  if (stateCardCount(state) !== 104) throw new Error("Spider state must account for exactly 104 cards.");

  const ids = new Set();
  const cards = [...state.stock, ...state.tableau.flat()];
  for (const card of cards) {
    if (!card || typeof card.id !== "string" || ids.has(card.id)) throw new Error("Spider card IDs must be unique.");
    if (!SPIDER_SUITS.includes(card.suit) || !Number.isInteger(card.rank) || card.rank < 1 || card.rank > 13) {
      throw new Error("Spider card data is invalid.");
    }
    if (typeof card.faceUp !== "boolean") throw new Error("Spider card visibility is invalid.");
    ids.add(card.id);
  }
  return true;
}

export function createSpiderState({ difficulty = 4, seed = "gameframe-spider" } = {}) {
  assertDifficulty(difficulty);
  const deck = shuffleSpiderDeck(createSpiderDeck(difficulty), seed);
  const tableau = Array.from({ length: SPIDER_COLUMN_COUNT }, () => []);
  let cursor = 0;

  for (let round = 0; round < 5; round += 1) {
    for (let columnIndex = 0; columnIndex < SPIDER_COLUMN_COUNT; columnIndex += 1) {
      tableau[columnIndex].push({ ...deck[cursor], faceUp: false });
      cursor += 1;
    }
  }
  for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
    tableau[columnIndex].push({ ...deck[cursor], faceUp: false });
    cursor += 1;
  }
  for (const column of tableau) column[column.length - 1].faceUp = true;

  const stock = deck.slice(cursor).map((card) => ({ ...card, faceUp: false }));
  const state = {
    version: SPIDER_STATE_VERSION,
    gameId: SPIDER_GAME_ID,
    seed: String(seed),
    difficulty,
    tableau,
    stock,
    completedRuns: [],
    moveCount: 0,
    status: "playing",
  };
  validateSpiderState(state);
  return state;
}

export function movableSequenceStarts(column) {
  if (!Array.isArray(column) || column.length === 0) return [];
  const starts = [];
  for (let start = column.length - 1; start >= 0; start -= 1) {
    const card = column[start];
    if (!card.faceUp) break;
    if (start === column.length - 1) {
      starts.push(start);
      continue;
    }
    const next = column[start + 1];
    if (card.suit !== next.suit || card.rank !== next.rank + 1) break;
    starts.push(start);
  }
  return starts.sort((left, right) => left - right);
}

export function canMoveSpiderSequence(state, fromColumn, startIndex, toColumn) {
  if (state.status !== "playing") return false;
  if (!Number.isInteger(fromColumn) || !Number.isInteger(toColumn) || fromColumn === toColumn) return false;
  if (fromColumn < 0 || fromColumn >= SPIDER_COLUMN_COUNT || toColumn < 0 || toColumn >= SPIDER_COLUMN_COUNT) return false;
  const source = state.tableau[fromColumn];
  const destination = state.tableau[toColumn];
  if (!movableSequenceStarts(source).includes(startIndex)) return false;
  const movingCard = source[startIndex];
  if (destination.length === 0) return true;
  const destinationTop = destination[destination.length - 1];
  return destinationTop.faceUp && destinationTop.rank === movingCard.rank + 1;
}

export function listSpiderMoves(state) {
  if (state.status !== "playing") return [];
  const actions = [];
  for (let fromColumn = 0; fromColumn < SPIDER_COLUMN_COUNT; fromColumn += 1) {
    for (const startIndex of movableSequenceStarts(state.tableau[fromColumn])) {
      for (let toColumn = 0; toColumn < SPIDER_COLUMN_COUNT; toColumn += 1) {
        if (canMoveSpiderSequence(state, fromColumn, startIndex, toColumn)) {
          actions.push({ type: "move", fromColumn, startIndex, toColumn });
        }
      }
    }
  }
  return actions;
}

function completedRunAtTop(column) {
  if (column.length < SPIDER_COMPLETE_RUN_LENGTH) return null;
  const start = column.length - SPIDER_COMPLETE_RUN_LENGTH;
  const run = column.slice(start);
  if (!run.every((card) => card.faceUp)) return null;
  const suit = run[0].suit;
  for (let index = 0; index < run.length; index += 1) {
    if (run[index].suit !== suit || run[index].rank !== 13 - index) return null;
  }
  return { start, suit };
}

function flipExposedTop(column) {
  if (column.length > 0 && !column[column.length - 1].faceUp) column[column.length - 1].faceUp = true;
}

export function settleSpiderRuns(inputState) {
  const state = clone(inputState);
  let changed = true;
  while (changed) {
    changed = false;
    for (const column of state.tableau) {
      const completed = completedRunAtTop(column);
      if (!completed) continue;
      column.splice(completed.start, SPIDER_COMPLETE_RUN_LENGTH);
      state.completedRuns.push(completed.suit);
      flipExposedTop(column);
      changed = true;
      if (state.completedRuns.length === SPIDER_WIN_RUNS) {
        state.status = "won";
        break;
      }
    }
  }
  return state;
}

export function applySpiderMove(inputState, action) {
  validateSpiderState(inputState);
  const { fromColumn, startIndex, toColumn } = action ?? {};
  if (!canMoveSpiderSequence(inputState, fromColumn, startIndex, toColumn)) {
    throw new Error("Illegal Spider move.");
  }
  const state = clone(inputState);
  const moving = state.tableau[fromColumn].splice(startIndex);
  state.tableau[toColumn].push(...moving);
  flipExposedTop(state.tableau[fromColumn]);
  state.moveCount += 1;
  const settled = settleSpiderRuns(state);
  validateSpiderState(settled);
  return settled;
}

export function canDealSpiderStock(state) {
  return state.status === "playing"
    && state.stock.length >= SPIDER_COLUMN_COUNT
    && state.tableau.every((column) => column.length > 0);
}

export function dealSpiderStock(inputState) {
  validateSpiderState(inputState);
  if (!canDealSpiderStock(inputState)) {
    throw new Error(inputState.stock.length < SPIDER_COLUMN_COUNT
      ? "No Spider stock deals remain."
      : "Fill every empty column before dealing from stock.");
  }
  const state = clone(inputState);
  const deal = state.stock.splice(0, SPIDER_COLUMN_COUNT);
  for (let columnIndex = 0; columnIndex < SPIDER_COLUMN_COUNT; columnIndex += 1) {
    state.tableau[columnIndex].push({ ...deal[columnIndex], faceUp: true });
  }
  state.moveCount += 1;
  const settled = settleSpiderRuns(state);
  validateSpiderState(settled);
  return settled;
}

export function validSpiderDestinations(state, fromColumn, startIndex) {
  return Array.from({ length: SPIDER_COLUMN_COUNT }, (_, toColumn) => toColumn)
    .filter((toColumn) => canMoveSpiderSequence(state, fromColumn, startIndex, toColumn));
}

export function cloneSpiderState(state) {
  validateSpiderState(state);
  return clone(state);
}
