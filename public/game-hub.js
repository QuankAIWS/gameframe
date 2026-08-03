const stylesheetUrl = "/game-hub.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

document.body.classList.add("gameframe-game-hub");

const gameGrid = document.querySelector(".game-grid");
const lobby = document.querySelector("#lobby");
const gameTitle = document.querySelector("#game-title");
const heroCopy = document.querySelector("#hero-copy");
const eyebrow = document.querySelector(".hero .eyebrow");
const sectionLabel = document.querySelector("#lobby .section-label");
const lobbyTitle = document.querySelector("#lobby-title");
const tacticalLink = document.querySelector("#open-tactical-canary");
const ticTacToe = document.querySelector("#select-tic-tac-toe");
const checkers = document.querySelector("#select-checkers");

function directGameCard({ id, href, badge, title, description, accent }) {
  const link = document.createElement("a");
  link.id = id;
  link.className = `game-card game-hub-direct-card game-hub-${accent}`;
  link.href = href;
  link.innerHTML = `
    <span class="game-glyph" aria-hidden="true">${badge}</span>
    <span class="game-card-copy">
      <small class="game-card-kicker">OPEN GAME</small>
      <strong>${title}</strong>
      <small>${description}</small>
    </span>
    <span class="game-card-arrow" aria-hidden="true">↗</span>
  `;
  return link;
}

function prepareLocalCard(card, { kicker, title, description, accent }) {
  if (!card) return null;
  card.classList.add("game-hub-local-card", `game-hub-${accent}`);
  const copy = card.querySelector("span:last-child");
  const strong = copy?.querySelector("strong");
  const small = copy?.querySelector("small");
  if (strong) strong.textContent = title;
  if (small) small.textContent = description;
  if (copy && !copy.querySelector(".game-card-kicker")) {
    const label = document.createElement("small");
    label.className = "game-card-kicker";
    label.textContent = kicker;
    copy.prepend(label);
  }
  return card;
}

if (gameGrid) {
  tacticalLink?.remove();
  const monsterMaster = directGameCard({
    id: "open-monster-master",
    href: "/monster-master.html",
    badge: "MM",
    title: "Monster Master",
    description: "Command a hand-illustrated creature squad in a tactical initiative duel.",
    accent: "monster",
  });
  const othello = directGameCard({
    id: "open-othello",
    href: "/othello.html",
    badge: "●◐",
    title: "Othello",
    description: "Play the complete 8×8 strategy game across three distinct visual worlds.",
    accent: "othello",
  });
  const preparedCheckers = prepareLocalCard(checkers, {
    kicker: "QUICK MATCH",
    title: "Clockwork Checkers",
    description: "Mandatory captures, multi-jumps, kings, and the Clockwork Eclipse board.",
    accent: "checkers",
  });
  const preparedTicTacToe = prepareLocalCard(ticTacToe, {
    kicker: "QUICK MATCH",
    title: "Tic-Tac-Toe",
    description: "A fast deterministic match for two players or a duel against Theo.",
    accent: "tic",
  });
  gameGrid.replaceChildren(monsterMaster, othello, preparedCheckers, preparedTicTacToe);
}

if (eyebrow) eyebrow.textContent = "SCRIBBLES GAMEFRAME // ARCADE";
if (sectionLabel) sectionLabel.textContent = "PLAYER GAME LIBRARY";
if (lobbyTitle) lobbyTitle.textContent = "Choose your game";

let brandSyncPending = false;
function syncHubBrand() {
  brandSyncPending = false;
  if (!lobby || lobby.hidden) return;
  if (gameTitle) gameTitle.textContent = "GameFrame Arcade";
  if (heroCopy) {
    heroCopy.textContent = "Pick a finished game, choose an opponent, and start playing. Internal movement and combat harnesses stay out of the player menu.";
  }
  document.title = "Scribbles GameFrame";
}
function scheduleBrandSync() {
  if (brandSyncPending) return;
  brandSyncPending = true;
  requestAnimationFrame(syncHubBrand);
}

const observer = new MutationObserver(scheduleBrandSync);
for (const node of [lobby, gameTitle, heroCopy].filter(Boolean)) {
  observer.observe(node, { attributes: true, childList: true, subtree: true, characterData: true });
}

syncHubBrand();
