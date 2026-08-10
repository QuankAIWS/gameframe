const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
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

function readState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STATE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function countdownMs(state, now = Date.now()) {
  const lives = Math.max(0, Math.min(LIFE_MAX, Number(state?.lives) || 0));
  if (lives >= LIFE_MAX) return 0;
  const lastLifeAt = Number(state?.lastLifeAt) || now;
  const elapsed = Math.max(0, now - lastLifeAt);
  const remainder = elapsed % LIFE_REGEN_MS;
  return remainder === 0 && elapsed > 0 ? LIFE_REGEN_MS : LIFE_REGEN_MS - remainder;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function restoreWaitingLifeIfReady(state, now = Date.now()) {
  const lives = Math.max(0, Math.min(LIFE_MAX, Number(state?.lives) || 0));
  if (lives !== 0) return false;
  const lastLifeAt = Number(state?.lastLifeAt) || now;
  const elapsed = Math.max(0, now - lastLifeAt);
  const restored = Math.floor(elapsed / LIFE_REGEN_MS);
  if (restored <= 0) return false;
  state.lives = Math.min(LIFE_MAX, restored);
  state.lastLifeAt = lastLifeAt + restored * LIFE_REGEN_MS;
  writeState(state);
  return true;
}

function setBoardBlocked(blocked) {
  document.body.classList.toggle("cascade-no-lives", blocked);
  if (lifeLock) lifeLock.hidden = !blocked;
  board?.querySelectorAll("button").forEach((tile) => {
    tile.disabled = blocked;
  });
  if (hammerButton && blocked) hammerButton.disabled = true;
}

function tick() {
  const state = readState();
  if (!state) return;

  if (restoreWaitingLifeIfReady(state)) {
    window.location.reload();
    return;
  }

  const lives = Math.max(0, Math.min(LIFE_MAX, Number(state.lives) || 0));
  const remaining = countdownMs(state);
  const label = lives >= LIFE_MAX ? "FULL" : `+1 IN ${formatCountdown(remaining)}`;
  if (lifeTimer) {
    lifeTimer.textContent = label;
    lifeTimer.hidden = lives >= LIFE_MAX;
  }
  if (lifeLockTimer) lifeLockTimer.textContent = formatCountdown(remaining);
  setBoardBlocked(lives === 0);

  if (lives === 0 && resultDialog?.open && resultKicker?.textContent === "OUT OF LIVES" && resultCopy) {
    resultCopy.textContent = `Next life in ${formatCountdown(remaining)}. Lives recharge automatically while you're away.`;
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});

window.setInterval(tick, 1000);
tick();
