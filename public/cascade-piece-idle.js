const board = document.getElementById("board");

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
    ".is-special-born",
    ".is-special-triggered",
  ].join(",");

  let nextKind = 0;
  let pulseTimeout = 0;

  const clearPulse = () => {
    window.clearTimeout(pulseTimeout);
    pulseTimeout = 0;
    board.querySelectorAll(".cascade-tile.is-idle-pulse").forEach((tile) => {
      tile.classList.remove("is-idle-pulse");
    });
  };

  const effectsAreReduced = () => (
    reducedMotion.matches
    || document.body?.dataset.cascadeEffects === "reduced"
  );

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

  const pulseColor = () => {
    clearPulse();

    const kind = nextKind;
    nextKind = (nextKind + 1) % 6;

    if (boardIsBusy()) return;

    const tiles = board.querySelectorAll(`.cascade-tile[data-kind="${kind}"]`);
    if (!tiles.length) return;

    tiles.forEach((tile) => tile.classList.add("is-idle-pulse"));
    pulseTimeout = window.setTimeout(clearPulse, 1100);
  };

  const cancelForInteraction = () => clearPulse();
  board.addEventListener("pointerdown", cancelForInteraction, true);
  board.addEventListener("keydown", cancelForInteraction, true);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearPulse();
  });

  reducedMotion.addEventListener?.("change", () => {
    if (reducedMotion.matches) clearPulse();
  });

  const stateObserver = new MutationObserver((records) => {
    for (const record of records) {
      const tile = record.target;
      if (!(tile instanceof HTMLElement)) continue;
      if (!tile.classList.contains("cascade-tile") || !tile.classList.contains("is-idle-pulse")) continue;
      if (tile.matches(activeSelector)) tile.classList.remove("is-idle-pulse");
    }
  });

  stateObserver.observe(board, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  window.setTimeout(pulseColor, 1600);
  window.setInterval(pulseColor, 4200);
}
