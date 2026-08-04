import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const renderer = readFileSync("src/browser/monster-master-pixi-entry.js", "utf8");
const manifest = JSON.parse(readFileSync("public/assets/monster-master/terrain/cliff-face/manifest.json", "utf8"));
const asset = "public/assets/monster-master/terrain/cliff-face/cliff-face-grassland-stone-v1-128.webp";

test("Monster Master maps the durable cliff material onto exposed wall faces", () => {
  assert.equal(manifest.assetId, "monster-master.cliff-face.grassland-stone.v1");
  assert.equal(manifest.rendering.geometryRole, "exposed-wall-face-29px");
  assert.equal(manifest.rendering.visualHeightCssPixels, 29);
  assert.equal(manifest.rendering.internalFacesCulled, true);
  assert.ok(statSync(asset).size > 8_000);
  assert.equal(createHash("sha256").update(readFileSync(asset)).digest("hex"), manifest.runtime.sha256);
  assert.match(renderer, /const CLIFF_FACE_TEXTURE =/);
  assert.match(renderer, /const CLIFF_FACE_TEXTURE_MATRIX = new Matrix\(\)\.scale\(0\.72, 0\.24\)/);
  assert.match(renderer, /cliffFace\.source\.wrapMode = "repeat"/);
  assert.match(renderer, /texture: state\.textures\.cliffFace/);
  assert.match(renderer, /matrix: CLIFF_FACE_TEXTURE_MATRIX/);
  assert.doesNotMatch(renderer, /const seamY =/);
  assert.doesNotMatch(renderer, /fill\(\{ color, alpha: 1 \}\)/);
});
