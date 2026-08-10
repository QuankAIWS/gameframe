const STATE_EVENT = "gameframe:monster-master-rpg-state";
const CURRENT_CAMPAIGN_KEY = "scribbles-gameframe.monster-master-rpg.campaign";
const RECENT_CAMPAIGNS_KEY = "scribbles-gameframe.monster-master-rpg.recent-campaigns.v1";
const STAGING_CAMPAIGN_ID = "monster-master-staging-v6";
const MAX_RECENT_CAMPAIGNS = 12;

installStylesheet();

const elements = {
  join: document.querySelector("#mm-rpg-join"),
  joinCopy: document.querySelector("#mm-rpg-join .mm-rpg-join-copy"),
  joinForm: document.querySelector("#mm-rpg-join-form"),
  campaignInput: document.querySelector("#mm-rpg-campaign-id"),
  campaign: document.querySelector("#mm-rpg-campaign"),
  switchCampaign: document.querySelector("#mm-rpg-switch"),
};

const requestedDeepLinkCampaignId = normalizeCampaignId(
  new URLSearchParams(window.location.search).get("campaign"),
);
let deepLinkPending = Boolean(requestedDeepLinkCampaignId);
let lobby = null;
let list = null;
let lobbyActions = null;
let campaignsButton = null;
let renderedSignature = "";
let rememberedProjectionSignature = "";

function installStylesheet() {
  if (document.querySelector('link[href="/monster-master-rpg-campaign-lobby.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/monster-master-rpg-campaign-lobby.css";
  document.head.append(link);
}

function campaignActive() {
  return Boolean(elements.campaign && !elements.campaign.hidden);
}

function normalizeCampaignId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(id) ? id : null;
}

function readRecentCampaigns() {
  let records = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_CAMPAIGNS_KEY) || "[]");
    if (Array.isArray(parsed)) records = parsed;
  } catch {
    records = [];
  }

  const normalized = [];
  for (const record of records) {
    const campaignId = normalizeCampaignId(record?.campaignId);
    if (!campaignId || normalized.some((candidate) => candidate.campaignId === campaignId)) continue;
    normalized.push({
      campaignId,
      title: typeof record?.title === "string" && record.title.trim()
        ? record.title.trim().slice(0, 200)
        : campaignId,
      status: record?.status === "paused" || record?.status === "completed" ? record.status : "active",
      lastOpenedAt: typeof record?.lastOpenedAt === "string" ? record.lastOpenedAt : null,
    });
  }

  const lastCampaign = normalizeCampaignId(window.localStorage.getItem(CURRENT_CAMPAIGN_KEY));
  if (lastCampaign && !normalized.some((record) => record.campaignId === lastCampaign)) {
    normalized.unshift({
      campaignId: lastCampaign,
      title: lastCampaign === STAGING_CAMPAIGN_ID
        ? "Monster Master: The Crooked Checkpoint"
        : lastCampaign,
      status: "active",
      lastOpenedAt: null,
    });
  }

  if (!normalized.some((record) => record.campaignId === STAGING_CAMPAIGN_ID)) {
    normalized.push({
      campaignId: STAGING_CAMPAIGN_ID,
      title: "Monster Master: The Crooked Checkpoint",
      status: "active",
      lastOpenedAt: null,
    });
  }

  normalized.sort((left, right) => {
    if (left.campaignId === lastCampaign && right.campaignId !== lastCampaign) return -1;
    if (right.campaignId === lastCampaign && left.campaignId !== lastCampaign) return 1;
    const leftTime = Date.parse(left.lastOpenedAt || "") || 0;
    const rightTime = Date.parse(right.lastOpenedAt || "") || 0;
    return rightTime - leftTime || left.title.localeCompare(right.title);
  });
  return normalized.slice(0, MAX_RECENT_CAMPAIGNS);
}

function writeRecentCampaigns(records) {
  try {
    window.localStorage.setItem(
      RECENT_CAMPAIGNS_KEY,
      JSON.stringify(records.slice(0, MAX_RECENT_CAMPAIGNS)),
    );
  } catch {
    // Campaign history is a convenience index; durable campaign state is server-owned.
  }
}

