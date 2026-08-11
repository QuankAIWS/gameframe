import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const performanceKey = "scribbles-gameframe.cascade-performance:v1";
const soundKey = "scribbles-gameframe.cascade-sound:v1";
const effectsKey = "scribbles-gameframe.cascade-effects:v1";

async function prepare(page, level = 1, performance = null) {
  await mkdir(output, { recursive: true });
  await page.addInitScript(({ stateKey: key, performanceKey: perfKey, soundKey: audioKey, effectsKey: fxKey, level: targetLevel, performance: perf }) => {
    localStorage.setItem(audioKey, "off");
    localStorage.setItem(fxKey, "full");
    localStorage.setItem(key, JSON.stringify({
      level: targetLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: targetLevel > 1 ? 7 : 0,
      hammers: 2,
    }));
    if (perf) localStorage.setItem(perfKey, JSON.stringify(perf));
  }, { stateKey, performanceKey, soundKey, effectsKey, level, performance });
}

test("Cascade Crush bright casual polish is readable on desktop and mobile", async ({ page }) => {
  await prepare(page, 1);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect(page).toHaveTitle(/Cascade Crush/);
  await expect(page.getByRole("heading", { name: "Cascade Crush", exact: true })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#cascade-sound-toggle")).toBeVisible();
  await expect(page.locator("#cascade-effects-toggle")).toHaveText(/Effects full/);
  await expect(page.locator("body")).toHaveAttribute("data-cascade-effects", "full");
  await expect(page.locator("#level-stars")).toBeVisible();
  await expect(page.locator("#cascade-weekly-card")).toBeVisible();
  await expect(page.locator("#level-map > li")).toHaveCount(30);
  await expect(page.locator('link[href="/cascade-polish.css"]')).toHaveCount(1);
  await expect(page.locator('link[href="/cascade-juice.css"]')).toHaveCount(1);
  await expect(page.locator('link[href="/cascade-evolution.css"]')).toHaveCount(1);
  await expect(page.locator('link[href="/cascade-bonus-modes.css"]')).toHaveCount(1);

  const shapes = await page.locator(".cascade-tile").evaluateAll((tiles) => {
    const byKind = new Map();
    for (const tile of tiles) {
      if (!byKind.has(tile.dataset.kind)) byKind.set(tile.dataset.kind, getComputedStyle(tile).borderRadius);
    }
    return [...byKind.values()];
  });
  expect(new Set(shapes).size).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: `${output}/cascade-crush-bright-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#cascade-weekly-card")).toBeVisible();
  const board = await page.locator("#board").boundingBox();
  expect(board).toBeTruthy();
  expect(board.width).toBeLessThanOrEqual(390);
  const levelMapFits = await page.locator("#level-map").evaluate((map) => map.scrollWidth <= map.clientWidth + 1);
  expect(levelMapFits).toBe(true);
  await page.screenshot({ path: `${output}/cascade-crush-bright-mobile.png`, fullPage: true });
});

test("Cascade Crush feedback control can reduce visual spectacle without changing play", async ({ page }) => {
  await prepare(page, 5);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  const button = page.locator("#cascade-effects-toggle");
  await expect(button).toHaveText(/Effects full/);
  await button.click();
  await expect(button).toHaveText(/Effects reduced/);
  await expect(page.locator("body")).toHaveAttribute("data-cascade-effects", "reduced");
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), effectsKey)).toBe("reduced");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
});

test("Cascade Crush performance card shows earned stars and the next Blitz slot", async ({ page }) => {
  await prepare(page, 6, {
    starsByLevel: { "1": 3, "2": 3, "3": 2, "6": 2 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: { "after-5": true },
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect(page.locator("#level-stars")).toHaveText("★★☆");
  await expect(page.locator("#star-progress")).toContainText("10 total stars");
  await expect(page.locator("#bonus-status")).toContainText("NEXT BLITZ AFTER LEVEL 12");
  await expect(page.locator('#level-map > li[data-level="6"] .cascade-map-stars')).toHaveText("★★☆");
  await page.screenshot({ path: `${output}/cascade-crush-performance-desktop.png`, fullPage: true });
});

test("Cascade Crush persistent specials remain visually distinct", async ({ page }) => {
  await prepare(page, 5);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  const tiles = page.locator(".cascade-tile");
  for (const [index, special] of [[0, "stripe-h"], [1, "stripe-v"], [2, "bomb"], [3, "color"]]) {
    await tiles.nth(index).evaluate((tile, value) => {
      tile.dataset.special = value;
      tile.classList.add("has-special");
      const mark = document.createElement("span");
      mark.className = "cascade-special-mark";
      mark.setAttribute("aria-hidden", "true");
      tile.append(mark);
    }, special);
  }

  await expect(page.locator('.cascade-tile[data-special="stripe-h"]')).toBeVisible();
  await expect(page.locator('.cascade-tile[data-special="bomb"]')).toBeVisible();
  await expect(page.locator('.cascade-tile[data-special="color"]')).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-crush-specials-desktop.png`, fullPage: true });
});

