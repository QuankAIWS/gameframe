import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const file = (path: string) => new URL(path, `file://${repositoryRoot}/`);
const read = (path: string) => readFile(file(path), "utf8");

test("Leafwhisk Runner is a Class One unassigned asset-library creature", async () => {
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const asset = await read("public/assets/monster-master/creatures/leafwhisk-runner-v1-128.svg");
  const leafwhisk = manifest.creatures["leafwhisk-runner-v1"];

  assert.ok(manifest.sources.includes("approved-leafwhisk-runner-class-one-isometric-master-v1"));
  assert.equal(leafwhisk.label, "Leafwhisk Runner");
  assert.equal(leafwhisk.class, 1);
  assert.equal(leafwhisk.classLabel, "Class One");
  assert.equal(leafwhisk.path, "/assets/monster-master/creatures/leafwhisk-runner-v1-128.svg");
  assert.equal(leafwhisk.width, 128);
  assert.equal(leafwhisk.height, 192);
  assert.equal(leafwhisk.alpha, true);
  assert.equal(leafwhisk.usage, "asset-library");
  assert.equal(leafwhisk.assignment, "unassigned");
  assert.equal(leafwhisk.facing, "left");
  assert.equal(leafwhisk.perspective, "three-quarter-down-isometric");
  assert.equal(Object.hasOwn(leafwhisk, "role"), false);
  assert.match(asset, /^<svg/);
  assert.match(asset, /width="128" height="192"/);
  assert.match(asset, /data:image\/webp;base64,/);
});
