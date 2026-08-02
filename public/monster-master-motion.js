const nativeFetch = window.fetch.bind(window);
const NativeWebSocket = window.WebSocket;
const seenRevisions = new Map();
const seenMoves = new Set();
const moveQueue = [];
const pointers = new Map();

let view = null;
let ui = null;
let hover = null;
let dragging = null;
let pinch = null;
let animating = false;
let renderPending = false;
let syntheticClick = false;
let suppressClick = false;
let internalCameraSync = false;
let spaceHeld = false;
let lastActiveUnitId = null;

const camera = { x: 11.5, y: 11.5, zoom: 1, minZoom: 0.58, maxZoom: 2.45 };
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const key = ({ x, y }) => `${x},${y}`;
const isMonsterView = (candidate) => candidate?.gameId === "monster-master-duel"
  && candidate?.observation?.board?.map
  && Array.isArray(candidate?.observation?.lastEffects);

function diagnostics() {
  try { return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}"); }
  catch { return {}; }
}

function mapOf(candidate = view) { return candidate?.observation?.board?.map ?? null; }
function unitsOf(candidate = view) { return candidate?.observation?.board?.units ?? []; }
function activeUnit(candidate = view) {
  return unitsOf(candidate).find((unit) => unit.id === candidate?.observation?.activeUnitId) ?? null;
}
function unitAt(coordinate, candidate = view) {
  if (!coordinate) return null;
  return unitsOf(candidate).find((unit) => unit.position.x === coordinate.x && unit.position.y === coordinate.y) ?? null;
}
function onMap(coordinate, map = mapOf()) {
  return Boolean(map) && coordinate.x >= 0 && coordinate.y >= 0 && coordinate.x < map.width && coordinate.y < map.height;
}
function clampCamera(candidate = view) {
  const map = mapOf(candidate);
  camera.zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);
  if (!map) return;
  camera.x = clamp(camera.x, -1, map.width);
  camera.y = clamp(camera.y, -1, map.height);
}
function centerOn(coordinate) {
  if (!coordinate) return;
  camera.x = coordinate.x;
  camera.y = coordinate.y;
  clampCamera();
  scheduleRender();
}
function centerField() {
  const map = mapOf();
  if (map) centerOn({ x: (map.width - 1) / 2, y: (map.height - 1) / 2 });
}
function panBy(x, y) {
  camera.x += x;
  camera.y += y;
  clampCamera();
  scheduleRender();
}

function capture(candidate) {
  if (!isMonsterView(candidate)) return;
  const previousRevision = seenRevisions.get(candidate.matchId);
  seenRevisions.set(candidate.matchId, candidate.revision);
  view = candidate;

  if (previousRevision === undefined) {
    const unit = activeUnit(candidate);
    const map = mapOf(candidate);
    camera.x = unit?.position.x ?? (map.width - 1) / 2;
    camera.y = unit?.position.y ?? (map.height - 1) / 2;
    lastActiveUnitId = unit?.id ?? null;
  } else if (candidate.observation.activeUnitId && candidate.observation.activeUnitId !== lastActiveUnitId) {
    const unit = activeUnit(candidate);
    if (unit) {
      camera.x = unit.position.x;
      camera.y = unit.position.y;
      lastActiveUnitId = unit.id;
    }
  }
  clampCamera(candidate);

  if (previousRevision !== undefined && candidate.revision > previousRevision) {
    for (const effect of candidate.observation.lastEffects) {
      if (effect.type !== "unit-moved" || !effect.path?.length) continue;
      const moveKey = `${candidate.matchId}:${candidate.revision}:${effect.unitId}:${effect.path.map(key).join(";")}`;
      if (seenMoves.has(moveKey)) continue;
      seenMoves.add(moveKey);
      moveQueue.push({ candidate, effect });
    }
  }
  scheduleRender();
  void runMoveQueue();
}

window.fetch = async (...args) => {
  const response = await nativeFetch(...args);
  try {
    const clone = response.clone();
    if ((clone.headers.get("content-type") ?? "").includes("application/json")) capture(await clone.json());
  } catch { /* Presentation observation never changes request authority. */ }
  return response;
};

