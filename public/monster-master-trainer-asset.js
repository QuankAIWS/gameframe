const TRAINER_ASSET = "/assets/monster-master/trainers/master-trainer-v1-128.webp";
const ROOTMAW_ASSET = "/assets/monster-master/creatures/rootmaw-brute-v1-128.webp";
const ROOTMAW_CONTENT_ID = "rootmaw-brute-v1";
const LAYER_ID = "monster-master-trainer-asset-layer";
const STYLE_ID = "monster-master-trainer-asset-style";
const tokens = new Map();

function assetKind(unit) {
  if (unit?.role === "master") return "trainer";
  if (unit?.contentId === ROOTMAW_CONTENT_ID) return "rootmaw";
  return null;
}

function assetPath(kind) {
  return kind === "rootmaw" ? ROOTMAW_ASSET : TRAINER_ASSET;
}

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

    .monster-master-trainer-token[data-asset-kind="rootmaw"] {
      width: 118px;
      height: 118px;
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

    .monster-master-trainer-token[data-asset-kind="rootmaw"]::before {
      width: 102px;
      height: 74px;
      bottom: 4px;
      background: radial-gradient(ellipse at 50% 68%, rgba(7, 13, 12, .96) 0 48%, rgba(55, 82, 42, .82) 49% 61%, rgba(213, 135, 44, .24) 62% 68%, transparent 69%);
    }

    .monster-master-trainer-token[data-asset-kind="rootmaw"][data-team="beta"]::before {
      background: radial-gradient(ellipse at 50% 68%, rgba(15, 8, 16, .96) 0 48%, rgba(63, 35, 30, .84) 49% 61%, rgba(226, 94, 103, .24) 62% 68%, transparent 69%);
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

    .monster-master-trainer-token[data-asset-kind="rootmaw"] img {
      height: 116px;
      bottom: 0;
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

    body.monster-master-pixi-ready .monster-master-turn-unit[data-content-id="${ROOTMAW_CONTENT_ID}"] .monster-master-turn-portrait,
    body.monster-master-pixi-ready .monster-master-unit-hud[data-content-id="${ROOTMAW_CONTENT_ID}"] .monster-master-unit-portrait {
      background-image: url("${ROOTMAW_ASSET}") !important;
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
  const kind = assetKind(unit);
  if (!kind) return null;
  if (token) {
    token.dataset.assetKind = kind;
    const image = token.querySelector("img");
    if (image && image.src !== new URL(assetPath(kind), window.location.href).href) image.src = assetPath(kind);
    return token;
  }
  token = document.createElement("div");
  token.className = "monster-master-trainer-token";
  token.dataset.unitId = unit.id;
  token.dataset.assetKind = kind;
  const image = document.createElement("img");
  image.src = assetPath(kind);
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

function rosterUnits(view) {
  return Object.values(view?.observation?.rosters ?? {}).flat();
}

function rootmawUnit(view, unitId) {
  if (!unitId) return null;
  const unit = rosterUnits(view).find((candidate) => candidate.id === unitId) ?? null;
  return unit?.contentId === ROOTMAW_CONTENT_ID ? unit : null;
}

function selectedDeploymentId(view) {
  if (view?.observation?.phase !== "deployment") return null;
  try {
    return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}").selectedUnitId ?? null;
  } catch {
    return null;
  }
}

function syncRootmawPresentation(view) {
  if (!view) return;
  const allUnits = rosterUnits(view);
  const byId = new Map(allUnits.map((unit) => [unit.id, unit]));

  for (const item of document.querySelectorAll("[data-turn-unit-id]")) {
    const unit = byId.get(item.dataset.turnUnitId);
    if (unit?.contentId === ROOTMAW_CONTENT_ID) {
      item.dataset.contentId = ROOTMAW_CONTENT_ID;
      const name = item.querySelector("strong");
      if (name) name.textContent = "Rootmaw Brute";
    } else if (item.dataset.contentId === ROOTMAW_CONTENT_ID) {
      delete item.dataset.contentId;
    }
  }

  const inspectedId = document.querySelector("[data-turn-unit-id].is-inspected")?.dataset.turnUnitId;
  const referenceId = inspectedId
    ?? view.observation.activeUnitId
    ?? selectedDeploymentId(view);
  const rootmaw = rootmawUnit(view, referenceId);
  const hud = document.querySelector("#monster-master-unit-hud");
  if (hud) {
    if (rootmaw) {
      hud.dataset.contentId = ROOTMAW_CONTENT_ID;
      const name = document.querySelector("#monster-master-hud-name");
      const glyph = document.querySelector("#monster-master-hud-glyph");
      const summary = document.querySelector("#monster-master-unit-summary");
      const abilityOwner = document.querySelector("#monster-master-ability-owner");
      if (name) name.textContent = "Rootmaw Brute";
      if (glyph) glyph.textContent = "R";
      if (summary) summary.textContent = "Mossbound heavy monster · slow, durable, and built for brutal close pressure.";
      if (abilityOwner) abilityOwner.textContent = "Rootmaw Brute";
    } else if (hud.dataset.contentId === ROOTMAW_CONTENT_ID) {
      delete hud.dataset.contentId;
    }
  }

  const activeLabel = document.querySelector("#monster-master-active-unit");
  const activeOrSelected = rootmawUnit(view, view.observation.activeUnitId ?? selectedDeploymentId(view));
  if (activeLabel && activeOrSelected) {
    const team = activeOrSelected.id.startsWith("alpha-") ? "Alpha" : "Beta";
    activeLabel.textContent = `${team} Rootmaw Brute`;
  }

  const status = document.querySelector("#monster-master-status");
  if (status && activeOrSelected && status.textContent?.includes("Stone Bulwark")) {
    status.textContent = status.textContent.replace("Stone Bulwark", "Rootmaw Brute");
  }

  const yourPlayerId = view.observation.yourPlayerId ?? window.gameFrameIdentity?.playerId;
  const undeployed = (view.observation.rosters?.[yourPlayerId] ?? [])
    .filter((unit) => view.observation.undeployedUnitIds?.includes(unit.id));
  const deployButtons = [...document.querySelectorAll('#monster-master-options button[data-action-kind="deploy-unit"]')];
  deployButtons.forEach((button, index) => {
    const unit = undeployed[index];
    if (unit?.contentId !== ROOTMAW_CONTENT_ID) return;
    const parts = button.textContent.split("·");
    parts[0] = "Rootmaw Brute ";
    button.textContent = parts.join("·");
  });
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

  syncRootmawPresentation(view);
  const camera = pixi.getCamera?.() ?? { zoom: 1 };
  const zoom = Number.isFinite(camera.zoom) ? camera.zoom : 1;
  const playerIds = view.playerIds ?? [];
  const visibleAssets = view.observation.board.units.filter((unit) =>
    assetKind(unit)
    && Number.isFinite(unit.position?.x)
    && Number.isFinite(unit.position?.y)
    && unit.position.x >= 0
    && unit.position.y >= 0
  );
  const validIds = new Set(visibleAssets.map((unit) => unit.id));
  clearMissing(validIds);
  layer.hidden = visibleAssets.length === 0 || !document.body.classList.contains("monster-master-pixi-ready");

  for (const unit of visibleAssets) {
    const point = pixi.worldToScreen(unit.position);
    const token = tokenFor(unit, layer);
    if (!token) continue;
    const alphaTeam = unit.ownerId === playerIds[0];
    const kind = assetKind(unit);
    token.dataset.team = alphaTeam ? "alpha" : "beta";
    token.dataset.facing = alphaTeam ? "left" : "right";
    token.dataset.defeated = String((unit.health ?? 1) <= 0);
    const verticalOffset = kind === "rootmaw" ? 4 : 7;
    token.style.transform = `translate3d(${point.x}px, ${point.y - (verticalOffset * zoom)}px, 0) translate(-50%, -100%) scale(${zoom})`;
  }

  requestAnimationFrame(renderTrainerAssets);
}

installStyles();
for (const path of [TRAINER_ASSET, ROOTMAW_ASSET]) {
  const preload = new Image();
  preload.src = path;
}
requestAnimationFrame(renderTrainerAssets);
