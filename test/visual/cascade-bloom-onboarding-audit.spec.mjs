import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";

const PRE_BLOOM_TUTORIALS_SEEN = Object.freeze({
  match: true,
  stripe: true,
  bomb: true,
  combo: true,
  color: true,
  ice: true,
  collect: true,
  "layered-ice": true,
  hammer: true,
  weekly: true,
});

async function openLevel753(page) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ stateKey, tutorialKey, seen }) => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen }));
    localStorage.setItem(stateKey, JSON.stringify({
      level: 753,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { stateKey: STATE_KEY, tutorialKey: TUTORIAL_KEY, seen: PRE_BLOOM_TUTORIALS_SEEN });

  await page.goto("/cascade.html?tutorials=force&player=bloom-onboarding-audit");
  await expect(page.locator("#level-number")).toHaveText("753");

  // Stabilize the board so Hammer-triggered Bloom probes do not accidentally
  // generate unrelated cascades. This preserves the authored level/progress.
  await page.evaluate((activeRunKey) => {
    const run = window.cascadeResearch.exportActiveRun();
    run.board = Array.from({ length: 64 }, (_, index) => {
      const row = Math.floor(index / 8);
      const col = index % 8;
      return (row + col) % 6;
    });
    run.rngState = 0x12345678;
    localStorage.setItem(activeRunKey, JSON.stringify(run));
  }, ACTIVE_RUN_KEY);
  await page.reload();
  await expect(page.locator("#level-number")).toHaveText("753");
}

async function bloomPairs(page) {
  return page.evaluate(() => {
    const symbols = window.cascadeResearch.exportLevel().progress.blooms.symbols;
    const bySymbol = new Map();
    symbols.forEach((symbol, index) => {
      if (symbol < 0) return;
      if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
      bySymbol.get(symbol).push(index);
    });
    return [...bySymbol.entries()]
      .map(([symbol, indices]) => ({ symbol, indices }))
      .filter((entry) => entry.indices.length === 2);
  });
}

async function hammerBloom(page, index) {
  await page.locator("#booster-hammer").click();
  await page.locator("#board .cascade-tile").nth(index).click();
}

test("level 753 first impression exposes Blooms without an onboarding tutorial", async ({ page }) => {
  await openLevel753(page);
  await page.waitForTimeout(900);

  await expect(page.locator(".cascade-tile.has-memory-bloom")).toHaveCount(4);
  await expect(page.locator("#objective-label")).toContainText("blooms");
  await expect(page.locator("#cascade-tutorial-dialog")).not.toBeVisible();

  await page.screenshot({
    path: `${output}/cascade-bloom-753-first-impression-mobile.png`,
    fullPage: false,
  });
});

test("level 753 Bloom open and mismatch feedback on the production interaction path", async ({ page }) => {
  await openLevel753(page);
  const pairs = await bloomPairs(page);
  expect(pairs).toHaveLength(2);

  const first = pairs[0].indices[0];
  const nonMatch = pairs[1].indices[0];

  await hammerBloom(page, first);
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex))
    .toBe(first);

  await page.screenshot({
    path: `${output}/cascade-bloom-753-open-mobile.png`,
    fullPage: false,
  });

  await page.locator("#booster-hammer").click();
  await page.locator("#board .cascade-tile").nth(nonMatch).click();

  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(2);
  await expect(page.locator(".cascade-tile.is-bloom-mismatch")).toHaveCount(2);
  await page.screenshot({
    path: `${output}/cascade-bloom-753-mismatch-mobile.png`,
    fullPage: false,
  });

  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex))
    .toBe(-1);
});

test("level 753 matching Bloom pair gives visible success feedback and advances objective", async ({ page }) => {
  await openLevel753(page);
  const pairs = await bloomPairs(page);
  expect(pairs).toHaveLength(2);

  const [first, partner] = pairs[0].indices;

  await hammerBloom(page, first);
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex))
    .toBe(first);

  await page.locator("#booster-hammer").click();
  await page.locator("#board .cascade-tile").nth(partner).click();

  await expect(page.locator(".cascade-bloom-peek.is-success")).toHaveCount(2);
  await page.screenshot({
    path: `${output}/cascade-bloom-753-match-mobile.png`,
    fullPage: false,
  });

  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.collectedPairs))
    .toBe(1);
});
