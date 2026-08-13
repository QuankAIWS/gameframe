import { createLocalBoardMatch } from "./board-local-match.js";
import { renderLocalTicBoard } from "./local-tic-board.js";
import { createLocalCheckersBoardRenderer } from "./local-checkers-board.js";

export function createLocalBoardSession(gameId) {
  const lobby = document.querySelector("#lobby");
  const matchPanel = document.querySelector("#match-panel");
  const board = document.querySelector("#board");
  const help = document.querySelector("#board-help");
  const status = document.querySelector("#status");
  const revision = document.querySelector("#revision");
  const matchLabel = document.querySelector("#match-label");
  const matchTitle = document.querySelector("#match-title");
  const matchGame = document.querySelector("#match-game");
  const matchId = document.querySelector("#match-id");
  const connection = document.querySelector("#connection");
  const details = document.querySelector("#details");
  const invitePanel = document.querySelector("#invite-panel");
  const cards = [document.querySelector("#player-x"), document.querySelector("#player-o")];
  const names = [document.querySelector("#player-x-name"), document.querySelector("#player-o-name")];
  const seats = [document.querySelector("#player-x-seat"), document.querySelector("#player-o-seat")];
  const badges = [document.querySelector("#player-x-badge"), document.querySelector("#player-o-badge")];
  const title = gameId === "american-checkers" ? "Clockwork Checkers" : "Tic-Tac-Toe";
  let controller = null;
  let current = null;

  const checkersRenderer = gameId === "american-checkers"
    ? createLocalCheckersBoardRenderer({ board, help, onMove: submit })
    : null;

  function showSurface() {
    if (lobby) lobby.hidden = true;
    if (matchPanel) matchPanel.hidden = false;
  }

  function outcomeText(view) {
    const outcome = view.observation.status;
    if (outcome.draw) return "Draw. The board is locked.";
    if (outcome.winnerPlayerId) {
      if (gameId === "american-checkers") return outcome.winnerPlayerId.endsWith(":black") ? "Black wins. Match complete." : "Red wins. Match complete.";
      return outcome.winnerPlayerId.endsWith(":x") ? "X wins. Match complete." : "O wins. Match complete.";
    }
    if (gameId === "american-checkers") {
      const color = view.observation.activePlayerId?.endsWith(":red") ? "Red" : "Black";
      return `${color} to move.${view.observation.mustCapture ? " Capture required." : ""}`;
    }
    return view.observation.nextPlayerId?.endsWith(":o") ? "O to move." : "X to move.";
  }

  function renderPlayers(view) {
    const checkers = gameId === "american-checkers";
    names[0].textContent = checkers ? "Black" : "Player X";
    names[1].textContent = checkers ? "Red" : "Player O";
    seats[0].textContent = checkers ? "Local seat · Black" : "Local seat · X";
    seats[1].textContent = checkers ? "Local seat · Red" : "Local seat · O";
    badges[0].textContent = checkers ? "B" : "X";
    badges[1].textContent = checkers ? "R" : "O";
    badges[0].className = `mark-badge ${checkers ? "black" : "x"}`;
    badges[1].className = `mark-badge ${checkers ? "red" : "o"}`;
    const active = checkers ? view.observation.activePlayerId : view.observation.nextPlayerId;
    cards[0].classList.toggle("is-active", active === view.playerIds[0]);
    cards[1].classList.toggle("is-active", active === view.playerIds[1]);
    cards[0].classList.remove("is-you");
    cards[1].classList.remove("is-you");
  }

  function render(view) {
    current = view;
    showSurface();
    document.body.classList.add("board-game-local");
    if (invitePanel) invitePanel.hidden = true;
    matchLabel.textContent = gameId === "american-checkers" ? "LOCAL CHECKERS" : "LOCAL MATCH";
    matchTitle.textContent = `${title} · Pass & play`;
    status.textContent = outcomeText(view);
    revision.textContent = `Local ${view.revision}`;
    matchGame.textContent = title;
    matchId.textContent = "On this device";
    connection.textContent = "Local";
    renderPlayers(view);
    if (checkersRenderer) checkersRenderer.render(view);
    else renderLocalTicBoard({ board, help, view, onMove: submit });
    details.textContent = JSON.stringify({
      gameId,
      mode: "local-pass-and-play",
      revision: view.revision,
      legalActionCount: view.observation.legalActions.length,
    }, null, 2);
  }

  function submit(action) {
    if (!controller) return;
    checkersRenderer?.reset();
    render(controller.submit(action));
  }

  function start() {
    controller = createLocalBoardMatch(gameId);
    checkersRenderer?.reset();
    render(controller.view());
  }

  function reset() {
    controller = null;
    current = null;
    checkersRenderer?.reset();
    document.body.classList.remove("board-game-local");
  }

  return Object.freeze({ start, reset, active: () => Boolean(controller), showSurface, view: () => current });
}
