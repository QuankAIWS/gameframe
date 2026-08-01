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

test("Monster Master movement polish consumes exact movement effects without changing game authority", async () => {
  const html = await read("public/monster-master.html");
  const script = await read("public/monster-master-motion.js");
  const styles = await read("public/monster-master-motion.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /href="\/monster-master-motion\.css"/);
  assert.match(html, /src="\/monster-master-motion\.js"/);
  assert.ok(html.indexOf("/monster-master-motion.js") < html.indexOf("/auth-launcher.js"));
  assert.match(script, /effect\.type !== "unit-moved"/);
  assert.match(script, /effect\.path/);
  assert.match(script, /gameframe:monster-animation/);
  assert.match(script, /prefers-reduced-motion/);
  assert.doesNotMatch(script, /\/api\/matches\/.*actions/);
  assert.match(styles, /#monster-master-motion-canvas/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-motion\.js/);
});
