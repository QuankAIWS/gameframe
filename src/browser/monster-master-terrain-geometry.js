export const TILE_WIDTH = 72;
export const TILE_HEIGHT = 36;
export const TILE_HALF_WIDTH = TILE_WIDTH / 2;
export const TILE_HALF_HEIGHT = TILE_HEIGHT / 2;
export const WALL_VISUAL_HEIGHT = 29;
export const GROUND_APRON_CELLS = 4;

const CARDINAL_NEIGHBORS = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 0, y: -1 }),
]);

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeQuarter(value) {
  return ((Math.round(value) % 4) + 4) % 4;
}

export function rotateCoordinate(coordinate, map, quarter = 0) {
  if (!map) return { x: coordinate.x, y: coordinate.y };
  const maxX = map.width - 1;
  const maxY = map.height - 1;
  switch (normalizeQuarter(quarter)) {
    case 1: return { x: maxY - coordinate.y, y: coordinate.x };
    case 2: return { x: maxX - coordinate.x, y: maxY - coordinate.y };
    case 3: return { x: coordinate.y, y: maxX - coordinate.x };
    default: return { x: coordinate.x, y: coordinate.y };
  }
}

export function unrotateCoordinate(coordinate, map, quarter = 0) {
  if (!map) return { x: coordinate.x, y: coordinate.y };
  const maxX = map.width - 1;
  const maxY = map.height - 1;
  switch (normalizeQuarter(quarter)) {
    case 1: return { x: coordinate.y, y: maxY - coordinate.x };
    case 2: return { x: maxX - coordinate.x, y: maxY - coordinate.y };
    case 3: return { x: maxX - coordinate.y, y: coordinate.x };
    default: return { x: coordinate.x, y: coordinate.y };
  }
}

export function unrotateDelta(delta, quarter = 0) {
  switch (normalizeQuarter(quarter)) {
    case 1: return { x: delta.y, y: -delta.x };
    case 2: return { x: -delta.x, y: -delta.y };
    case 3: return { x: -delta.y, y: delta.x };
    default: return { x: delta.x, y: delta.y };
  }
}

export function projectCoordinate(coordinate, map, quarter = 0, elevationPixels = 0) {
  const rotated = rotateCoordinate(coordinate, map, quarter);
  return {
    x: (rotated.x - rotated.y) * TILE_HALF_WIDTH,
    y: (rotated.x + rotated.y) * TILE_HALF_HEIGHT - elevationPixels,
  };
}

export function inverseProjectPoint(point, map, quarter = 0) {
  const rotated = {
    x: point.y / TILE_HEIGHT + point.x / TILE_WIDTH,
    y: point.y / TILE_HEIGHT - point.x / TILE_WIDTH,
  };
  return unrotateCoordinate(rotated, map, quarter);
}

export function terrainVisualHeight(cell) {
  if (cell?.terrain === "wall") return WALL_VISUAL_HEIGHT;
  const declared = Number(cell?.visualHeight ?? 0);
  return Number.isFinite(declared) && declared > 0 ? declared : 0;
}

export function diamondPoints(center, width = TILE_WIDTH, height = TILE_HEIGHT) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    { x: center.x, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y },
    { x: center.x, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y },
  ];
}

export function terrainTopCenter(coordinate, cell, map, quarter = 0) {
  return projectCoordinate(coordinate, map, quarter, terrainVisualHeight(cell));
}

export function terrainTopPolygon(coordinate, cell, map, quarter = 0) {
  return diamondPoints(terrainTopCenter(coordinate, cell, map, quarter));
}

export function cellAt(map, coordinate) {
  if (
    !map
    || coordinate.x < 0
    || coordinate.y < 0
    || coordinate.x >= map.width
    || coordinate.y >= map.height
  ) return null;
  return map.cells[coordinate.y * map.width + coordinate.x] ?? null;
}

export function exposedTerrainFaces(coordinate, cell, map, quarter = 0) {
  const height = terrainVisualHeight(cell);
  if (height <= 0) return { faces: [], culledFaces: 0 };

  const baseCenter = projectCoordinate(coordinate, map, quarter);
  const top = terrainTopPolygon(coordinate, cell, map, quarter);
  const faces = [];
  let culledFaces = 0;

  for (const offset of CARDINAL_NEIGHBORS) {
    const neighborCoordinate = { x: coordinate.x + offset.x, y: coordinate.y + offset.y };
    const neighborCenter = projectCoordinate(neighborCoordinate, map, quarter);
    if (neighborCenter.y <= baseCenter.y + 0.001) continue;

    const neighborHeight = terrainVisualHeight(cellAt(map, neighborCoordinate));
    if (neighborHeight >= height) {
      culledFaces += 1;
      continue;
    }

    const side = neighborCenter.x < baseCenter.x ? "left" : "right";
    const edge = side === "left" ? [top[3], top[2]] : [top[2], top[1]];
    const drop = height - neighborHeight;
    faces.push({
      side,
      neighborCoordinate,
      points: [
        edge[0],
        edge[1],
        { x: edge[1].x, y: edge[1].y + drop },
        { x: edge[0].x, y: edge[0].y + drop },
      ],
    });
  }

  return { faces, culledFaces };
}

export function mapSurfacePolygon(map, quarter = 0, apron = GROUND_APRON_CELLS) {
  if (!map) return [];
  const corners = [
    { x: -apron, y: -apron },
    { x: map.width - 1 + apron, y: -apron },
    { x: map.width - 1 + apron, y: map.height - 1 + apron },
    { x: -apron, y: map.height - 1 + apron },
  ].map((coordinate) => projectCoordinate(coordinate, map, quarter));

  const top = corners.reduce((best, point) => point.y < best.y ? point : best);
  const right = corners.reduce((best, point) => point.x > best.x ? point : best);
  const bottom = corners.reduce((best, point) => point.y > best.y ? point : best);
  const left = corners.reduce((best, point) => point.x < best.x ? point : best);

  return [
    { x: top.x, y: top.y - TILE_HALF_HEIGHT },
    { x: right.x + TILE_HALF_WIDTH, y: right.y },
    { x: bottom.x, y: bottom.y + TILE_HALF_HEIGHT },
    { x: left.x - TILE_HALF_WIDTH, y: left.y },
  ];
}

export function depthIndex(point, bias = 0) {
  return point.y * 10_000 + point.x * 10 + bias;
}

export function screenVectorToCameraDelta(deltaX, deltaY, camera) {
  const zoom = Math.max(0.01, Number(camera?.zoom) || 1);
  const rotated = {
    x: deltaY / (TILE_HEIGHT * zoom) + deltaX / (TILE_WIDTH * zoom),
    y: deltaY / (TILE_HEIGHT * zoom) - deltaX / (TILE_WIDTH * zoom),
  };
  return unrotateDelta(rotated, camera?.quarter ?? 0);
}

export function geometrySnapshot(coordinate, map, quarter = 0) {
  const cell = cellAt(map, coordinate);
  const baseCenter = projectCoordinate(coordinate, map, quarter);
  const topCenter = terrainTopCenter(coordinate, cell, map, quarter);
  const topPolygon = terrainTopPolygon(coordinate, cell, map, quarter);
  const { faces, culledFaces } = exposedTerrainFaces(coordinate, cell, map, quarter);
  return {
    coordinate: { ...coordinate },
    terrain: cell?.terrain ?? null,
    visualHeight: terrainVisualHeight(cell),
    baseCenter,
    topCenter,
    topPolygon,
    faces,
    culledFaces,
    depthIndex: depthIndex(baseCenter),
  };
}
