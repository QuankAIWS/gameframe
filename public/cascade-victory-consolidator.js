const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const resultDialog = document.querySelector("#result-dialog");
const resultKicker = document.querySelector("#result-kicker");
const resultActions = document.querySelector("#result-actions");
const boardWrap = document.querySelector(".cascade-board-wrap");
let consolidating = false;
let observedStage = null;
let stageObserver = null;

function readPerformance() {
  try {
    const value = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function activeLevelNumber() {
  try {
    return Math.max(1, Math.floor(Number(window.cascadeResearch?.exportLevel?.()?.level?.level) || 1));
  } catch {
    return Math.max(1, Math.floor(Number(document.querySelector("#level-number")?.textContent) || 1));
  }
}

function bestStars(level) {
  return Math.max(0, Math.min(3, Math.floor(Number(readPerformance()?.starsByLevel?.[String(level)]) || 0)));
}

function ensureActionArea(stage) {
  const panel = stage.querySelector(".cascade-reward-panel");
  if (!panel) return null;
  let actions = panel.querySelector(".cascade-reward-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "cascade-reward-actions";
    panel.append(actions);
  }
  return { panel, actions };
}

function customButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function hideStage(stage) {
  stage.classList.remove("is-active", "is-awaiting-choice", "is-victory-continuous");
  stage.setAttribute("aria-hidden", "true");
}

function publishCompletion(level, final, replay) {
  window.dispatchEvent(new CustomEvent("gameframe:cascade-level-complete", {
    detail: {
      level,
      final,
      replay,
    },
  }));
}

function syncStageContinuity(stage) {
  if (!stage.classList.contains("is-active") || stage.classList.contains("is-awaiting-choice")) return;
  if (!stage.classList.contains("is-victory-continuous")) {
    stage.classList.add("is-victory-continuous");
  }
  if (stage.getAttribute("aria-hidden") !== "false") {
    stage.setAttribute("aria-hidden", "false");
  }
}

function observeRewardStage(stage) {
  if (!stage) return;
  ensureActionArea(stage);
  if (stage === observedStage) return;
  stageObserver?.disconnect();
  observedStage = stage;
  stageObserver = new MutationObserver(() => syncStageContinuity(stage));
  stageObserver.observe(stage, { attributes: true, attributeFilter: ["class"] });
  syncStageContinuity(stage);
}

function findRewardStage() {
  const stage = document.querySelector(".cascade-reward-stage");
  if (stage) observeRewardStage(stage);
  return stage;
}

function consolidateVictory() {
  if (consolidating || !resultKicker || !resultActions) return false;
  const kicker = resultKicker.textContent?.trim().toUpperCase();
  if (kicker !== "LEVEL COMPLETE" && kicker !== "RUN COMPLETE") return false;
  const stage = findRewardStage();
  if (!stage) return false;
  const choice = ensureActionArea(stage);
  if (!choice) return false;

  consolidating = true;
  try {
    const completedLevel = activeLevelNumber();
    const final = kicker === "RUN COMPLETE";
    const replay = Boolean(window.cascadeReplay?.isReplay?.());
    choice.actions.replaceChildren();

    if (replay) {
      choice.actions.append(
        customButton(`Replay level ${completedLevel}`, "", () => {
          hideStage(stage);
          window.cascadeReplay?.start?.(completedLevel);
        }),
        customButton(`Return to level ${window.cascadeReplay?.frontier?.() || "run"}`, "primary", () => {
          hideStage(stage);
          window.cascadeReplay?.finish?.();
        }),
      );
    } else {
      const originalButtons = [...resultActions.querySelectorAll("button")];
      if (bestStars(completedLevel) < 3) {
        choice.actions.append(customButton("Replay for more stars", "", () => {
          hideStage(stage);
          window.cascadeReplay?.start?.(completedLevel);
        }));
      }
      for (const button of originalButtons) {
        button.addEventListener("click", () => hideStage(stage), { once: true });
        choice.actions.append(button);
      }
    }

    publishCompletion(completedLevel, final, replay);
    if (resultDialog?.open) resultDialog.close();
    stage.setAttribute("aria-hidden", "false");
    // Keep the exact final frame of the reward animation. Do not re-add
    // `is-active`: doing so would replay the panel entrance animation and make
    // the action handoff look like a second victory menu.
    stage.classList.add("is-victory-continuous", "is-awaiting-choice");
    return true;
  } finally {
    consolidating = false;
  }
}

if (boardWrap) {
  new MutationObserver(findRewardStage).observe(boardWrap, { childList: true });
}
findRewardStage();

if (resultDialog) {
  const nativeShowModal = resultDialog.showModal.bind(resultDialog);
  resultDialog.showModal = function cascadeResultShowModal() {
    // The runtime still prepares the shared result actions for all outcomes.
    // Successful levels consume those actions directly into the animated reward
    // panel instead of opening a second dialog or replacing the reward content.
    if (consolidateVictory()) return;
    nativeShowModal();
  };

  // Keep a defensive compatibility path for any caller that bypasses showModal.
  new MutationObserver(() => {
    if (resultDialog.open) consolidateVictory();
  }).observe(resultDialog, { attributes: true, attributeFilter: ["open"] });
}

window.cascadeVictoryConsolidator = Object.freeze({
  consolidate: consolidateVictory,
  hide() {
    const stage = findRewardStage();
    if (stage) hideStage(stage);
  },
});
