const stylesheetUrl = "/monster-master-terrain-depth.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const TILE_WIDTH = 72;
const TILE_HEIGHT = 36;
const WALL_DEPTH = 29;
const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

let latestView = null;
let renderPending = false;
let stats = { wallCount: 0, renderedFaces: 0, culledFaces: 0 };

function ensureCanvas() {
  const frame = document.querySelector(".combat-canvas-frame");
  if (!frame) return null;
  let canvas = frame.querySelector("#monster-master-terrain-depth-canvas");
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.id = "monster-master-terrain-depth-canvas";
  canvas.className = "monster-master-terrain-depth-canvas";
  canvas.setAttribute("aria-hidden", "true");
  frame.append(canvas);
  return canvas;
}

function resizeCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 900 ? 1.25 : 1.5);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.imageSmoothingEnabled = true;
  return { context, width, height };
}

function cellAt(map, coordinate) {
  if (
    coordinate.x < 0
    || coordinate.y < 0
    || coordinate.x >= map.width
    || coordinate.y >= map.height
  ) return null;
  return map.cells[coordinate.y * map.width + coordinate.x] ?? null;
}

function wallCoordinates(view) {
  const map = view?.observation?.board?.map;
  if (!map) return [];
  const coordinates = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (cellAt(map, { x, y })?.terrain === "wall") coordinates.push({ x, y });
    }
  }
  return coordinates;
}

function polygon(context, points, fillStyle, strokeStyle) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
  context.strokeStyle = strokeStyle;
  context.lineWidth = 1;
  context.stroke();
}

function interpolate(from, to, amount) {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

function drawStoneSeams(context, topA, topB, lowerA, lowerB, coordinate, zoom) {
  const first = 0.38 + ((coordinate.x * 7 + coordinate.y * 3) % 7) * 0.012;
  const second = 0.72 + ((coordinate.x * 5 + coordinate.y * 11) % 5) * 0.014;
  context.strokeStyle = "rgba(210, 205, 170, .15)";
  context.lineWidth = Math.max(0.75, zoom * 0.75);
  for (const amount of [first, second]) {
    const from = interpolate(topA, lowerA, amount);
    const to = interpolate(topB, lowerB, amount);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  const seam = 0.34 + ((coordinate.x + coordinate.y) % 3) * 0.16;
  const upper = interpolate(topA, topB, seam);
  const lower = interpolate(lowerA, lowerB, seam + 0.08);
  context.strokeStyle = "rgba(37, 44, 41, .28)";
  context.beginPath();
  context.moveTo(upper.x, upper.y + 2 * zoom);
  context.lineTo(lower.x, lower.y - 2 * zoom);
  context.stroke();
}

function drawExposedFace(context, center, side, coordinate, zoom) {
  const halfWidth = TILE_WIDTH * 0.5 * zoom;
  const halfHeight = TILE_HEIGHT * 0.54 * zoom;
  const depth = WALL_DEPTH * zoom;
  const left = { x: center.x - halfWidth, y: center.y };
  const front = { x: center.x, y: center.y + halfHeight };
  const right = { x: center.x + halfWidth, y: center.y };
  const topA = side === "left" ? left : front;
  const topB = side === "left" ? front : right;
  const lowerA = { x: topA.x, y: topA.y + depth };
  const lowerB = { x: topB.x, y: topB.y + depth };

  const gradient = context.createLinearGradient(0, Math.min(topA.y, topB.y), 0, Math.max(lowerA.y, lowerB.y));
  if (side === "left") {
    gradient.addColorStop(0, "rgba(103, 107, 91, .98)");
    gradient.addColorStop(0.5, "rgba(72, 79, 70, .99)");
    gradient.addColorStop(1, "rgba(43, 50, 46, 1)");
  } else {
    gradient.addColorStop(0, "rgba(86, 94, 84, .98)");
    gradient.addColorStop(0.52, "rgba(60, 69, 63, .99)");
    gradient.addColorStop(1, "rgba(36, 43, 41, 1)");
  }

  context.save();
  context.shadowColor = "rgba(0, 0, 0, .34)";
  context.shadowBlur = 5 * zoom;
  context.shadowOffsetY = 4 * zoom;
  polygon(context, [topA, topB, lowerB, lowerA], gradient, "rgba(170, 168, 137, .32)");
  context.restore();
  drawStoneSeams(context, topA, topB, lowerA, lowerB, coordinate, zoom);

  context.strokeStyle = "rgba(213, 207, 169, .28)";
  context.lineWidth = Math.max(1, zoom);
  context.beginPath();
  context.moveTo(topA.x, topA.y);
  context.lineTo(topB.x, topB.y);
  context.stroke();
}

function renderDepth() {
  renderPending = false;
  const canvas = ensureCanvas();
  const bridge = window.gameFrameMonsterPixiBridge;
  const camera = window.gameFrameMonsterPixi?.getCamera?.();
  const map = latestView?.observation?.board?.map;
  if (!canvas || !latestView || !bridge?.worldToScreen || !camera || !map) return;

  const { context, width, height } = resizeCanvas(canvas);
  context.clearRect(0, 0, width, height);
  const walls = wallCoordinates(latestView)
    .map((coordinate) => ({ coordinate, point: bridge.worldToScreen(coordinate) }))
    .filter((entry) => entry.point)
    .sort((left, right) => left.point.y - right.point.y || left.point.x - right.point.x);

  let renderedFaces = 0;
  let culledFaces = 0;
  for (const { coordinate, point } of walls) {
    if (point.x < -120 || point.y < -120 || point.x > width + 120 || point.y > height + 120) continue;
    const frontNeighbors = NEIGHBORS
      .map((offset) => {
        const neighbor = { x: coordinate.x + offset.x, y: coordinate.y + offset.y };
        const neighborPoint = bridge.worldToScreen(neighbor);
        return { neighbor, point: neighborPoint };
      })
      .filter((entry) => entry.point && entry.point.y > point.y + 0.5)
      .sort((left, right) => left.point.x - right.point.x);

    for (const entry of frontNeighbors) {
      if (cellAt(map, entry.neighbor)?.terrain === "wall") {
        culledFaces += 1;
        continue;
      }
      drawExposedFace(context, point, entry.point.x < point.x ? "left" : "right", coordinate, camera.zoom);
      renderedFaces += 1;
    }
  }
  stats = { wallCount: walls.length, renderedFaces, culledFaces };
}

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => requestAnimationFrame(renderDepth));
}

function capture(candidate) {
  const view = candidate?.gameId === "monster-master-duel"
    ? candidate
    : candidate?.view?.gameId === "monster-master-duel"
      ? candidate.view
      : null;
  if (!view) return;
  latestView = view;
  scheduleRender();
}

window.addEventListener("gameframe:monster-master-pixi-view", (event) => capture(event.detail?.view));
window.addEventListener("resize", scheduleRender);
window.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(event.code)) scheduleRender();
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest(".monster-master-camera-dock")) scheduleRender();
}, true);
const frame = document.querySelector(".combat-canvas-frame");
frame?.addEventListener("wheel", scheduleRender, { passive: true });
frame?.addEventListener("pointermove", (event) => {
  if (event.buttons === 1) scheduleRender();
});
frame?.addEventListener("pointerup", scheduleRender);
queueMicrotask(() => {
  const current = window.gameFrameMonsterController?.getView?.();
  if (current) capture(current);
});

window.gameFrameMonsterTerrainDepth = Object.freeze({
  capture,
  render: scheduleRender,
  getStats: () => ({ ...stats }),
});
