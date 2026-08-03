const stylesheetUrl = "/monster-master-pixi.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const coordinateEvent = "gameframe:monster-master-coordinate";
let lastDispatchKey = "";
let lastDispatchTime = -Infinity;

function diagnostics() {
  try {
    return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
  } catch {
    return {};
  }
}

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

function dispatchLegacyCoordinate(coordinate) {
  const key = `${coordinate.x},${coordinate.y}`;
  const now = performance.now();
  if (key === lastDispatchKey && now - lastDispatchTime < 40) return true;

  const canvas = document.querySelector("#monster-master-canvas");
  const state = diagnostics();
  const bounds = state.viewport?.bounds;
  if (!canvas || !bounds) return false;
  if (
    coordinate.x < bounds.x
    || coordinate.y < bounds.y
    || coordinate.x >= bounds.x + bounds.columns
    || coordinate.y >= bounds.y + bounds.rows
  ) {
    return false;
  }

  const rect = canvas.getBoundingClientRect();
  const cellSize = Math.min(rect.width / bounds.columns, rect.height / bounds.rows);
  const boardWidth = cellSize * bounds.columns;
  const boardHeight = cellSize * bounds.rows;
  const originX = (rect.width - boardWidth) / 2;
  const originY = (rect.height - boardHeight) / 2;
  const localX = originX + (coordinate.x - bounds.x + 0.5) * cellSize;
  const localY = originY + (coordinate.y - bounds.y + 0.5) * cellSize;

  lastDispatchKey = key;
  lastDispatchTime = now;
  canvas.dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    clientX: rect.left + localX,
    clientY: rect.top + localY,
  }));
  return true;
}

function reportUnavailableCoordinate() {
  const status = document.querySelector("#monster-master-status");
  if (status) status.textContent = "Center the battlefield closer to that action, then select it again.";
}

window.addEventListener(coordinateEvent, (event) => {
  const coordinate = event.detail?.coordinate;
  if (!coordinate) return;
  if (!dispatchLegacyCoordinate(coordinate)) reportUnavailableCoordinate();
});

const battlefieldFrame = document.querySelector(".combat-canvas-frame");
battlefieldFrame?.addEventListener("click", (event) => {
  const pixiCanvas = document.querySelector("#monster-master-pixi-canvas");
  if (!pixiCanvas || !window.gameFrameMonsterPixi?.screenToTile) return;
  const rect = pixiCanvas.getBoundingClientRect();
  const coordinate = window.gameFrameMonsterPixi.screenToTile({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
  if (coordinate && !dispatchLegacyCoordinate(coordinate)) reportUnavailableCoordinate();
});

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

const bridge = Object.freeze({
  worldToScreen,
  dispatchCoordinate: dispatchLegacyCoordinate,
});
window.gameFrameMonsterPixiBridge = bridge;
window.gameFrameMonsterProjection = Object.freeze({
  getCamera: projectionCamera,
  worldToScreen,
  render: () => window.gameFrameMonsterPixi?.render?.(),
});
