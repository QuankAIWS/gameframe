const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const STATE_EVENT = "gameframe:monster-master-rpg-state";

let refreshPromise = null;

function validRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function currentRevision() {
  const appRevision = validRevision(
    window.gameFrameMonsterRpgApp?.getProjection?.()?.gameframeCoordinationRevision,
  );
  const displayed = validRevision(Number(document.querySelector("#mm-rpg-coordination")?.textContent ?? ""));
  if (appRevision === null) return displayed;
  if (displayed === null) return appRevision;
  return Math.max(appRevision, displayed);
}

function synchronize() {
  const revision = currentRevision();
  if (revision === null) return;
  const displayed = document.querySelector("#mm-rpg-coordination");
  if (displayed && Number(displayed.textContent) !== revision) {
    displayed.textContent = String(revision);
  }
}

async function refreshCommandState() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    await window.gameFrameMonsterRpgApp?.refresh?.();
    synchronize();
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function freshExplorationState() {
  await refreshCommandState();
  const world = window.gameFrameMonsterRpgWorld;
  let payload = world?.getPayload?.() ?? null;
  let position = world?.getPlayerPosition?.() ?? null;
  if ((!payload?.projection || !payload?.materialization || !position) && world?.attachCurrentCampaign) {
    await world.attachCurrentCampaign({ quiet: true });
    payload = world.getPayload?.() ?? null;
    position = world.getPlayerPosition?.() ?? null;
  }
  const revision = currentRevision();
  if (!payload?.projection || !payload?.materialization || !position || revision === null) {
    throw new Error("The current exploration command state is not ready. Refresh and try again.");
  }
  return { payload, position, revision };
}

window.gameFrameMonsterRpgCoordination = Object.freeze({
  getRevision: currentRevision,
  synchronize,
  refreshCommandState,
  freshExplorationState,
});

window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));
queueMicrotask(synchronize);
