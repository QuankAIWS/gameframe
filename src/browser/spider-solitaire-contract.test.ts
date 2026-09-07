import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Spider Solitaire is a GameFrame-local deterministic game with resumable browser play", async () => {
  const sourceEngine = await read("src/games/spider-solitaire/engine.js");
  const browserEngine = await read("public/spider-solitaire-engine.js");
  const html = await read("public/spider-solitaire.html");
  const browser = await read("public/spider-solitaire.js");
  const styles = await read("public/spider-solitaire.css");
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
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /is-valid-destination/);

  assert.match(hub, /id: "spider-solitaire"/);
  assert.match(hub, /href: "\/spider-solitaire\.html"/);
  assert.match(navigation, /SPIDER SOLITAIRE/);
  assert.match(packageJson.scripts["check:spider-solitaire"], /--check/);
  assert.match(packageJson.scripts["check:browser"], /public\/spider-solitaire\.js/);
});
