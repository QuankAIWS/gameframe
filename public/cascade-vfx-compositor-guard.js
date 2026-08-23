const CANVAS_SELECTOR = ".cascade-dopamine-canvas";
const ANCHOR_SELECTOR = ".cascade-game";
const MAX_DPR = 1.5;
const LARGE_SURFACE_DPR = 1.25;
const LARGE_SURFACE_AREA = 1_500_000;

let activeCanvas = null;
let applyCount = 0;
let lastSurface = null;
let resizeQueued = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function surfaceBounds() {
  const viewportWidth = Math.max(1, window.innerWidth);
  const viewportHeight = Math.max(1, window.innerHeight);
  const anchor = document.querySelector(ANCHOR_SELECTOR)?.getBoundingClientRect?.();
  if (!anchor || anchor.width <= 0 || anchor.height <= 0) {
    return { left: 0, top: 0, width: viewportWidth, height: viewportHeight, viewportWidth, viewportHeight };
  }

  // The game grid already includes the campaign map and side rail. Add a wide
  // overscan gutter so nuclear particles can spray well beyond the board while
  // avoiding a permanent full-browser alpha surface on roomy displays.
  const overscanX = clamp(viewportWidth * .10, 96, 220);
  const overscanTop = clamp(viewportHeight * .08, 72, 160);
  const overscanBottom = clamp(viewportHeight * .16, 110, 240);
  const left = clamp(Math.floor(anchor.left - overscanX), 0, viewportWidth - 1);
  const top = clamp(Math.floor(anchor.top - overscanTop), 0, viewportHeight - 1);
  const right = clamp(Math.ceil(anchor.right + overscanX), left + 1, viewportWidth);
  const bottom = clamp(Math.ceil(anchor.bottom + overscanBottom), top + 1, viewportHeight);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    viewportWidth,
    viewportHeight,
  };
}

function surfaceDpr(bounds) {
  const requested = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
  return bounds.width * bounds.height > LARGE_SURFACE_AREA
    ? Math.min(requested, LARGE_SURFACE_DPR)
    : requested;
}

function applyGuard(canvas) {
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.matches(CANVAS_SELECTOR)) return false;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return false;

  const bounds = surfaceBounds();
  const dpr = surfaceDpr(bounds);
  const pixelWidth = Math.max(1, Math.round(bounds.width * dpr));
  const pixelHeight = Math.max(1, Math.round(bounds.height * dpr));

  // Changing backing dimensions resets context state. Do it only when needed;
  // normal particle frames never pay this cost.
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  canvas.style.inset = "auto";
  canvas.style.left = `${bounds.left}px`;
  canvas.style.top = `${bounds.top}px`;
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;
  canvas.style.background = "transparent";
  canvas.style.mixBlendMode = "screen";
  canvas.dataset.compositorGuard = "bounded";

  // The particle engine continues to use viewport coordinates. Translate the
  // bounded canvas once so no particle physics or trajectories need rewriting.
  context.setTransform(dpr, 0, 0, dpr, -bounds.left * dpr, -bounds.top * dpr);

  activeCanvas = canvas;
  applyCount += 1;
  const viewportArea = bounds.viewportWidth * bounds.viewportHeight;
  lastSurface = {
    ...bounds,
    dpr,
    backingWidth: pixelWidth,
    backingHeight: pixelHeight,
    backingPixels: pixelWidth * pixelHeight,
    viewportArea,
    surfaceArea: bounds.width * bounds.height,
    coverage: viewportArea > 0 ? (bounds.width * bounds.height) / viewportArea : 1,
  };
  return true;
}

function findCanvas() {
  const canvas = document.querySelector(CANVAS_SELECTOR);
  if (canvas) applyGuard(canvas);
}

function queueResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  queueMicrotask(() => {
    resizeQueued = false;
    findCanvas();
  });
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.(CANVAS_SELECTOR)) {
        applyGuard(node);
        return;
      }
      const nested = node.querySelector?.(CANVAS_SELECTOR);
      if (nested) {
        applyGuard(nested);
        return;
      }
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("resize", queueResize, { passive: true });
requestAnimationFrame(findCanvas);

window.cascadeVfxCompositorGuard = Object.freeze({
  getStats() {
    return {
      applyCount,
      active: Boolean(activeCanvas?.isConnected),
      guarded: activeCanvas?.dataset.compositorGuard === "bounded",
      ...lastSurface,
    };
  },
  refresh: findCanvas,
});
