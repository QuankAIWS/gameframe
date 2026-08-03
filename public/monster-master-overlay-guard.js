const hud = document.querySelector("#monster-master-unit-hud");
let syncPending = false;
let observer = null;

function observeHud() {
  if (!hud) return;
  if (!observer) observer = new MutationObserver(scheduleOverlaySync);
  observer.observe(hud, {
    attributes: true,
    attributeFilter: ["class", "data-role", "data-owner", "data-inspected", "style"],
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function syncOverlay() {
  syncPending = false;
  observer?.disconnect();
  window.gameFrameMonsterOverlay?.render?.();
  observeHud();
}

function scheduleOverlaySync() {
  if (syncPending) return;
  syncPending = true;
  requestAnimationFrame(syncOverlay);
}

observeHud();
window.gameFrameMonsterOverlayGuard = Object.freeze({ sync: syncOverlay });
