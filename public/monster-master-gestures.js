const frame = document.querySelector(".combat-canvas-frame");
const touches = new Map();
let gesture = null;

function point(event) {
  return { x: event.clientX, y: event.clientY };
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function midpoint(left, right) {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function currentPair() {
  return [...touches.values()].slice(0, 2);
}

function cancelSinglePointerDrag(pointerId) {
  if (!frame) return;
  frame.dispatchEvent(new PointerEvent("pointercancel", {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType: "touch",
  }));
}

function beginGesture() {
  const [left, right] = currentPair();
  if (!left || !right) return;
  cancelSinglePointerDrag(left.pointerId);
  gesture = {
    distance: Math.max(1, distance(left, right)),
    midpoint: midpoint(left, right),
  };
  frame?.setAttribute("data-pinch-active", "true");
}

function zoom(direction) {
  const selector = direction > 0 ? "#monster-master-zoom-in" : "#monster-master-zoom-out";
  document.querySelector(selector)?.click();
}

function handlePointerDown(event) {
  if (event.pointerType !== "touch" || !frame?.contains(event.target)) return;
  touches.set(event.pointerId, { ...point(event), pointerId: event.pointerId });
  if (touches.size === 2) beginGesture();
  if (touches.size >= 2) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function handlePointerMove(event) {
  if (!touches.has(event.pointerId)) return;
  touches.set(event.pointerId, { ...point(event), pointerId: event.pointerId });
  if (touches.size < 2) return;
  if (!gesture) beginGesture();
  const [left, right] = currentPair();
  if (!left || !right || !gesture) return;
  const nextMidpoint = midpoint(left, right);
  window.gameFrameMonsterPixiBridge?.panScreen?.(
    -(nextMidpoint.x - gesture.midpoint.x),
    -(nextMidpoint.y - gesture.midpoint.y),
  );
  const nextDistance = Math.max(1, distance(left, right));
  const scale = nextDistance / gesture.distance;
  if (scale >= 1.12) {
    zoom(1);
    gesture.distance = nextDistance;
  } else if (scale <= 0.88) {
    zoom(-1);
    gesture.distance = nextDistance;
  }
  gesture.midpoint = nextMidpoint;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function handlePointerEnd(event) {
  if (!touches.has(event.pointerId)) return;
  touches.delete(event.pointerId);
  if (touches.size < 2) {
    gesture = null;
    frame?.removeAttribute("data-pinch-active");
  }
  event.preventDefault();
  event.stopImmediatePropagation();
}

if (frame) {
  window.addEventListener("pointerdown", handlePointerDown, true);
  window.addEventListener("pointermove", handlePointerMove, true);
  window.addEventListener("pointerup", handlePointerEnd, true);
  window.addEventListener("pointercancel", handlePointerEnd, true);
}

window.gameFrameMonsterGestures = Object.freeze({
  isPinching: () => Boolean(gesture),
});
