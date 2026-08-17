import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pixiSource = await readFile(
  new URL("./monster-master-pixi-entry.js", import.meta.url),
  "utf8",
);

test("Pixi yields physical unit art to the illustrated overlay without losing tactical UI", () => {
  assert.match(pixiSource, /const illustrated = Boolean\(window\.gameFrameMonsterIllustratedAssets\?\.hasAsset\?\.\(unit\)\);/);
  assert.match(pixiSource, /group\.addChild\(ring\);/);
  assert.match(pixiSource, /if \(!illustrated\) \{[\s\S]*const shadow = new Graphics\(\)[\s\S]*const sprite = new Sprite\(/);
  assert.match(pixiSource, /group\.addChild\(healthBack, health\);/);
});
