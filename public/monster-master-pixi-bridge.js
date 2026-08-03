window.gameFrameMonsterRendererMode = "pixi";
const stylesheetUrl = "/monster-master-pixi.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const coordinateEvent = "gameframe:monster-master-coordinate";

function rotateCoordinate(coordinate, map, quarter) {
  const maxX = map.width - 1;
  const maxY = map.height - 1;
  switch (((quarter % 4) + 4) % 4) {
    case 1: return { x: maxY - coordinate.y, y: coordinate.x };
    case 2: return { x: maxX - coordinate.x, y: maxY - coordinate.y };
    case 3: return { x: coordinate.y, y: maxX - coordinate.x };
    default: return { x: coordinate.x, y: coordinate.y };
  }
}

function project(coordinate, map, quarter) {
  const rotated = rotateCoordinate(coordinate, map, quarter);
  return {
    x: (rotated.x - rotated.y) * 36,
    y: (rotated.x + rotated.y) * 18,
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

function bindBattlefieldInput() {
  const frame = document.querySelector(".combat-canvas-frame");
  if (!frame || frame.dataset.pixiInputBound === "true") return;
  frame.dataset.pixiInputBound = "true";
  frame.addEventListener("click", (event) => {
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

bindBattlefieldInput();
