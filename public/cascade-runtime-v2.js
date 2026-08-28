import {
  BOARD_SIZE,
  CASCADE_LEVELS as levels,
  LEVEL_COUNT,
  SPECIAL,
  TILE_KINDS,
  adjacent,
  applySpecialHammer,
  applySpecialLevelProgress,
  applySpecialSwap,
  createBoard,
  createLevelProgress,
  createRng,
  describeLevelObjective,
  emptySpecials,
  objectiveComplete,
} from "./cascade-special-engine.js";
import { cascadePresentationDirector as presentation } from "./cascade-presentation-director.js";
import { HAMMER_MAX, HAMMER_STAR_STEP, resolveStarHammerReward } from "./cascade-hammer-economy.js";

const LIFE_MAX = 5;
const LIFE_REGEN_MS = 10 * 60 * 1000;
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const ACTIVE_RUN_VERSION = 1;
const BOARD_CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const VALID_SPECIALS = new Set(Object.values(SPECIAL));
const BLITZ_SECONDS = 30;
const BLITZ_AFTER_LEVELS = Object.freeze(new Set([
  5, 12, 20, 30, 45, 60, 75, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290,
  310, 330, 350, 370, 390, 410, 430,
]));
const LEVEL_MAP_WINDOW = 30;
const PRESENTATION = Object.freeze({
  swap: 150,
  invalidHold: 75,
  anticipateBase: 150,
  anticipateCascadeStep: 25,
  clear: 135,
  fallBase: 185,
  fallCascadeStep: 18,
  landing: 65,
  betweenCascades: 55,
  shuffle: 220,
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
const boosterButton = $("#booster-hammer");
const starsElement = $("#level-stars");
const starProgressElement = $("#star-progress");
const bonusStatusElement = $("#bonus-status");
const blitzOverlay = $("#blitz-overlay");
const blitzCallout = $("#blitz-callout");
const blitzClock = $("#blitz-clock");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function defaultState() {
  return {
    level: 1,
    lives: LIFE_MAX,
    lastLifeAt: Date.now(),
    streak: 0,
    hammers: 2,
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return defaultState();
    return {
      ...defaultState(),
      level: Math.min(LEVEL_COUNT, Math.max(1, Number(parsed.level) || 1)),
      lives: Math.min(LIFE_MAX, Math.max(0, Number(parsed.lives) || 0)),
      lastLifeAt: Number(parsed.lastLifeAt) || Date.now(),
      streak: Math.max(0, Number(parsed.streak) || 0),
      hammers: Math.min(HAMMER_MAX, Math.max(0, Number(parsed.hammers) || 0)),
    };
  } catch {
    return defaultState();
  }
}

function defaultPerformance() {
  return {
    starsByLevel: {},
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
  };
}

function loadPerformance() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return defaultPerformance();
    const hadLegacyHammerBank = Object.prototype.hasOwnProperty.call(parsed, "pendingHammerRewards");
    const { pendingHammerRewards: _discardedLegacyHammerBank, ...persisted } = parsed;
    const normalized = {
      ...defaultPerformance(),
      ...persisted,
      starsByLevel: parsed.starsByLevel && typeof parsed.starsByLevel === "object" ? parsed.starsByLevel : {},
      blitzBest: parsed.blitzBest && typeof parsed.blitzBest === "object" ? parsed.blitzBest : {},
      blitzStars: parsed.blitzStars && typeof parsed.blitzStars === "object" ? parsed.blitzStars : {},
      blitzSeen: parsed.blitzSeen && typeof parsed.blitzSeen === "object" ? parsed.blitzSeen : {},
    };
    if (hadLegacyHammerBank) {
      try {
        localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(normalized));
      } catch {
        // The in-memory migration is authoritative for this session even if the
        // browser refuses the cleanup write. The legacy bank is never loaded.
      }
    }
    return normalized;
  } catch {
    return defaultPerformance();
  }
}

let state = loadState();
let performance = loadPerformance();
let board = [];
let specials = emptySpecials();
let boardRng = createRng(1);
let score = 0;
let movesRemaining = 0;
let selectedIndex = null;
let locked = false;
let hammerMode = false;
let mode = "normal";
let activeLevel = levels[state.level - 1];
let levelProgress = createLevelProgress(activeLevel);
let blitzTimerHandle = null;
let blitzEndsAt = 0;
let blitzExpired = false;
let blitzReturningLevel = 1;
let blitzId = "";
let blitzStats = { matches: 0, specials: 0, cascades: 0 };
let finishingBlitz = false;

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function savePerformance() {
  localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(performance));
}

function clearActiveRun() {
  localStorage.removeItem(ACTIVE_RUN_KEY);
}

