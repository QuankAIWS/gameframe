const atlasUrl = "/assets/monster-master/creature-atlas-v1.svg";
const atlasCellSize = 96;
const creatureByGlyph = Object.freeze({
  M: { column: 0, scale: 1.34, anchorY: 0.88 },
  B: { column: 1, scale: 1.48, anchorY: 0.88 },
  E: { column: 2, scale: 1.14, anchorY: 0.88 },
});

const atlas = new Image();
let atlasReady = false;
atlas.decoding = "async";
atlas.addEventListener("load", () => {
  atlasReady = true;
  window.dispatchEvent(new Event("resize"));
});
atlas.addEventListener("error", () => {
  atlasReady = false;
});
atlas.src = atlasUrl;

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
  const size = cellSize * creature.scale;
  const drawX = x - size / 2;
  const drawY = y + cellSize * 0.48 - size * creature.anchorY;
  const alphaTeam = String(this.shadowColor).includes("78, 164, 255");

  this.save();
  this.imageSmoothingEnabled = true;
  this.imageSmoothingQuality = "high";
  if (alphaTeam) {
    this.translate(x, 0);
    this.scale(-1, 1);
    this.translate(-x, 0);
  }
  this.drawImage(
    atlas,
    creature.column * atlasCellSize,
    0,
    atlasCellSize,
    atlasCellSize,
    drawX,
    drawY,
    size,
    size,
  );
  this.restore();
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

  #monster-master-unit-hud[data-role="master"] #monster-master-hud-glyph {
    background-position: 0 50%;
  }

  #monster-master-unit-hud[data-role="bulwark"] #monster-master-hud-glyph {
    background-position: 50% 50%;
  }

  #monster-master-unit-hud[data-role="emberling"] #monster-master-hud-glyph {
    background-position: 100% 50%;
  }
`;
document.head.append(style);
