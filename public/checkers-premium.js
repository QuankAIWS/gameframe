const premiumStylesheetHref = "/checkers-premium.css";
if (!document.querySelector(`link[href="${premiumStylesheetHref}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = premiumStylesheetHref;
  document.head.append(stylesheet);
}

const board = document.querySelector("#board");
const boardWrap = board?.closest(".board-wrap");
const matchPanel = document.querySelector("#match-panel");
const gameLayout = matchPanel?.querySelector(".game-layout");
const status = document.querySelector("#status");
const revision = document.querySelector("#revision");
const details = document.querySelector("#details");
const blackPlayerCard = document.querySelector("#player-x");
const redPlayerCard = document.querySelector("#player-o");
const newMatch = document.querySelector("#new-match");
const challengeBot = document.querySelector("#challenge-bot");
const createHumanMatch = document.querySelector("#create-human-match");

let updateScheduled = false;

function readDiagnostics() {
  try {
    return JSON.parse(details?.textContent || "{}");
  } catch {
    return {};
  }
}

function isCheckersBoard() {
  return Boolean(board?.classList.contains("board-checkers"));
}

function ensureBoardShell() {
  if (!boardWrap || !board) return null;
  let shell = boardWrap.querySelector(".checkers-board-shell");
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "checkers-board-shell";
    boardWrap.insertBefore(shell, board);
    shell.append(board);
  }

  let heading = boardWrap.querySelector(".checkers-board-heading");
  if (!heading) {
    heading = document.createElement("div");
    heading.className = "checkers-board-heading";
    heading.innerHTML = `
      <h3 class="checkers-board-title">American Checkers</h3>
      <span id="checkers-board-state" class="checkers-board-state">Authoritative match</span>
    `;
    boardWrap.insertBefore(heading, shell);
  }
  return shell;
}

function removeBoardShell() {
  if (!boardWrap || !board) return;
  const shell = boardWrap.querySelector(".checkers-board-shell");
  if (shell) {
    boardWrap.insertBefore(board, shell);
    shell.remove();
  }
  boardWrap.querySelector(".checkers-board-heading")?.remove();
}

function ensureCapturedSummary(card, capturedColor) {
  if (!card) return null;
  let summary = card.querySelector(".checkers-captured-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "checkers-captured-summary";
    summary.innerHTML = `
      <span class="checkers-captured-label">Captured</span>
      <span class="checkers-captured-pieces" aria-hidden="true"></span>
      <strong class="checkers-captured-count">0</strong>
    `;
    card.append(summary);
  }
  summary.dataset.color = capturedColor;
  return summary;
}

function renderCapturedSummary(card, capturedColor, count) {
  const summary = ensureCapturedSummary(card, capturedColor);
  if (!summary) return;
  const pieces = summary.querySelector(".checkers-captured-pieces");
  const countLabel = summary.querySelector(".checkers-captured-count");
  pieces.replaceChildren();
  const visible = Math.min(count, 5);
  for (let index = 0; index < visible; index += 1) {
    const token = document.createElement("span");
    token.className = `checkers-captured-token checkers-captured-token-${capturedColor}`;
    pieces.append(token);
  }
  if (count > visible) {
    const overflow = document.createElement("span");
    overflow.className = "checkers-captured-overflow";
    overflow.textContent = `+${count - visible}`;
    pieces.append(overflow);
  }
  countLabel.textContent = String(count);
  summary.setAttribute("aria-label", `${count} ${capturedColor} pieces captured`);
}

function ensureIntelRail() {
  if (!gameLayout) return null;
  let rail = gameLayout.querySelector("#checkers-intel-rail");
  if (rail) return rail;
  rail = document.createElement("aside");
  rail.id = "checkers-intel-rail";
  rail.className = "checkers-intel-rail";
  rail.setAttribute("aria-label", "Checkers match information");
  rail.innerHTML = `
    <section class="checkers-intel-card checkers-intel-identity">
      <p class="checkers-intel-kicker">STANDARD MATCH</p>
      <h3>Table status</h3>
      <p id="checkers-turn-copy" class="checkers-turn-copy">Preparing the board…</p>
    </section>
    <section class="checkers-intel-card checkers-count-grid" aria-label="Pieces remaining">
      <div><span class="checkers-count-dot black"></span><small>Black</small><strong id="checkers-black-count">12</strong><em id="checkers-black-kings">0 kings</em></div>
      <div><span class="checkers-count-dot red"></span><small>Red</small><strong id="checkers-red-count">12</strong><em id="checkers-red-kings">0 kings</em></div>
    </section>
    <section class="checkers-intel-card checkers-move-card">
      <span>Available choices</span>
      <strong id="checkers-legal-count">0</strong>
      <small>Selectable pieces and destinations update from the authoritative board.</small>
      <span class="checkers-route-swatch" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    </section>
    <section class="checkers-intel-card checkers-revision-card">
      <span>Live revision</span>
      <strong id="checkers-live-revision">—</strong>
      <small>No alternate action path is introduced by this presentation layer.</small>
    </section>
  `;
  gameLayout.append(rail);
  return rail;
}

function ensureOutcomeOverlay() {
  if (!boardWrap) return null;
  let overlay = boardWrap.querySelector("#checkers-outcome-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("section");
  overlay.id = "checkers-outcome-overlay";
  overlay.className = "checkers-outcome-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-labelledby", "checkers-outcome-title");
  overlay.innerHTML = `
    <div class="checkers-outcome-card">
      <p class="checkers-outcome-kicker">MATCH COMPLETE</p>
      <h3 id="checkers-outcome-title">Game over</h3>
      <p id="checkers-outcome-copy">The final move is recorded.</p>
      <div class="checkers-outcome-actions">
        <button id="checkers-outcome-rematch" type="button">Rematch</button>
        <button id="checkers-outcome-setup" class="secondary-button" type="button">Match setup</button>
      </div>
    </div>
  `;
  boardWrap.append(overlay);
  overlay.querySelector("#checkers-outcome-setup")?.addEventListener("click", () => newMatch?.click());
  overlay.querySelector("#checkers-outcome-rematch")?.addEventListener("click", () => {
    const diagnostics = readDiagnostics();
    const versusBot = diagnostics.playerIds?.includes("gameframe-bot")
      || document.querySelector("#player-o-name")?.textContent === "GameFrameBot";
    newMatch?.click();
    requestAnimationFrame(() => {
      if (versusBot) challengeBot?.click();
      else createHumanMatch?.click();
    });
  });
  return overlay;
}

function updateOutcomeOverlay() {
  const overlay = ensureOutcomeOverlay();
  if (!overlay) return;
  const message = status?.textContent?.trim() ?? "";
  const terminal = /match complete|draw\. the board is locked/i.test(message);
  if (!terminal) {
    overlay.hidden = true;
    return;
  }
  const title = overlay.querySelector("#checkers-outcome-title");
  const copy = overlay.querySelector("#checkers-outcome-copy");
  if (/^you won/i.test(message)) {
    title.textContent = "You won";
    copy.textContent = "The final capture is recorded. Start another match from the same seat.";
  } else if (/^draw/i.test(message)) {
    title.textContent = "Draw game";
    copy.textContent = "Neither side can advance. The complete position remains in the replay.";
  } else {
    const winner = message.match(/^(.+?) won/i)?.[1] ?? "Opponent";
    title.textContent = `${winner} wins`;
    copy.textContent = "The match is complete. Rematch immediately or return to setup.";
  }
  overlay.hidden = false;
}

function updateCheckersPresentation() {
  updateScheduled = false;
  const active = isCheckersBoard();
  document.body.classList.toggle("checkers-premium-active", active);
  matchPanel?.classList.toggle("checkers-premium-match", active);

  if (!active) {
    removeBoardShell();
    gameLayout?.querySelector("#checkers-intel-rail")?.setAttribute("hidden", "");
    blackPlayerCard?.querySelector(".checkers-captured-summary")?.remove();
    redPlayerCard?.querySelector(".checkers-captured-summary")?.remove();
    boardWrap?.querySelector("#checkers-outcome-overlay")?.remove();
    return;
  }

  ensureBoardShell();
  const rail = ensureIntelRail();
  rail?.removeAttribute("hidden");

  const blackPieces = board.querySelectorAll(".piece-black").length;
  const redPieces = board.querySelectorAll(".piece-red").length;
  const blackKings = board.querySelectorAll(".piece-black.is-king").length;
  const redKings = board.querySelectorAll(".piece-red.is-king").length;
  const selectable = board.querySelectorAll(".selectable-piece").length;
  const destinations = board.querySelectorAll(".legal-destination").length;

  renderCapturedSummary(blackPlayerCard, "red", Math.max(0, 12 - redPieces));
  renderCapturedSummary(redPlayerCard, "black", Math.max(0, 12 - blackPieces));

  const statusCopy = status?.textContent?.trim() || "Authoritative match";
  const turnCopy = rail?.querySelector("#checkers-turn-copy");
  const boardState = boardWrap?.querySelector("#checkers-board-state");
  if (turnCopy) turnCopy.textContent = statusCopy;
  if (boardState) boardState.textContent = statusCopy;
  if (rail) {
    rail.querySelector("#checkers-black-count").textContent = String(blackPieces);
    rail.querySelector("#checkers-red-count").textContent = String(redPieces);
    rail.querySelector("#checkers-black-kings").textContent = `${blackKings} ${blackKings === 1 ? "king" : "kings"}`;
    rail.querySelector("#checkers-red-kings").textContent = `${redKings} ${redKings === 1 ? "king" : "kings"}`;
    rail.querySelector("#checkers-legal-count").textContent = String(destinations || selectable);
    rail.querySelector("#checkers-live-revision").textContent = revision?.textContent?.replace(/^Revision\s*/i, "") || "—";
    rail.classList.toggle("has-route", board.querySelectorAll(".selected-path").length > 0);
  }
  updateOutcomeOverlay();
}

function scheduleUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(updateCheckersPresentation);
}

if (board && matchPanel) {
  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-piece-id"] });
  if (status) observer.observe(status, { childList: true, characterData: true, subtree: true });
  if (revision) observer.observe(revision, { childList: true, characterData: true, subtree: true });
  scheduleUpdate();
}

window.gameFrameCheckersPremium = Object.freeze({
  update: updateCheckersPresentation,
  isActive: isCheckersBoard,
});