const terrainAtlasUrl = "/assets/monster-master/terrain-atlas-v1.svg";
const terrainAtlasCellSize = 64;

const terrainAtlas = new Image();
let terrainAtlasReady = false;
terrainAtlas.decoding = "async";
terrainAtlas.addEventListener("load", () => {
  terrainAtlasReady = true;
  window.dispatchEvent(new Event("resize"));
  window.gameFrameMonsterProjection?.render?.();
});
terrainAtlas.addEventListener("error", () => {
  terrainAtlasReady = false;
});
terrainAtlas.src = terrainAtlasUrl;

const projectedTerrainByFill = Object.freeze({
  "#2a405d": { column: 0, row: 0 },
  "#243852": { column: 1, row: 0 },
  "#505946": { column: 2, row: 0 },
  "#48513e": { column: 2, row: 0, flipX: true },
  "#394a60": { column: 0, row: 1 },
  "#7b5a2b": { column: 2, row: 1, objective: true },
});

const squareTerrainByFill = Object.freeze({
  "#263751": { column: 0, row: 0 },
  "#223149": { column: 1, row: 0 },
  "#4c5042": { column: 2, row: 0 },
  "#45493d": { column: 2, row: 0, flipX: true },
  "#101620": { column: 1, row: 1 },
  "#6f5630": { column: 2, row: 1, objective: true },
});

const terrainPath = new WeakMap();
const previousBeginPath = CanvasRenderingContext2D.prototype.beginPath;
const previousMoveTo = CanvasRenderingContext2D.prototype.moveTo;
const previousLineTo = CanvasRenderingContext2D.prototype.lineTo;
const previousFill = CanvasRenderingContext2D.prototype.fill;
const previousFillRect = CanvasRenderingContext2D.prototype.fillRect;

CanvasRenderingContext2D.prototype.beginPath = function beginMonsterTerrainPath(...args) {
  if (this.canvas?.id === "monster-master-motion-canvas") terrainPath.set(this, []);
  return previousBeginPath.apply(this, args);
};

CanvasRenderingContext2D.prototype.moveTo = function moveMonsterTerrainPath(x, y) {
  terrainPath.get(this)?.push([x, y]);
  return previousMoveTo.call(this, x, y);
};

CanvasRenderingContext2D.prototype.lineTo = function lineMonsterTerrainPath(x, y) {
  terrainPath.get(this)?.push([x, y]);
  return previousLineTo.call(this, x, y);
};

function terrainSource(entry) {
  return {
    x: entry.column * terrainAtlasCellSize,
    y: entry.row * terrainAtlasCellSize,
  };
}

function drawTerrainImage(context, entry, x, y, width, height) {
  const source = terrainSource(entry);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (entry.flipX) {
    context.translate(x + width / 2, 0);
    context.scale(-1, 1);
    context.translate(-(x + width / 2), 0);
  }
  context.drawImage(
    terrainAtlas,
    source.x,
    source.y,
    terrainAtlasCellSize,
    terrainAtlasCellSize,
    x,
    y,
    width,
    height,
  );
  context.restore();
}

function projectedBounds(context) {
  const points = terrainPath.get(context);
  if (!points || points.length < 4) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const width = maximumX - minimumX;
  const height = maximumY - minimumY;
  if (width < 12 || height < 6 || width / height < 1.45 || width / height > 2.8) return null;
  return { x: minimumX, y: minimumY, width, height };
}

CanvasRenderingContext2D.prototype.fill = function fillMonsterMasterTerrain(...args) {
  if (terrainAtlasReady && this.canvas?.id === "monster-master-motion-canvas") {
    const entry = projectedTerrainByFill[String(this.fillStyle).toLowerCase()];
    const bounds = entry ? projectedBounds(this) : null;
    if (entry && bounds) {
      this.save();
      this.clip();
      drawTerrainImage(
        this,
        entry,
        bounds.x - bounds.width * 0.08,
        bounds.y - bounds.height * 0.35,
        bounds.width * 1.16,
        bounds.height * 1.7,
      );
      this.restore();
      if (entry.objective) {
        drawTerrainImage(
          this,
          entry,
          bounds.x - bounds.width * 0.3,
          bounds.y - bounds.height * 1.75,
          bounds.width * 1.6,
          bounds.height * 2.6,
        );
      }
      return undefined;
    }
  }
  return previousFill.apply(this, args);
};

CanvasRenderingContext2D.prototype.fillRect = function fillMonsterMasterTerrainRect(x, y, width, height) {
  if (terrainAtlasReady && this.canvas?.id === "monster-master-canvas") {
    const entry = squareTerrainByFill[String(this.fillStyle).toLowerCase()];
    if (entry && width > 12 && height > 12) {
      drawTerrainImage(this, entry, x, y, width, height);
      return undefined;
    }
  }
  return previousFillRect.call(this, x, y, width, height);
};
