import { gameFrameFetch } from "./gameframe-auth.js";
import { buildExplorationTalkRequest } from "./monster-master-rpg-model.js";
import "./monster-master-rpg-interaction-shell.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const NEARBY_EVENT = "gameframe:rpg-nearby-interaction";
const TALK_REQUEST_EVENT = "gameframe:rpg-talk-requested";
const MAX_REQUEST_TIMEOUT_MS = 12_000;
const MAX_TALK_LENGTH = 2_000;

const identity = window.gameFrameIdentity;
if (!identity?.playerId) {
  throw new Error("Monster Master RPG Talk requires an authenticated GameFrame identity.");
}

const elements = {
  error: document.querySelector("#mm-rpg-error"),
  coordination: document.querySelector("#mm-rpg-coordination"),
  refresh: document.querySelector("#mm-rpg-refresh"),
  events: document.querySelector("#mm-rpg-events"),
};

let currentTargets = [];
let selectedTarget = null;
let pendingRequest = null;
let submitting = false;
let button = null;
let chooser = null;
let panel = null;

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
      semanticId: String(anchor.semanticId || "").trim(),
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

  if (!panel?.isConnected) {
    panel = buildTalkPanel();
    stage.append(panel);
  }
  return button;
}

function buildTalkPanel() {
  const root = document.createElement("section");
  root.id = "mm-rpg-talk-panel";
  root.className = "mm-rpg-talk-panel mm-rpg-overlay-panel";
  root.hidden = true;

  const header = document.createElement("header");
  const heading = document.createElement("div");
  const eyebrow = document.createElement("small");
  eyebrow.textContent = "IN-WORLD CONVERSATION";
  const title = document.createElement("strong");
  title.id = "mm-rpg-talk-panel-title";
  title.textContent = "Talk";
  heading.append(eyebrow, title);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "mm-rpg-overlay-close";
  close.setAttribute("aria-label", "End conversation");
  close.textContent = "×";
  close.addEventListener("click", () => clearTalkMode());
  header.append(heading, close);

  const history = document.createElement("div");
  history.id = "mm-rpg-talk-history";
  history.className = "mm-rpg-talk-history";
  history.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "mm-rpg-talk-form";
  const textarea = document.createElement("textarea");
  textarea.id = "mm-rpg-talk-input";
  textarea.maxLength = MAX_TALK_LENGTH;
  textarea.placeholder = "Say something…";
  const footer = document.createElement("footer");
  const status = document.createElement("small");
  status.id = "mm-rpg-talk-status";
  status.textContent = "These words are spoken in the world.";
  const send = document.createElement("button");
  send.id = "mm-rpg-talk-send";
  send.type = "submit";
  send.textContent = "Speak";
  footer.append(status, send);
  form.append(textarea, footer);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitTalk();
  });
  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  root.append(header, history, form);
  return root;
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
  return Boolean(left && right && left.interactionTargetId === right.interactionTargetId);
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
    control.hidden = currentTargets.length === 0 || Boolean(selectedTarget);
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
  if (selectedTarget) synchronizeTalkHistory();
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
  window.gameFrameMonsterRpgInteractionShell?.closeOverlays?.();
  ensureControls();
  if (panel) {
    panel.hidden = false;
    const title = panel.querySelector("#mm-rpg-talk-panel-title");
    if (title) title.textContent = selectedTarget.displayLabel;
    const status = panel.querySelector("#mm-rpg-talk-status");
    if (status) status.textContent = `Talking to ${selectedTarget.displayLabel}. These words are spoken in the world.`;
    synchronizeTalkHistory();
    panel.querySelector("#mm-rpg-talk-input")?.focus();
  }
  synchronize();
  return true;
}

function ownsComposer() {
  return false;
}

function applyTalkComposerState() {
  return false;
}

function clearTalkMode({ preserveStatus = false } = {}) {
  selectedTarget = null;
  if (!pendingRequest) submitting = false;
  if (chooser) chooser.hidden = true;
  if (panel) {
    panel.hidden = true;
    if (!preserveStatus) {
      const textarea = panel.querySelector("#mm-rpg-talk-input");
      if (textarea && !pendingRequest) textarea.value = "";
    }
  }
  synchronize();
}

