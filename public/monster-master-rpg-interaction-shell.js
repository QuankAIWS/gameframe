import { gameFrameFetch } from "./gameframe-auth.js";

const identity = window.gameFrameIdentity;
if (!identity?.playerId) {
  throw new Error("Monster Master RPG interaction shell requires an authenticated GameFrame identity.");
}

const MAX_TEXT_LENGTH = 2_000;
const MAX_REQUEST_TIMEOUT_MS = 12_000;

installStylesheet();

const elements = {
  campaign: document.querySelector("#mm-rpg-campaign"),
  title: document.querySelector("#mm-rpg-campaign-title"),
  connection: document.querySelector("#mm-rpg-connection"),
  world: document.querySelector("#mm-rpg-world"),
  stage: document.querySelector("#mm-rpg-world .mm-rpg-world-stage"),
  story: document.querySelector(".mm-rpg-story"),
  events: document.querySelector("#mm-rpg-events"),
  refresh: document.querySelector("#mm-rpg-refresh"),
  editProfile: document.querySelector("#mm-rpg-edit-staging-profile"),
  objective: document.querySelector("#mm-rpg-current-objective"),
  actionForm: document.querySelector("#mm-rpg-action-form"),
  action: document.querySelector("#mm-rpg-action"),
  send: document.querySelector("#mm-rpg-send"),
  actionStatus: document.querySelector("#mm-rpg-action-status"),
  count: document.querySelector("#mm-rpg-count"),
  coordination: document.querySelector("#mm-rpg-coordination"),
  error: document.querySelector("#mm-rpg-error"),
};

let askGmPending = null;
let askGmSubmitting = false;
let installed = false;
let actionOpen = false;
let askGmOpen = false;
let chronicleOpen = false;
let hud = null;
let askPanel = null;
let chroniclePanel = null;
let actionButton = null;
let askButton = null;
let chronicleButton = null;

