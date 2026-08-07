import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'public/assets/monster-master/props/rock-boulder-set-v1');
const MANIFEST_PATH = path.join(BASE, 'manifest.json');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function loadManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

async function inspect(bufferOrPath) {
  const bytes = Buffer.isBuffer(bufferOrPath) ? bufferOrPath : await readFile(bufferOrPath);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    bytes,
    fileSha256: sha256(bytes),
    pixelSha256: sha256(data),
    width: info.width,
    height: info.height,
  };
}

async function loadApprovedMasters(manifest) {
  const masters = new Map();
  for (const member of manifest.members) {
    const masterPath = path.join(ROOT, member.source.materializedPath);
    const master = await inspect(masterPath);
    if (master.fileSha256 !== member.source.sourceMasterSha256) {
      throw new Error(`${member.assetId}: retained master file hash changed`);
    }
    if (master.pixelSha256 !== member.source.sourceMasterPixelSha256) {
      throw new Error(`${member.assetId}: retained master pixel hash changed`);
    }
    if (master.width !== 1024 || master.height !== 1024) {
      throw new Error(`${member.assetId}: retained master must be 1024x1024`);
    }
    masters.set(member.assetId, master.bytes);
  }
  return masters;
}

async function render(sourceBytes, variant) {
  const destination = path.join(ROOT, variant.repositoryPath);
  await mkdir(path.dirname(destination), { recursive: true });
  let pipeline = sharp(sourceBytes)
    .ensureAlpha()
    .resize(variant.width, variant.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 });
  pipeline = variant.format === 'png'
    ? pipeline.png({ compressionLevel: 9, palette: false, effort: 10 })
    : pipeline.webp({ lossless: true, effort: 6 });
  await pipeline.toFile(destination);
}

async function build() {
  const manifest = await loadManifest();
  const masters = await loadApprovedMasters(manifest);
  for (const member of manifest.members) {
    const bytes = masters.get(member.assetId);
    for (const variant of member.runtime.generatedVariants) await render(bytes, variant);
  }
}

async function verify() {
  const manifest = await loadManifest();
  if (!String(sharp.versions.sharp).startsWith('0.34.')) {
    throw new Error(`rock prop pipeline requires Sharp 0.34.x, found ${sharp.versions.sharp}`);
  }
  await loadApprovedMasters(manifest);
  for (const member of manifest.members) {
    const committed = member.runtime.committedVariant;
    const runtime = await inspect(path.join(ROOT, committed.repositoryPath));
    if (runtime.fileSha256 !== committed.sha256) {
      throw new Error(`${member.assetId}: committed runtime file hash changed`);
    }
    if (runtime.pixelSha256 !== committed.pixelSha256) {
      throw new Error(`${member.assetId}: committed runtime pixel hash changed`);
    }
    if (runtime.width !== committed.width || runtime.height !== committed.height) {
      throw new Error(`${member.assetId}: committed runtime dimensions changed`);
    }
  }
}

const command = process.argv[2] ?? 'verify';
if (command === 'build') await build();
else if (command === 'verify') await verify();
else throw new Error('usage: node scripts/monster-master-rock-props.mjs <build|verify>');
