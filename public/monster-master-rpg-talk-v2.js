import { gameFrameFetch } from "./gameframe-auth.js";
import { buildExplorationTalkRequest } from "./monster-master-rpg-model.js";
import "./monster-master-rpg-interaction-shell.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const STATE_EVENT = "gameframe:monster-master-rpg-state";
const NEARBY_EVENT = "gameframe:rpg-nearby-interaction";
const TALK_REQUEST_EVENT = "gameframe:rpg-talk-requested";
const MAX_REQUEST_TIMEOUT_MS = 12_000;
const MAX_TALK_LENGTH = 2_000;
const MAX_VISIBLE_BUBBLES = 20;

const identity = window.gameFrameIdentity;
if (!identity?.playerId) {
  throw new Error("Monster Master RPG Talk requires an authenticated GameFrame identity.");
}

const elements = {
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
let panel = null;
let anchorObserver = null;

function worldState() {
  const world = window.gameFrameMonsterRpgWorld;
  return {
    payload: world?.getPayload?.() ?? null,
    position: world?.getPlayerPosition?.() ?? null,
  };
}

function structuredEvents() {
  return window.gameFrameMonsterRpgApp?.getEvents?.() ?? [];
}

function sceneTalkTargets() {
  const { payload } = worldState();
  if (!payload?.materialization?.anchors) return [];
  return payload.materialization.anchors
    .filter((anchor) =>
      anchor?.kind === "entity"
      && anchor.entityClass === "actor"
      && typeof anchor.interactionTargetId === "string"
      && anchor.interactionTargetId
      && typeof anchor.semanticId === "string"
      && anchor.semanticId
    )
    .map((anchor) => ({
      kind: "entity",
      interaction: "talk",
      semanticId: String(anchor.semanticId || "").trim(),
      interactionTargetId: anchor.interactionTargetId,
      displayLabel: String(anchor.label || "Character").trim() || "Character",
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
  ensureTalkAnchorObserver();
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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  root.append(header, history, form);
  return root;
}

function ensureTalkAnchorObserver() {
  const layer = document.querySelector("#mm-rpg-world-anchors");
  if (!layer) return;
  if (anchorObserver?.layer === layer) {
    decorateTalkAnchors();
    return;
  }
  anchorObserver?.observer?.disconnect?.();
  const observer = new MutationObserver(() => queueMicrotask(decorateTalkAnchors));
  observer.observe(layer, { childList: true });
  anchorObserver = { layer, observer };
  decorateTalkAnchors();
}

function decorateTalkAnchors() {
  const layer = document.querySelector("#mm-rpg-world-anchors");
  if (!layer) return;
  for (const marker of layer.querySelectorAll(".mm-rpg-world-anchor")) {
    marker.classList.remove("is-talkable");
    marker.querySelector(".mm-rpg-world-anchor-talk")?.remove();
  }
  for (const target of currentTargets) {
    const marker = [...layer.querySelectorAll(".mm-rpg-world-anchor[data-kind='entity']")]
      .find((candidate) => candidate.dataset.semanticId === target.semanticId);
    if (!marker) continue;
    marker.classList.add("is-talkable");
    const talk = document.createElement("button");
    talk.type = "button";
    talk.className = "mm-rpg-world-anchor-talk";
    talk.setAttribute("aria-label", `Open conversation with ${target.displayLabel}`);
    talk.title = `Talk to ${target.displayLabel}`;
    talk.textContent = "💬";
    talk.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectTalkTarget(target);
    });
    marker.prepend(talk);
  }
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

function targetStillPresent(target) {
  return currentTargets.some((candidate) => sameTarget(candidate, target));
}

function synchronize() {
  const nextTargets = sceneTalkTargets();
  const changed = JSON.stringify(nextTargets) !== JSON.stringify(currentTargets);
  currentTargets = nextTargets;
  const control = ensureControls();
  if (control) {
    control.hidden = currentTargets.length === 0 || Boolean(selectedTarget);
    control.disabled = submitting || Boolean(pendingRequest);
    control.textContent = currentTargets.length === 1
      ? `Talk to ${currentTargets[0].displayLabel}`
      : currentTargets.length > 1
        ? `Talk · ${currentTargets.length} in scene`
        : "Talk";
    control.setAttribute(
      "aria-label",
      currentTargets.length === 1
        ? `Talk to ${currentTargets[0].displayLabel}`
        : currentTargets.length > 1
          ? `Choose among ${currentTargets.length} nearby characters to talk to`
          : "Talk to a character in the scene",
    );
  }
  if (chooser && !chooser.hidden) renderChooser(true);
  if (selectedTarget && !pendingRequest && !targetStillPresent(selectedTarget)) {
    clearTalkMode({ preserveStatus: true });
  }
  if (selectedTarget) synchronizeTalkHistory();
  decorateTalkAnchors();
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
  if (!targetStillPresent(target) || pendingRequest || submitting) return false;
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

function talkTranscript(target) {
  const events = structuredEvents();
  const commandIds = new Set();
  const entries = [];

  for (const event of events) {
    const payload = event?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;

    if (
      event.kind === "campaign.action_submitted"
      && payload.interaction === "talk"
      && payload.interactionTargetId === target.interactionTargetId
      && typeof payload.commandId === "string"
      && typeof payload.text === "string"
      && payload.text.trim()
    ) {
      commandIds.add(payload.commandId);
      entries.push({ speaker: "player", text: payload.text.trim(), commandId: payload.commandId });
      continue;
    }

    if (
      event.kind === "scene.presented"
      && typeof payload.sourceCommandId === "string"
      && commandIds.has(payload.sourceCommandId)
      && Array.isArray(payload.dialogue)
    ) {
      for (const candidate of payload.dialogue) {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
        if (candidate.speakerId !== target.semanticId || typeof candidate.text !== "string") continue;
        const text = candidate.text.trim();
        if (text) entries.push({ speaker: "character", text, commandId: payload.sourceCommandId });
      }
    }
  }

  if (pendingRequest?.text && !commandIds.has(pendingRequest.commandId)) {
    entries.push({ speaker: "player", text: pendingRequest.text, commandId: pendingRequest.commandId });
  }
  return entries.slice(-MAX_VISIBLE_BUBBLES);
}

function synchronizeTalkHistory() {
  const history = panel?.querySelector("#mm-rpg-talk-history");
  if (!history || !selectedTarget) return;
  const bubbles = talkTranscript(selectedTarget).map((entry) => {
    const bubble = document.createElement("div");
    bubble.className = "mm-rpg-talk-bubble";
    bubble.dataset.speaker = entry.speaker;
    bubble.dataset.commandId = entry.commandId;
    bubble.textContent = entry.text;
    return bubble;
  });
  history.replaceChildren(...bubbles);
  history.scrollTop = history.scrollHeight;
}

async function buildPendingRequest() {
  if (pendingRequest) return pendingRequest;
  if (!selectedTarget || !targetStillPresent(selectedTarget)) {
    throw new Error("That character is no longer present in the current scene.");
  }
  const snapshot = await window.gameFrameMonsterRpgCoordination?.freshExplorationState?.();
  if (!snapshot) throw new Error("The current exploration command state is unavailable. Refresh and try again.");
  const { payload, position, revision } = snapshot;
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
      expectedGameframeCoordinationRevision: revision,
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
    request = await buildPendingRequest();
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
  if (status) status.textContent = `Speaking to ${selectedTarget?.displayLabel || "the character"}…`;
  showError("");
  synchronizeTalkHistory();

  try {
    await requestTalk(request);
    const targetLabel = selectedTarget?.displayLabel || "the character";
    pendingRequest = null;
    const textarea = panel?.querySelector("#mm-rpg-talk-input");
    if (textarea) {
      textarea.value = "";
      textarea.blur();
    }
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
        void window.gameFrameMonsterRpgWorld?.attachCurrentCampaign?.({ quiet: true })
          ?.catch?.(() => undefined);
      }
      elements.refresh?.click();
      if (status) {
        status.textContent = physicalConflict
          ? "Physical scene changed. Refreshed; select the character and try again."
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
window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));
window.addEventListener("gameframe:before-home", () => {
  currentTargets = [];
  selectedTarget = null;
  pendingRequest = null;
  anchorObserver?.observer?.disconnect?.();
  anchorObserver = null;
  if (button) button.hidden = true;
  if (chooser) chooser.hidden = true;
  if (panel) panel.hidden = true;
});
window.addEventListener("resize", synchronize);

queueMicrotask(synchronize);
