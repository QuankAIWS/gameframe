const board = document.querySelector("#board");
const wrap = document.querySelector(".cascade-board-wrap");
const levelNumber = document.querySelector("#level-number");

if (board && wrap) {
  const coatingLayer = document.createElement("div");
  coatingLayer.className = "cascade-cell-coating-layer";
  coatingLayer.setAttribute("aria-hidden", "true");
  wrap.append(coatingLayer);

  let previousIce = new Map();
  let initialized = false;
  let syncQueued = false;
  let previousLevel = levelNumber?.textContent?.trim() || "";

  function iceSnapshot() {
    const next = new Map();
    board.querySelectorAll(".cascade-tile[data-ice]").forEach((tile) => {
      const index = Number(tile.dataset.index);
      const layers = Math.max(0, Number(tile.dataset.ice) || 0);
      if (Number.isInteger(index) && layers > 0) next.set(index, layers);
    });
    return next;
  }

  function cellPlacement(element, index) {
    element.style.gridColumn = String((index % 8) + 1);
    element.style.gridRow = String(Math.floor(index / 8) + 1);
    element.dataset.index = String(index);
  }

  function makeCoating(index, layers) {
    const coating = document.createElement("span");
    coating.className = `cascade-cell-coating ice-${layers > 1 ? 2 : 1}`;
    coating.dataset.layers = String(layers);
    cellPlacement(coating, index);
    return coating;
  }

  function syncGeometry() {
    const boardRect = board.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const style = getComputedStyle(board);
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;

    coatingLayer.style.left = `${boardRect.left - wrapRect.left + borderLeft + paddingLeft}px`;
    coatingLayer.style.top = `${boardRect.top - wrapRect.top + borderTop + paddingTop}px`;
    coatingLayer.style.width = `${Math.max(0, boardRect.width - borderLeft - borderRight - paddingLeft - paddingRight)}px`;
    coatingLayer.style.height = `${Math.max(0, boardRect.height - borderTop - borderBottom - paddingTop - paddingBottom)}px`;
    coatingLayer.style.columnGap = style.columnGap;
    coatingLayer.style.rowGap = style.rowGap;
  }

  function syncCoatings() {
    syncQueued = false;
    const currentLevel = levelNumber?.textContent?.trim() || "";
    if (currentLevel !== previousLevel) {
      previousLevel = currentLevel;
      previousIce = new Map();
      initialized = false;
    }

    const nextIce = iceSnapshot();
    const fragment = document.createDocumentFragment();

    for (const [index, layers] of nextIce) {
      const coating = makeCoating(index, layers);
      if (initialized && previousIce.has(index) && previousIce.get(index) > layers) {
        coating.classList.add("is-cracking");
      }
      fragment.append(coating);
    }

    if (initialized) {
      for (const [index, oldLayers] of previousIce) {
        if (nextIce.has(index)) continue;
        const shatter = makeCoating(index, oldLayers);
        shatter.classList.add("is-shattering");
        fragment.append(shatter);
        window.setTimeout(() => shatter.remove(), 520);
      }
    }

    coatingLayer.replaceChildren(fragment);
    previousIce = nextIce;
    initialized = true;
    syncGeometry();
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(syncCoatings);
  }

  new MutationObserver(scheduleSync).observe(board, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-ice"],
  });

  if (levelNumber) {
    new MutationObserver(scheduleSync).observe(levelNumber, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  if (window.ResizeObserver) {
    new ResizeObserver(syncGeometry).observe(board);
  } else {
    window.addEventListener("resize", syncGeometry, { passive: true });
  }

  scheduleSync();
}
