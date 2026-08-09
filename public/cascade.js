const BOARD_SIZE = 8;
const TILE_KINDS = 6;
const LEVEL_COUNT = 20;
const LIFE_MAX = 5;
const LIFE_REGEN_MS = 10 * 60 * 1000;
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";

const $ = (selector) => document.querySelector(selector);
const boardElement = $("#board");
const levelNumberElement = $("#level-number");
const scoreElement = $("#score");
const targetElement = $("#target");
const movesElement = $("#moves");
const livesElement = $("#lives");
const streakElement = $("#streak");
const hammerCountElement = $("#hammer-count");
const comboLabelElement = $("#combo-label");
const levelMapElement = $("#level-map");
const resultDialog = $("#result-dialog");
const resultKicker = $("#result-kicker");
const resultTitle = $("#result-title");
const resultCopy = $("#result-copy");
const resultActions = $("#result-actions");
const ledgerDialog = $("#ledger-dialog");
const ledgerList = $("#ledger-list");
const iouTotalElement = $("#iou-total");
const boosterButton = $("#booster-hammer");

const levels = Array.from({ length: LEVEL_COUNT }, (_, index) => {
  const level = index + 1;
  const hard = level % 5 === 0;
  return {
    level,
    target: 900 + (level * 185) + (hard ? 550 : 0),
    moves: Math.max(14, 20 - Math.floor(level / 4)) + (hard ? 1 : 0),
    hard,
  };
});

function defaultState() {
  return {
    level: 1,
    lives: LIFE_MAX,
    lastLifeAt: Date.now(),
    streak: 0,
    hammers: 2,
    ledger: [],
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      level: Math.min(LEVEL_COUNT, Math.max(1, Number(parsed.level) || 1)),
      lives: Math.min(LIFE_MAX, Math.max(0, Number(parsed.lives) || 0)),
      streak: Math.max(0, Number(parsed.streak) || 0),
      hammers: Math.max(0, Number(parsed.hammers) || 0),
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
    };
  } catch {
    return defaultState();
  }
}

let state = loadState();
let board = [];
let score = 0;
let movesRemaining = 0;
let selectedIndex = null;
let locked = false;
let hammerMode = false;
let activeLevel = levels[state.level - 1];

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function track(type, detail = {}) {
  try {
    const events = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    events.push({
      at: new Date().toISOString(),
      type,
      level: activeLevel.level,
      score,
      movesRemaining,
      ...detail,
    });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Local telemetry must never break gameplay.
  }
}