function synchronizeTalkHistory() {
  const history = panel?.querySelector("#mm-rpg-talk-history");
  if (!history || !selectedTarget) return;
  const bubbles = [];
  for (const item of elements.events?.children ?? []) {
    const heading = item.querySelector(".mm-rpg-event-header strong")?.textContent?.trim();
    if (heading !== selectedTarget.displayLabel) continue;
    const body = item.querySelector("p")?.textContent?.trim();
    if (!body) continue;
    const bubble = document.createElement("div");
    bubble.className = "mm-rpg-talk-bubble";
    bubble.dataset.speaker = "character";
    bubble.textContent = body;
    bubbles.push(bubble);
  }
  if (pendingRequest?.text) {
    const bubble = document.createElement("div");
    bubble.className = "mm-rpg-talk-bubble";
    bubble.dataset.speaker = "player";
    bubble.textContent = pendingRequest.text;
    bubbles.push(bubble);
  }
  history.replaceChildren(...bubbles.slice(-10));
  history.scrollTop = history.scrollHeight;
}

function currentCoordinationRevision() {
  const payloadRevision = worldState().payload?.projection?.gameframeCoordinationRevision;
  if (Number.isSafeInteger(payloadRevision) && payloadRevision >= 0) return payloadRevision;
  const value = Number(elements.coordination?.textContent ?? "");
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Campaign coordination state is unavailable. Refresh and try again.");
  }
  return value;
}

function buildPendingRequest() {
  if (pendingRequest) return pendingRequest;
  if (!selectedTarget || !targetStillNearby(selectedTarget)) {
    throw new Error("Move next to the character and select Talk again.");
  }
  const { payload, position } = worldState();
  const textarea = panel?.querySelector("#mm-rpg-talk-input");
  if (!payload?.projection || !payload?.materialization || !position) {
    throw new Error("The physical campaign scene is not ready for Talk.");
  }
  const text = String(textarea?.value ?? "").trim();
  if (!text || text.length > MAX_TALK_LENGTH) {
    throw new Error(`Talk requires 1 through ${MAX_TALK_LENGTH.toLocaleString()} characters.`);
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
      text,
    }),
    issuedAt: new Date().toISOString(),
  };
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
    const responseText = await response.text();
    const value = responseText ? JSON.parse(responseText) : null;
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
  const send = panel?.querySelector("#mm-rpg-talk-send");
  const status = panel?.querySelector("#mm-rpg-talk-status");
  if (send) {
    send.disabled = true;
    send.textContent = "Sending…";
  }
  if (status) status.textContent = `Speaking to ${selectedTarget?.displayLabel || "the nearby character"}…`;
  showError("");
  synchronizeTalkHistory();

  try {
    await requestTalk(request);
    const targetLabel = selectedTarget?.displayLabel || "the nearby character";
    pendingRequest = null;
    const textarea = panel?.querySelector("#mm-rpg-talk-input");
    if (textarea) textarea.value = "";
    if (status) status.textContent = `Spoken. Waiting for ${targetLabel} to answer.`;
    if (send) send.textContent = "Speak";
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
      if (physicalConflict) {
        await window.gameFrameMonsterRpgWorld?.attachCurrentCampaign?.({ quiet: true })
          ?.catch?.(() => undefined);
      }
      elements.refresh?.click();
      if (status) {
        status.textContent = physicalConflict
          ? "Your position or target changed. Move next to the character and start Talk again."
          : "Campaign state changed. Refreshed; start Talk again.";
      }
      showError(error?.message || "Talk must be retried from the current campaign state.");
      clearTalkMode({ preserveStatus: true });
    } else {
      if (status) status.textContent = "Delivery was not confirmed. Retry sends the exact same spoken words.";
      if (send) send.textContent = "Retry Speak";
      showError(error?.message || "Talk could not be delivered.");
    }
  } finally {
    submitting = false;
    if (send) send.disabled = false;
    synchronize();
  }
}

function showError(message) {
  if (!elements.error) return;
  elements.error.textContent = message || "";
  elements.error.hidden = !message;
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
  if (panel) panel.hidden = true;
});
window.addEventListener("resize", synchronize);

const eventObserver = new MutationObserver(() => {
  if (selectedTarget) synchronizeTalkHistory();
});
if (elements.events) eventObserver.observe(elements.events, { childList: true });

queueMicrotask(synchronize);