function saveActiveRun() {
  if (mode !== "normal" || !activeLevel || board.length !== BOARD_CELL_COUNT || movesRemaining <= 0) return;
  localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify({
    version: ACTIVE_RUN_VERSION,
    level: activeLevel.level,
    board: board.slice(),
    specials: specials.slice(),
    score: Math.max(0, Number(score) || 0),
    movesRemaining: Math.max(0, Math.floor(Number(movesRemaining) || 0)),
    levelProgress: {
      collected: Array.isArray(levelProgress?.collected) ? levelProgress.collected.slice() : [],
      ice: Array.isArray(levelProgress?.ice) ? levelProgress.ice.slice() : [],
    },
    rngState: boardRng.snapshot(),
    savedAt: Date.now(),
  }));
}

function loadActiveRun(levelNumber) {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || parsed.version !== ACTIVE_RUN_VERSION) return null;
    if (Number(parsed.level) !== Number(levelNumber)) return null;
    const level = levels[levelNumber - 1];
    if (!level) return null;
    if (!Array.isArray(parsed.board) || parsed.board.length !== BOARD_CELL_COUNT) return null;
    const savedBoard = parsed.board.map((value) => Number(value));
    if (savedBoard.some((value) => !Number.isInteger(value) || value < 0 || value >= TILE_KINDS)) return null;
    if (!Array.isArray(parsed.specials) || parsed.specials.length !== BOARD_CELL_COUNT) return null;
    if (parsed.specials.some((value) => value !== null && !VALID_SPECIALS.has(value))) return null;
    const savedMoves = Math.floor(Number(parsed.movesRemaining));
    if (!Number.isFinite(savedMoves) || savedMoves <= 0 || savedMoves > level.moves) return null;
    const savedScore = Number(parsed.score);
    if (!Number.isFinite(savedScore) || savedScore < 0) return null;
    const baseline = createLevelProgress(level);
    if (!Array.isArray(parsed.levelProgress?.collected) || parsed.levelProgress.collected.length !== baseline.collected.length) return null;
    if (!Array.isArray(parsed.levelProgress?.ice) || parsed.levelProgress.ice.length !== baseline.ice.length) return null;
    const collected = parsed.levelProgress.collected.map((value) => Math.max(0, Math.floor(Number(value) || 0)));
    const ice = parsed.levelProgress.ice.map((value) => Math.max(0, Math.floor(Number(value) || 0)));
    const rngState = Number(parsed.rngState) >>> 0;
    if (!rngState) return null;
    return {
      board: savedBoard,
      specials: parsed.specials.slice(),
      score: savedScore,
      movesRemaining: savedMoves,
      levelProgress: { collected, ice },
      rngState,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

function track(type, detail = {}) {
  try {
    const events = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    events.push({
      at: new Date().toISOString(),
      type,
      mode,
      level: activeLevel?.level ?? null,
      score,
      movesRemaining,
      ...detail,
    });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Local telemetry must never interfere with play.
  }
}

function applyLifeRegen() {
  if (state.lives >= LIFE_MAX) {
    state.lastLifeAt = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = Math.max(0, now - state.lastLifeAt);
  const restored = Math.floor(elapsed / LIFE_REGEN_MS);
  if (restored <= 0) return;
  state.lives = Math.min(LIFE_MAX, state.lives + restored);
  state.lastLifeAt += restored * LIFE_REGEN_MS;
  saveState();
}

function totalBestStars() {
  const normal = Object.values(performance.starsByLevel).reduce((sum, value) => sum + Math.max(0, Math.min(3, Number(value) || 0)), 0);
  const blitz = Object.values(performance.blitzStars).reduce((sum, value) => sum + Math.max(0, Math.min(3, Number(value) || 0)), 0);
  return normal + blitz;
}

function awardBestStars(bucket, key, stars) {
  const previousTotal = totalBestStars();
  const previous = Math.max(0, Math.min(3, Number(performance[bucket]?.[key]) || 0));
  const best = Math.max(previous, Math.max(0, Math.min(3, Number(stars) || 0)));
  performance[bucket][key] = best;
  const nextTotal = previousTotal + (best - previous);
  const hammerReward = resolveStarHammerReward({
    hammers: state.hammers,
    previousStars: previousTotal,
    nextStars: nextTotal,
  });
  if (hammerReward.granted > 0) {
    state.hammers = hammerReward.hammers;
    saveState();
  }
  savePerformance();
  return {
    previous,
    best,
    total: nextTotal,
    rewards: hammerReward.granted,
    claimed: hammerReward.granted,
    discarded: hammerReward.discarded,
  };
}

function calculateLevelStars(level, remaining) {
  const totalMoves = Math.max(1, Number(level.moves) || 1);
  const left = Math.max(0, Number(remaining) || 0);
  if (left >= Math.max(4, Math.ceil(totalMoves * 0.30))) return 3;
  if (left >= Math.max(2, Math.ceil(totalMoves * 0.15))) return 2;
  return 1;
}

function calculateBlitzStars(value) {
  if (value >= 9000) return 3;
  if (value >= 5000) return 2;
  return value > 0 ? 1 : 0;
}

function starGlyphs(count) {
  const earned = Math.max(0, Math.min(3, Number(count) || 0));
  return `${"★".repeat(earned)}${"☆".repeat(3 - earned)}`;
}

function presentationMs(value) {
  if (mode === "blitz") return reducedMotion ? Math.min(20, value) : Math.max(35, Math.round(value * 0.58));
  return reducedMotion ? Math.min(30, value) : value;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, presentationMs(ms)));
}

