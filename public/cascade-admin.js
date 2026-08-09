import { LEVEL_COUNT } from "./cascade-engine.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";

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

function writeLevel(level) {
  let state = {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STATE_KEY) || "null");
    if (parsed && typeof parsed === "object") state = parsed;
  } catch {
    state = {};
  }
  state.level = level;
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
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
          <h2>Level jump</h2>
        </div>
        <button type="submit" value="close" aria-label="Close admin console">×</button>
      </header>
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
      <p class="cascade-admin-status" data-admin-status role="status">Signed in as ${identity.displayName || identity.playerId}.</p>
    </form>
  `;
  document.body.append(dialog);

  const command = dialog.querySelector("#cascade-admin-command");
  const status = dialog.querySelector("[data-admin-status]");

  function jump(level) {
    writeLevel(level);
    status.textContent = `Jumping to level ${level}…`;
    window.setTimeout(() => window.location.reload(), 80);
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

  open.addEventListener("click", () => {
    if (!dialog.open) dialog.showModal();
    command.focus();
  });
  dialog.querySelector("[data-admin-run]").addEventListener("click", runCommand);
  command.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand();
    }
  });
  dialog.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => jump(Number(button.dataset.level)));
  });
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
