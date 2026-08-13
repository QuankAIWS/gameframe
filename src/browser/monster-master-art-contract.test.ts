import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Monster Master uses one authoritative controller with guarded Pixi delivery", async () => {
  const launcher = await read("public/auth-launcher.js");
  const monsterApp = await read("public/monster-master-app.js");
  const monsterShell = await read("public/monster-master-shell.js");
  const monsterArena = await read("public/monster-master.html");
  const trainerRuntime = await read("public/monster-master-trainer-asset.js");
  const trainerAsset = await readFile(new URL("../../public/assets/monster-master/trainers/master-trainer-v1-128.webp", import.meta.url));
  const gameframeNav = await read("public/gameframe-nav.js");
  const correction = await read("public/monster-master-correction.js");
  const overlay = await read("public/monster-master-overlay.js");
  const hints = await read("public/monster-master-hints.js");
  const battlefieldEffects = await read("public/monster-master-battlefield-effects.js");
  const gestures = await read("public/monster-master-gestures.js");
  const geometry = await read("src/browser/monster-master-terrain-geometry.js");
  const pixiSource = await read("src/browser/monster-master-pixi-entry.js");
  const pixiBridge = await read("public/monster-master-pixi-bridge.js");
  const pixiStyles = await read("public/monster-master-pixi.css");
  const pixiBundle = await read("public/monster-master-pixi-bundle.js");
  const legacyProjection = await read("public/monster-master-rotation.js");
  const notices = await read("THIRD_PARTY_NOTICES.md");
  const canonicalGameplay = await read("test/browser/monster-master.spec.mjs");
  const canonicalControls = await read("test/browser/monster-master-controls.spec.mjs");
  const canonicalMotion = await read("test/browser/motion-polish.spec.mjs");
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const creatureAtlas = await read("public/assets/monster-master/creature-atlas-v1.svg");
  const terrainAtlas = await read("public/assets/monster-master/terrain-atlas-v1.svg");
  const packageJson = JSON.parse(await read("package.json"));

  const monsterStart = launcher.indexOf('} else if (entry === "/monster-master-app.js")');
  const monsterEnd = launcher.indexOf("} else {", monsterStart);
  const monsterBranch = launcher.slice(monsterStart, monsterEnd);
  assert.ok(monsterStart >= 0 && monsterEnd > monsterStart);
  assert.match(monsterBranch, /legacy-renderer-fallback/);
  assert.match(monsterBranch, /useLegacyRenderer \? "legacy" : "pixi"/);
  assert.ok(monsterBranch.indexOf("monster-master-pixi-bridge.js") < monsterBranch.indexOf("monster-master-correction.js"));
  assert.ok(monsterBranch.indexOf("monster-master-overlay.js") < monsterBranch.indexOf("monster-master-hints.js"));
  assert.ok(monsterBranch.indexOf("monster-master-hints.js") < monsterBranch.indexOf("await import(entry)"));
  assert.ok(monsterBranch.indexOf("await import(entry)") < monsterBranch.indexOf("monster-master-pixi-bundle.js"));
  assert.ok(monsterBranch.indexOf("window.gameFrameMonsterPixi?.ready") < monsterBranch.indexOf("monster-master-battlefield-effects.js"));
  assert.ok(monsterBranch.indexOf("monster-master-battlefield-effects.js") < monsterBranch.indexOf("monster-master-gestures.js"));
  assert.match(monsterBranch, /sessionStorage\.setItem\(pixiFallbackKey, "true"\)/);
  assert.match(monsterBranch, /window\.location\.reload\(\)/);
  assert.match(monsterBranch, /monster-master-legacy-fallback/);
  assert.doesNotMatch(monsterBranch, /monster-master-overlay-guard\.js/);
  assert.doesNotMatch(monsterBranch, /monster-master-terrain-depth\.js/);

  assert.match(monsterArena, /monster-master-trainer-asset\.js/);
  assert.match(trainerRuntime, /const TRAINER_ASSET = "\/assets\/monster-master\/trainers\/master-trainer-v1-128\.webp"/);
  assert.match(trainerRuntime, /unit\.role === "master"/);
  assert.match(trainerRuntime, /gameFrameMonsterPixi/);
  assert.match(trainerRuntime, /worldToScreen/);
  assert.match(trainerRuntime, /gameFrameMonsterController/);
  assert.match(trainerRuntime, /monster-master-turn-portrait\[data-role="master"\]/);
  assert.equal(trainerAsset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(trainerAsset.subarray(8, 12).toString("ascii"), "WEBP");

  assert.match(monsterApp, /const monsterMasterViewEvent = "gameframe:monster-master-pixi-view"/);
  assert.match(monsterApp, /window\.gameFrameMonsterController = Object\.freeze/);
  assert.match(monsterApp, /getView: \(\) => current/);
  assert.match(monsterApp, /handleCoordinate: \(coordinate\) => handleBattlefieldCoordinate/);
  assert.match(monsterApp, /new CustomEvent\(monsterMasterViewEvent/);
  assert.match(monsterApp, /if \(window\.gameFrameMonsterRendererMode === "pixi"\) \{\n    renderDiagnostics\(\);\n    return;/);
  assert.match(monsterApp, /window\.gameFrameMonsterLegacyDrawCount/);

  assert.match(gameframeNav, /gameframe:destination-bar-ready/);
  assert.match(monsterShell, /setupButton\.id = "monster-master-new-match"/);
  assert.match(monsterShell, /destinationLinks\.insertBefore\(setupButton/);
  assert.match(monsterShell, /replaceAll\("Warden Master", "Verdant Sage"\)/);

  for (const presentation of [correction, overlay]) {
    assert.match(presentation, /const monsterViewEvent = "gameframe:monster-master-pixi-view"/);
    assert.match(presentation, /window\.addEventListener\(monsterViewEvent/);
    assert.match(presentation, /window\.gameFrameMonsterController\?\.getView/);
    assert.doesNotMatch(presentation, /window\.fetch = async/);
  }
  assert.doesNotMatch(correction, /CanvasRenderingContext2D\.prototype/);

  assert.match(hints, /gameframe:monster-master:hints-enabled/);
  assert.match(hints, /monster-master-status-toast/);
  assert.match(hints, /window\.gameFrameMonsterHints = Object\.freeze/);

  assert.match(battlefieldEffects, /const VIEW_EVENT = "gameframe:monster-master-pixi-view"/);
  assert.match(battlefieldEffects, /unit-moved/);
  assert.match(battlefieldEffects, /unit-damaged/);
  assert.match(battlefieldEffects, /unit-healed/);
  assert.match(battlefieldEffects, /unit-defeated/);
  assert.match(battlefieldEffects, /worldToScreen/);
  assert.match(battlefieldEffects, /data-last-animation-steps|lastAnimationSteps/);
  assert.match(battlefieldEffects, /window\.gameFrameMonsterBattlefieldEffects/);

  assert.match(gestures, /touches = new Map/);
  assert.match(gestures, /gameFrameMonsterPixiBridge\?\.panScreen/);
  assert.match(gestures, /monster-master-zoom-in/);
  assert.match(gestures, /monster-master-zoom-out/);
  assert.match(gestures, /window\.gameFrameMonsterGestures/);

  assert.match(geometry, /export const TILE_WIDTH = 72/);
  assert.match(geometry, /export const TILE_HEIGHT = 36/);
  assert.match(geometry, /export const WALL_VISUAL_HEIGHT = 29/);
  assert.match(geometry, /export function projectCoordinate/);
  assert.match(geometry, /export function inverseProjectPoint/);
  assert.match(geometry, /export function exposedTerrainFaces/);
  assert.match(geometry, /export function mapSurfacePolygon/);
  assert.match(geometry, /export function screenVectorToCameraDelta/);

  assert.match(pixiSource, /from "pixi\.js"/);
  assert.match(pixiSource, /from "\.\/monster-master-terrain-geometry\.js"/);
  assert.match(pixiSource, /preference: "webgl"/);
  assert.match(pixiSource, /autoStart: false/);
  assert.match(pixiSource, /resolution: Math\.min/);
  assert.match(pixiSource, /worldObjects\.sortableChildren = true/);
  assert.match(pixiSource, /mapSurfacePolygon/);
  assert.match(pixiSource, /exposedTerrainFaces/);
  assert.match(pixiSource, /depthIndex/);
  assert.match(pixiSource, /getTerrainStats/);
  assert.match(pixiSource, /getGeometrySnapshot/);
  assert.match(pixiSource, /setGeometryDebug/);
  assert.match(pixiSource, /function subscribeToController/);
  assert.match(pixiSource, /requestAnimationFrame\(render\)/);
  assert.match(pixiSource, /window\.gameFrameMonsterPixi/);
  assert.doesNotMatch(pixiSource, /window\.fetch = async/);
  assert.doesNotMatch(pixiSource, /TILE_WIDTH \* 1\.04/);
  assert.doesNotMatch(pixiSource, /TILE_HEIGHT \* 1\.85/);
  assert.doesNotMatch(pixiSource, /TILE_HEIGHT \* 2\.25/);

  assert.match(pixiBridge, /^window\.gameFrameMonsterRendererMode = "pixi";/);
  assert.match(pixiBridge, /controller\?\.handleCoordinate/);
  assert.match(pixiBridge, /currentRenderer\.screenToTile/);
  assert.match(pixiBridge, /renderer\(\)\?\.worldToScreen/);
  assert.match(pixiBridge, /renderer\(\)\?\.panScreen/);
  assert.match(pixiBridge, /function bindBattlefieldInput/);
  assert.match(pixiBridge, /pointerdown/);
  assert.match(pixiBridge, /window\.gameFrameMonsterProjection/);
  assert.doesNotMatch(pixiBridge, /const TILE_WIDTH/);
  assert.doesNotMatch(pixiBridge, /function rotateCoordinate/);
  assert.doesNotMatch(pixiBridge, /function project\(/);
  assert.match(pixiStyles, /monster-master-pixi-canvas/);
  assert.match(pixiStyles, /monster-master-legacy-canvas/);
  assert.match(pixiStyles, /visibility: hidden/);
  assert.match(pixiBundle, /Generated by scripts\/build-monster-master-pixi\.mjs; PixiJS 8\.19\.0/);
  assert.match(legacyProjection, /LegacyProjection = Object\.freeze\(\{ disabled: true \}\)/);

  for (const journey of [canonicalGameplay, canonicalMotion]) {
    assert.match(journey, /monster-master-pixi-canvas|gameFrameMonsterPixi/);
    assert.doesNotMatch(journey, /locator\("#monster-master-canvas"\)/);
    assert.doesNotMatch(journey, /gameFrameMonsterProjection\.setRotation/);
  }
  assert.match(canonicalControls, /monster-master-pixi-canvas/);
  assert.match(canonicalControls, /legacy-renderer-fallback/);
  assert.match(canonicalControls, /monster-master-legacy-fallback/);
  assert.match(canonicalControls, /locator\("#monster-master-canvas"\)/);
  assert.match(canonicalMotion, /pointerType: "touch"/);
  assert.match(canonicalGameplay, /data-last-effect-types/);

  assert.match(notices, /## PixiJS/);
  assert.match(notices, /Version: `8\.19\.0`/);
  assert.match(notices, /License: MIT/);
  assert.match(notices, /public\/monster-master-pixi-bundle\.js/);

  assert.match(creatureAtlas, /data:image\/webp;base64,/);
  assert.doesNotMatch(terrainAtlas, /data:image\//);
  assert.match(terrainAtlas, /linearGradient id="grass-a"/);
  assert.match(terrainAtlas, /linearGradient id="stone-top"/);
  assert.equal(manifest.version, 3);
  assert.equal(manifest.trainerAssets["master-trainer-v1"].role, "master");
  assert.equal(manifest.trainerAssets["master-trainer-v1"].usage, "standalone-arena");
  assert.equal(manifest.trainerAssets["master-trainer-v1"].path, "/assets/monster-master/trainers/master-trainer-v1-128.webp");
  assert.equal(manifest.creatures["warden-master-v1"].role, "master");
  assert.equal(manifest.terrain["floor-a"].semantic, "floor");
  assert.equal(manifest.terrain["wall-rubble-a"].semantic, "wall");

  assert.equal(packageJson.dependencies["pixi.js"], "8.19.0");
  assert.match(packageJson.scripts.validate, /check:monster-master-pixi/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-pixi-bundle\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-battlefield-effects\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-gestures\.js/);
  assert.match(packageJson.scripts["check:browser"], /src\/browser\/monster-master-terrain-geometry\.js/);
  assert.doesNotMatch(packageJson.scripts["check:browser"], /monster-master-terrain-depth/);
  assert.doesNotMatch(packageJson.scripts["check:browser"], /monster-master-overlay-guard/);
});