function installStylesheet() {
  if (document.querySelector('link[href="/monster-master-rpg-interaction-shell.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/monster-master-rpg-interaction-shell.css";
  document.head.append(link);
}

function currentWorldPayload() {
  return window.gameFrameMonsterRpgWorld?.getPayload?.() ?? null;
}

function currentCampaignId() {
  const value = currentWorldPayload()?.projection?.campaignId;
  return typeof value === "string" && value ? value : null;
}

function currentCoordinationRevision() {
  const payloadRevision = currentWorldPayload()?.projection?.gameframeCoordinationRevision;
  if (Number.isSafeInteger(payloadRevision) && payloadRevision >= 0) return payloadRevision;
  const value = Number(elements.coordination?.textContent ?? "");
  if (Number.isSafeInteger(value) && value >= 0) return value;
  throw new Error("Campaign coordination state is unavailable. Refresh and try again.");
}

function ensureInstalled() {
  if (installed || !elements.stage || !elements.actionForm) return false;
  installed = true;
  document.body.classList.add("mm-rpg-play-shell");

  elements.actionForm.classList.add("mm-rpg-action-dock");
  elements.stage.append(elements.actionForm);
  configureActionComposer();

  hud = buildHud();
  elements.stage.append(hud);
  askPanel = buildAskGmPanel();
  chroniclePanel = buildChroniclePanel();
  elements.stage.append(askPanel, chroniclePanel);

  synchronizeCampaignVisibility();
  synchronizeHud();
  synchronizePrivateHistory();
  return true;
}

function configureActionComposer() {
  const label = elements.actionForm.querySelector('label[for="mm-rpg-action"]');
  const helper = elements.actionForm.querySelector(".mm-rpg-composer-heading small");
  if (label) label.textContent = "What do you do?";
  if (helper) {
    helper.textContent = "Describe an in-world action or intent. This is not automatically spoken aloud. Use Talk for character speech or Ask GM for a private question.";
  }
  if (elements.action) {
    elements.action.placeholder = "Inspect the cart, approach the checkpoint, signal Pell, withdraw, use an item, or attempt another in-world action…";
  }
  if (elements.send && !window.gameFrameMonsterRpgTalk?.ownsComposer?.()) {
    elements.send.textContent = "Do it";
  }
  const actionButtons = elements.actionForm.querySelector(".mm-rpg-composer-actions > div");
  if (actionButtons && !document.querySelector("#mm-rpg-action-dismiss")) {
    const dismiss = document.createElement("button");
    dismiss.id = "mm-rpg-action-dismiss";
    dismiss.type = "button";
    dismiss.className = "mm-rpg-action-dock-dismiss";
    dismiss.textContent = "Close";
    dismiss.addEventListener("click", () => setActionOpen(false));
    actionButtons.prepend(dismiss);
  }
}

function buildHud() {
  const root = document.createElement("div");
  root.className = "mm-rpg-play-hud";

  const title = document.createElement("div");
  title.className = "mm-rpg-play-title";
  const titleLabel = document.createElement("small");
  titleLabel.textContent = "MONSTER MASTER";
  const titleValue = document.createElement("strong");
  titleValue.dataset.mmRpgHudTitle = "";
  titleValue.textContent = elements.title?.textContent || "Campaign";
  title.append(titleLabel, titleValue);

  const right = document.createElement("div");
  right.className = "mm-rpg-hud-right";
  const objective = document.createElement("div");
  objective.className = "mm-rpg-objective-hud";
  const objectiveLabel = document.createElement("small");
  objectiveLabel.textContent = "CURRENT OBJECTIVE";
  const objectiveValue = document.createElement("strong");
  objectiveValue.dataset.mmRpgHudObjective = "";
  objectiveValue.textContent = elements.objective?.textContent || "Continue the field assignment.";
  objective.append(objectiveLabel, objectiveValue);

  const toolbar = document.createElement("nav");
  toolbar.className = "mm-rpg-play-toolbar";
  toolbar.setAttribute("aria-label", "RPG controls");

  actionButton = toolbarButton("Action", "Describe an in-world action");
  askButton = toolbarButton("Ask GM", "Open private Game Master chat");
  chronicleButton = toolbarButton("Journal", "Open campaign chronicle");
  actionButton.addEventListener("click", () => {
    setAskGmOpen(false);
    setChronicleOpen(false);
    window.gameFrameMonsterRpgTalk?.cancel?.();
    setActionOpen(!actionOpen);
  });
  askButton.addEventListener("click", () => {
    setActionOpen(false);
    setChronicleOpen(false);
    window.gameFrameMonsterRpgTalk?.cancel?.();
    setAskGmOpen(!askGmOpen);
  });
  chronicleButton.addEventListener("click", () => {
    setActionOpen(false);
    setAskGmOpen(false);
    setChronicleOpen(!chronicleOpen);
  });
  toolbar.append(actionButton, askButton, chronicleButton);
  if (elements.refresh) {
    elements.refresh.classList.add("mm-rpg-hud-refresh");
    toolbar.append(elements.refresh);
  }
  if (elements.editProfile) {
    elements.editProfile.classList.add("mm-rpg-hud-profile");
    toolbar.append(elements.editProfile);
  }
  right.append(objective, toolbar);
  root.append(title, right);
  return root;
}

function toolbarButton(label, ariaLabel) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.setAttribute("aria-pressed", "false");
  return button;
}

function buildAskGmPanel() {
  const panel = document.createElement("section");
  panel.id = "mm-rpg-ask-gm-panel";
  panel.className = "mm-rpg-overlay-panel";
  panel.hidden = true;

  const header = document.createElement("header");
  const heading = document.createElement("div");
  const eyebrow = document.createElement("small");
  eyebrow.textContent = "PRIVATE · OUT OF FICTION";
  const title = document.createElement("strong");
  title.textContent = "Game Master";
  heading.append(eyebrow, title);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "mm-rpg-overlay-close";
  close.setAttribute("aria-label", "Close private Game Master chat");
  close.textContent = "×";
  close.addEventListener("click", () => setAskGmOpen(false));
  header.append(heading, close);

  const history = document.createElement("div");
  history.id = "mm-rpg-ask-gm-history";
  history.className = "mm-rpg-ask-gm-history";
  history.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "mm-rpg-ask-gm-form";
  const textarea = document.createElement("textarea");
  textarea.id = "mm-rpg-ask-gm-input";
  textarea.maxLength = MAX_TEXT_LENGTH;
  textarea.placeholder = "Ask the Game Master privately. Nobody in the world hears this.";
  const footer = document.createElement("footer");
  const status = document.createElement("small");
  status.id = "mm-rpg-ask-gm-status";
  status.textContent = "Private. This will not become dialogue or an in-world action.";
  const send = document.createElement("button");
  send.id = "mm-rpg-ask-gm-send";
  send.type = "submit";
  send.textContent = "Ask GM";
  footer.append(status, send);
  form.append(textarea, footer);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAskGm(textarea, send, status);
  });
  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  panel.append(header, history, form);
  return panel;
}

