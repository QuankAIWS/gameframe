import { gameFrameFetch } from "./gameframe-auth.js";
import {
  REFERENCE_CAMPAIGN_ID,
  buildActionCommand,
  buildAttachRequest,
  buildChoiceCommand,
  isChoicePresentedEvent,
  mergeCampaignEvents,
  normalizeCampaignId,
  normalizeProjection,
  presentCampaignChoice,
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
const state = {
  campaignId: null,
  projection: null,
  events: [],
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

function setJoinBusy(busy) {
  elements.connect.disabled = busy;
  elements.campaignInput.disabled = busy;
  elements.reference.disabled = busy;
  elements.connect.textContent = busy ? "Opening…" : "Open campaign";
}

function updateCharacterCount() {
  elements.count.textContent = `${elements.action.value.length} / 2000`;
}

function pendingKind() {
  return state.pendingCommand?.command?.kind ?? null;
}

function updateComposer() {
  const kind = pendingKind();
  elements.send.textContent = kind === "campaign.submit_action"
    ? "Retry exact action"
    : "Send to Game Master";
  elements.send.disabled = kind === "campaign.submit_choice";
  elements.action.disabled = kind === "campaign.submit_choice";
  elements.discardRetry.hidden = !kind;
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
    setConnection("Live", "live");
    showError("");
    return projection;
  }).catch((error) => {
    setConnection("Disconnected", "error");
    if (!quiet) showError(error.message || "Unable to refresh this campaign.");
    throw error;
  }).finally(() => {
    state.attachInFlight = null;
  });
  return state.attachInFlight;
}

async function openCampaign(campaignIdValue) {
  const campaignId = normalizeCampaignId(campaignIdValue);
  stopPolling();
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
    startPolling();
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

function renderChoiceEvent(event) {
  const presentation = presentCampaignEvent(event);
  const choice = presentCampaignChoice(event, identity.playerId, state.events);
  const item = eventShell({
    ...presentation,
    heading: "Decision",
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
  const pending = pendingKind() === "campaign.submit_choice"
    ? state.pendingCommand.command
    : null;
  for (const option of choice.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mm-rpg-choice-option";
    button.dataset.optionId = option.optionId;
    const exactPending = pending?.choiceId === choice.choiceId
      && pending?.optionId === option.optionId;
    button.textContent = exactPending ? `Retry: ${option.label}` : option.label;
    button.disabled = option.disabled || Boolean(pending && !exactPending);
    button.classList.toggle("is-selected", option.selected);
    button.classList.toggle("is-pending", exactPending);
    button.addEventListener("click", () => {
      void submitChoice(choice, option).catch((error) => showError(error.message));
    });
    options.append(button);
  }
  item.append(options);

  const status = document.createElement("small");
  status.className = "mm-rpg-choice-status";
  if (choice.submitted) {
    status.textContent = choice.selectedLabel
      ? `Selected: ${choice.selectedLabel}`
      : "This choice has been submitted.";
  } else if (!choice.authorized) {
    status.textContent = "This decision belongs to another player.";
  } else if (pending?.choiceId === choice.choiceId) {
    status.textContent = "Delivery was not confirmed. Retry the highlighted option safely.";
  } else {
    status.textContent = "Choose one option. The first accepted response closes this decision.";
  }
  item.append(status);
  return item;
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function startPolling() {
  stopPolling();
  state.pollTimer = window.setInterval(() => {
    if (document.hidden || !state.campaignId || state.attachInFlight) return;
    void attachCampaign({ quiet: true }).catch(() => undefined);
  }, 2_500);
}

function stopPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer);
  state.pollTimer = null;
}

async function submitAction() {
  if (!state.projection || !state.campaignId) return;
  if (pendingKind() === "campaign.submit_choice") {
    showError("Resolve or discard the pending choice delivery before sending a freeform action.");
    return;
  }
  const retrying = pendingKind() === "campaign.submit_action";
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
    await handleCommandFailure(error, "action");
  } finally {
    updateComposer();
  }
}

async function submitChoice(choice, option) {
  if (!state.projection || !state.campaignId || choice.submitted || !choice.authorized) return;
  const existing = state.pendingCommand;
  if (existing && existing.command.kind !== "campaign.submit_choice") {
    showError("Resolve or discard the pending action delivery before choosing an option.");
    return;
  }
  if (
    existing
    && (
      existing.command.choiceId !== choice.choiceId
      || existing.command.optionId !== option.optionId
    )
  ) {
    showError("A different choice delivery is awaiting confirmation. Retry or discard it first.");
    return;
  }
  const retrying = Boolean(existing);
  const pending = existing || buildChoiceCommand({
    campaignId: state.campaignId,
    commandId: `command:${crypto.randomUUID()}`,
    issuedAt: new Date().toISOString(),
    expectedGameframeCoordinationRevision: state.projection.gameframeCoordinationRevision,
    choiceId: choice.choiceId,
    optionId: option.optionId,
  });
  state.pendingCommand = pending;
  updateComposer();
  renderCampaign();
  elements.actionStatus.textContent = retrying
    ? "Retrying the exact choice…"
    : `Submitting “${option.label}”…`;
  showError("");
  try {
    await requestJson(campaignPath("commands"), pending);
    state.pendingCommand = null;
    elements.actionStatus.textContent = "Choice accepted. Waiting for the Game Master’s response.";
    await attachCampaign({ quiet: true });
  } catch (error) {
    await handleCommandFailure(error, "choice");
  } finally {
    updateComposer();
    renderCampaign();
  }
}

async function handleCommandFailure(error, commandKind) {
  const revisionConflict = error.status === 409
    && /revision|stale/i.test(`${error.code} ${error.message}`);
  const definitiveChoiceConflict = commandKind === "choice"
    && error.status >= 400
    && error.status < 500
    && /^choice-/.test(String(error.code));
  if (revisionConflict || definitiveChoiceConflict) {
    state.pendingCommand = null;
    elements.actionStatus.textContent = revisionConflict
      ? "Campaign position changed. Refreshed; review the feed and submit again."
      : "That choice is no longer available. The campaign feed was refreshed.";
    await attachCampaign().catch(() => undefined);
    return;
  }
  elements.actionStatus.textContent = commandKind === "choice"
    ? "Choice delivery was not confirmed. Retry the highlighted option with the same command ID."
    : "Delivery was not confirmed. Retry sends the same command ID safely.";
  showError(error.message || `The ${commandKind} could not be delivered.`);
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
  stopPolling();
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
  const discardedKind = pendingKind() === "campaign.submit_choice" ? "choice" : "action";
  state.pendingCommand = null;
  updateComposer();
  renderCampaign();
  elements.actionStatus.textContent = `Failed ${discardedKind} delivery discarded. Ready for a new command.`;
  showError("");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.campaignId) void attachCampaign({ quiet: true }).catch(() => undefined);
});

document.addEventListener("gameframe:before-home", () => stopPolling(), { once: true });
window.addEventListener("pagehide", stopPolling, { once: true });

if (parameters.has("campaign")) {
  void openCampaign(elements.campaignInput.value).catch((error) => showError(error.message));
}
