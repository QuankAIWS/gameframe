import { gameFrameFetch } from "./gameframe-auth.js";
import {
  REFERENCE_CAMPAIGN_ID,
  buildActionCommand,
  buildAttachRequest,
  isChoicePresentedEvent,
  isEncounterPresentedEvent,
  mergeCampaignEvents,
  normalizeCampaignId,
  normalizeProjection,
  presentCampaignChoice,
  presentCampaignEncounter,
  presentCampaignEvent,
} from "./monster-master-rpg-model.js";

const identity = window.gameFrameIdentity;
if (!identity?.playerId) throw new Error("Monster Master RPG requires an authenticated GameFrame identity.");

const elements = {
  error: document.querySelector("#mm-rpg-error"),
  join: document.querySelector("#mm-rpg-join"),
  joinForm: document.querySelector("#mm-rpg-join-form"),
  campaignInput: document.querySelector("#mm-rpg-campaign-id"),
  connect: document.querySelector("#mm-rpg-connect"),
  reference: document.querySelector("#mm-rpg-reference"),
  campaign: document.querySelector("#mm-rpg-campaign"),
  title: document.querySelector("#mm-rpg-campaign-title"),
  code: document.querySelector("#mm-rpg-campaign-code"),
  connection: document.querySelector("#mm-rpg-connection"),
  switchCampaign: document.querySelector("#mm-rpg-switch"),
  refresh: document.querySelector("#mm-rpg-refresh"),
  empty: document.querySelector("#mm-rpg-empty"),
  events: document.querySelector("#mm-rpg-events"),
  coordination: document.querySelector("#mm-rpg-coordination"),
  presentation: document.querySelector("#mm-rpg-presentation"),
  narrative: document.querySelector("#mm-rpg-narrative"),
  playerName: document.querySelector("#mm-rpg-player-name"),
  sidebarPlayer: document.querySelector("#mm-rpg-sidebar-player"),
  playerId: document.querySelector("#mm-rpg-player-id"),
  actionForm: document.querySelector("#mm-rpg-action-form"),
  action: document.querySelector("#mm-rpg-action"),
  count: document.querySelector("#mm-rpg-count"),
  send: document.querySelector("#mm-rpg-send"),
  discardRetry: document.querySelector("#mm-rpg-discard-retry"),
  actionStatus: document.querySelector("#mm-rpg-action-status"),
};

const storageKey = "scribbles-gameframe.monster-master-rpg.campaign";
const fallbackPollIntervalMs = 15_000;
const maximumReconnectDelayMs = 15_000;
const fallbackAfterReconnectAttempt = 3;
const state = {
  campaignId: null,
  projection: null,
  events: [],
  socket: null,
  reconnectTimer: null,
  reconnectAttempt: 0,
  pollTimer: null,
  attachInFlight: null,
  pendingCommand: null,
};

const displayName = identity.displayName || identity.playerId;
elements.playerName.textContent = displayName;
elements.sidebarPlayer.textContent = displayName;
elements.playerId.textContent = identity.playerId;

const parameters = new URLSearchParams(window.location.search);
elements.campaignInput.value = parameters.get("campaign")
  || window.localStorage.getItem(storageKey)
  || REFERENCE_CAMPAIGN_ID;
updateCharacterCount();
updateComposer();

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function setConnection(label, status) {
  elements.connection.textContent = label;
  elements.connection.dataset.state = status;
}

function updateConnectionStatus() {
  if (state.socket?.readyState === WebSocket.OPEN) {
    setConnection("Live", "live");
  } else if (state.pollTimer) {
    setConnection("Degraded · periodic recovery", "connecting");
  } else if (state.reconnectTimer || state.socket?.readyState === WebSocket.CONNECTING) {
    setConnection("Reconnecting", "connecting");
  } else if (state.campaignId) {
    setConnection("Disconnected", "error");
  }
}

function setJoinBusy(busy) {
  elements.connect.disabled = busy;
  elements.campaignInput.disabled = busy;
  elements.reference.disabled = busy;
  elements.connect.textContent = busy ? "Opening…" : "Open campaign";
}

function updateCharacterCount() {
  elements.count.textContent = `${elements.action.value.length} / 2000`;
}

function activeEncounterEvent() {
  const encounterIndex = state.events.findLastIndex(isEncounterPresentedEvent);
  if (encounterIndex < 0) return null;
  const resumed = state.events.slice(encounterIndex + 1).some((event) =>
    event.kind === "scene.presented" && !isEncounterPresentedEvent(event)
  );
  return resumed ? null : state.events[encounterIndex];
}

