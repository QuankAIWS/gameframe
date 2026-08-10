const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const PAN_BY_KEY = Object.freeze({
  KeyW: Object.freeze([0, -1]),
  KeyA: Object.freeze([-1, 0]),
  KeyS: Object.freeze([0, 1]),
  KeyD: Object.freeze([1, 0]),
});

function activeExploration() {
  const world = window.gameFrameMonsterRpgWorld;
  return Boolean(
    document.body.classList.contains("mm-rpg-play-shell")
    && world?.getPayload?.()
    && world?.getPlayerPosition?.()
  );
}

function editable(target) {
  return target instanceof Element
    && Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

function panCamera(code) {
  const delta = PAN_BY_KEY[code];
  const renderer = window.gameFrameMonsterPixi;
  if (!delta || !renderer?.panCardinal) return false;
  renderer.panCardinal(delta[0], delta[1]);
  window.gameFrameMonsterRpgWorld?.refreshAnchors?.();
  return true;
}

window.addEventListener("keydown", (event) => {
  if (
    !PAN_BY_KEY[event.code]
    || event.ctrlKey
    || event.metaKey
    || event.altKey
    || editable(event.target)
    || !activeExploration()
  ) return;

  // Exploration uses point-and-click for the character. WASD is reserved for
  // looking around the physical map, so consume it before the older world
  // movement listener sees the key.
  if (panCamera(event.code)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.gameFrameMonsterRpgClickMove?.cancel?.();
  }
}, { capture: true });

window.addEventListener(VIEW_EVENT, () => {
  document.body.classList.toggle("mm-rpg-desktop-click-controls", activeExploration());
});

queueMicrotask(() => {
  document.body.classList.toggle("mm-rpg-desktop-click-controls", activeExploration());
});
