# Monster Master Grass Ground v1

## Decision

This is the first accepted bespoke terrain asset produced under the RPG Rendering and Asset Contract. It is the visual material for the continuous Pixi ground plane; it does not define tile geometry, picking, elevation, or gameplay state.

## Runtime asset

- Path: `public/assets/monster-master/terrain/grass-ground/grass-ground-v1-128.webp`
- Manifest: `public/assets/monster-master/terrain/grass-ground/manifest.json`
- Runtime dimensions: 128 × 128
- Runtime SHA-256: `b92981c2f5e8f131ac52b29ff646c287039f1f71248dfa6654ca2e7de0b4d69d`
- Rendering: repeated through a Pixi `TilingSprite`, then transformed by engine-owned geometry into the 2:1 pseudo-isometric battlefield plane

The source art is straight top-down by design. The renderer, not the source image, applies the pseudo-isometric transform. This keeps the material reusable across camera rotations and prevents baked perspective from disagreeing with the authoritative 72 × 36 cell geometry.

## Art intent

- recognizable grass at battlefield zoom;
- restrained contrast beneath creatures, highlights, paths, and interface overlays;
- painted late-1990s / early-2000s PC-game character;
- no landmarks, grid lines, props, or baked terrain depth;
- repeatable over a large continuous surface.

## Provenance

- Generation ID: `1b022daf-cc0e-4996-b2ef-1cc87770b0c3`
- Original generation: 1254 × 1254 PNG
- Prepared source master: 2048 × 2048 PNG
- Prepared source-master SHA-256: `be36d4d8f882e2f09d76330d6ae00d8bd86be63ae328e5abd5f67f9bcd7b6520`

The committed runtime derivative is the durable game asset. Additional larger derivatives may be added only when renderer evidence shows they improve the actual viewport.
