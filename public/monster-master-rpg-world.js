import { gameFrameFetch } from "./gameframe-auth.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const identity = window.gameFrameIdentity;
const SCREEN_DIRECTIONS = Object.freeze(["north", "east", "south", "west"]);
const KEY_DIRECTION_INDEX = Object.freeze({
  KeyW: 0,
  KeyD: 1,
  KeyS: 2,
  KeyA: 3,
});

const state = {
  payload: null,
  view: null,
  campaignId: null,
  attachPromise: null,
  cameraSignature: "",
  playerPosition: null,
  rendererRevision: 0,
  moveInFlight: false,
  queuedDirection: null,
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

function playerPositionFromPayload(payload) {
  const position = payload.playerPosition;
  if (
    position?.type === "exploration_position"
    && position.protocolVersion === 1
    && position.playerEntityId === payload.projection.viewer.playerCharacterEntityId
  ) return position;

  const anchor = payload.materialization.anchors.find((candidate) =>
    candidate.kind === "player"
    && candidate.semanticId === payload.projection.viewer.playerCharacterEntityId
  );
  if (!anchor) throw new Error("Exploration materialization is missing the player position.");
  return {
    type: "exploration_position",
    protocolVersion: 1,
    campaignId: payload.projection.campaignId,
    sceneId: payload.projection.scene.sceneId,
    playerEntityId: payload.projection.viewer.playerCharacterEntityId,
    materializationRef: { ...payload.materialization.materializationRef },
    positionRevision: 0,
    transform: { x: anchor.x, y: anchor.y, facing: "west" },
    moved: false,
  };
}

function syntheticUnit(anchor, playerId, playerPosition) {
  if (anchor.kind !== "player" && anchor.kind !== "entity") return null;
  const role = anchor.kind === "player"
    ? "master"
    : anchor.entityClass === "monster"
      ? "emberling"
      : "master";
  const position = anchor.kind === "player"
    ? playerPosition.transform
    : anchor;
  return {
    id: anchor.semanticId,
    ownerId: anchor.kind === "player" ? playerId : "world",
    role,
    position: { x: position.x, y: position.y },
    health: 1,
    maxHealth: 1,
  };
}

function rendererRevision(payload, playerPosition) {
  return payload.materialization.semanticRevision * 1_000_000 + playerPosition.positionRevision;
}

function toRendererView(payload, playerPosition) {
  const { projection, materialization } = payload;
  const playerId = projection.viewer.playerId;
  const units = materialization.anchors
    .map((anchor) => syntheticUnit(anchor, playerId, playerPosition))
    .filter(Boolean);
  return {
    gameId: "monster-master-duel",
    matchId: materialization.materializationRef.materializationId,
    revision: rendererRevision(payload, playerPosition),
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

function watchCamera() {
  const renderer = window.gameFrameMonsterPixi;
  const camera = renderer?.getCamera?.();
  if (camera && state.payload) {
    const signature = `${camera.x}:${camera.y}:${camera.zoom}:${camera.quarter}`;
    if (signature !== state.cameraSignature) {
      state.cameraSignature = signature;
      scheduleAnchors();
    }
  }
  requestAnimationFrame(watchCamera);
}

function updateWorldHeader(payload) {
  const location = document.querySelector("#mm-rpg-world-location");
  const reference = document.querySelector("#mm-rpg-world-materialization");
  if (location) location.textContent = payload.projection.scene.location.label;
  if (reference) {
    reference.textContent = `${payload.materialization.materializationRef.materializationId} · v${payload.materialization.materializationRef.version}`;
  }
  updateMovementStatus(state.playerPosition);
}

function updateMovementStatus(position) {
  if (!position) return setWorldStatus("Materialized · exploration");
  if (position.blockedBy) {
    setWorldStatus(`Blocked · ${position.blockedBy} · facing ${position.transform.facing}`);
    return;
  }
  setWorldStatus(
    `Exploring · ${position.transform.x},${position.transform.y} · facing ${position.transform.facing}`,
  );
}

function setWorldStatus(message) {
  const status = document.querySelector("#mm-rpg-world-status");
  if (status) status.textContent = message;
}

function touchControls() {
  return document.querySelector("#mm-rpg-touch-controls");
}

function syncTouchControls() {
  const controls = touchControls();
  if (controls) controls.hidden = !state.payload || !currentCampaignId();
}

function screenDirection(code) {
  const base = KEY_DIRECTION_INDEX[code];
  if (!Number.isInteger(base)) return null;
  const quarter = ((Math.round(window.gameFrameMonsterPixi?.getCamera?.()?.quarter ?? 0) % 4) + 4) % 4;
  return SCREEN_DIRECTIONS[(base - quarter + 4) % 4];
}

function rotateView(direction) {
  const renderer = window.gameFrameMonsterPixi;
  if (!renderer) return false;
  const rotated = direction === "left"
    ? renderer.rotateLeft?.()
    : renderer.rotateRight?.();
  if (rotated === undefined && !renderer.getCamera) return false;
  scheduleAnchors();
  return true;
}

function makeTouchButton({ label, text, control, onPress }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mm-rpg-touch-button";
  button.dataset.rpgTouch = control;
  button.setAttribute("aria-label", label);
  button.textContent = text;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onPress();
  });
  return button;
}

function ensureTouchControls() {
  if (touchControls()) return touchControls();
  const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
  if (!stage) return null;

  const controls = document.createElement("div");
  controls.id = "mm-rpg-touch-controls";
  controls.className = "mm-rpg-touch-controls";
  controls.setAttribute("aria-label", "Exploration touch controls");
  controls.hidden = true;

  const dpad = document.createElement("div");
  dpad.className = "mm-rpg-touch-dpad";
  dpad.setAttribute("aria-label", "Move");
  const directionalControls = [
    { label: "Move up", text: "▲", control: "move-up", code: "KeyW", className: "is-up" },
    { label: "Move left", text: "◀", control: "move-left", code: "KeyA", className: "is-left" },
    { label: "Move right", text: "▶", control: "move-right", code: "KeyD", className: "is-right" },
    { label: "Move down", text: "▼", control: "move-down", code: "KeyS", className: "is-down" },
  ];
  for (const entry of directionalControls) {
    const button = makeTouchButton({
      label: entry.label,
      text: entry.text,
      control: entry.control,
      onPress: () => {
        const direction = screenDirection(entry.code);
        if (direction) queueMove(direction);
      },
    });
    button.classList.add(entry.className);
    dpad.append(button);
  }

  const camera = document.createElement("div");
  camera.className = "mm-rpg-touch-camera";
  camera.setAttribute("aria-label", "Rotate view");
  camera.append(
    makeTouchButton({
      label: "Rotate view left",
      text: "↶",
      control: "rotate-left",
      onPress: () => rotateView("left"),
    }),
    makeTouchButton({
      label: "Rotate view right",
      text: "↷",
      control: "rotate-right",
      onPress: () => rotateView("right"),
    }),
  );

  controls.append(dpad, camera);
  stage.append(controls);
  syncTouchControls();
  return controls;
}

function present(value) {
  const payload = requireMaterializedPayload(value);
  const previousSceneId = state.payload?.projection?.scene?.sceneId ?? null;
  const playerPosition = playerPositionFromPayload(payload);
  state.payload = payload;
  state.campaignId = payload.projection.campaignId;
  state.cameraSignature = "";
  state.playerPosition = playerPosition;
  state.rendererRevision = rendererRevision(payload, playerPosition);
  state.moveInFlight = false;
  state.queuedDirection = null;
  state.view = toRendererView(payload, playerPosition);
  updateWorldHeader(payload);
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { view: state.view } }));
  if (previousSceneId && previousSceneId !== payload.projection.scene.sceneId) {
    requestAnimationFrame(() => window.gameFrameMonsterPixi?.centerActive?.());
  }
  scheduleAnchors();
  ensureTouchControls();
  syncTouchControls();
  return state.view;
}

