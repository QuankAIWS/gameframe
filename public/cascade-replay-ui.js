const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const FAILURE_KEY = "scribbles-gameframe.cascade-failures:v1";
const OPENING_HELP = "Match three or more. Bigger shapes make specials, and adjacent specials can be combined for stronger clears.";

const levelMap = document.querySelector("#level-map");
const help = document.querySelector(".cascade-help");
const resultDialog = document.querySelector("#result-dialog");
const resultKicker = document.querySelector("#result-kicker");
const resultActions = document.querySelector("#result-actions");
let decorating = false;

function readJson(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function frontier() {
  return Math.max(1, Math.floor(Number(window.cascadeReplay?.frontier?.() || readJson(STATE_KEY)?.level || 1)));
}

function starsByLevel() {
  const value = readJson(PERFORMANCE_KEY)?.starsByLevel;
  return value && typeof value === "object" ? value : {};
}

function activeLevelNumber() {
  try {
    return Math.max(1, Math.floor(Number(window.cascadeResearch?.exportLevel?.()?.level?.level) || 1));
  } catch {
    return Math.max(1, Number(document.querySelector("#level-number")?.textContent) || 1);
  }
}

function currentAttemptHasMovesSpent() {
  try {
    const current = window.cascadeResearch?.exportLevel?.();
    return Number.isFinite(current?.movesRemaining)
      && Number.isFinite(current?.level?.moves)
      && current.movesRemaining < current.level.moves;
  } catch {
    return false;
  }
}

function startReplay(level) {
  if (!window.cascadeReplay?.start) return;
  if (level === activeLevelNumber()) return;
  if (currentAttemptHasMovesSpent() && !window.confirm(`Replay level ${level}? Your current attempt will be discarded.`)) return;
  window.cascadeReplay.start(level);
}

function decorateMap() {
  if (!levelMap || decorating) return;
  decorating = true;
  try {
    const campaignFrontier = frontier();
    const stars = starsByLevel();
    const active = activeLevelNumber();
    for (const item of levelMap.querySelectorAll("li[data-level]")) {
      const level = Math.floor(Number(item.dataset.level));
      if (!Number.isInteger(level) || level < 1) continue;
      const best = Math.max(0, Math.min(3, Math.floor(Number(stars[String(level)]) || 0)));
      const cleared = level < campaignFrontier || best > 0;
      item.classList.toggle("is-current", level === active);
      item.classList.toggle("is-replayable", cleared && level !== active);
      if (level <= 5) {
        const label = item.querySelector("span");
        const expectedLabel = level === 1 ? "Start" : "Level";
        if (label && label.textContent !== expectedLabel) label.textContent = expectedLabel;
      }
      if (cleared && level !== active) {
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.title = `Replay level ${level}${best ? ` · best ${best}/3 stars` : ""}`;
        item.setAttribute("aria-label", item.title);
      } else {
        item.removeAttribute("role");
        item.removeAttribute("tabindex");
        item.removeAttribute("title");
      }
    }
  } finally {
    decorating = false;
  }
}

function normalizeHelp() {
  if (!help) return;
  const level = activeLevelNumber();
  if (level < 1 || level > 5) return;
  if (help.textContent !== OPENING_HELP) help.textContent = OPENING_HELP;
}

function failureState() {
  const value = readJson(FAILURE_KEY);
  return {
    level: Math.max(0, Math.floor(Number(value?.level) || 0)),
    count: Math.max(0, Math.floor(Number(value?.count) || 0)),
  };
}

function saveFailureState(value) {
  localStorage.setItem(FAILURE_KEY, JSON.stringify({ level: value.level, count: value.count }));
}

function resetFailures() {
  saveFailureState({ level: 0, count: 0 });
}

function bestImprovementCandidate() {
  const currentFrontier = frontier();
  return Object.entries(starsByLevel())
    .map(([rawLevel, rawStars]) => ({
      level: Math.floor(Number(rawLevel)),
      stars: Math.max(0, Math.min(3, Math.floor(Number(rawStars) || 0))),
    }))
    .filter((entry) => Number.isInteger(entry.level) && entry.level >= 1 && entry.level < currentFrontier && entry.stars > 0 && entry.stars < 3)
    .sort((left, right) => left.stars - right.stars || right.level - left.level)[0] || null;
}

function maybeOfferImprovement() {
  if (!resultDialog?.open || !resultKicker || !resultActions) return;
  const kicker = resultKicker.textContent?.trim().toUpperCase();
  if (kicker === "LEVEL COMPLETE" || kicker === "RUN COMPLETE") {
    if (!window.cascadeReplay?.isReplay?.()) resetFailures();
    return;
  }
  if (kicker !== "OUT OF MOVES" || window.cascadeReplay?.isReplay?.()) return;

  const level = activeLevelNumber();
  const previous = failureState();
  const next = previous.level === level
    ? { level, count: previous.count + 1 }
    : { level, count: 1 };
  saveFailureState(next);
  if (next.count < 3 || resultActions.querySelector("[data-improve-old-level]")) return;

  const candidate = bestImprovementCandidate();
  if (!candidate) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.improveOldLevel = String(candidate.level);
  button.textContent = `Improve level ${candidate.level} (${candidate.stars}/3 ★)`;
  button.addEventListener("click", () => window.cascadeReplay?.start?.(candidate.level));
  resultActions.prepend(button);
}

levelMap?.addEventListener("click", (event) => {
  const item = event.target instanceof Element ? event.target.closest("li[data-level].is-replayable") : null;
  if (item) startReplay(Number(item.dataset.level));
});
levelMap?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target instanceof Element ? event.target.closest("li[data-level].is-replayable") : null;
  if (!item) return;
  event.preventDefault();
  startReplay(Number(item.dataset.level));
});

if (levelMap) {
  new MutationObserver(() => {
    decorateMap();
    normalizeHelp();
  }).observe(levelMap, { childList: true, subtree: true });
}
if (help) new MutationObserver(normalizeHelp).observe(help, { childList: true, subtree: true, characterData: true });
if (resultDialog) new MutationObserver(maybeOfferImprovement).observe(resultDialog, { attributes: true, attributeFilter: ["open"] });
window.addEventListener("gameframe:cascade-level-complete", (event) => {
  if (!event.detail?.replay) resetFailures();
});

decorateMap();
normalizeHelp();