function updateComposer() {
  const retrying = Boolean(state.pendingCommand);
  const encounterActive = Boolean(activeEncounterEvent());
  elements.send.textContent = retrying ? "Retry exact action" : "Send to Game Master";
  elements.send.disabled = encounterActive;
  elements.discardRetry.hidden = !retrying;
  elements.action.disabled = encounterActive;
  if (encounterActive && !retrying) {
    elements.actionStatus.textContent = "The campaign is in Arena Battles. Resolve the encounter before sending another narrative action.";
  }
}

async function requestJson(path, body) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
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
      error.value = value;
      throw error;
    }
    return value;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("GameFrame did not respond before the request timed out.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function campaignPath(operation) {
  return `/api/rpg/campaigns/${encodeURIComponent(state.campaignId)}/${operation}`;
}

async function attachCampaign({ quiet = false } = {}) {
  if (!state.campaignId) return null;
  if (state.attachInFlight) return state.attachInFlight;
  if (!quiet) setConnection("Refreshing", "connecting");
  state.attachInFlight = requestJson(
    campaignPath("attach"),
    buildAttachRequest(state.campaignId),
  ).then((value) => {
    const projection = normalizeProjection(value);
    state.projection = projection;
    state.events = mergeCampaignEvents(state.events, projection.events);
    renderCampaign();
    if (state.socket?.readyState === WebSocket.OPEN) setConnection("Live", "live");
    else if (!quiet && !state.reconnectTimer && !state.pollTimer) setConnection("Connected", "live");
    else updateConnectionStatus();
    showError("");
    return projection;
  }).catch((error) => {
    if (!quiet) {
      setConnection("Disconnected", "error");
      showError(error.message || "Unable to refresh this campaign.");
    } else {
      updateConnectionStatus();
    }
    throw error;
  }).finally(() => {
    state.attachInFlight = null;
  });
  return state.attachInFlight;
}

async function openCampaign(campaignIdValue) {
  const campaignId = normalizeCampaignId(campaignIdValue);
  stopRealtime();
  state.campaignId = campaignId;
  state.projection = null;
  state.events = [];
  state.pendingCommand = null;
  updateComposer();
  setJoinBusy(true);
  showError("");
  setConnection("Connecting", "connecting");
  try {
    await attachCampaign();
    window.localStorage.setItem(storageKey, campaignId);
    const url = new URL(window.location.href);
    url.searchParams.set("campaign", campaignId);
    window.history.replaceState({}, "", url);
    elements.join.hidden = true;
    elements.campaign.hidden = false;
    startRealtime();
  } catch (error) {
    state.campaignId = null;
    showError(error.message || "Unable to open that campaign.");
  } finally {
    setJoinBusy(false);
  }
}

function renderCampaign() {
  const projection = state.projection;
  if (!projection) return;
  elements.title.textContent = projection.title;
  elements.code.textContent = projection.campaignId;
  elements.coordination.textContent = String(projection.gameframeCoordinationRevision);
  elements.presentation.textContent = String(projection.presentationSequence);
  elements.narrative.textContent = String(projection.linkedNarrativeRevision);
  elements.empty.hidden = state.events.length > 0;
  elements.events.replaceChildren(...state.events.map(renderEvent));
  updateComposer();
}

function renderEvent(event) {
  if (isEncounterPresentedEvent(event)) return renderEncounterEvent(event);
  if (isChoicePresentedEvent(event)) return renderChoiceEvent(event);
  const presentation = presentCampaignEvent(event);
  const item = eventShell(presentation);
  const body = document.createElement("p");
  body.textContent = presentation.body;
  item.append(body);
  return item;
}

function eventShell(presentation) {
  const item = document.createElement("li");
  item.className = "mm-rpg-event";
  item.dataset.eventId = presentation.eventId;
  item.dataset.tone = presentation.tone;

  const header = document.createElement("div");
  header.className = "mm-rpg-event-header";
  const heading = document.createElement("strong");
  heading.textContent = presentation.heading;
  const meta = document.createElement("span");
  meta.className = "mm-rpg-event-meta";
  meta.textContent = [
    presentation.audience,
    presentation.createdAt ? formatTime(presentation.createdAt) : null,
  ].filter(Boolean).join(" · ");
  header.append(heading, meta);
  item.append(header);
  return item;
}

function renderEncounterEvent(event) {
  const presentation = presentCampaignEvent(event);
  const encounter = presentCampaignEncounter(event, state.campaignId);
  const item = eventShell({
    ...presentation,
    tone: "consequence",
  });
  item.classList.add("mm-rpg-encounter-event");
  item.dataset.encounterId = encounter.encounterId;

  const narration = document.createElement("p");
  narration.textContent = presentation.body;

  const handoff = document.createElement("section");
  handoff.className = "mm-rpg-encounter-handoff";
  const label = document.createElement("small");
  label.textContent = "TACTICAL ENCOUNTER";
  const objective = document.createElement("strong");
  objective.textContent = encounter.objective;
  const reason = document.createElement("p");
  reason.textContent = encounter.reason;
  const enter = document.createElement("a");
  enter.className = "mm-rpg-encounter-enter";
  enter.href = encounter.href;
  enter.textContent = "Enter Arena Battles";
  handoff.append(label, objective, reason, enter);
  item.append(narration, handoff);
  return item;
}

