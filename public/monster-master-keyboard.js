const stylesheetUrl = "/monster-master-interaction-polish.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const PAN_STEP_X = 108;
const PAN_STEP_Y = 54;
const panVectors = Object.freeze({
  KeyW: { x: 0, y: -PAN_STEP_Y },
  KeyA: { x: -PAN_STEP_X, y: 0 },
  KeyS: { x: 0, y: PAN_STEP_Y },
  KeyD: { x: PAN_STEP_X, y: 0 },
});
const panControls = Object.freeze({
  KeyW: '[data-monster-master-pan-x="0"][data-monster-master-pan-y="-3"]',
  KeyA: '[data-monster-master-pan-x="-3"][data-monster-master-pan-y="0"]',
  KeyS: '[data-monster-master-pan-x="0"][data-monster-master-pan-y="3"]',
  KeyD: '[data-monster-master-pan-x="3"][data-monster-master-pan-y="0"]',
});

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

function matchIsActive() {
  const match = document.querySelector("#monster-master-match");
  return document.body.classList.contains("monster-master-match-active") && match && !match.hidden;
}

function clickEnabledControl(selector) {
  const control = document.querySelector(selector);
  if (!(control instanceof HTMLButtonElement) || control.disabled || control.hidden) return false;
  control.click();
  return true;
}

function panCamera(code) {
  const vector = panVectors[code];
  if (!vector) return false;
  if (window.gameFrameMonsterPixiBridge?.panScreen?.(vector.x, vector.y)) return true;
  return clickEnabledControl(panControls[code]);
}

function rotateCamera(delta) {
  const renderer = window.gameFrameMonsterPixi;
  if (delta < 0 && renderer?.rotateLeft) {
    renderer.rotateLeft();
    return true;
  }
  if (delta > 0 && renderer?.rotateRight) {
    renderer.rotateRight();
    return true;
  }
  return clickEnabledControl(delta < 0 ? "#monster-master-rotate-left" : "#monster-master-rotate-right");
}

function handleKeydown(event) {
  if (
    event.defaultPrevented
    || event.ctrlKey
    || event.metaKey
    || event.altKey
    || isEditableTarget(event.target)
    || !matchIsActive()
  ) return;

  if (panVectors[event.code]) {
    if (panCamera(event.code)) event.preventDefault();
    return;
  }

  if (event.code === "KeyQ" || event.code === "KeyE") {
    if (event.repeat) return;
    if (rotateCamera(event.code === "KeyQ" ? -1 : 1)) event.preventDefault();
  }
}

function updateCameraHint() {
  const hint = document.querySelector(".monster-master-camera-title strong");
  if (hint) hint.textContent = "WASD pan · Q/E rotate";
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("gameframe:monster-master-pixi-view", () => {
  requestAnimationFrame(() => requestAnimationFrame(updateCameraHint));
});
requestAnimationFrame(() => requestAnimationFrame(updateCameraHint));

window.gameFrameMonsterKeyboard = Object.freeze({
  isBound: true,
  handleKeydown,
  updateCameraHint,
});
