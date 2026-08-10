const CASCADE_STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_STATE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const HAMMER_STAR_STEP = 10;
const HAMMER_MAX = 6;
const SYNC_GUARD_KEY = "scribbles-gameframe.cascade-performance-hammer-sync:v1";

const QUICK_BONUS_WINDOWS = Object.freeze(new Map([
  [6, 75],
  [12, 72],
  [18, 68],
  [24, 64],
  [34, 60],
  [44, 58],
  [54, 56],
  [64, 54],
  [74, 52],
  [84, 50],
  [94, 48],
]));

function defaultPerformanceState() {
  return { starsByLevel: {}, quickWins: {}, pendingHammerRewards: 0 };
}

function loadPerformanceState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PERFORMANCE_STATE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return defaultPerformanceState();
    return {
      ...defaultPerformanceState(),
      ...parsed,
      starsByLevel: parsed.starsByLevel && typeof parsed.starsByLevel === "object" ? parsed.starsByLevel : {},
      quickWins: parsed.quickWins && typeof parsed.quickWins === "object" ? parsed.quickWins : {},
      pendingHammerRewards: Math.max(0, Number(parsed.pendingHammerRewards) || 0),
    };
  } catch {
    return defaultPerformanceState();
  }
}

function savePerformanceState(performance) {
  localStorage.setItem(PERFORMANCE_STATE_KEY, JSON.stringify(performance));
}

function readCascadeState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CASCADE_STATE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCascadeState(state) {
  localStorage.setItem(CASCADE_STATE_KEY, JSON.stringify(state));
}

function track(type, detail = {}) {
  try {
    const events = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    events.push({ at: new Date().toISOString(), type, ...detail });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Performance telemetry must never affect play.
  }
}

export function quickBonusSeconds(levelNumber) {
  return QUICK_BONUS_WINDOWS.get(Number(levelNumber)) ?? 0;
}

export function calculateStars({ moves, movesRemaining, quickBonus = false }) {
  const totalMoves = Math.max(1, Number(moves) || 1);
  const remaining = Math.max(0, Number(movesRemaining) || 0);
  let stars = 1;
  if (remaining >= Math.max(2, Math.ceil(totalMoves * 0.15))) stars = 2;
  if (remaining >= Math.max(4, Math.ceil(totalMoves * 0.30))) stars = 3;
  if (quickBonus) stars = Math.min(3, stars + 1);
  return stars;
}

export function totalBestStars(starsByLevel = {}) {
  return Object.values(starsByLevel).reduce(
    (sum, value) => sum + Math.max(0, Math.min(3, Number(value) || 0)),
    0,
  );
}

export function performanceReward({ starsByLevel = {}, level, stars }) {
  const previousStars = { ...starsByLevel };
  const previousTotal = totalBestStars(previousStars);
  const nextStars = {
    ...previousStars,
    [String(level)]: Math.max(Number(previousStars[String(level)]) || 0, stars),
  };
  const nextTotal = totalBestStars(nextStars);
  const hammerRewards = Math.max(
    0,
    Math.floor(nextTotal / HAMMER_STAR_STEP) - Math.floor(previousTotal / HAMMER_STAR_STEP),
  );
  return { previousTotal, nextTotal, nextStars, hammerRewards };
}

let performance = loadPerformanceState();
let currentLevel = Number(document.querySelector("#level-number")?.textContent) || 1;
let levelStartedAt = Date.now();
let lastAwardedLevelToken = "";

function starGlyphs(count) {
  const earned = Math.max(0, Math.min(3, Number(count) || 0));
  return `${"★".repeat(earned)}${"☆".repeat(3 - earned)}`;
}

