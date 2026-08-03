const navStylesheetUrl = "/gameframe-nav.css";
if (!document.querySelector(`link[href="${navStylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = navStylesheetUrl;
  document.head.append(stylesheet);
}

function navigationTheme() {
  const menuTheme = document.body.dataset.gameframeMenuGame;
  if (menuTheme) return menuTheme;
  const pathname = window.location.pathname;
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
  if (pathname.includes("monster-master")) return "MONSTER MASTER";
  if (pathname.includes("othello")) return "OTHELLO";
  if (document.body.classList.contains("tic-tac-toe-noir-running")) return "TIC-TAC-TOE";
  if (document.querySelector("#board.board-checkers") && !document.querySelector("#match-panel")?.hidden) return "CLOCKWORK CHECKERS";
  return "GAMEFRAME";
}

function installDestinationBar() {
  let bar = document.querySelector("#gameframe-destination-bar");
  if (!bar) {
    bar = document.createElement("header");
    bar.id = "gameframe-destination-bar";
    bar.className = "gameframe-destination-bar";
    bar.innerHTML = `
      <a class="gameframe-destination-brand" href="/" aria-label="Scribbles GameFrame home">
        <span class="gameframe-destination-mark" aria-hidden="true">S</span>
        <span>
          <small>SCRIBBLES</small>
          <strong data-gameframe-destination-title>GAMEFRAME</strong>
        </span>
      </a>
      <nav class="gameframe-destination-links" aria-label="GameFrame destinations">
        <a data-gameframe-home href="/">Home</a>
        <button type="button" disabled aria-disabled="true">
          <span>Achievements</span>
          <small>Coming soon</small>
        </button>
      </nav>
      <span class="gameframe-destination-session-space" aria-hidden="true"></span>
    `;
    document.body.prepend(bar);
  }

  const home = bar.querySelector("[data-gameframe-home]");
  home?.addEventListener("click", (event) => {
    const navigation = new CustomEvent("gameframe:before-home", {
      bubbles: true,
      cancelable: true,
      detail: { destination: "/" },
    });
    if (!document.dispatchEvent(navigation)) event.preventDefault();
  });

  document.body.classList.add("gameframe-has-destination-bar");
  return bar;
}

const bar = installDestinationBar();
let updatePending = false;
function syncDestinationBar() {
  updatePending = false;
  const theme = navigationTheme();
  const stylesheet = document.querySelector(`link[href="${navStylesheetUrl}"]`);
  if (stylesheet && stylesheet !== document.head.lastElementChild) document.head.append(stylesheet);
  if (bar.dataset.theme !== theme) bar.dataset.theme = theme;
  const title = bar.querySelector("[data-gameframe-destination-title]");
  const nextTitle = gameLabel();
  if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
  const atHome = window.location.pathname === "/" && !document.body.classList.contains("tic-tac-toe-noir-running")
    && (document.querySelector("#lobby") && !document.querySelector("#lobby")?.hidden)
    && !document.body.classList.contains("gameframe-game-menu");
  bar.querySelector("[data-gameframe-home]")?.classList.toggle("is-active", Boolean(atHome));
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
