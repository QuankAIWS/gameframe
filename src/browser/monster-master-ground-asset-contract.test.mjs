import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/browser/monster-master-pixi-entry.js", "utf8");
const manifest = JSON.parse(readFileSync("public/assets/monster-master/terrain/grass-ground/manifest.json", "utf8"));
const asset = "public/assets/monster-master/terrain/grass-ground/grass-ground-v1-128.webp";

test("Monster Master loads the durable grass material through the continuous Pixi ground plane", () => {
  assert.equal(manifest.assetId, "monster-master.grass-ground.v1");
  assert.equal(manifest.runtime.path, "/assets/monster-master/terrain/grass-ground/grass-ground-v1-128.webp");
  assert.equal(manifest.runtime.repeat, true);
  assert.ok(statSync(asset).size > 4_000);
  assert.match(source, /const GRASS_GROUND_TEXTURE =/);
  assert.match(source, /new TilingSprite/);
  assert.match(source, /const ground = new Container\(\)/);
  assert.doesNotMatch(source, /const ground = new Graphics\(\)/);
});
