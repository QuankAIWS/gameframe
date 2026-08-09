const VIEW_EVENT = "gameframe:monster-master-pixi-view";

const state = {
  payload: null,
  view: null,
};

function requireMaterializedPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Exploration materialization must be an object.");
  }
  if (value.protocolVersion !== 1 || value.kind !== "campaign.exploration_materialized") {
    throw new Error("Exploration materialization protocol is not supported.");
  }
  const projection = value.projection;
  const materialization = value.materialization;
  if (
    !projection
    || projection.kind !== "campaign.exploration_projection"
    || !materialization
    || materialization.kind !== "gameframe.rpg.exploration_materialization"
    || !materialization.map
    || !Array.isArray(materialization.map.cells)
    || !Array.isArray(materialization.anchors)
  ) {
    throw new Error("Exploration materialization is incomplete.");
  }
  return value;
}

function syntheticUnit(anchor, playerId) {
  if (anchor.kind !== "player" && anchor.kind !== "entity") return null;
  const role = anchor.kind === "player"
    ? "master"
    : anchor.entityClass === "monster"
      ? "emberling"
      : "master";
  return {
    id: anchor.semanticId,
    ownerId: anchor.kind === "player" ? playerId : "world",
    role,
    position: { x: anchor.x, y: anchor.y },
    health: 1,
    maxHealth: 1,
  };
}

function toRendererView(payload) {
  const { projection, materialization } = payload;
  const playerId = projection.viewer.playerId;
  const units = materialization.anchors
    .map((anchor) => syntheticUnit(anchor, playerId))
    .filter(Boolean);
  return {
    gameId: "monster-master-duel",
    matchId: materialization.materializationRef.materializationId,
    revision: materialization.semanticRevision,
    playerIds: [playerId, "world"],
    observation: {
      activePlayerId: playerId,
      activeUnitId: projection.viewer.playerCharacterEntityId,
      legalActions: [],
      board: {
        map: materialization.map,
        units,
      },
    },
  };
}

function anchorLayer() {
  return document.querySelector("#mm-rpg-world-anchors");
}

function renderAnchors() {
  const layer = anchorLayer();
  const renderer = window.gameFrameMonsterPixi;
  if (!layer || !renderer?.worldToScreen || !state.payload) return;
  const { materialization } = state.payload;
  const fragments = [];
  for (const anchor of materialization.anchors) {
    if (anchor.kind === "player") continue;
    const point = renderer.worldToScreen({ x: anchor.x, y: anchor.y });
    if (!point) continue;
    const marker = document.createElement("div");
    marker.className = "mm-rpg-world-anchor";
    marker.dataset.kind = anchor.kind;
    marker.dataset.semanticId = anchor.semanticId;
    if (anchor.interactionTargetId) marker.dataset.interactionTargetId = anchor.interactionTargetId;
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
    const dot = document.createElement("span");
    dot.className = "mm-rpg-world-anchor-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "mm-rpg-world-anchor-label";
    label.textContent = anchor.label;
    marker.append(dot, label);
    fragments.push(marker);
  }
  layer.replaceChildren(...fragments);
}

function scheduleAnchors() {
  requestAnimationFrame(() => requestAnimationFrame(renderAnchors));
}

function updateWorldHeader(payload) {
  const location = document.querySelector("#mm-rpg-world-location");
  const status = document.querySelector("#mm-rpg-world-status");
  const reference = document.querySelector("#mm-rpg-world-materialization");
  if (location) location.textContent = payload.projection.scene.location.label;
  if (status) status.textContent = "Materialized · exploration";
  if (reference) {
    reference.textContent = `${payload.materialization.materializationRef.materializationId} · v${payload.materialization.materializationRef.version}`;
  }
}

function present(value) {
  const payload = requireMaterializedPayload(value);
  state.payload = payload;
  state.view = toRendererView(payload);
  updateWorldHeader(payload);
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { view: state.view } }));
  scheduleAnchors();
  return state.view;
}

function clear() {
  state.payload = null;
  state.view = null;
  anchorLayer()?.replaceChildren();
  const status = document.querySelector("#mm-rpg-world-status");
  if (status) status.textContent = "No scene attached";
}

window.gameFrameMonsterController = Object.freeze({
  getView: () => state.view,
  handleCoordinate: () => false,
});

window.gameFrameMonsterRpgWorld = Object.freeze({
  present,
  clear,
  refreshAnchors: scheduleAnchors,
  getPayload: () => state.payload,
  getView: () => state.view,
});

window.addEventListener("resize", scheduleAnchors);
