const stylesheetUrl = "/monster-master-terrain-depth.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

let latestView = null;
let renderPending = false;
let stats = { wallCount: 0, renderedFaces: 0 };

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
  return { context, width, height };
}

function wallCoordinates(view) {
  const map = view?.observation?.board?.map;
  if (!map) return [];
  const coordinates = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const cell = map.cells[y * map.width + x];
      if (cell?.terrain === "wall") coordinates.push({ x, y });
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

function drawWallDepth(context, center, zoom) {
  const halfWidth = 31 * zoom;
  const halfHeight = 13 * zoom;
  const depth = 34 * zoom;
  const shoulder = center.y + halfHeight * 0.18;
  const left = { x: center.x - halfWidth, y: shoulder };
  const right = { x: center.x + halfWidth, y: shoulder };
  const front = { x: center.x, y: center.y + halfHeight };
  const lowerLeft = { x: left.x, y: left.y + depth };
  const lowerRight = { x: right.x, y: right.y + depth };
  const lowerFront = { x: front.x, y: front.y + depth };

  polygon(context, [left, front, lowerFront, lowerLeft], "rgba(41, 48, 34, .94)", "rgba(172, 154, 103, .28)");
  polygon(context, [front, right, lowerRight, lowerFront], "rgba(25, 31, 27, .96)", "rgba(145, 132, 92, .24)");

  context.strokeStyle = "rgba(224, 199, 132, .18)";
  context.lineWidth = Math.max(1, zoom);
  context.beginPath();
  context.moveTo(left.x, left.y);
  context.lineTo(front.x, front.y);
  context.lineTo(right.x, right.y);
  context.stroke();
}

function renderDepth() {
  renderPending = false;
  const canvas = ensureCanvas();
  const bridge = window.gameFrameMonsterPixiBridge;
  const camera = window.gameFrameMonsterPixi?.getCamera?.();
  if (!canvas || !latestView || !bridge?.worldToScreen || !camera) return;

  const { context, width, height } = resizeCanvas(canvas);
  context.clearRect(0, 0, width, height);
  const walls = wallCoordinates(latestView)
    .map((coordinate) => ({ coordinate, point: bridge.worldToScreen(coordinate) }))
    .filter((entry) => entry.point)
    .sort((left, right) => left.point.y - right.point.y || left.point.x - right.point.x);

  let renderedFaces = 0;
  for (const { point } of walls) {
    if (point.x < -100 || point.y < -100 || point.x > width + 100 || point.y > height + 100) continue;
    drawWallDepth(context, point, camera.zoom);
    renderedFaces += 2;
  }
  stats = { wallCount: walls.length, renderedFaces };
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
