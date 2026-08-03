import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Monster Master uses one authoritative controller and one on-demand Pixi renderer", async () => {
  const launcher = await read("public/auth-launcher.js");
  const monsterApp = await read("public/monster-master-app.js");
  const monsterShell = await read("public/monster-master-shell.js");
  const correction = await read("public/monster-master-correction.js");
  const overlay = await read("public/monster-master-overlay.js");
  const pixiSource = await read("src/browser/monster-master-pixi-entry.js");
  const pixiBridge = await read("public/monster-master-pixi-bridge.js");
  const pixiStyles = await read("public/monster-master-pixi.css");
  const pixiBundle = await read("public/monster-master-pixi-bundle.js");
  const legacyProjection = await read("public/monster-master-rotation.js");
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const creatureAtlas = await read("public/assets/monster-master/creature-atlas-v1.svg");
  const terrainAtlas = await read("public/assets/monster-master/terrain-atlas-v1.svg");
  const packageJson = JSON.parse(await read("package.json"));

  const monsterStart = launcher.indexOf('} else if (entry === "/monster-master-app.js")');
  const monsterEnd = launcher.indexOf("} else {", monsterStart);
  const monsterBranch = launcher.slice(monsterStart, monsterEnd);
  assert.ok(monsterStart >= 0 && monsterEnd > monsterStart);
  assert.ok(monsterBranch.indexOf("monster-master-pixi-bridge.js") < monsterBranch.indexOf("monster-master-correction.js"));
  assert.ok(monsterBranch.indexOf("monster-master-overlay.js") < monsterBranch.indexOf("await import(entry)"));
  assert.ok(monsterBranch.indexOf("await import(entry)") < monsterBranch.indexOf("monster-master-pixi-bundle.js"));
  assert.doesNotMatch(monsterBranch, /monster-master-overlay-guard\.js/);
  assert.doesNotMatch(monsterBranch, /monster-master-art\.js/);
  assert.doesNotMatch(monsterBranch, /monster-master-terrain\.js/);
  assert.doesNotMatch(monsterBranch, /monster-master-polish\.js/);

  assert.match(monsterApp, /const monsterMasterViewEvent = "gameframe:monster-master-pixi-view"/);
  assert.match(monsterApp, /window\.gameFrameMonsterController = Object\.freeze/);
  assert.match(monsterApp, /getView: \(\) => current/);
  assert.match(monsterApp, /handleCoordinate: \(coordinate\) => handleBattlefieldCoordinate/);
  assert.match(monsterApp, /new CustomEvent\(monsterMasterViewEvent/);
  assert.match(monsterApp, /function renderDiagnostics\(layout = null\)/);
  assert.match(monsterApp, /if \(window\.gameFrameMonsterRendererMode === "pixi"\) \{\n    renderDiagnostics\(\);\n    return;/);
  assert.match(monsterApp, /window\.gameFrameMonsterLegacyDrawCount/);

  assert.match(monsterShell, /if \(window\.gameFrameMonsterRendererMode === "pixi"\) return/);
  assert.match(monsterShell, /if \(window\.gameFrameMonsterRendererMode === "pixi"\) \{\n    updateShellState\(\);\n    return;/);

  for (const presentation of [correction, overlay]) {
    assert.match(presentation, /const monsterViewEvent = "gameframe:monster-master-pixi-view"/);
    assert.match(presentation, /window\.addEventListener\(monsterViewEvent/);
    assert.match(presentation, /window\.gameFrameMonsterController\?\.getView/);
    assert.doesNotMatch(presentation, /window\.fetch = async/);
    assert.doesNotMatch(presentation, /class MonsterMaster.*Socket extends/);
  }
  assert.doesNotMatch(correction, /installCanvasColorRemap/);
  assert.doesNotMatch(correction, /CanvasRenderingContext2D\.prototype/);

  assert.match(pixiSource, /from "pixi\.js"/);
  assert.match(pixiSource, /preference: "webgl"/);
  assert.match(pixiSource, /autoStart: false/);
  assert.match(pixiSource, /resolution: Math\.min/);
  assert.match(pixiSource, /viewSignature/);
  assert.match(pixiSource, /diagnosticsSignature/);
  assert.match(pixiSource, /function subscribeToController/);
  assert.match(pixiSource, /window\.gameFrameMonsterController\?\.getView/);
  assert.doesNotMatch(pixiSource, /function interceptState/);
  assert.doesNotMatch(pixiSource, /window\.fetch = async/);
  assert.match(pixiSource, /const ready = initialize\(\)\.then/);
  assert.match(pixiSource, /const width = Math\.max\(1, state\.frame\.clientWidth\)/);
  assert.match(pixiSource, /state\.app\.renderer\.resize\(Math\.max\(1, frame\.clientWidth\)/);
  assert.doesNotMatch(pixiSource, /renderer\.width \/ 2/);
  assert.match(pixiSource, /creature-atlas-v1\.svg/);
  assert.match(pixiSource, /terrain-atlas-v1\.svg/);
  assert.match(pixiSource, /const terrain = new Container/);
  assert.match(pixiSource, /const highlights = new Graphics/);
  assert.match(pixiSource, /const unitsLayer = new Container/);
  assert.match(pixiSource, /function terrainSignature/);
  assert.match(pixiSource, /function unitSignature/);
  assert.match(pixiSource, /requestAnimationFrame\(render\)/);
  assert.match(pixiSource, /window\.gameFrameMonsterPixi/);

  assert.match(pixiBridge, /^window\.gameFrameMonsterRendererMode = "pixi";/);
  assert.match(pixiBridge, /monster-master-pixi\.css/);
  assert.match(pixiBridge, /controller\?\.handleCoordinate/);
  assert.match(pixiBridge, /renderer\.screenToTile/);
  assert.match(pixiBridge, /function dispatchCoordinate/);
  assert.doesNotMatch(pixiBridge, /dispatchLegacyCoordinate/);
  assert.match(pixiBridge, /window\.gameFrameMonsterProjection/);
  assert.match(pixiStyles, /monster-master-pixi-canvas/);
  assert.match(pixiStyles, /monster-master-legacy-canvas/);
  assert.match(pixiStyles, /visibility: hidden/);
  assert.match(pixiBundle, /Generated by scripts\/build-monster-master-pixi\.mjs; PixiJS 8\.19\.0/);
  assert.match(legacyProjection, /LegacyProjection = Object\.freeze\(\{ disabled: true \}\)/);

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

  assert.equal(packageJson.dependencies["pixi.js"], "8.19.0");
  assert.equal(packageJson.scripts["build:monster-master-pixi"], "node scripts/build-monster-master-pixi.mjs");
  assert.equal(packageJson.scripts["check:monster-master-pixi"], "node scripts/build-monster-master-pixi.mjs --check");
  assert.match(packageJson.scripts.validate, /check:monster-master-pixi/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-pixi-bundle\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-pixi-bridge\.js/);
  assert.doesNotMatch(packageJson.scripts["check:browser"], /monster-master-overlay-guard/);
});
