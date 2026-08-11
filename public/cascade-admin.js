import { LEVEL_COUNT } from "./cascade-engine.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const FRESH_RUN_KEY = "scribbles-gameframe.cascade-fresh-run:v1";
const LIFE_MAX = 5;
const HAMMER_MAX = 6;

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
    hammers: Math.min(HAMMER_MAX, Math.max(0, Number(state.hammers) || 0)),
  };
}

function writeState(state) {
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function writeLevel(level) {
  const state = readState();
  state.level = level;
  writeState(state);
}

function stateSummary(state = readState()) {
  return `L${state.level} · ${state.lives}/${LIFE_MAX} lives · ${state.hammers}/${HAMMER_MAX} hammers · streak ${state.streak}`;
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
          <small>CASCADE CRUSH ADMIN</small>
          <h2>Playtest controls</h2>
        </div>
        <button type="submit" value="close" aria-label="Close admin console">×</button>
      </header>

      <p class="cascade-admin-state" data-admin-state></p>

      <section class="cascade-admin-section">
        <small>LEVEL JUMP</small>
        <p>Jump straight to teaching levels, objective milestones, or any level from 1 to ${LEVEL_COUNT}.</p>
        <label for="cascade-admin-command">Command</label>
        <div class="cascade-admin-command-row">
          <input id="cascade-admin-command" autocomplete="off" spellcheck="false" placeholder="go to level 61">
          <button type="button" data-admin-run>Run</button>
        </div>
        <div class="cascade-admin-jumps" aria-label="Quick level jumps">
          <button type="button" data-level="1">1</button>
          <button type="button" data-level="2">2</button>
          <button type="button" data-level="3">3</button>
          <button type="button" data-level="5">5</button>
          <button type="button" data-level="31">31</button>
          <button type="button" data-level="41">41</button>
          <button type="button" data-level="71">71</button>
          <button type="button" data-level="100">100</button>
        </div>
      </section>

      <section class="cascade-admin-section">
        <small>BONUS MODE</small>
        <p>Launch a Blitz immediately without changing campaign progress.</p>
        <div class="cascade-admin-control-grid">
          <button type="button" data-admin-blitz>Start 30-second Blitz</button>
        </div>
      </section>

      <section class="cascade-admin-section">
        <small>LIVES</small>
        <p>Force recharge and lockout states.</p>
        <div class="cascade-admin-control-grid cascade-admin-control-grid-four">
          <button type="button" data-life-delta="-1">−1 life</button>
          <button type="button" data-lives="0">0 lives</button>
          <button type="button" data-lives="1">1 life</button>
          <button type="button" data-lives="5">Full 5</button>
        </div>
      </section>

      <section class="cascade-admin-section">
        <small>HAMMERS / STREAK</small>
        <p>Set earned inventory edges quickly.</p>
        <div class="cascade-admin-control-grid">
          <button type="button" data-hammers="0">0 hammers</button>
          <button type="button" data-hammers="1">1 hammer</button>
          <button type="button" data-hammer-delta="3">+3 hammers</button>
          <button type="button" data-reset-streak>Reset streak</button>
        </div>
      </section>

      <section class="cascade-admin-section cascade-admin-reset-section">
        <small>TEST STATE</small>
        <p>Reset gameplay to level 1, 5 lives, 2 hammers, and streak 0.</p>
        <div class="cascade-admin-control-grid">
          <button type="button" class="cascade-admin-reset" data-admin-reset-game>Reset gameplay state</button>
        </div>
      </section>

      <p class="cascade-admin-status" data-admin-status role="status">Signed in as ${identity.displayName || identity.playerId}.</p>
    </form>
  `;
  document.body.append(dialog);

  const command = dialog.querySelector("#cascade-admin-command");
  const status = dialog.querySelector("[data-admin-status]");
  const stateLine = dialog.querySelector("[data-admin-state]");
  const resetGame = dialog.querySelector("[data-admin-reset-game]");
  let resetGameExpiresAt = 0;

  function refreshSummary() {
    stateLine.textContent = stateSummary();
  }

  function requestFreshRun() {
    window.localStorage.setItem(FRESH_RUN_KEY, "1");
    window.localStorage.removeItem(ACTIVE_RUN_KEY);
  }

  function reloadWithStatus(message, { freshRun = false } = {}) {
    if (freshRun) requestFreshRun();
    status.textContent = message;
    window.setTimeout(() => window.location.reload(), 100);
  }

  function mutateState(mutator, message, options = {}) {
    const state = readState();
    mutator(state);
    writeState(state);
    refreshSummary();
    reloadWithStatus(message, options);
  }

  function jump(level) {
    writeLevel(level);
    reloadWithStatus(`Jumping to level ${level}…`, { freshRun: true });
  }

  function runCommand() {
    const level = parseLevelCommand(command.value);
    if (!level) {
      status.textContent = `Use a level from 1 to ${LEVEL_COUNT}, like “go to level 61”.`;
      command.select();
      return;
    }
    jump(level);
  }

  function clearConfirmation() {
    resetGameExpiresAt = 0;
    resetGame.textContent = "Reset gameplay state";
  }

  function resetGameplayState() {
    const now = Date.now();
    if (now > resetGameExpiresAt) {
      clearConfirmation();
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
    }, "Resetting gameplay state…", { freshRun: true });
  }

  open.addEventListener("click", () => {
    clearConfirmation();
    refreshSummary();
    if (!dialog.open) dialog.showModal();
    command.focus();
  });
  dialog.addEventListener("close", clearConfirmation);
  dialog.querySelector("[data-admin-run]").addEventListener("click", runCommand);
  resetGame.addEventListener("click", resetGameplayState);
  dialog.querySelector("[data-admin-blitz]").addEventListener("click", () => {
    dialog.close();
    window.cascadeResearch?.startBlitz?.(5);
  });

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
      const hammers = Math.min(HAMMER_MAX, Math.max(0, Number(button.dataset.hammers) || 0));
      mutateState((state) => { state.hammers = hammers; }, `Setting hammers to ${hammers}…`);
    });
  });

  dialog.querySelectorAll("[data-hammer-delta]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.hammerDelta) || 0;
      mutateState((state) => { state.hammers = Math.min(HAMMER_MAX, Math.max(0, state.hammers + delta)); }, `Adding ${delta} hammers…`);
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
