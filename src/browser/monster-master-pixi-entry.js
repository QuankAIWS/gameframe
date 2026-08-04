import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
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
const CREATURE_CELL = 96;
const CAMERA_STORAGE_KEY = "gameframe:monster-master:pixi-camera";
const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const GEOMETRY_DEBUG_PARAMETER = "geometryDebug";

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
  const creatureBase = await Assets.load(CREATURE_ATLAS);
  state.textures = { creatureBase };
}

function makeLayers() {
  const stage = new Container();
  const world = new Container();
  const ground = new Graphics();
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
  const graphics = state.layers.ground;
  graphics.clear();
  const apron = mapSurfacePolygon(sourceMap, state.camera.quarter, GROUND_APRON_CELLS);
  const playable = mapSurfacePolygon(sourceMap, state.camera.quarter, 0);

  graphics.poly(flatten(apron))
    .fill({ color: 0x2f4037, alpha: 1 })
    .stroke({ color: 0x61735c, alpha: 0.38, width: 2 });
  graphics.poly(flatten(playable))
    .fill({ color: 0x59694a, alpha: 0.98 })
    .stroke({ color: 0xb0b17f, alpha: 0.2, width: 1.5 });

  const center = projectCoordinate(
    { x: (sourceMap.width - 1) / 2, y: (sourceMap.height - 1) / 2 },
    sourceMap,
    state.camera.quarter,
  );
  const inner = diamondPoints(center, sourceMap.width * TILE_WIDTH * 0.42, sourceMap.height * TILE_HEIGHT * 0.42);
  graphics.poly(flatten(inner)).stroke({ color: 0xd7d19b, alpha: 0.035, width: 10 });
}

function drawTerrainTop(graphics, entry) {
  const polygon = terrainTopPolygon(entry.coordinate, entry.cell, map(), state.camera.quarter);
  if (entry.cell?.terrain === "wall") {
    graphics.poly(flatten(polygon))
      .fill({ color: 0x7e8068, alpha: 1 })
      .stroke({ color: 0xc1bb93, alpha: 0.52, width: 1.2 });
    const inset = diamondPoints(terrainTopCenter(entry.coordinate, entry.cell, map(), state.camera.quarter), TILE_WIDTH * 0.62, TILE_HEIGHT * 0.62);
    graphics.poly(flatten(inset)).stroke({ color: 0x535d51, alpha: 0.42, width: 1 });
    return;
  }

  if (entry.cell?.terrain === "difficult") {
    graphics.poly(flatten(polygon))
      .fill({ color: 0x4b503c, alpha: 0.76 })
      .stroke({ color: 0xaaa274, alpha: 0.24, width: 1 });
    const center = terrainTopCenter(entry.coordinate, entry.cell, map(), state.camera.quarter);
    graphics.circle(center.x - 12, center.y + 2, 3).fill({ color: 0xb2aa79, alpha: 0.4 });
    graphics.circle(center.x + 9, center.y - 3, 2.5).fill({ color: 0x30372f, alpha: 0.5 });
    return;
  }

  if (entry.cell?.terrain === "objective") {
    graphics.poly(flatten(polygon))
      .fill({ color: 0x314c49, alpha: 0.82 })
      .stroke({ color: 0x6de0f1, alpha: 0.76, width: 1.5 });
    const center = terrainTopCenter(entry.coordinate, entry.cell, map(), state.camera.quarter);
    graphics.circle(center.x, center.y, 7)
      .fill({ color: 0x5ed6e9, alpha: 0.14 })
      .stroke({ color: 0xa2f7ff, alpha: 0.72, width: 1.2 });
  }
}

function makeTerrainDisplay(entry) {
  const display = new Graphics();
  display.gameFrameKind = "terrain";
  display.eventMode = "none";
  const base = project(entry.coordinate);
  display.zIndex = depthIndex(base, -100);

  if (entry.cell?.terrain === "wall") {
    const { faces } = exposedTerrainFaces(entry.coordinate, entry.cell, map(), state.camera.quarter);
    for (const face of faces) {
      const color = face.side === "left" ? 0x485348 : 0x3a4742;
      display.poly(flatten(face.points))
        .fill({ color, alpha: 1 })
        .stroke({ color: 0xa9a584, alpha: 0.3, width: 1 });
      const upper = face.points[0];
      const lower = face.points[3];
      const seamY = upper.y + (lower.y - upper.y) * (0.42 + ((entry.coordinate.x + entry.coordinate.y) % 3) * 0.08);
      display.moveTo(upper.x, seamY).lineTo(face.points[1].x, seamY + (face.points[1].y - upper.y))
        .stroke({ color: 0xd2cda8, alpha: 0.12, width: 0.8 });
    }
  }

  drawTerrainTop(display, entry);
  return display;
}

