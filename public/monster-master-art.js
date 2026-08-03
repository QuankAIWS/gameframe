const atlasUrl = "/assets/monster-master/creature-atlas-v1.svg";
const atlasCellSize = 96;
const creatureByGlyph = Object.freeze({
  M: { column: 0, squareScale: 1.34, projectionSize: 100, projectionY: -78 },
  B: { column: 1, squareScale: 1.48, projectionSize: 112, projectionY: -74 },
  E: { column: 2, squareScale: 1.14, projectionSize: 88, projectionY: -70 },
});

const atlas = new Image();
let atlasReady = false;
atlas.decoding = "async";
atlas.addEventListener("load", () => {
  atlasReady = true;
  window.dispatchEvent(new Event("resize"));
  window.gameFrameMonsterProjection?.render?.();
});
atlas.addEventListener("error", () => {
  atlasReady = false;
});
atlas.src = atlasUrl;

function drawAtlasCreature(context, creature, x, y, size, flip) {
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (flip) {
    context.translate(x + size / 2, 0);
    context.scale(-1, 1);
    context.translate(-(x + size / 2), 0);
  }
  context.drawImage(
    atlas,
    creature.column * atlasCellSize,
    0,
    atlasCellSize,
    atlasCellSize,
    x,
    y,
    size,
    size,
  );
  context.restore();
}

function battlefieldCellSize(context) {
  const fontSize = Number.parseFloat(context.font.match(/([0-9.]+)px/)?.[1] ?? "10");
  if (fontSize > 10) return fontSize / 0.2;
  const canvasWidth = context.canvas?.clientWidth || context.canvas?.width || 384;
  return Math.min(50, Math.max(28, canvasWidth / 12));
}

const nativeFillText = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function fillMonsterMasterCreature(text, x, y, maxWidth) {
  const creature = creatureByGlyph[text];
  if (!creature || this.canvas?.id !== "monster-master-canvas" || !atlasReady) {
    return nativeFillText.call(this, text, x, y, maxWidth);
  }

  const cellSize = battlefieldCellSize(this);
  const size = cellSize * creature.squareScale;
  const drawX = x - size / 2;
  const drawY = y + cellSize * 0.48 - size * 0.88;
  const alphaTeam = String(this.shadowColor).includes("78, 164, 255");
  drawAtlasCreature(this, creature, drawX, drawY, size, alphaTeam);
};

const pathState = new WeakMap();
const nativeBeginPath = CanvasRenderingContext2D.prototype.beginPath;
const nativeMoveTo = CanvasRenderingContext2D.prototype.moveTo;
const nativeLineTo = CanvasRenderingContext2D.prototype.lineTo;
const nativeBezierCurveTo = CanvasRenderingContext2D.prototype.bezierCurveTo;
const nativeEllipse = CanvasRenderingContext2D.prototype.ellipse;
const nativeFill = CanvasRenderingContext2D.prototype.fill;

CanvasRenderingContext2D.prototype.beginPath = function beginMonsterMasterPath(...args) {
  if (this.canvas?.id === "monster-master-motion-canvas") {
    pathState.set(this, { lines: [], hasBezier: false, ellipses: [] });
  }
  return nativeBeginPath.apply(this, args);
};
CanvasRenderingContext2D.prototype.moveTo = function moveMonsterMasterPath(x, y) {
  pathState.get(this)?.lines.push([x, y]);
  return nativeMoveTo.call(this, x, y);
};
CanvasRenderingContext2D.prototype.lineTo = function lineMonsterMasterPath(x, y) {
  pathState.get(this)?.lines.push([x, y]);
  return nativeLineTo.call(this, x, y);
};
CanvasRenderingContext2D.prototype.bezierCurveTo = function curveMonsterMasterPath(...args) {
  const state = pathState.get(this);
  if (state) state.hasBezier = true;
  return nativeBezierCurveTo.apply(this, args);
};
CanvasRenderingContext2D.prototype.ellipse = function ellipseMonsterMasterPath(x, y, radiusX, radiusY, ...rest) {
  pathState.get(this)?.ellipses.push([x, y, radiusX, radiusY]);
  return nativeEllipse.call(this, x, y, radiusX, radiusY, ...rest);
};

function projectedCreature(context) {
  if (context.canvas?.id !== "monster-master-motion-canvas") return null;
  const fill = String(context.fillStyle).toLowerCase();
  if (fill !== "#3e91e8" && fill !== "#d04f78") return null;
  const state = pathState.get(context);
  if (!state) return null;
  if (state.hasBezier) return { glyph: "E", alphaTeam: fill === "#3e91e8" };
  if (state.ellipses.some(([, y, radiusX, radiusY]) => y === -5 && radiusX === 24 && radiusY === 29)) {
    return { glyph: "B", alphaTeam: fill === "#3e91e8" };
  }
  if (state.lines.some(([, y]) => y === -38)) return { glyph: "M", alphaTeam: fill === "#3e91e8" };
  return null;
}

CanvasRenderingContext2D.prototype.fill = function fillMonsterMasterProjection(...args) {
  if (this.canvas?.id === "monster-master-motion-canvas") {
    const fill = String(this.fillStyle).toLowerCase();
    if (atlasReady && (fill === "#b9e1ff" || fill === "#ffc0d0")) return undefined;
    const projected = projectedCreature(this);
    if (projected && atlasReady) {
      const creature = creatureByGlyph[projected.glyph];
      const size = creature.projectionSize;
      drawAtlasCreature(this, creature, -size / 2, creature.projectionY, size, projected.alphaTeam);
      return undefined;
    }
  }
  return nativeFill.apply(this, args);
};

const style = document.createElement("style");
style.textContent = `
  #monster-master-unit-hud[data-role="master"] #monster-master-hud-glyph,
  #monster-master-unit-hud[data-role="bulwark"] #monster-master-hud-glyph,
  #monster-master-unit-hud[data-role="emberling"] #monster-master-hud-glyph {
    color: transparent;
    background-image: url("${atlasUrl}");
    background-repeat: no-repeat;
    background-size: 300% 100%;
    background-color: rgba(6, 10, 18, .45);
  }

  #monster-master-unit-hud[data-role="master"] #monster-master-hud-glyph { background-position: 0 50%; }
  #monster-master-unit-hud[data-role="bulwark"] #monster-master-hud-glyph { background-position: 50% 50%; }
  #monster-master-unit-hud[data-role="emberling"] #monster-master-hud-glyph { background-position: 100% 50%; }
`;
document.head.append(style);
