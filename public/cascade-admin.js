import { LEVEL_COUNT } from "./cascade-engine.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const LIFE_MAX = 5;

function syncExpandedRunCopy() {
  const kicker = document.querySelector("#result-kicker");
  const title = document.querySelector("#result-title");
  if (kicker?.textContent !== "RUN COMPLETE") return;
  if (title?.textContent === "Twenty down.") title.textContent = `${LEVEL_COUNT} down.`;
  const action = document.querySelector("#result-actions button");
  if (action?.textContent === "Replay level 20") action.textContent = `Replay level ${LEVEL_COUNT}`;
}

const resultDialog = document.querySelector("#result-dialog");
if (resultDialog) {
  new MutationObserver(syncExpandedRunCopy).observe(resultDialog, { childList: true, subtree: true, characterData: true });
}

function parseLevelCommand(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(?:go\s+to\s+)?(?:level\s+)?(\d+)$/i)
    || text.match(/^jump\s+(?:to\s+)?(?:level\s+)?(\d+)$/i);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT ? level : null;
}

function readState() {
  let state = {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STATE_KEY) || "null");
    if (parsed && typeof parsed === "object") state = parsed;
  } catch {
    state = {};
  }
  return {
    level: Math.min(LEVEL_COUNT, Math.max(1, Number(state.level) || 1)),
    lives: Math.min(LIFE_MAX, Math.max(0, Number(state.lives) || 0)),
    lastLifeAt: Number(state.lastLifeAt) || Date.now(),
    streak: Math.max(0, Number(state.streak) || 0),
    hammers: Math.max(0, Number(state.hammers) || 0),
    ledger: Array.isArray(state.ledger) ? state.ledger : [],
  };
}