function applyLifeRegen() {
  if (state.lives >= LIFE_MAX) {
    state.lastLifeAt = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = Math.max(0, now - (Number(state.lastLifeAt) || now));
  const restored = Math.floor(elapsed / LIFE_REGEN_MS);
  if (restored <= 0) return;
  state.lives = Math.min(LIFE_MAX, state.lives + restored);
  state.lastLifeAt += restored * LIFE_REGEN_MS;
  saveState();
}

function iouTotal() {
  return state.ledger.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function addIou(reason, amount) {
  state.ledger.push({
    at: new Date().toISOString(),
    reason,
    amount,
    level: activeLevel.level,
  });
  saveState();
  track("iou_accept", { reason, amount, total: iouTotal() });
  renderLedger();
}

function renderLedger() {
  const total = iouTotal();
  iouTotalElement.textContent = `IOU$ ${total.toLocaleString()}`;
  ledgerList.replaceChildren();
  if (!state.ledger.length) {
    const empty = document.createElement("li");
    empty.innerHTML = "<span>No IOUs yet.</span><strong>IOU$ 0</strong>";
    ledgerList.append(empty);
    return;
  }
  for (const item of [...state.ledger].reverse()) {
    const li = document.createElement("li");
    const time = new Date(item.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    li.innerHTML = `<span>${escapeHtml(item.reason)} · L${item.level} · ${time}</span><strong>+${item.amount} IOU$</strong>`;
    ledgerList.append(li);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function seededRandomFactory(seed) {
  let value = (seed >>> 0) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

let random = Math.random;

function randomKind() {
  return Math.floor(random() * TILE_KINDS);
}

function wouldCreateImmediateMatch(candidate, index, currentBoard) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  if (col >= 2 && currentBoard[index - 1] === candidate && currentBoard[index - 2] === candidate) return true;
  if (row >= 2 && currentBoard[index - BOARD_SIZE] === candidate && currentBoard[index - BOARD_SIZE * 2] === candidate) return true;
  return false;
}

function createBoard() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const next = [];
    for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
      let candidate = randomKind();
      let guard = 0;
      while (wouldCreateImmediateMatch(candidate, index, next) && guard < 20) {
        candidate = randomKind();
        guard += 1;
      }
      next.push(candidate);
    }
    if (hasLegalMove(next)) return next;
  }
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => randomKind());
}

function adjacent(a, b) {
  const ar = Math.floor(a / BOARD_SIZE);
  const ac = a % BOARD_SIZE;
  const br = Math.floor(b / BOARD_SIZE);
  const bc = b % BOARD_SIZE;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function swap(array, a, b) {
  [array[a], array[b]] = [array[b], array[a]];
}

function findMatches(currentBoard = board) {
  const matched = new Set();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= BOARD_SIZE; col += 1) {
      const index = row * BOARD_SIZE + col;
      const startIndex = row * BOARD_SIZE + start;
      const same = col < BOARD_SIZE && currentBoard[index] === currentBoard[startIndex] && currentBoard[index] !== null;
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
      const same = row < BOARD_SIZE && currentBoard[index] === currentBoard[startIndex] && currentBoard[index] !== null;
      if (same) continue;
      if (row - start >= 3) {
        for (let fill = start; fill < row; fill += 1) matched.add(fill * BOARD_SIZE + col);
      }
      start = row;
    }
  }

  return matched;
}

function hasLegalMove(currentBoard) {
  for (let index = 0; index < currentBoard.length; index += 1) {
    const right = index % BOARD_SIZE < BOARD_SIZE - 1 ? index + 1 : -1;
    const down = index + BOARD_SIZE < currentBoard.length ? index + BOARD_SIZE : -1;
    for (const neighbor of [right, down]) {
      if (neighbor < 0) continue;
      swap(currentBoard, index, neighbor);
      const legal = findMatches(currentBoard).size > 0;
      swap(currentBoard, index, neighbor);
      if (legal) return true;
    }
  }
  return false;
}

function collapseBoard() {
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const kept = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const value = board[row * BOARD_SIZE + col];
      if (value !== null) kept.push(value);
    }
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const offset = BOARD_SIZE - 1 - row;
      board[row * BOARD_SIZE + col] = kept[offset] ?? randomKind();
    }
  }
}

function renderBoard() {
  boardElement.replaceChildren();
  board.forEach((kind, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "cascade-tile";
    tile.dataset.kind = String(kind);
    tile.dataset.index = String(index);
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", `Tile ${index + 1}`);
    if (selectedIndex === index) tile.classList.add("is-selected");
    if (hammerMode) tile.classList.add("is-hammer-target");
    tile.addEventListener("click", () => onTileClick(index));
    boardElement.append(tile);
  });
}

function renderLevelMap() {
  levelMapElement.replaceChildren();
  for (const level of levels) {
    const li = document.createElement("li");
    li.dataset.level = String(level.level);
    if (level.level < state.level) li.classList.add("is-complete");
    if (level.level === state.level) li.classList.add("is-current");
    const span = document.createElement("span");
    span.textContent = level.hard ? "Hard" : "Level";
    li.append(span);
    levelMapElement.append(li);
  }
  levelMapElement.querySelector(".is-current")?.scrollIntoView({ block: "nearest" });
}

