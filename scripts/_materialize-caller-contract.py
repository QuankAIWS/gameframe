from pathlib import Path

path = Path('src/games/monster-master/repository-contract.test.ts')
text = path.read_text()
marker = 'Caller is an unassigned Monster Master trainer asset-library archetype'
if marker not in text:
    block = r'''

test("Caller is an unassigned Monster Master trainer asset-library archetype", async () => {
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const asset = await readBytes("public/assets/monster-master/trainers/caller-trainer-v1-128.webp");
  const caller = manifest.trainerAssets["caller-trainer-v1"];

  assert.ok(manifest.sources.includes("approved-caller-trainer-isometric-master-v1"));
  assert.equal(caller.label, "Caller");
  assert.equal(caller.archetype, "caller");
  assert.equal(caller.path, "/assets/monster-master/trainers/caller-trainer-v1-128.webp");
  assert.equal(caller.width, 128);
  assert.equal(caller.height, 192);
  assert.equal(caller.alpha, true);
  assert.equal(caller.usage, "asset-library");
  assert.equal(caller.assignment, "unassigned");
  assert.equal(caller.facing, "left");
  assert.equal(caller.perspective, "three-quarter-down-isometric");
  assert.deepEqual(caller.anchor, { x: 0.5, y: 0.9 });
  assert.equal(caller.battlefieldScale, 1.0);
  assert.equal(Object.hasOwn(caller, "role"), false);
  assert.equal(caller.provenance.provider, "OpenAI ChatGPT image generation");
  assert.equal(caller.provenance.sourceArchive, "private-gameframe-asset-masters");
  assert.equal(caller.provenance.sourceSha256, "36ae023f67da762947755514b797bce82e51e9e6268bdec83ce621b6bb80490d");
  assert.equal(caller.provenance.runtimeSha256, "d5e1d9291ac28f6f63e56cd5304ed010ca85b3bc23dae9562d4826051da4dc34");
  assert.equal(caller.provenance.attributionRequired, false);
  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
  assert.equal(createHash("sha256").update(asset).digest("hex"), caller.provenance.runtimeSha256);
});
'''
    path.write_text(text.rstrip() + block + '\n')