function clear() {
  state.payload = null;
  state.view = null;
  state.campaignId = null;
  state.cameraSignature = "";
  state.playerPosition = null;
  state.rendererRevision = 0;
  state.moveInFlight = false;
  state.queuedDirection = null;
  anchorLayer()?.replaceChildren();
  syncTouchControls();
  setWorldStatus("No scene attached");
}

function currentCampaignId() {
  const panel = document.querySelector("#mm-rpg-campaign");
  if (!panel || panel.hidden) return null;
  const value = new URLSearchParams(window.location.search).get("campaign")?.trim();
  return value || null;
}

async function attachCurrentCampaign({ quiet = false } = {}) {
  const campaignId = currentCampaignId();
  if (!campaignId || !identity?.playerId) return null;
  if (state.attachPromise?.campaignId === campaignId) return state.attachPromise.promise;
  if (!quiet) setWorldStatus("Materializing…");

  let promise;
  promise = gameFrameFetch(
    `/api/rpg/campaigns/${encodeURIComponent(campaignId)}/exploration/attach`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.exploration.attach",
        campaignId,
      }),
    },
    identity,
  ).then(async (response) => {
    const text = await response.text();
    const value = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(value?.message || `Exploration materialization failed (${response.status}).`);
    }
    if (currentCampaignId() !== campaignId) return null;
    return present(value);
  }).catch((error) => {
    if (currentCampaignId() === campaignId) {
      setWorldStatus("Scene unavailable");
      const banner = document.querySelector("#mm-rpg-error");
      if (banner && !quiet) {
        banner.hidden = false;
        banner.textContent = error instanceof Error ? error.message : "The campaign scene could not be materialized.";
      }
    }
    throw error;
  }).finally(() => {
    if (state.attachPromise?.promise === promise) state.attachPromise = null;
  });
  state.attachPromise = { campaignId, promise };
  return promise;
}

function moveRequest(direction) {
  if (!state.payload || !state.playerPosition) return null;
  return {
    type: "exploration_move",
    protocolVersion: 1,
    campaignId: state.payload.projection.campaignId,
    sceneId: state.payload.projection.scene.sceneId,
    materializationRef: { ...state.payload.materialization.materializationRef },
    expectedPositionRevision: state.playerPosition.positionRevision,
    direction,
  };
}

