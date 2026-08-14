const navStylesheetUrls = [
  "/gameframe-nav.css",
  "/gameframe-nav-integrations.css",
  "/gameframe-final-polish.css",
  "/gameframe-session-override.css",
];
for (const href of navStylesheetUrls) {
  if (document.querySelector(`link[href="${href}"]`)) continue;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = href;
  document.head.append(stylesheet);
}

const sharedRecentMatchStorageKey = "scribbles-gameframe.recent-match";
const internalHomeReturnStorageKey = "scribbles-gameframe.internal-home-return:v1";

function markInternalHomeReturn() {
  try {
    window.sessionStorage.setItem(internalHomeReturnStorageKey, String(Date.now()));
  } catch {
    // Internal-return presentation state is cosmetic and must never block navigation.
  }
}

function navigationTheme() {
  const menuTheme = document.body.dataset.gameframeMenuGame;
  if (menuTheme) return menuTheme;
  const pathname = window.location.pathname;
  if (pathname === "/casual-games.html") return "casual";
  if (pathname.includes("monster-master-rpg")) return "monster";
  if (pathname.includes("monster-master")) return "monster";
  if (pathname.includes("othello")) return `othello-${document.body.dataset.theme || "obsidian"}`;
  if (document.body.classList.contains("tic-tac-toe-noir-running")) return "tic";
  if (document.querySelector("#board.board-checkers") && !document.querySelector("#match-panel")?.hidden) return "checkers";
  return "hub";
}

function gameLabel() {
  const menuTheme = document.body.dataset.gameframeMenuGame;
  if (menuTheme === "tic") return "TIC-TAC-TOE";
  if (menuTheme === "checkers") return "CLOCKWORK CHECKERS";
  const pathname = window.location.pathname;
  if (pathname === "/") {
    return new URLSearchParams(window.location.search).get("catalog") === "1" ? "GAMES" : "";
  }
  if (pathname === "/matches.html") return "MATCHES";
  if (pathname === "/leaderboard.html") return "LEADERBOARD";
  if (pathname === "/profile.html") return "PROFILE";
  if (pathname === "/casual-games.html") return "CASUAL GAMES";
  if (pathname.includes("monster-master-rpg")) return "MONSTER MASTER RPG";
  if (pathname.includes("monster-master")) return "MONSTER MASTER";
  if (pathname.includes("othello")) return "OTHELLO";
  if (document.body.classList.contains("tic-tac-toe-noir-running")) return "TIC-TAC-TOE";
  if (document.querySelector("#board.board-checkers") && !document.querySelector("#match-panel")?.hidden) return "CLOCKWORK CHECKERS";
  return "";
}

function removeLegacyProductLabel() {
  for (const eyebrow of document.querySelectorAll(".eyebrow")) {
    if (eyebrow.textContent?.trim().toUpperCase() === "SCRIBBLES GAMEFRAME") eyebrow.remove();
  }
}

function sharedMatchRunning() {
  const panel = document.querySelector("#match-panel");
  return Boolean(panel && !panel.hidden);
}

