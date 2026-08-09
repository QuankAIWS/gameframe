import {
  CASCADE_LEVELS as levels,
  LEVEL_COUNT,
  adjacent,
  applyHammer,
  applySwap,
  createBoard,
  createRng,
} from "./cascade-engine.js";

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
let boardRng = createRng(1);
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

async function presentResolvedResult(result) {
  for (const transition of result.transitions) {
    board = transition.before.slice();
    renderBoard();
    comboLabelElement.textContent = transition.cascade > 1 ? `CASCADE ×${transition.cascade}` : "";
    const tiles = transition.matched
      .map((index) => boardElement.querySelector(`[data-index="${index}"]`))
      .filter(Boolean);
    tiles.forEach((tile) => tile.classList.add("is-clearing"));
    await sleep(190);

    score += transition.gained;
    track("clear", {
      matched: transition.matched.length,
      cascade: transition.cascade,
      gained: transition.gained,
      falls: transition.falls.length,
      spawns: transition.spawns.length,
    });
    board = transition.after.slice();
    renderBoard();
    renderStatus();
    await sleep(145);
  }
  comboLabelElement.textContent = "";

  if (result.shuffled) {
    track("board_shuffle");
    await sleep(110);
  }
  board = result.board.slice();
  renderBoard();
  renderStatus();
}

async function onTileClick(index) {
  if (locked) return;

  if (hammerMode) {
    hammerMode = false;
    state.hammers -= 1;
    const result = applyHammer(board, index, boardRng);
    track("booster_used", { booster: "hammer" });
    locked = true;
    board = result.hammer.cleared.slice();
    renderBoard();
    await sleep(120);
    board = result.hammer.after.slice();
    renderBoard();
    renderStatus();
    await sleep(120);
    await presentResolvedResult(result);
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
  const result = applySwap(board, first, index, boardRng);
  if (!result.legal) {
    if (result.swapped) {
      board = result.swapped.slice();
      renderBoard();
      await sleep(105);
    }
    board = result.board.slice();
    renderBoard();
    track("invalid_swap");
    locked = false;
    return;
  }

  movesRemaining -= 1;
  track("move", { from: first, to: index });
  board = result.swapped.slice();
  renderBoard();
  renderStatus();
  await sleep(80);
  await presentResolvedResult(result);
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
  boardRng = createRng(((activeLevel.level * 0x9e3779b1) ^ Date.now()) >>> 0);
  board = createBoard({ rng: boardRng });
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
