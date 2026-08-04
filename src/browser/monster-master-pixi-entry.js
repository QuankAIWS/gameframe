import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";

const GAME_ID = "monster-master-duel";
const TERRAIN_ATLAS = "/assets/monster-master/terrain-atlas-v1.svg";
const CREATURE_ATLAS = "/assets/monster-master/creature-atlas-v1.svg";
const TILE_WIDTH = 72;
const TILE_HEIGHT = 36;
const TERRAIN_CELL = 64;
const CREATURE_CELL = 96;
const CAMERA_STORAGE_KEY = "gameframe:monster-master:pixi-camera";
const VIEW_EVENT = "gameframe:monster-master-pixi-view";

window.gameFrameMonsterRendererMode = "pixi";

const state = {
  app: null,
  frame: null,
  originalCanvas: null,
  view: null,
  viewSignature: "",
  diagnostics: {},
  diagnosticsSignature: "",
  hover: null,
  renderQueued: false,
  terrainSignature: "",
  unitsSignature: "",
  camera: loadCamera(),
  layers: null,
  textures: null,
  resizeObserver: null,
  performance: {
    renders: 0,
    lastRenderMs: 0,
    maxRenderMs: 0,
  },
};

function loadCamera() {
  try {
    const stored = JSON.parse(localStorage.getItem(CAMERA_STORAGE_KEY) || "null");
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      return {
        x: stored.x,
        y: stored.y,
        zoom: clamp(stored.zoom ?? 1, 0.6, 2.4),
        quarter: normalizeQuarter(stored.quarter ?? 0),
      };
    }
  } catch {
    // Camera persistence is optional.
  }
  return { x: 11.5, y: 11.5, zoom: 1, quarter: 0 };
}

function saveCamera() {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(state.camera));
  } catch {
    // Camera persistence is optional.
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeQuarter(value) {
  return ((Math.round(value) % 4) + 4) % 4;
}

function isMonsterView(candidate) {
  return candidate?.gameId === GAME_ID
    && candidate?.observation?.board?.map
    && Array.isArray(candidate?.observation?.legalActions);
}

function captureView(candidate) {
  const view = isMonsterView(candidate) ? candidate : isMonsterView(candidate?.view) ? candidate.view : null;
  if (!view) return;

  const signature = `${view.matchId}:${view.revision}`;
  const changed = signature !== state.viewSignature;
  const previousActive = state.view?.observation?.activeUnitId;
  state.view = view;
  if (!changed) return;
  state.viewSignature = signature;

  const nextActive = view.observation.activeUnitId;
  if (!previousActive || previousActive !== nextActive) {
    const unit = units().find((candidateUnit) => candidateUnit.id === nextActive);
    if (unit?.position?.x >= 0) {
      state.camera.x = unit.position.x;
      state.camera.y = unit.position.y;
      saveCamera();
    }
  } else if (!state.terrainSignature) {
    const sourceMap = view.observation.board.map;
    state.camera.x = (sourceMap.width - 1) / 2;
    state.camera.y = (sourceMap.height - 1) / 2;
  }

  scheduleRender();
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { view } }));
}

function diagnostics() {
  try {
    return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
  } catch {
    return {};
  }
}

function diagnosticsSignature(value) {
  return `${value.actionMode ?? ""}:${value.selectedUnitId ?? ""}`;
}

function map() {
  return state.view?.observation?.board?.map ?? null;
}

function units() {
  return state.view?.observation?.board?.units ?? [];
}

function activeUnit() {
  const activeId = state.view?.observation?.activeUnitId;
  return units().find((unit) => unit.id === activeId) ?? null;
}

function rotateCoordinate(coordinate, sourceMap = map()) {
  if (!sourceMap) return { x: coordinate.x, y: coordinate.y };
  const maxX = sourceMap.width - 1;
  const maxY = sourceMap.height - 1;
  switch (state.camera.quarter) {
    case 1: return { x: maxY - coordinate.y, y: coordinate.x };
    case 2: return { x: maxX - coordinate.x, y: maxY - coordinate.y };
    case 3: return { x: coordinate.y, y: maxX - coordinate.x };
    default: return { x: coordinate.x, y: coordinate.y };
  }
}

