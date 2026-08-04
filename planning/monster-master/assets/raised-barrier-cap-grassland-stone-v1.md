# Raised Barrier Cap — Grassland Stone v1

## Decision

This accepted pilot is the top-surface material for Monster Master's impassable raised `wall` cells. It is not walkable high ground and does not define terrain geometry or gameplay elevation.

## Runtime asset

- Path: `public/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp`
- Manifest: `public/assets/monster-master/terrain/raised-barrier-cap/manifest.json`
- Runtime dimensions: 128 × 128
- Runtime SHA-256: `5c65f0ae0beafc30f4b077b3dd1182d77eee8e5e7b2f74258353e4b26ca190e1`
- Geometry: engine-owned 72 × 36 top diamond, raised 29 CSS pixels
- Gameplay meaning: impassable obstruction

The source material is orthographic and contains no painted cliff edge. Pixi maps it through global texture space into exact wall-top polygons so connected barriers do not look like rows of identical miniature pictures. Exposed vertical faces remain a separate geometry and future asset family.

## Art intent

- predominantly fractured stone and compact rocky earth;
- sparse moss and grass only in cracks;
- clearly harder and less traversable than the continuous grass plane;
- no baked border, bevel, cliff face, drop shadow, grid, or selection state;
- readable at ordinary battlefield zoom before source-resolution inspection.

## Provenance

- Generation ID: `ff516c3c-d9d2-49b1-ac9f-98cfeab4170f`
- Original generation: 1254 × 1254 PNG
- Original SHA-256: `24c13be1ae96801f995bc5e31666b4c55fbbc927f7554dec08c67c20131af568`
- Prepared source master: 1024 × 1024 PNG
- Prepared source-master SHA-256: `cadb45dedce6786b041ccf81c83ce4cabb8b8df806732b1a1cb33d801275a5dd`

The committed WebP is the durable runtime game asset. Source provenance is retained so a future catalog or higher-resolution derivative can be added without changing the asset identity.
