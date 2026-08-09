import { gameFrameFetch } from "./gameframe-auth.js";
import { buildExplorationTalkRequest } from "./monster-master-rpg-model.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const NEARBY_EVENT = "gameframe:rpg-nearby-interaction";
const TALK_REQUEST_EVENT = "gameframe:rpg-talk-requested";
const MAX_REQUEST_TIMEOUT_MS = 12_000;

const identity = window.gameFrameIdentity;
if (!identity?.playerId) {
  throw new Error("Monster Master RPG Talk requires an authenticated GameFrame identity.");
}

const elements = {
  form: document.querySelector("#mm-rpg-action-form"),
  action: document.querySelector("#mm-rpg-action"),
  send: document.querySelector("#mm-rpg-send"),
  discardRetry: document.querySelector("#mm-rpg-discard-retry"),
  status: document.querySelector("#mm-rpg-action-status"),
  error: document.querySelector("#mm-rpg-error"),
  coordination: document.querySelector("#mm-rpg-coordination"),
  refresh: document.querySelector("#mm-rpg-refresh"),
};

let currentTargets = [];
let selectedTarget = null;
let pendingRequest = null;
let submitting = false;
let button = null;
let chooser = null;

function worldState() {
  const world = window.gameFrameMonsterRpgWorld;
  return {
    payload: world?.getPayload?.() ?? null,
    position: world?.getPlayerPosition?.() ?? null,
  };
}

function nearbyTalkTargets() {
  const { payload, position } = worldState();
  if (!payload?.materialization?.anchors || !position?.transform) return [];
  return payload.materialization.anchors
    .filter((anchor) =>
      anchor?.kind === "entity"
      && anchor.entityClass === "actor"
      && typeof anchor.interactionTargetId === "string"
      && anchor.interactionTargetId
      && Number.isSafeInteger(anchor.x)
      && Number.isSafeInteger(anchor.y)
      && Math.abs(anchor.x - position.transform.x) + Math.abs(anchor.y - position.transform.y) === 1
    )
    .map((anchor) => ({
      kind: "entity",
      interaction: "talk",
      interactionTargetId: anchor.interactionTargetId,
      displayLabel: String(anchor.label || "Nearby character").trim() || "Nearby character",
    }))
    .sort((left, right) => {
      const byLabel = left.displayLabel.localeCompare(right.displayLabel);
      return byLabel || left.interactionTargetId.localeCompare(right.interactionTargetId);
    });
}

function ensureControls() {
  const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
  if (!stage) return null;
  if (!button?.isConnected) {
    button = document.createElement("button");
    button.type = "button";
    button.id = "mm-rpg-talk-nearby";
    button.className = "mm-rpg-world-interact";
    button.hidden = true;
    button.addEventListener("click", () => {
      if (pendingRequest || submitting || currentTargets.length === 0) return;
      if (currentTargets.length === 1) {
        selectTalkTarget(currentTargets[0]);
        return;
      }
      renderChooser(!chooser || chooser.hidden);
    });
    stage.append(button);
  }
  if (!chooser?.isConnected) {
    chooser = document.createElement("div");
    chooser.id = "mm-rpg-talk-chooser";
    chooser.className = "mm-rpg-world-interact-chooser";
    chooser.setAttribute("role", "group");
    chooser.setAttribute("aria-label", "Choose who to talk to");
    chooser.hidden = true;
    stage.append(chooser);
  }
  return button;
}

function renderChooser(open = false) {
  ensureControls();
  if (!chooser) return;
  chooser.replaceChildren();
  if (!open || currentTargets.length <= 1 || pendingRequest || submitting) {
    chooser.hidden = true;
    return;
  }
  const heading = document.createElement("span");
  heading.className = "mm-rpg-world-interact-chooser-label";
  heading.textContent = "Talk to…";
  chooser.append(heading);
  for (const target of currentTargets) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "mm-rpg-world-interact-choice";
    option.dataset.interactionTargetId = target.interactionTargetId;
    option.textContent = target.displayLabel;
    option.addEventListener("click", () => {
      chooser.hidden = true;
      selectTalkTarget(target);
    });
    chooser.append(option);
  }
  chooser.hidden = false;
}

function sameTarget(left, right) {
  return Boolean(
    left
    && right
    && left.interactionTargetId === right.interactionTargetId
  );
}

function targetStillNearby(target) {
  return currentTargets.some((candidate) => sameTarget(candidate, target));
}

