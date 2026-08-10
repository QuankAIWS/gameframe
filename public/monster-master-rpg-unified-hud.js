const STATE_EVENT = "gameframe:monster-master-rpg-state";
const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const DOCK_ID = "mm-rpg-unified-dock";

installStylesheet();

let activeTab = "world";
let dock = null;
let panes = new Map();
let tabs = new Map();

function installStylesheet() {
  if (document.querySelector('link[href="/monster-master-rpg-unified-hud.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/monster-master-rpg-unified-hud.css";
  document.head.append(link);
}

function makeTab(id, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.mmRpgDockTab = id;
  button.textContent = label;
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", "false");
  button.addEventListener("click", () => activate(id));
  tabs.set(id, button);
  return button;
}

function makePane(id) {
  const pane = document.createElement("section");
  pane.className = "mm-rpg-dock-pane";
  pane.dataset.mmRpgDockPane = id;
  pane.setAttribute("role", "tabpanel");
  pane.hidden = true;
  panes.set(id, pane);
  return pane;
}

function ensureDock() {
  if (dock?.isConnected) {
    adoptDynamicSurfaces();
    synchronizeHeader();
    return true;
  }
  const campaign = document.querySelector("#mm-rpg-campaign");
  const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
  const events = document.querySelector("#mm-rpg-events");
  const actionForm = document.querySelector("#mm-rpg-action-form");
  const askPanel = document.querySelector("#mm-rpg-ask-gm-panel");
  const chroniclePanel = document.querySelector("#mm-rpg-chronicle-panel");
  if (!campaign || !stage || !events || !actionForm || !askPanel || !chroniclePanel) return false;

  dock = document.createElement("aside");
  dock.id = DOCK_ID;
  dock.className = "mm-rpg-unified-dock";
  dock.setAttribute("aria-label", "Monster Master campaign HUD");

  const header = document.createElement("header");
  header.className = "mm-rpg-dock-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("small");
  eyebrow.textContent = "MONSTER MASTER RPG";
  const title = document.createElement("strong");
  title.dataset.mmRpgDockTitle = "";
  const place = document.createElement("span");
  place.dataset.mmRpgDockPlace = "";
  heading.append(eyebrow, title, place);
  const connection = document.querySelector("#mm-rpg-connection");
  if (connection) header.append(heading, connection);
  else header.append(heading);

  const tabbar = document.createElement("nav");
  tabbar.className = "mm-rpg-dock-tabs";
  tabbar.setAttribute("role", "tablist");
  tabbar.append(
    makeTab("world", "World"),
    makeTab("talk", "Talk"),
    makeTab("gm", "Ask GM"),
    makeTab("whispers", "Whispers"),
    makeTab("campaign", "Campaign"),
  );

  const body = document.createElement("div");
  body.className = "mm-rpg-dock-body";
  const worldPane = makePane("world");
  const talkPane = makePane("talk");
  const gmPane = makePane("gm");
  const whispersPane = makePane("whispers");
  const campaignPane = makePane("campaign");

  const worldHeading = document.createElement("div");
  worldHeading.className = "mm-rpg-dock-section-heading";
  worldHeading.innerHTML = "<small>SCENE & WORLD CHAT</small><strong>What is happening here</strong>";
  const feed = document.createElement("div");
  feed.className = "mm-rpg-dock-world-feed";
  const empty = document.querySelector("#mm-rpg-empty");
  if (empty) feed.append(empty);
  feed.append(events);
  worldPane.append(worldHeading, feed, actionForm);

  const talkEmpty = document.createElement("div");
  talkEmpty.className = "mm-rpg-dock-empty";
  talkEmpty.dataset.mmRpgTalkEmpty = "";
  talkEmpty.innerHTML = "<strong>No conversation selected.</strong><span>Move next to someone and use Talk. Their conversation will stay in this pane.</span>";
  talkPane.append(talkEmpty);

  askPanel.hidden = false;
  gmPane.append(askPanel);

  const whisperEmpty = document.createElement("div");
  whisperEmpty.className = "mm-rpg-dock-empty";
  whisperEmpty.innerHTML = "<strong>Whispers</strong><span>Private in-world speech is not wired yet. When it is, whispered conversations will live here instead of being mixed into public scene chat.</span>";
  whispersPane.append(whisperEmpty);

  const objective = document.querySelector(".mm-rpg-objective-card");
  const sidebar = document.querySelector(".mm-rpg-sidebar");
  const campaignActions = document.createElement("div");
  campaignActions.className = "mm-rpg-dock-campaign-actions";
  const switchCampaign = document.querySelector("#mm-rpg-switch");
  const admin = document.querySelector("#mm-rpg-admin-open");
  const editProfile = document.querySelector("#mm-rpg-edit-staging-profile");
  for (const control of [switchCampaign, admin, editProfile]) {
    if (control) campaignActions.append(control);
  }
  if (objective) campaignPane.append(objective);
  if (sidebar) campaignPane.append(sidebar);
  campaignPane.append(campaignActions);

  body.append(worldPane, talkPane, gmPane, whispersPane, campaignPane);
  dock.append(header, tabbar, body);
  campaign.append(dock);

  // The old Chronicle panel remains a compatibility projection. Its underlying
  // #mm-rpg-events list now lives directly in World, so keep the clone hidden.
  chroniclePanel.hidden = true;
  document.querySelector(".mm-rpg-play-hud")?.classList.add("mm-rpg-legacy-hud-hidden");

  adoptDynamicSurfaces();
  synchronizeHeader();
  activate(activeTab);
  return true;
}

function adoptDynamicSurfaces() {
  if (!dock) return;
  const talkPane = panes.get("talk");
  const talkPanel = document.querySelector("#mm-rpg-talk-panel");
  if (talkPane && talkPanel) {
    if (talkPanel.parentElement !== talkPane) {
      talkPane.querySelector("[data-mm-rpg-talk-empty]")?.remove();
      talkPane.append(talkPanel);
    }
    if (talkPanel.dataset.mmRpgDockObserved !== "true") {
      talkPanel.dataset.mmRpgDockObserved = "true";
      new MutationObserver(() => {
        // Talk v2 owns semantic conversation selection. When it opens a target,
        // make that same real panel the visible dock tab rather than leaving it
        // underneath World after reparenting.
        if (!talkPanel.hidden) activate("talk");
      }).observe(talkPanel, { attributes: true, attributeFilter: ["hidden"] });
    }
    if (!talkPanel.hidden) activate("talk");
  }

  const admin = document.querySelector("#mm-rpg-admin-open");
  const actions = panes.get("campaign")?.querySelector(".mm-rpg-dock-campaign-actions");
  if (admin && actions && admin.parentElement !== actions) actions.append(admin);
}

function activate(id) {
  if (!panes.has(id)) return;
  activeTab = id;
  for (const [tabId, pane] of panes) {
    const active = tabId === id;
    pane.hidden = !active;
    const button = tabs.get(tabId);
    button?.setAttribute("aria-selected", String(active));
    button?.classList.toggle("is-active", active);
  }

  // These panels keep their original listeners and histories. The unified dock
  // owns visibility, while the old top toolbar is deliberately retired.
  const askPanel = document.querySelector("#mm-rpg-ask-gm-panel");
  if (askPanel) askPanel.hidden = id !== "gm";
  const talkPanel = document.querySelector("#mm-rpg-talk-panel");
  if (talkPanel && talkPanel.parentElement === panes.get("talk")) {
    talkPanel.hidden = id !== "talk";
  }
  if (id === "world") {
    const feed = document.querySelector(".mm-rpg-dock-world-feed");
    if (feed) feed.scrollTop = feed.scrollHeight;
  }
}

function synchronizeHeader() {
  if (!dock) return;
  const title = dock.querySelector("[data-mm-rpg-dock-title]");
  const place = dock.querySelector("[data-mm-rpg-dock-place]");
  if (title) title.textContent = document.querySelector("#mm-rpg-campaign-title")?.textContent || "Campaign";
  if (place) place.textContent = document.querySelector("#mm-rpg-world-location")?.textContent || "Materializing campaign scene…";
}

function synchronize() {
  if (!ensureDock()) return;
  adoptDynamicSurfaces();
  synchronizeHeader();
}

window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));
window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener("gameframe:rpg-talk-requested", () => {
  queueMicrotask(() => {
    synchronize();
    activate("talk");
  });
});
window.addEventListener("gameframe:before-home", () => {
  activeTab = "world";
});

const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
if (stage) {
  new MutationObserver(() => queueMicrotask(synchronize)).observe(stage, { childList: true });
}

window.gameFrameMonsterRpgUnifiedHud = Object.freeze({
  open: (tab = "world") => {
    synchronize();
    activate(tab);
  },
  activeTab: () => activeTab,
});

queueMicrotask(synchronize);
