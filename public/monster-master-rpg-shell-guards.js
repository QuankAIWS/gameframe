const DOCK_ID = "mm-rpg-unified-dock";
const STALE_TALK_MESSAGE = "The physical position changed before Talk was accepted. Move next to the character and start Talk again.";

let coordinationCampaignId = null;
let reconciledCoordinationRevision = -1;
let pendingCoordinationRevision = -1;
let worldReconcilePromise = null;

function normalizeDockToolbar() {
  const dock = document.querySelector(`#${DOCK_ID}`);
  const header = dock?.querySelector(".mm-rpg-dock-header");
  const toolbar = document.querySelector(".mm-rpg-play-toolbar");
  if (!dock || !header || !toolbar) return;

  if (toolbar.parentElement !== header) header.append(toolbar);
  toolbar.classList.add("mm-rpg-dock-toolbar");
  toolbar.style.position = "static";
  toolbar.style.margin = "0";
  toolbar.style.padding = "0";
  toolbar.style.border = "0";
  toolbar.style.background = "transparent";
  toolbar.style.boxShadow = "none";
  toolbar.style.backdropFilter = "none";

  for (const control of toolbar.querySelectorAll("button")) {
    const campaigns = control.id === "mm-rpg-campaigns-open";
    const shouldHide = !campaigns;
    if (control.hidden !== shouldHide) control.hidden = shouldHide;
    if (campaigns) {
      control.classList.add("mm-rpg-dock-campaigns");
      control.removeAttribute("aria-pressed");
    }
  }
}

function normalizeReleasedTalkSelection() {
  const panel = document.querySelector("#mm-rpg-talk-panel");
  const talk = window.gameFrameMonsterRpgTalk;
  if (!panel?.hidden || !talk?.getSelectedTarget?.()) return;

  // The unified dock may hide the Talk pane directly when the player returns
  // to World, Ask GM, or another tab. Hiding the DOM surface must also release
  // Talk's logical selection; otherwise its nearby button remains hidden forever
  // because Talk still believes a conversation is active.
  talk.cancel?.();
}

function normalizeNearbyActionsVisibility() {
  const nearby = document.querySelector(".mm-rpg-dock-nearby");
  const host = nearby?.querySelector("[data-mm-rpg-nearby-actions]");
  if (!nearby || !host) return;

  const controls = [...host.querySelectorAll(".mm-rpg-world-interact")];
  const hasVisibleAction = controls.some((control) => !control.hidden);
  if (nearby.hidden === hasVisibleAction) nearby.hidden = !hasVisibleAction;
}

function normalizeReleasedTalkComposer() {
  const panel = document.querySelector("#mm-rpg-talk-panel");
  const send = panel?.querySelector("#mm-rpg-talk-send");
  const error = document.querySelector("#mm-rpg-error");
  if (!panel || !send) return;

  if (!panel.hidden) {
    if (panel.dataset.mmRpgReleasedStale === "true") {
      delete panel.dataset.mmRpgReleasedStale;
      if (error?.textContent?.trim() === STALE_TALK_MESSAGE) {
        error.textContent = "";
        error.hidden = true;
      }
    }
    return;
  }

  // A stale physical/coordination Talk is already invalid once the panel has
  // been dismissed. Never let a prior transient label survive into the next
  // conversation even if asynchronous recovery is still in flight.
  if (send.textContent === "Sending…") {
    send.textContent = "Speak";
    panel.dataset.mmRpgReleasedStale = "true";
  }
  if (send.disabled) send.disabled = false;

  // Campaign Refresh legitimately clears the global error banner when its own
  // attach succeeds. Keep the physical Talk cancellation visible until the
  // player intentionally opens the next conversation.
  if (panel.dataset.mmRpgReleasedStale === "true" && error && !error.textContent.trim()) {
    error.textContent = STALE_TALK_MESSAGE;
    error.hidden = false;
  }
}

function resetWorldCoordination(campaignId = null) {
  coordinationCampaignId = campaignId;
  reconciledCoordinationRevision = -1;
  pendingCoordinationRevision = -1;
}

function reconcileWorldFromCampaignState(event) {
  const campaignId = String(event?.detail?.campaignId || "").trim();
  const revision = Number(event?.detail?.gameframeCoordinationRevision);
  if (!campaignId) {
    resetWorldCoordination();
    return;
  }
  if (!Number.isSafeInteger(revision) || revision < 0) return;

  const worldCampaignId = String(
    window.gameFrameMonsterRpgWorld?.getPayload?.()?.projection?.campaignId || "",
  ).trim();
  if (!worldCampaignId || worldCampaignId !== campaignId) return;

  if (coordinationCampaignId !== campaignId) resetWorldCoordination(campaignId);
  if (revision <= reconciledCoordinationRevision) return;
  pendingCoordinationRevision = Math.max(pendingCoordinationRevision, revision);
  void drainWorldCoordination();
}

function drainWorldCoordination() {
  if (worldReconcilePromise) return worldReconcilePromise;

  let promise;
  promise = (async () => {
    while (pendingCoordinationRevision > reconciledCoordinationRevision) {
      const campaignId = coordinationCampaignId;
      const targetRevision = pendingCoordinationRevision;
      const world = window.gameFrameMonsterRpgWorld;
      const worldCampaignId = String(world?.getPayload?.()?.projection?.campaignId || "").trim();
      if (!campaignId || worldCampaignId !== campaignId || !world?.attachCurrentCampaign) break;

      // The Talk success path already requests a quiet world refresh. That request
      // can begin before an asynchronous actor-inspection transform has committed.
      // First absorb any attach already in flight, then force one additional attach
      // after it. The second attach is therefore guaranteed to start after the
      // authoritative campaign-position revision that triggered this handler.
      try {
        await world.attachCurrentCampaign({ quiet: true });
        if (coordinationCampaignId !== campaignId) break;
        await world.attachCurrentCampaign({ quiet: true });
      } catch {
        break;
      }

      const currentCampaignId = String(
        world.getPayload?.()?.projection?.campaignId || "",
      ).trim();
      if (currentCampaignId !== campaignId) break;
      reconciledCoordinationRevision = Math.max(reconciledCoordinationRevision, targetRevision);
    }
  })().finally(() => {
    if (worldReconcilePromise === promise) worldReconcilePromise = null;
  });

  worldReconcilePromise = promise;
  return promise;
}

function normalizeShell() {
  normalizeDockToolbar();
  normalizeReleasedTalkSelection();
  normalizeReleasedTalkComposer();
  normalizeNearbyActionsVisibility();
}

const observer = new MutationObserver(() => queueMicrotask(normalizeShell));
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden", "disabled"],
});

window.addEventListener("gameframe:monster-master-rpg-state", (event) => {
  queueMicrotask(normalizeShell);
  queueMicrotask(() => reconcileWorldFromCampaignState(event));
});
window.addEventListener("gameframe:monster-master-pixi-view", () => queueMicrotask(normalizeShell));
window.addEventListener("gameframe:before-home", () => {
  resetWorldCoordination();
  observer.disconnect();
}, { once: true });

window.gameFrameMonsterRpgShellGuards = Object.freeze({
  refresh: normalizeShell,
});

queueMicrotask(normalizeShell);