function synchronize() {
  const nextTargets = nearbyTalkTargets();
  const changed = JSON.stringify(nextTargets) !== JSON.stringify(currentTargets);
  currentTargets = nextTargets;
  const control = ensureControls();
  if (control) {
    control.hidden = currentTargets.length === 0;
    control.disabled = submitting || Boolean(pendingRequest);
    control.textContent = currentTargets.length === 1
      ? `Talk to ${currentTargets[0].displayLabel}`
      : currentTargets.length > 1
        ? `Talk · ${currentTargets.length} nearby`
        : "Talk";
    control.setAttribute(
      "aria-label",
      currentTargets.length === 1
        ? `Talk to ${currentTargets[0].displayLabel}`
        : currentTargets.length > 1
          ? `Choose among ${currentTargets.length} nearby characters to talk to`
          : "Talk to nearby character",
    );
  }

  if (chooser && !chooser.hidden) renderChooser(true);
  if (selectedTarget && !pendingRequest && !targetStillNearby(selectedTarget)) {
    clearTalkMode({ preserveStatus: true });
  }
  if (changed) {
    window.dispatchEvent(new CustomEvent(NEARBY_EVENT, {
      detail: {
        targets: currentTargets.map((target) => ({ ...target })),
        target: currentTargets.length === 1 ? { ...currentTargets[0] } : null,
      },
    }));
  }
}

function selectTalkTarget(target) {
  if (!targetStillNearby(target) || pendingRequest || submitting) return false;
  selectedTarget = { ...target };
  if (chooser) chooser.hidden = true;
  applyTalkComposerState();
  elements.action?.focus();
  return true;
}

function ownsComposer() {
  return Boolean(selectedTarget || pendingRequest);
}

function applyTalkComposerState() {
  const target = selectedTarget;
  if (!target) return false;
  if (elements.send) {
    elements.send.disabled = submitting;
    elements.send.textContent = pendingRequest
      ? `Retry Talk to ${target.displayLabel}`
      : `Talk to ${target.displayLabel}`;
  }
  if (elements.status) {
    elements.status.textContent = pendingRequest
      ? `Delivery was not confirmed. Retry sends the exact same words to ${target.displayLabel}.`
      : `Talking to ${target.displayLabel}. Type what you say, then send.`;
  }
  if (elements.discardRetry) {
    elements.discardRetry.hidden = !pendingRequest;
    if (pendingRequest) elements.discardRetry.textContent = "Cancel Talk retry";
  }
  if (pendingRequest && elements.action && elements.action.value !== pendingRequest.text) {
    elements.action.value = pendingRequest.text;
    elements.action.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return true;
}

function clearTalkMode({ preserveStatus = false } = {}) {
  selectedTarget = null;
  pendingRequest = null;
  submitting = false;
  if (chooser) chooser.hidden = true;
  if (elements.send) {
    elements.send.disabled = false;
    elements.send.textContent = "Send to Game Master";
  }
  if (elements.discardRetry) {
    elements.discardRetry.hidden = true;
    elements.discardRetry.textContent = "Discard failed action";
  }
  if (elements.status && !preserveStatus) {
    elements.status.textContent = "Ready for your next action.";
  }
  synchronize();
}

function showError(message) {
  if (!elements.error) return;
  elements.error.textContent = message || "";
  elements.error.hidden = !message;
}

function currentCoordinationRevision() {
  const value = Number(elements.coordination?.textContent ?? "");
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Campaign coordination state is unavailable. Refresh the campaign and try again.");
  }
  return value;
}

function buildPendingRequest() {
  if (pendingRequest) return pendingRequest;
  if (!selectedTarget || !targetStillNearby(selectedTarget)) {
    throw new Error("Move next to the character and select Talk again.");
  }
  const { payload, position } = worldState();
  if (!payload?.projection || !payload?.materialization || !position) {
    throw new Error("The physical campaign scene is not ready for Talk.");
  }
  pendingRequest = {
    ...buildExplorationTalkRequest({
      campaignId: payload.projection.campaignId,
      commandId: `command:${crypto.randomUUID()}`,
      expectedGameframeCoordinationRevision: currentCoordinationRevision(),
      sceneId: payload.projection.scene.sceneId,
      materializationRef: payload.materialization.materializationRef,
      expectedPositionRevision: position.positionRevision,
      interactionTargetId: selectedTarget.interactionTargetId,
      text: elements.action?.value,
    }),
    issuedAt: new Date().toISOString(),
  };
  applyTalkComposerState();
  return pendingRequest;
}

