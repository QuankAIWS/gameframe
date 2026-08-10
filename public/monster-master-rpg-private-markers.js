const events = document.querySelector("#mm-rpg-events");

function markPrivateGameMasterEvents() {
  if (!events) return;
  for (const item of events.children) {
    const heading = item.querySelector(".mm-rpg-event-header strong")?.textContent?.trim();
    const audience = item.querySelector(".mm-rpg-event-meta")?.textContent?.trim().toLowerCase() ?? "";
    if (heading === "Game Master" && !audience.startsWith("campaign")) {
      item.classList.add("mm-rpg-private-gm-event");
    }
  }
  window.gameFrameMonsterRpgInteractionShell?.refresh?.();
}

if (events) {
  new MutationObserver(markPrivateGameMasterEvents).observe(events, { childList: true });
}
window.addEventListener("gameframe:monster-master-pixi-view", markPrivateGameMasterEvents);
queueMicrotask(markPrivateGameMasterEvents);
