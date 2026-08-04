# Cliff Face — Grassland Stone v1

## Decision

This accepted pilot is the vertical material for exposed faces of Monster Master's impassable raised `wall` cells. The engine owns the face polygons, 29 CSS-pixel visual height, exposure and internal-face culling, depth order, and picking. The image supplies surface treatment only.

## Runtime asset

- Path: `public/assets/monster-master/terrain/cliff-face/cliff-face-grassland-stone-v1-128.webp`
- Manifest: `public/assets/monster-master/terrain/cliff-face/manifest.json`
- Runtime dimensions: 128 × 128
- Runtime SHA-256: `4a04eff7ba89a8455db1030a9addcf8a66cbb80244cfe7ac1524446983114954`
- Geometry: engine-owned exposed wall faces with a 29 CSS-pixel visual height
- Gameplay meaning: visual treatment for impassable `wall` terrain

Pixi loads the WebP through `Assets`, enables repeat wrapping, and maps it through global texture coordinates into exposed wall-face polygons. A nonuniform texture matrix presents almost the full vertical material within the current face height while allowing longer horizontal runs before repetition. Left and right faces use restrained tint differences for directional readability.

Internal joined faces remain culled by authoritative terrain geometry. No cliff shape, cast shadow, grid, bevel, selection state, or gameplay rule is baked into the runtime texture.

## Art intent

- straight-on vertical rock-face logic;
- weathered gray-brown stone columns and fractures;
- restrained moss, roots, lichen, and sparse grass;
- compatible with the grass ground and raised barrier cap;
- readable on isolated cells and long joined walls;
- no labels, UI, mockups, borders, horizon, or perspective terrain block.

## Provenance

- Generation ID: `cc8d58f5-4906-4c3f-bc59-1be8689c0880`
- Original generation: 1269 × 1239 PNG
- Original SHA-256: `562241dedf217f7863fa37360fdd9ee53b4e76d7d419aafb01ba14cb92bedaba`
- Prepared master: 1024 × 1024
- Prepared-master SHA-256: `34cd4895b2d099d6241408ef3e1507ffc5dd3a34217782c0ccfb91bea9b14cea`
- Seam preparation: centered source strip mirrored horizontally for exact left/right continuity.

The committed WebP is the deterministic browser asset used by the game. The provenance hashes retain the identity of the reviewed generation and prepared master.