async function sendMovementHttp(request) {
  const response = await gameFrameFetch(
    `/api/rpg/campaigns/${encodeURIComponent(request.campaignId)}/exploration/move`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    identity,
  );
  const text = await response.text();
  const value = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(value?.message || `Exploration movement failed (${response.status}).`);
    error.status = response.status;
    error.code = value?.error;
    throw error;
  }
  return value;
}

function queueMove(direction) {
  if (!state.payload || !state.playerPosition || !SCREEN_DIRECTIONS.includes(direction)) return false;
  state.queuedDirection = direction;
  drainMoveQueue();
  return true;
}

function drainMoveQueue() {
  if (state.moveInFlight || !state.queuedDirection || !state.payload || !state.playerPosition) return;
  const direction = state.queuedDirection;
  state.queuedDirection = null;
  const request = moveRequest(direction);
  if (!request) return;
  state.moveInFlight = true;

  void sendMovementHttp(request).then((position) => {
    acceptPosition(position);
  }).catch((error) => {
    state.moveInFlight = false;
    if (
      error?.status === 409
      || error?.code === "position-revision-conflict"
      || error?.code === "stale-materialization"
      || error?.code === "exploration-session-unavailable"
    ) {
      void attachCurrentCampaign({ quiet: true }).catch(() => undefined);
    } else {
      const banner = document.querySelector("#mm-rpg-error");
      if (banner) {
        banner.hidden = false;
        banner.textContent = error?.message || "Exploration movement could not be delivered.";
      }
    }
    drainMoveQueue();
  });
}

function acceptPosition(position) {
  if (!state.payload || !state.view) return false;
  if (
    position?.type !== "exploration_position"
    || position.protocolVersion !== 1
    || position.campaignId !== state.payload.projection.campaignId
    || position.sceneId !== state.payload.projection.scene.sceneId
    || position.playerEntityId !== state.payload.projection.viewer.playerCharacterEntityId
    || position.materializationRef?.materializationId !== state.payload.materialization.materializationRef.materializationId
    || position.materializationRef?.version !== state.payload.materialization.materializationRef.version
    || position.materializationRef?.hash !== state.payload.materialization.materializationRef.hash
    || !Number.isSafeInteger(position.positionRevision)
    || !position.transform
    || !Number.isSafeInteger(position.transform.x)
    || !Number.isSafeInteger(position.transform.y)
    || !SCREEN_DIRECTIONS.includes(position.transform.facing)
  ) return false;

  state.playerPosition = position;
  state.payload.playerPosition = position;
  state.rendererRevision = rendererRevision(state.payload, position);
  const playerEntityId = position.playerEntityId;
  const units = state.view.observation.board.units.map((unit) =>
    unit.id === playerEntityId
      ? { ...unit, position: { x: position.transform.x, y: position.transform.y } }
      : unit
  );
  state.view = {
    ...state.view,
    revision: state.rendererRevision,
    observation: {
      ...state.view.observation,
      board: {
        ...state.view.observation.board,
        units,
      },
    },
  };
  updateMovementStatus(position);
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { view: state.view } }));
  scheduleAnchors();
  requestAnimationFrame(() => window.gameFrameMonsterPixi?.centerActive?.());
  state.moveInFlight = false;
  drainMoveQueue();
  return true;
}

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

function handleKeydown(event) {
  if (
    event.defaultPrevented
    || event.ctrlKey
    || event.metaKey
    || event.altKey
    || isEditableTarget(event.target)
    || !currentCampaignId()
    || !state.payload
  ) return;

  const direction = screenDirection(event.code);
  if (direction) {
    if (queueMove(direction)) event.preventDefault();
    return;
  }
  if ((event.code === "KeyQ" || event.code === "KeyE") && !event.repeat) {
    if (rotateView(event.code === "KeyQ" ? "left" : "right")) event.preventDefault();
  }
}

window.gameFrameMonsterController = Object.freeze({
  getView: () => state.view,
  handleCoordinate: () => false,
});

window.gameFrameMonsterRpgWorld = Object.freeze({
  present,
  clear,
  attachCurrentCampaign,
  refreshAnchors: scheduleAnchors,
  move: queueMove,
  handleKeydown,
  getPayload: () => state.payload,
  getView: () => state.view,
  getPlayerPosition: () => state.playerPosition,
});

const campaignPanel = document.querySelector("#mm-rpg-campaign");
if (campaignPanel) {
  new MutationObserver(() => {
    if (campaignPanel.hidden) {
      clear();
      return;
    }
    void attachCurrentCampaign().catch(() => undefined);
  }).observe(campaignPanel, { attributes: true, attributeFilter: ["hidden"] });
}

document.querySelector("#mm-rpg-refresh")?.addEventListener("click", () => {
  window.setTimeout(() => void attachCurrentCampaign({ quiet: true }).catch(() => undefined), 0);
});
document.querySelector("#mm-rpg-switch")?.addEventListener("click", clear);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("resize", scheduleAnchors);
ensureTouchControls();
requestAnimationFrame(watchCamera);