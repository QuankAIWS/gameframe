import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("board-game presentation polish is loaded before the authoritative browser client", async () => {
  const html = await read("public/index.html");
  const script = await read("public/game-polish.js");
  const styles = await read("public/game-polish.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /href="\/game-polish\.css"/);
  assert.match(html, /src="\/game-polish\.js"/);
  assert.ok(html.indexOf("/game-polish.js") < html.indexOf("/auth-launcher.js"));
  assert.match(script, /id = "game-outcome-overlay"/);
  assert.match(script, /game-outcome-rematch/);
  assert.match(script, /reconstructJumpPath/);
  assert.match(script, /gameframe:checkers-animation/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(styles, /\.game-outcome-overlay/);
  assert.match(styles, /\.board\.is-animating/);
  assert.match(packageJson.scripts["check:browser"], /public\/game-polish\.js/);
});

test("Monster Master disables the legacy Canvas projection and uses the Pixi bridge", async () => {
  const html = await read("public/monster-master.html");
  const legacyProjection = await read("public/monster-master-rotation.js");
  const pixiBridge = await read("public/monster-master-pixi-bridge.js");
  const pixiEntry = await read("src/browser/monster-master-pixi-entry.js");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /src="\/monster-master-rotation\.js"/);
  assert.ok(html.indexOf("/monster-master-rotation.js") < html.indexOf("/auth-launcher.js"));
  assert.match(html, /Scrollable and rotatable Monster Master battlefield/);

  assert.match(legacyProjection, /legacy Canvas projection is intentionally disabled/);
  assert.match(legacyProjection, /gameFrameMonsterLegacyProjection/);
  assert.match(legacyProjection, /disabled: true/);
  assert.doesNotMatch(legacyProjection, /function worldToScreen/);
  assert.doesNotMatch(legacyProjection, /\/api\/matches\/.*actions/);

  assert.match(pixiBridge, /gameFrameMonsterRendererMode = "pixi"/);
  assert.match(pixiBridge, /function worldToScreen/);
  assert.match(pixiBridge, /function unrotateDelta/);
  assert.match(pixiBridge, /function dispatchCoordinate/);
  assert.match(pixiBridge, /pointerdown/);
  assert.match(pixiBridge, /function wheel/);
  assert.match(pixiBridge, /gameFrameMonsterPixi/);
  assert.doesNotMatch(pixiBridge, /\/api\/matches\/.*actions/);

  assert.match(pixiEntry, /from "pixi\.js"/);
  assert.match(pixiEntry, /Application/);
  assert.match(pixiEntry, /gameFrameMonsterRendererMode = "pixi"/);
  assert.match(pixiEntry, /gameframe:monster-master-pixi-view/);
  assert.match(packageJson.scripts["build:monster-master-pixi"], /build-monster-master-pixi\.mjs/);
  assert.match(packageJson.scripts["check:monster-master-pixi"], /--check/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-pixi-bridge\.js/);
});

test("Monster Master uses a viewport-filling shell with a contextual HUD and command deck", async () => {
  const html = await read("public/monster-master.html");
  const script = await read("public/monster-master-shell.js");
  const styles = await read("public/monster-master-shell.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /href="\/monster-master-shell\.css"/);
  assert.match(html, /src="\/monster-master-shell\.js"/);
  assert.ok(html.indexOf("/monster-master-shell.js") < html.indexOf("/monster-master-rotation.js"));
  assert.ok(html.indexOf("/monster-master-shell.js") < html.indexOf("/auth-launcher.js"));
  assert.match(html, /id="monster-master-unit-hud"/);
  assert.match(html, /class="monster-master-command-deck"/);
  assert.match(html, /id="monster-master-open-roster"/);
  assert.match(html, /id="monster-master-open-intel"/);
  assert.match(html, /data-hotkey="1"/);
  assert.match(html, /data-hotkey="5"/);
  assert.match(script, /monster-master-match-active/);
  assert.match(script, /const actionShortcuts = new Map/);
  assert.match(script, /new MutationObserver/);
  assert.match(script, /function syncHud/);
  assert.match(script, /function openDrawer/);
  assert.match(script, /window\.gameFrameMonsterShell/);
  assert.doesNotMatch(script, /window\.fetch\s*=/);
  assert.doesNotMatch(script, /\/api\/matches\/.*actions/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /overflow: hidden/);
  assert.match(styles, /\.monster-master-game-grid/);
  assert.match(styles, /\.monster-master-command-deck/);
  assert.match(styles, /\.monster-master-unit-hud/);
  assert.match(styles, /monster-master-roster-open/);
  assert.match(styles, /monster-master-intel-open/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-shell\.js/);
});