function unrotateCoordinate(coordinate, sourceMap = map()) {
  if (!sourceMap) return { x: coordinate.x, y: coordinate.y };
  const maxX = sourceMap.width - 1;
  const maxY = sourceMap.height - 1;
  switch (state.camera.quarter) {
    case 1: return { x: coordinate.y, y: maxY - coordinate.x };
    case 2: return { x: maxX - coordinate.x, y: maxY - coordinate.y };
    case 3: return { x: maxX - coordinate.y, y: coordinate.x };
    default: return { x: coordinate.x, y: coordinate.y };
  }
}

function project(coordinate, elevation = 0) {
  const rotated = rotateCoordinate(coordinate);
  return {
    x: (rotated.x - rotated.y) * TILE_WIDTH / 2,
    y: (rotated.x + rotated.y) * TILE_HEIGHT / 2 - elevation * TILE_HEIGHT * 0.9,
  };
}

function inverseProject(point) {
  const rotated = {
    x: point.y / TILE_HEIGHT + point.x / TILE_WIDTH,
    y: point.y / TILE_HEIGHT - point.x / TILE_WIDTH,
  };
  return unrotateCoordinate(rotated);
}

function cellAt(coordinate) {
  const sourceMap = map();
  if (!sourceMap) return null;
  if (coordinate.x < 0 || coordinate.y < 0 || coordinate.x >= sourceMap.width || coordinate.y >= sourceMap.height) return null;
  return sourceMap.cells[coordinate.y * sourceMap.width + coordinate.x] ?? null;
}

function elevationOf(cell) {
  return Number(cell?.elevation ?? cell?.height ?? 0);
}

function terrainFrame(cell, coordinate) {
  if (cell?.terrain === "wall") return new Rectangle(0, TERRAIN_CELL, TERRAIN_CELL, TERRAIN_CELL);
  if (cell?.terrain === "difficult") return new Rectangle(2 * TERRAIN_CELL, 0, TERRAIN_CELL, TERRAIN_CELL);
  if (cell?.terrain === "objective") return new Rectangle(2 * TERRAIN_CELL, TERRAIN_CELL, TERRAIN_CELL, TERRAIN_CELL);
  return new Rectangle((coordinate.x + coordinate.y) % 2 ? 0 : TERRAIN_CELL, 0, TERRAIN_CELL, TERRAIN_CELL);
}

function creatureFrame(unit) {
  const column = unit.role === "master" ? 0 : unit.role === "bulwark" ? 1 : 2;
  return new Rectangle(column * CREATURE_CELL, 0, CREATURE_CELL, CREATURE_CELL);
}

function textureFromFrame(base, frame) {
  return new Texture({ source: base.source, frame });
}

async function loadTextures() {
  const [terrainBase, creatureBase] = await Promise.all([
    Assets.load(TERRAIN_ATLAS),
    Assets.load(CREATURE_ATLAS),
  ]);
  state.textures = { terrainBase, creatureBase };
}

function makeLayers() {
  const stage = new Container();
  const world = new Container();
  const terrain = new Container();
  const highlights = new Graphics();
  const unitsLayer = new Container();
  const effects = new Container();
  const hover = new Graphics();
  world.addChild(terrain, highlights, unitsLayer, effects, hover);
  stage.addChild(world);
  return { stage, world, terrain, highlights, units: unitsLayer, effects, hover };
}

function terrainSignature() {
  const sourceMap = map();
  if (!sourceMap) return "";
  return `${sourceMap.width}x${sourceMap.height}:${state.camera.quarter}:${sourceMap.cells.map((cell) => `${cell.terrain}:${elevationOf(cell)}`).join("|")}`;
}

