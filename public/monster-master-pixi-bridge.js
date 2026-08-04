window.gameFrameMonsterRendererMode = "pixi";
const stylesheetUrl = "/monster-master-pixi.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const coordinateEvent = "gameframe:monster-master-coordinate";
let suppressBattlefieldClickUntil = 0;

function renderer() {
  return window.gameFrameMonsterPixi ?? null;
}

function worldToScreen(coordinate, elevationPixels = 0) {
  return renderer()?.worldToScreen?.(coordinate, elevationPixels) ?? null;
}

function dispatchCoordinate(coordinate) {
  if (!coordinate || !Number.isFinite(coordinate.x) || !Number.isFinite(coordinate.y)) return false;
  const normalized = { x: Math.round(coordinate.x), y: Math.round(coordinate.y) };
  const controller = window.gameFrameMonsterController;
  if (controller?.handleCoordinate) {
    controller.handleCoordinate(normalized);
    return true;
  }
  window.dispatchEvent(new CustomEvent(coordinateEvent, { detail: { coordinate: normalized } }));
  return true;
}

function panScreen(deltaX, deltaY) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
  return renderer()?.panScreen?.(deltaX, deltaY) ?? false;
}

function bindCardinalCameraControls() {
  document.querySelectorAll("[data-monster-master-pan-x][data-monster-master-pan-y]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const rawX = Number(button.dataset.monsterMasterPanX);
      const rawY = Number(button.dataset.monsterMasterPanY);
      if (!rawX && !rawY) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      renderer()?.panCardinal?.(Math.sign(rawX), Math.sign(rawY));
    }, true);
  });
}

function bindBattlefieldInput() {
  const frame = document.querySelector(".combat-canvas-frame");
  if (!frame || frame.dataset.pixiInputBound === "true") return;
  frame.dataset.pixiInputBound = "true";

  const drag = {
    pointerId: null,
    lastX: 0,
    lastY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  };

  function finishDrag(event) {
    if (drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressBattlefieldClickUntil = performance.now() + 300;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    document.querySelector("#monster-master-pixi-canvas")?.classList.remove("is-camera-dragging");
    if (frame.hasPointerCapture?.(event.pointerId)) frame.releasePointerCapture(event.pointerId);
    drag.pointerId = null;
    drag.moved = false;
  }

  frame.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target?.id !== "monster-master-pixi-canvas") return;
    drag.pointerId = event.pointerId;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.originX = event.clientX;
    drag.originY = event.clientY;
    drag.moved = false;
    frame.setPointerCapture?.(event.pointerId);
  }, true);

  frame.addEventListener("pointermove", (event) => {
    if (drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.moved && Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) < 5) return;
    drag.moved = true;
    document.querySelector("#monster-master-pixi-canvas")?.classList.add("is-camera-dragging");
    panScreen(-deltaX, -deltaY);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  frame.addEventListener("pointerup", finishDrag, true);
  frame.addEventListener("pointercancel", finishDrag, true);

  frame.addEventListener("click", (event) => {
    if (performance.now() < suppressBattlefieldClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const currentRenderer = renderer();
    const canvas = document.querySelector("#monster-master-pixi-canvas");
    if (!currentRenderer?.screenToTile || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (
      event.clientX < rect.left
      || event.clientY < rect.top
      || event.clientX > rect.right
      || event.clientY > rect.bottom
    ) return;
    const coordinate = currentRenderer.screenToTile({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    if (!coordinate) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchCoordinate(coordinate);
  }, true);
}

function projectionCamera() {
  const camera = renderer()?.getCamera?.();
  if (!camera) return null;
  return {
    centerX: camera.x,
    centerY: camera.y,
    zoom: camera.zoom,
    quarter: camera.quarter,
  };
}

window.gameFrameMonsterPixiBridge = Object.freeze({
  worldToScreen,
  dispatchCoordinate,
  bindBattlefieldInput,
  panScreen,
});
window.gameFrameMonsterProjection = Object.freeze({
  getCamera: projectionCamera,
  worldToScreen,
  render: () => renderer()?.render?.(),
});

bindCardinalCameraControls();
bindBattlefieldInput();
