import { gameFrameFetch } from "./gameframe-auth.js";
import { buildExplorationTalkRequest } from "./monster-master-rpg-model.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const STATE_EVENT = "gameframe:monster-master-rpg-state";
const CHECKPOINT_CART_ID = "object.checkpoint-cart";
const UNCOVER_ACTION = "Uncover the checkpoint cart.";
const MAX_REQUEST_TIMEOUT_MS = 12_000;

const identity = window.gameFrameIdentity;
if (!identity?.playerId) {
  throw new Error("Monster Master RPG object control requires an authenticated GameFrame identity.");
}

let button = null;
let submitting = false;
let pendingRequest = null;
let anchorObserver = null;

function worldState() {
  const world = window.gameFrameMonsterRpgWorld;
  return {
    payload: world?.getPayload?.() ?? null,
    position: world?.getPlayerPosition?.() ?? null,
  };
}

function visibleCartAnchor() {
  const { payload } = worldState();
  if (!payload?.materialization?.anchors) return null;
  return payload.materialization.anchors.find((anchor) =>
    anchor?.kind === "object"
    && anchor.semanticId === CHECKPOINT_CART_ID
    && anchor.objectState === "covered"
    && typeof anchor.interactionTargetId === "string"
    && anchor.interactionTargetId
    && Number.isSafeInteger(anchor.x)
    && Number.isSafeInteger(anchor.y)
  ) ?? null;
}

function currentCartAnchor() {
  const cart = visibleCartAnchor();
  const { position } = worldState();
  if (!cart || !position?.transform) return null;
  return Math.abs(cart.x - position.transform.x) + Math.abs(cart.y - position.transform.y) === 1
    ? cart
    : null;
}

function ensureButton() {
  const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
  if (!stage) return null;
  if (!button?.isConnected) {
    button = document.createElement("button");
    button.type = "button";
    button.id = "mm-rpg-object-control";
    button.className = "mm-rpg-world-interact mm-rpg-world-object-control";
    button.textContent = "Uncover cart";
    button.hidden = true;
    button.addEventListener("click", () => void uncoverCart());
    stage.append(button);
  }
  ensureAnchorObserver();
  return button;
}

function ensureAnchorObserver() {
  const layer = document.querySelector("#mm-rpg-world-anchors");
  if (!layer) return;
  if (anchorObserver?.layer === layer) {
    decorateCartAnchor();
    return;
  }
  anchorObserver?.observer?.disconnect?.();
  const observer = new MutationObserver(() => queueMicrotask(decorateCartAnchor));
  observer.observe(layer, { childList: true });
  anchorObserver = { layer, observer };
  decorateCartAnchor();
}

function decorateCartAnchor() {
  const layer = document.querySelector("#mm-rpg-world-anchors");
  if (!layer) return;
  for (const marker of layer.querySelectorAll(".mm-rpg-world-anchor")) {
    marker.classList.remove("has-attention");
    marker.querySelector(".mm-rpg-world-anchor-attention")?.remove();
  }
  const cart = visibleCartAnchor();
  if (!cart) return;
  const marker = [...layer.querySelectorAll(".mm-rpg-world-anchor[data-kind='object']")]
    .find((candidate) => candidate.dataset.semanticId === CHECKPOINT_CART_ID);
  if (!marker) return;
  marker.classList.add("has-attention");
  const attention = document.createElement("button");
  attention.type = "button";
  attention.className = "mm-rpg-world-anchor-attention";
  attention.setAttribute("aria-label", "Approach the covered checkpoint cart");
  attention.title = "Something here can be investigated";
  attention.textContent = "!";
  attention.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (currentCartAnchor()) {
      void uncoverCart();
      return;
    }
    void window.gameFrameMonsterRpgClickMove?.moveTo?.({ x: cart.x, y: cart.y });
  });
  marker.prepend(attention);
}

function synchronize() {
  const control = ensureButton();
  if (!control) return;
  const available = Boolean(currentCartAnchor()) || Boolean(pendingRequest);
  control.hidden = !available;
  control.disabled = submitting;
  control.textContent = submitting
    ? "Uncovering…"
    : pendingRequest
      ? "Retry uncover"
      : "Uncover cart";
  decorateCartAnchor();
}

async function buildPendingRequest() {
  if (pendingRequest) return pendingRequest;
  const snapshot = await window.gameFrameMonsterRpgCoordination?.freshExplorationState?.();
  if (!snapshot) throw new Error("The current exploration command state is unavailable. Refresh and try again.");
  const cart = currentCartAnchor();
  const { payload, position, revision } = snapshot;
  const projection = payload?.projection;
  const materialization = payload?.materialization;
  if (!cart || !projection || !materialization || !position) {
    throw new Error("Move next to the covered checkpoint cart before uncovering it.");
  }
  pendingRequest = {
    ...buildExplorationTalkRequest({
      campaignId: projection.campaignId,
      commandId: `command:${crypto.randomUUID()}`,
      expectedGameframeCoordinationRevision: revision,
      sceneId: projection.scene.sceneId,
      materializationRef: materialization.materializationRef,
      expectedPositionRevision: position.positionRevision,
      interactionTargetId: cart.interactionTargetId,
      text: UNCOVER_ACTION,
    }),
    issuedAt: new Date().toISOString(),
  };
  return pendingRequest;
}

async function uncoverCart() {
  if (submitting) return;
  let request;
  try {
    request = await buildPendingRequest();
  } catch (error) {
    showError(error instanceof Error ? error.message : "The checkpoint cart cannot be uncovered now.");
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
    showError(error?.message || "The checkpoint cart could not be changed.");
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
      const timeoutError = new Error("GameFrame did not confirm the cart change before timeout.");
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

window.gameFrameMonsterRpgObjectControl = Object.freeze({
  getPendingRequest: () => pendingRequest ? structuredClone(pendingRequest) : null,
  refresh: synchronize,
});

window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));
window.addEventListener("gameframe:before-home", () => {
  submitting = false;
  pendingRequest = null;
  anchorObserver?.observer?.disconnect?.();
  anchorObserver = null;
  if (button) button.hidden = true;
});
window.addEventListener("resize", synchronize);
queueMicrotask(synchronize);
