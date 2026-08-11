import {
  CASCADE_LEVELS as levels,
  LEVEL_COUNT,
  SPECIAL,
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

const LIFE_MAX = 5;
const LIFE_REGEN_MS = 10 * 60 * 1000;
const HAMMER_MAX = 6;
const HAMMER_STAR_STEP = 10;
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const BLITZ_SECONDS = 30;
const BLITZ_AFTER_LEVELS = Object.freeze(new Set([5, 12, 20, 30, 42, 55, 70, 85]));
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
    pendingHammerRewards: 0,
  };
}

function loadPerformance() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return defaultPerformance();
    return {
      ...defaultPerformance(),
      ...parsed,
      starsByLevel: parsed.starsByLevel && typeof parsed.starsByLevel === "object" ? parsed.starsByLevel : {},
      blitzBest: parsed.blitzBest && typeof parsed.blitzBest === "object" ? parsed.blitzBest : {},
      blitzStars: parsed.blitzStars && typeof parsed.blitzStars === "object" ? parsed.blitzStars : {},
      blitzSeen: parsed.blitzSeen && typeof parsed.blitzSeen === "object" ? parsed.blitzSeen : {},
      pendingHammerRewards: Math.max(0, Number(parsed.pendingHammerRewards) || 0),
    };
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

function claimPendingHammerRewards() {
  const capacity = Math.max(0, HAMMER_MAX - state.hammers);
  const claimed = Math.min(capacity, performance.pendingHammerRewards);
  if (claimed <= 0) return 0;
  state.hammers += claimed;
  performance.pendingHammerRewards -= claimed;
  saveState();
  savePerformance();
  return claimed;
}

function awardBestStars(bucket, key, stars) {
  const previousTotal = totalBestStars();
  const previous = Math.max(0, Math.min(3, Number(performance[bucket]?.[key]) || 0));
  const best = Math.max(previous, Math.max(0, Math.min(3, Number(stars) || 0)));
  performance[bucket][key] = best;
  const nextTotal = previousTotal + (best - previous);
  const rewards = Math.max(0, Math.floor(nextTotal / HAMMER_STAR_STEP) - Math.floor(previousTotal / HAMMER_STAR_STEP));
  performance.pendingHammerRewards += rewards;
  savePerformance();
  const claimed = claimPendingHammerRewards();
  return { previous, best, total: nextTotal, rewards, claimed };
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
  };
}

function currentRules() {
  if (mode === "blitz") return { stripe: true, bomb: true, color: true };
  return rulesForLevel(activeLevel.level);
}

function specialName(value) {
  if (value === SPECIAL.STRIPE_H || value === SPECIAL.STRIPE_V) return "striped line clearer";
  if (value === SPECIAL.BOMB) return "burst bomb";
  if (value === SPECIAL.COLOR) return "color clearer";
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
  if (level.hard) return "Hard";
  const hasIce = Boolean(level.objective?.ice);
  const hasCollect = Boolean(level.objective?.collect?.length);
  if (hasIce && hasCollect) return "Mix";
  if (hasIce) return level.objective.ice.layers > 1 ? "Deep ice" : "Ice";
  if (hasCollect) return level.objective.collect.length > 1 ? "Dual" : "Collect";
  return "Level";
}

