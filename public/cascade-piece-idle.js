const board = document.getElementById("board");
const boardWrap = document.querySelector(".cascade-board-wrap");

if (board) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const activeSelector = [
    ".is-selected",
    ".is-drag-origin",
    ".is-drag-target",
    ".is-hammer-target",
    ".is-hammer-hit",
    ".is-matched",
    ".is-clearing",
    ".is-falling",
    ".is-landing",
    ".is-special-born",
    ".is-special-triggered",
  ].join(",");

  const ATTRACT_EVERY_MS = 9_000;
  const ATTRACT_DURATION_MS = 820;
  const IDLE_BEFORE_ATTRACT_MS = 4_500;

  let nextIndex = 3;
  let cueTimeout = 0;
  let lastInteractionAt = performance.now();

  const effectsAreReduced = () => (
    reducedMotion.matches
    || document.body?.dataset.cascadeEffects === "reduced"
  );

  const clearCue = () => {
    window.clearTimeout(cueTimeout);
    cueTimeout = 0;
    board.querySelector(".cascade-tile.is-idle-twinkle")?.classList.remove("is-idle-twinkle");
    boardWrap?.classList.remove("is-idle-attract");
  };

  const noteInteraction = () => {
    lastInteractionAt = performance.now();
    clearCue();
  };

  const boardIsBusy = () => (
    document.hidden
    || effectsAreReduced()
    || Boolean(document.querySelector("dialog[open]"))
    || Boolean(document.querySelector(".cascade-drag-ghost"))
    || Boolean(board.querySelector(activeSelector))
    || board.classList.contains("is-cascade-hit")
    || board.classList.contains("is-cascade-big")
    || board.classList.contains("is-shuffling")
    || board.classList.contains("is-shuffle-in")
    || document.getElementById("life-lock")?.hidden === false
    || document.getElementById("blitz-overlay")?.hidden === false
  );

  const nextCalmTile = () => {
    const tiles = [...board.querySelectorAll(".cascade-tile")];
    if (!tiles.length) return null;

    // Walk the board with a coprime stride so attract cues wander instead of
    // appearing to march in rows or animate a whole color family together.
    for (let attempt = 0; attempt < tiles.length; attempt += 1) {
      const index = (nextIndex + attempt * 11) % tiles.length;
      const tile = tiles[index];
      if (!tile.matches(activeSelector) && !tile.disabled) {
        nextIndex = (index + 11) % tiles.length;
        return tile;
      }
    }
    return null;
  };

  const attractIfIdle = () => {
    clearCue();
    if (performance.now() - lastInteractionAt < IDLE_BEFORE_ATTRACT_MS) return;
    if (boardIsBusy()) return;

    const tile = nextCalmTile();
    if (!tile) return;

    tile.classList.add("is-idle-twinkle");
    boardWrap?.classList.add("is-idle-attract");
    cueTimeout = window.setTimeout(clearCue, ATTRACT_DURATION_MS);
  };

  document.addEventListener("pointerdown", noteInteraction, { capture: true, passive: true });
  document.addEventListener("keydown", noteInteraction, true);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearCue();
    else lastInteractionAt = performance.now();
  });

  reducedMotion.addEventListener?.("change", () => {
    if (reducedMotion.matches) clearCue();
  });

  window.setTimeout(attractIfIdle, 5_500);
  window.setInterval(attractIfIdle, ATTRACT_EVERY_MS);
}