function buildChroniclePanel() {
  const panel = document.createElement("section");
  panel.id = "mm-rpg-chronicle-panel";
  panel.className = "mm-rpg-overlay-panel";
  panel.hidden = true;

  const header = document.createElement("header");
  const heading = document.createElement("div");
  const eyebrow = document.createElement("small");
  eyebrow.textContent = "CAMPAIGN CHRONICLE";
  const title = document.createElement("strong");
  title.textContent = "What has happened";
  heading.append(eyebrow, title);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "mm-rpg-overlay-close";
  close.setAttribute("aria-label", "Close campaign chronicle");
  close.textContent = "×";
  close.addEventListener("click", () => setChronicleOpen(false));
  header.append(heading, close);

  const list = document.createElement("ol");
  list.id = "mm-rpg-chronicle-list";
  list.className = "mm-rpg-chronicle-list mm-rpg-events";
  panel.append(header, list);
  return panel;
}

function setActionOpen(open) {
  actionOpen = Boolean(open);
  elements.actionForm?.classList.toggle("is-open", actionOpen);
  actionButton?.setAttribute("aria-pressed", String(actionOpen));
  if (actionOpen) {
    configureActionComposer();
    elements.action?.focus();
  }
}

function setAskGmOpen(open) {
  askGmOpen = Boolean(open);
  if (askPanel && askPanel.hidden !== !askGmOpen) askPanel.hidden = !askGmOpen;
  askButton?.setAttribute("aria-pressed", String(askGmOpen));
  if (askGmOpen) {
    synchronizePrivateHistory();
    askPanel?.querySelector("textarea")?.focus();
  }
}

function setChronicleOpen(open) {
  chronicleOpen = Boolean(open);
  if (chroniclePanel && chroniclePanel.hidden !== !chronicleOpen) {
    chroniclePanel.hidden = !chronicleOpen;
  }
  chronicleButton?.setAttribute("aria-pressed", String(chronicleOpen));
  if (chronicleOpen) synchronizeChronicle();
}

function synchronizeCampaignVisibility() {
  if (!elements.campaign) return;
  const active = !elements.campaign.hidden;
  document.body.classList.toggle("mm-rpg-play-shell", active);
  if (!active) {
    setActionOpen(false);
    setAskGmOpen(false);
    setChronicleOpen(false);
  }
}

function synchronizeHud() {
  if (!hud) return;
  const title = hud.querySelector("[data-mm-rpg-hud-title]");
  const objective = hud.querySelector("[data-mm-rpg-hud-objective]");
  if (title) title.textContent = elements.title?.textContent || "Monster Master campaign";
  if (objective) objective.textContent = elements.objective?.textContent || "Continue the field assignment.";
}

function synchronizeChronicle() {
  const list = chroniclePanel?.querySelector("#mm-rpg-chronicle-list");
  if (!list || !elements.events) return;
  list.replaceChildren(...[...elements.events.children].map(cloneChronicleEvent));
  list.scrollTop = list.scrollHeight;
}

function cloneChronicleEvent(item) {
  const clone = item.cloneNode(true);
  const nodes = [clone, ...clone.querySelectorAll("*")];
  for (const node of nodes) {
    node.removeAttribute("id");
    node.removeAttribute("data-event-id");
    node.removeAttribute("data-choice-id");
    node.removeAttribute("data-option-id");
    node.removeAttribute("data-encounter-id");
    node.removeAttribute("data-interaction-target-id");
  }
  for (const button of clone.querySelectorAll("button")) {
    button.disabled = true;
    button.removeAttribute("aria-pressed");
  }
  for (const link of clone.querySelectorAll("a")) {
    link.removeAttribute("href");
    link.removeAttribute("target");
  }
  return clone;
}

function synchronizePrivateHistory() {
  const history = askPanel?.querySelector("#mm-rpg-ask-gm-history");
  if (!history || !elements.events) return;
  const bubbles = [];
  for (const item of elements.events.children) {
    if (!item.classList.contains("mm-rpg-private-gm-event")) continue;
    const body = item.querySelector("p")?.textContent?.trim();
    if (!body) continue;
    const bubble = document.createElement("div");
    bubble.className = "mm-rpg-ask-bubble";
    bubble.dataset.speaker = "gm";
    bubble.textContent = body;
    bubbles.push(bubble);
  }
  if (askGmPending?.text) {
    const bubble = document.createElement("div");
    bubble.className = "mm-rpg-ask-bubble";
    bubble.dataset.speaker = "player";
    bubble.textContent = askGmPending.text;
    bubbles.push(bubble);
  }
  history.replaceChildren(...bubbles);
  history.scrollTop = history.scrollHeight;
}

