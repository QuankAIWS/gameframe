const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const resultDialog = document.querySelector("#result-dialog");
const resultKicker = document.querySelector("#result-kicker");
const resultCopy = document.querySelector("#result-copy");
const resultActions = document.querySelector("#result-actions");
let consolidating = false;

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

function ensureChoiceArea(stage) {
  const panel = stage.querySelector(".cascade-reward-panel");
  if (!panel) return null;
  let summary = panel.querySelector(".cascade-reward-summary");
  if (!summary) {
    summary = document.createElement("p");
    summary.className = "cascade-reward-summary";
    panel.append(summary);
  }
  let actions = panel.querySelector(".cascade-reward-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "cascade-reward-actions";
    panel.append(actions);
  }
  return { panel, summary, actions };
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
  stage.classList.remove("is-active", "is-awaiting-choice");
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

function consolidateVictory() {
  if (consolidating || !resultDialog?.open || !resultKicker || !resultActions) return;
  const kicker = resultKicker.textContent?.trim().toUpperCase();
  if (kicker !== "LEVEL COMPLETE" && kicker !== "RUN COMPLETE") return;
  const stage = document.querySelector(".cascade-reward-stage");
  if (!stage) return;
  const choice = ensureChoiceArea(stage);
  if (!choice) return;

  consolidating = true;
  try {
    const completedLevel = activeLevelNumber();
    const final = kicker === "RUN COMPLETE";
    const replay = Boolean(window.cascadeReplay?.isReplay?.());
    choice.summary.textContent = resultCopy?.textContent?.trim() || "";
    choice.actions.replaceChildren();

    if (replay) {
      choice.actions.append(
        customButton(`Replay level ${completedLevel}`, "", () => window.cascadeReplay?.start?.(completedLevel)),
        customButton(`Return to level ${window.cascadeReplay?.frontier?.() || "run"}`, "primary", () => window.cascadeReplay?.finish?.()),
      );
    } else {
      const originalButtons = [...resultActions.querySelectorAll("button")];
      if (bestStars(completedLevel) < 3) {
        choice.actions.append(customButton("Replay for more stars", "", () => window.cascadeReplay?.start?.(completedLevel)));
      }
      for (const button of originalButtons) {
        button.addEventListener("click", () => hideStage(stage), { once: true });
        choice.actions.append(button);
      }
    }

    publishCompletion(completedLevel, final, replay);
    resultDialog.close();
    stage.setAttribute("aria-hidden", "false");
    stage.classList.add("is-active", "is-awaiting-choice");
  } finally {
    consolidating = false;
  }
}

if (resultDialog) {
  new MutationObserver(consolidateVictory).observe(resultDialog, {
    attributes: true,
    attributeFilter: ["open"],
  });
}