async function requestTalk(request) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), MAX_REQUEST_TIMEOUT_MS);
  try {
    const response = await gameFrameFetch(
      `/api/rpg/campaigns/${encodeURIComponent(request.campaignId)}/exploration/interact`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      },
      identity,
    );
    const text = await response.text();
    const value = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(value?.message || `Talk failed (${response.status}).`);
      error.status = response.status;
      error.code = value?.error || "request_failed";
      throw error;
    }
    return value;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("GameFrame did not confirm Talk before the request timed out.");
      timeoutError.code = "request_timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function submitTalk() {
  if (submitting || (!selectedTarget && !pendingRequest)) return;
  let request;
  try {
    request = buildPendingRequest();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Talk could not be prepared.");
    return;
  }

  submitting = true;
  showError("");
  if (elements.send) elements.send.disabled = true;
  if (elements.status) {
    elements.status.textContent = `Sending your words to ${selectedTarget?.displayLabel || "the nearby character"}…`;
  }
  if (button) button.disabled = true;
  if (chooser) chooser.hidden = true;

  try {
    await requestTalk(request);
    const targetLabel = selectedTarget?.displayLabel || "the nearby character";
    pendingRequest = null;
    selectedTarget = null;
    if (elements.action) {
      elements.action.value = "";
      elements.action.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (elements.status) {
      elements.status.textContent = `Talk accepted. Waiting for ${targetLabel} to answer.`;
    }
    if (elements.discardRetry) elements.discardRetry.hidden = true;
    if (elements.send) {
      elements.send.disabled = false;
      elements.send.textContent = "Send to Game Master";
    }
    elements.refresh?.click();
  } catch (error) {
    const physicalConflict = error?.status === 409 && [
      "position-revision-conflict",
      "stale-materialization",
      "interaction-target-unavailable",
      "interaction-out-of-range",
    ].includes(error?.code);
    const coordinationConflict = error?.status === 409
      && /coordination|revision|stale/i.test(`${error?.code || ""} ${error?.message || ""}`);

    if (physicalConflict || coordinationConflict) {
      pendingRequest = null;
      selectedTarget = null;
      if (physicalConflict) {
        await window.gameFrameMonsterRpgWorld?.attachCurrentCampaign?.({ quiet: true })
          ?.catch?.(() => undefined);
      }
      elements.refresh?.click();
      if (elements.status) {
        elements.status.textContent = physicalConflict
          ? "Your position or nearby target changed. Move next to the character and select Talk again."
          : "Campaign position changed. Refreshed; select Talk again.";
      }
      showError(error?.message || "Talk must be retried from the current campaign state.");
    } else {
      if (elements.status) {
        elements.status.textContent = "Talk delivery was not confirmed. Retry sends the exact same command and words.";
      }
      showError(error?.message || "Talk could not be delivered.");
      applyTalkComposerState();
    }
  } finally {
    submitting = false;
    if (button) button.disabled = false;
    if (selectedTarget || pendingRequest) applyTalkComposerState();
    else if (elements.send) elements.send.disabled = false;
    synchronize();
  }
}

function handleTalkSubmit(event) {
  if (!selectedTarget && !pendingRequest) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void submitTalk();
}

window.gameFrameMonsterRpgTalk = Object.freeze({
  getTarget: () => currentTargets.length === 1 ? { ...currentTargets[0] } : null,
  getTargets: () => currentTargets.map((target) => ({ ...target })),
  getSelectedTarget: () => selectedTarget ? { ...selectedTarget } : null,
  getPendingRequest: () => pendingRequest ? structuredClone(pendingRequest) : null,
  ownsComposer,
  applyComposerState: applyTalkComposerState,
  refresh: synchronize,
  select: selectTalkTarget,
  cancel: () => clearTalkMode(),
});

window.addEventListener(TALK_REQUEST_EVENT, (event) => {
  const target = event?.detail?.target;
  if (target) selectTalkTarget(target);
});
window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener("gameframe:before-home", () => {
  currentTargets = [];
  selectedTarget = null;
  pendingRequest = null;
  if (button) button.hidden = true;
  if (chooser) chooser.hidden = true;
});
window.addEventListener("resize", synchronize);
elements.form?.addEventListener("submit", handleTalkSubmit, { capture: true });
elements.discardRetry?.addEventListener("click", (event) => {
  if (!pendingRequest) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  clearTalkMode();
  showError("");
});
queueMicrotask(synchronize);
