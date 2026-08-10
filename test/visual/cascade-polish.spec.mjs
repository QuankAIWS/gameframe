import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const performanceKey = "scribbles-gameframe.cascade-performance:v1";
const soundKey = "scribbles-gameframe.cascade-sound:v1";

async function prepare(page, level = 1, performance = null) {
  await mkdir(output, { recursive: true });
  await page.addInitScript(({ stateKey: key, performanceKey: perfKey, soundKey: audioKey, level: targetLevel, performance: perf }) => {
    localStorage.setItem(audioKey, "off");
    localStorage.setItem(key, JSON.stringify({
      level: targetLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: targetLevel > 1 ? 7 : 0,
      hammers: 2,
      ledger: [],
    }));
    if (perf) localStorage.setItem(perfKey, JSON.stringify(perf));
  }, { stateKey, performanceKey, soundKey, level, performance });
}

test("Cascade Crush bright casual polish is readable on desktop and mobile", async ({ page }) => {
  await prepare(page, 1);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect(page).toHaveTitle(/Cascade Crush/);
  await expect(page.getByRole("heading", { name: "Cascade Crush", exact: true })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#cascade-sound-toggle")).toBeVisible();
  await expect(page.locator("#level-stars")).toBeVisible();
  await expect(page.locator('link[href="/cascade-polish.css"]')).toHaveCount(1);
  await expect(page.locator('link[href="/cascade-performance.css"]')).toHaveCount(1);

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
  const board = await page.locator("#board").boundingBox();
  expect(board).toBeTruthy();
  expect(board.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${output}/cascade-crush-bright-mobile.png`, fullPage: true });
});

test("Cascade Crush performance card makes stars and quick bonus legible", async ({ page }) => {
  await prepare(page, 6, {
    starsByLevel: { "1": 3, "2": 3, "3": 2, "6": 2 },
    quickWins: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect(page.locator("#level-stars")).toHaveText("★★☆");
  await expect(page.locator("#star-progress")).toContainText("10 total stars");
  await expect(page.locator("#quick-bonus")).toBeVisible();
  await expect(page.locator("#quick-bonus")).toContainText("QUICK BONUS");
  await expect(page.locator('#level-map > li[data-level="6"] .cascade-map-stars')).toHaveText("★★☆");
  await page.screenshot({ path: `${output}/cascade-crush-performance-desktop.png`, fullPage: true });
});

test("Cascade Crush layered objective styling remains obvious in the polished theme", async ({ page }) => {
  await prepare(page, 81);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");

  await expect(page.locator("#level-number")).toHaveText("81");
  await expect(page.locator(".cascade-tile[data-ice=\"2\"]")).not.toHaveCount(0);
  await expect(page.locator("#objective-label")).toContainText(/ice|pink|cyan|yellow|green|purple|orange/i);
  await page.screenshot({ path: `${output}/cascade-crush-layered-objective-desktop.png`, fullPage: true });
});