function rulesForLevel(levelNumber) {
  return {
    stripe: levelNumber >= 2,
    bomb: levelNumber >= 3,
    color: levelNumber >= 5,
    fish: levelNumber >= 6,
  };
}

function currentRules() {
  if (mode === "blitz") return { stripe: true, bomb: true, color: true, fish: state.level >= 6 };
  return rulesForLevel(activeLevel.level);
}

function remainingTargetKinds() {
  if (mode !== "normal") return [];
  return (activeLevel.objective?.collect || [])
    .filter((goal) => Number(levelProgress?.collected?.[goal.kind] || 0) < goal.count)
    .map((goal) => goal.kind);
}

function specialName(value) {
  if (value === SPECIAL.STRIPE_H || value === SPECIAL.STRIPE_V) return "striped line clearer";
  if (value === SPECIAL.BOMB) return "burst bomb";
  if (value === SPECIAL.COLOR) return "color clearer";
  if (value === SPECIAL.FISH) return "fish";
  return "";
}

function renderBoard() {
  boardElement.replaceChildren();
  board.forEach((kind, index) => {
    const tile = document.createElement("button");
    const special = specials[index];
    const iceLayers = mode === "normal" ? Math.max(0, Number(levelProgress?.ice?.[index]) || 0) : 0;
    tile.type = "button";
    tile.className = "cascade-tile";
    tile.dataset.kind = String(kind);
    tile.dataset.index = String(index);
    if (special) {
      tile.dataset.special = special;
      tile.classList.add("has-special");
      const mark = document.createElement("span");
      mark.className = "cascade-special-mark";
      mark.setAttribute("aria-hidden", "true");
      tile.append(mark);
    }
    if (iceLayers > 0) {
      tile.dataset.ice = String(iceLayers);
      tile.classList.add("has-ice", iceLayers > 1 ? "ice-2" : "ice-1");
    }
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", `Tile ${index + 1}${special ? `, ${specialName(special)}` : ""}${iceLayers ? `, ${iceLayers} ice ${iceLayers === 1 ? "layer" : "layers"}` : ""}`);
    if (selectedIndex === index) tile.classList.add("is-selected");
    if (hammerMode) tile.classList.add("is-hammer-target");
    tile.addEventListener("click", () => onTileClick(index));
    boardElement.append(tile);
  });
}

function mapLabel(level) {
  if (level.level === 1) return "Match 3";
  if (level.level === 2) return "Stripes";
  if (level.level === 3) return "Bombs";
  if (level.level === 4) return "Combos";
  if (level.level === 5) return "Color";
  if (level.level === 6) return "Fish";
  if (level.difficulty === "super-hard") return "Super hard";
  if (level.difficulty === "hard" || level.hard) return "Hard";
  const hasIce = Boolean(level.objective?.ice);
  const hasCollect = Boolean(level.objective?.collect?.length);
  if (hasIce && hasCollect) return "Mix";
  if (hasIce) return level.objective.ice.layers > 1 ? "Deep ice" : "Ice";
  if (hasCollect) return level.objective.collect.length > 1 ? "Dual" : "Collect";
  return "Level";
}

