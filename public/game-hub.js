const stylesheetUrls = ["/game-hub.css", "/game-hub-shell.css", "/game-hub-cards.css"];
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
const gameTitle = document.querySelector("#game-title");
const heroCopy = document.querySelector("#hero-copy");
const eyebrow = document.querySelector(".hero .eyebrow");
const sectionLabel = document.querySelector("#lobby .section-label");
const lobbyTitle = document.querySelector("#lobby-title");
const tacticalLink = document.querySelector("#open-tactical-canary");
const ticTacToe = document.querySelector("#select-tic-tac-toe");
const checkers = document.querySelector("#select-checkers");
const identity = window.gameFrameIdentity;
const playerLabel = identity?.source === "discord"
  ? (identity.displayName || identity.playerId || "Scribbler")
  : "Scribbler";
const hubCopy = "Choose a game, pick an opponent, and start playing.";

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

function cardMarkup({ kicker, title, description, accent, actionLabel }) {
  return `
    ${artwork(accent)}
    <span class="game-card-body">
      <small class="game-card-kicker">${kicker}</small>
      <strong>${title}</strong>
      <small class="game-card-description">${description}</small>
    </span>
    <span class="game-card-footer">
      <span>${actionLabel}</span>
      <span class="game-card-arrow" aria-hidden="true">›</span>
    </span>
  `;
}

function directGameCard({ id, href, kicker, title, description, accent }) {
  const link = document.createElement("a");
  link.id = id;
  link.className = `game-card game-hub-direct-card game-hub-${accent}`;
  link.href = href;
  link.setAttribute("aria-label", `Open ${title}`);
  link.innerHTML = cardMarkup({
    kicker,
    title,
    description,
    accent,
    actionLabel: "Play now",
  });
  return link;
}

function prepareLocalCard(card, { kicker, title, description, accent }) {
  if (!card) return null;
  card.className = `game-card game-hub-local-card game-hub-${accent}${card.classList.contains("is-selected") ? " is-selected" : ""}`;
  card.setAttribute("aria-label", `Select ${title}`);
  card.innerHTML = cardMarkup({
    kicker,
    title,
    description,
    accent,
    actionLabel: "Select game",
  });
  return card;
}

function installTopBar() {
  if (!hero || hero.querySelector(".game-hub-topbar")) return;
  hero.id = "gameframe-home";
  const topbar = document.createElement("div");
  topbar.className = "game-hub-topbar";
  topbar.innerHTML = `
    <a class="game-hub-brand" href="#gameframe-home" aria-label="GameFrame home">
      <span class="game-hub-brand-mark" aria-hidden="true">S</span>
      <span>
        <small>SCRIBBLES</small>
        <strong>GAME<span>FRAME</span></strong>
      </span>
    </a>
    <nav class="game-hub-nav" aria-label="GameFrame sections">
      <a href="#gameframe-home">Home</a>
      <a class="is-active" href="#lobby">Games</a>
      <button id="game-hub-achievements" type="button" disabled aria-disabled="true">
        <span>Achievements</span>
        <small>Coming soon</small>
      </button>
    </nav>
    <span class="game-hub-discord-safe" aria-hidden="true"></span>
  `;
  hero.prepend(topbar);
}

function installModeHeading() {
  if (!modeGrid || modeGrid.previousElementSibling?.classList.contains("game-hub-mode-heading")) return;
  const heading = document.createElement("div");
  heading.className = "game-hub-mode-heading";
  heading.innerHTML = `
    <span>
      <small>MATCH SETUP</small>
      <strong>Choose how to play</strong>
    </span>
    <small>Tic-Tac-Toe and Checkers can launch here. Monster Master and Othello open their dedicated game screens.</small>
  `;
  modeGrid.before(heading);
}

if (gameGrid) {
  tacticalLink?.remove();
  const monsterMaster = directGameCard({
    id: "open-monster-master",
    href: "/monster-master.html",
    kicker: "TACTICAL DUEL",
    title: "Monster Master",
    description: "Command a hand-illustrated creature squad through an initiative-driven battle.",
    accent: "monster",
  });
  const othello = directGameCard({
    id: "open-othello",
    href: "/othello.html",
    kicker: "STRATEGY",
    title: "Othello",
    description: "Control the board across three complete visual themes.",
    accent: "othello",
  });
  const preparedCheckers = prepareLocalCard(checkers, {
    kicker: "CLOCKWORK ECLIPSE",
    title: "Clockwork Checkers",
    description: "Mandatory captures, multi-jumps, kings, and a complete match flow.",
    accent: "checkers",
  });
  const preparedTicTacToe = prepareLocalCard(ticTacToe, {
    kicker: "QUICK MATCH",
    title: "Tic-Tac-Toe",
    description: "A fast duel against Theo or another player.",
    accent: "tic",
  });
  gameGrid.replaceChildren(monsterMaster, othello, preparedCheckers, preparedTicTacToe);
}

installTopBar();
installModeHeading();
if (sectionLabel) sectionLabel.textContent = "GAME LIBRARY";
if (lobbyTitle) lobbyTitle.textContent = "Choose your game";

let brandSyncPending = false;
function syncHubBrand() {
  brandSyncPending = false;
  const active = Boolean(lobby && !lobby.hidden);
  document.body.classList.toggle("gameframe-game-hub-lobby", active);
  if (!active) return;
  if (eyebrow && eyebrow.textContent !== "WELCOME BACK") eyebrow.textContent = "WELCOME BACK";
  if (gameTitle && gameTitle.textContent !== playerLabel) gameTitle.textContent = playerLabel;
  if (heroCopy && heroCopy.textContent !== hubCopy) heroCopy.textContent = hubCopy;
  if (lobbyMessage && lobbyMessage.textContent === "Preparing the browser client…") {
    lobbyMessage.textContent = "Select a game to continue.";
  }
  if (document.title !== "Scribbles GameFrame") document.title = "Scribbles GameFrame";
}
function scheduleBrandSync() {
  if (brandSyncPending) return;
  brandSyncPending = true;
  requestAnimationFrame(syncHubBrand);
}

const observer = new MutationObserver(scheduleBrandSync);
for (const node of [lobby, gameTitle, heroCopy, lobbyMessage].filter(Boolean)) {
  observer.observe(node, { attributes: true, childList: true, subtree: true, characterData: true });
}

syncHubBrand();
