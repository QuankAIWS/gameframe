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
  dropSupportIndices,
  ordinaryLockTargetIndices,
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
const ACTIVE_RUN_VERSION = 2;
const BOARD_CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const VALID_SPECIALS = new Set(Object.values(SPECIAL));
const BLITZ_SECONDS = 30;
const BLITZ_AFTER_LEVELS = Object.freeze(new Set([
  5, 12, 20, 30, 45, 60, 75, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290,
  310, 330, 350, 370, 390, 410, 430, 450, 470, 490, 510, 530, 550, 570, 590,
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
let recallCueRevealUntil = 0;
let recallHintIndex = -1;
let recallHintUntil = 0;
const RECALL_SYMBOLS = Object.freeze(["♥", "◆", "★", "●", "✦", "✿"]);

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
      drop: levelProgress?.drop
        ? {
            delivered: Number(levelProgress.drop.delivered) || 0,
            total: Number(levelProgress.drop.total) || 0,
            tokens: (levelProgress.drop.tokens || []).map((token) => ({ ...token })),
            exits: (levelProgress.drop.exits || []).slice(),
          }
        : null,
      locks: levelProgress?.locks
        ? {
            total: Number(levelProgress.locks.total) || 0,
            opened: Number(levelProgress.locks.opened) || 0,
            layers: (levelProgress.locks.layers || []).slice(),
            requiredKinds: (levelProgress.locks.requiredKinds || []).slice(),
            recall: levelProgress.locks.recall === true,
          }
        : null,
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
    const restoredProgress = applySpecialLevelProgress(level, {
      collected,
      ice,
      drop: parsed.levelProgress?.drop,
      locks: parsed.levelProgress?.locks,
    }, {});
    return {
      board: savedBoard,
      specials: parsed.specials.slice(),
      score: savedScore,
      movesRemaining: savedMoves,
      levelProgress: restoredProgress,
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

function remainingButterflyTargetIndices() {
  if (mode !== "normal") return [];
  return [...new Set([
    ...dropSupportIndices(levelProgress),
    ...ordinaryLockTargetIndices(levelProgress),
  ])];
}

function recallCueVisible(index) {
  if (Date.now() < recallCueRevealUntil) return true;
  return index === recallHintIndex && Date.now() < recallHintUntil;
}

function revealRecallCue(index, duration = 1200) {
  recallHintIndex = index;
  recallHintUntil = Date.now() + duration;
  renderBoard();
  window.setTimeout(() => {
    if (recallHintIndex === index && Date.now() >= recallHintUntil) {
      recallHintIndex = -1;
      renderBoard();
    }
  }, duration + 40);
}

function specialName(value) {
  if (value === SPECIAL.STRIPE_H || value === SPECIAL.STRIPE_V) return "striped line clearer";
  if (value === SPECIAL.BOMB) return "burst bomb";
  if (value === SPECIAL.COLOR) return "color clearer";
  if (value === SPECIAL.FISH) return "butterfly";
  return "";
}

function renderBoard() {
  boardElement.replaceChildren();
  board.forEach((kind, index) => {
    const tile = document.createElement("button");
    const special = specials[index];
    const iceLayers = mode === "normal" ? Math.max(0, Number(levelProgress?.ice?.[index]) || 0) : 0;
    const dropToken = mode === "normal" ? (levelProgress?.drop?.tokens || []).find((token) => Number(token.index) === index) : null;
    const dropExit = mode === "normal" && (levelProgress?.drop?.exits || []).includes(index);
    const lockLayers = mode === "normal" ? Math.max(0, Number(levelProgress?.locks?.layers?.[index]) || 0) : 0;
    const recallKind = mode === "normal" ? Number(levelProgress?.locks?.requiredKinds?.[index]) : -1;
    const cueVisible = lockLayers > 0 && recallKind >= 0 && recallCueVisible(index);
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
    if (dropExit) {
      tile.dataset.dropExit = "true";
      tile.classList.add("has-drop-exit");
      const exitMark = document.createElement("span");
      exitMark.className = "cascade-drop-exit";
      exitMark.setAttribute("aria-hidden", "true");
      exitMark.textContent = "⇩";
      tile.append(exitMark);
    }
    if (dropToken) {
      tile.dataset.dropObject = String(dropToken.id);
      tile.classList.add("has-drop-object");
      const dropMark = document.createElement("span");
      dropMark.className = "cascade-drop-object";
      dropMark.setAttribute("aria-hidden", "true");
      dropMark.textContent = "◆";
      tile.append(dropMark);
    }
    if (lockLayers > 0) {
      tile.dataset.lock = String(lockLayers);
      tile.classList.add("has-lock", recallKind >= 0 ? "has-recall-lock" : "has-cage");
      const lockMark = document.createElement("span");
      lockMark.className = "cascade-lock-mark";
      lockMark.setAttribute("aria-hidden", "true");
      if (recallKind >= 0) {
        lockMark.dataset.recallKind = String(recallKind);
        lockMark.classList.toggle("is-revealed", cueVisible);
        lockMark.textContent = cueVisible ? RECALL_SYMBOLS[recallKind] : "⌾";
      } else {
        lockMark.textContent = lockLayers > 1 ? "✦" : "";
      }
      tile.append(lockMark);
    }
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", `Tile ${index + 1}${special ? `, ${specialName(special)}` : ""}${iceLayers ? `, ${iceLayers} ice ${iceLayers === 1 ? "layer" : "layers"}` : ""}${dropToken ? ", drop object" : ""}${dropExit ? ", drop exit" : ""}${lockLayers ? recallKind >= 0 ? cueVisible ? `, recall lock wants ${["pink","cyan","yellow","green","purple","orange"][recallKind]}` : ", recall lock, cue hidden" : `, cage ${lockLayers === 1 ? "locked" : "double locked"}` : ""}`);
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
  if (level.level === 6) return "Butterfly";
  if (level.difficulty === "super-hard") return "Super hard";
  if (level.difficulty === "hard" || level.hard) return "Hard";
  const hasIce = Boolean(level.objective?.ice);
  const hasCollect = Boolean(level.objective?.collect?.length);
  const hasDrop = Boolean(level.objective?.drop);
  const hasLocks = Boolean(level.objective?.locks);
  if (hasLocks) return level.objective.locks.recall ? "Recall lock" : "Cages";
  if (hasDrop && (hasIce || hasCollect)) return "Drop mix";
  if (hasDrop) return "Drop";
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
    helpElement.textContent = "Make a 2×2 square of one color to create a Butterfly. Match or trigger it and it flutters to a random useful objective.";
  } else if (activeLevel.level === 451) {
    helpElement.textContent = "New objective: drop every diamond to its glowing exit. Clear pieces underneath so gravity carries it down.";
  } else if (activeLevel.level === 651) {
    helpElement.textContent = "New objective: open every cage. Caged candies stay fixed and cannot be swapped. Clear beside a cage or hit it with a special to crack it.";
  } else if (activeLevel.level === 701) {
    helpElement.textContent = "Memory challenge: each magic lock briefly shows the color-symbol it wants. Remember it, then clear that color beside the lock. Tap a closed lock anytime for a quick clue.";
  } else {
    const notes = [];
    if (activeLevel.objective?.drop) notes.push("clear below each diamond to drop it into its exit");
    if (activeLevel.objective?.locks?.recall) notes.push("remember each magic lock cue and clear that color beside it");
    else if (activeLevel.objective?.locks) notes.push("clear beside every cage to open it");
    if (activeLevel.objective?.ice) notes.push("crack every iced cell");
    if (activeLevel.objective?.collect?.length) notes.push("collect the required colors");
    if (activeLevel.mechanics?.includes("fish")) notes.push("Butterflies randomly seek useful objective cells");
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

function butterflyFlightElement(kind) {
  const flight = document.createElement("span");
  flight.className = "cascade-butterfly-flight";
  flight.dataset.kind = String(kind);
  flight.setAttribute("aria-hidden", "true");
  flight.append(document.createElement("i"));
  document.body.append(flight);
  return flight;
}

function butterflyFlightKeyframes(from, to, ordinal = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const direction = ordinal % 2 === 0 ? 1 : -1;
  const sway = Math.min(44, Math.max(18, length * .12)) * direction;
  return Array.from({ length: 7 }, (_, index) => {
    const p = index / 6;
    const envelope = Math.sin(Math.PI * p);
    const flutter = Math.sin((p * Math.PI * 4.5) + ordinal * .8);
    const bob = Math.sin((p * Math.PI * 6) + ordinal * 1.4);
    const x = from.x + dx * p + nx * sway * envelope * flutter * .48;
    const y = from.y + dy * p + ny * sway * envelope * flutter * .48 - 10 * envelope + bob * 5 * envelope;
    return {
      offset: p,
      transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${-10 + flutter * 13 + direction * 3}deg) scale(${p < .12 ? .78 + p * 2 : p > .86 ? 1 - (p - .86) * 1.8 : 1})`,
      opacity: p < .04 ? 0 : p > .94 ? Math.max(0, (1 - p) / .06) : 1,
    };
  });
}

async function animateButterflyFlights(transition) {
  if (reducedMotion) return;
  const flights = (transition?.homingFlights || []).filter(({ from, target }) => Number.isInteger(from) && Number.isInteger(target) && from !== target);
  if (!flights.length) return;
  await Promise.all(flights.slice(0, 8).map(({ from, target }, ordinal) => {
    const sourceTile = tileAt(from);
    const targetTile = tileAt(target);
    const sourceRect = sourceTile?.getBoundingClientRect?.();
    const targetRect = targetTile?.getBoundingClientRect?.();
    if (!sourceRect || !targetRect) return Promise.resolve();
    const flight = butterflyFlightElement(Number(sourceTile.dataset.kind));
    const source = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 };
    const destination = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
    const distance = Math.hypot(destination.x - source.x, destination.y - source.y);
    const animation = flight.animate(butterflyFlightKeyframes(source, destination, ordinal), {
      duration: Math.min(760, 430 + distance * .38 + ordinal * 22),
      easing: "cubic-bezier(.22,.62,.25,1)",
      fill: "forwards",
    });
    return animation.finished.catch(() => {}).finally(() => flight.remove());
  }));
}

async function presentResolvedResult(result) {
  for (const transition of result.transitions) {
    if (mode === "normal") {
      levelProgress.ice = transition.iceBefore.slice();
      if (transition.locksBefore) levelProgress.locks = transition.locksBefore;
    }
    board = transition.before.slice();
    specials = transition.specialsBefore.slice();
    renderBoard();
    presentation.transitionStart(transition);
    const tiles = transition.matched.map(tileAt).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add("is-matched"));
    transition.triggeredSpecials?.forEach(({ index }) => tileAt(index)?.classList.add("is-special-triggered"));
    const anticipate = PRESENTATION.anticipateBase + Math.min(4, transition.cascade - 1) * PRESENTATION.anticipateCascadeStep;
    await Promise.all([sleep(anticipate), animateButterflyFlights(transition)]);
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
      dropsDelivered: Number(levelProgress?.drop?.delivered || 0),
      lockHits: transition.lockHits?.length || 0,
      locksOpened: Number(levelProgress?.locks?.opened || 0),
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
  if (mode === "normal") {
    levelProgress.ice = result.ice.slice();
    if (result.locks) levelProgress.locks = result.locks;
  }
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
      locks: levelProgress.locks,
      rules: currentRules(),
      targetKinds: remainingTargetKinds(),
      targetIndices: remainingButterflyTargetIndices(),
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

  const lockLayers = mode === "normal" ? Math.max(0, Number(levelProgress?.locks?.layers?.[index]) || 0) : 0;
  const recallKind = mode === "normal" ? Number(levelProgress?.locks?.requiredKinds?.[index]) : -1;
  if (lockLayers > 0 && !hammerMode) {
    selectedIndex = null;
    if (recallKind >= 0) {
      revealRecallCue(index);
      track("recall_hint", { index });
    } else {
      tileAt(index)?.classList.add("is-lock-nudge");
      window.setTimeout(() => tileAt(index)?.classList.remove("is-lock-nudge"), 280);
    }
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
    locks: mode === "normal" ? levelProgress.locks : null,
    rules: currentRules(),
    targetKinds: remainingTargetKinds(),
    targetIndices: remainingButterflyTargetIndices(),
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

  recallCueRevealUntil = 0;
  recallHintIndex = -1;
  recallHintUntil = 0;
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
  if (activeLevel.objective?.locks?.recall) {
    recallCueRevealUntil = Date.now() + 4200;
    window.setTimeout(() => renderBoard(), 4250);
  }
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
  levelProgress = { collected: [], ice: [], drop: { delivered: 0, total: 0, tokens: [], exits: [] }, locks: { total: 0, opened: 0, layers: Array(BOARD_CELL_COUNT).fill(0), requiredKinds: Array(BOARD_CELL_COUNT).fill(-1), recall: false } };
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
  adminSpawnSpecial(type = "butterfly", count = 1) {
    if (mode !== "normal" || locked) return [];
    const mapped = type === "butterfly" ? SPECIAL.FISH : type;
    if (!VALID_SPECIALS.has(mapped)) return [];
    const blocked = new Set((levelProgress?.drop?.tokens || []).map((token) => Number(token.index)));
    const candidates = board.map((kind, index) => ({ kind, index }))
      .filter(({ kind, index }) => kind !== null && !specials[index] && !blocked.has(index) && Math.max(0, Number(levelProgress?.ice?.[index]) || 0) === 0 && Math.max(0, Number(levelProgress?.locks?.layers?.[index]) || 0) === 0)
      .map(({ index }) => index);
    const placed = [];
    while (placed.length < Math.max(1, Math.min(8, Number(count) || 1)) && candidates.length) {
      const index = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      specials[index] = mapped;
      placed.push(index);
    }
    renderBoard(); renderStatus(); saveActiveRun();
    return placed;
  },
  adminSpawnCombo(partner = "butterfly") {
    if (mode !== "normal" || locked) return [];
    const mappedPartner = partner === "butterfly" ? SPECIAL.FISH : partner;
    if (!VALID_SPECIALS.has(mappedPartner)) return [];
    const blocked = new Set((levelProgress?.drop?.tokens || []).map((token) => Number(token.index)));
    const pairs = [];
    for (let index = 0; index < board.length; index += 1) {
      const right = index % BOARD_SIZE < BOARD_SIZE - 1 ? index + 1 : -1;
      const down = index + BOARD_SIZE < board.length ? index + BOARD_SIZE : -1;
      for (const neighbor of [right, down]) {
        if (neighbor < 0 || specials[index] || specials[neighbor] || blocked.has(index) || blocked.has(neighbor)) continue;
        if (Math.max(0, Number(levelProgress?.ice?.[index]) || 0) > 0 || Math.max(0, Number(levelProgress?.ice?.[neighbor]) || 0) > 0) continue;
        if (Math.max(0, Number(levelProgress?.locks?.layers?.[index]) || 0) > 0 || Math.max(0, Number(levelProgress?.locks?.layers?.[neighbor]) || 0) > 0) continue;
        pairs.push([index, neighbor]);
      }
    }
    if (!pairs.length) return [];
    const [first, second] = pairs[Math.floor(Math.random() * pairs.length)];
    specials[first] = SPECIAL.FISH;
    specials[second] = mappedPartner;
    renderBoard(); renderStatus(); saveActiveRun();
    return [first, second];
  },
  async adminTriggerFirstSpecial() {
    if (mode !== "normal" || locked) return false;
    const index = specials.findIndex(Boolean);
    if (index < 0) return false;
    locked = true;
    selectedIndex = null;
    const result = applySpecialHammer(board, specials, index, boardRng, {
      ice: levelProgress.ice,
      locks: levelProgress.locks,
      rules: currentRules(),
      targetKinds: remainingTargetKinds(),
      targetIndices: remainingButterflyTargetIndices(),
    });
    await presentResolvedResult(result);
    board = result.board.slice();
    specials = result.specials.slice();
    saveActiveRun();
    locked = false;
    renderBoard(); renderStatus();
    return true;
  },
  startBlitz(completedLevel = 5) {
    closeResultDialog();
    startBlitz(Math.max(1, Math.min(LEVEL_COUNT - 1, Number(completedLevel) || 5)));
  },
});