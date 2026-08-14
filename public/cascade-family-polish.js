const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const BLITZ_RETURN_KEY = "scribbles-gameframe.cascade-blitz-return:v1";
const WEEKLY_SCORE_WAIT_MS = 4_000;

const resultDialog = document.querySelector("#result-dialog");
const resultKicker = document.querySelector("#result-kicker");

function preserveNormalRunForBonus() {
  const activeRun = window.localStorage.getItem(ACTIVE_RUN_KEY);
  if (activeRun) window.sessionStorage.setItem(BLITZ_RETURN_KEY, activeRun);
}

function wrapResearchBlitz() {
  const research = window.cascadeResearch;
  if (!research?.startBlitz || research.familyPolishWrapped) return;
  window.cascadeResearch = Object.freeze({
    ...research,
    familyPolishWrapped: true,
    startBlitz(completedLevel = 5) {
      preserveNormalRunForBonus();
      return research.startBlitz(completedLevel);
    },
  });
}

function waitForWeeklyScoreSettlement(timeoutMs = WEEKLY_SCORE_WAIT_MS) {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      const status = document.querySelector("[data-weekly-status]");
      if (!status || !status.textContent?.startsWith("Saving weekly score")) {
        resolve(true);
        return;
      }

      let settled = false;
      let observer = null;
      const finish = (sharedSaved) => {
        if (settled) return;
        settled = true;
        observer?.disconnect();
        window.clearTimeout(timeout);
        resolve(sharedSaved);
      };
      observer = new MutationObserver(() => {
        if (status.textContent?.startsWith("Saving weekly score")) return;
        finish(true);
      });
      observer.observe(status, { subtree: true, childList: true, characterData: true });
      const timeout = window.setTimeout(() => {
        if (status.textContent?.startsWith("Saving weekly score")) {
          status.textContent = "Score saved locally; shared standings unavailable.";
        }
        finish(false);
      }, Math.max(250, Number(timeoutMs) || WEEKLY_SCORE_WAIT_MS));
    });
  });
}

async function restoreNormalRunAfterBlitz(event) {
  const button = event.target instanceof Element ? event.target.closest("#result-actions button") : null;
  if (!button || button.textContent !== "Continue") return;
  if (resultKicker?.textContent !== "BLITZ COMPLETE") return;
  const snapshot = window.sessionStorage.getItem(BLITZ_RETURN_KEY);
  if (!snapshot) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  button.disabled = true;
  const originalLabel = button.textContent;
  if (document.querySelector("[data-weekly-status]")?.textContent?.startsWith("Saving weekly score")) {
    button.textContent = "Saving score…";
  }
  await waitForWeeklyScoreSettlement();
  button.textContent = originalLabel;
  window.localStorage.setItem(ACTIVE_RUN_KEY, snapshot);
  window.sessionStorage.removeItem(BLITZ_RETURN_KEY);
  if (resultDialog?.open) resultDialog.close();
  window.location.reload();
}

function hardenTerminalDialogs() {
  document.addEventListener("cancel", (event) => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (dialog === resultDialog || dialog.id === "cascade-recall-dialog") event.preventDefault();
  }, true);
}

function polishLevelTreeStars() {
  for (const badge of document.querySelectorAll(".cascade-map-stars")) {
    const match = badge.getAttribute("aria-label")?.match(/^Best rating: ([1-3]) of 3 stars$/);
    if (!match) continue;
    const filled = "★".repeat(Number(match[1]));
    if (badge.textContent !== filled) badge.textContent = filled;
  }
}

function polishPlayerCopy() {
  polishLevelTreeStars();

  const feedbackLabel = document.querySelector("#cascade-feedback-card > small");
  if (feedbackLabel?.textContent === "FEEDBACK") feedbackLabel.textContent = "SETTINGS";

  const weeklyCopy = document.querySelector("[data-weekly-copy]");
  if (weeklyCopy?.textContent?.includes("same board seed for everyone")) {
    weeklyCopy.textContent = weeklyCopy.textContent.replace("same board seed for everyone", "everyone gets the same board this week");
  }

  const weeklyStatus = document.querySelector("[data-weekly-status]");
  if (weeklyStatus?.textContent?.startsWith("Shared seed ·")) {
    weeklyStatus.textContent = weeklyStatus.textContent.replace("Shared seed ·", "Same board for everyone ·");
  }
}

wrapResearchBlitz();
hardenTerminalDialogs();
polishPlayerCopy();

document.addEventListener("click", restoreNormalRunAfterBlitz, true);
new MutationObserver(polishPlayerCopy).observe(document.body, { subtree: true, childList: true, characterData: true });

window.cascadeFamilyPolish = Object.freeze({ preserveNormalRunForBonus, polishLevelTreeStars, polishPlayerCopy });
