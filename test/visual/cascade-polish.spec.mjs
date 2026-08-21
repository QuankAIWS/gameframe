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
  await expect(page.locator('link[href="/cascade-cell-objectives.css"]')).toHaveCount(1);
  await expect(page.locator('link[href="/cascade-cabinet-polish.css"]')).toHaveCount(1);
  await expect(page.locator('link[href="/cascade-final-touch.css"]')).toHaveCount(1);
  await expect(page.locator('link[href="/cascade-piece-shapes.css"]')).toHaveCount(1);
  await expect(page.locator('script[src="/cascade-mobile-ui.js"]')).toHaveCount(1);

  await page.screenshot({ path: `${output}/cascade-crush-bright-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("#board")).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-crush-bright-mobile.png`, fullPage: true });
});

test("Cascade Crush feedback control can reduce visual spectacle without changing play", async ({ page }) => {
  await prepare(page, 1);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await page.locator("#cascade-effects-toggle").click();
  await expect(page.locator("body")).toHaveAttribute("data-cascade-effects", "reduced");
  await expect(page.locator("#cascade-effects-toggle")).toHaveText(/Effects reduced/);
  await page.screenshot({ path: `${output}/cascade-crush-reduced-effects-desktop.png`, fullPage: true });
});

test("Cascade Crush performance card shows earned stars and the next Blitz slot", async ({ page }) => {
  await prepare(page, 7, {
    starsByLevel: { "1": 3, "2": 2, "3": 1, "5": 3 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await expect(page.locator("#cascade-star-count")).toContainText("9");
  await expect(page.locator("#cascade-next-blitz")).not.toHaveText("—");
  await page.screenshot({ path: `${output}/cascade-crush-performance-card.png`, fullPage: true });
});

test("Cascade Crush persistent specials remain visually distinct", async ({ page }) => {
  await prepare(page, 6, {
    starsByLevel: { "1": 3, "2": 3, "3": 2 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await page.evaluate(() => {
    const tiles = [...document.querySelectorAll(".cascade-tile")];
    if (tiles[0]) {
      tiles[0].dataset.special = "stripe-h";
      tiles[0].classList.add("has-special");
    }
    if (tiles[1]) {
      tiles[1].dataset.special = "stripe-v";
      tiles[1].classList.add("has-special");
    }
    if (tiles[2]) {
      tiles[2].dataset.special = "bomb";
      tiles[2].classList.add("has-special");
    }
    if (tiles[3]) {
      tiles[3].dataset.special = "color";
      tiles[3].classList.add("has-special");
    }
  });
  await page.screenshot({ path: `${output}/cascade-crush-specials-desktop.png`, fullPage: true });
});

test("Cascade Crush big-pop color clear creates a board-wide dopamine hit", async ({ page }) => {
  await prepare(page, 6, {
    starsByLevel: { "1": 3, "2": 3, "3": 2 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await page.evaluate(() => window.cascadeResearch.demoColorClear());
  await expect(page.locator("body")).toHaveClass(/cascade-big-pop/);
  await page.screenshot({ path: `${output}/cascade-crush-color-clear-pop.png`, fullPage: true });
});

test("Cascade Crush level 105 presents ice as fixed board cells instead of shiny moving pieces", async ({ page }) => {
  await prepare(page, 105, {
    starsByLevel: { "100": 2 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("105");
  const coating = page.locator(".cascade-cell-coating").first();
  await expect(coating).toBeVisible();
  const alignment = await coating.evaluate((node) => {
    const index = node.dataset.index;
    const tile = document.querySelector(`.cascade-tile[data-index="${index}"]`);
    if (!tile) return null;
    const coatingRect = node.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    return {
      separate: !tile.contains(node),
      dx: Math.abs(coatingRect.left - tileRect.left),
      dy: Math.abs(coatingRect.top - tileRect.top),
      dw: Math.abs(coatingRect.width - tileRect.width),
      dh: Math.abs(coatingRect.height - tileRect.height),
    };
  });
  expect(alignment).toBeTruthy();
  expect(alignment.separate).toBe(true);
  expect(alignment.dx).toBeLessThanOrEqual(2);
  expect(alignment.dy).toBeLessThanOrEqual(2);
  expect(alignment.dw).toBeLessThanOrEqual(2);
  expect(alignment.dh).toBeLessThanOrEqual(2);
});

test("Cascade Crush Blitz takes over the board without replacing the core visual language", async ({ page }) => {
  await prepare(page, 6, {
    starsByLevel: { "1": 3, "2": 3, "3": 2, "5": 2 },
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cascade.html");
  await page.evaluate(() => window.cascadeResearch.startRecall());
  await expect(page.locator("body")).toHaveClass(/cascade-recall-mode/);
  await page.screenshot({ path: `${output}/cascade-crush-recall-mobile.png`, fullPage: true });
});

test("Cascade Crush layered objective styling remains obvious in veteran chapters", async ({ page }) => {
  await prepare(page, 210, {
    starsByLevel: { "200": 3 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("210");
  await page.screenshot({ path: `${output}/cascade-crush-veteran-layered-objective.png`, fullPage: true });
});

test("Cascade Crush level 300 capstone keeps the progression UI compact", async ({ page }) => {
  await prepare(page, 300, {
    starsByLevel: { "299": 3 },
    blitzBest: {},
    blitzStars: {},
    blitzSeen: {},
    pendingHammerRewards: 0,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("300");
  await page.screenshot({ path: `${output}/cascade-crush-level-300.png`, fullPage: true });
});
