const params = new URLSearchParams(window.location.search);
const selected = params.get("game");
if (selected === "tic-tac-toe" || selected === "american-checkers") {
  const lobby = document.querySelector("#lobby");
  const surface = document.querySelector("#match-panel");
  if (lobby) lobby.hidden = true;
  if (surface) surface.hidden = false;
  document.body.classList.add("board-game-route");
  await import("./board-game-menu.js");
  await import("./board-menu-controls.js");
}
