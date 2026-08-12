const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const LIFE_QUEUE_KEY = "scribbles-gameframe.cascade-life-queue:v1";
const LIFE_MAX = 5;
const LIFE_REGEN_MS = 10 * 60 * 1000;

const $ = (selector) => document.querySelector(selector);
const lifeTimer = $("#life-timer");
const lifeLock = $("#life-lock");
const lifeLockTimer = $("#life-lock-timer");
const board = $("#board");
const hammerButton = $("#booster-hammer");
const resultDialog = $("#result-dialog");
const resultKicker = $("#result-kicker");
const resultCopy = $("#result-copy");

let reloadQueued = false;

function readJson(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readState() {
  return readJson(STATE_KEY);
}

function queueStart(state, now = Date.now()) {
  const explicit = Number(window.localStorage.getItem(LIFE_QUEUE_KEY));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const fallback = Number(state?.lastLifeAt);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : now;
}

function countdownMs(state, now = Date.now()) {
  const lives = Math.max(0, Math.min(LIFE_MAX, Number(state?.lives) || 0));
  if (lives >= LIFE_MAX) return 0;
  const elapsed = Math.max(0, now - queueStart(state, now));
  const remainder = elapsed % LIFE_REGEN_MS;
  return remainder === 0 && elapsed > 0 ? 0 : LIFE_REGEN_MS - remainder;
}

function livesDue(state, now = Date.now()) {
  const lives = Math.max(0, Math.min(LIFE_MAX, Number(state?.lives) || 0));
  if (lives >= LIFE_MAX) return 0;
  return Math.max(0, Math.floor((now - queueStart(state, now)) / LIFE_REGEN_MS));
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function bonusBoardActive() {
  return document.body.classList.contains("cascade-blitz-mode");
}

function sameArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function activeRunCommitted() {
  const current = window.cascadeResearch?.exportLevel?.();
  if (!current || current.mode !== "normal") return true;
  const saved = readJson(ACTIVE_RUN_KEY);
  if (!saved) return false;
  if (Number(saved.level) !== Number(current.level?.level)) return false;
  if (Number(saved.score) !== Number(current.score)) return false;
  if (Number(saved.movesRemaining) !== Number(current.movesRemaining)) return false;
  if (!sameArray(saved.board, current.board) || !sameArray(saved.specials, current.specials)) return false;
  if (!sameArray(saved.levelProgress?.collected, current.progress?.collected)) return false;
  if (!sameArray(saved.levelProgress?.ice, current.progress?.ice)) return false;
  return true;
}

function boardBusy() {
  if (!activeRunCommitted()) return true;
  if (board?.getAnimations?.({ subtree: true }).some((animation) => animation.playState === "running")) return true;
  return Boolean(document.querySelector(
    ".cascade-tile.is-selected, .cascade-tile.is-hammer-target, .cascade-tile.is-hammer-hit, .cascade-tile.is-clearing, .cascade-tile.is-falling, .cascade-tile.is-landing, .cascade-tile.is-special-triggered, .cascade-board.is-shuffling, .cascade-board.is-shuffle-in",
  ));
}

function queueSafeReload() {
  if (reloadQueued || bonusBoardActive() || resultDialog?.open || boardBusy()) return;
  reloadQueued = true;
  window.setTimeout(() => window.location.reload(), 30);
}

function setBoardBlocked(blocked) {
  document.body.classList.toggle("cascade-no-lives", blocked);
  if (lifeLock) lifeLock.hidden = !blocked;
  board?.querySelectorAll("button").forEach((tile) => {
    tile.disabled = blocked;
  });
  // This layer may impose the zero-life lock, but the runtime owns when the
  // Hammer becomes enabled again (for example after a cascade finishes).
  if (hammerButton && blocked) hammerButton.disabled = true;
}

function tick() {
  const state = readState();
  if (!state) return;

  const lives = Math.max(0, Math.min(LIFE_MAX, Number(state.lives) || 0));
  const due = livesDue(state);
  const remaining = countdownMs(state);
  const label = lives >= LIFE_MAX ? "FULL" : due > 0 ? "LIFE READY" : `+1 IN ${formatCountdown(remaining)}`;
  if (lifeTimer) {
    lifeTimer.textContent = label;
    lifeTimer.hidden = lives >= LIFE_MAX;
  }
  if (lifeLockTimer) lifeLockTimer.textContent = due > 0 ? "READY" : formatCountdown(remaining);

  const blocked = lives === 0 && !bonusBoardActive();
  setBoardBlocked(blocked);

  if (lives === 0 && resultDialog?.open && resultKicker?.textContent === "OUT OF LIVES" && resultCopy) {
    resultCopy.textContent = due > 0
      ? "A life is ready. Returning you to the level now."
      : `Next life in ${formatCountdown(remaining)}. Lives recharge automatically while you're away.`;
  }

  if (due > 0) queueSafeReload();
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});

new MutationObserver(tick).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"],
});

window.setInterval(tick, 1000);
tick();