function rebuildTerrain() {
  const sourceMap = map();
  if (!sourceMap || !state.layers || !state.textures) return;
  const signature = terrainSignature();
  if (signature === state.terrainSignature) return;
  state.terrainSignature = signature;
  state.layers.terrain.removeChildren().forEach((child) => child.destroy({ children: true }));

  const ordered = [];
  for (let y = 0; y < sourceMap.height; y += 1) {
    for (let x = 0; x < sourceMap.width; x += 1) {
      const coordinate = { x, y };
      const cell = cellAt(coordinate);
      const point = project(coordinate, elevationOf(cell));
      ordered.push({ coordinate, cell, point, depth: point.y });
    }
  }
  ordered.sort((left, right) => left.depth - right.depth || left.point.x - right.point.x);

  for (const entry of ordered) {
    const sprite = new Sprite(textureFromFrame(state.textures.terrainBase, terrainFrame(entry.cell, entry.coordinate)));
    sprite.anchor.set(0.5, 0.5);
    sprite.x = entry.point.x;
    sprite.y = entry.point.y;
    sprite.width = TILE_WIDTH * 1.04;
    sprite.height = entry.cell?.terrain === "wall" ? TILE_HEIGHT * 2.25 : TILE_HEIGHT * 1.85;
    sprite.alpha = entry.cell?.terrain === "wall" ? 0.96 : 0.9;
    sprite.eventMode = "none";
    state.layers.terrain.addChild(sprite);
  }
}

function actionDestination(action) {
  if (action.type === "deploy-unit") return action.position;
  if (action.type === "move") return action.path?.at(-1) ?? null;
  if (action.type === "attack" || action.type === "use-ability") return action.target;
  return null;
}

function legalHighlights() {
  const mode = state.diagnostics.actionMode;
  if (!mode || !state.view) return [];
  return state.view.observation.legalActions
    .filter((action) => action.type === mode)
    .filter((action) => action.type !== "deploy-unit" || action.unitId === state.diagnostics.selectedUnitId)
    .map((action) => ({ action, coordinate: actionDestination(action) }))
    .filter((entry) => entry.coordinate);
}

function drawDiamond(graphics, point, width, height, fill, stroke, alpha = 1) {
  graphics.poly([
    point.x, point.y - height / 2,
    point.x + width / 2, point.y,
    point.x, point.y + height / 2,
    point.x - width / 2, point.y,
  ]).fill({ color: fill, alpha }).stroke({ color: stroke, alpha: Math.min(1, alpha + 0.25), width: 1.5 });
}

function rebuildHighlights() {
  if (!state.layers) return;
  const graphics = state.layers.highlights;
  graphics.clear();
  for (const { action, coordinate } of legalHighlights()) {
    const point = project(coordinate, elevationOf(cellAt(coordinate)));
    const color = action.type === "deploy-unit"
      ? 0xffcf6e
      : action.type === "move"
        ? 0x58cfff
        : action.type === "use-ability"
          ? 0x63e8a5
          : 0xff5a8b;
    drawDiamond(graphics, point, TILE_WIDTH * 0.9, TILE_HEIGHT * 0.9, color, 0xf0fbff, 0.28);
  }
}

function unitSignature() {
  if (!state.view) return "";
  return units().map((unit) => [
    unit.id,
    unit.position.x,
    unit.position.y,
    unit.health,
    unit.maxHealth,
    unit.role,
    unit.ownerId,
  ].join(":" )).join("|") + `:${state.view.observation.activeUnitId}:${state.camera.quarter}`;
}

