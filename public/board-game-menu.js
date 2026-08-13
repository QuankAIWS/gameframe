import { createLocalBoardSession } from "./local-board-session.js";

const parameters = new URLSearchParams(window.location.search);
const gameId = parameters.get("game");
const supported = gameId === "tic-tac-toe" || gameId === "american-checkers";

if (supported) {
  const stylesheetHref = "/board-game-menu.css";
  if (!document.querySelector(`link[href="${stylesheetHref}"]`)) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = stylesheetHref;
    document.head.append(stylesheet);
  }

  const localSession = createLocalBoardSession(gameId);
  const lobby = document.querySelector("#lobby");
  const matchPanel = document.querySelector("#match-panel");
  const botButton = document.querySelector("#challenge-bot");
  const newMatch = document.querySelector("#new-match");
  const game = gameId === "american-checkers"
    ? {
        title: "Clockwork Checkers",
        kicker: "CLOCKWORK ECLIPSE",
        computer: "Play Black against GameFrame's deterministic CheckersBot.",
        local: "Two players share this board and alternate Black and Red turns.",
      }
    : {
        title: "Tic-Tac-Toe",
        kicker: "QUICK MATCH",
        computer: "Play X against the perfect deterministic GameFrameBot.",
        local: "Two players share this board and alternate X and O turns.",
      };

  document.body.classList.add("board-game-route");
  document.body.dataset.boardMenuGame = gameId;

  const menu = document.createElement("section");
  menu.id = "board-game-menu";
  menu.className = "board-game-menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-modal", "true");
  menu.setAttribute("aria-labelledby", "board-game-menu-title");
  menu.innerHTML = `
    <div class="board-game-menu-card">
      <p class="board-game-menu-kicker">${game.kicker}</p>
      <h2 id="board-game-menu-title">Start a game</h2>
      <p>Pick a table for ${game.title}. The board is already here behind this menu.</p>
      <div class="board-game-open-block">
        <strong>Your games</strong>
        <div class="board-game-open-list"><p>Persistent games and pending turns are available in Matches.</p></div>
        <a class="board-game-all-matches" href="/matches.html?game=${encodeURIComponent(gameId)}">View open matches</a>
      </div>
      <div class="board-game-menu-actions">
        <div data-board-player-slot></div>
        <button id="board-menu-computer" type="button">
          <strong>Play the computer</strong>
          <small>${game.computer}</small>
        </button>
        <button id="board-menu-local" type="button">
          <strong>Two players here</strong>
          <small>${game.local}</small>
        </button>
      </div>
      <a href="/?catalog=1">Back to Games</a>
    </div>
  `;
  document.body.append(menu);

  function showSurface() {
    if (lobby) lobby.hidden = true;
    if (matchPanel) matchPanel.hidden = false;
  }

  function close() {
    document.body.classList.remove("board-game-menu-open");
    menu.hidden = true;
  }

  function show() {
    showSurface();
    document.body.classList.add("board-game-menu-open");
    menu.hidden = false;
  }

  menu.querySelector("#board-menu-local")?.addEventListener("click", () => {
    localSession.start();
    close();
  });
  menu.querySelector("#board-menu-computer")?.addEventListener("click", () => {
    localSession.reset();
    close();
    botButton?.click();
  });

  document.addEventListener("click", (event) => {
    if (!localSession.active()) return;
    const target = event.target instanceof Element
      ? event.target.closest("#game-outcome-rematch, #checkers-outcome-rematch")
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    localSession.start();
    close();
  }, true);

  newMatch?.addEventListener("click", (event) => {
    if (localSession.active()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      localSession.reset();
      show();
      return;
    }
    requestAnimationFrame(show);
  }, true);
  if (newMatch) newMatch.textContent = "Game menu";

  showSurface();
  if (parameters.get("match")) close();
  else show();

  window.gameFrameBoardMenu = Object.freeze({ show, close, local: localSession });
}