import {
  CASCADE_LEVELS as levels,
  LEVEL_COUNT,
  adjacent,
  applyHammer,
  applyLevelProgress,
  applySwap,
  createBoard,
  createLevelProgress,
  createRng,
  describeLevelObjective,
  objectiveComplete,
} from "./cascade-engine.js";

const LIFE_MAX = 5;
const LIFE_REGEN_MS = 10 * 60 * 1000;
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const PRESENTATION = Object.freeze({
  swap: 170,
  invalidHold: 90,
  anticipateBase: 235,
  anticipateCascadeStep: 35,
  clear: 165,
  fallBase: 225,
  fallCascadeStep: 25,
  landing: 80,
  betweenCascades: 85,
  shuffle: 240,
});

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
const objectiveLabelElement = $("#objective-label");
const helpElement = $(".cascade-help");
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
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function presentationMs(value) {
  return reducedMotion ? Math.min(30, value) : value;
}

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
let levelProgress = createLevelProgress(activeLevel);

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
    const iceLayers = Math.max(0, Number(levelProgress?.ice?.[index]) || 0);
    tile.type = "button";
    tile.className = "cascade-tile";
    tile.dataset.kind = String(kind);
    tile.dataset.index = String(index);
    if (iceLayers > 0) {
      tile.dataset.ice = String(iceLayers);
      tile.classList.add("has-ice", iceLayers > 1 ? "ice-2" : "ice-1");
    }
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", `Tile ${index + 1}${iceLayers ? `, ${iceLayers} ice ${iceLayers === 1 ? "layer" : "layers"}` : ""}`);
    if (selectedIndex === index) tile.classList.add("is-selected");
    if (hammerMode) tile.classList.add("is-hammer-target");
    tile.addEventListener("click", () => onTileClick(index));
    boardElement.append(tile);
  });
}

function mapLabel(level) {
  if (level.hard) return "Hard";
  const hasIce = Boolean(level.objective?.ice);
  const hasCollect = Boolean(level.objective?.collect?.length);
  if (hasIce && hasCollect) return "Mix";
  if (hasIce) return level.objective.ice.layers > 1 ? "Deep ice" : "Ice";
  if (hasCollect) return level.objective.collect.length > 1 ? "Dual" : "Collect";
  if (level.mechanics.includes("cross-blast") && level.level === 61) return "Blast";
  return "Level";
}

function renderLevelMap() {
  levelMapElement.replaceChildren();
  for (const level of levels) {
    const li = document.createElement("li");
    li.dataset.level = String(level.level);
    if (level.level < state.level) li.classList.add("is-complete");
    if (level.level === state.level) li.classList.add("is-current");
    const span = document.createElement("span");
    span.textContent = mapLabel(level);
    li.append(span);
    levelMapElement.append(li);
  }
  levelMapElement.querySelector(".is-current")?.scrollIntoView({ block: "nearest" });
}

function renderHelp() {
  const notes = [];
  if (activeLevel.mechanics.includes("power-match")) notes.push("Match 4 blasts a line");
  if (activeLevel.mechanics.includes("color-sweep")) notes.push("5+ sweeps that color");
  if (activeLevel.mechanics.includes("cross-blast")) notes.push("T/L matches blast a 3×3 area");
  if (activeLevel.objective?.ice) notes.push("clear iced cells to crack the ice");
  if (activeLevel.objective?.collect?.length) notes.push("clear the required colors");
  helpElement.textContent = notes.length ? `${notes.join(" · ")}.` : "Make matches and build cascades before the moves run out.";
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
  objectiveLabelElement.textContent = describeLevelObjective(activeLevel, levelProgress, score);
  renderLedger();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, presentationMs(ms)));
}

function tileAt(index) {
  return boardElement.querySelector(`[data-index="${index}"]`);
}

function tileRect(index) {
  return tileAt(index)?.getBoundingClientRect() ?? null;
}

function animateTileFromTo(from, to, duration = PRESENTATION.fallBase) {
  if (reducedMotion) return;
  const tile = tileAt(to);
  const fromRect = tileRect(from);
  const toRect = tile?.getBoundingClientRect();
  if (!tile || !fromRect || !toRect) return;
  tile.animate([
    {
      transform: `translate(${fromRect.left - toRect.left}px, ${fromRect.top - toRect.top}px) scale(.97)`,
      filter: "brightness(1.08)",
    },
    { transform: "translate(0, 0) scale(1)", filter: "brightness(1)" },
  ], {
    duration,
    easing: "cubic-bezier(.18,.76,.24,1)",
    fill: "both",
  });
}

function animateSwap(from, to, duration = PRESENTATION.swap) {
  if (reducedMotion) return;
  animateTileFromTo(to, from, duration);
  animateTileFromTo(from, to, duration);
}