function rebuildUnits() {
  if (!state.layers || !state.textures || !state.view) return;
  const signature = unitSignature();
  if (signature === state.unitsSignature) return;
  state.unitsSignature = signature;
  state.layers.units.removeChildren().forEach((child) => child.destroy({ children: true }));
  const firstPlayer = state.view.playerIds[0];
  const ordered = [...units()].sort((left, right) => {
    const leftPoint = project(left.position);
    const rightPoint = project(right.position);
    return leftPoint.y - rightPoint.y || leftPoint.x - rightPoint.x;
  });

  for (const unit of ordered) {
    const group = new Container();
    const point = project(unit.position, elevationOf(cellAt(unit.position)));
    group.x = point.x;
    group.y = point.y - TILE_HEIGHT * 0.65;
    group.eventMode = "none";

    const shadow = new Graphics().ellipse(0, TILE_HEIGHT * 0.75, TILE_WIDTH * 0.28, TILE_HEIGHT * 0.24).fill({ color: 0x02060d, alpha: 0.45 });
    const ringColor = unit.ownerId === firstPlayer ? 0x4badff : 0xff5b8f;
    const ring = new Graphics().ellipse(0, TILE_HEIGHT * 0.65, TILE_WIDTH * 0.32, TILE_HEIGHT * 0.27)
      .stroke({ color: ringColor, width: unit.id === state.view.observation.activeUnitId ? 4 : 2, alpha: 0.88 });
    const sprite = new Sprite(textureFromFrame(state.textures.creatureBase, creatureFrame(unit)));
    sprite.anchor.set(0.5, 0.86);
    const size = unit.role === "bulwark" ? 104 : unit.role === "master" ? 94 : 82;
    sprite.width = size;
    sprite.height = size;
    if (unit.ownerId === firstPlayer) sprite.scale.x *= -1;

    const healthBack = new Graphics().roundRect(-34, 8, 68, 6, 3).fill({ color: 0x050910, alpha: 0.9 });
    const healthWidth = 68 * clamp(unit.health / Math.max(1, unit.maxHealth), 0, 1);
    const health = new Graphics().roundRect(-34, 8, healthWidth, 6, 3)
      .fill({ color: unit.health / unit.maxHealth > 0.45 ? 0x6ee0a5 : 0xff9a75, alpha: 1 });

    group.addChild(shadow, ring, sprite, healthBack, health);
    state.layers.units.addChild(group);
  }
}

function rebuildHover() {
  if (!state.layers) return;
  state.layers.hover.clear();
  if (!state.hover || !cellAt(state.hover)) return;
  const point = project(state.hover, elevationOf(cellAt(state.hover)));
  drawDiamond(state.layers.hover, point, TILE_WIDTH * 0.96, TILE_HEIGHT * 0.96, 0xffffff, 0xffffff, 0.08);
}

function cameraPoint() {
  return project({ x: state.camera.x, y: state.camera.y });
}

function applyCamera() {
  if (!state.layers || !state.app || !state.frame) return;
  const width = Math.max(1, state.frame.clientWidth);
  const height = Math.max(1, state.frame.clientHeight);
  const center = cameraPoint();
  state.layers.world.scale.set(state.camera.zoom);
  state.layers.world.x = width / 2 - center.x * state.camera.zoom;
  state.layers.world.y = height * 0.48 - center.y * state.camera.zoom;
}

function scheduleRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(render);
}

function render() {
  state.renderQueued = false;
  if (!state.app || !state.view || !state.layers) return;
  const started = performance.now();
  state.diagnostics = diagnostics();
  rebuildTerrain();
  rebuildHighlights();
  rebuildUnits();
  rebuildHover();
  applyCamera();
  state.app.renderer.render({ container: state.layers.stage });
  const elapsed = performance.now() - started;
  state.performance.renders += 1;
  state.performance.lastRenderMs = elapsed;
  state.performance.maxRenderMs = Math.max(state.performance.maxRenderMs, elapsed);
}

