const stylesheetUrls = ["/game-hub.css", "/game-hub-shell.css", "/game-hub-cards.css", "/game-hub-flow.css"];
for (const stylesheetUrl of stylesheetUrls) {
  if (document.querySelector(`link[href="${stylesheetUrl}"]`)) continue;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

document.body.classList.add("gameframe-game-hub");

const hero = document.querySelector(".hero");
const gameGrid = document.querySelector(".game-grid");
const modeGrid = document.querySelector(".mode-grid");
const lobby = document.querySelector("#lobby");
const lobbyMessage = document.querySelector("#lobby-message");
const sectionLabel = document.querySelector("#lobby .section-label");
const lobbyTitle = document.querySelector("#lobby-title");
const tacticalLink = document.querySelector("#open-tactical-canary");
const parameters = new URLSearchParams(window.location.search);
const requestedGame = parameters.get("game");
const requestedMenuGame = requestedGame || "tic-tac-toe";
const menuGame = parameters.get("menu") === "1"
  && (requestedMenuGame === "tic-tac-toe" || requestedMenuGame === "american-checkers")
  ? requestedMenuGame
  : null;

const games = [
  {
    id: "monster-master",
    href: "/monster-master.html",
    kicker: "TACTICAL DUEL",
    title: "Monster Master",
    description: "Command a hand-illustrated creature squad through an initiative-driven battle.",
    accent: "monster",
  },
  {
    id: "othello",
    href: "/othello.html",
    kicker: "STRATEGY",
    title: "Othello",
    description: "Control the board across three complete visual themes.",
    accent: "othello",
  },
  {
    id: "american-checkers",
    href: "/?game=american-checkers&menu=1",
    kicker: "CLOCKWORK ECLIPSE",
    title: "Clockwork Checkers",
    description: "Mandatory captures, multi-jumps, kings, and a complete match flow.",
    accent: "checkers",
  },
  {
    id: "tic-tac-toe",
    href: "/?game=tic-tac-toe&menu=1",
    kicker: "QUICK MATCH",
    title: "Tic-Tac-Toe",
    description: "A fast duel against Theo or another player.",
    accent: "tic",
  },
];

function artwork(accent) {
  if (accent === "monster") {
    return `
      <span class="game-card-visual game-card-visual-monster" aria-hidden="true">
        <span class="game-card-atmosphere"></span>
        <span class="game-card-monster-creature"></span>
        <span class="game-card-visual-mark">MM</span>
      </span>
    `;
  }
  if (accent === "othello") {
    return `
      <span class="game-card-visual game-card-visual-othello" aria-hidden="true">
        <span class="hub-board-grid"></span>
        <i class="hub-disc hub-disc-dark hub-disc-a"></i>
        <i class="hub-disc hub-disc-light hub-disc-b"></i>
        <i class="hub-disc hub-disc-light hub-disc-c"></i>
        <i class="hub-disc hub-disc-dark hub-disc-d"></i>
        <i class="hub-disc hub-disc-light hub-disc-e"></i>
      </span>
    `;
  }
  if (accent === "checkers") {
    return `
      <span class="game-card-visual game-card-visual-checkers" aria-hidden="true">
        <span class="hub-board-grid"></span>
        <i class="hub-checker hub-checker-lunar hub-checker-a"></i>
        <i class="hub-checker hub-checker-solar hub-checker-b"></i>
        <i class="hub-checker hub-checker-lunar hub-checker-c"></i>
        <i class="hub-checker hub-checker-solar hub-checker-d"></i>
        <i class="hub-checker hub-checker-lunar hub-checker-e"></i>
      </span>
    `;
  }
  return `
    <span class="game-card-visual game-card-visual-tic" aria-hidden="true">
      <span class="hub-tic-grid"></span>
      <i class="hub-tic-mark hub-tic-x hub-tic-a"></i>
      <i class="hub-tic-mark hub-tic-o hub-tic-b"></i>
      <i class="hub-tic-mark hub-tic-x hub-tic-c"></i>
      <i class="hub-tic-mark hub-tic-o hub-tic-d"></i>
    </span>
  `;
}

function createLibraryCard(game) {
  const card = document.createElement("a");
  card.id = `game-card-${game.id}`;
  card.className = `game-card game-hub-${game.accent}`;
  card.href = game.href;
  card.setAttribute("aria-label", `Open the ${game.title} game menu`);
  card.innerHTML = `
    ${artwork(game.accent)}
    <span class="game-card-body">
      <small class="game-card-kicker">${game.kicker}</small>
      <strong>${game.title}</strong>
      <small class="game-card-description">${game.description}</small>
    </span>
    <span class="game-card-footer">
      <span class="game-card-play">Play now</span>
      <span class="game-card-arrow" aria-hidden="true">›</span>
    </span>
  `;
  return card;
}

function installGameMenu() {
  if (!menuGame || !lobby || !modeGrid) return;
  const selected = games.find((game) => game.id === menuGame);
  if (!selected) return;

  document.body.classList.add("gameframe-game-menu");
  document.body.dataset.gameframeMenuGame = selected.accent;
  gameGrid.hidden = true;
  modeGrid.hidden = false;
  tacticalLink?.remove();

  let menu = lobby.querySelector(".game-menu-hero");
  if (!menu) {
    menu = document.createElement("section");
    menu.className = `game-menu-hero game-menu-${selected.accent}`;
    menu.innerHTML = `
      <a class="game-menu-back" href="/">← Back to library</a>
      <div class="game-menu-art">${artwork(selected.accent)}</div>
      <div class="game-menu-copy">
        <small>${selected.kicker}</small>
        <h2>${selected.title}</h2>
        <p>${selected.description}</p>
      </div>
    `;
    modeGrid.before(menu);
  }

  if (sectionLabel) sectionLabel.textContent = "GAME MENU";
  if (lobbyTitle) lobbyTitle.textContent = "Choose how to play";
  if (lobbyMessage) lobbyMessage.textContent = "Start a match with Theo or invite another player.";
}

function installLibrary() {
  if (!gameGrid) return;
  tacticalLink?.remove();
  gameGrid.replaceChildren(...games.map(createLibraryCard));
  gameGrid.hidden = false;
  if (modeGrid) modeGrid.hidden = true;
  if (sectionLabel) sectionLabel.textContent = "GAME LIBRARY";
  if (lobbyTitle) lobbyTitle.textContent = "Choose your game";
  if (lobbyMessage) lobbyMessage.textContent = "Select a game to open its menu.";
}

hero?.querySelector(".game-hub-topbar")?.remove();
if (menuGame) installGameMenu();
else installLibrary();

let syncPending = false;
function syncHubState() {
  syncPending = false;
  const lobbyVisible = Boolean(lobby && !lobby.hidden);
  document.body.classList.toggle("gameframe-game-hub-lobby", lobbyVisible);
  document.body.classList.toggle("gameframe-game-menu", lobbyVisible && Boolean(menuGame));
  if (lobbyVisible && menuGame) document.body.dataset.gameframeMenuGame = games.find((game) => game.id === menuGame)?.accent || "hub";
  else delete document.body.dataset.gameframeMenuGame;
  if (lobbyVisible) {
    const expectedMessage = menuGame
      ? "Start a match with Theo or invite another player."
      : "Select a game to open its menu.";
    if (lobbyMessage && lobbyMessage.textContent !== expectedMessage) lobbyMessage.textContent = expectedMessage;
    document.title = menuGame
      ? `${games.find((game) => game.id === menuGame)?.title || "Game"} · Scribbles GameFrame`
      : "Scribbles GameFrame";
  }
  window.gameFrameDestinationBar?.sync?.();
}
function scheduleHubState() {
  if (syncPending) return;
  syncPending = true;
  requestAnimationFrame(syncHubState);
}

const observer = new MutationObserver(scheduleHubState);
if (lobby) observer.observe(lobby, { attributes: true, attributeFilter: ["hidden"] });
if (lobbyMessage) observer.observe(lobbyMessage, { childList: true, characterData: true, subtree: true });
syncHubState();
