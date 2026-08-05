import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { validateMonsterMasterCorePack } from "../src/browser/monster-master-asset-pack.js";

const SHARP_VERSION = "0.34.3";
const MANIFEST_PATH = "public/assets/monster-master/packs/core-v1/manifest.json";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function publicPath(runtimePath) {
  assert.match(runtimePath, /^\/assets\//);
  return `public${runtimePath}`;
}

async function readManifest() {
  return validateMonsterMasterCorePack(JSON.parse(await readFile(MANIFEST_PATH, "utf8")));
}

async function renderRuntime(sourceBytes, runtime) {
  const image = sharp(sourceBytes).resize(runtime.width, runtime.height, {
    fit: "contain",
    position: "centre",
    kernel: "lanczos3",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (runtime.format === "png") {
    return image.png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  }
  return image.webp({ lossless: true, effort: 6 }).toBuffer();
}

async function verifyLegacyAtlas(manifest) {
  const bytes = await readFile(publicPath(manifest.legacyAtlas.path));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, manifest.legacyAtlas.cellWidth * manifest.legacyAtlas.columns);
  assert.equal(metadata.height, manifest.legacyAtlas.cellHeight * manifest.legacyAtlas.rows);
}

async function buildAcceptedAssets(manifest) {
  for (const visual of Object.values(manifest.unitVisuals)) {
    if (!visual.runtime || visual.status !== "accepted") continue;
    assert.equal(visual.runtime.transform.tool, "sharp");
    assert.equal(visual.runtime.transform.version, SHARP_VERSION);
    const sourceBytes = await readFile(visual.runtime.sourceMasterPath);
    assert.equal(sha256(sourceBytes), visual.runtime.sourceMasterSha256);
    await writeFile(publicPath(visual.runtime.path), await renderRuntime(sourceBytes, visual.runtime));
  }
}

async function verifyAcceptedAssets(manifest) {
  for (const [contentId, visual] of Object.entries(manifest.unitVisuals)) {
    if (!visual.runtime || visual.status !== "accepted") continue;
    assert.equal(visual.runtime.transform.tool, "sharp");
    assert.equal(visual.runtime.transform.version, SHARP_VERSION);

    const sourceBytes = await readFile(visual.runtime.sourceMasterPath);
    const runtimeBytes = await readFile(publicPath(visual.runtime.path));
    const rebuilt = await renderRuntime(sourceBytes, visual.runtime);
    const sourceMetadata = await sharp(sourceBytes).metadata();
    const runtimeMetadata = await sharp(runtimeBytes).metadata();

    assert.equal(sourceMetadata.width, visual.runtime.sourceWidth, `${contentId} source width`);
    assert.equal(sourceMetadata.height, visual.runtime.sourceHeight, `${contentId} source height`);
    assert.equal(runtimeMetadata.width, visual.runtime.width, `${contentId} runtime width`);
    assert.equal(runtimeMetadata.height, visual.runtime.height, `${contentId} runtime height`);
    assert.equal(sha256(sourceBytes), visual.runtime.sourceMasterSha256, `${contentId} source hash`);
    assert.equal(sha256(runtimeBytes), visual.runtime.sha256, `${contentId} runtime hash`);
    assert.deepEqual(runtimeBytes, rebuilt, `${contentId} runtime derivative is not reproducible`);
  }
}

const mode = process.argv[2];
if (!new Set(["build", "verify"]).has(mode)) {
  throw new Error("Usage: node scripts/monster-master-core-assets.mjs <build|verify>");
}

const manifest = await readManifest();
await verifyLegacyAtlas(manifest);
if (mode === "build") await buildAcceptedAssets(manifest);
if (mode === "verify") await verifyAcceptedAssets(manifest);
