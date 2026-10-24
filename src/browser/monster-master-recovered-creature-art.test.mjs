import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const assetRoot = new URL("../../public/assets/monster-master/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", assetRoot), "utf8"));
const expected = [
  {
    key: "voidshard-reaver-v1",
    driveId: "1ecVgyOowdlj3UzN5GPwo5sDL_EcgFxmc",
    sourceSha256: "fa593deb9bf47bd18c5e57b429ad89c85bdf736205e1d3d2e8b76b94e9fc3497",
    runtimeSha256: "359570e2ab72b081110ccd3709ea8fdc6956a2a07bbf39de8e6bac3b8a922bb6",
  },
  {
    key: "mossmaw-colossus-v1",
    driveId: "15LHAhgyD1piJNOYaxGZWpT-hhIbOAyB5",
    sourceSha256: "0f83973bacb968339e5172ddea6b76044cf29594a921710ec2dac3520c603e0b",
    runtimeSha256: "c1fe2e4ce28282539636dbee213efd3364f7f0d94dffc221f91bd7a0874779ea",
  },
];

for (const record of expected) {
  test(`recovered ${record.key} is a real transparent 128x192 WebP with provenance`, async () => {
    const asset = manifest.creatures[record.key];
    assert.equal(asset.usage, "asset-library");
    assert.equal(Object.hasOwn(asset, "role"), false);
    assert.equal(asset.width, 128);
    assert.equal(asset.height, 192);
    assert.equal(asset.alpha, true);
    assert.equal(asset.provenance.sourceArchive, "private-gameframe-asset-masters");
    assert.equal(asset.provenance.sourceFileId, record.driveId);
    assert.equal(asset.provenance.sourceSha256, record.sourceSha256);
    assert.equal(asset.provenance.runtimeSha256, record.runtimeSha256);
    assert.match(asset.provenance.transform, /sharp@0\\.35\\.5/);

    const data = await readFile(new URL(asset.path.replace(/^\\//, ""), new URL("../../public/", import.meta.url)));
    // Refuse previous corruption types: ASCII base64 or a forged RIFF header.
    assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP");
    assert.equal(createHash("sha256").update(data).digest("hex"), record.runtimeSha256);
    const metadata = await sharp(data).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 128);
    assert.equal(metadata.height, 192);
    assert.equal(metadata.hasAlpha, true);
    const imageStats = await sharp(data).stats();
    assert.equal(imageStats.channels[3].min, 0);
    assert.ok(imageStats.channels[3].max > 0);
  });
}