function localPoint(event) {
  const rect = state.app.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function screenToWorld(point) {
  const world = state.layers.world;
  return {
    x: (point.x - world.x) / world.scale.x,
    y: (point.y - world.y) / world.scale.y,
  };
}

function screenToTile(point) {
  const sourceMap = map();
  if (!sourceMap) return null;
  const worldPoint = screenToWorld(point);
  const approximate = inverseProject(worldPoint);
  const rounded = { x: Math.round(approximate.x), y: Math.round(approximate.y) };
  let best = null;
  let bestDistance = Infinity;
  for (let y = rounded.y - 1; y <= rounded.y + 1; y += 1) {
    for (let x = rounded.x - 1; x <= rounded.x + 1; x += 1) {
      const coordinate = { x, y };
      const cell = cellAt(coordinate);
      if (!cell) continue;
      const center = project(coordinate, elevationOf(cell));
      const distance = Math.abs(worldPoint.x - center.x) / (TILE_WIDTH / 2)
        + Math.abs(worldPoint.y - center.y) / (TILE_HEIGHT / 2);
      if (distance <= 1.08 && distance < bestDistance) {
        best = coordinate;
        bestDistance = distance;
      }
    }
  }
  return best;
}

function dispatchCoordinate(coordinate) {
  if (!coordinate) return;
  window.dispatchEvent(new CustomEvent("gameframe:monster-master-coordinate", { detail: { coordinate } }));
}

function bindPointer() {
  const canvas = state.app.canvas;
  canvas.addEventListener("pointermove", (event) => {
    const next = screenToTile(localPoint(event));
    if (next?.x === state.hover?.x && next?.y === state.hover?.y) return;
    state.hover = next;
    scheduleRender();
  });
  canvas.addEventListener("pointerleave", () => {
    state.hover = null;
    scheduleRender();
  });
  canvas.addEventListener("click", (event) => dispatchCoordinate(screenToTile(localPoint(event))));
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    state.camera.zoom = clamp(state.camera.zoom * Math.exp(-event.deltaY * 0.0015), 0.6, 2.4);
    saveCamera();
    scheduleRender();
  }, { passive: false });
}

function moveCamera(deltaX, deltaY) {
  state.camera.x += deltaX;
  state.camera.y += deltaY;
  clampCamera();
  saveCamera();
  scheduleRender();
}

function clampCamera() {
  const sourceMap = map();
  if (!sourceMap) return;
  state.camera.x = clamp(state.camera.x, -1, sourceMap.width);
  state.camera.y = clamp(state.camera.y, -1, sourceMap.height);
  state.camera.zoom = clamp(state.camera.zoom, 0.6, 2.4);
}

function centerActive() {
  const unit = activeUnit();
  if (!unit) return;
  state.camera.x = unit.position.x;
  state.camera.y = unit.position.y;
  saveCamera();
  scheduleRender();
}

function centerField() {
  const sourceMap = map();
  if (!sourceMap) return;
  state.camera.x = (sourceMap.width - 1) / 2;
  state.camera.y = (sourceMap.height - 1) / 2;
  saveCamera();
  scheduleRender();
}

function rotate(delta) {
  state.camera.quarter = normalizeQuarter(state.camera.quarter + delta);
  state.terrainSignature = "";
  state.unitsSignature = "";
  saveCamera();
  scheduleRender();
  updateCameraLabel();
}

function ensureRotationControls() {
  const controls = document.querySelector(".tactical-controls");
  if (!controls || document.querySelector("#monster-master-rotate-left")) return;
  const group = document.createElement("div");
  group.className = "monster-master-rotation-controls";
  group.setAttribute("aria-label", "Battlefield viewing corner");
  group.innerHTML = `
    <button id="monster-master-rotate-left" class="monster-master-rotate-button" type="button" aria-label="Rotate battlefield left">↶</button>
    <output id="monster-master-camera-corner" class="monster-master-camera-corner" aria-live="polite"></output>
    <button id="monster-master-rotate-right" class="monster-master-rotate-button" type="button" aria-label="Rotate battlefield right">↷</button>
  `;
  controls.insertAdjacentElement("afterend", group);
  group.querySelector("#monster-master-rotate-left")?.addEventListener("click", () => rotate(-1));
  group.querySelector("#monster-master-rotate-right")?.addEventListener("click", () => rotate(1));
  updateCameraLabel();
}

function updateCameraLabel() {
  const names = ["Northwest", "Northeast", "Southeast", "Southwest"];
  const label = document.querySelector("#monster-master-camera-corner");
  if (label) label.textContent = names[state.camera.quarter];
}

