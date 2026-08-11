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
  const refresh = document.querySelector("#mm-rpg-refresh");
  header.append(heading);
  if (connection) header.append(connection);
  if (refresh) {
    refresh.classList.add("mm-rpg-dock-refresh");
    header.append(refresh);
  }

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

  const nearby = document.createElement("section");
  nearby.className = "mm-rpg-dock-nearby";
  nearby.hidden = true;
  nearby.innerHTML = '<small>NEARBY ACTIONS</small>';
  const nearbyActions = document.createElement("div");
  nearbyActions.className = "mm-rpg-dock-nearby-actions";
  nearbyActions.dataset.mmRpgNearbyActions = "";
  nearby.append(nearbyActions);

  const feed = document.createElement("div");
  feed.className = "mm-rpg-dock-world-feed";
  const empty = document.querySelector("#mm-rpg-empty");
  if (empty) feed.append(empty);
  feed.append(events);
  worldPane.append(worldHeading, nearby, feed, actionForm);

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
  const editProfile = document.querySelector("#mm-rpg-edit-staging-profile");
  for (const control of [switchCampaign, editProfile]) {
    if (control) campaignActions.append(control);
  }
  if (objective) campaignPane.append(objective);
  if (sidebar) campaignPane.append(sidebar);
  campaignPane.append(campaignActions);

  body.append(worldPane, talkPane, gmPane, whispersPane, campaignPane);
  dock.append(header, tabbar, body);
  campaign.append(dock);

  chroniclePanel.hidden = true;
  document.querySelector(".mm-rpg-play-hud")?.classList.add("mm-rpg-legacy-hud-hidden");

  adoptDynamicSurfaces();
  synchronizeHeader();
  activate(activeTab);
  return true;
}

function ensureAdminProxy() {
  const actions = panes.get("campaign")?.querySelector(".mm-rpg-dock-campaign-actions");
  const realAdmin = document.querySelector("#mm-rpg-admin-open");
  if (!actions || !realAdmin || actions.querySelector("#mm-rpg-dock-admin")) return;
  const proxy = document.createElement("button");
  proxy.id = "mm-rpg-dock-admin";
  proxy.type = "button";
  proxy.className = "mm-rpg-secondary mm-rpg-admin-button";
  proxy.textContent = "Admin";
  proxy.addEventListener("click", () => realAdmin.click());
  actions.append(proxy);
}

function adoptNearbyWorldActions() {
  const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
  const host = dock?.querySelector("[data-mm-rpg-nearby-actions]");
  const nearby = host?.closest(".mm-rpg-dock-nearby");
  if (!stage || !host || !nearby) return;

  for (const control of stage.querySelectorAll(".mm-rpg-world-interact")) {
    host.append(control);
  }
  const controls = [...host.querySelectorAll(".mm-rpg-world-interact")];
  nearby.hidden = !controls.some((control) => !control.hidden);
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
        if (!talkPanel.hidden) {
          activate("talk");
        } else if (activeTab === "talk") {
          activate("world");
        }
      }).observe(talkPanel, { attributes: true, attributeFilter: ["hidden"] });
    }
    if (!talkPanel.hidden) activate("talk");
  }

  adoptNearbyWorldActions();

  const header = dock.querySelector(".mm-rpg-dock-header");
  const toolbar = document.querySelector(".mm-rpg-play-toolbar");
  if (header && toolbar && toolbar.parentElement !== header) {
    toolbar.classList.add("mm-rpg-dock-toolbar");
    header.append(toolbar);
  }
  ensureAdminProxy();
}

function synchronizeLegacyShell(id) {
  const shell = window.gameFrameMonsterRpgInteractionShell;
  if (!shell) return;
  if (id === "world") {
    shell.openAction?.();
    return;
  }
  if (id === "gm") {
    shell.openAskGm?.();
    return;
  }
  shell.closeOverlays?.();
}

function activate(id) {
  if (!panes.has(id)) return;
  activeTab = id;
  synchronizeLegacyShell(id);
  for (const [tabId, pane] of panes) {
    const active = tabId === id;
    pane.hidden = !active;
    const button = tabs.get(tabId);
    button?.setAttribute("aria-selected", String(active));
    button?.classList.toggle("is-active", active);
  }

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