test("Cascade Crush big-pop color clear creates a board-wide dopamine hit", async ({ page }) => {
  await prepare(page, 5);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect.poll(() => page.evaluate(() => Boolean(window.cascadePolish))).toBe(true);
  const started = await page.evaluate(() => window.cascadePolish.demo("color"));
  expect(started).toBe(true);
  await expect(page.locator(".cascade-color-wash")).toBeVisible();
  await expect(page.locator(".cascade-pop-burst .cascade-pop-ring").first()).toBeVisible();
  await expect(page.locator(".cascade-hype-word")).toContainText("Mega!");
  await page.screenshot({ path: `${output}/cascade-crush-big-pop-color-desktop.png`, fullPage: true });
});

test("Cascade Crush Blitz takes over the board without replacing the core visual language", async ({ page }) => {
  await prepare(page, 6, {
    starsByLevel: { "1": 3, "2": 3, "3": 2, "6": 2 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await page.evaluate(() => window.cascadeResearch.startBlitz(5));

  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  await expect(page.locator("#blitz-overlay")).toBeVisible();
  await expect(page.locator("#level-number")).toHaveText("B");
  await expect(page.locator("#target")).toHaveText("∞");
  await expect(page.locator("#moves")).toHaveText("∞");
  await expect(page.locator("#blitz-callout")).toHaveText("BLITZ", { timeout: 4_000 });
  await page.screenshot({ path: `${output}/cascade-crush-blitz-desktop.png`, fullPage: true });
});

test("Cascade Crush Quick Recall reads as a distinct but related bonus mode", async ({ page }) => {
  await prepare(page, 9, {
    starsByLevel: { "8": 2 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    recallBest: {},
    recallSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await page.evaluate(() => window.cascadeBonusModes.startQuickRecall(8));

  const dialog = page.locator("#cascade-recall-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-recall-kicker]")).toHaveText("QUICK RECALL");
  await expect(dialog.locator("[data-recall-title]")).toContainText("Round 1");
  await page.screenshot({ path: `${output}/cascade-crush-quick-recall-desktop.png`, fullPage: true });
});

test("Cascade Crush layered objective styling remains obvious in veteran chapters", async ({ page }) => {
  await prepare(page, 181);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect(page.locator("#level-number")).toHaveText("181");
  await expect(page.locator('.cascade-tile[data-ice="2"]')).not.toHaveCount(0);
  await expect(page.locator("#objective-label")).toContainText(/ice|pink|cyan|yellow|green|purple|orange/i);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "181-210");
  await page.screenshot({ path: `${output}/cascade-crush-layered-objective-desktop.png`, fullPage: true });
});

test("Cascade Crush level 300 capstone keeps the progression UI compact", async ({ page }) => {
  await prepare(page, 300);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect(page.locator("#level-number")).toHaveText("300");
  await expect(page.locator("#level-map > li")).toHaveCount(30);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "271-300");
  await expect(page.locator('#level-map > li[data-level="300"]')).toContainText("Super hard");
  await page.screenshot({ path: `${output}/cascade-crush-level-300-desktop.png`, fullPage: true });
});