function rebuildTerrain() {
  const sourceMap = map();
  if (!sourceMap || !state.layers) return;
  const signature = terrainSignature();
  if (signature === state.terrainSignature) return;
  state.terrainSignature = signature;
  removeWorldObjects("terrain");
  drawGroundPlane(sourceMap);

  const ordered = [];
  for (let y = 0; y < sourceMap.height; y += 1) {
    for (let x = 0; x < sourceMap.width; x += 1) {
      const coordinate = { x, y };
      const cell = cellAt(coordinate);
      if (!cell || cell.terrain === "floor") continue;
      const base = project(coordinate);
      ordered.push({ coordinate, cell, depth: depthIndex(base) });
    }
  }
  ordered.sort((left, right) => left.depth - right.depth);

  let wallCount = 0;
  let renderedFaces = 0;
  let culledFaces = 0;
  for (const entry of ordered) {
    if (entry.cell.terrain === "wall") {
      wallCount += 1;
      const faceGeometry = exposedTerrainFaces(entry.coordinate, entry.cell, sourceMap, state.camera.quarter);
      renderedFaces += faceGeometry.faces.length;
      culledFaces += faceGeometry.culledFaces;
    }
    state.layers.worldObjects.addChild(makeTerrainDisplay(entry));
  }
  state.layers.worldObjects.sortChildren();
  state.terrainStats = {
    ...state.terrainStats,
    groundObjects: 1,
    wallCount,
    renderedFaces,
    culledFaces,
    terrainObjects: ordered.length,
    worldObjectCount: state.layers.worldObjects.children.length,
  };
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
  graphics.poly(flatten(diamondPoints(point, width, height)))
    .fill({ color: fill, alpha })
    .stroke({ color: stroke, alpha: Math.min(1, alpha + 0.25), width: 1.5 });
}

function rebuildHighlights() {
  if (!state.layers) return;
  const graphics = state.layers.highlights;
  graphics.clear();
  for (const { action, coordinate } of legalHighlights()) {
    const point = terrainTopCenter(coordinate, cellAt(coordinate), map(), state.camera.quarter);
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
  removeWorldObjects("unit");
  const firstPlayer = state.view.playerIds[0];
  const ordered = [...units()].sort((left, right) => {
    const leftPoint = project(left.position);
    const rightPoint = project(right.position);
    return leftPoint.y - rightPoint.y || leftPoint.x - rightPoint.x;
  });

  for (const unit of ordered) {
    const group = new Container();
    const base = project(unit.position);
    group.x = base.x;
    group.y = base.y - TILE_HEIGHT * 0.65;
    group.zIndex = depthIndex(base, 100);
    group.gameFrameKind = "unit";
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
    state.layers.worldObjects.addChild(group);
  }
  state.layers.worldObjects.sortChildren();
  state.terrainStats = {
    ...state.terrainStats,
    unitObjects: ordered.length,
    worldObjectCount: state.layers.worldObjects.children.length,
  };
}

function rebuildHover() {
  if (!state.layers) return;
  state.layers.hover.clear();
  if (!state.hover || !cellAt(state.hover)) return;
  const point = terrainTopCenter(state.hover, cellAt(state.hover), map(), state.camera.quarter);
  drawDiamond(state.layers.hover, point, TILE_WIDTH, TILE_HEIGHT, 0xffffff, 0xffffff, 0.08);
}

function rebuildGeometryDebug() {
  if (!state.layers) return;
  const graphics = state.layers.debug;
  graphics.clear();
  if (!state.geometryDebug || !map()) return;

  const sourceMap = map();
  for (let y = 0; y < sourceMap.height; y += 1) {
    for (let x = 0; x < sourceMap.width; x += 1) {
      const coordinate = { x, y };
      const snapshot = geometrySnapshot(coordinate, sourceMap, state.camera.quarter);
      graphics.poly(flatten(snapshot.topPolygon)).stroke({
        color: snapshot.terrain === "wall" ? 0xffd75c : 0x55e6ff,
        alpha: snapshot.terrain === "wall" ? 0.78 : 0.2,
        width: snapshot.terrain === "wall" ? 1.4 : 0.7,
      });
      for (const face of snapshot.faces) {
        graphics.poly(flatten(face.points)).stroke({ color: 0xff6bd6, alpha: 0.72, width: 1 });
      }
    }
  }

  for (const unit of units()) {
    const point = project(unit.position);
    graphics.moveTo(point.x - 5, point.y).lineTo(point.x + 5, point.y)
      .moveTo(point.x, point.y - 5).lineTo(point.x, point.y + 5)
      .stroke({ color: 0xffffff, alpha: 0.9, width: 1.2 });
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
