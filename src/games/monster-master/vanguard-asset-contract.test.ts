import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const file = (path: string) => new URL(path, `file://${repositoryRoot}/`);
const read = (path: string) => readFile(file(path), "utf8");
const readBytes = (path: string) => readFile(file(path));

test("Vanguard is an unassigned Monster Master trainer asset-library archetype", async () => {
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const asset = await readBytes("public/assets/monster-master/trainers/vanguard-trainer-v1-128.webp");
  const vanguard = manifest.trainerAssets["vanguard-trainer-v1"];

  assert.ok(manifest.sources.includes("approved-vanguard-trainer-isometric-master-v1"));
  assert.equal(vanguard.label, "Vanguard");
  assert.equal(vanguard.archetype, "vanguard");
  assert.equal(vanguard.path, "/assets/monster-master/trainers/vanguard-trainer-v1-128.webp");
  assert.equal(vanguard.width, 128);
  assert.equal(vanguard.height, 192);
  assert.equal(vanguard.alpha, true);
  assert.equal(vanguard.usage, "asset-library");
  assert.equal(vanguard.assignment, "unassigned");
  assert.equal(Object.hasOwn(vanguard, "role"), false);
  assert.equal(vanguard.provenance.provider, "OpenAI ChatGPT image generation");
  assert.equal(vanguard.provenance.attributionRequired, false);
  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
});
