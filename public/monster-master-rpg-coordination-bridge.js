const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const STATE_EVENT = "gameframe:monster-master-rpg-state";

let refreshPromise = null;

function validRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function revisions() {
  return {
    world: validRevision(
      window.gameFrameMonsterRpgWorld?.getPayload?.()?.projection?.gameframeCoordinationRevision,
    ),
    app: validRevision(
      window.gameFrameMonsterRpgApp?.getProjection?.()?.gameframeCoordinationRevision,
    ),
    displayed: validRevision(Number(document.querySelector("#mm-rpg-coordination")?.textContent ?? "")),
  };
}

function currentRevision() {
  const values = Object.values(revisions()).filter((value) => value !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

function refreshExplorationIfBehind() {
  const { world, app } = revisions();
  if (app === null || (world !== null && world >= app)) return refreshPromise;
  if (refreshPromise) return refreshPromise;
  const refresh = window.gameFrameMonsterRpgWorld?.attachCurrentCampaign?.({ quiet: true });
  if (!refresh?.then) return null;
  refreshPromise = Promise.resolve(refresh)
    .catch(() => undefined)
    .finally(() => {
      refreshPromise = null;
      synchronize();
    });
  return refreshPromise;
}

function synchronize() {
  const revision = currentRevision();
  if (revision === null) return;

  const displayed = document.querySelector("#mm-rpg-coordination");
  if (displayed && Number(displayed.textContent) !== revision) {
    displayed.textContent = String(revision);
  }
  void refreshExplorationIfBehind();
}

async function freshExplorationState() {
  synchronize();
  const pending = refreshExplorationIfBehind();
  if (pending) await pending;
  const world = window.gameFrameMonsterRpgWorld;
  const payload = world?.getPayload?.() ?? null;
  const position = world?.getPlayerPosition?.() ?? null;
  const revision = currentRevision();
  if (!payload?.projection || !payload?.materialization || !position || revision === null) {
    throw new Error("The current exploration command state is not ready. Refresh and try again.");
  }
  return { payload, position, revision };
}

window.gameFrameMonsterRpgCoordination = Object.freeze({
  getRevision: currentRevision,
  synchronize,
  freshExplorationState,
});

window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));
queueMicrotask(synchronize);
