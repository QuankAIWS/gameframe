import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  acceptedRuntimePaths,
  legacyFrameRectangle,
  resolveMonsterMasterUnitVisual,
  validateMonsterMasterCorePack,
} from "./monster-master-asset-pack.js";

const manifestPath = new URL("../../public/assets/monster-master/packs/core-v1/manifest.json", import.meta.url);

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

test("Monster Master core pack identifies trainers separately from monsters", async () => {
  const manifest = validateMonsterMasterCorePack(await readManifest());

  assert.equal(manifest.unitVisuals["warden-master-v1"].family, "trainer");
  assert.equal(manifest.unitVisuals["stone-bulwark-v1"].family, "monster");
  assert.equal(manifest.unitVisuals["emberling-skirmisher-v1"].family, "monster");
});

test("legacy unit art is explicitly temporary and names its replacement target", async () => {
  const manifest = validateMonsterMasterCorePack(await readManifest());

  assert.equal(manifest.unitVisuals["warden-master-v1"].status, "legacy-fallback");
  assert.equal(
    manifest.unitVisuals["warden-master-v1"].replacementTarget,
    "trainer-default-master-v1-battlefield",
  );
  assert.equal(
    manifest.unitVisuals["stone-bulwark-v1"].replacementTarget,
    "monster-stone-bulwark-v2-battlefield",
  );
  assert.equal(
    manifest.unitVisuals["emberling-skirmisher-v1"].replacementTarget,
    "monster-emberling-skirmisher-v2-battlefield",
  );
  assert.deepEqual(acceptedRuntimePaths(manifest), []);
});

test("unit visual resolution prefers content IDs and falls back by compatibility role", async () => {
  const manifest = validateMonsterMasterCorePack(await readManifest());

  const direct = resolveMonsterMasterUnitVisual(manifest, {
    contentId: "stone-bulwark-v1",
    role: "bulwark",
  });
  assert.equal(direct.contentId, "stone-bulwark-v1");
  assert.equal(direct.battlefield.displayHeight, 104);

  const compatibilityFallback = resolveMonsterMasterUnitVisual(manifest, {
    contentId: "future-bulwark-content",
    role: "bulwark",
  });
  assert.equal(compatibilityFallback.contentId, "stone-bulwark-v1");
});

test("legacy atlas rectangles are resolved from manifest geometry", async () => {
  const manifest = validateMonsterMasterCorePack(await readManifest());

  assert.deepEqual(
    legacyFrameRectangle(manifest, manifest.unitVisuals["warden-master-v1"]),
    { x: 0, y: 0, width: 96, height: 96 },
  );
  assert.deepEqual(
    legacyFrameRectangle(manifest, manifest.unitVisuals["stone-bulwark-v1"]),
    { x: 96, y: 0, width: 96, height: 96 },
  );
  assert.deepEqual(
    legacyFrameRectangle(manifest, manifest.unitVisuals["emberling-skirmisher-v1"]),
    { x: 192, y: 0, width: 96, height: 96 },
  );
});

test("core pack validation rejects an untracked runtime replacement", async () => {
  const manifest = await readManifest();
  manifest.unitVisuals["stone-bulwark-v1"] = {
    ...manifest.unitVisuals["stone-bulwark-v1"],
    status: "accepted",
    runtime: {
      path: "/assets/monster-master/monsters/stone-bulwark/battlefield.webp",
      format: "webp",
      width: 512,
      height: 512,
    },
  };

  assert.throws(
    () => validateMonsterMasterCorePack(manifest),
    /runtime sha256/,
  );
});
