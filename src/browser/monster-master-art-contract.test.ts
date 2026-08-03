import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Monster Master loads deterministic generated creature art before the gameplay client", async () => {
  const launcher = await read("public/auth-launcher.js");
  const renderer = await read("public/monster-master-art.js");
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const atlas = await read("public/assets/monster-master/creature-atlas-v1.svg");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(launcher, /entry === "\/monster-master-app\.js"/);
  assert.ok(launcher.indexOf("monster-master-art.js") < launcher.indexOf("await import(entry)"));
  assert.match(renderer, /creature-atlas-v1\.svg/);
  assert.match(renderer, /CanvasRenderingContext2D\.prototype\.fillText/);
  assert.match(renderer, /this\.canvas\?\.id !== "monster-master-canvas"/);
  assert.match(renderer, /CanvasRenderingContext2D\.prototype\.fill/);
  assert.match(renderer, /monster-master-motion-canvas/);
  assert.match(renderer, /function projectedCreature/);
  assert.match(renderer, /context\.drawImage/);
  assert.match(renderer, /context\.scale\(-1, 1\)/);
  assert.match(renderer, /if \(projected && atlasReady\)/);
  assert.match(renderer, /return nativeFill\.apply\(this, args\)/);
  assert.match(renderer, /monster-master-unit-hud/);
  assert.match(atlas, /data:image\/webp;base64,/);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.creatures["warden-master-v1"].role, "master");
  assert.equal(manifest.creatures["stone-bulwark-v1"].role, "bulwark");
  assert.equal(manifest.creatures["emberling-skirmisher-v1"].role, "emberling");
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-art\.js/);
});