function renderLevelMap() {
  levelMapElement.replaceChildren();
  const referenceLevel = mode === "normal" ? state.level : Math.max(1, blitzReturningLevel || state.level);
  const chapterStart = Math.floor((referenceLevel - 1) / LEVEL_MAP_WINDOW) * LEVEL_MAP_WINDOW + 1;
  const chapterEnd = Math.min(LEVEL_COUNT, chapterStart + LEVEL_MAP_WINDOW - 1);
  const visibleLevels = levels.slice(chapterStart - 1, chapterEnd);

  for (const level of visibleLevels) {
    const li = document.createElement("li");
    li.dataset.level = String(level.level);
    if (level.level < state.level) li.classList.add("is-complete");
    if (mode === "normal" && level.level === state.level) li.classList.add("is-current");
    const span = document.createElement("span");
    span.textContent = mapLabel(level);
    const best = Math.max(0, Number(performance.starsByLevel[String(level.level)]) || 0);
    if (best) {
      const badge = document.createElement("b");
      badge.className = "cascade-map-stars";
      badge.textContent = starGlyphs(best);
      badge.title = `Best rating: ${best} of 3 stars`;
      badge.setAttribute("aria-label", `Best rating: ${best} of 3 stars`);
      li.append(span, badge);
    } else {
      li.append(span);
    }
    levelMapElement.append(li);
  }
  levelMapElement.dataset.range = `${chapterStart}-${chapterEnd}`;
  levelMapElement.querySelector(".is-current")?.scrollIntoView({ block: "nearest" });
}

function renderHelp() {
  if (mode === "blitz") {
    helpElement.textContent = "No move limit. No life at risk. Make as much trouble as you can before the clock hits zero.";
    return;
  }
  if (activeLevel.level === 1) {
    helpElement.textContent = "Match three. Cascades score more. Take your time.";
  } else if (activeLevel.level === 2) {
    helpElement.textContent = "Match four to make a striped piece. Match that piece later to wipe its whole line.";
  } else if (activeLevel.level === 3) {
    helpElement.textContent = "Make a T or L match to build a bomb. Trigger it later for a 3×3 burst.";
  } else if (activeLevel.level === 4) {
    helpElement.textContent = "Get two specials next to each other and swap them together for a bigger hit.";
  } else if (activeLevel.level === 5) {
    helpElement.textContent = "Match five to make a color clearer. Swap it with a color to sweep that color off the board.";
  } else if (activeLevel.level === 6) {
    helpElement.textContent = "Make a 2×2 square of one color to create a Fish. Trigger it and it swims to something you still need.";
  } else {
    const notes = [];
    if (activeLevel.objective?.ice) notes.push("crack every iced cell");
    if (activeLevel.objective?.collect?.length) notes.push("collect the required colors");
    if (activeLevel.mechanics?.includes("fish")) notes.push("make 2×2 Fish for useful objective hits");
    notes.push("build specials and combine them when you can");
    helpElement.textContent = `${notes.join(" · ")}.`;
  }
}

function renderPerformance() {
  const total = totalBestStars();
  const best = mode === "normal" ? Math.max(0, Number(performance.starsByLevel[String(activeLevel.level)]) || 0) : 0;
  if (starsElement) {
    starsElement.textContent = mode === "blitz" ? "BLITZ" : starGlyphs(best);
    starsElement.setAttribute("aria-label", mode === "blitz" ? "Blitz bonus round" : `${best} of 3 best stars on level ${activeLevel.level}`);
  }
  if (starProgressElement) {
    const nextThreshold = (Math.floor(total / HAMMER_STAR_STEP) + 1) * HAMMER_STAR_STEP;
    starProgressElement.textContent = state.hammers >= HAMMER_MAX
      ? `${total} total stars · hammers full`
      : `${total} total stars · next hammer at ${nextThreshold}`;
  }
  if (bonusStatusElement) {
    if (mode === "blitz") {
      const bestScore = Math.max(0, Number(performance.blitzBest[blitzId]) || 0);
      bonusStatusElement.hidden = false;
      bonusStatusElement.textContent = bestScore ? `BEST BLITZ · ${bestScore.toLocaleString()}` : "30-SECOND BONUS ROUND";
    } else {
      const next = [...BLITZ_AFTER_LEVELS].find((level) => level >= state.level && !performance.blitzSeen[`after-${level}`]);
      bonusStatusElement.hidden = !next;
      bonusStatusElement.textContent = next ? `NEXT BLITZ AFTER LEVEL ${next}` : "";
    }
  }
  renderLevelMap();
}

function renderStatus() {
  levelNumberElement.textContent = mode === "blitz" ? "B" : activeLevel.level;
  scoreElement.textContent = score.toLocaleString();
  targetElement.textContent = mode === "blitz" ? "∞" : activeLevel.target.toLocaleString();
  movesElement.textContent = mode === "blitz" ? "∞" : movesRemaining;
  livesElement.textContent = state.lives > 0 ? "♥".repeat(state.lives) : "0";
  streakElement.textContent = state.streak;
  hammerCountElement.textContent = state.hammers;
  boosterButton.disabled = locked || mode === "blitz";
  objectiveLabelElement.textContent = mode === "blitz"
    ? "Score as much as you can before time runs out."
    : describeLevelObjective(activeLevel, levelProgress, score);
  renderPerformance();
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
    { transform: `translate(${fromRect.left - toRect.left}px, ${fromRect.top - toRect.top}px) scale(.97)`, filter: "brightness(1.08)" },
    { transform: "translate(0, 0) scale(1)", filter: "brightness(1)" },
  ], { duration, easing: "cubic-bezier(.18,.76,.24,1)", fill: "both" });
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
    { transform: `translateY(${-distance}px) scale(.88)`, opacity: .3 },
    { transform: "translateY(0) scale(1)", opacity: 1 },
  ], { duration, easing: "cubic-bezier(.16,.78,.26,1)", fill: "both" });
}

