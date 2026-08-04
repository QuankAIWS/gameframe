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

test("Monster Master uses the Pixi four-corner dimetric projection while the legacy Canvas projection stays disabled", async () => {
  const html = await read("public/monster-master.html");
  const legacyRotation = await read("public/monster-master-rotation.js");
  const pixiRenderer = await read("src/browser/monster-master-pixi-entry.js");
  const baseStyles = await read("public/monster-master-motion.css");
  const rotationStyles = await read("public/monster-master-rotation.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /href="\/monster-master-motion\.css"/);
  assert.match(html, /href="\/monster-master-rotation\.css"/);
  assert.match(html, /src="\/monster-master-rotation\.js"/);
  assert.ok(html.indexOf("/monster-master-rotation.js") < html.indexOf("/auth-launcher.js"));
  assert.doesNotMatch(html, /src="\/monster-master-motion\.js"/);
  assert.match(html, /Scrollable and rotatable Monster Master battlefield/);

  assert.match(legacyRotation, /legacy Canvas projection is intentionally disabled/i);
  assert.match(legacyRotation, /gameFrameMonsterLegacyProjection/);
  assert.match(legacyRotation, /disabled: true/);
  assert.doesNotMatch(legacyRotation, /function worldToScreen/);

  assert.match(pixiRenderer, /function worldToScreen/);
  assert.match(pixiRenderer, /function screenToWorld/);
  assert.match(pixiRenderer, /function screenToTile/);
  assert.match(pixiRenderer, /function rotate\(delta\)/);
  assert.match(pixiRenderer, /normalizeQuarter/);
  assert.match(pixiRenderer, /screenVectorToCameraDelta/);
  assert.match(pixiRenderer, /const names = \["Northwest", "Northeast", "Southeast", "Southwest"\]/);
  assert.match(pixiRenderer, /function dispatchCoordinate/);
  assert.match(pixiRenderer, /pointermove/);
  assert.match(pixiRenderer, /addEventListener\("wheel"/);
  assert.match(pixiRenderer, /window\.gameFrameMonsterPixi/);
  assert.doesNotMatch(pixiRenderer, /\/api\/matches\/.*actions/);

  assert.match(baseStyles, /data-projection-ready/);
  assert.match(baseStyles, /#monster-master-motion-canvas/);
  assert.match(rotationStyles, /ROTATABLE 3\/4 VIEW/);
  assert.match(rotationStyles, /monster-master-rotation-controls/);
  assert.match(rotationStyles, /data-rotating/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-rotation\.js/);
  assert.match(packageJson.scripts["check:browser"], /src\/browser\/monster-master-pixi-entry\.js/);
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