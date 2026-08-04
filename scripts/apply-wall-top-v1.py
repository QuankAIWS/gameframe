from pathlib import Path
import base64
import hashlib
import json

asset_dir = Path("public/assets/monster-master/terrain/raised-barrier-cap")
asset_dir.mkdir(parents=True, exist_ok=True)
asset_path = asset_dir / "raised-barrier-cap-grassland-stone-v1-128.webp"
payload = Path(".github/asset-payload/wall-top-v1.base64").read_text().strip()
asset_path.write_bytes(base64.b64decode(payload))

expected_hash = "5c65f0ae0beafc30f4b077b3dd1182d77eee8e5e7b2f74258353e4b26ca190e1"
actual_hash = hashlib.sha256(asset_path.read_bytes()).hexdigest()
if actual_hash != expected_hash:
    raise SystemExit(f"wall-top payload hash mismatch: {actual_hash}")

manifest = {
    "schemaVersion": 1,
    "assetId": "monster-master.raised-barrier-cap.grassland-stone.v1",
    "family": "environment.terrain-top",
    "role": "impassable-raised-barrier-cap",
    "status": "accepted-pilot",
    "runtime": {
        "path": "/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp",
        "format": "webp",
        "width": 128,
        "height": 128,
        "repeat": True,
        "colorSpace": "srgb",
    },
    "source": {
        "generationId": "ff516c3c-d9d2-49b1-ac9f-98cfeab4170f",
        "originalDimensions": [1254, 1254],
        "originalSha256": "24c13be1ae96801f995bc5e31666b4c55fbbc927f7554dec08c67c20131af568",
        "preparedMasterDimensions": [1024, 1024],
        "preparedMasterSha256": "cadb45dedce6786b041ccf81c83ce4cabb8b8df806732b1a1cb33d801275a5dd",
        "runtimeSha256": expected_hash,
    },
    "rendering": {
        "renderer": "pixi",
        "geometryRole": "wall-top-72x36",
        "textureSpace": "global",
        "visualHeightCssPixels": 29,
        "ownsGeometry": False,
        "gameplay": "impassable",
    },
}
(asset_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

notes = Path("planning/monster-master/assets/raised-barrier-cap-grassland-stone-v1.md")
notes.parent.mkdir(parents=True, exist_ok=True)
notes.write_text("""# Raised Barrier Cap — Grassland Stone v1

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
""")

test_source = """import assert from \"node:assert/strict\";
import { createHash } from \"node:crypto\";
import { readFileSync, statSync } from \"node:fs\";
import test from \"node:test\";

const source = readFileSync(\"src/browser/monster-master-pixi-entry.js\", \"utf8\");
const manifest = JSON.parse(readFileSync(\"public/assets/monster-master/terrain/raised-barrier-cap/manifest.json\", \"utf8\"));
const asset = \"public/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp\";

test(\"Monster Master maps the durable stone cap onto impassable wall-top geometry\", () => {
  const bytes = readFileSync(asset);
  assert.equal(manifest.assetId, \"monster-master.raised-barrier-cap.grassland-stone.v1\");
  assert.equal(manifest.runtime.path, \"/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp\");
  assert.equal(manifest.rendering.geometryRole, \"wall-top-72x36\");
  assert.equal(manifest.rendering.gameplay, \"impassable\");
  assert.ok(statSync(asset).size > 4_000);
  assert.equal(createHash(\"sha256\").update(bytes).digest(\"hex\"), manifest.source.runtimeSha256);
  assert.match(source, /const RAISED_BARRIER_CAP_TEXTURE =/);
  assert.match(source, /raisedBarrierCap\.source\.wrapMode = \"repeat\"/);
  assert.match(source, /texture: state\.textures\.raisedBarrierCap/);
  assert.match(source, /textureSpace: \"global\"/);
  assert.doesNotMatch(source, /fill\(\{ color: 0x7e8068, alpha: 1 \}\)/);
});
"""
Path("src/browser/monster-master-wall-top-asset-contract.test.mjs").write_text(test_source)

renderer = Path("src/browser/monster-master-pixi-entry.js")
source = renderer.read_text()
source = source.replace(
    'const GRASS_GROUND_TEXTURE = "/assets/monster-master/terrain/grass-ground/grass-ground-v1-128.webp";\n',
    'const GRASS_GROUND_TEXTURE = "/assets/monster-master/terrain/grass-ground/grass-ground-v1-128.webp";\n'
    'const RAISED_BARRIER_CAP_TEXTURE = "/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp";\n',
    1,
)
source = source.replace(
    '''  const [creatureBase, grassGround] = await Promise.all([\n    Assets.load(CREATURE_ATLAS),\n    Assets.load(GRASS_GROUND_TEXTURE),\n  ]);\n  state.textures = { creatureBase, grassGround };''',
    '''  const [creatureBase, grassGround, raisedBarrierCap] = await Promise.all([\n    Assets.load(CREATURE_ATLAS),\n    Assets.load(GRASS_GROUND_TEXTURE),\n    Assets.load(RAISED_BARRIER_CAP_TEXTURE),\n  ]);\n  raisedBarrierCap.source.wrapMode = "repeat";\n  state.textures = { creatureBase, grassGround, raisedBarrierCap };''',
    1,
)
source = source.replace(
    '''    graphics.poly(flatten(polygon))\n      .fill({ color: 0x7e8068, alpha: 1 })\n      .stroke({ color: 0xc1bb93, alpha: 0.52, width: 1.2 });\n    const inset = diamondPoints(terrainTopCenter(entry.coordinate, entry.cell, map(), state.camera.quarter), TILE_WIDTH * 0.62, TILE_HEIGHT * 0.62);\n    graphics.poly(flatten(inset)).stroke({ color: 0x535d51, alpha: 0.42, width: 1 });''',
    '''    graphics.poly(flatten(polygon))\n      .fill({\n        texture: state.textures.raisedBarrierCap,\n        textureSpace: "global",\n        color: 0xd8cfb8,\n        alpha: 1,\n      })\n      .stroke({ color: 0xd2c59d, alpha: 0.7, width: 1.1 });''',
    1,
)
required = [
    "const RAISED_BARRIER_CAP_TEXTURE =",
    "raisedBarrierCap.source.wrapMode = \"repeat\"",
    "texture: state.textures.raisedBarrierCap",
    "textureSpace: \"global\"",
]
missing = [item for item in required if item not in source]
if missing:
    raise SystemExit(f"renderer patch failed: {missing}")
renderer.write_text(source)
