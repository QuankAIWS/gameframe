const STATE_EVENT = "gameframe:monster-master-rpg-state";
const events = document.querySelector("#mm-rpg-events");

function markPrivateGameMasterEvents() {
  if (!events) return;
  const privateEventIds = new Set(
    (window.gameFrameMonsterRpgApp?.getEvents?.() ?? [])
      .filter((event) => event?.payload?.presentationMode === "ask-gm-private")
      .map((event) => event.eventId),
  );
  for (const item of events.children) {
    item.classList.toggle("mm-rpg-private-gm-event", privateEventIds.has(item.dataset.eventId));
  }
  window.gameFrameMonsterRpgInteractionShell?.refresh?.();
}

if (events) {
  new MutationObserver(markPrivateGameMasterEvents).observe(events, { childList: true });
}
window.addEventListener(STATE_EVENT, markPrivateGameMasterEvents);
window.addEventListener("gameframe:monster-master-pixi-view", markPrivateGameMasterEvents);
queueMicrotask(markPrivateGameMasterEvents);
