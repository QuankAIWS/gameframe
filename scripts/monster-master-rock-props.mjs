import { createHash } from 'node:crypto';
import { createGunzip, gunzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'public/assets/monster-master/props/rock-boulder-set-v1');
const PACKAGE_DIR = path.join(BASE, 'source/package');
const MANIFEST_PATH = path.join(BASE, 'manifest.json');
const EXPECTED_CHUNKS = 9;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseOctal(buffer) {
  const text = buffer.toString('utf8').replace(/\0.*$/, '').trim();
  return text ? Number.parseInt(text, 8) : 0;
}

function parseTar(buffer, { allowTruncatedTail = false } = {}) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = parseOctal(header.subarray(124, 136));
    const type = header[156];
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) {
      if (allowTruncatedTail) break;
      throw new Error(`truncated tar entry: ${fullName}`);
    }
    if (type === 0 || type === 48) entries.push({ name: fullName, data: buffer.subarray(dataStart, dataEnd) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function recoverGunzipPrefix(archive, originalError) {
  const chunks = [];
  const recovered = await new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    gunzip.on('data', (chunk) => chunks.push(chunk));
    gunzip.once('end', () => resolve(Buffer.concat(chunks)));
    gunzip.once('error', () => {
      const prefix = Buffer.concat(chunks);
      if (prefix.length === 0) reject(originalError);
      else resolve(prefix);
    });
    gunzip.end(archive);
  });
  if (recovered.length === 0) throw originalError;
  return recovered;
}

async function decodeArchive(archive) {
  try {
    return { tar: gunzipSync(archive), recovered: false };
  } catch (error) {
    // The approved source transfer damaged the gzip wrapper after emitting the
    // usable tar prefix. Recovery is not an identity shortcut: callers accept
    // only exact allowlisted PNG SHA-256 values and then verify decoded pixels.
    return { tar: await recoverGunzipPrefix(archive, error), recovered: true };
  }
}

async function loadManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

async function decodeSourcePackage(manifest) {
  const names = (await readdir(PACKAGE_DIR))
    .filter((name) => /^chunk-\d+$/.test(name))
    .sort();
  if (names.length !== EXPECTED_CHUNKS) {
    throw new Error(`expected ${EXPECTED_CHUNKS} retained source chunks, found ${names.length}`);
  }
  const encoded = (await Promise.all(names.map((name) => readFile(path.join(PACKAGE_DIR, name), 'utf8'))))
    .join('')
    .replace(/\s+/g, '');
  const archive = Buffer.from(encoded, 'base64');
  const decoded = await decodeArchive(archive);
  const entries = parseTar(decoded.tar, { allowTruncatedTail: decoded.recovered });
  const expected = new Map(manifest.members.map((member) => [member.source.sourceMasterSha256, member]));
  const found = new Map();
  for (const entry of entries) {
    if (!entry.name.toLowerCase().endsWith('.png')) continue;
    const digest = sha256(entry.data);
    if (expected.has(digest)) found.set(digest, entry.data);
  }
  for (const digest of expected.keys()) {
    if (!found.has(digest)) throw new Error(`approved master missing from retained source package: ${digest}`);
  }
  return found;
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
  const masters = await decodeSourcePackage(manifest);
  for (const member of manifest.members) {
    const bytes = masters.get(member.source.sourceMasterSha256);
    const masterPath = path.join(ROOT, member.source.materializedPath);
    await mkdir(path.dirname(masterPath), { recursive: true });
    await writeFile(masterPath, bytes);
    for (const variant of member.runtime.generatedVariants) await render(bytes, variant);
  }
}

async function verify() {
  const manifest = await loadManifest();
  if (!String(sharp.versions.sharp).startsWith('0.34.')) {
    throw new Error(`rock prop pipeline requires Sharp 0.34.x, found ${sharp.versions.sharp}`);
  }
  const masters = await decodeSourcePackage(manifest);
  for (const member of manifest.members) {
    const sourceBytes = masters.get(member.source.sourceMasterSha256);
    const source = await inspect(sourceBytes);
    if (source.fileSha256 !== member.source.sourceMasterSha256) throw new Error(`${member.assetId}: master file hash changed`);
    if (source.pixelSha256 !== member.source.sourceMasterPixelSha256) throw new Error(`${member.assetId}: master pixel hash changed`);
    if (source.width !== 1024 || source.height !== 1024) throw new Error(`${member.assetId}: master must be 1024x1024`);

    const committed = member.runtime.committedVariant;
    const runtime = await inspect(path.join(ROOT, committed.repositoryPath));
    if (runtime.fileSha256 !== committed.sha256) throw new Error(`${member.assetId}: committed runtime file hash changed`);
    if (runtime.pixelSha256 !== committed.pixelSha256) throw new Error(`${member.assetId}: committed runtime pixel hash changed`);
    if (runtime.width !== committed.width || runtime.height !== committed.height) {
      throw new Error(`${member.assetId}: committed runtime dimensions changed`);
    }
  }
}

const command = process.argv[2] ?? 'verify';
if (command === 'build') await build();
else if (command === 'verify') await verify();
else throw new Error('usage: node scripts/monster-master-rock-props.mjs <build|verify>');