function renderStatus() {
  levelNumberElement.textContent = activeLevel.level;
  scoreElement.textContent = score.toLocaleString();
  targetElement.textContent = activeLevel.target.toLocaleString();
  movesElement.textContent = movesRemaining;
  livesElement.textContent = state.lives > 0 ? "♥".repeat(state.lives) : "0";
  livesElement.title = state.lives < LIFE_MAX ? "One life regenerates every 10 minutes." : "Lives full.";
  streakElement.textContent = state.streak;
  hammerCountElement.textContent = state.hammers;
  boosterButton.disabled = locked;
  renderLedger();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveMatches() {
  let cascade = 1;
  let matches = findMatches();
  while (matches.size) {
    comboLabelElement.textContent = cascade > 1 ? `CASCADE ×${cascade}` : "";
    const tiles = [...matches].map((index) => boardElement.querySelector(`[data-index="${index}"]`)).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add("is-clearing"));
    await sleep(135);
    for (const index of matches) board[index] = null;
    const gained = matches.size * 80 * cascade;
    score += gained;
    track("clear", { matched: matches.size, cascade, gained });
    collapseBoard();
    renderBoard();
    renderStatus();
    await sleep(95);
    cascade += 1;
    matches = findMatches();
  }
  comboLabelElement.textContent = "";

  if (!hasLegalMove(board)) {
    track("board_shuffle");
    random = seededRandomFactory((activeLevel.level * 100003) + Date.now());
    board = createBoard();
    renderBoard();
  }
}

async function onTileClick(index) {
  if (locked) return;

  if (hammerMode) {
    hammerMode = false;
    state.hammers -= 1;
    board[index] = null;
    track("booster_used", { booster: "hammer" });
    collapseBoard();
    renderBoard();
    renderStatus();
    locked = true;
    await resolveMatches();
    locked = false;
    await checkLevelEnd();
    return;
  }

  if (selectedIndex === null) {
    selectedIndex = index;
    renderBoard();
    return;
  }

  if (selectedIndex === index) {
    selectedIndex = null;
    renderBoard();
    return;
  }

  const first = selectedIndex;
  selectedIndex = null;

  if (!adjacent(first, index)) {
    selectedIndex = index;
    renderBoard();
    return;
  }

  locked = true;
  swap(board, first, index);
  renderBoard();
  const matches = findMatches();

  if (!matches.size) {
    await sleep(105);
    swap(board, first, index);
    renderBoard();
    track("invalid_swap");
    locked = false;
    return;
  }

  movesRemaining -= 1;
  track("move", { from: first, to: index });
  renderStatus();
  await resolveMatches();
  locked = false;
  await checkLevelEnd();
}

function button(label, className, handler, disabled = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (className) element.className = className;
  element.disabled = disabled;
  element.addEventListener("click", handler);
  return element;
}

function showDialog({ kicker, title, copy, actions, eventType }) {
  resultKicker.textContent = kicker;
  resultTitle.textContent = title;
  resultCopy.textContent = copy;
  resultActions.replaceChildren(...actions);
  if (eventType) track(eventType);
  if (!resultDialog.open) resultDialog.showModal();
}

function closeResultDialog() {
  if (resultDialog.open) resultDialog.close();
}

async function checkLevelEnd() {
  if (score >= activeLevel.target) {
    locked = true;
    const bonus = movesRemaining * 100;
    score += bonus;
    state.streak += 1;
    if (activeLevel.level < LEVEL_COUNT) state.level = activeLevel.level + 1;
    saveState();
    renderStatus();
    renderLevelMap();
    track("level_win", { bonus, streak: state.streak });

    const finalLevel = activeLevel.level === LEVEL_COUNT;
    showDialog({
      kicker: finalLevel ? "RUN COMPLETE" : "LEVEL COMPLETE",
      title: finalLevel ? "Twenty down." : `Level ${activeLevel.level} cleared.`,
      copy: `${bonus.toLocaleString()} bonus points from ${movesRemaining} unused moves. Streak: ${state.streak}.`,
      actions: [
        button(finalLevel ? "Replay level 20" : "Next level", "primary", () => {
          closeResultDialog();
          startLevel(state.level);
        }),
      ],
    });
    return;
  }

  if (movesRemaining > 0) return;
  locked = true;
  track("level_failed", { lives: state.lives });
  showExtraMovesOffer();
}