if (NativeWebSocket) {
  class ProjectionAwareWebSocket extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message?.type === "match_state") capture(message.view);
        } catch { /* Ignore non-state messages. */ }
      });
    }
  }
  window.WebSocket = ProjectionAwareWebSocket;
}

function layout() {
  if (!ui) return null;
  const rect = ui.primary.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const tileWidth = clamp(Math.min(width / 10.5, height / 6.4), 44, 92) * camera.zoom;
  return {
    width,
    height,
    tileWidth,
    tileHeight: tileWidth / 2,
    halfWidth: tileWidth / 2,
    halfHeight: tileWidth / 4,
    originX: width / 2,
    originY: height * 0.47,
  };
}
function elevation(cell) { return Number(cell?.elevation ?? cell?.height ?? 0); }
function worldToScreen(coordinate, frame = layout(), z = 0) {
  if (!frame) return { x: 0, y: 0 };
  const x = coordinate.x - camera.x;
  const y = coordinate.y - camera.y;
  return {
    x: frame.originX + (x - y) * frame.halfWidth,
    y: frame.originY + (x + y) * frame.halfHeight - z * frame.tileHeight * 0.88,
  };
}
function screenToWorld(point, frame = layout()) {
  if (!frame) return { x: 0, y: 0 };
  const x = (point.x - frame.originX) / frame.halfWidth;
  const y = (point.y - frame.originY) / frame.halfHeight;
  return { x: camera.x + (x + y) / 2, y: camera.y + (y - x) / 2 };
}
function screenToTile(point, frame = layout(), candidate = view) {
  const map = mapOf(candidate);
  if (!frame || !map) return null;

  for (const unit of [...unitsOf(candidate)].sort((a, b) => b.position.x + b.position.y - a.position.x - a.position.y)) {
    const cell = map.cells[unit.position.y * map.width + unit.position.x];
    const base = worldToScreen(unit.position, frame, elevation(cell));
    const dx = Math.abs(point.x - base.x) / Math.max(18, frame.tileWidth * 0.34);
    const dy = Math.abs(point.y - (base.y - frame.tileHeight * 0.82)) / Math.max(24, frame.tileHeight * 1.12);
    if (dx * dx + dy * dy <= 1) return { ...unit.position };
  }

  const world = screenToWorld(point, frame);
  const rounded = { x: Math.round(world.x), y: Math.round(world.y) };
  let best = null;
  let distance = Infinity;
  for (let y = rounded.y - 1; y <= rounded.y + 1; y += 1) {
    for (let x = rounded.x - 1; x <= rounded.x + 1; x += 1) {
      const coordinate = { x, y };
      if (!onMap(coordinate, map)) continue;
      const center = worldToScreen(coordinate, frame);
      const next = Math.abs(point.x - center.x) / frame.halfWidth + Math.abs(point.y - center.y) / frame.halfHeight;
      if (next <= 1.06 && next < distance) { best = coordinate; distance = next; }
    }
  }
  return best;
}

function resize(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}
function diamond(context, point, frame, inset = 0) {
  const halfWidth = frame.halfWidth - inset;
  const halfHeight = frame.halfHeight - inset / 2;
  context.beginPath();
  context.moveTo(point.x, point.y - halfHeight);
  context.lineTo(point.x + halfWidth, point.y);
  context.lineTo(point.x, point.y + halfHeight);
  context.lineTo(point.x - halfWidth, point.y);
  context.closePath();
}
function palette(cell, coordinate) {
  if (cell.terrain === "wall") return ["#394a60", "#202d3d", "#172231"];
  if (cell.terrain === "difficult") return [(coordinate.x + coordinate.y) % 2 ? "#505946" : "#48513e", "#30382b", "#273025"];
  if (cell.terrain === "objective") return ["#7b5a2b", "#4e371c", "#3d2a16"];
  return [(coordinate.x + coordinate.y) % 2 ? "#2a405d" : "#243852", "#17273a", "#122034"];
}
function actionDestination(action) {
  if (action.type === "deploy-unit") return action.position;
  if (action.type === "move") return action.path.at(-1);
  if (action.type === "attack" || action.type === "use-ability") return action.target;
  return null;
}
function actionsByTile(candidate, state) {
  const result = new Map();
  if (!state.actionMode) return result;
  for (const action of candidate.observation.legalActions ?? []) {
    if (action.type !== state.actionMode) continue;
    if (action.type === "deploy-unit" && action.unitId !== state.selectedUnitId) continue;
    const destination = actionDestination(action);
    if (destination) result.set(key(destination), action);
  }
  return result;
}
function actionAt(coordinate, candidate = view, state = diagnostics()) {
  if (!coordinate || !candidate) return null;
  return candidate.observation.legalActions?.find((action) => {
    if (state.actionMode && action.type !== state.actionMode) return false;
    if (action.type === "deploy-unit" && action.unitId !== state.selectedUnitId) return false;
    const destination = actionDestination(action);
    return destination?.x === coordinate.x && destination?.y === coordinate.y;
  }) ?? null;
}
function interaction(coordinate, candidate = view, state = diagnostics()) {
  if (!coordinate) return "none";
  if (actionAt(coordinate, candidate, state)) return "action";
  return unitAt(coordinate, candidate) ? "unit" : "none";
}
function actionFill(action) {
  if (action?.type === "deploy-unit") return "rgba(255,207,110,.38)";
  if (action?.type === "move") return "rgba(88,207,255,.34)";
  if (action?.type === "use-ability") return "rgba(99,232,165,.32)";
  return "rgba(255,90,139,.32)";
}