function rememberCurrentCampaign() {
  const projection = window.gameFrameMonsterRpgApp?.getProjection?.();
  const campaignId = normalizeCampaignId(projection?.campaignId);
  if (!campaignId) return;
  const signature = JSON.stringify({
    campaignId,
    title: projection.title,
    status: projection.status,
  });
  if (signature === rememberedProjectionSignature) return;
  rememberedProjectionSignature = signature;

  const next = readRecentCampaigns().filter((record) => record.campaignId !== campaignId);
  next.unshift({
    campaignId,
    title: typeof projection.title === "string" && projection.title.trim()
      ? projection.title.trim().slice(0, 200)
      : campaignId,
    status: projection.status === "paused" || projection.status === "completed"
      ? projection.status
      : "active",
    lastOpenedAt: new Date().toISOString(),
  });
  writeRecentCampaigns(next);
  renderedSignature = "";
  renderCampaignCards();
}

function ensureLobby() {
  if (!elements.join || !elements.joinForm) return null;
  if (lobby?.isConnected) return lobby;

  const title = elements.joinCopy?.querySelector("h2");
  const description = elements.joinCopy?.querySelector("p:last-child");
  if (title) title.textContent = deepLinkPending ? "Resuming campaign…" : "Campaign lobby";
  if (description) {
    description.textContent = deepLinkPending
      ? `Opening ${requestedDeepLinkCampaignId}. If it is unavailable, the campaign lobby will return.`
      : "Resume a recent campaign, open the staging adventure, or join another campaign by code.";
  }

  lobby = document.createElement("section");
  lobby.id = "mm-rpg-campaign-lobby";
  lobby.className = "mm-rpg-campaign-lobby";
  lobby.setAttribute("aria-labelledby", "mm-rpg-campaign-lobby-title");

  const heading = document.createElement("header");
  heading.className = "mm-rpg-campaign-lobby-heading";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "mm-rpg-label";
  eyebrow.textContent = "YOUR MONSTER MASTER CAMPAIGNS";
  const headingTitle = document.createElement("h3");
  headingTitle.id = "mm-rpg-campaign-lobby-title";
  headingTitle.textContent = "Continue playing";
  copy.append(eyebrow, headingTitle);

  lobbyActions = document.createElement("div");
  lobbyActions.id = "mm-rpg-lobby-actions";
  lobbyActions.className = "mm-rpg-lobby-actions";
  heading.append(copy, lobbyActions);

  list = document.createElement("div");
  list.id = "mm-rpg-campaign-list";
  list.className = "mm-rpg-campaign-list";
  lobby.append(heading, list);
  elements.joinForm.before(lobby);
  elements.joinForm.dataset.lobbyJoin = "";
  const label = elements.joinForm.querySelector('label[for="mm-rpg-campaign-id"]');
  if (label) label.textContent = "Campaign code";
  renderedSignature = "";
  synchronizeDeepLinkPresentation();
  return lobby;
}

function synchronizeDeepLinkPresentation() {
  if (!elements.joinForm || !elements.joinCopy) return;
  const title = elements.joinCopy.querySelector("h2");
  const description = elements.joinCopy.querySelector("p:last-child");
  if (deepLinkPending) {
    if (title) title.textContent = "Resuming campaign…";
    if (description) description.textContent = `Opening ${requestedDeepLinkCampaignId}. If it is unavailable, the campaign lobby will return.`;
    if (lobby) lobby.hidden = true;
    elements.joinForm.hidden = true;
    return;
  }
  if (title) title.textContent = "Campaign lobby";
  if (description) description.textContent = "Resume a recent campaign, open the staging adventure, or join another campaign by code.";
  if (lobby) lobby.hidden = false;
  elements.joinForm.hidden = false;
}

function settleDeepLinkState() {
  if (!deepLinkPending) return;
  const app = window.gameFrameMonsterRpgApp;
  if (campaignActive()) {
    deepLinkPending = false;
    return;
  }
  if (app && !app.getCampaignId?.()) {
    deepLinkPending = false;
    synchronizeDeepLinkPresentation();
  }
}