function animateSpawn(to, spawnOffset, duration) {
  if (reducedMotion) return;
  const tile = tileAt(to);
  if (!tile) return;
  const rect = tile.getBoundingClientRect();
  const cells = Math.max(1, Number(spawnOffset) || 1);
  const distance = Math.min(rect.height * (cells + 1.25), rect.height * 6);
  tile.animate([
    { transform: `translateY(${-distance}px) scale(.88)`, opacity: 0.3 },
    { transform: "translateY(0) scale(1)", opacity: 1 },
  ], {
    duration,
    easing: "cubic-bezier(.16,.78,.26,1)",
    fill: "both",
  });
}

function animateLanding(indices) {
  if (reducedMotion) return;
  for (const index of new Set(indices)) {
    const tile = tileAt(index);
    tile?.animate([
      { transform: "scale(1)" },
      { transform: "scale(1.055)" },
      { transform: "scale(1)" },
    ], {
      duration: PRESENTATION.landing,
      easing: "ease-out",
    });
  }
}

function flashBoard(cascade) {
  boardElement.classList.remove("is-cascade-hit", "is-cascade-big");
  void boardElement.offsetWidth;
  boardElement.classList.add("is-cascade-hit");
  if (cascade >= 3) boardElement.classList.add("is-cascade-big");
  window.setTimeout(() => boardElement.classList.remove("is-cascade-hit", "is-cascade-big"), presentationMs(220));
}

function spawnScorePop(index, gained, cascade) {
  if (reducedMotion) return;
  const rect = tileRect(index);
  if (!rect) return;
  const pop = document.createElement("div");
  pop.className = "cascade-score-pop";
  pop.dataset.cascade = String(Math.min(5, cascade));
  pop.textContent = `+${gained.toLocaleString()}`;
  pop.style.left = `${rect.left + rect.width / 2}px`;
  pop.style.top = `${rect.top + rect.height / 2}px`;
  document.body.append(pop);
  window.setTimeout(() => pop.remove(), 850);
}

function spawnBurst(index, cascade) {
  if (reducedMotion) return;
  const rect = tileRect(index);
  if (!rect) return;
  const burst = document.createElement("div");
  burst.className = "cascade-burst";
  burst.dataset.cascade = String(Math.min(5, cascade));
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  const ring = document.createElement("i");
  ring.className = "cascade-burst-ring";
  burst.append(ring);
  const count = Math.min(12, 5 + cascade * 2);
  for (let particle = 0; particle < count; particle += 1) {
    const spark = document.createElement("i");
    spark.className = "cascade-burst-spark";
    spark.style.setProperty("--spark-angle", `${(360 / count) * particle + (cascade * 7)}deg`);
    spark.style.setProperty("--spark-distance", `${24 + cascade * 7 + (particle % 3) * 5}px`);
    spark.style.setProperty("--spark-delay", `${(particle % 4) * 9}ms`);
    burst.append(spark);
  }
  document.body.append(burst);
  window.setTimeout(() => burst.remove(), 650);
}

function setComboPresentation(cascade) {
  comboLabelElement.classList.remove("is-hot", "is-wild");
  if (cascade <= 1) {
    comboLabelElement.textContent = "MATCH";
    return;
  }
  comboLabelElement.textContent = `CASCADE ×${cascade}`;
  if (cascade >= 3) comboLabelElement.classList.add("is-hot");
  if (cascade >= 5) comboLabelElement.classList.add("is-wild");
}

async function presentFallTransition(transition) {
  levelProgress.ice = transition.iceAfter.slice();
  board = transition.after.slice();
  renderBoard();
  renderStatus();
  const duration = PRESENTATION.fallBase + Math.min(4, transition.cascade - 1) * PRESENTATION.fallCascadeStep;
  const landing = [];
  for (const fall of transition.falls) {
    animateTileFromTo(fall.from, fall.to, duration);
    landing.push(fall.to);
  }
  for (const spawn of transition.spawns) {
    animateSpawn(spawn.to, spawn.spawnOffset, duration + 40);
    landing.push(spawn.to);
  }
  await sleep(duration);
  animateLanding(landing);
  await sleep(PRESENTATION.landing);
}