function formatClock(seconds) {
  const remaining = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(remaining / 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
}

function claimPendingHammerRewards() {
  if (performance.pendingHammerRewards <= 0) return 0;
  const state = readCascadeState();
  if (!state) return 0;
  const hammers = Math.max(0, Number(state.hammers) || 0);
  const capacity = Math.max(0, HAMMER_MAX - hammers);
  const claimed = Math.min(capacity, performance.pendingHammerRewards);
  if (claimed <= 0) return 0;
  state.hammers = hammers + claimed;
  performance.pendingHammerRewards -= claimed;
  writeCascadeState(state);
  savePerformanceState(performance);
  return claimed;
}

function decorateLevelMap() {
  document.querySelectorAll("#level-map > li").forEach((item) => {
    const level = Number(item.dataset.level) || 0;
    let badge = item.querySelector(".cascade-map-stars");
    if (!badge) {
      badge = document.createElement("b");
      badge.className = "cascade-map-stars";
      item.append(badge);
    }
    const stars = Number(performance.starsByLevel[String(level)]) || 0;
    badge.textContent = stars ? starGlyphs(stars) : "";
    badge.hidden = stars <= 0;
  });
}

function renderPerformance() {
  const starsElement = document.querySelector("#level-stars");
  const progressElement = document.querySelector("#star-progress");
  const quickElement = document.querySelector("#quick-bonus");
  const total = totalBestStars(performance.starsByLevel);
  const best = Number(performance.starsByLevel[String(currentLevel)]) || 0;
  const state = readCascadeState();
  const hammers = Math.max(0, Number(state?.hammers) || 0);

  if (starsElement) {
    starsElement.textContent = starGlyphs(best);
    starsElement.setAttribute("aria-label", `${best} of 3 best stars on level ${currentLevel}`);
  }

  if (progressElement) {
    const nextThreshold = (Math.floor(total / HAMMER_STAR_STEP) + 1) * HAMMER_STAR_STEP;
    if (performance.pendingHammerRewards > 0 && hammers >= HAMMER_MAX) {
      progressElement.textContent = `${total} total stars · ${performance.pendingHammerRewards} hammer reward banked`;
    } else if (total >= 300) {
      progressElement.textContent = `${total} total stars · full 100-level star run`;
    } else {
      progressElement.textContent = `${total} total stars · next hammer at ${nextThreshold}`;
    }
  }

  if (quickElement) {
    const windowSeconds = quickBonusSeconds(currentLevel);
    if (!windowSeconds) {
      quickElement.hidden = true;
    } else {
      const remaining = windowSeconds - ((Date.now() - levelStartedAt) / 1000);
      quickElement.hidden = false;
      quickElement.classList.toggle("is-expired", remaining <= 0);
      quickElement.textContent = remaining > 0
        ? `QUICK BONUS · ${formatClock(remaining)}`
        : "QUICK BONUS WINDOW CLOSED · FINISH NORMALLY";
    }
  }

  decorateLevelMap();
}

function sanitizeGameplayOffers() {
  const dialog = document.querySelector("#result-dialog");
  if (!dialog?.open) return;
  const kicker = document.querySelector("#result-kicker")?.textContent || "";
  if (dialog.dataset.performanceSanitized === kicker) return;
  dialog.dataset.performanceSanitized = kicker;

  dialog.querySelectorAll("button.iou").forEach((button) => button.remove());
  const title = document.querySelector("#result-title");
  const copy = document.querySelector("#result-copy");
  const plainActions = [...dialog.querySelectorAll("#result-actions button")];

  if (kicker === "OUT OF MOVES") {
    if (title) title.textContent = "Good try.";
    if (copy) {
      const objective = copy.textContent.split(". Five more moves")[0];
      copy.textContent = `${objective}. Retry the level for one life.`;
    }
    if (plainActions[0]) plainActions[0].textContent = "Retry level";
  } else if (kicker === "OUT OF LIVES") {
    if (title) title.textContent = "Out of lives.";
    if (copy) copy.textContent = "Lives recharge automatically while you're away. No purchase needed.";
    if (plainActions[0]) plainActions[0].textContent = "I'll come back";
  } else if (kicker === "NO HAMMERS") {
    if (title) title.textContent = "No hammers left.";
    if (copy) copy.textContent = "Hammers are earned through stars. Every 10 new best stars banks another hammer.";
    if (plainActions[0]) plainActions[0].textContent = "Got it";
  }
}

function awardCurrentLevelPerformance() {
  const exported = window.cascadeResearch?.exportLevel?.();
  if (!exported?.level) return;
  const level = Number(exported.level.level) || currentLevel;
  const kicker = document.querySelector("#result-kicker")?.textContent || "";
  if (kicker !== "LEVEL COMPLETE" && kicker !== "RUN COMPLETE") return;
  const token = `${level}:${kicker}:${exported.score}:${exported.movesRemaining}`;
  if (lastAwardedLevelToken === token) return;
  lastAwardedLevelToken = token;

  const quickWindow = quickBonusSeconds(level);
  const elapsedMs = Math.max(0, Date.now() - levelStartedAt);
  const quickBonus = quickWindow > 0 && elapsedMs <= quickWindow * 1000;
  const stars = calculateStars({
    moves: exported.level.moves,
    movesRemaining: exported.movesRemaining,
    quickBonus,
  });
  const reward = performanceReward({
    starsByLevel: performance.starsByLevel,
    level,
    stars,
  });

  performance.starsByLevel = reward.nextStars;
  if (quickBonus) performance.quickWins[String(level)] = true;
  performance.pendingHammerRewards += reward.hammerRewards;
  savePerformanceState(performance);

  const copy = document.querySelector("#result-copy");
  if (copy) {
    const additions = [`${starGlyphs(stars)} · ${reward.nextTotal} total stars`];
    if (quickBonus) additions.push("QUICK BONUS");
    if (reward.hammerRewards) additions.push(`+${reward.hammerRewards} HAMMER EARNED`);
    copy.textContent = `${copy.textContent} ${additions.join(" · ")}.`;
  }

  track("performance_awarded", {
    level,
    stars,
    bestStars: performance.starsByLevel[String(level)],
    totalStars: reward.nextTotal,
    quickBonus,
    elapsedMs,
    hammerRewards: reward.hammerRewards,
  });
  renderPerformance();
}

function handleResultDialog() {
  const dialog = document.querySelector("#result-dialog");
  if (!dialog) return;
  if (!dialog.open) {
    delete dialog.dataset.performanceSanitized;
    return;
  }
  sanitizeGameplayOffers();
  awardCurrentLevelPerformance();
}

function resetLevelClock() {
  const nextLevel = Number(document.querySelector("#level-number")?.textContent) || currentLevel;
  if (nextLevel === currentLevel) return;
  currentLevel = nextLevel;
  levelStartedAt = Date.now();
  lastAwardedLevelToken = "";
  renderPerformance();
}

const levelNumberElement = document.querySelector("#level-number");
if (levelNumberElement) {
  new MutationObserver(resetLevelClock).observe(levelNumberElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const resultDialog = document.querySelector("#result-dialog");
if (resultDialog) {
  new MutationObserver(handleResultDialog).observe(resultDialog, {
    attributes: true,
    attributeFilter: ["open"],
    childList: true,
    subtree: true,
  });
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("#result-actions button") : null;
  if (!target) return;
  const kicker = document.querySelector("#result-kicker")?.textContent || "";
  if (kicker !== "LEVEL COMPLETE" && kicker !== "RUN COMPLETE") return;
  if (performance.pendingHammerRewards <= 0) return;
  const claimed = claimPendingHammerRewards();
  if (claimed <= 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  sessionStorage.setItem(SYNC_GUARD_KEY, "1");
  window.location.reload();
}, true);

const startupClaimed = claimPendingHammerRewards();
if (startupClaimed > 0 && sessionStorage.getItem(SYNC_GUARD_KEY) !== "1") {
  sessionStorage.setItem(SYNC_GUARD_KEY, "1");
  window.location.reload();
} else {
  sessionStorage.removeItem(SYNC_GUARD_KEY);
  renderPerformance();
  window.setInterval(renderPerformance, 500);
}

window.cascadePerformance = Object.freeze({
  exportState: () => loadPerformanceState(),
  calculateStars,
  quickBonusSeconds,
  performanceReward,
  totalBestStars,
});