function drawCell(context, candidate, coordinate, cell, frame, highlights) {
  const point = worldToScreen(coordinate, frame, elevation(cell));
  const colors = palette(cell, coordinate);
  const wallHeight = cell.terrain === "wall" ? frame.tileHeight * 0.82 : 0;
  const top = { x: point.x, y: point.y - wallHeight };

  if (wallHeight) {
    context.fillStyle = colors[1];
    context.beginPath();
    context.moveTo(point.x - frame.halfWidth, point.y);
    context.lineTo(point.x, point.y + frame.halfHeight);
    context.lineTo(point.x, top.y + frame.halfHeight);
    context.lineTo(point.x - frame.halfWidth, top.y);
    context.closePath();
    context.fill();
    context.fillStyle = colors[2];
    context.beginPath();
    context.moveTo(point.x + frame.halfWidth, point.y);
    context.lineTo(point.x, point.y + frame.halfHeight);
    context.lineTo(point.x, top.y + frame.halfHeight);
    context.lineTo(point.x + frame.halfWidth, top.y);
    context.closePath();
    context.fill();
  }

  diamond(context, top, frame);
  context.fillStyle = colors[0];
  context.fill();
  context.strokeStyle = "rgba(190,215,248,.18)";
  context.lineWidth = 1;
  context.stroke();

  const highlighted = highlights.get(key(coordinate));
  if (highlighted) {
    diamond(context, top, frame, 3);
    context.fillStyle = actionFill(highlighted);
    context.fill();
    context.strokeStyle = "rgba(233,248,255,.5)";
    context.stroke();
  }
  if (hover?.x === coordinate.x && hover?.y === coordinate.y) {
    diamond(context, top, frame, 2);
    context.fillStyle = "rgba(255,255,255,.08)";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.8)";
    context.stroke();
  }
  if (cell.terrain === "difficult" && !wallHeight) {
    context.strokeStyle = "rgba(216,233,188,.34)";
    for (const offset of [-.2, 0, .2]) {
      context.beginPath();
      context.moveTo(point.x + frame.tileWidth * offset, point.y + frame.tileHeight * .14);
      context.lineTo(point.x + frame.tileWidth * (offset - .03), point.y - frame.tileHeight * .18);
      context.stroke();
    }
  }
}

