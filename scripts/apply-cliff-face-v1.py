from pathlib import Path
import base64
import hashlib
import json

PAYLOAD_ROOT = Path(".github/asset-payload/cliff-face-v1")
ASSET_DIR = Path("public/assets/monster-master/terrain/cliff-face")
ASSET_PATH = ASSET_DIR / "cliff-face-grassland-stone-v1-128.webp"
EXPECTED_RUNTIME_HASH = "4a04eff7ba89a8455db1030a9addcf8a66cbb80244cfe7ac1524446983114954"

parts = sorted(PAYLOAD_ROOT.glob("runtime.part*"))
if not parts:
    raise SystemExit("No cliff-face runtime payload parts found")
runtime_bytes = base64.b64decode("".join(part.read_text().strip() for part in parts))
actual_hash = hashlib.sha256(runtime_bytes).hexdigest()
if actual_hash != EXPECTED_RUNTIME_HASH:
    raise SystemExit(f"Cliff-face runtime hash mismatch: {actual_hash}")

ASSET_DIR.mkdir(parents=True, exist_ok=True)
ASSET_PATH.write_bytes(runtime_bytes)

manifest = {
    "schemaVersion": 1,
    "assetId": "monster-master.cliff-face.grassland-stone.v1",
    "family": "environment.elevation-face",
    "role": "exposed-vertical-wall-face",
    "status": "accepted-pilot",
    "runtime": {
        "path": "/assets/monster-master/terrain/cliff-face/cliff-face-grassland-stone-v1-128.webp",
        "format": "webp",
        "width": 128,
        "height": 128,
        "repeatX": True,
        "repeatY": True,
        "colorSpace": "srgb",
        "sha256": EXPECTED_RUNTIME_HASH,
    },
    "source": {
        "generationId": "cc8d58f5-4906-4c3f-bc59-1be8689c0880",
        "originalDimensions": [1269, 1239],
        "originalSha256": "562241dedf217f7863fa37360fdd9ee53b4e76d7d419aafb01ba14cb92bedaba",
        "preparedMasterDimensions": [1024, 1024],
        "preparedMasterSha256": "34cd4895b2d099d6241408ef3e1507ffc5dd3a34217782c0ccfb91bea9b14cea",
        "horizontalSeamMethod": "mirrored-source-strip",
    },
    "rendering": {
        "renderer": "pixi",
        "geometryRole": "exposed-wall-face-29px",
        "textureSpace": "global",
        "textureMatrixScale": {"x": 0.72, "y": 0.24},
        "visualHeightCssPixels": 29,
        "ownsGeometry": False,
        "internalFacesCulled": True,
        "gameplay": "visual-treatment-for-impassable-wall",
    },
}
(ASSET_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

notes = Path("planning/monster-master/assets/cliff-face-grassland-stone-v1.md")
notes.parent.mkdir(parents=True, exist_ok=True)
notes.write_text("""# Cliff Face — Grassland Stone v1

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
""")

test_source = """import assert from \"node:assert/strict\";
import { createHash } from \"node:crypto\";
import { readFileSync, statSync } from \"node:fs\";
import test from \"node:test\";

const renderer = readFileSync(\"src/browser/monster-master-pixi-entry.js\", \"utf8\");
const manifest = JSON.parse(readFileSync(\"public/assets/monster-master/terrain/cliff-face/manifest.json\", \"utf8\"));
const asset = \"public/assets/monster-master/terrain/cliff-face/cliff-face-grassland-stone-v1-128.webp\";

test(\"Monster Master maps the durable cliff material onto exposed wall faces\", () => {
  assert.equal(manifest.assetId, \"monster-master.cliff-face.grassland-stone.v1\");
  assert.equal(manifest.rendering.geometryRole, \"exposed-wall-face-29px\");
  assert.equal(manifest.rendering.visualHeightCssPixels, 29);
  assert.equal(manifest.rendering.internalFacesCulled, true);
  assert.ok(statSync(asset).size > 8_000);
  assert.equal(createHash(\"sha256\").update(readFileSync(asset)).digest(\"hex\"), manifest.runtime.sha256);
  assert.match(renderer, /const CLIFF_FACE_TEXTURE =/);
  assert.match(renderer, /const CLIFF_FACE_TEXTURE_MATRIX = new Matrix\(\)\.scale\(0\.72, 0\.24\)/);
  assert.match(renderer, /cliffFace\.source\.wrapMode = \"repeat\"/);
  assert.match(renderer, /texture: state\.textures\.cliffFace/);
  assert.match(renderer, /matrix: CLIFF_FACE_TEXTURE_MATRIX/);
  assert.doesNotMatch(renderer, /const seamY =/);
  assert.doesNotMatch(renderer, /fill\(\{ color, alpha: 1 \}\)/);
});
"""
Path("src/browser/monster-master-cliff-face-asset-contract.test.mjs").write_text(test_source)

renderer = Path("src/browser/monster-master-pixi-entry.js")
source = renderer.read_text()
replacements = [
    ("  Graphics,\n  Rectangle,", "  Graphics,\n  Matrix,\n  Rectangle,"),
    (
        'const RAISED_BARRIER_CAP_TEXTURE = "/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp";\n',
        'const RAISED_BARRIER_CAP_TEXTURE = "/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp";\n'
        'const CLIFF_FACE_TEXTURE = "/assets/monster-master/terrain/cliff-face/cliff-face-grassland-stone-v1-128.webp";\n',
    ),
    (
        'const GEOMETRY_DEBUG_PARAMETER = "geometryDebug";\n',
        'const GEOMETRY_DEBUG_PARAMETER = "geometryDebug";\n'
        'const CLIFF_FACE_TEXTURE_MATRIX = new Matrix().scale(0.72, 0.24);\n',
    ),
    (
        '''  const [creatureBase, grassGround, raisedBarrierCap] = await Promise.all([\n    Assets.load(CREATURE_ATLAS),\n    Assets.load(GRASS_GROUND_TEXTURE),\n    Assets.load(RAISED_BARRIER_CAP_TEXTURE),\n  ]);\n  raisedBarrierCap.source.wrapMode = "repeat";\n  state.textures = { creatureBase, grassGround, raisedBarrierCap };''',
        '''  const [creatureBase, grassGround, raisedBarrierCap, cliffFace] = await Promise.all([\n    Assets.load(CREATURE_ATLAS),\n    Assets.load(GRASS_GROUND_TEXTURE),\n    Assets.load(RAISED_BARRIER_CAP_TEXTURE),\n    Assets.load(CLIFF_FACE_TEXTURE),\n  ]);\n  raisedBarrierCap.source.wrapMode = "repeat";\n  cliffFace.source.wrapMode = "repeat";\n  state.textures = { creatureBase, grassGround, raisedBarrierCap, cliffFace };''',
    ),
    (
        '''    for (const face of faces) {\n      const color = face.side === "left" ? 0x485348 : 0x3a4742;\n      display.poly(flatten(face.points))\n        .fill({ color, alpha: 1 })\n        .stroke({ color: 0xa9a584, alpha: 0.3, width: 1 });\n      const upper = face.points[0];\n      const lower = face.points[3];\n      const seamY = upper.y + (lower.y - upper.y) * (0.42 + ((entry.coordinate.x + entry.coordinate.y) % 3) * 0.08);\n      display.moveTo(upper.x, seamY).lineTo(face.points[1].x, seamY + (face.points[1].y - upper.y))\n        .stroke({ color: 0xd2cda8, alpha: 0.12, width: 0.8 });\n    }''',
        '''    for (const face of faces) {\n      const tint = face.side === "left" ? 0xd8cfba : 0xb7ad9a;\n      display.poly(flatten(face.points))\n        .fill({\n          texture: state.textures.cliffFace,\n          textureSpace: "global",\n          matrix: CLIFF_FACE_TEXTURE_MATRIX,\n          color: tint,\n          alpha: 1,\n        })\n        .stroke({ color: 0xbdb08e, alpha: 0.42, width: 0.9 });\n    }''',
    ),
]
for old, new in replacements:
    if old not in source:
        raise SystemExit(f"Expected renderer block not found: {old[:80]!r}")
    source = source.replace(old, new, 1)
renderer.write_text(source)