function installDestinationBar() {
  let bar = document.querySelector("#gameframe-destination-bar");
  if (!bar) {
    bar = document.createElement("header");
    bar.id = "gameframe-destination-bar";
    bar.className = "gameframe-destination-bar";
    bar.innerHTML = `
      <a class="gameframe-destination-brand" href="/" aria-label="GameFrame home">
        <span class="gameframe-destination-mark" aria-hidden="true"><span>G</span><span>F</span></span>
        <span class="gameframe-destination-copy">
          <small class="gameframe-platform-name">GAMEFRAME</small>
          <strong data-gameframe-destination-title hidden></strong>
        </span>
      </a>
      <nav class="gameframe-destination-links" aria-label="GameFrame destinations">
        <a data-gameframe-home href="/">Home</a>
        <a data-gameframe-games href="/?catalog=1">Games</a>
        <a data-gameframe-matches href="/matches.html">Matches</a>
        <a data-gameframe-leaderboard href="/leaderboard.html" aria-label="Leaderboard"><span class="gameframe-nav-label-full">Leaderboard</span><span class="gameframe-nav-label-compact" aria-hidden="true">Ranks</span></a>
        <a data-gameframe-profile href="/profile.html">Profile</a>
      </nav>
      <span class="gameframe-destination-session-space" aria-hidden="true"></span>
    `;
    document.body.prepend(bar);
  }

  const destinationLinks = [
    bar.querySelector(".gameframe-destination-brand"),
    ...bar.querySelectorAll(".gameframe-destination-links a"),
  ].filter(Boolean);
  for (const destination of destinationLinks) {
    destination.addEventListener("click", (event) => {
      const href = destination.getAttribute("href") || "/";
      const navigation = new CustomEvent("gameframe:before-home", {
        bubbles: true,
        cancelable: true,
        detail: { destination: href },
      });
      if (!document.dispatchEvent(navigation)) {
        event.preventDefault();
        return;
      }
      if (sharedMatchRunning()) {
        if (!window.confirm("Leave this match? It stays saved in Matches.")) {
          event.preventDefault();
          return;
        }
        window.localStorage.removeItem(sharedRecentMatchStorageKey);
      }
      if (href === "/") markInternalHomeReturn();
    });
  }

  document.body.classList.add("gameframe-has-destination-bar");
  return bar;
}

const bar = installDestinationBar();
removeLegacyProductLabel();
window.dispatchEvent(new CustomEvent("gameframe:destination-bar-ready", { detail: { bar } }));
let updatePending = false;
function syncDestinationBar() {
  updatePending = false;

  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const sharedMatchPanel = document.querySelector("#match-panel");
  const runningSharedMatch = Boolean(sharedMatchPanel && !sharedMatchPanel.hidden);
  document.body.classList.toggle("gameframe-shared-match-running", runningSharedMatch);
  document.body.classList.toggle("gameframe-monster-route", pathname.includes("monster-master"));
  document.body.classList.toggle("gameframe-monster-rpg-route", pathname.includes("monster-master-rpg"));
  document.body.classList.toggle("gameframe-othello-route", pathname.includes("othello"));

  const theme = navigationTheme();
  if (bar.dataset.theme !== theme) bar.dataset.theme = theme;
  const title = bar.querySelector("[data-gameframe-destination-title]");
  const nextTitle = gameLabel();
  if (title) {
    if (title.textContent !== nextTitle) title.textContent = nextTitle;
    title.hidden = !nextTitle;
  }
  bar.classList.toggle("has-destination-title", Boolean(nextTitle));

  const rootLobbyVisible = pathname === "/"
    && !document.body.classList.contains("tic-tac-toe-noir-running")
    && Boolean(document.querySelector("#lobby") && !document.querySelector("#lobby")?.hidden)
    && !document.body.classList.contains("gameframe-game-menu");
  const atGames = (rootLobbyVisible && params.get("catalog") === "1") || pathname === "/casual-games.html";
  const atHome = rootLobbyVisible && !atGames;
  bar.querySelector("[data-gameframe-home]")?.classList.toggle("is-active", atHome);
  bar.querySelector("[data-gameframe-games]")?.classList.toggle("is-active", atGames);
  bar.querySelector("[data-gameframe-matches]")?.classList.toggle("is-active", pathname === "/matches.html");
  bar.querySelector("[data-gameframe-leaderboard]")?.classList.toggle("is-active", pathname === "/leaderboard.html");
  bar.querySelector("[data-gameframe-profile]")?.classList.toggle("is-active", pathname === "/profile.html");
}
function scheduleDestinationSync() {
  if (updatePending) return;
  updatePending = true;
  requestAnimationFrame(syncDestinationBar);
}

const observer = new MutationObserver(scheduleDestinationSync);
observer.observe(document.body, {
  attributes: true,
  attributeFilter: ["class", "data-theme", "data-gameframe-menu-game"],
  childList: true,
  subtree: true,
});
syncDestinationBar();

window.gameFrameDestinationBar = Object.freeze({ sync: syncDestinationBar });

if (window.location.pathname === "/profile.html") {
  document.querySelectorAll(".profile-play-together").forEach((node) => node.remove());
  void import("./profile-play-context.js");
}

if (new URLSearchParams(window.location.search).has("playWith")) {
  void import("./play-with-context.js");
}
