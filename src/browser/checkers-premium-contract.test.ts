import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("premium Checkers presentation uses modular pre-rendered assets without replacing authority", async () => {
  const html = await read("public/index.html");
  const polish = await read("public/game-polish.js");
  const script = await read("public/checkers-premium.js");
  const styles = await read("public/checkers-premium.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /src="\/game-polish\.js"/);
  assert.match(polish, /import "\.\/checkers-premium\.js"/);
  assert.match(script, /premiumStylesheetHref = "\/checkers-premium\.css"/);
  assert.match(script, /checkers-premium-active/);
  assert.match(script, /function updateCheckersPresentation/);
  assert.match(script, /function renderCapturedSummary/);
  assert.match(script, /checkers-outcome-overlay/);
  assert.match(script, /new MutationObserver/);
  assert.doesNotMatch(script, /window\.fetch\s*=/);
  assert.doesNotMatch(script, /new WebSocket/);
  assert.doesNotMatch(script, /\/api\/matches\/.*actions/);
  assert.match(styles, /assets\/checkers\/board-frame\.webp/);
  assert.match(styles, /assets\/checkers\/board-surface\.webp/);
  assert.match(styles, /assets\/checkers\/checkers-atlas\.webp/);
  assert.match(styles, /background-position:100% 0%/);
  assert.match(styles, /\.checkers-intel-rail/);
  assert.match(styles, /\.checkers-board-shell/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(packageJson.scripts["check:browser"], /public\/checkers-premium\.js/);
});
