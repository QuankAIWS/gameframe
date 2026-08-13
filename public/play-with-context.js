const params = new URLSearchParams(window.location.search);
const selectedPlayerId = params.get("playWith")?.trim();
const identity = window.gameFrameIdentity;

function clearContext() {
  const url = new URL(window.location.href);
  url.searchParams.delete("playWith");
  window.history.replaceState({}, "", url);
}

function waitFor(getValue, attempts = 360) {
  return new Promise((resolve) => {
    function check(remaining) {
      const value = getValue();
      if (value || remaining <= 0) {
        resolve(value || null);
        return;
      }
      window.requestAnimationFrame(() => check(remaining - 1));
    }
    check(attempts);
  });
}

function pinPlayer(button, container, status, message) {
  button.classList.add("is-preselected");
  button.setAttribute("aria-current", "true");
  container?.prepend(button);
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest" });
  if (status) status.textContent = message;
  clearContext();
}

async function selectSharedBoardPlayer() {
  await waitFor(() => !document.body.classList.contains("gameframe-booting"));
  const openButton = await waitFor(() => document.querySelector("#create-human-match"));
  if (!(openButton instanceof HTMLButtonElement)) return;
  openButton.click();

  const playerButton = await waitFor(() => document.querySelector(`[data-challenge-player-id="${CSS.escape(selectedPlayerId)}"]`));
  if (!(playerButton instanceof HTMLButtonElement)) return;
  const dialog = playerButton.closest("#gameframe-invite-dialog");
  pinPlayer(
    playerButton,
    dialog?.querySelector("[data-invite-picker]"),
    dialog?.querySelector("[data-invite-status]"),
    "Player selected from profile. Confirm the game challenge when ready.",
  );
}

async function selectOthelloPlayer() {
  const openButton = await waitFor(() => document.querySelector("#othello-challenge-player"));
  if (!(openButton instanceof HTMLButtonElement)) return;
  openButton.click();

  const playerButton = await waitFor(() => {
    const players = Array.isArray(window.gameFrameKnownPlayers) ? window.gameFrameKnownPlayers : [];
    const index = players.findIndex((player) => player?.playerId === selectedPlayerId);
    if (index < 0) return null;
    return document.querySelectorAll("#othello-game-menu .othello-player-choice")[index] || null;
  });
  if (!(playerButton instanceof HTMLButtonElement)) return;
  const menu = playerButton.closest("#othello-game-menu");
  pinPlayer(
    playerButton,
    menu?.querySelector("[data-othello-player-picker]"),
    menu?.querySelector("[data-othello-online-status]"),
    "Player selected from profile. Confirm the Othello challenge when ready.",
  );
}

if (selectedPlayerId && identity?.playerId !== selectedPlayerId) {
  if (window.location.pathname === "/othello.html") void selectOthelloPlayer();
  else if (window.location.pathname === "/") void selectSharedBoardPlayer();
} else if (selectedPlayerId) {
  clearContext();
}