function animateLanding(indices) {
  if (reducedMotion) return;
  for (const index of new Set(indices)) {
    tileAt(index)?.animate([
      { transform: "scale(1)" },
      { transform: "scale(1.055)" },
      { transform: "scale(1)" },
    ], { duration: presentationMs(PRESENTATION.landing), easing: "ease-out" });
  }
}

function flashBoard(cascade) {
  boardElement.classList.remove("is-cascade-hit", "is-cascade-big");
  void boardElement.offsetWidth;
  boardElement.classList.add("is-cascade-hit");
  if (cascade >= 3) boardElement.classList.add("is-cascade-big");
  window.setTimeout(() => boardElement.classList.remove("is-cascade-hit", "is-cascade-big"), presentationMs(200));
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
  window.setTimeout(() => pop.remove(), 700);
}

async function presentFallTransition(transition) {
  if (mode === "normal") levelProgress.ice = transition.iceAfter.slice();
  board = transition.after.slice();
  specials = transition.specialsAfter.slice();
  renderBoard();
  renderStatus();
  presentation.transitionAfterFall(transition);
  const duration = PRESENTATION.fallBase + Math.min(4, transition.cascade - 1) * PRESENTATION.fallCascadeStep;
  const landing = [];
  for (const fall of transition.falls) {
    animateTileFromTo(fall.from, fall.to, presentationMs(duration));
    landing.push(fall.to);
  }
  for (const spawn of transition.spawns) {
    animateSpawn(spawn.to, spawn.spawnOffset, presentationMs(duration + 30));
    landing.push(spawn.to);
  }
  await sleep(duration);
  animateLanding(landing);
  presentation.transitionLand(transition, landing);
  await sleep(PRESENTATION.landing);
}

