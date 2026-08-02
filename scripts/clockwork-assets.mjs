import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const mode = process.argv[2] ?? "check";
const root = resolve(process.cwd());
const manifestPath = join(root, "art-source/checkers/clockwork-eclipse/manifest.json");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function manifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

function svgMetadata(text, id) {
  assert(/^\s*<svg\b/.test(text), `${id}: source is not SVG`);
  const width = Number(text.match(/\bwidth="(\d+)"/)?.[1]);
  const height = Number(text.match(/\bheight="(\d+)"/)?.[1]);
  const viewBox = text.match(/\bviewBox="([^"]+)"/)?.[1];
  const assetId = text.match(/\bdata-asset-id="([^"]+)"/)?.[1];
  const background = text.match(/\bdata-background="([^"]+)"/)?.[1];
  return { width, height, viewBox, assetId, background };
}

async function check(config) {
  const approved = config.assets.filter((asset) => asset.approved);
  const ids = new Set();
  const outputs = new Set();
  for (const asset of approved) {
    assert(!ids.has(asset.id), `duplicate asset id ${asset.id}`);
    assert(!outputs.has(asset.output), `duplicate output ${asset.output}`);
    ids.add(asset.id);
    outputs.add(asset.output);
    const sourcePath = join(root, config.sourceRoot, asset.source);
    const bytes = await readFile(sourcePath);
    assert(hash(bytes) === asset.sha256, `${asset.id}: source hash mismatch`);
    const text = bytes.toString("utf8");
    const meta = svgMetadata(text, asset.id);
    assert(meta.width === asset.width && meta.height === asset.height,
      `${asset.id}: expected ${asset.width}x${asset.height}, received ${meta.width}x${meta.height}`);
    assert(meta.viewBox === `0 0 ${asset.width} ${asset.height}`, `${asset.id}: viewBox must match declared canvas`);
    assert(meta.assetId === asset.id, `${asset.id}: data-asset-id mismatch`);
    assert(meta.background === asset.background, `${asset.id}: data-background mismatch`);
    assert(!/<script\b/i.test(text), `${asset.id}: script elements are forbidden`);
    assert(!/https?:\/\//i.test(text.replace("http://www.w3.org/2000/svg", "")), `${asset.id}: external URLs are forbidden`);
    if (asset.background === "transparent") {
      assert(!/<rect[^>]+(?:width="100%"|width="(?:512|1024|1536|256)")[^>]+(?:height="100%"|height="(?:512|1024)")[^>]+fill="(?!none)/i.test(text),
        `${asset.id}: transparent asset contains a full-canvas fill`);
    }
    if (asset.grid) {
      assert(asset.width % asset.grid[0] === 0 && asset.height % asset.grid[1] === 0,
        `${asset.id}: dimensions do not divide into ${asset.grid[0]}x${asset.grid[1]}`);
      assert(text.includes(`data-grid="${asset.grid[0]}x${asset.grid[1]}"`), `${asset.id}: data-grid marker missing`);
    }
  }
  const masterDir = join(root, config.sourceRoot, "masters");
  const actual = (await readdir(masterDir)).filter((name) => name.endsWith(".svg")).sort();
  const declared = approved.map((asset) => asset.source.replace("masters/", "")).sort();
  assert(JSON.stringify(actual) === JSON.stringify(declared), "orphaned or undeclared SVG master detected");
  const pieces = approved.filter((asset) => asset.family === "checkers-pieces");
  assert(pieces.length === 4, "piece family must contain two factions and two ranks");
  assert(pieces.every((asset) => asset.width === 512 && asset.height === 512), "piece canvases must be identical");
  return approved;
}

async function build(config, outputRoot) {
  const approved = await check(config);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const records = [];
  for (const asset of approved) {
    const source = join(root, config.sourceRoot, asset.source);
    const output = join(outputRoot, asset.output);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(source, output);
    const bytes = await readFile(output);
    records.push({ id: asset.id, path: asset.output, bytes: bytes.length, sha256: hash(bytes) });
  }
  const manifestBytes = await readFile(manifestPath);
  const record = { schemaVersion: 1, tool: config.buildToolVersion, manifestSha256: hash(manifestBytes), outputs: records.sort((a,b) => a.path.localeCompare(b.path)) };
  await writeFile(join(outputRoot, "asset-build.json"), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

async function files(directory) {
  const result = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path); else result.push(relative(directory, path));
    }
  }
  await walk(directory);
  return result.sort();
}

async function verify(config) {
  const temporary = await mkdtemp(join(tmpdir(), "clockwork-svg-"));
  try {
    await build(config, temporary);
    const committed = join(root, config.outputRoot);
    const expectedFiles = await files(temporary);
    const committedFiles = await files(committed);
    assert(JSON.stringify(expectedFiles) === JSON.stringify(committedFiles), "committed derivative file set differs from clean build");
    for (const file of expectedFiles) {
      const expected = await readFile(join(temporary, file));
      const actual = await readFile(join(committed, file));
      assert(expected.equals(actual), `${file}: committed derivative differs from clean build`);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

const config = await manifest();
if (mode === "check") console.log(`Clockwork Eclipse asset check passed (${(await check(config)).length} SVG assets).`);
else if (mode === "build") console.log(`Clockwork Eclipse asset build wrote ${(await build(config, join(root, config.outputRoot))).outputs.length} assets.`);
else if (mode === "verify") { await verify(config); console.log("Clockwork Eclipse clean rebuild matches committed derivatives."); }
else throw new Error(`unknown asset mode ${mode}`);
