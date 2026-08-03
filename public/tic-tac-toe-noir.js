const stylesheetUrl = "/tic-tac-toe-noir.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const hero = document.querySelector(".hero");
const lobby = document.querySelector("#lobby");
const matchPanel = document.querySelector("#match-panel");
const matchHeader = matchPanel?.querySelector(".match-header");
const matchTitle = document.querySelector("#match-title");
const matchLabel = document.querySelector("#match-label");
const board = document.querySelector("#board");
const boardHelp = document.querySelector("#board-help");
const status = document.querySelector("#status");
const revision = document.querySelector("#revision");
const connection = document.querySelector("#connection");
const invitePanel = document.querySelector("#invite-panel");
const copyInvite = document.querySelector("#copy-invite");
const newMatch = document.querySelector("#new-match");

let syncPending = false;

function isTicTacToeMatch() {
  return Boolean(matchPanel && !matchPanel.hidden && board?.classList.contains("board-tic-tac-toe"));
}

function installMatchTopbar() {
  if (!matchPanel || matchPanel.querySelector(".tic-noir-topbar")) return;
  const topbar = document.createElement("header");
  topbar.className = "tic-noir-topbar";
  topbar.innerHTML = `
    <a class="tic-noir-brand" href="/" aria-label="Back to the GameFrame game library">
      <span class="tic-noir-brand-mark" aria-hidden="true">S</span>
      <span>
        <small>SCRIBBLES GAMEFRAME</small>
        <strong>TIC-TAC-TOE</strong>
      </span>
    </a>
    <nav class="tic-noir-nav" aria-label="Tic-Tac-Toe navigation">
      <a href="/">Back to games</a>
      <button class="tic-noir-setup-top" type="button">Match setup</button>
    </nav>
    <span class="tic-noir-discord-safe" aria-hidden="true"></span>
  `;
  matchPanel.prepend(topbar);
  topbar.querySelector(".tic-noir-setup-top")?.addEventListener("click", () => newMatch?.click());
}

function installControlRail() {
  const gameLayout = matchPanel?.querySelector(".game-layout");
  if (!gameLayout || gameLayout.querySelector(".tic-noir-control-rail")) return;
  const rail = document.createElement("aside");
  rail.className = "tic-noir-control-rail";
  rail.setAttribute("aria-label", "Match controls and connection information");
  rail.innerHTML = `
    <section class="tic-noir-control-card tic-noir-turn-card">
      <small>TURN SIGNAL</small>
      <strong id="tic-noir-turn-copy">Awaiting match state</strong>
    </section>
    <section class="tic-noir-control-card">
      <small>SYSTEM</small>
      <dl class="tic-noir-system-list">
        <div><dt>Revision</dt><dd id="tic-noir-revision">—</dd></div>
        <div><dt>Updates</dt><dd id="tic-noir-connection">—</dd></div>
      </dl>
    </section>
    <section class="tic-noir-control-card tic-noir-rules">
      <small>OBJECTIVE</small>
      <p>Complete a line of three marks horizontally, vertically, or diagonally.</p>
    </section>
    <div class="tic-noir-actions">
      <button id="tic-noir-invite" type="button">Copy player invite</button>
      <button id="tic-noir-setup" type="button">Match setup</button>
      <a href="/">Back to games</a>
    </div>
  `;
  gameLayout.append(rail);
  rail.querySelector("#tic-noir-invite")?.addEventListener("click", () => copyInvite?.click());
  rail.querySelector("#tic-noir-setup")?.addEventListener("click", () => newMatch?.click());
}

function mirrorState() {
  const turnCopy = document.querySelector("#tic-noir-turn-copy");
  const revisionCopy = document.querySelector("#tic-noir-revision");
  const connectionCopy = document.querySelector("#tic-noir-connection");
  const invite = document.querySelector("#tic-noir-invite");
  if (turnCopy) turnCopy.textContent = status?.textContent?.trim() || "Awaiting match state";
  if (revisionCopy) revisionCopy.textContent = revision?.textContent?.replace(/^Revision\s*/i, "") || "—";
  if (connectionCopy) connectionCopy.textContent = connection?.textContent?.trim() || "—";
  if (invite) {
    const available = Boolean(invitePanel && !invitePanel.hidden && copyInvite && !copyInvite.disabled);
    invite.disabled = !available;
    invite.hidden = !available;
  }
}

function syncPresentation() {
  syncPending = false;
  installMatchTopbar();
  installControlRail();
  const active = isTicTacToeMatch();
  document.body.classList.toggle("tic-tac-toe-noir-running", active);
  if (hero) hero.setAttribute("aria-hidden", String(active));
  if (!active) return;
  if (matchLabel) matchLabel.textContent = "LIVE MATCH";
  if (matchTitle) matchTitle.textContent = "Tic-Tac-Toe";
  if (newMatch) newMatch.textContent = "Match setup";
  if (boardHelp && !boardHelp.textContent?.trim()) boardHelp.textContent = "Choose an open cell.";
  mirrorState();
}

function scheduleSync() {
  if (syncPending) return;
  syncPending = true;
  requestAnimationFrame(syncPresentation);
}

const observer = new MutationObserver(scheduleSync);
for (const node of [lobby, matchPanel, board, status, revision, connection, invitePanel].filter(Boolean)) {
  observer.observe(node, {
    attributes: true,
    attributeFilter: ["hidden", "class", "disabled"],
    childList: true,
    subtree: true,
    characterData: true,
  });
}

window.gameFrameTicTacToeNoir = Object.freeze({ sync: syncPresentation, isActive: isTicTacToeMatch });
syncPresentation();