function drawUnit(context, candidate, unit, position, frame, lift = 0) {
  const alpha = unit.ownerId === candidate.playerIds[0];
  const point = worldToScreen(position, frame);
  const scale = clamp(frame.tileWidth / 76, .72, 1.45);
  const y = point.y - frame.tileHeight * (.34 + lift * .25);

  context.save();
  context.translate(point.x, y);
  context.scale(scale, scale);
  context.fillStyle = "rgba(3,7,13,.45)";
  context.beginPath(); context.ellipse(0, 18, 22, 8, 0, 0, Math.PI * 2); context.fill();
  context.shadowColor = alpha ? "rgba(75,173,255,.58)" : "rgba(255,91,143,.54)";
  context.shadowBlur = unit.id === candidate.observation.activeUnitId ? 18 : 8;
  context.fillStyle = alpha ? "#3e91e8" : "#d04f78";
  context.beginPath();
  if (unit.role === "master") {
    context.moveTo(-20, 14); context.lineTo(-12, -22); context.lineTo(0, -38); context.lineTo(12, -22); context.lineTo(20, 14); context.closePath();
  } else if (unit.role === "emberling") {
    context.moveTo(0, -43); context.bezierCurveTo(20, -22, 18, 2, 0, 22); context.bezierCurveTo(-18, 2, -20, -22, 0, -43); context.closePath();
  } else {
    context.ellipse(0, -5, 24, 29, 0, 0, Math.PI * 2);
  }
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = alpha ? "#b9e1ff" : "#ffc0d0";
  context.beginPath(); context.arc(0, -34, 9, 0, Math.PI * 2); context.fill();
  context.restore();

  if (unit.id === candidate.observation.activeUnitId || unit.id === diagnostics().selectedUnitId) {
    context.strokeStyle = unit.id === diagnostics().selectedUnitId ? "#ffd06e" : "#eefaff";
    context.lineWidth = Math.max(2, frame.tileWidth * .035);
    context.beginPath(); context.ellipse(point.x, point.y, frame.tileWidth * .34, frame.tileHeight * .22, 0, 0, Math.PI * 2); context.stroke();
  }
  const health = clamp(unit.health / unit.maxHealth, 0, 1);
  const barWidth = clamp(frame.tileWidth * .68, 34, 88);
  const barY = y - clamp(frame.tileHeight * 1.55, 46, 78);
  context.fillStyle = "rgba(3,7,13,.86)"; context.fillRect(point.x - barWidth / 2, barY, barWidth, 6);
  context.fillStyle = health > .45 ? "#6ee0a5" : "#ff9671"; context.fillRect(point.x - barWidth / 2, barY, barWidth * health, 6);
}

function drawPreview(context, candidate, frame, state) {
  const action = actionAt(hover, candidate, state);
  if (!action) return;
  if (action.type === "move") {
    context.strokeStyle = "rgba(255,210,111,.95)";
    context.lineWidth = Math.max(3, frame.tileWidth * .055);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    [action.from, ...action.path].forEach((coordinate, index) => {
      const point = worldToScreen(coordinate, frame);
      if (index) context.lineTo(point.x, point.y - frame.tileHeight * .12);
      else context.moveTo(point.x, point.y - frame.tileHeight * .12);
    });
    context.stroke();
  } else if (action.type === "attack" || action.type === "use-ability") {
    const from = worldToScreen(action.from, frame);
    const target = worldToScreen(action.target, frame);
    context.strokeStyle = action.type === "use-ability" ? "rgba(112,232,174,.96)" : "rgba(255,104,145,.96)";
    context.lineWidth = Math.max(3, frame.tileWidth * .045);
    context.setLineDash([8, 6]);
    context.beginPath(); context.moveTo(from.x, from.y - frame.tileHeight * .7); context.lineTo(target.x, target.y - frame.tileHeight * .7); context.stroke();
    context.setLineDash([]);
  }
}

