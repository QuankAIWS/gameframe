const DOCK_ID = "mm-rpg-unified-dock";

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

function normalizeReleasedTalkComposer() {
  const panel = document.querySelector("#mm-rpg-talk-panel");
  const send = panel?.querySelector("#mm-rpg-talk-send");
  if (!panel || !send || !panel.hidden) return;

  // A stale physical/coordination Talk is already invalid once the panel has
  // been dismissed. Never let a prior transient label survive into the next
  // conversation even if asynchronous recovery is still in flight.
  if (send.textContent === "Sending…") send.textContent = "Speak";
  if (send.disabled) send.disabled = false;
}

function normalizeShell() {
  normalizeDockToolbar();
  normalizeReleasedTalkComposer();
}

const observer = new MutationObserver(() => queueMicrotask(normalizeShell));
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden", "disabled"],
});

window.addEventListener("gameframe:monster-master-rpg-state", () => queueMicrotask(normalizeShell));
window.addEventListener("gameframe:monster-master-pixi-view", () => queueMicrotask(normalizeShell));
window.addEventListener("gameframe:before-home", () => observer.disconnect(), { once: true });

window.gameFrameMonsterRpgShellGuards = Object.freeze({
  refresh: normalizeShell,
});

queueMicrotask(normalizeShell);
