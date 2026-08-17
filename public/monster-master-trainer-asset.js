const LAYER_ID = "monster-master-trainer-asset-layer";
const STYLE_ID = "monster-master-trainer-asset-style";
const BASE_BATTLEFIELD_HEIGHT = 96;
const TRAINER_ASSET = "/assets/monster-master/trainers/master-trainer-v1-128.webp";
const ROOTMAW_CONTENT_ID = "rootmaw-brute-v1";
const ROOTMAW_ASSET = "/assets/monster-master/creatures/rootmaw-brute-v1-128.webp";
const GLOAMSPORE_CONTENT_ID = "gloamspore-stalker-v1";
const GLOAMSPORE_ASSET = "/assets/monster-master/creatures/gloamspore-stalker-v1-128.svg";
const tokens = new Map();

const GENERIC_TRAINER = Object.freeze({
  kind: "trainer",
  asset: TRAINER_ASSET,
  label: "Master",
  glyph: "M",
  prototypeLabel: "Warden Master",
  authoredFacing: "left",
  summary: "Command-focused Master unit.",
  anchorY: 0.9,
  battlefieldScale: 1,
});

// Keep these battlefield values synchronized with assets/monster-master/manifest.json.
// The artwork files have different transparent padding and silhouettes, so a shared
// CSS height/translate is not sufficient to make them read as standing on a tile.
const ILLUSTRATED_ASSETS = Object.freeze({
  "vanguard-trainer-v1": Object.freeze({ kind: "vanguard", asset: "/assets/monster-master/trainers/vanguard-trainer-v1-128.webp", label: "Vanguard", glyph: "V", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Field-ready Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),
  "commander-trainer-v1": Object.freeze({ kind: "commander", asset: "/assets/monster-master/trainers/commander-trainer-v1-128.webp", label: "Commander", glyph: "C", prototypeLabel: "Warden Master", authoredFacing: "right", summary: "Tactical command Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),
  "arcanic-trainer-v1": Object.freeze({ kind: "arcanic", asset: "/assets/monster-master/trainers/arcanic-trainer-v1-128.webp", label: "Arcanic", glyph: "A", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Arcane-tech Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),
  "medic-trainer-v1": Object.freeze({ kind: "medic", asset: "/assets/monster-master/trainers/medic-trainer-v1-128.webp", label: "Medic", glyph: "M", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Creature-care Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),
  "caller-trainer-v1": Object.freeze({ kind: "caller", asset: "/assets/monster-master/trainers/caller-trainer-v1-128.webp", label: "Caller", glyph: "C", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Roster-management Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),
  [ROOTMAW_CONTENT_ID]: Object.freeze({ kind: "rootmaw", asset: ROOTMAW_ASSET, label: "Rootmaw Brute", glyph: "R", prototypeLabel: "Stone Bulwark", authoredFacing: "left", summary: "Mossbound heavy monster · slow, durable, and built for brutal close pressure.", anchorY: 0.88, battlefieldScale: 1.58 }),
  [GLOAMSPORE_CONTENT_ID]: Object.freeze({ kind: "gloamspore", asset: GLOAMSPORE_ASSET, label: "Gloamspore Stalker", glyph: "G", prototypeLabel: "Emberling Skirmisher", authoredFacing: "left", summary: "Arcane skirmisher · quick, fragile, and built to threaten from the flank.", anchorY: 0.9, battlefieldScale: 1.36 }),
  "stormcrest-skitter-v1": Object.freeze({ kind: "stormcrest", asset: "/assets/monster-master/creatures/stormcrest-skitter-v1-128.webp", label: "Stormcrest Skitter", glyph: "S", prototypeLabel: "Emberling", authoredFacing: "left", summary: "Fast harassment monster.", anchorY: 0.9, battlefieldScale: 1.18 }),
});

function catalogPresentation(unit) {
  if (!unit?.contentId) return null;
  return ILLUSTRATED_ASSETS[unit.contentId] ?? null;
}

function presentationFor(unit) {
  if (!unit) return null;
  return catalogPresentation(unit) ?? (unit.role === "master" ? GENERIC_TRAINER : null);
}

window.gameFrameMonsterIllustratedAssets = Object.freeze({
  hasAsset: (unit) => Boolean(presentationFor(unit)),
  presentationFor: (unit) => presentationFor(unit),
});

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
      --monster-master-contact-shadow-width: 72px;
      --monster-master-contact-shadow-height: 16px;
      position: absolute;
      width: 0;
      height: 0;
      transform-origin: 0 0;
      pointer-events: none;
      will-change: transform, opacity;
    }

    .monster-master-trainer-token::before {
      content: "";
      position: absolute;
      z-index: 0;
      left: 0;
      top: 0;
      width: var(--monster-master-contact-shadow-width);
      height: var(--monster-master-contact-shadow-height);
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(0, 0, 0, .30) 0 30%, rgba(0, 0, 0, .15) 52%, transparent 76%);
      filter: blur(1.5px);
    }

    .monster-master-trainer-token img {
      position: absolute;
      z-index: 1;
      left: 0;
      display: block;
      width: auto;
      max-width: none;
      transform: translateX(-50%);
      transform-origin: 50% 100%;
      user-select: none;
      -webkit-user-drag: none;
      filter: drop-shadow(0 6px 5px rgba(0, 0, 0, .50));
    }

    .monster-master-trainer-token[data-flipped="true"] img {
      transform: translateX(-50%) scaleX(-1);
    }

    .monster-master-trainer-token[data-defeated="true"] {
      opacity: .46;
      filter: grayscale(.7);
    }

    .monster-master-unit-portrait[data-illustrated-content-id],
    .monster-master-turn-portrait[data-role="master"],
    .monster-master-turn-portrait[data-illustrated-content-id] {
      background-color: rgba(8, 15, 26, .78) !important;
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

function configureToken(token, unit) {
  const presentation = presentationFor(unit);
  const image = token?.querySelector("img");
  if (!presentation || !image) return false;

  const artHeight = Math.round(BASE_BATTLEFIELD_HEIGHT * presentation.battlefieldScale);
  const shadowWidth = Math.max(62, Math.min(100, Math.round(artHeight * 0.66)));
  const shadowHeight = Math.max(13, Math.min(20, Math.round(artHeight * 0.12)));
  const expectedSrc = new URL(presentation.asset, window.location.href).href;
  if (image.src !== expectedSrc) image.src = presentation.asset;

  image.style.height = `${artHeight}px`;
  image.style.top = `${-(artHeight * presentation.anchorY)}px`;
  token.dataset.assetKind = presentation.kind;
  token.dataset.contentId = unit.contentId ?? "";
  token.dataset.anchorY = String(presentation.anchorY);
  token.dataset.artHeight = String(artHeight);
  token.style.setProperty("--monster-master-contact-shadow-width", `${shadowWidth}px`);
  token.style.setProperty("--monster-master-contact-shadow-height", `${shadowHeight}px`);
  return true;
}

function tokenFor(unit, layer) {
  if (!presentationFor(unit)) return null;
  let token = tokens.get(unit.id);
  if (!token) {
    token = document.createElement("div");
    token.className = "monster-master-trainer-token";
    token.dataset.unitId = unit.id;
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.draggable = false;
    token.append(image);
    layer.append(token);
    tokens.set(unit.id, token);
  }
  return configureToken(token, unit) ? token : null;
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

function unitById(view, unitId) {
  if (!unitId) return null;
  return rosterUnits(view).find((unit) => unit.id === unitId) ?? null;
}

function diagnostics() {
  try {
    return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
  } catch {
    return {};
  }
}

function selectedPresentationUnit(view) {
  if (!view?.observation) return null;
  const state = diagnostics();
  const inspectedId = document.querySelector("[data-turn-unit-id].is-inspected")?.dataset.turnUnitId;
  const selectedId = inspectedId ?? (view.observation.phase === "deployment"
    ? state.selectedUnitId ?? view.observation.activeUnitId
    : view.observation.activeUnitId ?? state.selectedUnitId);
  return unitById(view, selectedId);
}

function setPortraitArt(node, unit) {
  const presentation = presentationFor(unit);
  if (!node || !presentation) return;
  node.dataset.illustratedContentId = unit.contentId ?? presentation.kind;
  node.style.setProperty("background-image", `url("${presentation.asset}")`, "important");
  node.style.setProperty("background-size", "contain", "important");
  node.style.setProperty("background-position", "50% 50%", "important");
  node.style.setProperty("background-repeat", "no-repeat", "important");
  node.textContent = "";
}

function clearPortraitArt(node) {
  if (!node?.dataset.illustratedContentId) return;
  delete node.dataset.illustratedContentId;
  for (const property of ["background-image", "background-size", "background-position", "background-repeat"]) {
    node.style.removeProperty(property);
  }
}

function teamLabel(view, unit) {
  if (!unit) return "";
  return unit.ownerId === view.playerIds?.[0] ? "Alpha" : "Beta";
}

function syncPortraits(view) {
  if (!view) return;
  const allUnits = rosterUnits(view);
  const byId = new Map(allUnits.map((unit) => [unit.id, unit]));

  for (const item of document.querySelectorAll("[data-turn-unit-id]")) {
    const unit = byId.get(item.dataset.turnUnitId);
    const presentation = presentationFor(unit);
    const portrait = item.querySelector(".monster-master-turn-portrait");
    if (!unit || !presentation) {
      clearPortraitArt(portrait);
      continue;
    }
    item.dataset.contentId = unit.contentId ?? "";
    const name = item.querySelector("strong");
    if (name) name.textContent = presentation.label;
    setPortraitArt(portrait, unit);
  }

  const selectedUnit = selectedPresentationUnit(view);
  const selectedPresentation = presentationFor(selectedUnit);
  const hud = document.querySelector("#monster-master-unit-hud");
  const hudPortrait = document.querySelector("#monster-master-hud-glyph");
  if (hud && selectedUnit && selectedPresentation) {
    hud.dataset.contentId = selectedUnit.contentId ?? "";
    hud.dataset.role = selectedUnit.role ?? selectedPresentation.kind;
    hud.dataset.owner = selectedUnit.ownerId === view.playerIds?.[0] ? "alpha" : "beta";
    setPortraitArt(hudPortrait, selectedUnit);
    const name = document.querySelector("#monster-master-hud-name");
    const summary = document.querySelector("#monster-master-unit-summary");
    const abilityOwner = document.querySelector("#monster-master-ability-owner");
    if (name) name.textContent = `${teamLabel(view, selectedUnit)} ${selectedPresentation.label}`;
    if (summary && selectedPresentation.summary) summary.textContent = selectedPresentation.summary;
    if (abilityOwner) abilityOwner.textContent = selectedPresentation.label;
    const heavyFrameCopy = document.querySelector('[data-ability-id="heavy-frame"] span');
    if (heavyFrameCopy && selectedUnit.role === "bulwark") {
      heavyFrameCopy.textContent = `Durable ${selectedUnit.maxHealth}-health body built to hold space.`;
    }
    const quickstepCopy = document.querySelector('[data-ability-id="quickstep"] span');
    if (quickstepCopy && selectedUnit.role === "emberling") {
      quickstepCopy.textContent = `Movement ${selectedUnit.movement} and initiative ${selectedUnit.initiative}.`;
    }
  } else {
    delete hud?.dataset.contentId;
    clearPortraitArt(hudPortrait);
  }

  const yourPlayerId = view.observation.yourPlayerId ?? window.gameFrameIdentity?.playerId;
  const undeployed = (view.observation.rosters?.[yourPlayerId] ?? [])
    .filter((unit) => view.observation.undeployedUnitIds?.includes(unit.id));
  const deployButtons = [...document.querySelectorAll('#monster-master-options button[data-action-kind="deploy-unit"]')];
  deployButtons.forEach((button, index) => {
    const unit = undeployed[index];
    const presentation = presentationFor(unit);
    if (!unit || !presentation) return;
    button.dataset.contentId = unit.contentId ?? "";
    const parts = button.textContent.split("·");
    parts[0] = `${presentation.label} `;
    button.textContent = parts.join("·");
  });
}

function renderIllustratedAssets() {
  const layer = ensureLayer();
  const pixi = window.gameFrameMonsterPixi;
  const view = window.gameFrameMonsterController?.getView?.();
  if (!layer || !pixi?.worldToScreen || !view?.observation?.board?.units) {
    if (layer) layer.hidden = true;
    requestAnimationFrame(renderIllustratedAssets);
    return;
  }

  syncPortraits(view);

  const camera = pixi.getCamera?.() ?? { zoom: 1 };
  const zoom = Number.isFinite(camera.zoom) ? camera.zoom : 1;
  const playerIds = view.playerIds ?? [];
  const defeatedIds = new Set(view.observation.defeatedUnitIds ?? []);
  const visibleAssets = view.observation.board.units.filter((unit) =>
    presentationFor(unit)
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
    if (!token || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    const alphaTeam = unit.ownerId === playerIds[0];
    const presentation = presentationFor(unit);
    const targetFacing = alphaTeam ? "right" : "left";
    token.dataset.team = alphaTeam ? "alpha" : "beta";
    token.dataset.facing = targetFacing;
    token.dataset.flipped = String((presentation?.authoredFacing ?? "left") !== targetFacing);
    token.dataset.defeated = String(defeatedIds.has(unit.id) || (unit.health ?? 1) <= 0);
    token.style.zIndex = String(Math.max(1, Math.round(point.y * 10)));
    token.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) scale(${zoom})`;
  }

  requestAnimationFrame(renderIllustratedAssets);
}

installStyles();
for (const path of new Set([GENERIC_TRAINER.asset, ...Object.values(ILLUSTRATED_ASSETS).map((item) => item.asset)])) {
  const preload = new Image();
  preload.src = path;
}
requestAnimationFrame(renderIllustratedAssets);
