const stylesheetUrl = "/monster-master-results.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const viewEvent = "gameframe:monster-master-pixi-view";
let latestView = null;
let resultSignature = "";
let lockedMatchId = null;
let lockedRevision = -1;
let reassertingStatus = false;

function ensureResultScreen() {
  const match = document.querySelector("#monster-master-match");
  if (!match) return null;
  let screen = match.querySelector("#monster-master-result-screen");
  if (screen) return screen;

  screen = document.createElement("section");
  screen.id = "monster-master-result-screen";
  screen.className = "monster-master-result-screen";
  screen.hidden = true;
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-labelledby", "monster-master-result-title");
  screen.innerHTML = `
    <div class="monster-master-result-panel">
      <p class="monster-master-result-eyebrow">Duel complete</p>
      <h2 id="monster-master-result-title" class="monster-master-result-title"></h2>
      <p id="monster-master-result-summary" class="monster-master-result-summary"></p>
      <div class="monster-master-result-stats" aria-label="Final duel statistics">
        <div class="monster-master-result-stat"><small>Your survivors</small><strong id="monster-master-result-friendly">0</strong></div>
        <div class="monster-master-result-stat"><small>Enemy survivors</small><strong id="monster-master-result-enemy">0</strong></div>
      </div>
      <div class="monster-master-result-actions">
        <button id="monster-master-result-rematch" class="is-primary" type="button">New duel</button>
        <a href="/">Return home</a>
      </div>
    </div>
  `;
  match.append(screen);
  screen.querySelector("#monster-master-result-rematch")?.addEventListener("click", () => {
    resetResult();
    document.querySelector("#monster-master-new-match")?.click();
  });
  return screen;
}

function survivingCount(view, ownerId) {
  return view.observation.board.units.filter((unit) => unit.ownerId === ownerId).length;
}

function resultFor(view) {
  const status = view?.observation?.status;
  if (!status || status.lifecycle !== "completed") return null;
  if (status.draw) return "draw";
  return status.winnerPlayerId === view.observation.yourPlayerId ? "victory" : "defeat";
}

function statusCopy(result) {
  if (result === "victory") return "The opposing Master has fallen. You won the duel.";
  if (result === "defeat") return "Your Master has fallen. You lost the duel.";
  return "The duel ended in a draw.";
}

function setTerminalStatus(result) {
  const status = document.querySelector("#monster-master-status");
  const copy = statusCopy(result);
  if (!status || status.textContent === copy) return;
  reassertingStatus = true;
  status.textContent = copy;
  reassertingStatus = false;
}

function resetResult() {
  const screen = ensureResultScreen();
  if (screen) {
    screen.hidden = true;
    screen.removeAttribute("data-result");
  }
  latestView = null;
  resultSignature = "";
  lockedMatchId = null;
  lockedRevision = -1;
}

function renderResult(view = latestView) {
  const screen = ensureResultScreen();
  if (!screen || !view) return;
  const result = resultFor(view);
  if (!result) {
    screen.hidden = true;
    screen.removeAttribute("data-result");
    resultSignature = "";
    return;
  }

  const yourId = view.observation.yourPlayerId;
  const enemyId = view.playerIds.find((candidate) => candidate !== yourId) ?? null;
  const friendlySurvivors = survivingCount(view, yourId);
  const enemySurvivors = enemyId ? survivingCount(view, enemyId) : 0;
  const signature = `${view.matchId}:${view.revision}:${result}:${friendlySurvivors}:${enemySurvivors}`;
  const changed = signature !== resultSignature;
  resultSignature = signature;

  screen.dataset.result = result;
  screen.querySelector("#monster-master-result-title").textContent = result === "victory"
    ? "Victory"
    : result === "defeat"
      ? "Defeat"
      : "Draw";
  screen.querySelector("#monster-master-result-summary").textContent = result === "victory"
    ? "The opposing Master has fallen. Your surviving force holds the battlefield."
    : result === "defeat"
      ? "Your Master has fallen. The opposing force holds the battlefield."
      : "The final round ended with both Masters still standing.";
  screen.querySelector("#monster-master-result-friendly").textContent = String(friendlySurvivors);
  screen.querySelector("#monster-master-result-enemy").textContent = String(enemySurvivors);
  setTerminalStatus(result);
  screen.hidden = false;

  if (changed) {
    requestAnimationFrame(() => screen.querySelector("#monster-master-result-rematch")?.focus({ preventScroll: true }));
  }
}

function capture(candidate) {
  const view = candidate?.gameId === "monster-master-duel"
    ? candidate
    : candidate?.view?.gameId === "monster-master-duel"
      ? candidate.view
      : null;
  if (!view) return;
  const revision = Number(view.revision) || 0;
  if (lockedMatchId === view.matchId && revision < lockedRevision) {
    renderResult(latestView);
    return;
  }

  latestView = view;
  if (resultFor(view)) {
    lockedMatchId = view.matchId;
    lockedRevision = revision;
  }
  renderResult(view);
}

window.addEventListener(viewEvent, (event) => capture(event.detail?.view));
document.querySelector("#monster-master-new-match")?.addEventListener("click", resetResult);

const statusNode = document.querySelector("#monster-master-status");
if (statusNode) {
  new MutationObserver(() => {
    if (reassertingStatus || !latestView || !resultFor(latestView)) return;
    setTerminalStatus(resultFor(latestView));
  }).observe(statusNode, { childList: true, subtree: true, characterData: true });
}

queueMicrotask(() => {
  const current = window.gameFrameMonsterController?.getView?.();
  if (current) capture(current);
});

window.gameFrameMonsterResults = Object.freeze({
  capture,
  render: renderResult,
  reset: resetResult,
  getView: () => latestView,
});
