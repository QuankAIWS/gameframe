import type { TacticalCoordinate, TacticalMap } from "../../games/tactical-core/index.ts";

export interface TacticalViewport {
  centerX: number;
  centerY: number;
  baseColumns: number;
  baseRows: number;
  zoom: number;
  minimumZoom: number;
  maximumZoom: number;
}

export interface TacticalVisibleBounds {
  x: number;
  y: number;
  columns: number;
  rows: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export function createTacticalViewport(
  map: Pick<TacticalMap, "width" | "height">,
  options: {
    baseColumns?: number;
    baseRows?: number;
    zoom?: number;
    minimumZoom?: number;
    maximumZoom?: number;
    center?: TacticalCoordinate;
  } = {},
): TacticalViewport {
  const baseColumns = positiveInteger(options.baseColumns ?? 12, "Tactical viewport columns");
  const baseRows = positiveInteger(options.baseRows ?? 9, "Tactical viewport rows");
  const minimumZoom = options.minimumZoom ?? 0.75;
  const maximumZoom = options.maximumZoom ?? 2;
  if (!Number.isFinite(minimumZoom) || !Number.isFinite(maximumZoom) || minimumZoom <= 0 || maximumZoom < minimumZoom) {
    throw new Error("Tactical viewport zoom bounds are invalid.");
  }
  const viewport: TacticalViewport = {
    centerX: options.center?.x ?? (map.width - 1) / 2,
    centerY: options.center?.y ?? (map.height - 1) / 2,
    baseColumns,
    baseRows,
    zoom: clamp(options.zoom ?? 1, minimumZoom, maximumZoom),
    minimumZoom,
    maximumZoom,
  };
  return clampTacticalViewport(map, viewport);
}

export function tacticalVisibleSize(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
): { columns: number; rows: number } {
  return {
    columns: Math.min(map.width, Math.max(1, Math.ceil(viewport.baseColumns / viewport.zoom))),
    rows: Math.min(map.height, Math.max(1, Math.ceil(viewport.baseRows / viewport.zoom))),
  };
}

export function tacticalVisibleBounds(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
): TacticalVisibleBounds {
  const size = tacticalVisibleSize(map, viewport);
  return {
    x: clamp(Math.round(viewport.centerX - (size.columns - 1) / 2), 0, map.width - size.columns),
    y: clamp(Math.round(viewport.centerY - (size.rows - 1) / 2), 0, map.height - size.rows),
    columns: size.columns,
    rows: size.rows,
  };
}

export function clampTacticalViewport(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
): TacticalViewport {
  const zoom = clamp(viewport.zoom, viewport.minimumZoom, viewport.maximumZoom);
  const candidate = { ...viewport, zoom };
  const bounds = tacticalVisibleBounds(map, candidate);
  return {
    ...candidate,
    centerX: bounds.x + (bounds.columns - 1) / 2,
    centerY: bounds.y + (bounds.rows - 1) / 2,
  };
}

export function panTacticalViewport(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
  delta: TacticalCoordinate,
): TacticalViewport {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw new Error("Tactical viewport pan delta must be finite.");
  }
  return clampTacticalViewport(map, {
    ...viewport,
    centerX: viewport.centerX + delta.x,
    centerY: viewport.centerY + delta.y,
  });
}

export function zoomTacticalViewport(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
  zoom: number,
): TacticalViewport {
  if (!Number.isFinite(zoom)) throw new Error("Tactical viewport zoom must be finite.");
  return clampTacticalViewport(map, { ...viewport, zoom });
}

export function centerTacticalViewport(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
  coordinate: TacticalCoordinate,
): TacticalViewport {
  return clampTacticalViewport(map, {
    ...viewport,
    centerX: coordinate.x,
    centerY: coordinate.y,
  });
}

export function tacticalVisibleCoordinates(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
): TacticalCoordinate[] {
  const bounds = tacticalVisibleBounds(map, viewport);
  const coordinates: TacticalCoordinate[] = [];
  for (let y = bounds.y; y < bounds.y + bounds.rows; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.columns; x += 1) {
      coordinates.push({ x, y });
    }
  }
  return coordinates;
}

export function isTacticalCoordinateVisible(
  map: Pick<TacticalMap, "width" | "height">,
  viewport: TacticalViewport,
  coordinate: TacticalCoordinate,
): boolean {
  const bounds = tacticalVisibleBounds(map, viewport);
  return coordinate.x >= bounds.x
    && coordinate.y >= bounds.y
    && coordinate.x < bounds.x + bounds.columns
    && coordinate.y < bounds.y + bounds.rows;
}