function bindCameraControls() {
  document.querySelectorAll("[data-monster-master-pan-x][data-monster-master-pan-y]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      moveCamera(Number(button.dataset.monsterMasterPanX), Number(button.dataset.monsterMasterPanY));
    }, true);
  });
  const bindings = [
    ["#monster-master-center-active", centerActive],
    ["#monster-master-center-field", centerField],
    ["#monster-master-zoom-in", () => { state.camera.zoom = clamp(state.camera.zoom + 0.2, 0.6, 2.4); saveCamera(); scheduleRender(); }],
    ["#monster-master-zoom-out", () => { state.camera.zoom = clamp(state.camera.zoom - 0.2, 0.6, 2.4); saveCamera(); scheduleRender(); }],
  ];
  for (const [selector, handler] of bindings) {
    document.querySelector(selector)?.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      handler();
    }, true);
  }
  ensureRotationControls();
}

function subscribeToController() {
  window.addEventListener(VIEW_EVENT, (event) => captureView(event.detail?.view));
  const current = window.gameFrameMonsterController?.getView?.();
  if (current) captureView(current);
}
async function initialize() {
  const frame = document.querySelector(".combat-canvas-frame");
  const originalCanvas = document.querySelector("#monster-master-canvas");
  if (!frame || !originalCanvas) return;
  state.frame = frame;
  state.originalCanvas = originalCanvas;
  originalCanvas.classList.add("monster-master-legacy-canvas");
  originalCanvas.setAttribute("aria-hidden", "true");
  originalCanvas.tabIndex = -1;

  const app = new Application();
  await app.init({
    preference: "webgl",
    resizeTo: frame,
    backgroundAlpha: 0,
    antialias: false,
    autoStart: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, window.innerWidth <= 900 ? 1.25 : 1.5),
    powerPreference: "high-performance",
  });
  state.app = app;
  app.renderer.resize(Math.max(1, frame.clientWidth), Math.max(1, frame.clientHeight));
  app.canvas.id = "monster-master-pixi-canvas";
  app.canvas.className = "monster-master-pixi-canvas";
  app.canvas.setAttribute("aria-label", "GPU-accelerated Monster Master battlefield");
  app.canvas.tabIndex = 0;
  frame.append(app.canvas);

  state.layers = makeLayers();
  app.stage.addChild(state.layers.stage);
  await loadTextures();
  bindPointer();
  bindCameraControls();

  const detailNode = document.querySelector("#monster-master-details");
  if (detailNode) {
    new MutationObserver(() => {
      const next = diagnostics();
      const signature = diagnosticsSignature(next);
      if (signature === state.diagnosticsSignature) return;
      state.diagnostics = next;
      state.diagnosticsSignature = signature;
      scheduleRender();
    }).observe(detailNode, { childList: true, subtree: true, characterData: true });
  }
  state.resizeObserver = new ResizeObserver(() => {
    if (state.app) {
      state.app.renderer.resize(Math.max(1, frame.clientWidth), Math.max(1, frame.clientHeight));
    }
    scheduleRender();
  });
  state.resizeObserver.observe(frame);
  document.body.classList.add("monster-master-pixi-ready");
  scheduleRender();
}

subscribeToController();
const ready = initialize().then(() => {
  const current = window.gameFrameMonsterController?.getView?.();
  if (current) captureView(current);
  return true;
}).catch((error) => {
  console.error("Monster Master Pixi initialization failed.", error);
  document.body.classList.add("monster-master-pixi-failed");
  return false;
});

window.gameFrameMonsterPixi = Object.freeze({
  ready,
  getView: () => state.view,
  getCamera: () => ({ ...state.camera }),
  getPerformance: () => ({ ...state.performance }),
  screenToTile,
  centerActive,
  centerField,
  rotateLeft: () => rotate(-1),
  rotateRight: () => rotate(1),
  render: scheduleRender,
});
