const board = document.querySelector("#board");
const wrap = document.querySelector(".cascade-board-wrap");
const levelNumber = document.querySelector("#level-number");

if (board && wrap) {
  const coatingLayer = document.createElement("div");
  coatingLayer.className = "cascade-cell-coating-layer";
  coatingLayer.setAttribute("aria-hidden", "true");

  const effectLayer = document.createElement("div");
  effectLayer.className = "cascade-cell-coating-layer cascade-cell-coating-effects";
  effectLayer.setAttribute("aria-hidden", "true");

  wrap.append(coatingLayer, effectLayer);

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

  function shellInset(shellNumber) {
    if (shellNumber <= 1) return 7;
    if (shellNumber === 2) return 3.5;
    if (shellNumber === 3) return 0;
    if (shellNumber === 4) return -1.5;
    return -2.5;
  }

  function appendShells(coating, firstShell, lastShell) {
    for (let shellNumber = firstShell; shellNumber <= lastShell; shellNumber += 1) {
      const shell = document.createElement("span");
      shell.className = "cascade-ice-shell";
      shell.dataset.shell = String(shellNumber);
      shell.style.inset = `${shellInset(shellNumber)}%`;
      coating.append(shell);
    }
  }

  function appendMarkers(coating, layers) {
    const markerCount = Math.min(3, Math.max(1, layers));
    const markers = document.createElement("span");
    markers.className = "cascade-ice-markers";
    markers.dataset.count = String(markerCount);
    markers.dataset.totalLayers = String(layers);

    for (let markerNumber = 1; markerNumber <= markerCount; markerNumber += 1) {
      const marker = document.createElement("i");
      marker.className = "cascade-ice-marker";
      marker.dataset.marker = String(markerNumber);
      markers.append(marker);
    }

    coating.append(markers);
  }

  function makeCoating(index, layers) {
    const coating = document.createElement("span");
    const visualLayers = Math.min(3, Math.max(1, layers));
    coating.className = `cascade-cell-coating ice-${visualLayers} ice-layers-${layers}`;
    coating.dataset.layers = String(layers);
    cellPlacement(coating, index);
    appendShells(coating, 1, layers);
    appendMarkers(coating, layers);
    return coating;
  }

  function makeRemovedShells(index, remainingLayers, oldLayers) {
    const coating = document.createElement("span");
    coating.className = "cascade-cell-coating is-shedding-shell";
    coating.dataset.layers = String(oldLayers);
    coating.dataset.remainingLayers = String(remainingLayers);
    cellPlacement(coating, index);
    appendShells(coating, remainingLayers + 1, oldLayers);
    return coating;
  }

  function syncGeometry() {
    const boardRect = board.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const style = getComputedStyle(board);
    const wrapStyle = getComputedStyle(wrap);
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const wrapBorderTop = Number.parseFloat(wrapStyle.borderTopWidth) || 0;
    const wrapBorderLeft = Number.parseFloat(wrapStyle.borderLeftWidth) || 0;

    // Absolutely positioned children use the wrapper's padding box as their
    // containing block. Subtract the wrapper border so a thicker cabinet bezel
    // cannot shift fixed cell coatings away from the underlying candy grid.
    for (const layer of [coatingLayer, effectLayer]) {
      layer.style.left = `${boardRect.left - wrapRect.left - wrapBorderLeft + borderLeft + paddingLeft}px`;
      layer.style.top = `${boardRect.top - wrapRect.top - wrapBorderTop + borderTop + paddingTop}px`;
      layer.style.width = `${Math.max(0, boardRect.width - borderLeft - borderRight - paddingLeft - paddingRight)}px`;
      layer.style.height = `${Math.max(0, boardRect.height - borderTop - borderBottom - paddingTop - paddingBottom)}px`;
      layer.style.columnGap = style.columnGap;
      layer.style.rowGap = style.rowGap;
    }
  }

  function removeEffectAfterAnimation(effect) {
    window.setTimeout(() => effect.remove(), 520);
  }

  function syncCoatings() {
    syncQueued = false;
    const currentLevel = levelNumber?.textContent?.trim() || "";
    if (currentLevel !== previousLevel) {
      previousLevel = currentLevel;
      previousIce = new Map();
      initialized = false;
      effectLayer.replaceChildren();
    }

    const nextIce = iceSnapshot();
    const fragment = document.createDocumentFragment();

    for (const [index, layers] of nextIce) {
      const coating = makeCoating(index, layers);
      const oldLayers = previousIce.get(index);

      if (initialized && oldLayers > layers) {
        coating.classList.add("is-layer-exposed");
        const removedShells = makeRemovedShells(index, layers, oldLayers);
        effectLayer.append(removedShells);
        removeEffectAfterAnimation(removedShells);
      }

      fragment.append(coating);
    }

    if (initialized) {
      for (const [index, oldLayers] of previousIce) {
        if (nextIce.has(index)) continue;
        const shatter = makeCoating(index, oldLayers);
        shatter.classList.add("is-shattering");
        effectLayer.append(shatter);
        removeEffectAfterAnimation(shatter);
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