function writeState(state) {
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function iouTotal(state) {
  return state.ledger.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
}

function writeLevel(level) {
  const state = readState();
  state.level = level;
  writeState(state);
}

function stateSummary(state = readState()) {
  return `L${state.level} · ${state.lives}/${LIFE_MAX} lives · ${state.hammers} hammers · streak ${state.streak} · IOU$ ${iouTotal(state).toLocaleString()}`;
}

function installConsole(identity) {
  if (document.querySelector("#cascade-admin-open")) return;

  const open = document.createElement("button");
  open.id = "cascade-admin-open";
  open.type = "button";
  open.className = "cascade-admin-open";
  open.textContent = "ADMIN";
  document.body.append(open);

  const dialog = document.createElement("dialog");
  dialog.id = "cascade-admin-dialog";
  dialog.className = "cascade-admin-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="cascade-admin-panel">
      <header>
        <div>
          <small>CASCADE ADMIN</small>
          <h2>Playtest controls</h2>
        </div>
        <button type="submit" value="close" aria-label="Close admin console">×</button>
      </header>

      <p class="cascade-admin-state" data-admin-state></p>

      <section class="cascade-admin-section">
        <small>LEVEL JUMP</small>
        <p>Jump straight to a level for playtesting.</p>
        <label for="cascade-admin-command">Command</label>
        <div class="cascade-admin-command-row">
          <input id="cascade-admin-command" autocomplete="off" spellcheck="false" placeholder="go to level 20">
          <button type="button" data-admin-run>Run</button>
        </div>
        <div class="cascade-admin-jumps" aria-label="Quick level jumps">
          <button type="button" data-level="1">1</button>
          <button type="button" data-level="8">8</button>
          <button type="button" data-level="13">13</button>
          <button type="button" data-level="21">21</button>
          <button type="button" data-level="30">30</button>
        </div>
      </section>

      <section class="cascade-admin-section">
        <small>LIVES</small>
        <p>Force life states to test countdowns, refill offers, and lockout behavior.</p>
        <div class="cascade-admin-control-grid cascade-admin-control-grid-four">
          <button type="button" data-life-delta="-1">−1 life</button>
          <button type="button" data-lives="0">0 lives</button>
          <button type="button" data-lives="1">1 life</button>
          <button type="button" data-lives="5">Full 5</button>
        </div>
      </section>

      <section class="cascade-admin-section">
        <small>HAMMERS / STREAK</small>
        <p>Set inventory edges quickly so the booster offers can be exercised.</p>
        <div class="cascade-admin-control-grid">
          <button type="button" data-hammers="0">0 hammers</button>
          <button type="button" data-hammers="1">1 hammer</button>
          <button type="button" data-hammer-delta="3">+3 hammers</button>
          <button type="button" data-reset-streak>Reset streak</button>
        </div>
      </section>

      <section class="cascade-admin-section cascade-admin-reset-section">
        <small>TEST STATE</small>
        <p>Reset gameplay to level 1, 5 lives, 2 hammers, and streak 0. IOUs are preserved.</p>
        <div class="cascade-admin-control-grid">
          <button type="button" class="cascade-admin-reset" data-admin-reset-game>Reset gameplay state</button>
          <button type="button" class="cascade-admin-reset" data-admin-reset-iou>Reset IOU ledger</button>
        </div>
      </section>

      <p class="cascade-admin-status" data-admin-status role="status">Signed in as ${identity.displayName || identity.playerId}.</p>
    </form>
  `;
  document.body.append(dialog);

  const command = dialog.querySelector("#cascade-admin-command");
  const status = dialog.querySelector("[data-admin-status]");
  const stateLine = dialog.querySelector("[data-admin-state]");
  const resetIou = dialog.querySelector("[data-admin-reset-iou]");
  const resetGame = dialog.querySelector("[data-admin-reset-game]");
  let resetIouExpiresAt = 0;
  let resetGameExpiresAt = 0;

  function refreshSummary() {
    stateLine.textContent = stateSummary();
  }

  function reloadWithStatus(message) {
    status.textContent = message;
    window.setTimeout(() => window.location.reload(), 100);
  }

  function mutateState(mutator, message) {
    const state = readState();
    mutator(state);
    writeState(state);
    refreshSummary();
    reloadWithStatus(message);
  }

  function jump(level) {
    writeLevel(level);
    reloadWithStatus(`Jumping to level ${level}…`);
  }

  function runCommand() {
    const level = parseLevelCommand(command.value);
    if (!level) {
      status.textContent = `Use a level from 1 to ${LEVEL_COUNT}, like “go to level 20”.`;
      command.select();
      return;
    }
    jump(level);
  }

  function clearConfirmations() {
    resetIouExpiresAt = 0;
    resetGameExpiresAt = 0;
    resetIou.textContent = "Reset IOU ledger";
    resetGame.textContent = "Reset gameplay state";
  }

  function resetIouLedger() {
    const now = Date.now();
    if (now > resetIouExpiresAt) {
      clearConfirmations();
      resetIouExpiresAt = now + 10_000;
      resetIou.textContent = "Confirm IOU reset";
      status.textContent = "IOU reset armed for 10 seconds.";
      return;
    }

    const resetHook = document.querySelector("#reset-ledger");
    if (!resetHook) {
      clearConfirmations();
      status.textContent = "IOU reset hook is unavailable.";
      return;
    }

    resetHook.click();
    clearConfirmations();
    refreshSummary();
    status.textContent = "IOU ledger cleared.";
  }

  function resetGameplayState() {
    const now = Date.now();
    if (now > resetGameExpiresAt) {
      clearConfirmations();
      resetGameExpiresAt = now + 10_000;
      resetGame.textContent = "Confirm gameplay reset";
      status.textContent = "Gameplay reset armed for 10 seconds.";
      return;
    }

    mutateState((state) => {
      state.level = 1;
      state.lives = LIFE_MAX;
      state.lastLifeAt = Date.now();
      state.streak = 0;
      state.hammers = 2;
    }, "Resetting gameplay state…");
  }

  open.addEventListener("click", () => {
    clearConfirmations();
    refreshSummary();
    if (!dialog.open) dialog.showModal();
    command.focus();
  });
  dialog.addEventListener("close", clearConfirmations);
  dialog.querySelector("[data-admin-run]").addEventListener("click", runCommand);
  resetIou.addEventListener("click", resetIouLedger);
  resetGame.addEventListener("click", resetGameplayState);

  command.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand();
    }
  });

  dialog.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => jump(Number(button.dataset.level)));
  });

  dialog.querySelectorAll("[data-lives]").forEach((button) => {
    button.addEventListener("click", () => {
      const lives = Math.min(LIFE_MAX, Math.max(0, Number(button.dataset.lives) || 0));
      mutateState((state) => {
        state.lives = lives;
        state.lastLifeAt = Date.now();
      }, `Setting lives to ${lives}…`);
    });
  });

  dialog.querySelectorAll("[data-life-delta]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.lifeDelta) || 0;
      mutateState((state) => {
        state.lives = Math.min(LIFE_MAX, Math.max(0, state.lives + delta));
        state.lastLifeAt = Date.now();
      }, `${delta < 0 ? "Removing" : "Adding"} a life…`);
    });
  });

  dialog.querySelectorAll("[data-hammers]").forEach((button) => {
    button.addEventListener("click", () => {
      const hammers = Math.max(0, Number(button.dataset.hammers) || 0);
      mutateState((state) => { state.hammers = hammers; }, `Setting hammers to ${hammers}…`);
    });
  });

  dialog.querySelectorAll("[data-hammer-delta]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.hammerDelta) || 0;
      mutateState((state) => { state.hammers = Math.max(0, state.hammers + delta); }, `Adding ${delta} hammers…`);
    });
  });

  dialog.querySelector("[data-reset-streak]").addEventListener("click", () => {
    mutateState((state) => { state.streak = 0; }, "Resetting streak…");
  });

  refreshSummary();
}

async function bootAdmin() {
  try {
    const response = await fetch("/api/session", { credentials: "same-origin" });
    if (!response.ok) return;
    const identity = await response.json();
    if (!identity?.admin) return;
    installConsole(identity);
  } catch {
    // Admin tools are optional and must never interfere with gameplay.
  }
}

bootAdmin();