function buildAskGmCommand(text) {
  if (askGmPending) return askGmPending;
  const campaignId = currentCampaignId();
  if (!campaignId) throw new Error("The campaign world is not ready for Ask GM.");
  const action = String(text ?? "").trim();
  if (!action || action.length > MAX_TEXT_LENGTH) {
    throw new Error(`Ask GM requires 1 through ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
  }
  askGmPending = {
    protocolVersion: 2,
    campaignId,
    commandId: `command:${crypto.randomUUID()}`,
    issuedAt: new Date().toISOString(),
    command: {
      kind: "campaign.submit_action",
      expectedGameframeCoordinationRevision: currentCoordinationRevision(),
      visibility: "private-to-runtime",
      communication: "ask-gm",
      text: action,
    },
    text: action,
  };
  return askGmPending;
}

async function submitAskGm(textarea, send, status) {
  if (askGmSubmitting) return;
  let request;
  try {
    request = buildAskGmCommand(textarea.value);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Ask GM could not be prepared.");
    return;
  }

  askGmSubmitting = true;
  send.disabled = true;
  send.textContent = askGmPending ? "Retry Ask GM" : "Ask GM";
  status.textContent = "Sending privately to the Game Master…";
  synchronizePrivateHistory();
  showError("");
  try {
    await requestJson(
      `/api/rpg/campaigns/${encodeURIComponent(request.campaignId)}/commands`,
      stripUiFields(request),
    );
    askGmPending = null;
    textarea.value = "";
    send.textContent = "Ask GM";
    status.textContent = "Question accepted. Waiting for the private Game Master response.";
    elements.refresh?.click();
  } catch (error) {
    const stale = error?.status === 409 && /revision|coordination|stale/i.test(`${error?.code || ""} ${error?.message || ""}`);
    if (stale) {
      askGmPending = null;
      status.textContent = "Campaign state changed. Refreshed; ask again from the current state.";
      elements.refresh?.click();
    } else {
      status.textContent = "Delivery was not confirmed. Retry sends the exact same private question.";
      send.textContent = "Retry Ask GM";
    }
    showError(error?.message || "The private Game Master question could not be delivered.");
  } finally {
    askGmSubmitting = false;
    send.disabled = false;
    synchronizePrivateHistory();
  }
}

function stripUiFields(request) {
  const { text: _text, ...transport } = request;
  return transport;
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
      error.value = value;
      throw error;
    }
    return value;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("GameFrame did not confirm the private GM request before timeout.");
      timeoutError.code = "request_timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function showError(message) {
  if (!elements.error) return;
  elements.error.textContent = message || "";
  elements.error.hidden = !message;
}

function markPrivateEvents() {
  if (!elements.events) return;
  for (const item of elements.events.children) {
    const eventId = item.dataset.eventId;
    if (!eventId) continue;
    const projectionEvents = window.gameFrameMonsterRpgApp?.getEvents?.() ?? [];
    const event = projectionEvents.find((candidate) => candidate?.eventId === eventId);
    if (event?.payload?.presentationMode === "ask-gm-private") {
      item.classList.add("mm-rpg-private-gm-event");
    }
  }
}

const observer = new MutationObserver(() => {
  if (!installed) ensureInstalled();
  synchronizeCampaignVisibility();
  synchronizeHud();
  markPrivateEvents();
  if (chronicleOpen) synchronizeChronicle();
  if (askGmOpen) synchronizePrivateHistory();
});

if (elements.campaign) {
  observer.observe(elements.campaign, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
}
if (elements.events) {
  observer.observe(elements.events, {
    subtree: true,
    childList: true,
  });
}

window.addEventListener("gameframe:monster-master-pixi-view", () => {
  ensureInstalled();
  synchronizeHud();
});

window.gameFrameMonsterRpgInteractionShell = Object.freeze({
  openAction: () => {
    setAskGmOpen(false);
    setChronicleOpen(false);
    setActionOpen(true);
  },
  openAskGm: () => {
    setActionOpen(false);
    setChronicleOpen(false);
    setAskGmOpen(true);
  },
  openChronicle: () => {
    setActionOpen(false);
    setAskGmOpen(false);
    setChronicleOpen(true);
  },
  closeOverlays: () => {
    setActionOpen(false);
    setAskGmOpen(false);
    setChronicleOpen(false);
  },
  refresh: () => {
    synchronizeHud();
    markPrivateEvents();
    synchronizePrivateHistory();
    synchronizeChronicle();
  },
});

queueMicrotask(ensureInstalled);