function formatOpenedAt(value) {
  if (!value) return "Available campaign";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent campaign";
  return `Last opened ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

function openCampaign(campaignId) {
  ensureLobby();
  if (!elements.campaignInput || !elements.joinForm) return;
  elements.campaignInput.value = campaignId;
  elements.joinForm.requestSubmit();
}

function renderCampaignCards() {
  ensureLobby();
  if (!list) return;
  const lastCampaign = normalizeCampaignId(window.localStorage.getItem(CURRENT_CAMPAIGN_KEY));
  const records = readRecentCampaigns();
  const signature = JSON.stringify({ lastCampaign, records });
  if (signature === renderedSignature && list.childElementCount === records.length) return;
  renderedSignature = signature;

  const cards = records.map((record) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "mm-rpg-campaign-card";
    card.dataset.campaignId = record.campaignId;
    card.dataset.last = String(record.campaignId === lastCampaign);
    card.setAttribute("aria-label", `${record.campaignId === lastCampaign ? "Resume" : "Open"} ${record.title}`);

    const state = document.createElement("small");
    state.textContent = record.campaignId === STAGING_CAMPAIGN_ID
      ? "STAGING · TEST CAMPAIGN"
      : record.status.toUpperCase();
    const title = document.createElement("strong");
    title.textContent = record.title;
    const code = document.createElement("span");
    code.textContent = record.campaignId;
    const footer = document.createElement("span");
    footer.className = "mm-rpg-campaign-card-footer";
    const opened = document.createElement("span");
    opened.textContent = formatOpenedAt(record.lastOpenedAt);
    const action = document.createElement("span");
    action.textContent = record.campaignId === lastCampaign ? "Resume ›" : "Open ›";
    footer.append(opened, action);
    card.append(state, title, code, footer);
    card.addEventListener("click", () => openCampaign(record.campaignId));
    return card;
  });
  list.replaceChildren(...cards);
}

function clearCampaignDeepLink() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("campaign")) return;
  url.searchParams.delete("campaign");
  window.history.replaceState({}, "", url);
}

function ensureCampaignsButton() {
  const toolbar = document.querySelector(".mm-rpg-play-toolbar");
  if (!toolbar) return null;
  if (!campaignsButton?.isConnected) {
    campaignsButton = document.createElement("button");
    campaignsButton.id = "mm-rpg-campaigns-open";
    campaignsButton.type = "button";
    campaignsButton.textContent = "Campaigns";
    campaignsButton.setAttribute("aria-label", "Return to campaign lobby");
    campaignsButton.addEventListener("click", () => elements.switchCampaign?.click());
  }
  if (!toolbar.contains(campaignsButton)) toolbar.prepend(campaignsButton);
  return campaignsButton;
}

function preferredAdminHost() {
  ensureLobby();
  if (campaignActive()) return document.querySelector(".mm-rpg-play-toolbar");
  return lobbyActions;
}

function relocateAdminButton() {
  const admin = document.querySelector("#mm-rpg-admin-open");
  const host = preferredAdminHost();
  if (admin && host && admin.parentElement !== host) host.append(admin);
}

function synchronize() {
  ensureLobby();
  settleDeepLinkState();
  ensureCampaignsButton();
  relocateAdminButton();
  if (campaignActive()) rememberCurrentCampaign();
  else if (!deepLinkPending) renderCampaignCards();
}

if (elements.switchCampaign) {
  elements.switchCampaign.addEventListener("click", () => {
    queueMicrotask(() => {
      deepLinkPending = false;
      rememberedProjectionSignature = "";
      clearCampaignDeepLink();
      synchronizeDeepLinkPresentation();
      renderedSignature = "";
      renderCampaignCards();
      relocateAdminButton();
    });
  });
}

window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));

if (elements.campaign) {
  new MutationObserver(() => queueMicrotask(synchronize)).observe(elements.campaign, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
}
new MutationObserver(() => queueMicrotask(synchronize)).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden"],
});

window.gameFrameMonsterRpgCampaignLobby = Object.freeze({
  open: () => elements.switchCampaign?.click(),
  openCampaign,
  refresh: () => {
    renderedSignature = "";
    renderCampaignCards();
  },
});

synchronize();
