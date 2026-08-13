import { gameFrameBuildRefresh } from "./gameframe-build-refresh.js";

const CHECK_EVERY_LEVELS = 5;
const resultDialog = document.querySelector("#result-dialog");
const resultKicker = document.querySelector("#result-kicker");
const resultTitle = document.querySelector("#result-title");
const levelNumber = document.querySelector("#level-number");

let lastCompleted = null;
let lastCheckpointChecked = 0;
let refreshAttempt = null;

function completedLevelFromDialog() {
  if (!resultDialog?.open) return null;
  const kicker = resultKicker?.textContent?.trim() || "";
  if (kicker === "LEVEL COMPLETE") {
    const match = /Level\s+(\d+)\s+cleared\./i.exec(resultTitle?.textContent || "");
    const level = Number(match?.[1]);
    return Number.isInteger(level) && level > 0 ? { level, final: false } : null;
  }
  if (kicker === "RUN COMPLETE") {
    const level = Number(levelNumber?.textContent);
    return Number.isInteger(level) && level > 0 ? { level, final: true } : null;
  }
  return null;
}

function cascadeSnapshot() {
  try {
    return window.cascadeResearch?.exportLevel?.() ?? null;
  } catch {
    return null;
  }
}

function isFreshNormalLevelAfter(completed) {
  if (!completed || resultDialog?.open) return false;
  const snapshot = cascadeSnapshot();
  if (!snapshot || snapshot.mode !== "normal" || !snapshot.level) return false;
  const currentLevel = Number(snapshot.level.level);
  const totalMoves = Number(snapshot.level.moves);
  const movesRemaining = Number(snapshot.movesRemaining);
  const untouched = Number(snapshot.score) === 0
    && Number.isFinite(totalMoves)
    && movesRemaining === totalMoves;
  if (!untouched) return false;
  return completed.final ? currentLevel === completed.level : currentLevel === completed.level + 1;
}

function showRefreshCurtain() {
  if (document.querySelector("#cascade-build-refresh-curtain")) return;
  const curtain = document.createElement("div");
  curtain.id = "cascade-build-refresh-curtain";
  curtain.className = "cascade-build-refresh-curtain";
  curtain.setAttribute("aria-hidden", "true");
  curtain.innerHTML = `
    <div class="cascade-build-refresh-card">
      <small>NEXT LEVEL</small>
      <strong>Loading…</strong>
      <span class="cascade-build-refresh-dots"><i></i><i></i><i></i></span>
    </div>
  `;
  document.body.append(curtain);
}

async function maybeRefreshAtSafeBoundary() {
  if (!lastCompleted || !gameFrameBuildRefresh.isUpdatePending()) return false;
  if (!isFreshNormalLevelAfter(lastCompleted)) return false;
  if (refreshAttempt) return refreshAttempt;
  refreshAttempt = gameFrameBuildRefresh.refreshIfPending()
    .finally(() => {
      refreshAttempt = null;
    });
  return refreshAttempt;
}

async function checkCheckpoint(completed) {
  if (!completed || completed.level % CHECK_EVERY_LEVELS !== 0) return false;
  if (lastCheckpointChecked === completed.level) return gameFrameBuildRefresh.isUpdatePending();
  lastCheckpointChecked = completed.level;
  const pending = await gameFrameBuildRefresh.checkForUpdate();
  if (pending) await maybeRefreshAtSafeBoundary();
  return pending;
}

function inspectResultDialog() {
  const completed = completedLevelFromDialog();
  if (!completed) return;
  lastCompleted = completed;
  void checkCheckpoint(completed);
}

function inspectPossibleSafeBoundary() {
  inspectResultDialog();
  void maybeRefreshAtSafeBoundary();
}

if (resultDialog) {
  new MutationObserver(inspectPossibleSafeBoundary).observe(resultDialog, {
    attributes: true,
    attributeFilter: ["open"],
    childList: true,
    subtree: true,
    characterData: true,
  });
}

if (levelNumber) {
  new MutationObserver(inspectPossibleSafeBoundary).observe(levelNumber, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

new MutationObserver(inspectPossibleSafeBoundary).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"],
});

window.addEventListener("gameframe:build-update-pending", () => {
  void maybeRefreshAtSafeBoundary();
});
window.addEventListener("gameframe:build-refresh", showRefreshCurtain);

window.setTimeout(inspectPossibleSafeBoundary, 0);

window.cascadeBuildRefresh = Object.freeze({
  checkpointInterval: CHECK_EVERY_LEVELS,
  inspect: inspectPossibleSafeBoundary,
  lastCompleted: () => lastCompleted ? { ...lastCompleted } : null,
});