function renderChoiceEvent(event) {
  const presentation = presentCampaignEvent(event);
  const choice = presentCampaignChoice(event, identity.playerId, state.events);
  const item = eventShell({
    ...presentation,
    heading: "Possible approaches",
    tone: "prompt",
  });
  item.classList.add("mm-rpg-choice-event");
  item.dataset.choiceId = choice.choiceId;

  const prompt = document.createElement("p");
  prompt.className = "mm-rpg-choice-prompt";
  prompt.textContent = choice.prompt;
  item.append(prompt);

  const options = document.createElement("div");
  options.className = "mm-rpg-choice-options";
  for (const option of choice.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mm-rpg-choice-option";
    button.dataset.optionId = option.optionId;
    button.textContent = option.label;
    button.disabled = option.disabled;
    button.classList.toggle("is-selected", option.selected);
    button.addEventListener("click", () => applySuggestedAction(choice, option));
    options.append(button);
  }
  item.append(options);

  const status = document.createElement("small");
  status.className = "mm-rpg-choice-status";
  if (choice.submitted) {
    status.textContent = choice.selectedLabel
      ? `Recorded selection: ${choice.selectedLabel}. You can still describe another action below.`
      : "A selection was recorded. You can still describe another action below.";
  } else if (!choice.authorized) {
    status.textContent = "These suggestions belong to another player. Your freeform action remains available below.";
  } else {
    status.textContent = "Suggestions only. Use one as a starting point, edit it, ignore it, or type anything else.";
  }
  item.append(status);
  return item;
}

function applySuggestedAction(choice, option) {
  if (!choice.authorized || option.disabled) return;
  if (activeEncounterEvent()) {
    showError("Resolve the active Arena Battles encounter before drafting another narrative action.");
    return;
  }
  if (state.pendingCommand) {
    showError("An earlier action has unconfirmed delivery. Retry or discard it before drafting a different action.");
    return;
  }
  elements.action.value = option.suggestedAction;
  updateCharacterCount();
  elements.action.focus();
  elements.action.setSelectionRange(elements.action.value.length, elements.action.value.length);
  elements.actionStatus.textContent = "Suggestion loaded. Edit it, replace it, or type something else. Nothing has been sent.";
  showError("");
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function startRealtime() {
  stopRealtime();
  if (!state.campaignId) return;
  // Browser WebSocket APIs cannot attach the explicit development identity
  // header used by local fixtures. Hosted Discord sessions authenticate with the
  // existing signed cookie at the Worker; development uses the slow recovery
  // path rather than reintroducing an identity query parameter.
  if (identity.source !== "discord") {
    startFallbackPolling();
    return;
  }
  connectRealtime(state.campaignId);
}

function realtimeUrl(campaignId) {
  const url = new URL(
    `/api/rpg/campaigns/${encodeURIComponent(campaignId)}/realtime`,
    window.location.href,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}

function connectRealtime(campaignId) {
  if (!state.campaignId || state.campaignId !== campaignId) return;
  if (state.socket && (
    state.socket.readyState === WebSocket.OPEN
    || state.socket.readyState === WebSocket.CONNECTING
  )) return;

  const socket = new WebSocket(realtimeUrl(campaignId));
  state.socket = socket;
  setConnection("Connecting live updates", "connecting");

  socket.onopen = () => {
    if (state.socket !== socket || state.campaignId !== campaignId) return;
    state.reconnectAttempt = 0;
    if (state.reconnectTimer) window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
    stopFallbackPolling();
    setConnection("Live", "live");
  };

  socket.onmessage = (event) => {
    if (state.socket !== socket || state.campaignId !== campaignId) return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message?.type === "protocol_error") {
      showError(message.message || "The live campaign connection reported a protocol error.");
      return;
    }
    if (
      message?.type !== "campaign_position"
      || message.protocolVersion !== 2
      || message.campaignId !== campaignId
    ) return;
    if (campaignPositionAdvanced(message)) {
      void attachCampaign({ quiet: true }).catch(() => undefined);
    }
  };

  socket.onclose = () => {
    if (state.socket === socket) state.socket = null;
    if (!state.campaignId || state.campaignId !== campaignId) return;
    scheduleReconnect(campaignId);
  };
  socket.onerror = () => socket.close();
}

function campaignPositionAdvanced(message) {
  const projection = state.projection;
  if (!projection) return true;
  return Number(message.gameframeCoordinationRevision) > projection.gameframeCoordinationRevision
    || Number(message.presentationSequence) > projection.presentationSequence
    || Number(message.linkedNarrativeRevision) > projection.linkedNarrativeRevision;
}

function scheduleReconnect(campaignId) {
  if (!state.campaignId || state.campaignId !== campaignId || state.reconnectTimer) return;
  const baseDelay = Math.min(
    1_000 * (2 ** state.reconnectAttempt),
    maximumReconnectDelayMs,
  );
  const jitter = Math.round(baseDelay * 0.2 * Math.random());
  state.reconnectAttempt += 1;
  if (state.reconnectAttempt >= fallbackAfterReconnectAttempt) startFallbackPolling();
  state.reconnectTimer = window.setTimeout(() => {
    state.reconnectTimer = null;
    connectRealtime(campaignId);
  }, baseDelay + jitter);
  updateConnectionStatus();
}

function startFallbackPolling() {
  if (state.pollTimer || !state.campaignId) return;
  state.pollTimer = window.setInterval(() => {
    if (document.hidden || !state.campaignId || state.attachInFlight) return;
    void attachCampaign({ quiet: true }).catch(() => undefined);
  }, fallbackPollIntervalMs);
  updateConnectionStatus();
}

function stopFallbackPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer);
  state.pollTimer = null;
}

