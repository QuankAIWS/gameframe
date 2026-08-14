const board = document.getElementById("board");
const boardWrap = document.querySelector(".cascade-board-wrap");
const statusRail = document.querySelector(".cascade-status");

if (board) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactViewport = window.matchMedia("(max-width: 650px)");
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

  const AMBIENT_MIN_MS = 1_250;
  const AMBIENT_STEP_MS = 220;
  const AMBIENT_DURATION_MS = 760;
  const DEEP_IDLE_AFTER_MS = 6_000;
  const ATTRACT_EVERY_MS = 11_500;
  const ATTRACT_DURATION_MS = 900;

  let cursor = 5;
  let beat = 0;
  let ambientTimer = 0;
  let ambientClearTimer = 0;
  let attractTimer = 0;
  let lastInteractionAt = performance.now();
  let lastAttractAt = -Infinity;

  const effectsAreReduced = () => (
    reducedMotion.matches
    || document.body?.dataset.cascadeEffects === "reduced"
  );

  const clearAmbient = () => {
    window.clearTimeout(ambientClearTimer);
    ambientClearTimer = 0;
    board.querySelectorAll(".cascade-tile.is-idle-life").forEach((tile) => {
      tile.classList.remove("is-idle-life");
      tile.style.removeProperty("--cascade-idle-delay");
    });
  };

  const clearAttract = () => {
    window.clearTimeout(attractTimer);
    attractTimer = 0;
    boardWrap?.classList.remove("is-idle-attract");
    statusRail?.classList.remove("is-idle-attract");
    document.body?.classList.remove("cascade-idle-attract");
  };

  const clearAllAmbient = () => {
    clearAmbient();
    clearAttract();
  };

  const noteInteraction = () => {
    lastInteractionAt = performance.now();
    lastAttractAt = -Infinity;
    clearAllAmbient();
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

  const calmTiles = () => [...board.querySelectorAll(".cascade-tile")]
    .filter((tile) => !tile.matches(activeSelector) && !tile.disabled);

  const pickTile = (tiles, used, preferSpecial = false) => {
    if (!tiles.length) return null;

    const specialTiles = preferSpecial
      ? tiles.filter((tile) => tile.dataset.special && !used.has(tile))
      : [];
    const pool = specialTiles.length ? specialTiles : tiles;

    // A deterministic coprime stride keeps the board lively without using
    // Math.random(), which makes browser coverage flaky and can accidentally
    // revisit one corner for long stretches.
    for (let attempt = 0; attempt < pool.length; attempt += 1) {
      const index = (cursor + attempt * 11) % pool.length;
      const tile = pool[index];
      if (!used.has(tile)) {
        cursor = (cursor + 17) % Math.max(1, tiles.length);
        return tile;
      }
    }
    return null;
  };

  const runDeepIdleAttract = (now) => {
    if (now - lastInteractionAt < DEEP_IDLE_AFTER_MS) return;
    if (now - lastAttractAt < ATTRACT_EVERY_MS) return;

    lastAttractAt = now;
    boardWrap?.classList.add("is-idle-attract");
    statusRail?.classList.add("is-idle-attract");
    document.body?.classList.add("cascade-idle-attract");
    window.clearTimeout(attractTimer);
    attractTimer = window.setTimeout(clearAttract, ATTRACT_DURATION_MS);
  };

  const runAmbientBeat = () => {
    clearAmbient();
    if (boardIsBusy()) return;

    const tiles = calmTiles();
    if (!tiles.length) return;

    beat += 1;
    const now = performance.now();
    const wideSecondTile = !compactViewport.matches && beat % 3 === 0;
    const count = wideSecondTile ? 2 : 1;
    const used = new Set();

    for (let slot = 0; slot < count; slot += 1) {
      // Roughly every fourth beat gives an existing special first refusal so
      // useful board state feels more alive than ordinary candy without
      // creating a perpetual animation on every special.
      const preferSpecial = slot === 0 && beat % 4 === 0;
      const tile = pickTile(tiles, used, preferSpecial);
      if (!tile) continue;
      used.add(tile);
      tile.style.setProperty("--cascade-idle-delay", `${slot * 105}ms`);
      tile.classList.add("is-idle-life");
    }

    ambientClearTimer = window.setTimeout(clearAmbient, AMBIENT_DURATION_MS + 140);
    runDeepIdleAttract(now);
  };

  const scheduleAmbientBeat = () => {
    window.clearTimeout(ambientTimer);
    const delay = AMBIENT_MIN_MS + ((beat * 7) % 5) * AMBIENT_STEP_MS;
    ambientTimer = window.setTimeout(() => {
      runAmbientBeat();
      scheduleAmbientBeat();
    }, delay);
  };

  document.addEventListener("pointerdown", noteInteraction, { capture: true, passive: true });
  document.addEventListener("keydown", noteInteraction, true);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearAllAmbient();
    else {
      lastInteractionAt = performance.now();
      lastAttractAt = -Infinity;
    }
  });

  reducedMotion.addEventListener?.("change", () => {
    if (reducedMotion.matches) clearAllAmbient();
  });

  scheduleAmbientBeat();
}
