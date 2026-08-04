const stylesheetUrl = "/monster-master-battlefield-effects.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const frame = document.querySelector(".combat-canvas-frame");
let layer = null;
let previousView = null;
let lastSignature = "";

function ensureLayer() {
  if (!frame) return null;
  if (layer?.isConnected) return layer;
  layer = document.createElement("div");
  layer.id = "monster-master-battlefield-effects";
  layer.className = "monster-master-battlefield-effect-layer";
  layer.setAttribute("aria-hidden", "true");
  frame.append(layer);
  return layer;
}

function unitPosition(view, unitId) {
  return view?.observation?.board?.units?.find((unit) => unit.id === unitId)?.position ?? null;
}

function effectPosition(effect, view, previous) {
  if (effect.type === "unit-deployed") return effect.position;
  if (effect.type === "unit-moved") return effect.to ?? effect.path?.at(-1) ?? effect.from;
  if (effect.type === "unit-damaged" || effect.type === "unit-healed") {
    return unitPosition(view, effect.targetUnitId) ?? unitPosition(previous, effect.targetUnitId);
  }
  if (effect.type === "unit-defeated") {
    return unitPosition(previous, effect.targetUnitId) ?? unitPosition(view, effect.targetUnitId);
  }
  return null;
}

function localPoint(coordinate) {
  const point = window.gameFrameMonsterPixiBridge?.worldToScreen?.(coordinate);
  const canvas = document.querySelector("#monster-master-pixi-canvas");
  if (!point || !canvas || !frame) return null;
  const canvasRect = canvas.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  return {
    x: canvasRect.left - frameRect.left + point.x,
    y: canvasRect.top - frameRect.top + point.y,
  };
}

function createMarker(className, label = "") {
  const root = ensureLayer();
  if (!root) return null;
  const marker = document.createElement("span");
  marker.className = `monster-master-battlefield-effect ${className}`;
  if (label) {
    const copy = document.createElement("span");
    copy.textContent = label;
    marker.append(copy);
  }
  root.append(marker);
  return marker;
}

function removeAfter(animation, marker) {
  animation.finished.catch(() => {}).finally(() => marker.remove());
}

function animatePulse(effect, view, previous) {
  const coordinate = effectPosition(effect, view, previous);
  const point = coordinate ? localPoint(coordinate) : null;
  if (!point) return;
  const config = effect.type === "unit-damaged"
    ? { className: "is-damage", label: `-${effect.damage}`, scale: 1.7 }
    : effect.type === "unit-healed"
      ? { className: "is-heal", label: `+${effect.healing}`, scale: 1.6 }
      : effect.type === "unit-defeated"
        ? { className: "is-defeat", label: "KO", scale: 2.1 }
        : { className: "is-deploy", label: "", scale: 1.7 };
  const marker = createMarker(config.className, config.label);
  if (!marker) return;
  marker.style.left = `${point.x}px`;
  marker.style.top = `${point.y}px`;
  const animation = marker.animate([
    { transform: "scale(.55)", opacity: 0 },
    { transform: "scale(1)", opacity: 1, offset: .2 },
    { transform: `scale(${config.scale})`, opacity: 0 },
  ], { duration: effect.type === "unit-defeated" ? 820 : 620, easing: "cubic-bezier(.2,.75,.2,1)" });
  removeAfter(animation, marker);
}

function animateMove(effect) {
  const coordinates = [effect.from, ...(effect.path ?? [])].filter(Boolean);
  if (coordinates.length < 2) return;
  const points = coordinates.map(localPoint).filter(Boolean);
  if (points.length < 2) return;
  const marker = createMarker("is-move");
  if (!marker) return;
  marker.style.left = "0";
  marker.style.top = "0";
  const keyframes = points.map((point, index) => ({
    transform: `translate(${point.x}px, ${point.y}px) scale(${index === points.length - 1 ? .7 : 1})`,
    opacity: index === points.length - 1 ? 0 : 1,
    offset: index / (points.length - 1),
  }));
  const animation = marker.animate(keyframes, {
    duration: Math.max(280, Math.min(760, points.length * 120)),
    easing: "cubic-bezier(.2,.65,.25,1)",
  });
  removeAfter(animation, marker);
  frame.dataset.lastAnimationSteps = String(effect.path?.length ?? 0);
}

function present(view) {
  if (!view?.observation || !frame || window.gameFrameMonsterRendererMode !== "pixi") return;
  const signature = `${view.matchId}:${view.revision}`;
  if (signature === lastSignature) return;
  const previous = previousView;
  previousView = view;
  lastSignature = signature;
  const effects = view.observation.lastEffects ?? [];
  frame.dataset.lastEffectTypes = effects.map((effect) => effect.type).join(",");
  for (const effect of effects) {
    if (effect.type === "unit-moved") animateMove(effect);
    else if (["unit-deployed", "unit-damaged", "unit-healed", "unit-defeated"].includes(effect.type)) {
      animatePulse(effect, view, previous);
    }
  }
}

window.addEventListener(VIEW_EVENT, (event) => present(event.detail?.view));
const current = window.gameFrameMonsterController?.getView?.();
if (current) present(current);

window.gameFrameMonsterBattlefieldEffects = Object.freeze({
  present,
  getLastSignature: () => lastSignature,
});
