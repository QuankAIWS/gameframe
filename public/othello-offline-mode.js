function applyOfflineOthelloMenu() {
  if (!window.gameFrameOffline && navigator.onLine !== false) return;
  const menu = document.querySelector("#othello-game-menu");
  if (!menu) return;

  if (!document.querySelector("#othello-offline-mode-style")) {
    const style = document.createElement("style");
    style.id = "othello-offline-mode-style";
    style.textContent = `
      #othello-game-menu #othello-challenge-player:disabled {
        opacity: .5;
        cursor: not-allowed;
        filter: saturate(.55);
      }
      #othello-game-menu .othello-all-matches[aria-disabled="true"] {
        opacity: .62;
        cursor: not-allowed;
        text-decoration: none;
      }
    `;
    document.head.append(style);
  }

  const intro = menu.querySelector(".othello-game-menu-card > p:not(.othello-menu-kicker):not(.othello-online-status)");
  if (intro) {
    intro.textContent = "Play OthelloBot, share the board locally, or resume a saved local match. Online challenges return when GameFrame reconnects.";
  }

  const challenge = menu.querySelector("#othello-challenge-player");
  if (challenge) {
    challenge.disabled = true;
    challenge.setAttribute("aria-disabled", "true");
    const detail = challenge.querySelector("small");
    if (detail) detail.textContent = "Internet connection required for player challenges.";
  }

  const openGames = menu.querySelector(".othello-open-games-block");
  if (openGames) {
    const list = openGames.querySelector("[data-othello-open-games]");
    if (list) list.innerHTML = "<p>Open online games are unavailable while offline.</p>";
    const matches = openGames.querySelector(".othello-all-matches");
    if (matches) {
      matches.removeAttribute("href");
      matches.setAttribute("aria-disabled", "true");
      matches.textContent = "Matches · online required";
    }
  }

  const status = menu.querySelector("[data-othello-online-status]");
  if (status && !status.textContent?.trim()) {
    status.textContent = "Offline mode · OthelloBot, Pass & Play, and saved local matches are available.";
  }
}

applyOfflineOthelloMenu();

const observer = new MutationObserver(() => {
  if (document.querySelector("#othello-game-menu")) {
    applyOfflineOthelloMenu();
    observer.disconnect();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("offline", applyOfflineOthelloMenu);
