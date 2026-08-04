import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/browser/monster-master-pixi-entry.js", "utf8");
const manifest = JSON.parse(readFileSync("public/assets/monster-master/terrain/raised-barrier-cap/manifest.json", "utf8"));
const asset = "public/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp";

test("Monster Master maps the durable stone cap onto impassable wall-top geometry", () => {
  const bytes = readFileSync(asset);
  assert.equal(manifest.assetId, "monster-master.raised-barrier-cap.grassland-stone.v1");
  assert.equal(manifest.runtime.path, "/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp");
  assert.equal(manifest.rendering.geometryRole, "wall-top-72x36");
  assert.equal(manifest.rendering.gameplay, "impassable");
  assert.ok(statSync(asset).size > 4_000);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.source.runtimeSha256);
  assert.match(source, /const RAISED_BARRIER_CAP_TEXTURE =/);
  assert.match(source, /raisedBarrierCap\.source\.wrapMode = "repeat"/);
  assert.match(source, /texture: state\.textures\.raisedBarrierCap/);
  assert.match(source, /textureSpace: "global"/);
  assert.doesNotMatch(source, /fill\(\{ color: 0x7e8068, alpha: 1 \}\)/);
});