function renderLevelMap() {
  levelMapElement.replaceChildren();
  for (const level of levels) {
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
      li.append(span, badge);
    } else {
      li.append(span);
    }
    levelMapElement.append(li);
  }
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
  } else {
    const notes = [];
    if (activeLevel.objective?.ice) notes.push("crack every iced cell");
    if (activeLevel.objective?.collect?.length) notes.push("collect the required colors");
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
    starProgressElement.textContent = performance.pendingHammerRewards > 0 && state.hammers >= HAMMER_MAX
      ? `${total} total stars · ${performance.pendingHammerRewards} hammer reward banked`
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
  claimPendingHammerRewards();
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

function setComboPresentation(transition) {
  comboLabelElement.classList.remove("is-hot", "is-wild");
  if (transition.combo) {
    comboLabelElement.textContent = transition.combo.toUpperCase();
    comboLabelElement.classList.add("is-wild");
    return;
  }
  if (transition.cascade <= 1) {
    comboLabelElement.textContent = transition.createdSpecials?.length ? "SPECIAL MADE" : "MATCH";
    return;
  }
  comboLabelElement.textContent = `CASCADE ×${transition.cascade}`;
  if (transition.cascade >= 3) comboLabelElement.classList.add("is-hot");
  if (transition.cascade >= 5) comboLabelElement.classList.add("is-wild");
}

async function presentFallTransition(transition) {
  if (mode === "normal") levelProgress.ice = transition.iceAfter.slice();
  board = transition.after.slice();
  specials = transition.specialsAfter.slice();
  renderBoard();
  renderStatus();
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
  await sleep(PRESENTATION.landing);
}

async function presentResolvedResult(result) {
  for (const transition of result.transitions) {
    if (mode === "normal") levelProgress.ice = transition.iceBefore.slice();
    board = transition.before.slice();
    specials = transition.specialsBefore.slice();
    renderBoard();
    setComboPresentation(transition);
    const tiles = transition.matched.map(tileAt).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add("is-matched"));
    transition.triggeredSpecials?.forEach(({ index }) => tileAt(index)?.classList.add("is-special-triggered"));
    const anticipate = PRESENTATION.anticipateBase + Math.min(4, transition.cascade - 1) * PRESENTATION.anticipateCascadeStep;
    await sleep(anticipate);
    const anchor = transition.matched[Math.floor(transition.matched.length / 2)] ?? 0;
    spawnScorePop(anchor, transition.gained, transition.cascade);
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
    const completedLevel = activeLevel.level;
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
    const rewardCopy = reward.claimed ? ` +${reward.claimed} hammer earned.` : reward.rewards ? ` +${reward.rewards} hammer reward banked.` : "";
    showDialog({
      kicker: finalLevel ? "RUN COMPLETE" : "LEVEL COMPLETE",
      title: finalLevel ? `${LEVEL_COUNT} down.` : `Level ${completedLevel} cleared.`,
      copy: `${starGlyphs(stars)} · ${bonus.toLocaleString()} bonus points from ${movesRemaining} unused moves. Streak: ${state.streak}.${rewardCopy}`,
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
  state.streak = 0;
  if (state.lives > 0) {
    state.lives -= 1;
    state.lastLifeAt = Date.now();
  }
  saveState();
  renderStatus();
  track("level_failed", { lives: state.lives, objective: describeLevelObjective(activeLevel, levelProgress, score) });

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
  if (!locked) finishBlitz();
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

function finishBlitz() {
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
  const rewardCopy = reward.claimed ? ` +${reward.claimed} hammer earned.` : reward.rewards ? ` +${reward.rewards} hammer reward banked.` : "";
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
    finishBlitz();
    return;
  }

  if (hammerMode && mode === "normal") {
    hammerMode = false;
    state.hammers -= 1;
    saveState();
    track("booster_used", { booster: "hammer" });
    locked = true;
    tileAt(index)?.classList.add("is-hammer-hit");
    await sleep(120);
    const result = applySpecialHammer(board, specials, index, boardRng, {
      ice: levelProgress.ice,
      rules: currentRules(),
    });
    await presentResolvedResult(result);
    locked = false;
    await checkNormalLevelEnd();
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
    track("invalid_swap");
    await sleep(PRESENTATION.swap);
    locked = false;
    if (mode === "blitz" && blitzExpired) finishBlitz();
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
    if (blitzExpired || (blitzEndsAt && performanceNow() >= blitzEndsAt)) finishBlitz();
  } else {
    await checkNormalLevelEnd();
  }
}

function startLevel(levelNumber = state.level) {
  stopBlitzTimer();
  if (blitzOverlay) blitzOverlay.hidden = true;
  document.body.classList.remove("cascade-blitz-mode");
  mode = "normal";
  finishingBlitz = false;
  blitzExpired = false;
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
  specials = emptySpecials();
  saveState();
  renderBoard();
  renderStatus();
  renderHelp();
  track("level_start", {
    target: activeLevel.target,
    moves: activeLevel.moves,
    hard: activeLevel.hard,
    objective: activeLevel.objective,
    specialRules: currentRules(),
  });
}

function startBlitz(completedLevel) {
  stopBlitzTimer();
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
  board = createBoard({ rng: boardRng });
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
  if (!document.hidden && mode === "normal") {
    applyLifeRegen();
    renderStatus();
  }
});

applyLifeRegen();
claimPendingHammerRewards();
startLevel(state.level);

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