async function presentResolvedResult(result) {
  for (const transition of result.transitions) {
    if (mode === "normal") levelProgress.ice = transition.iceBefore.slice();
    board = transition.before.slice();
    specials = transition.specialsBefore.slice();
    renderBoard();
    presentation.transitionStart(transition);
    const tiles = transition.matched.map(tileAt).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add("is-matched"));
    transition.triggeredSpecials?.forEach(({ index }) => tileAt(index)?.classList.add("is-special-triggered"));
    const anticipate = PRESENTATION.anticipateBase + Math.min(4, transition.cascade - 1) * PRESENTATION.anticipateCascadeStep;
    await sleep(anticipate);
    const anchor = transition.matched[Math.floor(transition.matched.length / 2)] ?? 0;
    spawnScorePop(anchor, transition.gained, transition.cascade);
    presentation.transitionClear(transition);
    tiles.forEach((tile) => {
      tile.classList.remove("is-matched");
      tile.classList.add("is-clearing");
    });
    flashBoard(transition.cascade);
    await sleep(PRESENTATION.clear);
    score += transition.gained;
    if (mode === "normal") levelProgress = applySpecialLevelProgress(activeLevel, levelProgress, transition);
    if (mode === "blitz") {
      blitzStats.matches += Math.max(1, transition.groups?.length || 0);
      blitzStats.specials += transition.createdSpecials?.length || 0;
      blitzStats.cascades = Math.max(blitzStats.cascades, transition.cascade);
    }
    track("clear", {
      matched: transition.matched.length,
      cascade: transition.cascade,
      gained: transition.gained,
      specialCreated: transition.createdSpecials?.length || 0,
      specialTriggered: transition.triggeredSpecials?.length || 0,
      combo: transition.combo || null,
      iceHits: transition.iceHits.length,
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
    specials = result.specials.slice();
    renderBoard();
    boardElement.classList.remove("is-shuffling");
    boardElement.classList.add("is-shuffle-in");
    await sleep(PRESENTATION.shuffle / 2);
    boardElement.classList.remove("is-shuffle-in");
  } else {
    board = result.board.slice();
    specials = result.specials.slice();
  }
  if (mode === "normal") levelProgress.ice = result.ice.slice();
  renderBoard();
  renderStatus();
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

function blitzOfferId(level) {
  return `after-${level}`;
}

function shouldOfferBlitz(level) {
  const id = blitzOfferId(level);
  return BLITZ_AFTER_LEVELS.has(level) && !performance.blitzSeen[id];
}

function markBlitzSeen(level) {
  performance.blitzSeen[blitzOfferId(level)] = true;
  savePerformance();
}

function showBlitzOffer(completedLevel) {
  const id = blitzOfferId(completedLevel);
  showDialog({
    kicker: "BONUS ROUND",
    title: "BLITZ!",
    copy: "30 seconds. No move limit, no lost life, no failure. Make as many matches and specials as you can.",
    eventType: "blitz_offer",
    actions: [
      button("Skip", "", () => {
        markBlitzSeen(completedLevel);
        closeResultDialog();
        startLevel(state.level);
      }),
      button("PLAY BLITZ", "primary", () => {
        performance.blitzSeen[id] = true;
        savePerformance();
        closeResultDialog();
        startBlitz(completedLevel);
      }),
    ],
  });
}

async function checkNormalLevelEnd() {
  if (objectiveComplete(activeLevel, levelProgress, score)) {
    locked = true;
    clearActiveRun();
    const completedLevel = activeLevel.level;
    const scoreBeforeBonus = score;
    const bonus = movesRemaining * 100;
    score += bonus;
    state.streak += 1;
    if (completedLevel < LEVEL_COUNT) state.level = completedLevel + 1;
    const stars = calculateLevelStars(activeLevel, movesRemaining);
    const reward = awardBestStars("starsByLevel", String(completedLevel), stars);
    saveState();
    renderStatus();
    track("level_win", { bonus, streak: state.streak, stars, bestStars: reward.best, totalStars: reward.total });
    const finalLevel = completedLevel === LEVEL_COUNT;
    await presentation.presentLevelComplete({
      moves: movesRemaining,
      scoreBeforeBonus,
      scoreAfterBonus: score,
      stars,
      reward,
      finalRun: finalLevel,
    });
    renderStatus();
    const rewardCopy = reward.claimed ? ` +${reward.claimed} hammer earned.` : "";
    showDialog({
      kicker: finalLevel ? "RUN COMPLETE" : "LEVEL COMPLETE",
      title: finalLevel ? `${LEVEL_COUNT} down.` : `Level ${completedLevel} cleared.`,
      copy: `${starGlyphs(stars)} this run · best ${starGlyphs(reward.best)} · ${bonus.toLocaleString()} bonus points from ${movesRemaining} unused moves. Streak: ${state.streak}.${rewardCopy}`,
      actions: [
        button(finalLevel ? `Replay level ${LEVEL_COUNT}` : "Continue", "primary", () => {
          closeResultDialog();
          if (!finalLevel && shouldOfferBlitz(completedLevel)) showBlitzOffer(completedLevel);
          else startLevel(state.level);
        }),
      ],
    });
    return;
  }
  if (movesRemaining > 0) return;

  locked = true;
  clearActiveRun();
  state.streak = 0;
  if (state.lives > 0) {
    state.lives -= 1;
    state.lastLifeAt = Date.now();
  }
  saveState();
  renderStatus();
  track("level_failed", { lives: state.lives, objective: describeLevelObjective(activeLevel, levelProgress, score) });
  presentation.failure();

  if (state.lives > 0) {
    showDialog({
      kicker: "OUT OF MOVES",
      title: "Almost. Run it again.",
      copy: `${describeLevelObjective(activeLevel, levelProgress, score)}. You have ${state.lives} ${state.lives === 1 ? "life" : "lives"} left.`,
      actions: [
        button("Retry level", "primary", () => {
          closeResultDialog();
          startLevel(activeLevel.level);
        }),
      ],
    });
  } else {
    showDialog({
      kicker: "OUT OF LIVES",
      title: "Lives are recharging.",
      copy: "A life comes back automatically in 10 minutes. Your progress stays put.",
      actions: [button("Got it", "primary", closeResultDialog)],
    });
  }
}

function formatClock(ms) {
  return `${Math.max(0, Math.ceil(ms / 1000))}`;
}

function performanceNow() {
  return window.performance?.now?.() ?? Date.now();
}

function updateBlitzClock() {
  if (mode !== "blitz" || !blitzEndsAt) return;
  const remaining = blitzEndsAt - performanceNow();
  if (blitzClock) blitzClock.textContent = formatClock(remaining);
  if (remaining > 0) return;
  blitzExpired = true;
  if (blitzClock) blitzClock.textContent = "0";
  if (!locked) void finishBlitz();
}

async function countdownBlitz() {
  if (!blitzOverlay || !blitzCallout || !blitzClock) return;
  blitzOverlay.hidden = false;
  blitzOverlay.classList.add("is-countdown");
  for (const value of [3, 2, 1]) {
    blitzCallout.textContent = String(value);
    blitzClock.textContent = "30";
    await sleep(520);
  }
  blitzCallout.textContent = "BLITZ!";
  await sleep(320);
  blitzOverlay.classList.remove("is-countdown");
  blitzCallout.textContent = "BLITZ";
  locked = false;
  blitzEndsAt = performanceNow() + BLITZ_SECONDS * 1000;
  blitzTimerHandle = window.setInterval(updateBlitzClock, 100);
  updateBlitzClock();
}

function stopBlitzTimer() {
  if (blitzTimerHandle) window.clearInterval(blitzTimerHandle);
  blitzTimerHandle = null;
  blitzEndsAt = 0;
}

async function finishBlitz() {
  if (mode !== "blitz" || finishingBlitz) return;
  finishingBlitz = true;
  locked = true;
  stopBlitzTimer();
  const finalScore = score;
  const previousBest = Math.max(0, Number(performance.blitzBest[blitzId]) || 0);
  const bestScore = Math.max(previousBest, finalScore);
  performance.blitzBest[blitzId] = bestScore;
  const stars = calculateBlitzStars(finalScore);
  const reward = awardBestStars("blitzStars", blitzId, stars);
  savePerformance();
  track("blitz_complete", { id: blitzId, score: finalScore, bestScore, stars, ...blitzStats });
  if (blitzOverlay) blitzOverlay.hidden = true;
  await presentation.presentBlitzComplete({ score: finalScore, stars, reward });
  const rewardCopy = reward.claimed ? ` +${reward.claimed} hammer earned.` : "";
  showDialog({
    kicker: "BLITZ COMPLETE",
    title: `${finalScore.toLocaleString()} points`,
    copy: `${starGlyphs(stars)} · ${blitzStats.matches} match groups · ${blitzStats.specials} specials made · best ${bestScore.toLocaleString()}.${rewardCopy}`,
    actions: [
      button("Again", "", () => {
        closeResultDialog();
        startBlitz(Number(blitzId.replace("after-", "")) || 5);
      }),
      button("Continue", "primary", () => {
        closeResultDialog();
        startLevel(blitzReturningLevel);
      }),
    ],
  });
}

async function onTileClick(index) {
  if (locked) return;
  if (mode === "blitz" && blitzExpired) {
    void finishBlitz();
    return;
  }

  if (hammerMode && mode === "normal") {
    hammerMode = false;
    state.hammers = Math.max(0, state.hammers - 1);
    locked = true;
    saveState();
    renderStatus();
    tileAt(index)?.classList.add("is-hammer-hit");
    presentation.hammer(index);
    await sleep(120);
    const result = applySpecialHammer(board, specials, index, boardRng, {
      ice: levelProgress.ice,
      rules: currentRules(),
      targetKinds: remainingTargetKinds(),
    });
    await presentResolvedResult(result);
    locked = false;
    saveState();
    saveActiveRun();
    track("booster_used", { booster: "hammer" });
    await checkNormalLevelEnd();
    if (!locked) renderStatus();
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
  const result = applySpecialSwap(board, specials, first, index, boardRng, {
    ice: mode === "normal" ? levelProgress.ice : [],
    rules: currentRules(),
    targetKinds: remainingTargetKinds(),
  });
  if (!result.legal) {
    if (result.swapped) {
      board = result.swapped.slice();
      specials = result.swappedSpecials.slice();
      renderBoard();
      animateSwap(first, index, presentationMs(PRESENTATION.swap));
      await sleep(PRESENTATION.swap + PRESENTATION.invalidHold);
    }
    board = result.board.slice();
    specials = result.specials.slice();
    renderBoard();
    animateSwap(first, index, presentationMs(PRESENTATION.swap));
    presentation.invalidSwap();
    track("invalid_swap");
    await sleep(PRESENTATION.swap);
    locked = false;
    if (mode === "blitz" && blitzExpired) void finishBlitz();
    return;
  }

  if (mode === "normal") movesRemaining -= 1;
  track("move", { from: first, to: index });
  board = result.swapped.slice();
  specials = result.swappedSpecials.slice();
  renderBoard();
  animateSwap(first, index, presentationMs(PRESENTATION.swap));
  renderStatus();
  await sleep(PRESENTATION.swap);
  await presentResolvedResult(result);
  locked = false;

  if (mode === "blitz") {
    if (blitzExpired || (blitzEndsAt && performanceNow() >= blitzEndsAt)) void finishBlitz();
  } else {
    saveActiveRun();
    await checkNormalLevelEnd();
    if (!locked) renderStatus();
  }
}

function startLevel(levelNumber = state.level, { resume = false } = {}) {
  stopBlitzTimer();
  presentation.reset();
  if (blitzOverlay) blitzOverlay.hidden = true;
  document.body.classList.remove("cascade-blitz-mode");
  mode = "normal";
  finishingBlitz = false;
  blitzExpired = false;
  applyLifeRegen();
  state.level = Math.min(LEVEL_COUNT, Math.max(1, levelNumber));
  activeLevel = levels[state.level - 1];
  selectedIndex = null;
  hammerMode = false;
  locked = false;

  const savedRun = resume ? loadActiveRun(state.level) : null;
  if (savedRun) {
    levelProgress = savedRun.levelProgress;
    score = savedRun.score;
    movesRemaining = savedRun.movesRemaining;
    boardRng = createRng(savedRun.rngState);
    board = savedRun.board;
    specials = savedRun.specials;
    saveState();
    renderBoard();
    renderStatus();
    renderHelp();
    track("level_resume", { savedAt: savedRun.savedAt });
    return;
  }

  clearActiveRun();
  levelProgress = createLevelProgress(activeLevel);
  score = 0;
  movesRemaining = activeLevel.moves;
  boardRng = createRng(((activeLevel.level * 0x9e3779b1) ^ Date.now()) >>> 0);
  board = createBoard({ rng: boardRng, rules: currentRules() });
  specials = emptySpecials();
  saveState();
  saveActiveRun();
  renderBoard();
  renderStatus();
  renderHelp();
  track("level_start", {
    target: activeLevel.target,
    moves: activeLevel.moves,
    hard: activeLevel.hard,
    difficulty: activeLevel.difficulty,
    chapter: activeLevel.chapter,
    objective: activeLevel.objective,
    specialRules: currentRules(),
  });
}

function startBlitz(completedLevel) {
  stopBlitzTimer();
  presentation.reset();
  clearActiveRun();
  mode = "blitz";
  finishingBlitz = false;
  blitzExpired = false;
  blitzReturningLevel = state.level;
  blitzId = blitzOfferId(completedLevel);
  blitzStats = { matches: 0, specials: 0, cascades: 0 };
  score = 0;
  movesRemaining = Number.POSITIVE_INFINITY;
  selectedIndex = null;
  hammerMode = false;
  locked = true;
  levelProgress = { collected: [], ice: [] };
  boardRng = createRng(((completedLevel * 0x85ebca6b) ^ Date.now()) >>> 0);
  board = createBoard({ rng: boardRng, rules: currentRules() });
  specials = emptySpecials();
  document.body.classList.add("cascade-blitz-mode");
  renderBoard();
  renderStatus();
  renderHelp();
  track("blitz_start", { id: blitzId, seconds: BLITZ_SECONDS });
  countdownBlitz();
}

boosterButton.addEventListener("click", () => {
  if (locked || mode === "blitz") return;
  if (state.hammers <= 0) {
    showDialog({
      kicker: "NO HAMMERS",
      title: "Earn the next one.",
      copy: "Every 10 new best stars earns another hammer. Bonus-round stars count too.",
      actions: [button("Got it", "primary", closeResultDialog)],
    });
    return;
  }
  hammerMode = !hammerMode;
  selectedIndex = null;
  renderBoard();
  track("booster_armed", { booster: "hammer", armed: hammerMode });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (mode === "normal" && !locked) saveActiveRun();
    return;
  }
  if (mode === "normal") {
    applyLifeRegen();
    renderStatus();
  }
});

window.addEventListener("pagehide", () => {
  if (mode === "normal" && !locked) saveActiveRun();
});

applyLifeRegen();
startLevel(state.level, { resume: true });

window.cascadeResearch = Object.freeze({
  exportEvents() {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
  },
  exportState() {
    return JSON.parse(localStorage.getItem(STATE_KEY) || "null");
  },
  exportPerformance() {
    return JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || "null");
  },
  exportActiveRun() {
    return JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY) || "null");
  },
  exportLevel() {
    return {
      mode,
      level: activeLevel,
      progress: levelProgress,
      score,
      movesRemaining,
      board: board.slice(),
      specials: specials.slice(),
      blitz: mode === "blitz" ? { id: blitzId, expired: blitzExpired, stats: { ...blitzStats } } : null,
    };
  },
  startBlitz(completedLevel = 5) {
    closeResultDialog();
    startBlitz(Math.max(1, Math.min(LEVEL_COUNT - 1, Number(completedLevel) || 5)));
  },
});