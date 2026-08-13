const menu = document.querySelector("#board-game-menu");
const slot = menu?.querySelector("[data-board-player-slot]");
const playerControl = document.querySelector("#create-human-match");

if (slot && playerControl) {
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
