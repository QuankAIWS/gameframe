const menu = document.querySelector("#board-game-menu");
const slot = menu?.querySelector("[data-board-player-slot]");
const playerControl = document.querySelector("#create-human-match");
const matchPanel = document.querySelector("#match-panel");

if (slot && playerControl) {
  const compatibilityDescription = playerControl.querySelector("#human-description");
  if (compatibilityDescription) {
    compatibilityDescription.hidden = true;
    document.body.append(compatibilityDescription);
  }

  playerControl.className = "board-menu-player-control";
  playerControl.innerHTML = `
    <strong>Challenge a player</strong>
    <small>Start a persistent GameFrame match and take turns whenever you are available.</small>
  `;
  slot.replaceWith(playerControl);

  document.addEventListener("click", (event) => {
    if (event.target === playerControl || playerControl.contains(event.target)) {
      window.gameFrameBoardMenu?.close?.();
    }
  }, true);
}

document.addEventListener("gameframe:before-home", () => {
  if (menu && !menu.hidden && matchPanel) matchPanel.hidden = true;
});