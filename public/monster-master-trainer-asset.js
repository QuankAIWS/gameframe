const TRAINER_ASSET = "/assets/monster-master/trainers/master-trainer-v1-128.webp";
const LAYER_ID = "monster-master-trainer-asset-layer";
const STYLE_ID = "monster-master-trainer-asset-style";
const tokens = new Map();

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${LAYER_ID} {
      position: absolute;
      inset: 0;
      z-index: 2;
      overflow: hidden;
      pointer-events: none;
    }

    .monster-master-trainer-token {
      position: absolute;
      width: 94px;
      height: 104px;
      transform-origin: 50% 100%;
      will-change: transform, opacity;
    }

    .monster-master-trainer-token::before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 5px;
      width: 88px;
      height: 88px;
      transform: translateX(-50%);
      border-radius: 50%;
      background: radial-gradient(circle at 50% 60%, rgba(7, 13, 22, .98) 0 50%, rgba(14, 30, 43, .9) 51% 61%, rgba(71, 176, 216, .32) 62% 68%, transparent 69%);
      filter: drop-shadow(0 8px 8px rgba(0, 0, 0, .42));
    }

    .monster-master-trainer-token[data-team="beta"]::before {
      background: radial-gradient(circle at 50% 60%, rgba(15, 8, 16, .98) 0 50%, rgba(45, 18, 28, .9) 51% 61%, rgba(226, 94, 103, .32) 62% 68%, transparent 69%);
    }

    .monster-master-trainer-token img {
      position: absolute;
      left: 50%;
      bottom: 3px;
      display: block;
      width: auto;
      height: 100px;
      transform: translateX(-50%);
      transform-origin: 50% 100%;
      user-select: none;
      -webkit-user-drag: none;
      filter: drop-shadow(0 7px 5px rgba(0, 0, 0, .55));
    }

    .monster-master-trainer-token[data-facing="left"] img {
      transform: translateX(-50%) scaleX(-1);
    }

    .monster-master-trainer-token[data-defeated="true"] {
      opacity: .48;
      filter: grayscale(.75);
    }

    body.monster-master-pixi-ready .monster-master-turn-portrait[data-role="master"],
    body.monster-master-pixi-ready .monster-master-unit-hud[data-role="master"] .monster-master-unit-portrait {
      background-image: url("${TRAINER_ASSET}") !important;
      background-size: contain !important;
      background-position: 50% 50% !important;
      background-repeat: no-repeat !important;
    }
  `;
  document.head.append(style);
}

function ensureLayer() {
  const frame = document.querySelector(".combat-canvas-frame");
  if (!frame) return null;
  let layer = document.getElementById(LAYER_ID);
  if (!layer) {
    layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.setAttribute("aria-hidden", "true");
    frame.append(layer);
  }
  return layer;
}

function tokenFor(unit, layer) {
  let token = tokens.get(unit.id);
  if (token) return token;
  token = document.createElement("div");
  token.className = "monster-master-trainer-token";
  token.dataset.unitId = unit.id;
  const image = document.createElement("img");
  image.src = TRAINER_ASSET;
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  token.append(image);
  layer.append(token);
  tokens.set(unit.id, token);
  return token;
}

function clearMissing(validIds) {
  for (const [unitId, token] of tokens) {
    if (validIds.has(unitId)) continue;
    token.remove();
    tokens.delete(unitId);
  }
}

function renderTrainerAssets() {
  const layer = ensureLayer();
  const pixi = window.gameFrameMonsterPixi;
  const controller = window.gameFrameMonsterController;
  const view = controller?.getView?.();
  if (!layer || !pixi?.worldToScreen || !view?.observation?.board?.units) {
    if (layer) layer.hidden = true;
    requestAnimationFrame(renderTrainerAssets);
    return;
  }

  const camera = pixi.getCamera?.() ?? { zoom: 1 };
  const zoom = Number.isFinite(camera.zoom) ? camera.zoom : 1;
  const playerIds = view.playerIds ?? [];
  const masters = view.observation.board.units.filter((unit) =>
    unit.role === "master"
    && Number.isFinite(unit.position?.x)
    && Number.isFinite(unit.position?.y)
    && unit.position.x >= 0
    && unit.position.y >= 0
  );
  const validIds = new Set(masters.map((unit) => unit.id));
  clearMissing(validIds);
  layer.hidden = masters.length === 0 || !document.body.classList.contains("monster-master-pixi-ready");

  for (const unit of masters) {
    const point = pixi.worldToScreen(unit.position);
    const token = tokenFor(unit, layer);
    const alphaTeam = unit.ownerId === playerIds[0];
    token.dataset.team = alphaTeam ? "alpha" : "beta";
    token.dataset.facing = alphaTeam ? "left" : "right";
    token.dataset.defeated = String((unit.health ?? 1) <= 0);
    token.style.transform = `translate3d(${point.x}px, ${point.y - (7 * zoom)}px, 0) translate(-50%, -100%) scale(${zoom})`;
  }

  requestAnimationFrame(renderTrainerAssets);
}

installStyles();
const preload = new Image();
preload.src = TRAINER_ASSET;
requestAnimationFrame(renderTrainerAssets);
