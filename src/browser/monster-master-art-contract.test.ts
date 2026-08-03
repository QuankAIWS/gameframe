import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Monster Master loads deterministic generated art and integrated polish before gameplay", async () => {
  const launcher = await read("public/auth-launcher.js");
  const creatureRenderer = await read("public/monster-master-art.js");
  const terrainRenderer = await read("public/monster-master-terrain.js");
  const polishRenderer = await read("public/monster-master-polish.js");
  const polishStyles = await read("public/monster-master-polish.css");
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const creatureAtlas = await read("public/assets/monster-master/creature-atlas-v1.svg");
  const terrainAtlas = await read("public/assets/monster-master/terrain-atlas-v1.svg");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(launcher, /entry === "\/monster-master-app\.js"/);
  assert.ok(launcher.indexOf("monster-master-art.js") < launcher.indexOf("monster-master-terrain.js"));
  assert.ok(launcher.indexOf("monster-master-terrain.js") < launcher.indexOf("monster-master-polish.js"));
  assert.ok(launcher.indexOf("monster-master-polish.js") < launcher.indexOf("await import(entry)"));

  assert.match(creatureRenderer, /creature-atlas-v1\.svg/);
  assert.match(creatureRenderer, /CanvasRenderingContext2D\.prototype\.fillText/);
  assert.match(creatureRenderer, /this\.canvas\?\.id !== "monster-master-canvas"/);
  assert.match(creatureRenderer, /CanvasRenderingContext2D\.prototype\.fill/);
  assert.match(creatureRenderer, /monster-master-motion-canvas/);
  assert.match(creatureRenderer, /function projectedCreature/);
  assert.match(creatureRenderer, /context\.drawImage/);
  assert.match(creatureRenderer, /context\.scale\(-1, 1\)/);
  assert.match(creatureRenderer, /if \(projected && atlasReady\)/);
  assert.match(creatureRenderer, /return nativeFill\.apply\(this, args\)/);
  assert.match(creatureRenderer, /monster-master-unit-hud/);

  assert.match(terrainRenderer, /terrain-atlas-v1\.svg/);
  assert.match(terrainRenderer, /projectedTerrainByFill/);
  assert.match(terrainRenderer, /squareTerrainByFill/);
  assert.match(terrainRenderer, /CanvasRenderingContext2D\.prototype\.fillRect/);
  assert.match(terrainRenderer, /this\.canvas\?\.id === "monster-master-motion-canvas"/);
  assert.match(terrainRenderer, /this\.clip\(\)/);
  assert.match(terrainRenderer, /entry\.objective/);
  assert.match(terrainRenderer, /return previousFill\.apply\(this, args\)/);
  assert.match(terrainRenderer, /return previousFillRect\.call\(this, x, y, width, height\)/);

  assert.match(polishRenderer, /monster-master-polish\.css/);
  assert.match(polishRenderer, /function decorateRoster/);
  assert.match(polishRenderer, /monster-master-roster-portrait/);
  assert.match(polishRenderer, /dataset\.monsterMasterState/);
  assert.match(polishRenderer, /dataset\.healthState/);
  assert.match(polishRenderer, /new MutationObserver/);
  assert.match(polishStyles, /VERDANT CALDERA/);
  assert.match(polishStyles, /COMMAND RING/);
  assert.match(polishStyles, /monster-master-roster-portrait/);
  assert.match(polishStyles, /data-health-state="critical"/);
  assert.match(polishStyles, /data-action="attack"/);

  assert.match(creatureAtlas, /data:image\/webp;base64,/);
  assert.match(terrainAtlas, /data:image\/webp;base64,/);
  assert.equal(manifest.version, 2);
  assert.equal(manifest.creatures["warden-master-v1"].role, "master");
  assert.equal(manifest.creatures["stone-bulwark-v1"].role, "bulwark");
  assert.equal(manifest.creatures["emberling-skirmisher-v1"].role, "emberling");
  assert.equal(manifest.terrain["floor-a"].semantic, "floor");
  assert.equal(manifest.terrain["difficult-rootstone"].semantic, "difficult");
  assert.equal(manifest.terrain["wall-rubble-a"].semantic, "wall");
  assert.equal(manifest.terrain["central-command-shrine"].semantic, "objective");
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-art\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-terrain\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-polish\.js/);
});
