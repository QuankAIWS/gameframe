const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const STATE_EVENT = "gameframe:monster-master-rpg-state";

function validRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function currentRevision() {
  const worldRevision = validRevision(
    window.gameFrameMonsterRpgWorld?.getPayload?.()?.projection?.gameframeCoordinationRevision,
  );
  if (worldRevision !== null) return worldRevision;

  const appRevision = validRevision(
    window.gameFrameMonsterRpgApp?.getProjection?.()?.gameframeCoordinationRevision,
  );
  if (appRevision !== null) return appRevision;

  const displayed = Number(document.querySelector("#mm-rpg-coordination")?.textContent ?? "");
  return validRevision(displayed);
}

function synchronize() {
  const revision = currentRevision();
  if (revision === null) return;

  const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
  if (
    payload?.projection
    && validRevision(payload.projection.gameframeCoordinationRevision) === null
  ) {
    payload.projection.gameframeCoordinationRevision = revision;
  }

  const displayed = document.querySelector("#mm-rpg-coordination");
  if (displayed && Number(displayed.textContent) !== revision) {
    displayed.textContent = String(revision);
  }
}

window.gameFrameMonsterRpgCoordination = Object.freeze({
  getRevision: currentRevision,
  synchronize,
});

window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener(STATE_EVENT, () => queueMicrotask(synchronize));
queueMicrotask(synchronize);
