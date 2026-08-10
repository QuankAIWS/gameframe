import { gameFrameFetch } from "./gameframe-auth.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const STATE_EVENT = "gameframe:monster-master-rpg-state";
const WEST_WOODS_ROUTE_ID = "route.crooked-checkpoint-west-woods";
const MAX_REQUEST_TIMEOUT_MS = 12_000;

const identity = window.gameFrameIdentity;
if (!identity?.playerId) {
  throw new Error("Monster Master RPG travel requires an authenticated GameFrame identity.");
}

let button = null;
let submitting = false;
let pendingRequest = null;

function worldState() {
  const world = window.gameFrameMonsterRpgWorld;
  return {
    payload: world?.getPayload?.() ?? null,
    position: world?.getPlayerPosition?.() ?? null,
  };
}

function currentRouteAnchor() {
  const { payload, position } = worldState();
  if (!payload?.materialization?.anchors || !position?.transform) return null;
  return payload.materialization.anchors.find((anchor) =>
    anchor?.kind === "route"
    && anchor.semanticId === WEST_WOODS_ROUTE_ID
    && typeof anchor.interactionTargetId === "string"
    && anchor.interactionTargetId
    && Number.isSafeInteger(anchor.x)
    && Number.isSafeInteger(anchor.y)
    && Math.abs(anchor.x - position.transform.x) + Math.abs(anchor.y - position.transform.y) === 1
  ) ?? null;
}

function ensureButton() {
  const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
  if (!stage) return null;
  if (button?.isConnected) return button;
  button = document.createElement("button");
  button.type = "button";
  button.id = "mm-rpg-travel-control";
  button.className = "mm-rpg-world-interact mm-rpg-world-travel-control";
  button.hidden = true;
  button.addEventListener("click", () => void travel());
  stage.append(button);
  return button;
}

function synchronize() {
  const control = ensureButton();
  if (!control) return;
  const route = currentRouteAnchor();
  control.hidden = !route && !pendingRequest;
  control.disabled = submitting;
  control.textContent = submitting
    ? "Traveling…"
    : pendingRequest
      ? "Retry travel"
      : route?.label
        ? `Travel · ${route.label}`
        : "Travel";
}

function buildPendingRequest() {
  if (pendingRequest) return pendingRequest;
  const route = currentRouteAnchor();
  const { payload, position } = worldState();
  const projection = payload?.projection;
  const materialization = payload?.materialization;
  if (!route || !projection || !materialization || !position) {
    throw new Error("Move to the route edge before traveling.");
  }
  if (!Number.isSafeInteger(projection.gameframeCoordinationRevision)) {
    throw new Error("Campaign coordination state is unavailable. Refresh and try again.");
  }
  pendingRequest = {
    type: "exploration_interact",
    protocolVersion: 1,
    campaignId: projection.campaignId,
    sceneId: projection.scene.sceneId,
    materializationRef: materialization.materializationRef,
    expectedPositionRevision: position.positionRevision,
    expectedGameframeCoordinationRevision: projection.gameframeCoordinationRevision,
    commandId: `command:${crypto.randomUUID()}`,
    issuedAt: new Date().toISOString(),
    interaction: "travel",
    interactionTargetId: route.interactionTargetId,
  };
  return pendingRequest;
}

async function travel() {
  if (submitting) return;
  let request;
  try {
    request = buildPendingRequest();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Travel is not available here.");
    return;
  }

  submitting = true;
  synchronize();
  showError("");
  try {
    await requestJson(
      `/api/rpg/campaigns/${encodeURIComponent(request.campaignId)}/exploration/interact`,
      request,
    );
    pendingRequest = null;
    await refreshWorld();
  } catch (error) {
    const physicalConflict = error?.status === 409 && [
      "position-revision-conflict",
      "stale-materialization",
      "interaction-target-unavailable",
      "interaction-out-of-range",
    ].includes(error?.code);
    const coordinationConflict = error?.status === 409
      && /revision|coordination|stale/i.test(`${error?.code || ""} ${error?.message || ""}`);
    if (physicalConflict || coordinationConflict) {
      pendingRequest = null;
      await refreshWorld().catch(() => undefined);
    }
    showError(error?.message || "Travel could not be completed.");
  } finally {
    submitting = false;
    synchronize();
  }
}

async function refreshWorld() {
  await window.gameFrameMonsterRpgApp?.refresh?.();
  await window.gameFrameMonsterRpgWorld?.attachCurrentCampaign?.({ quiet: true });
}

async function requestJson(path, body) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), MAX_REQUEST_TIMEOUT_MS);
  try {
    const response = await gameFrameFetch(path, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }, identity);
    const text = await response.text();
    const value = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(value?.message || `GameFrame request failed (${response.status}).`);
      error.status = response.status;
      error.code = value?.error || "request_failed";
      throw error;
    }
    return value;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("GameFrame did not confirm travel before timeout.");
      timeoutError.code = "request_timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function showError(message) {
  const error = document.querySelector("#mm-rpg-error");
  if (!error) return;
  error.textContent = message || "";
  error.hidden = !message;
}

window.gameFrameMonsterRpgTravelControl = Object.freeze({
  getPendingRequest: () => pendingRequest ? structuredClone(pendingRequest) : null,
  refresh: synchronize,
});

window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));
window.addEventListener("gameframe:before-home", () => {
  submitting = false;
  pendingRequest = null;
  if (button) button.hidden = true;
});
window.addEventListener("resize", synchronize);
queueMicrotask(synchronize);
