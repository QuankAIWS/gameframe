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

function clearPendingClickSelection() {
  const selected = board?.querySelector(".cascade-tile.is-selected");
  if (selected) selected.click();
}

function clearDragPresentation() {
  board?.querySelectorAll(".is-drag-origin, .is-drag-target").forEach((tile) => {
    tile.classList.remove("is-drag-origin", "is-drag-target");
    tile.style.removeProperty("--drag-slot-x");
    tile.style.removeProperty("--drag-slot-y");
  });
}

function createDragGhost(tile) {
  const rect = tile.getBoundingClientRect();
  const ghost = tile.cloneNode(true);
  ghost.classList.remove("is-selected", "is-drag-origin", "is-drag-target", "is-hammer-target");
  ghost.classList.add("cascade-drag-ghost");
  ghost.removeAttribute("data-index");
  ghost.removeAttribute("data-ice");
  ghost.removeAttribute("role");
  ghost.removeAttribute("aria-label");
  ghost.setAttribute("aria-hidden", "true");
  ghost.tabIndex = -1;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.append(ghost);
  return { ghost, rect };
}

function paintDrag() {
  if (!drag) return;
  drag.raf = 0;
  if (!drag.ghost) return;
  drag.ghost.style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0) scale(1.08)`;
}

function scheduleDragPaint() {
  if (!drag || drag.raf) return;
  drag.raf = requestAnimationFrame(paintDrag);
}

function setDragTarget(next) {
  if (!drag || drag.to === next) return;
  board?.querySelector(".cascade-tile.is-drag-target")?.classList.remove("is-drag-target");
  drag.to = next;
  if (next === null) return;

  const target = board?.querySelector(`.cascade-tile[data-index="${next}"]`);
  if (!target) return;
  target.classList.add("is-drag-target");
  const targetRect = target.getBoundingClientRect();
  const origin = drag.originRect;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const originCenterX = origin.left + origin.width / 2;
  const originCenterY = origin.top + origin.height / 2;
  target.style.setProperty("--drag-slot-x", `${(originCenterX - targetCenterX) * 0.14}px`);
  target.style.setProperty("--drag-slot-y", `${(originCenterY - targetCenterY) * 0.14}px`);
}

function beginVisibleDrag(event) {
  if (!drag || drag.didDrag) return;
  clearPendingClickSelection();
  if (!board.hasPointerCapture?.(event.pointerId)) board.setPointerCapture?.(event.pointerId);
  const originTile = board.querySelector(`.cascade-tile[data-index="${drag.from}"]`);
  if (!originTile) return;
  const { ghost, rect } = createDragGhost(originTile);
  drag.didDrag = true;
  drag.ghost = ghost;
  drag.originRect = rect;
  originTile.classList.add("is-drag-origin");
}

function updateDragTarget(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  const distance = Math.hypot(dx, dy);
  drag.dx = dx;
  drag.dy = dy;

  if (distance < drag.threshold) {
    if (drag.didDrag) setDragTarget(null);
    scheduleDragPaint();
    return;
  }

  beginVisibleDrag(event);
  if (!drag?.didDrag) return;
  setDragTarget(adjacentIndex(drag.from, dx, dy));
  scheduleDragPaint();
}

function settleGhost(completed, targetRect = null) {
  const ghost = completed.ghost;
  if (!ghost) return;
  if (completed.raf) cancelAnimationFrame(completed.raf);

  const current = ghost.style.transform || `translate3d(${completed.dx}px, ${completed.dy}px, 0) scale(1.08)`;
  let destination = "translate3d(0, 0, 0) scale(.98)";
  if (targetRect && completed.originRect) {
    const originCenterX = completed.originRect.left + completed.originRect.width / 2;
    const originCenterY = completed.originRect.top + completed.originRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    destination = `translate3d(${targetCenterX - originCenterX}px, ${targetCenterY - originCenterY}px, 0) scale(.98)`;
  }

  const animation = ghost.animate([
    { transform: current, opacity: 1 },
    { transform: destination, opacity: targetRect ? .88 : .42 },
  ], {
    duration: targetRect ? 90 : 110,
    easing: "cubic-bezier(.2,.8,.2,1)",
    fill: "forwards",
  });
  animation.finished.catch(() => {}).finally(() => ghost.remove());
}

function finishDrag(targetRect = null) {
  if (!drag) return null;
  const completed = { ...drag };
  clearDragPresentation();
  drag = null;
  settleGhost(completed, targetRect);
  return completed;
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
      dx: 0,
      dy: 0,
      threshold: Math.max(10, Math.min(22, Math.min(rect.width, rect.height) * 0.24)),
      didDrag: false,
      ghost: null,
      originRect: rect,
      raf: 0,
    };
  });

  board.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    updateDragTarget(event);
    if (drag?.didDrag) event.preventDefault();
  });

  board.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    updateDragTarget(event);
    const targetIndex = drag.to;
    const targetTile = targetIndex === null ? null : board.querySelector(`.cascade-tile[data-index="${targetIndex}"]`);
    const targetRect = targetTile?.getBoundingClientRect() ?? null;
    const completed = finishDrag(targetRect);
    if (board.hasPointerCapture?.(event.pointerId)) board.releasePointerCapture(event.pointerId);

    if (!completed?.didDrag) return;
    event.preventDefault();
    if (completed.to === null) return;

    const fromTile = board.querySelector(`.cascade-tile[data-index="${completed.from}"]`);
    const toTile = board.querySelector(`.cascade-tile[data-index="${completed.to}"]`);
    if (!fromTile || !toTile || fromTile.disabled || toTile.disabled) return;
    if (fromTile.classList.contains("is-hammer-target") || toTile.classList.contains("is-hammer-target")) return;

    // A real drag owns pointer capture, so the browser's synthetic post-pointer click
    // targets the board rather than either tile. Programmatic tile clicks therefore
    // reuse the canonical swap path without a blanket post-drag click suppression window.
    fromTile.click();
    toTile.click();
  });

  board.addEventListener("pointercancel", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishDrag();
  });
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
