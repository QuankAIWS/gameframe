import { gameFrameFetch } from "./gameframe-auth.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const STATE_EVENT = "gameframe:monster-master-rpg-state";
const MAX_REQUEST_TIMEOUT_MS = 12_000;
const RECONCILE_ATTEMPTS = 24;
const RECONCILE_DELAY_MS = 500;

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
    && typeof anchor.semanticId === "string"
    && anchor.semanticId
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

function currentCoordinationRevision() {
  const revision = window.gameFrameMonsterRpgCoordination?.getRevision?.();
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("Campaign coordination state is unavailable. Refresh and try again.");
  }
  return revision;
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
  pendingRequest = {
    type: "exploration_interact",
    protocolVersion: 1,
    campaignId: projection.campaignId,
    sceneId: projection.scene.sceneId,
    materializationRef: materialization.materializationRef,
    expectedPositionRevision: position.positionRevision,
    expectedGameframeCoordinationRevision: currentCoordinationRevision(),
    commandId: `command:${crypto.randomUUID()}`,
    issuedAt: new Date().toISOString(),
    interaction: "travel",
    interactionTargetId: route.interactionTargetId,
  };
  return pendingRequest;
}

function isRuntimeVersionSkew(error) {
  return error?.status >= 400
    && error?.status < 500
    && /command\.interaction contains unsupported fields[^\n]*routeId/i.test(
      `${error?.message || ""}`,
    );
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
  showStatus("Travel command is being accepted…");
  try {
    await requestJson(
      `/api/rpg/campaigns/${encodeURIComponent(request.campaignId)}/exploration/interact`,
      request,
    );
    pendingRequest = null;
    showStatus("Travel accepted. Synchronizing the destination scene…");
    const reconciled = await reconcileSceneChange(request.sceneId);
    showStatus(reconciled
      ? "Travel complete."
      : "Travel was accepted. The map will update when Runtime finishes the scene transfer.");
  } catch (error) {
    if (isRuntimeVersionSkew(error)) {
      // Current Runtime accepts { kind: "travel", routeId }. Do not preserve an
      // exact retry against an older deployed Runtime that cannot understand it;
      // the release pair must be brought back into sync instead.
      pendingRequest = null;
      showStatus("Travel is blocked by a GameFrame / RPG Runtime deployment mismatch.");
      showError("Travel cannot be retried against this deployed RPG Runtime because it is older than the current GameFrame travel contract. Deploy the matched Runtime and GameFrame staging pair, then refresh.");
      return;
    }

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
      void refreshWorld().catch(() => undefined);
      showStatus("Exploration state changed. Refreshing the current scene.");
    } else {
      showStatus("Travel delivery was not confirmed. Retry sends the exact same command.");
    }
    showError(error?.message || "Travel could not be completed.");
  } finally {
    submitting = false;
    synchronize();
  }
}

async function reconcileSceneChange(sourceSceneId) {
  for (let attempt = 0; attempt < RECONCILE_ATTEMPTS; attempt += 1) {
    await refreshWorld().catch(() => undefined);
    const sceneId = worldState().payload?.projection?.scene?.sceneId;
    if (typeof sceneId === "string" && sceneId && sceneId !== sourceSceneId) return true;
    await new Promise((resolve) => window.setTimeout(resolve, RECONCILE_DELAY_MS));
  }
  return false;
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

function showStatus(message) {
  const status = document.querySelector("#mm-rpg-action-status");
  if (status) status.textContent = message || "";
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
