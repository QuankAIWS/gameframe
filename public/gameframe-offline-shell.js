const stylesheetUrls = [
  "/game-hub.css",
  "/game-hub-shell.css",
  "/game-hub-cards.css",
  "/game-hub-flow.css",
  "/game-hub-rpg.css",
];
for (const stylesheetUrl of stylesheetUrls) {
  if (document.querySelector(`link[href="${stylesheetUrl}"]`)) continue;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

if (!document.querySelector("#gameframe-offline-shell-style")) {
  const style = document.createElement("style");
  style.id = "gameframe-offline-shell-style";
  style.textContent = `
    .gameframe-offline-shell .game-card.is-offline-unavailable {
      opacity: .58;
      filter: saturate(.58);
      cursor: not-allowed;
    }
    .gameframe-offline-shell .game-card.is-offline-unavailable .game-card-play {
      color: var(--muted, #93a0a9);
    }
    .gameframe-offline-shell .gameframe-offline-summary {
      margin: 0 0 18px;
      padding: 12px 14px;
      border: 1px solid rgba(182, 239, 105, .28);
      border-radius: 12px;
      background: rgba(8, 14, 17, .72);
      color: var(--muted, #b7c3ca);
      line-height: 1.45;
    }
    .gameframe-offline-shell .gameframe-offline-summary strong {
      color: #b6ef69;
    }
  `;
  document.head.append(style);
}

document.body.classList.add("gameframe-game-hub", "gameframe-offline-shell");
document.body.dataset.gameframeConnectivity = "offline";

const gameGrid = document.querySelector("#game-grid");
const modeGrid = document.querySelector(".mode-grid");
const lobby = document.querySelector("#lobby");
const lobbyMessage = document.querySelector("#lobby-message");
const sectionLabel = document.querySelector("#lobby .section-label");
const lobbyTitle = document.querySelector("#lobby-title");
const parameters = new URLSearchParams(window.location.search);
const catalogMode = parameters.get("catalog") === "1";

const games = [
  {
    id: "casual-games",
    href: "/casual-games.html",
    kicker: "OFFLINE READY",
    title: "Casual Games",
    description: "Open Cascade Crush and keep your local run moving without a connection.",
    accent: "casual",
    availableOffline: true,
  },
  {
    id: "othello",
    href: "/othello.html",
    kicker: "OFFLINE READY",
    title: "Othello",
    description: "Play OthelloBot or pass-and-play locally. Online challenges resume when GameFrame reconnects.",
    accent: "othello",
    availableOffline: true,
  },
  {
    id: "american-checkers",
    kicker: "ONLINE REQUIRED",
    title: "Clockwork Checkers",
    description: "Authoritative matches reconnect when GameFrame is back online.",
    accent: "checkers",
    availableOffline: false,
  },
  {
    id: "tic-tac-toe",
    kicker: "ONLINE REQUIRED",
    title: "Tic-Tac-Toe",
    description: "Shared and server-backed matches require a connection in this offline pack.",
    accent: "tic",
    availableOffline: false,
  },
  {
    id: "role-playing-games",
    kicker: "ONLINE REQUIRED",
    title: "Role-Playing Games",
    description: "Persistent campaigns are not part of the first GameFrame offline pack.",
    accent: "rpg",
    availableOffline: false,
  },
  {
    id: "battle-simulator",
    kicker: "ONLINE REQUIRED",
    title: "Battle Simulator",
    description: "Tactical and Monster Master content will be evaluated for a later offline pack.",
    accent: "simulator",
    availableOffline: false,
  },
];

function artwork(game) {
  if (game.accent === "casual") {
    return `
      <span class="game-card-visual" aria-hidden="true" style="background:radial-gradient(circle at 50% 38%,rgba(255,216,77,.2),transparent 34%),linear-gradient(145deg,#28162d,#0b1b24 74%);">
        <span style="position:absolute;inset:13%;display:grid;grid-template-columns:repeat(3,1fr);gap:7%;transform:rotate(-3deg);">
          <i style="border-radius:24%;background:#ff5ca8"></i><i style="border-radius:24%;background:#59e1ef"></i><i style="border-radius:24%;background:#ffd84d"></i>
          <i style="border-radius:24%;background:#83ef7b"></i><i style="border-radius:24%;background:#a982ff"></i><i style="border-radius:24%;background:#ff8b4d"></i>
          <i style="border-radius:24%;background:#ffd84d"></i><i style="border-radius:24%;background:#ff5ca8"></i><i style="border-radius:24%;background:#59e1ef"></i>
        </span>
        <span class="game-card-visual-mark" style="border-color:rgba(255,216,77,.6);color:#ffd84d;">FUN</span>
      </span>
    `;
  }
  if (game.accent === "othello") {
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
  if (game.accent === "checkers") {
    return `
      <span class="game-card-visual game-card-visual-checkers" aria-hidden="true">
        <span class="hub-board-grid"></span>
        <i class="hub-checker hub-checker-lunar hub-checker-a"></i>
        <i class="hub-checker hub-checker-solar hub-checker-b"></i>
        <i class="hub-checker hub-checker-lunar hub-checker-c"></i>
        <i class="hub-checker hub-checker-solar hub-checker-d"></i>
      </span>
    `;
  }
  if (game.accent === "tic") {
    return `
      <span class="game-card-visual game-card-visual-tic" aria-hidden="true">
        <span class="hub-tic-grid"></span>
        <i class="hub-tic-mark hub-tic-x hub-tic-a"></i>
        <i class="hub-tic-mark hub-tic-o hub-tic-b"></i>
        <i class="hub-tic-mark hub-tic-x hub-tic-c"></i>
      </span>
    `;
  }
  return `
    <span class="game-card-visual" aria-hidden="true">
      <span class="game-card-visual-mark">${game.accent === "rpg" ? "RPG" : "SIM"}</span>
    </span>
  `;
}

function createCard(game) {
  const card = document.createElement(game.availableOffline ? "a" : "article");
  card.id = `game-card-${game.id}`;
  card.className = `game-card game-hub-${game.accent}${game.availableOffline ? "" : " is-offline-unavailable"}`;
  if (game.availableOffline) {
    card.href = game.href;
    card.setAttribute("aria-label", `Open ${game.title}`);
  } else {
    card.setAttribute("aria-disabled", "true");
    card.setAttribute("aria-label", `${game.title} requires an internet connection`);
  }
  card.innerHTML = `
    ${artwork(game)}
    <span class="game-card-body">
      <small class="game-card-kicker">${game.kicker}</small>
      <strong>${game.title}</strong>
      <small class="game-card-description">${game.description}</small>
    </span>
    <span class="game-card-footer">
      <span class="game-card-play">${game.availableOffline ? "Open" : "Online required"}</span>
      <span class="game-card-arrow" aria-hidden="true">${game.availableOffline ? "›" : "—"}</span>
    </span>
  `;
  return card;
}

if (!gameGrid || !lobby) throw new Error("The offline GameFrame shell requires the normal GameFrame lobby markup.");

modeGrid?.setAttribute("hidden", "");
gameGrid.replaceChildren(...games.map(createCard));
gameGrid.hidden = false;

const summary = document.createElement("p");
summary.className = "gameframe-offline-summary";
summary.innerHTML = "<strong>Offline mode.</strong> The GameFrame shell, Cascade Crush, local Othello, and your last cached leaderboard remain available. Multiplayer, profiles, and persistent worlds reconnect when the internet returns.";
gameGrid.before(summary);

if (sectionLabel) sectionLabel.textContent = catalogMode ? "OFFLINE GAMES" : "OFFLINE HOME";
if (lobbyTitle) lobbyTitle.textContent = catalogMode ? "Games available on this device" : "GameFrame is ready offline";
if (lobbyMessage) lobbyMessage.textContent = "Choose an installed game or open the Leaderboard from the GameFrame bar.";
document.title = `${catalogMode ? "Games" : "Home"} · GameFrame Offline`;
window.gameFrameDestinationBar?.sync?.();
