const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const LIFE_MAX = 5;
const LIFE_REGEN_MS = 10 * 60 * 1000;

const $ = (selector) => document.querySelector(selector);
const lifeTimer = $("#life-timer");
const lifeLock = $("#life-lock");
const lifeLockTimer = $("#life-lock-timer");
const boostDialog = $("#boost-info-dialog");
const boostState = $("#boost-state");
const refillLifeButton = $("#boost-refill-lives");
const hammerOfferButton = $("#boost-hammers");
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

function iouTotal(state) {
  return Array.isArray(state?.ledger)
    ? state.ledger.reduce((sum, item) => sum + Number(item?.amount || 0), 0)
    : 0;
}

function track(type, detail = {}) {
  try {
    const events = JSON.parse(window.localStorage.getItem(ANALYTICS_KEY) || "[]");
    events.push({ at: new Date().toISOString(), type, ...detail });
    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Optional local telemetry must never affect the game.
  }
}

function addIou(state, reason, amount) {
  if (!Array.isArray(state.ledger)) state.ledger = [];
  state.ledger.push({
    at: new Date().toISOString(),
    reason,
    amount,
    level: Math.max(1, Number(state.level) || 1),
  });
  const total = iouTotal(state);
  track("iou_accept", { reason, amount, total, level: state.level });
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

function renderBoostState(state) {
  if (!boostState) return;
  const lives = Math.max(0, Math.min(LIFE_MAX, Number(state?.lives) || 0));
  const hammers = Math.max(0, Number(state?.hammers) || 0);
  boostState.textContent = `${lives}/${LIFE_MAX} lives · ${hammers} hammers · IOU$ ${iouTotal(state).toLocaleString()}`;
  if (refillLifeButton) refillLifeButton.disabled = lives > 0;
  if (hammerOfferButton) hammerOfferButton.disabled = hammers > 0;
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
  renderBoostState(state);

  if (lives === 0 && resultDialog?.open && resultKicker?.textContent === "OUT OF LIVES" && resultCopy) {
    resultCopy.textContent = `Next life in ${formatCountdown(remaining)}. Refill all five lives and jump straight back in.`;
  }
}

function openBoostDialog() {
  const state = readState();
  if (state) renderBoostState(state);
  if (boostDialog && !boostDialog.open) boostDialog.showModal();
}

$("#open-boost-info")?.addEventListener("click", openBoostDialog);
$("#life-lock-boost")?.addEventListener("click", openBoostDialog);

$("#boost-view-ious")?.addEventListener("click", () => {
  boostDialog?.close();
  $("#open-ledger")?.click();
});

refillLifeButton?.addEventListener("click", () => {
  const state = readState();
  if (!state || Number(state.lives) > 0) return;
  addIou(state, "Five-life refill", 5);
  state.lives = LIFE_MAX;
  state.lastLifeAt = Date.now();
  writeState(state);
  boostDialog?.close();
  window.location.reload();
});

hammerOfferButton?.addEventListener("click", () => {
  const state = readState();
  if (!state || Number(state.hammers) > 0) return;
  boostDialog?.close();
  hammerButton?.click();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});

window.setInterval(tick, 1000);
tick();
