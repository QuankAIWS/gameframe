window.gameFrameMonsterRendererMode = "pixi";
const stylesheetUrl = "/monster-master-pixi.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const coordinateEvent = "gameframe:monster-master-coordinate";
const TILE_WIDTH = 72;
const TILE_HEIGHT = 36;
const CARDINAL_PAN_X = TILE_WIDTH * 1.5;
const CARDINAL_PAN_Y = TILE_HEIGHT * 1.5;
let syntheticCameraDispatch = false;
let suppressBattlefieldClickUntil = 0;

function normalizeQuarter(value) {
  return ((Math.round(value) % 4) + 4) % 4;
}

function rotateCoordinate(coordinate, map, quarter) {
  const maxX = map.width - 1;
  const maxY = map.height - 1;
  switch (normalizeQuarter(quarter)) {
    case 1: return { x: maxY - coordinate.y, y: coordinate.x };
    case 2: return { x: maxX - coordinate.x, y: maxY - coordinate.y };
    case 3: return { x: coordinate.y, y: maxX - coordinate.x };
    default: return { x: coordinate.x, y: coordinate.y };
  }
}

function unrotateDelta(delta, quarter) {
  switch (normalizeQuarter(quarter)) {
    case 1: return { x: delta.y, y: -delta.x };
    case 2: return { x: -delta.x, y: -delta.y };
    case 3: return { x: -delta.y, y: delta.x };
    default: return { x: delta.x, y: delta.y };
  }
}

function screenVectorToCameraDelta(deltaX, deltaY, camera) {
  const zoom = Math.max(0.01, Number(camera?.zoom) || 1);
  const rotated = {
    x: deltaY / (TILE_HEIGHT * zoom) + deltaX / (TILE_WIDTH * zoom),
    y: deltaY / (TILE_HEIGHT * zoom) - deltaX / (TILE_WIDTH * zoom),
  };
  return unrotateDelta(rotated, camera?.quarter ?? 0);
}

function project(coordinate, map, quarter) {
  const rotated = rotateCoordinate(coordinate, map, quarter);
  return {
    x: (rotated.x - rotated.y) * TILE_WIDTH / 2,
    y: (rotated.x + rotated.y) * TILE_HEIGHT / 2,
  };
}

function worldToScreen(coordinate) {
  const renderer = window.gameFrameMonsterPixi;
  const view = renderer?.getView?.();
  const camera = renderer?.getCamera?.();
  const canvas = document.querySelector("#monster-master-pixi-canvas");
  if (!view || !camera || !canvas) return null;
  const map = view.observation.board.map;
  const point = project(coordinate, map, camera.quarter);
  const center = project({ x: camera.x, y: camera.y }, map, camera.quarter);
  return {
    x: canvas.clientWidth / 2 + (point.x - center.x) * camera.zoom,
    y: canvas.clientHeight * 0.48 + (point.y - center.y) * camera.zoom,
  };
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

function axisButton(axis) {
  const selector = axis === "x"
    ? "[data-monster-master-pan-x]:not([data-monster-master-pan-x='0'])"
    : "[data-monster-master-pan-y]:not([data-monster-master-pan-y='0'])";
  return document.querySelector(selector);
}

function dispatchCameraAxis(axis, value) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.001) return;
  const button = axisButton(axis);
  if (!button) return;
  const datasetKey = axis === "x" ? "monsterMasterPanX" : "monsterMasterPanY";
  const previous = button.dataset[datasetKey];
  button.dataset[datasetKey] = String(value);
  button.click();
  button.dataset[datasetKey] = previous;
}

function moveCameraBy(deltaX, deltaY) {
  syntheticCameraDispatch = true;
  try {
    dispatchCameraAxis("x", deltaX);
    dispatchCameraAxis("y", deltaY);
  } finally {
    syntheticCameraDispatch = false;
  }
}

function bindCardinalCameraControls() {
  document.querySelectorAll("[data-monster-master-pan-x][data-monster-master-pan-y]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (syntheticCameraDispatch) return;
      const rawX = Number(button.dataset.monsterMasterPanX);
      const rawY = Number(button.dataset.monsterMasterPanY);
      if (!rawX && !rawY) return;
      const camera = window.gameFrameMonsterPixi?.getCamera?.();
      if (!camera) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const screenX = rawX < 0 ? -CARDINAL_PAN_X : rawX > 0 ? CARDINAL_PAN_X : 0;
      const screenY = rawY < 0 ? -CARDINAL_PAN_Y : rawY > 0 ? CARDINAL_PAN_Y : 0;
      const delta = screenVectorToCameraDelta(screenX, screenY, camera);
      moveCameraBy(delta.x, delta.y);
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
    const camera = window.gameFrameMonsterPixi?.getCamera?.();
    if (camera) {
      const delta = screenVectorToCameraDelta(-deltaX, -deltaY, camera);
      moveCameraBy(delta.x, delta.y);
    }
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
    const renderer = window.gameFrameMonsterPixi;
    const canvas = document.querySelector("#monster-master-pixi-canvas");
    if (!renderer?.screenToTile || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (
      event.clientX < rect.left
      || event.clientY < rect.top
      || event.clientX > rect.right
      || event.clientY > rect.bottom
    ) return;
    const coordinate = renderer.screenToTile({
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
  const camera = window.gameFrameMonsterPixi?.getCamera?.();
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
});
window.gameFrameMonsterProjection = Object.freeze({
  getCamera: projectionCamera,
  worldToScreen,
  render: () => window.gameFrameMonsterPixi?.render?.(),
});

bindCardinalCameraControls();
bindBattlefieldInput();
