import {
  Application,
  Assets,
  Container,
  Graphics,
  Matrix,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";
import {
  GROUND_APRON_CELLS,
  TILE_HEIGHT,
  TILE_WIDTH,
  cellAt as geometryCellAt,
  clamp,
  depthIndex,
  diamondPoints,
  exposedTerrainFaces,
  geometrySnapshot,
  inverseProjectPoint,
  mapSurfacePolygon,
  normalizeQuarter,
  projectCoordinate,
  screenVectorToCameraDelta,
  terrainTopCenter,
  terrainTopPolygon,
  terrainVisualHeight,
} from "./monster-master-terrain-geometry.js";

const GAME_ID = "monster-master-duel";
const CREATURE_ATLAS = "/assets/monster-master/creature-atlas-v1.svg";
const GRASS_GROUND_TEXTURE = "/assets/monster-master/terrain/grass-ground/grass-ground-v1-128.webp";
const RAISED_BARRIER_CAP_TEXTURE = "/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp";
const CLIFF_FACE_TEXTURE = "/assets/monster-master/terrain/cliff-face/cliff-face-grassland-stone-v1-128.webp";
const CREATURE_CELL = 96;
const CAMERA_STORAGE_KEY = "gameframe:monster-master:pixi-camera";
const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const CAMERA_EVENT = "gameframe:monster-master-pixi-camera";
const GEOMETRY_DEBUG_PARAMETER = "geometryDebug";
const CLIFF_FACE_TEXTURE_MATRIX = new Matrix().scale(0.72, 0.24);

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
  geometryDebug: new URLSearchParams(window.location.search).get(GEOMETRY_DEBUG_PARAMETER) === "1",
  terrainStats: {
    groundObjects: 0,
    wallCount: 0,
    renderedFaces: 0,
    culledFaces: 0,
    terrainObjects: 0,
    unitObjects: 0,
    worldObjectCount: 0,
  },
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

function commitCamera() {
  saveCamera();
  applyCamera();
  scheduleRender();
  window.dispatchEvent(new CustomEvent(CAMERA_EVENT, {
    detail: { camera: { ...state.camera } },
  }));
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

function cellAt(coordinate) {
  return geometryCellAt(map(), coordinate);
}

function project(coordinate, elevationPixels = 0) {
  return projectCoordinate(coordinate, map(), state.camera.quarter, elevationPixels);
}

function inverseProject(point) {
  return inverseProjectPoint(point, map(), state.camera.quarter);
}

function creatureFrame(unit) {
  const column = unit.role === "master" ? 0 : unit.role === "bulwark" ? 1 : 2;
  return new Rectangle(column * CREATURE_CELL, 0, CREATURE_CELL, CREATURE_CELL);
}

function textureFromFrame(base, frame) {
  return new Texture({ source: base.source, frame });
}

async function loadTextures() {
  const [creatureBase, grassGround, raisedBarrierCap, cliffFace] = await Promise.all([
    Assets.load(CREATURE_ATLAS),
    Assets.load(GRASS_GROUND_TEXTURE),
    Assets.load(RAISED_BARRIER_CAP_TEXTURE),
    Assets.load(CLIFF_FACE_TEXTURE),
  ]);
  raisedBarrierCap.source.wrapMode = "repeat";
  cliffFace.source.wrapMode = "repeat";
  state.textures = { creatureBase, grassGround, raisedBarrierCap, cliffFace };
}

function makeLayers() {
  const stage = new Container();
  const world = new Container();
  const ground = new Container();
  const highlights = new Graphics();
  const worldObjects = new Container();
  const effects = new Container();
  const hover = new Graphics();
  const debug = new Graphics();
  worldObjects.sortableChildren = true;
  world.addChild(ground, highlights, worldObjects, effects, hover, debug);
  stage.addChild(world);
  return { stage, world, ground, highlights, worldObjects, effects, hover, debug };
}

function flatten(points) {
  return points.flatMap((point) => [point.x, point.y]);
}

function removeWorldObjects(kind) {
  if (!state.layers) return;
  for (const child of [...state.layers.worldObjects.children]) {
    if (child.gameFrameKind !== kind) continue;
    state.layers.worldObjects.removeChild(child);
    child.destroy({ children: true });
  }
}

function terrainSignature() {
  const sourceMap = map();
  if (!sourceMap) return "";
  return `${sourceMap.width}x${sourceMap.height}:${state.camera.quarter}:${sourceMap.cells.map((cell) => `${cell.terrain}:${terrainVisualHeight(cell)}`).join("|")}`;
}

function drawGroundPlane(sourceMap) {
  const ground = state.layers.ground;
  for (const child of ground.removeChildren()) child.destroy({ children: true });
  const apron = mapSurfacePolygon(sourceMap, state.camera.quarter, GROUND_APRON_CELLS);
  const playable = mapSurfacePolygon(sourceMap, state.camera.quarter, 0);
  const backdrop = new Graphics();
  backdrop.poly(flatten(apron))
    .fill({ color: 0x26382f, alpha: 1 })
    .stroke({ color: 0x61735c, alpha: 0.38, width: 2 });
  backdrop.poly(flatten(playable)).fill({ color: 0x4c633d, alpha: 1 });
  ground.addChild(backdrop);

  const xs = playable.map((point) => point.x);
  const ys = playable.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const materialLayer = new Container();
  materialLayer.position.set(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  );
  materialLayer.scale.y = height / width;
  const side = width / Math.SQRT2;
  const material = new TilingSprite({
    texture: state.textures.grassGround,
    width: side,
    height: side,
  });
  material.anchor.set(0.5);
  material.rotation = Math.PI / 4;
  material.tileScale.set(0.76);
  material.tilePosition.set(18, 22);
  materialLayer.addChild(material);
  ground.addChild(materialLayer);
  const playableMask = new Graphics().poly(flatten(playable)).fill(0xffffff);
  ground.addChild(playableMask);
  materialLayer.mask = playableMask;
  state.terrainStats.groundObjects = 1;
}

function drawTerrainObjects(sourceMap) {
  removeWorldObjects("terrain");
  const faces = exposedTerrainFaces(sourceMap, state.camera.quarter);
  const renderedFaceKeys = new Set();
  let wallCount = 0;
  let renderedFaces = 0;
  for (let y = 0; y < sourceMap.height; y += 1) {
    for (let x = 0; x < sourceMap.width; x += 1) {
      const coordinate = { x, y };
      const cell = cellAt(coordinate);
      if (!cell) continue;
      const visualHeight = terrainVisualHeight(cell);
      if (visualHeight <= 0) continue;
      if (cell.terrain === "wall") wallCount += 1;

      const top = new Graphics();
      top.gameFrameKind = "terrain";
      top.poly(flatten(terrainTopPolygon(coordinate, cell, sourceMap, state.camera.quarter)))
        .texture({ texture: state.textures.raisedBarrierCap, alpha: 1 })
        .stroke({ color: 0xcedbbb, alpha: 0.25, width: 1 });
      top.zIndex = depthIndex(coordinate, sourceMap, state.camera.quarter, 0);
      state.layers.worldObjects.addChild(top);

      for (const face of faces.filter((candidate) => candidate.coordinate.x === x && candidate.coordinate.y === y)) {
        const faceKey = `${face.coordinate.x}:${face.coordinate.y}:${face.edge}`;
        if (renderedFaceKeys.has(faceKey)) continue;
        renderedFaceKeys.add(faceKey);
        const graphics = new Graphics();
        graphics.gameFrameKind = "terrain";
        const faceAlpha = face.edge === "south" ? 0.95 : 0.78;
        graphics.poly(flatten(face.polygon))
          .texture({ texture: state.textures.cliffFace, matrix: CLIFF_FACE_TEXTURE_MATRIX, alpha: faceAlpha })
          .stroke({ color: 0x4c503e, alpha: 0.32, width: 1 });
        graphics.zIndex = depthIndex(coordinate, sourceMap, state.camera.quarter, face.depthOffset);
        state.layers.worldObjects.addChild(graphics);
        renderedFaces += 1;
      }
    }
  }
  state.terrainStats.wallCount = wallCount;
  state.terrainStats.renderedFaces = renderedFaces;
  state.terrainStats.culledFaces = Math.max(0, faces.totalCandidates - renderedFaces);
  state.terrainStats.terrainObjects = state.layers.worldObjects.children.filter((child) => child.gameFrameKind === "terrain").length;
}

function rebuildTerrain() {
  const sourceMap = map();
  if (!sourceMap || !state.layers || !state.textures) return;
  const signature = terrainSignature();
  if (signature === state.terrainSignature) return;
  drawGroundPlane(sourceMap);
  drawTerrainObjects(sourceMap);
  state.terrainSignature = signature;
}

function actionCoordinates() {
  const legalActions = state.view?.observation?.legalActions ?? [];
  return legalActions
    .map((action) => action.coordinate)
    .filter((coordinate) => Number.isInteger(coordinate?.x) && Number.isInteger(coordinate?.y));
}

function rebuildHighlights() {
  if (!state.layers) return;
  const graphics = state.layers.highlights;
  graphics.clear();
  for (const coordinate of actionCoordinates()) {
    graphics.poly(flatten(diamondPoints(coordinate, map(), state.camera.quarter)))
      .fill({ color: 0x7fffb3, alpha: 0.14 })
      .stroke({ color: 0x92ffc0, alpha: 0.46, width: 1.4 });
  }
}

function unitSignature() {
  return units().map((unit) => [
    unit.id,
    unit.role,
    unit.ownerId,
    unit.position?.x,
    unit.position?.y,
    unit.health,
    unit.maxHealth,
  ].join(":")) .join("|") + `:${state.camera.quarter}`;
}

function rebuildUnits() {
  if (!state.layers || !state.textures) return;
  const signature = unitSignature();
  if (signature === state.unitsSignature) return;
  removeWorldObjects("unit");
  for (const unit of units()) {
    if (!unit.position) continue;
    const frame = creatureFrame(unit);
    const sprite = new Sprite(textureFromFrame(state.textures.creatureBase, frame));
    sprite.gameFrameKind = "unit";
    sprite.anchor.set(0.5, 0.82);
    sprite.width = CREATURE_CELL * 0.62;
    sprite.height = CREATURE_CELL * 0.62;
    const center = terrainTopCenter(unit.position, cellAt(unit.position), map(), state.camera.quarter);
    sprite.position.set(center.x, center.y);
    sprite.zIndex = depthIndex(unit.position, map(), state.camera.quarter, 20);
    if (unit.id === state.view?.observation?.activeUnitId) {
      sprite.tint = 0xcaffdc;
    }
    state.layers.worldObjects.addChild(sprite);
  }
  state.unitsSignature = signature;
  state.terrainStats.unitObjects = state.layers.worldObjects.children.filter((child) => child.gameFrameKind === "unit").length;
  state.terrainStats.worldObjectCount = state.layers.worldObjects.children.length;
}

function rebuildHover() {
  if (!state.layers) return;
  const graphics = state.layers.hover;
  graphics.clear();
  if (!state.hover || !cellAt(state.hover)) return;
  graphics.poly(flatten(diamondPoints(state.hover, map(), state.camera.quarter)))
    .stroke({ color: 0xf2fff5, alpha: 0.62, width: 1.2 });
}

function rebuildGeometryDebug() {
  if (!state.layers) return;
  const graphics = state.layers.debug;
  graphics.clear();
  if (!state.geometryDebug) return;
  const sourceMap = map();
  if (!sourceMap) return;
  const outline = mapSurfacePolygon(sourceMap, state.camera.quarter, 0);
  graphics.poly(flatten(outline)).stroke({ color: 0xff4dc4, alpha: 0.7, width: 2 });
  for (let y = 0; y < sourceMap.height; y += 1) {
    for (let x = 0; x < sourceMap.width; x += 1) {
      const point = terrainTopCenter({ x, y }, cellAt({ x, y }), sourceMap, state.camera.quarter);
      graphics.moveTo(point.x - 5, point.y).lineTo(point.x + 5, point.y)
        .moveTo(point.x, point.y - 5).lineTo(point.x, point.y + 5)
        .stroke({ color: 0xffffff, alpha: 0.9, width: 1.2 });
    }
  }
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
  rebuildGeometryDebug();
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

function worldToScreen(coordinate, elevationPixels = 0) {
  if (!state.layers) return null;
  const point = project(coordinate, elevationPixels);
  const world = state.layers.world;
  return {
    x: world.x + point.x * world.scale.x,
    y: world.y + point.y * world.scale.y,
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
  for (let y = rounded.y - 2; y <= rounded.y + 2; y += 1) {
    for (let x = rounded.x - 2; x <= rounded.x + 2; x += 1) {
      const coordinate = { x, y };
      const cell = cellAt(coordinate);
      if (!cell) continue;
      const center = terrainTopCenter(coordinate, cell, sourceMap, state.camera.quarter);
      const distance = Math.abs(worldPoint.x - center.x) / (TILE_WIDTH / 2)
        + Math.abs(worldPoint.y - center.y) / (TILE_HEIGHT / 2);
      if (distance <= 1.02 && distance < bestDistance) {
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
    commitCamera();
  }, { passive: false });
}

function moveCamera(deltaX, deltaY) {
  state.camera.x += deltaX;
  state.camera.y += deltaY;
  clampCamera();
  commitCamera();
}

function panScreen(deltaX, deltaY) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
  const delta = screenVectorToCameraDelta(deltaX, deltaY, state.camera);
  moveCamera(delta.x, delta.y);
  return true;
}

function panCardinal(horizontal, vertical) {
  const screenX = Math.sign(horizontal) * TILE_WIDTH * 1.5;
  const screenY = Math.sign(vertical) * TILE_HEIGHT * 1.5;
  return panScreen(screenX, screenY);
}

function clampCamera() {
  const sourceMap = map();
  if (!sourceMap) return;
  state.camera.x = clamp(state.camera.x, -GROUND_APRON_CELLS, sourceMap.width - 1 + GROUND_APRON_CELLS);
  state.camera.y = clamp(state.camera.y, -GROUND_APRON_CELLS, sourceMap.height - 1 + GROUND_APRON_CELLS);
  state.camera.zoom = clamp(state.camera.zoom, 0.6, 2.4);
}

function centerActive() {
  const unit = activeUnit();
  if (!unit) return;
  state.camera.x = unit.position.x;
  state.camera.y = unit.position.y;
  commitCamera();
}

function centerField() {
  const sourceMap = map();
  if (!sourceMap) return;
  state.camera.x = (sourceMap.width - 1) / 2;
  state.camera.y = (sourceMap.height - 1) / 2;
  commitCamera();
}

function rotate(delta) {
  state.camera.quarter = normalizeQuarter(state.camera.quarter + delta);
  state.terrainSignature = "";
  state.unitsSignature = "";
  commitCamera();
  updateCameraLabel();
}

function setGeometryDebug(enabled) {
  state.geometryDebug = Boolean(enabled);
  scheduleRender();
  return state.geometryDebug;
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
    ["#monster-master-zoom-in", () => { state.camera.zoom = clamp(state.camera.zoom + 0.2, 0.6, 2.4); commitCamera(); }],
    ["#monster-master-zoom-out", () => { state.camera.zoom = clamp(state.camera.zoom - 0.2, 0.6, 2.4); commitCamera(); }],
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
  getTerrainStats: () => ({ ...state.terrainStats }),
  getGeometrySnapshot: (coordinate) => geometrySnapshot(coordinate, map(), state.camera.quarter),
  isGeometryDebugEnabled: () => state.geometryDebug,
  setGeometryDebug,
  screenToTile,
  worldToScreen,
  panScreen,
  panCardinal,
  centerActive,
  centerField,
  rotateLeft: () => rotate(-1),
  rotateRight: () => rotate(1),
  render: scheduleRender,
});