function stopRealtime() {
  if (state.reconnectTimer) window.clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
  state.reconnectAttempt = 0;
  stopFallbackPolling();
  if (state.socket) {
    state.socket.onclose = null;
    state.socket.onerror = null;
    state.socket.close();
  }
  state.socket = null;
}

async function submitAction() {
  if (!state.projection || !state.campaignId) return;
  if (activeEncounterEvent()) {
    showError("The tactical encounter must finish before another narrative action can be submitted.");
    return;
  }
  const retrying = Boolean(state.pendingCommand);
  const pending = retrying ? state.pendingCommand : buildActionCommand({
    campaignId: state.campaignId,
    commandId: `command:${crypto.randomUUID()}`,
    issuedAt: new Date().toISOString(),
    expectedGameframeCoordinationRevision: state.projection.gameframeCoordinationRevision,
    text: elements.action.value,
  });
  state.pendingCommand = pending;
  updateComposer();
  elements.send.disabled = true;
  elements.actionStatus.textContent = retrying
    ? "Retrying the exact action…"
    : "Sending the action to the Game Master…";
  showError("");
  try {
    await requestJson(campaignPath("commands"), pending);
    state.pendingCommand = null;
    elements.action.value = "";
    updateCharacterCount();
    elements.actionStatus.textContent = "Action accepted. Waiting for the Game Master’s response.";
    await attachCampaign({ quiet: true });
  } catch (error) {
    await handleCommandFailure(error);
  } finally {
    updateComposer();
  }
}

async function handleCommandFailure(error) {
  const revisionConflict = error.status === 409
    && /revision|stale/i.test(`${error.code} ${error.message}`);
  if (revisionConflict) {
    state.pendingCommand = null;
    elements.actionStatus.textContent = "Campaign position changed. Refreshed; review the feed and submit again.";
    await attachCampaign().catch(() => undefined);
    return;
  }
  elements.actionStatus.textContent = "Delivery was not confirmed. Retry sends the same written action and command ID safely.";
  showError(error.message || "The action could not be delivered.");
}

elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void openCampaign(elements.campaignInput.value).catch((error) => showError(error.message));
});

elements.reference.addEventListener("click", () => {
  elements.campaignInput.value = REFERENCE_CAMPAIGN_ID;
  elements.campaignInput.focus();
});

elements.switchCampaign.addEventListener("click", () => {
  stopRealtime();
  state.campaignId = null;
  state.projection = null;
  state.events = [];
  state.pendingCommand = null;
  updateComposer();
  elements.campaign.hidden = true;
  elements.join.hidden = false;
  elements.campaignInput.focus();
});

elements.refresh.addEventListener("click", () => {
  void attachCampaign().catch(() => undefined);
});

elements.action.addEventListener("input", updateCharacterCount);
elements.action.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    elements.actionForm.requestSubmit();
  }
});

elements.actionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitAction().catch((error) => showError(error.message));
});

elements.discardRetry.addEventListener("click", () => {
  state.pendingCommand = null;
  updateComposer();
  elements.actionStatus.textContent = "Unconfirmed action discarded. Ready for a new freeform action.";
  showError("");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !state.campaignId) return;
  void attachCampaign({ quiet: true }).catch(() => undefined);
  if (identity.source === "discord" && !state.socket && !state.reconnectTimer) {
    connectRealtime(state.campaignId);
  }
});

document.addEventListener("gameframe:before-home", () => stopRealtime(), { once: true });
window.addEventListener("pagehide", stopRealtime, { once: true });

if (parameters.has("campaign")) {
  void openCampaign(elements.campaignInput.value).catch((error) => showError(error.message));
}
