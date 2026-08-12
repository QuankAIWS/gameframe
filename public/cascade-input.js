const board = document.querySelector("#board");
const hammerButton = document.querySelector("#booster-hammer");
const hammerCount = document.querySelector("#hammer-count");

let drag = null;

function tileFromTarget(target) {
  return target instanceof Element ? target.closest(".cascade-tile[data-index]") : null;
}

function numericIndex(tile) {
  const index = Number(tile?.dataset.index);
  return Number.isInteger(index) && index >= 0 && index < 64 ? index : null;
}

function adjacentIndex(from, dx, dy) {
  const row = Math.floor(from / 8);
  const column = from % 8;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0 && column < 7) return from + 1;
    if (dx < 0 && column > 0) return from - 1;
    return null;
  }
  if (dy > 0 && row < 7) return from + 8;
  if (dy < 0 && row > 0) return from - 8;
  return null;
}

function clearDragPresentation() {
  board?.querySelectorAll(".is-drag-origin, .is-drag-target").forEach((tile) => {
    tile.classList.remove("is-drag-origin", "is-drag-target");
  });
}

function clearPendingClickSelection() {
  const selected = board?.querySelector(".cascade-tile.is-selected");
  if (selected) selected.click();
}

function finishDrag() {
  clearDragPresentation();
  drag = null;
}

function updateDragTarget(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  const distance = Math.hypot(dx, dy);
  if (distance < drag.threshold) {
    if (drag.didDrag) {
      clearDragPresentation();
      drag.to = null;
    }
    return;
  }

  if (!drag.didDrag) {
    clearPendingClickSelection();
    if (!board.hasPointerCapture?.(event.pointerId)) board.setPointerCapture?.(event.pointerId);
  }
  const next = adjacentIndex(drag.from, dx, dy);
  drag.didDrag = true;
  if (drag.to === next) return;

  clearDragPresentation();
  drag.to = next;
  board?.querySelector(`.cascade-tile[data-index="${drag.from}"]`)?.classList.add("is-drag-origin");
  if (next !== null) board?.querySelector(`.cascade-tile[data-index="${next}"]`)?.classList.add("is-drag-target");
}

if (board) {
  board.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    const tile = tileFromTarget(event.target);
    const from = numericIndex(tile);
    if (from === null || tile.disabled || tile.classList.contains("is-hammer-target")) return;

    const rect = tile.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      from,
      to: null,
      startX: event.clientX,
      startY: event.clientY,
      threshold: Math.max(10, Math.min(22, Math.min(rect.width, rect.height) * 0.24)),
      didDrag: false,
    };
  });

  board.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    updateDragTarget(event);
    if (drag.didDrag) event.preventDefault();
  });

  board.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    updateDragTarget(event);
    const completed = { ...drag };
    finishDrag();
    if (board.hasPointerCapture?.(event.pointerId)) board.releasePointerCapture(event.pointerId);

    if (!completed.didDrag) return;
    event.preventDefault();
    if (completed.to === null) return;

    const fromTile = board.querySelector(`.cascade-tile[data-index="${completed.from}"]`);
    const toTile = board.querySelector(`.cascade-tile[data-index="${completed.to}"]`);
    if (!fromTile || !toTile || fromTile.disabled || toTile.disabled) return;
    if (fromTile.classList.contains("is-hammer-target") || toTile.classList.contains("is-hammer-target")) return;

    // A real drag owns pointer capture, so the browser's synthetic post-pointer click
    // targets the board rather than either tile. Programmatic tile clicks can therefore
    // reuse the canonical swap path without a blanket post-drag click suppression window.
    fromTile.click();
    toTile.click();
  });

  board.addEventListener("pointercancel", finishDrag);
  board.addEventListener("lostpointercapture", () => {
    if (drag?.didDrag) finishDrag();
  });

  board.addEventListener("click", (event) => {
    const tile = tileFromTarget(event.target);
    if (!tile) return;

    // The runtime commits the hammer decrement before resolving the hammer animation,
    // but its next status repaint can occur noticeably later. Mirror that committed
    // inventory change immediately and disable the booster during the same resolution
    // window so a rapid second press cannot be swallowed while the runtime is locked.
    if (event.isTrusted && tile.classList.contains("is-hammer-target") && hammerCount) {
      const current = Math.max(0, Number(hammerCount.textContent) || 0);
      if (current > 0) hammerCount.textContent = String(current - 1);
      if (hammerButton) hammerButton.disabled = true;
    }
  }, true);
}
