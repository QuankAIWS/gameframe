import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Spider Solitaire is a GameFrame-local deterministic game with resumable browser play", async () => {
  const sourceEngine = await read("src/games/spider-solitaire/engine.js");
  const browserEngine = await read("public/spider-solitaire-engine.js");
  const html = await read("public/spider-solitaire.html");
  const browser = await read("public/spider-solitaire.js");
  const progressionSync = await read("public/spider-progression-sync.js");
  const styles = await read("public/spider-solitaire.css");\n  const cardTableTheme = await read("public/card-table-theme.css");
  const hub = await read("public/game-hub.js");
  const navigation = await read("public/gameframe-nav.js");
  const packageJson = JSON.parse(await read("package.json"));

  assert.equal(browserEngine, sourceEngine);
  assert.match(sourceEngine, /SPIDER_GAME_ID = "spider-solitaire"/);
  assert.match(sourceEngine, /difficulty === 1/);
  assert.match(sourceEngine, /difficulty === 2/);
  assert.match(sourceEngine, /SPIDER_WIN_RUNS = 8/);
  assert.match(sourceEngine, /Fill every empty column before dealing from stock/);
  assert.match(sourceEngine, /completedRunAtTop/);

  assert.match(html, /Spider Solitaire/);
  assert.match(html, /id="spider-board"/);
  assert.match(html, /id="deal-stock"/);
  assert.match(html, /src="\/gameframe-nav\.js"/);
  assert.match(html, /src="\/spider-solitaire\.js"/);
  assert.match(browser, /scribbles-gameframe\.spider-solitaire:v1/);
  assert.match(browser, /localStorage/);
  assert.match(browser, /restartSameDeal/);
  assert.match(browser, /dragstart/);
  assert.match(browser, /validSpiderDestinations/);
  assert.match(browser, /queueSpiderProgression/);
  assert.match(progressionSync, /\/api\/me\/spider\/progression/);
  assert.match(progressionSync, /spider-progression-pending:v1/);
  assert.match(progressionSync, /tryGameFrameIdentity/);
  assert.match(html, /id="win-progression"/);
  assert.match(html, /href="\/card-kit\.css"/);
  assert.match(browser, /from "\.\/card-kit\.js"/);
  assert.match(styles, /html, body \{[\s\S]*overflow: hidden/);
  assert.match(styles, /is-valid-destination/);\n  assert.match(styles, /var\\(--card-table-felt\\)/);\n  assert.match(styles, /prefers-reduced-motion/);\n  assert.match(styles, /content: "♠"/);\n  assert.match(cardTableTheme, /card-table-theme-classic-plus/);\n  assert.match(cardTableTheme, /--card-table-cream: #f7f2e6/);\n  assert.match(cardTableTheme, /--card-table-focus: #ffe17a/);

  assert.match(hub, /id: "spider-solitaire"/);
  assert.match(hub, /href: "\/spider-solitaire\.html"/);
  assert.match(navigation, /SPIDER SOLITAIRE/);
  assert.match(packageJson.scripts["check:spider-solitaire"], /--check/);
  assert.match(packageJson.scripts["check:browser"], /public\/spider-progression-sync\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/spider-solitaire\.js/);
});
