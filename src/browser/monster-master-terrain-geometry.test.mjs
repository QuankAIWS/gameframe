import assert from "node:assert/strict";
import test from "node:test";
import {
  GROUND_APRON_CELLS,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_VISUAL_HEIGHT,
  cellAt,
  exposedTerrainFaces,
  geometrySnapshot,
  inverseProjectPoint,
  mapSurfacePolygon,
  projectCoordinate,
  screenVectorToCameraDelta,
  terrainTopPolygon,
} from "./monster-master-terrain-geometry.js";

function mapWithWalls(walls = []) {
  const width = 6;
  const height = 6;
  const wallKeys = new Set(walls.map(({ x, y }) => `${x},${y}`));
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, (_, index) => {
      const coordinate = { x: index % width, y: Math.floor(index / width) };
      const wall = wallKeys.has(`${coordinate.x},${coordinate.y}`);
      return {
        terrain: wall ? "wall" : "floor",
        movementCost: wall ? 99 : 1,
        blocksMovement: wall,
      };
    }),
  };
}

test("projection round-trips logical coordinates through every camera quarter", () => {
  const map = mapWithWalls();
  for (let quarter = 0; quarter < 4; quarter += 1) {
    for (const coordinate of [{ x: 0, y: 0 }, { x: 2, y: 4 }, { x: 5, y: 1 }]) {
      const projected = projectCoordinate(coordinate, map, quarter);
      const restored = inverseProjectPoint(projected, map, quarter);
      assert.ok(Math.abs(restored.x - coordinate.x) < 1e-9);
      assert.ok(Math.abs(restored.y - coordinate.y) < 1e-9);
    }
  }
});

test("the authoritative terrain top is exactly one 72 by 36 diamond", () => {
  const map = mapWithWalls([{ x: 2, y: 2 }]);
  const floor = terrainTopPolygon({ x: 1, y: 1 }, cellAt(map, { x: 1, y: 1 }), map);
  const wall = geometrySnapshot({ x: 2, y: 2 }, map);

  assert.equal(Math.max(...floor.map((point) => point.x)) - Math.min(...floor.map((point) => point.x)), TILE_WIDTH);
  assert.equal(Math.max(...floor.map((point) => point.y)) - Math.min(...floor.map((point) => point.y)), TILE_HEIGHT);
  assert.equal(wall.visualHeight, WALL_VISUAL_HEIGHT);
  assert.equal(wall.baseCenter.y - wall.topCenter.y, WALL_VISUAL_HEIGHT);
  assert.equal(Math.max(...wall.topPolygon.map((point) => point.x)) - Math.min(...wall.topPolygon.map((point) => point.x)), TILE_WIDTH);
  assert.equal(Math.max(...wall.topPolygon.map((point) => point.y)) - Math.min(...wall.topPolygon.map((point) => point.y)), TILE_HEIGHT);
});

test("joined walls cull internal front faces and retain exposed faces", () => {
  const map = mapWithWalls([{ x: 2, y: 2 }, { x: 3, y: 2 }]);
  const first = exposedTerrainFaces({ x: 2, y: 2 }, cellAt(map, { x: 2, y: 2 }), map);
  const second = exposedTerrainFaces({ x: 3, y: 2 }, cellAt(map, { x: 3, y: 2 }), map);

  assert.ok(first.faces.length > 0);
  assert.ok(second.faces.length > 0);
  assert.ok(first.culledFaces + second.culledFaces > 0);
  for (const face of [...first.faces, ...second.faces]) {
    assert.equal(face.points.length, 4);
    assert.equal(face.points[2].y - face.points[1].y, WALL_VISUAL_HEIGHT);
  }
});

test("the continuous ground plane extends beyond the playable map", () => {
  const map = mapWithWalls();
  const playable = mapSurfacePolygon(map, 0, 0);
  const apron = mapSurfacePolygon(map, 0, GROUND_APRON_CELLS);
  const width = (polygon) => Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x));
  const height = (polygon) => Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y));

  assert.ok(width(apron) > width(playable));
  assert.ok(height(apron) > height(playable));
});

test("screen-space camera vectors remain cardinal after rotation", () => {
  for (let quarter = 0; quarter < 4; quarter += 1) {
    const right = screenVectorToCameraDelta(TILE_WIDTH, 0, { zoom: 1, quarter });
    const down = screenVectorToCameraDelta(0, TILE_HEIGHT, { zoom: 1, quarter });
    assert.ok(Math.abs(right.x) + Math.abs(right.y) > 0);
    assert.ok(Math.abs(down.x) + Math.abs(down.y) > 0);
    assert.ok(Math.abs(right.x * down.x + right.y * down.y) < 1e-9);
  }
});
