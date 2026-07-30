import assert from "node:assert/strict";
import test from "node:test";
import { createTacticalMap } from "../../games/tactical-core/index.ts";
import {
  centerTacticalViewport,
  createTacticalViewport,
  isTacticalCoordinateVisible,
  panTacticalViewport,
  tacticalVisibleBounds,
  tacticalVisibleCoordinates,
  tacticalVisibleSize,
  zoomTacticalViewport,
} from "./viewport.ts";

const map = createTacticalMap({ width: 24, height: 24 });

test("the default tactical viewport exposes about twelve by nine cells from a larger map", () => {
  const viewport = createTacticalViewport(map);
  assert.deepEqual(tacticalVisibleSize(map, viewport), { columns: 12, rows: 9 });
  assert.deepEqual(tacticalVisibleBounds(map, viewport), { x: 6, y: 8, columns: 12, rows: 9 });
  assert.equal(tacticalVisibleCoordinates(map, viewport).length, 108);
  assert.equal(isTacticalCoordinateVisible(map, viewport, { x: 12, y: 12 }), true);
  assert.equal(isTacticalCoordinateVisible(map, viewport, { x: 0, y: 0 }), false);
});

test("panning clamps cleanly against every map edge", () => {
  const viewport = createTacticalViewport(map);
  const topLeft = panTacticalViewport(map, viewport, { x: -100, y: -100 });
  assert.deepEqual(tacticalVisibleBounds(map, topLeft), { x: 0, y: 0, columns: 12, rows: 9 });
  const bottomRight = panTacticalViewport(map, viewport, { x: 100, y: 100 });
  assert.deepEqual(tacticalVisibleBounds(map, bottomRight), { x: 12, y: 15, columns: 12, rows: 9 });
});

test("bounded zoom changes visible cell count without entering authoritative state", () => {
  const viewport = createTacticalViewport(map, { minimumZoom: 0.75, maximumZoom: 2 });
  const close = zoomTacticalViewport(map, viewport, 4);
  assert.equal(close.zoom, 2);
  assert.deepEqual(tacticalVisibleSize(map, close), { columns: 6, rows: 5 });
  const far = zoomTacticalViewport(map, viewport, 0.1);
  assert.equal(far.zoom, 0.75);
  assert.deepEqual(tacticalVisibleSize(map, far), { columns: 16, rows: 12 });
  assert.equal(Object.hasOwn(map, "viewport"), false);
  assert.equal(Object.hasOwn(map, "camera"), false);
});

test("centering on a unit or objective preserves valid bounds", () => {
  const viewport = createTacticalViewport(map);
  const centered = centerTacticalViewport(map, viewport, { x: 2, y: 2 });
  assert.deepEqual(tacticalVisibleBounds(map, centered), { x: 0, y: 0, columns: 12, rows: 9 });
  assert.equal(isTacticalCoordinateVisible(map, centered, { x: 2, y: 2 }), true);
  const objective = centerTacticalViewport(map, viewport, { x: 12, y: 12 });
  assert.equal(isTacticalCoordinateVisible(map, objective, { x: 12, y: 12 }), true);
});