function showExtraMovesOffer() {
  const amount = 2;
  showDialog({
    kicker: "OUT OF MOVES",
    title: `Only ${Math.max(0, activeLevel.target - score).toLocaleString()} points short.`,
    copy: "Five more moves and you're right back in it.",
    eventType: "offer_shown",
    actions: [
      button("Take the loss", "", () => {
        track("offer_decline", { offer: "extra_moves" });
        closeResultDialog();
        consumeLifeAndRetry();
      }),
      button("GET +5 MOVES · 2 IOU$", "iou", () => {
        addIou("Five extra moves", amount);
        movesRemaining += 5;
        locked = false;
        closeResultDialog();
        renderStatus();
      }),
    ],
  });
}

function consumeLifeAndRetry() {
  state.streak = 0;
  if (state.lives > 0) {
    state.lives -= 1;
    state.lastLifeAt = Date.now();
  }
  saveState();
  renderStatus();
  if (state.lives > 0) {
    startLevel(activeLevel.level);
    return;
  }
  showLivesOffer();
}

function showLivesOffer() {
  const amount = 5;
  showDialog({
    kicker: "OUT OF LIVES",
    title: "Keep playing?",
    copy: "Refill all five lives and jump straight back in.",
    eventType: "offer_shown",
    actions: [
      button("I'll wait", "", () => {
        track("offer_decline", { offer: "lives_refill" });
        closeResultDialog();
      }),
      button("REFILL 5 LIVES · 5 IOU$", "iou", () => {
        addIou("Five-life refill", amount);
        state.lives = LIFE_MAX;
        state.lastLifeAt = Date.now();
        saveState();
        closeResultDialog();
        startLevel(activeLevel.level);
      }),
    ],
  });
}

function showHammerOffer() {
  const amount = 3;
  showDialog({
    kicker: "NO HAMMERS",
    title: "Need more firepower?",
    copy: "Grab three fresh hammers instantly.",
    eventType: "offer_shown",
    actions: [
      button("Not now", "", () => {
        track("offer_decline", { offer: "hammer_bundle" });
        closeResultDialog();
      }),
      button("GET 3 HAMMERS · 3 IOU$", "iou", () => {
        addIou("Three-hammer bundle", amount);
        state.hammers += 3;
        saveState();
        closeResultDialog();
        renderStatus();
      }),
    ],
  });
}

function startLevel(levelNumber = state.level) {
  applyLifeRegen();
  state.level = Math.min(LEVEL_COUNT, Math.max(1, levelNumber));
  activeLevel = levels[state.level - 1];
  score = 0;
  movesRemaining = activeLevel.moves;
  selectedIndex = null;
  hammerMode = false;
  locked = false;
  random = seededRandomFactory((activeLevel.level * 0x9e3779b1) ^ Date.now());
  board = createBoard();
  saveState();
  renderBoard();
  renderStatus();
  renderLevelMap();
  track("level_start", { target: activeLevel.target, moves: activeLevel.moves, hard: activeLevel.hard });
}

boosterButton.addEventListener("click", () => {
  if (locked) return;
  if (state.hammers <= 0) {
    showHammerOffer();
    return;
  }
  hammerMode = !hammerMode;
  selectedIndex = null;
  renderBoard();
  track("booster_armed", { booster: "hammer", armed: hammerMode });
});

$("#open-ledger").addEventListener("click", () => {
  renderLedger();
  ledgerDialog.showModal();
});

$("#reset-ledger").addEventListener("click", () => {
  state.ledger = [];
  saveState();
  renderLedger();
  track("ledger_reset");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    applyLifeRegen();
    renderStatus();
  }
});

applyLifeRegen();
renderLedger();
renderLevelMap();
startLevel(state.level);

window.cascadeResearch = Object.freeze({
  exportEvents() {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
  },
  exportState() {
    return JSON.parse(localStorage.getItem(STATE_KEY) || "null");
  },
});
