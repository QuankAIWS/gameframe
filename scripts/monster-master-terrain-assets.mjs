import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const SHARP_VERSION = "0.34.3";
const assets = [
  {
    manifestPath: "public/assets/monster-master/terrain/grass-ground/manifest.json",
    runtimePath: "public/assets/monster-master/terrain/grass-ground/grass-ground-v1-128.webp",
    masterPath: "public/assets/monster-master/terrain/grass-ground/source/grass-ground-v1-master.png",
    masterWidth: 2048,
    masterHeight: 2048,
    runtimeHashLocation: ["source", "runtimeSha256"],
  },
  {
    manifestPath: "public/assets/monster-master/terrain/raised-barrier-cap/manifest.json",
    runtimePath: "public/assets/monster-master/terrain/raised-barrier-cap/raised-barrier-cap-grassland-stone-v1-128.webp",
    masterPath: "public/assets/monster-master/terrain/raised-barrier-cap/source/raised-barrier-cap-grassland-stone-v1-master.png",
    masterWidth: 1024,
    masterHeight: 1024,
    runtimeHashLocation: ["source", "runtimeSha256"],
  },
  {
    manifestPath: "public/assets/monster-master/terrain/cliff-face/manifest.json",
    runtimePath: "public/assets/monster-master/terrain/cliff-face/cliff-face-grassland-stone-v1-128.webp",
    masterPath: "public/assets/monster-master/terrain/cliff-face/source/cliff-face-grassland-stone-v1-master.png",
    masterWidth: 1024,
    masterHeight: 1024,
    runtimeHashLocation: ["runtime", "sha256"],
  },
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function setNested(target, [section, key], value) {
  target[section] ??= {};
  target[section][key] = value;
}

async function renderMaster(runtimeBytes, asset) {
  return sharp(runtimeBytes)
    .resize(asset.masterWidth, asset.masterHeight, { fit: "fill", kernel: "nearest" })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

async function renderRuntime(masterBytes) {
  return sharp(masterBytes)
    .resize(128, 128, { fit: "fill", kernel: "nearest" })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
}

async function bootstrapAsset(asset) {
  const acceptedRuntime = await readFile(asset.runtimePath);
  const masterBytes = await renderMaster(acceptedRuntime, asset);
  const runtimeBytes = await renderRuntime(masterBytes);
  await mkdir(dirname(asset.masterPath), { recursive: true });
  await writeFile(asset.masterPath, masterBytes);
  await writeFile(asset.runtimePath, runtimeBytes);

  const manifest = JSON.parse(await readFile(asset.manifestPath, "utf8"));
  manifest.source.preparedMasterPath = asset.masterPath;
  manifest.source.preparedMasterDimensions = [asset.masterWidth, asset.masterHeight];
  manifest.source.preparedMasterSha256 = sha256(masterBytes);
  manifest.source.transform = {
    tool: "sharp",
    version: SHARP_VERSION,
    masterBootstrap: {
      input: "accepted runtime derivative",
      resizeKernel: "nearest",
      outputFormat: "png",
      compressionLevel: 9
    },
    runtimeDerivative: {
      width: 128,
      height: 128,
      resizeKernel: "nearest",
      outputFormat: "webp",
      lossless: true,
      effort: 6
    }
  };
  setNested(manifest, asset.runtimeHashLocation, sha256(runtimeBytes));
  manifest.runtime.sha256 = sha256(runtimeBytes);
  await writeFile(asset.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function buildAsset(asset) {
  const masterBytes = await readFile(asset.masterPath);
  await writeFile(asset.runtimePath, await renderRuntime(masterBytes));
}

async function verifyAsset(asset) {
  const manifest = JSON.parse(await readFile(asset.manifestPath, "utf8"));
  const masterBytes = await readFile(asset.masterPath);
  const runtimeBytes = await readFile(asset.runtimePath);
  const rebuiltRuntime = await renderRuntime(masterBytes);
  assert.equal(manifest.source.preparedMasterPath, asset.masterPath);
  assert.equal(manifest.source.transform.tool, "sharp");
  assert.equal(manifest.source.transform.version, SHARP_VERSION);
  assert.equal(sha256(masterBytes), manifest.source.preparedMasterSha256);
  assert.deepEqual(runtimeBytes, rebuiltRuntime, `${asset.runtimePath} is not reproducible from its committed master`);
  assert.equal(sha256(runtimeBytes), manifest.runtime.sha256);
  const [section, key] = asset.runtimeHashLocation;
  assert.equal(sha256(runtimeBytes), manifest[section][key]);
}

const mode = process.argv[2];
if (!new Set(["bootstrap", "build", "verify"]).has(mode)) {
  throw new Error("Usage: node scripts/monster-master-terrain-assets.mjs <bootstrap|build|verify>");
}
for (const asset of assets) {
  if (mode === "bootstrap") await bootstrapAsset(asset);
  if (mode === "build") await buildAsset(asset);
  if (mode === "verify") await verifyAsset(asset);
}
