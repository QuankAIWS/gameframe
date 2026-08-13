await import("./board-surface-init.js");

const stylesheetUrls = ["/tic-tac-toe-noir.css", "/tic-tac-toe-universal.css"];
for (const stylesheetUrl of stylesheetUrls) {
  if (document.querySelector(`link[href="${stylesheetUrl}"]`)) continue;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const hero = document.querySelector(".hero");
const lobby = document.querySelector("#lobby");
const matchPanel = document.querySelector("#match-panel");
const matchTitle = document.querySelector("#match-title");
const matchLabel = document.querySelector("#match-label");
const board = document.querySelector("#board");
const boardWrap = board?.closest(".board-wrap");
const boardHelp = document.querySelector("#board-help");
const status = document.querySelector("#status");
const revision = document.querySelector("#revision");
const connection = document.querySelector("#connection");
const matchId = document.querySelector("#match-id");
const invitePanel = document.querySelector("#invite-panel");
const copyInvite = document.querySelector("#copy-invite");
const newMatch = document.querySelector("#new-match");
const matchActions = newMatch?.closest(".actions");
const players = matchPanel?.querySelector(".players");
const playerO = document.querySelector("#player-o");
const gameLayout = matchPanel?.querySelector(".game-layout");

let syncPending = false;
let presentationInstalled = false;

function isTicTacToeMatch() {
  return Boolean(matchPanel && !matchPanel.hidden && board?.classList.contains("board-tic-tac-toe"));
}

function installTopbar() {
  if (!matchPanel || document.querySelector("#gameframe-destination-bar")) {
    matchPanel?.querySelector(".tic-noir-topbar")?.remove();
    return;
  }
  if (matchPanel.querySelector(".tic-noir-topbar")) return;
  const topbar = document.createElement("header");
  topbar.className = "tic-noir-topbar";
  topbar.innerHTML = `
    <a class="tic-noir-brand" href="/" aria-label="Back to the GameFrame game library">
      <span class="tic-noir-brand-mark" aria-hidden="true">S</span>
      <span><small>SCRIBBLES GAMEFRAME</small><strong>TIC-TAC-TOE</strong></span>
    </a>
    <nav class="tic-noir-nav" aria-label="Tic-Tac-Toe navigation">
      <a href="/">Games</a>
      <button class="tic-noir-setup-top" type="button">Game menu</button>
    </nav>
    <span class="tic-noir-discord-safe" aria-hidden="true"></span>
  `;
  matchPanel.prepend(topbar);
  topbar.querySelector(".tic-noir-setup-top")?.addEventListener("click", () => newMatch?.click());
}

function installAmbientCircuits() {
  if (!matchPanel || matchPanel.querySelector(".tic-noir-ambient")) return;
  for (const side of ["left", "right"]) {
    const ambient = document.createElement("div");
    ambient.className = `tic-noir-ambient tic-noir-ambient-${side}`;
    ambient.setAttribute("aria-hidden", "true");
    ambient.innerHTML = "<i></i><i></i><i></i>";
    matchPanel.append(ambient);
  }
}

function installBoardFrame() {
  if (!boardWrap || !board || boardWrap.querySelector(".tic-noir-board-frame")) return;
  const kicker = document.createElement("div");
  kicker.className = "tic-noir-board-kicker";
  kicker.innerHTML = '<span>LIVE MATCH</span><i></i><small id="tic-noir-board-revision">REV —</small>';

  const frame = document.createElement("div");
  frame.className = "tic-noir-board-frame";
  frame.innerHTML = `
    <span class="tic-noir-corner tic-noir-corner-tl" aria-hidden="true"></span>
    <span class="tic-noir-corner tic-noir-corner-tr" aria-hidden="true"></span>
    <span class="tic-noir-corner tic-noir-corner-bl" aria-hidden="true"></span>
    <span class="tic-noir-corner tic-noir-corner-br" aria-hidden="true"></span>
  `;
  board.before(kicker, frame);
  frame.append(board);
  boardHelp?.classList.add("tic-noir-board-status");
}

function installPlayerTelemetry() {
  if (!players || players.querySelector(".tic-noir-turn-signal")) return;
  const signal = document.createElement("section");
  signal.className = "tic-noir-turn-signal";
  signal.innerHTML = `
    <small>TURN SIGNAL</small>
    <strong id="tic-noir-turn-copy">Awaiting match state</strong>
    <span>Choose an open cell</span>
  `;
  players.append(signal);
}

function installControlRail() {
  if (!gameLayout || gameLayout.querySelector(".tic-noir-control-rail")) return;
  const rail = document.createElement("aside");
  rail.className = "tic-noir-control-rail";
  rail.setAttribute("aria-label", "Match connection and invite controls");
  rail.innerHTML = `
    <section class="tic-noir-system-card">
      <small>SYSTEM</small>
      <dl>
        <div><dt>Updates</dt><dd id="tic-noir-connection">—</dd></div>
        <div><dt>Revision</dt><dd id="tic-noir-revision">—</dd></div>
        <div><dt>Match</dt><dd id="tic-noir-match-id">—</dd></div>
      </dl>
    </section>
    <button id="tic-noir-invite" type="button">Copy player invite</button>
  `;
  gameLayout.append(rail);
  if (playerO) rail.prepend(playerO);
  rail.querySelector("#tic-noir-invite")?.addEventListener("click", () => copyInvite?.click());
}

function installFooter() {
  if (!matchPanel || matchPanel.querySelector(".tic-noir-footer")) return;
  const footer = document.createElement("footer");
  footer.className = "tic-noir-footer";
  footer.innerHTML = `
    <a href="/">Back to games</a>
    <span aria-hidden="true"></span>
  `;
  if (newMatch) {
    newMatch.textContent = "Game menu";
    footer.append(newMatch);
  }
  matchPanel.append(footer);
}

function installPresentation() {
  if (presentationInstalled) return;
  installTopbar();
  installAmbientCircuits();
  installBoardFrame();
  installPlayerTelemetry();
  installControlRail();
  installFooter();
  presentationInstalled = true;
}

function uninstallPresentation() {
  if (!presentationInstalled && !matchPanel?.querySelector(".tic-noir-board-frame, .tic-noir-control-rail, .tic-noir-footer")) return;

  matchPanel?.querySelector(".tic-noir-topbar")?.remove();
  matchPanel?.querySelectorAll(".tic-noir-ambient").forEach((node) => node.remove());
  if (newMatch && matchActions && matchPanel?.querySelector(".tic-noir-footer")?.contains(newMatch)) {
    matchActions.append(newMatch);
  }
  matchPanel?.querySelector(".tic-noir-footer")?.remove();
  players?.querySelector(".tic-noir-turn-signal")?.remove();

  const rail = gameLayout?.querySelector(".tic-noir-control-rail");
  if (playerO && players && rail?.contains(playerO)) {
    const matchMeta = players.querySelector(".match-meta");
    players.insertBefore(playerO, matchMeta);
  }
  rail?.remove();

  const frame = boardWrap?.querySelector(".tic-noir-board-frame");
  if (frame && board) frame.replaceWith(board);
  boardWrap?.querySelector(".tic-noir-board-kicker")?.remove();
  boardHelp?.classList.remove("tic-noir-board-status");
  presentationInstalled = false;
}

function mirrorState() {
  const statusText = status?.textContent?.trim() || "Awaiting match state";
  const revisionText = revision?.textContent?.replace(/^Revision\s*/i, "") || "—";
  const connectionText = connection?.textContent?.trim() || "—";
  const matchText = matchId?.textContent?.trim() || "—";
  const turnCopy = document.querySelector("#tic-noir-turn-copy");
  const boardRevision = document.querySelector("#tic-noir-board-revision");
  const revisionCopy = document.querySelector("#tic-noir-revision");
  const connectionCopy = document.querySelector("#tic-noir-connection");
  const matchCopy = document.querySelector("#tic-noir-match-id");
  const invite = document.querySelector("#tic-noir-invite");

  if (turnCopy) turnCopy.textContent = statusText;
  if (boardRevision) boardRevision.textContent = `REV ${revisionText}`;
  if (revisionCopy) revisionCopy.textContent = revisionText;
  if (connectionCopy) connectionCopy.textContent = connectionText;
  if (matchCopy) matchCopy.textContent = matchText;
  if (boardHelp) {
    boardHelp.innerHTML = `<span class="tic-noir-status-dot" aria-hidden="true"></span><strong>${statusText}</strong><span>${connectionText}</span>`;
  }
  if (invite) {
    const available = Boolean(invitePanel && !invitePanel.hidden && copyInvite && !copyInvite.disabled);
    invite.disabled = !available;
    invite.hidden = !available;
  }
}

function syncPresentation() {
  syncPending = false;
  const active = isTicTacToeMatch();
  const local = document.body.classList.contains("board-game-local");
  const boardRoute = document.body.classList.contains("board-game-route");
  document.body.classList.toggle("tic-tac-toe-noir-running", active);
  if (hero) hero.setAttribute("aria-hidden", String(active));

  if (!active) {
    uninstallPresentation();
    return;
  }

  installPresentation();
  if (!local) {
    if (matchLabel) matchLabel.textContent = "LIVE MATCH";
    if (matchTitle) matchTitle.textContent = "Tic-Tac-Toe";
  }
  if (newMatch) newMatch.textContent = boardRoute ? "Game menu" : "Match setup";
  mirrorState();
}

function scheduleSync() {
  if (syncPending) return;
  syncPending = true;
  requestAnimationFrame(syncPresentation);
}

const observer = new MutationObserver(scheduleSync);
for (const node of [lobby, matchPanel, board, status, revision, connection, matchId, invitePanel].filter(Boolean)) {
  observer.observe(node, {
    attributes: true,
    attributeFilter: ["hidden", "class", "disabled"],
    childList: true,
    subtree: true,
    characterData: true,
  });
}

window.gameFrameTicTacToeNoir = Object.freeze({
  sync: syncPresentation,
  isActive: isTicTacToeMatch,
  uninstall: uninstallPresentation,
});
syncPresentation();