function render({ candidate = view, moving = null } = {}) {
  if (!ui || !candidate) return;
  const frame = layout();
  const context = resize(ui.overlay, frame.width, frame.height);
  const map = mapOf(candidate);
  const state = diagnostics();
  const highlights = actionsByTile(candidate, state);
  const gradient = context.createLinearGradient(0, 0, 0, frame.height);
  gradient.addColorStop(0, "#10192a"); gradient.addColorStop(.58, "#080e19"); gradient.addColorStop(1, "#050810");
  context.fillStyle = gradient; context.fillRect(0, 0, frame.width, frame.height);

  const cells = [];
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const coordinate = { x, y };
    const point = worldToScreen(coordinate, frame);
    if (point.x > -frame.tileWidth * 2 && point.x < frame.width + frame.tileWidth * 2
      && point.y > -frame.tileHeight * 4 && point.y < frame.height + frame.tileHeight * 4) {
      cells.push({ coordinate, cell: map.cells[y * map.width + x] });
    }
  }
  cells.sort((a, b) => a.coordinate.x + a.coordinate.y - b.coordinate.x - b.coordinate.y || a.coordinate.x - b.coordinate.x);
  for (const entry of cells) drawCell(context, candidate, entry.coordinate, entry.cell, frame, highlights);
  drawPreview(context, candidate, frame, state);

  const units = unitsOf(candidate)
    .filter((unit) => unit.id !== moving?.unit.id)
    .map((unit) => ({ unit, position: unit.position, lift: 0 }))
    .concat(moving ? [moving] : [])
    .sort((a, b) => a.position.x + a.position.y - b.position.x - b.position.y || a.position.x - b.position.x);
  for (const entry of units) drawUnit(context, candidate, entry.unit, entry.position, frame, entry.lift);

  ui.overlay.dataset.projection = "dimetric";
  ui.overlay.dataset.actionable = String(interaction(hover, candidate, state) !== "none");
  ui.primary.dataset.projection = "dimetric";
}
function scheduleRender() {
  if (renderPending || animating) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; if (!animating) render(); });
}
function interpolate(path, progress) {
  const segments = path.length - 1;
  const scaled = Math.min(segments - Number.EPSILON, Math.max(0, progress * segments));
  const index = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - index;
  return {
    x: path[index].x + (path[index + 1].x - path[index].x) * local,
    y: path[index].y + (path[index + 1].y - path[index].y) * local,
    lift: Math.sin(local * Math.PI),
  };
}
async function animateMove(candidate, effect) {
  const path = [effect.from, ...effect.path];
  const unit = unitsOf(candidate).find((item) => item.id === effect.unitId);
  if (!unit || path.length < 2) return;
  ui.primary.dataset.lastAnimationSteps = String(path.length - 1);
  ui.primary.dispatchEvent(new CustomEvent("gameframe:monster-animation", {
    bubbles: true,
    detail: { unitId: effect.unitId, path: path.map((coordinate) => ({ ...coordinate })) },
  }));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { render({ candidate }); return; }
  ui.frame.dataset.animating = "true";
  const duration = Math.min(1700, Math.max(320, (path.length - 1) * 155));
  const started = performance.now();
  try {
    await new Promise((resolve) => {
      const step = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        const position = interpolate(path, progress);
        render({ candidate, moving: { unit, position, lift: position.lift } });
        if (progress < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  } finally { ui.frame.dataset.animating = "false"; render(); }
}
async function runMoveQueue() {
  if (animating || !ui) return;
  animating = true;
  try { while (moveQueue.length) { const next = moveQueue.shift(); await animateMove(next.candidate, next.effect); } }
  finally { animating = false; scheduleRender(); }
}

function originalBounds() { return diagnostics().viewport?.bounds ?? null; }
function visible(coordinate, bounds) {
  return Boolean(bounds) && coordinate.x >= bounds.x && coordinate.y >= bounds.y
    && coordinate.x < bounds.x + bounds.columns && coordinate.y < bounds.y + bounds.rows;
}
function clickControl(selector) {
  const button = document.querySelector(selector);
  if (!button) return;
  internalCameraSync = true;
  try { button.click(); } finally { internalCameraSync = false; }
}
function makeOriginalVisible(coordinate) {
  let bounds = originalBounds();
  for (let step = 0; bounds && !visible(coordinate, bounds) && step < 20; step += 1) {
    if (coordinate.x < bounds.x) clickControl('[data-monster-master-pan-x="-3"][data-monster-master-pan-y="0"]');
    else if (coordinate.x >= bounds.x + bounds.columns) clickControl('[data-monster-master-pan-x="3"][data-monster-master-pan-y="0"]');
    else if (coordinate.y < bounds.y) clickControl('[data-monster-master-pan-x="0"][data-monster-master-pan-y="-3"]');
    else clickControl('[data-monster-master-pan-x="0"][data-monster-master-pan-y="3"]');
    bounds = originalBounds();
  }
  return visible(coordinate, bounds);
}
function squareHit(point) {
  const bounds = originalBounds();
  if (!ui || !bounds) return null;
  const rect = ui.primary.getBoundingClientRect();
  const size = Math.min(rect.width / bounds.columns, rect.height / bounds.rows);
  const originX = (rect.width - size * bounds.columns) / 2;
  const originY = (rect.height - size * bounds.rows) / 2;
  const coordinate = { x: bounds.x + Math.floor((point.x - originX) / size), y: bounds.y + Math.floor((point.y - originY) / size) };
  if (!visible(coordinate, bounds)) return null;
  const center = {
    x: originX + (coordinate.x - bounds.x + .5) * size,
    y: originY + (coordinate.y - bounds.y + .5) * size,
  };
  return { coordinate, centerDistance: Math.hypot(point.x - center.x, point.y - center.y) };
}
function dispatchCoordinate(coordinate) {
  if (!ui || !makeOriginalVisible(coordinate)) return;
  const bounds = originalBounds();
  const rect = ui.primary.getBoundingClientRect();
  const size = Math.min(rect.width / bounds.columns, rect.height / bounds.rows);
  const originX = (rect.width - size * bounds.columns) / 2;
  const originY = (rect.height - size * bounds.rows) / 2;
  syntheticClick = true;
  try {
    ui.primary.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: rect.left + originX + (coordinate.x - bounds.x + .5) * size,
      clientY: rect.top + originY + (coordinate.y - bounds.y + .5) * size,
    }));
  } finally { syntheticClick = false; }
}
function localPoint(event) {
  const rect = ui.primary.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function zoomAt(nextZoom, point) {
  const anchor = screenToWorld(point);
  camera.zoom = clamp(nextZoom, camera.minZoom, camera.maxZoom);
  const after = screenToWorld(point);
  camera.x += anchor.x - after.x;
  camera.y += anchor.y - after.y;
  clampCamera();
  scheduleRender();
}
function distance(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

function pointerDown(event) {
  const point = localPoint(event);
  pointers.set(event.pointerId, point);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { distance: Math.max(1, distance(a, b)), zoom: camera.zoom, anchor: screenToWorld(midpoint(a, b)) };
    dragging = null;
    suppressClick = true;
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  const coordinate = screenToTile(point);
  const canDrag = event.button === 1 || spaceHeld || (event.button === 0 && !unitAt(coordinate));
  dragging = { id: event.pointerId, start: point, startX: camera.x, startY: camera.y, canDrag, moved: false };
  if (canDrag) ui.primary.setPointerCapture?.(event.pointerId);
}
function pointerMove(event) {
  const point = localPoint(event);
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const center = midpoint(a, b);
    camera.zoom = clamp(pinch.zoom * distance(a, b) / pinch.distance, camera.minZoom, camera.maxZoom);
    const after = screenToWorld(center);
    camera.x += pinch.anchor.x - after.x;
    camera.y += pinch.anchor.y - after.y;
    clampCamera();
    scheduleRender();
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (dragging?.id === event.pointerId && dragging.canDrag) {
    const dx = point.x - dragging.start.x;
    const dy = point.y - dragging.start.y;
    if (!dragging.moved && Math.hypot(dx, dy) >= 7) {
      dragging.moved = true;
      suppressClick = true;
      ui.frame.dataset.dragging = "true";
    }
    if (dragging.moved) {
      const frame = layout();
      camera.x = dragging.startX - (dx / frame.halfWidth + dy / frame.halfHeight) / 2;
      camera.y = dragging.startY - (dy / frame.halfHeight - dx / frame.halfWidth) / 2;
      clampCamera();
      scheduleRender();
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
  }
  hover = screenToTile(point);
  scheduleRender();
  event.stopImmediatePropagation();
}
function pointerUp(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (dragging?.id === event.pointerId) {
    if (dragging.moved) { event.preventDefault(); event.stopImmediatePropagation(); }
    dragging = null;
    ui.frame.dataset.dragging = "false";
  }
}
function projectedClick(event) {
  if (syntheticClick) return;
  if (suppressClick) {
    suppressClick = false;
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (!view || animating) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  const point = localPoint(event);
  const projected = screenToTile(point);
  const legacySquareHit = squareHit(point);
  const square = legacySquareHit?.coordinate ?? null;
  const state = diagnostics();
  const squareKind = interaction(square, view, state);
  if (squareKind !== "none" && legacySquareHit.centerDistance <= 2) return;
  if (interaction(projected, view, state) === "none" && squareKind !== "none") return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (projected) dispatchCoordinate(projected);
}
function wheel(event) {
  if (!view) return;
  event.preventDefault(); event.stopImmediatePropagation();
  zoomAt(camera.zoom * Math.exp(-event.deltaY * .0016), localPoint(event));
}

function bindControls() {
  for (const button of document.querySelectorAll("[data-monster-master-pan-x][data-monster-master-pan-y]")) {
    button.addEventListener("click", () => {
      if (!internalCameraSync) panBy(Number(button.dataset.monsterMasterPanX), Number(button.dataset.monsterMasterPanY));
    });
  }
  document.querySelector("#monster-master-center-field")?.addEventListener("click", () => { if (!internalCameraSync) centerField(); });
  document.querySelector("#monster-master-center-active")?.addEventListener("click", () => { if (!internalCameraSync) centerOn(activeUnit()?.position); });
  document.querySelector("#monster-master-zoom-in")?.addEventListener("click", () => { if (!internalCameraSync) zoomAt(camera.zoom + .25, { x: layout().originX, y: layout().originY }); });
  document.querySelector("#monster-master-zoom-out")?.addEventListener("click", () => { if (!internalCameraSync) zoomAt(camera.zoom - .25, { x: layout().originX, y: layout().originY }); });
}
function bindKeyboard() {
  window.addEventListener("keydown", (event) => { if (event.code === "Space") spaceHeld = true; });
  window.addEventListener("keyup", (event) => { if (event.code === "Space") spaceHeld = false; });
  ui.primary.addEventListener("keydown", (event) => {
    const movement = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
    if (movement) panBy(...movement);
    else if (event.key === "+" || event.key === "=") zoomAt(camera.zoom + .25, { x: layout().originX, y: layout().originY });
    else if (event.key === "-" || event.key === "_") zoomAt(camera.zoom - .25, { x: layout().originX, y: layout().originY });
    else if (event.key.toLowerCase() === "a") centerOn(activeUnit()?.position);
    else if (event.key === "0" || event.key === "Home") centerField();
  }, true);
}

function initialize() {
  const frame = document.querySelector(".combat-canvas-frame");
  const primary = document.querySelector("#monster-master-canvas");
  if (!frame || !primary) return;
  let overlay = frame.querySelector("#monster-master-motion-canvas");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "monster-master-motion-canvas";
    overlay.setAttribute("aria-hidden", "true");
    frame.append(overlay);
  }
  ui = { frame, primary, overlay };
  frame.dataset.projectionReady = "true";
  frame.dataset.dragging = "false";
  primary.dataset.projection = "dimetric";
  overlay.dataset.projection = "dimetric";

  primary.addEventListener("pointerdown", pointerDown, true);
  primary.addEventListener("pointermove", pointerMove, true);
  primary.addEventListener("pointerup", pointerUp, true);
  primary.addEventListener("pointercancel", pointerUp, true);
  primary.addEventListener("pointerleave", (event) => { if (!dragging?.moved) { hover = null; scheduleRender(); } event.stopImmediatePropagation(); }, true);
  primary.addEventListener("click", projectedClick, true);
  primary.addEventListener("wheel", wheel, { capture: true, passive: false });
  primary.addEventListener("dblclick", (event) => { event.preventDefault(); event.stopImmediatePropagation(); centerOn(activeUnit()?.position); }, true);
  primary.addEventListener("contextmenu", (event) => event.preventDefault());
  bindControls();
  bindKeyboard();

  const detailNode = document.querySelector("#monster-master-details");
  if (detailNode) new MutationObserver(scheduleRender).observe(detailNode, { childList: true, subtree: true, characterData: true });
  new ResizeObserver(scheduleRender).observe(primary);
  scheduleRender();
  void runMoveQueue();
}

window.gameFrameMonsterProjection = {
  getCamera: () => ({ centerX: camera.x, centerY: camera.y, zoom: camera.zoom }),
  worldToScreen: (coordinate) => worldToScreen(coordinate),
  screenToWorld: (point) => screenToWorld(point),
  screenToTile: (point) => screenToTile(point),
  centerOn,
  render,
};

initialize();