async function presentResolvedResult(result) {
  for (const transition of result.transitions) {
    levelProgress.ice = transition.iceBefore.slice();
    board = transition.before.slice();
    renderBoard();
    setComboPresentation(transition.cascade);
    const tiles = transition.matched.map(tileAt).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add("is-matched"));
    const anticipate = PRESENTATION.anticipateBase + Math.min(4, transition.cascade - 1) * PRESENTATION.anticipateCascadeStep;
    await sleep(anticipate);
    const scoreAnchor = transition.matched[Math.floor(transition.matched.length / 2)];
    spawnScorePop(scoreAnchor, transition.gained, transition.cascade);
    transition.matched.forEach((index) => spawnBurst(index, transition.cascade));
    tiles.forEach((tile) => {
      tile.classList.remove("is-matched");
      tile.classList.add("is-clearing");
    });
    flashBoard(transition.cascade);
    await sleep(PRESENTATION.clear);
    score += transition.gained;
    levelProgress = applyLevelProgress(activeLevel, levelProgress, transition);
    track("clear", {
      matched: transition.matched.length,
      cascade: transition.cascade,
      gained: transition.gained,
      iceHits: transition.iceHits.length,
      crossBlasts: transition.crossBlasts.length,
      falls: transition.falls.length,
      spawns: transition.spawns.length,
    });
    await presentFallTransition(transition);
    await sleep(PRESENTATION.betweenCascades);
  }

  comboLabelElement.textContent = "";
  comboLabelElement.classList.remove("is-hot", "is-wild");
  if (result.shuffled) {
    track("board_shuffle");
    boardElement.classList.add("is-shuffling");
    await sleep(PRESENTATION.shuffle / 2);
    board = result.board.slice();
    renderBoard();
    boardElement.classList.remove("is-shuffling");
    boardElement.classList.add("is-shuffle-in");
    await sleep(PRESENTATION.shuffle / 2);
    boardElement.classList.remove("is-shuffle-in");
  } else {
    board = result.board.slice();
  }
  levelProgress.ice = result.ice.slice();
  renderBoard();
  renderStatus();
}

async function presentHammer(result) {
  const target = tileAt(result.hammer.index);
  target?.classList.add("is-hammer-hit");
  spawnBurst(result.hammer.index, 2);
  await sleep(150);
  levelProgress = applyLevelProgress(activeLevel, levelProgress, result.hammer);
  board = result.hammer.after.slice();
  renderBoard();
  renderStatus();
  const duration = PRESENTATION.fallBase;
  const landing = [];
  for (const fall of result.hammer.falls) {
    animateTileFromTo(fall.from, fall.to, duration);
    landing.push(fall.to);
  }
  for (const spawn of result.hammer.spawns) {
    animateSpawn(spawn.to, spawn.spawnOffset, duration + 40);
    landing.push(spawn.to);
  }
  await sleep(duration);
  animateLanding(landing);
  await sleep(PRESENTATION.landing);
}

async function onTileClick(index) {
  if (locked) return;
  if (hammerMode) {
    hammerMode = false;
    state.hammers -= 1;
    const result = applyHammer(board, index, boardRng, { mechanics: activeLevel.mechanics, ice: levelProgress.ice });
    track("booster_used", { booster: "hammer" });
    locked = true;
    await presentHammer(result);
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
  const result = applySwap(board, first, index, boardRng, { mechanics: activeLevel.mechanics, ice: levelProgress.ice });
  if (!result.legal) {
    if (result.swapped) {
      board = result.swapped.slice();
      renderBoard();
      animateSwap(first, index, PRESENTATION.swap);
      await sleep(PRESENTATION.swap + PRESENTATION.invalidHold);
    }
    board = result.board.slice();
    renderBoard();
    animateSwap(first, index, PRESENTATION.swap);
    track("invalid_swap");
    await sleep(PRESENTATION.swap);
    locked = false;
    return;
  }
  movesRemaining -= 1;
  track("move", { from: first, to: index });
  board = result.swapped.slice();
  renderBoard();
  animateSwap(first, index, PRESENTATION.swap);
  renderStatus();
  await sleep(PRESENTATION.swap);
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
  if (objectiveComplete(activeLevel, levelProgress, score)) {
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
      title: finalLevel ? `${LEVEL_COUNT} down.` : `Level ${activeLevel.level} cleared.`,
      copy: `${bonus.toLocaleString()} bonus points from ${movesRemaining} unused moves. Streak: ${state.streak}.`,
      actions: [
        button(finalLevel ? `Replay level ${LEVEL_COUNT}` : "Next level", "primary", () => {
          closeResultDialog();
          startLevel(state.level);
        }),
      ],
    });
    return;
  }
  if (movesRemaining > 0) return;
  locked = true;
  track("level_failed", { lives: state.lives, objective: describeLevelObjective(activeLevel, levelProgress, score) });
  showExtraMovesOffer();
}

function showExtraMovesOffer() {
  showDialog({
    kicker: "OUT OF MOVES",
    title: "Objective unfinished.",
    copy: `${describeLevelObjective(activeLevel, levelProgress, score)}. Five more moves and you're right back in it.`,
    eventType: "offer_shown",
    actions: [
      button("Take the loss", "", () => {
        track("offer_decline", { offer: "extra_moves" });
        closeResultDialog();
        consumeLifeAndRetry();
      }),
      button("GET +5 MOVES · 2 IOU$", "iou", () => {
        addIou("Five extra moves", 2);
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
        addIou("Five-life refill", 5);
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
        addIou("Three-hammer bundle", 3);
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
  levelProgress = createLevelProgress(activeLevel);
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
  renderHelp();
  renderLevelMap();
  track("level_start", {
    target: activeLevel.target,
    moves: activeLevel.moves,
    hard: activeLevel.hard,
    mechanics: activeLevel.mechanics,
    objective: activeLevel.objective,
  });
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
  exportLevel() {
    return {
      level: activeLevel,
      progress: levelProgress,
      score,
      movesRemaining,
    };
  },
});
