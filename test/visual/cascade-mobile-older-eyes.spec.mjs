import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

async function prepare(page) {
  await mkdir(output, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 18,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
    localStorage.setItem("scribbles-gameframe.cascade-performance:v1", JSON.stringify({
      starsByLevel: { "16": 3, "17": 2, "18": 2 },
      blitzBest: {},
      blitzStars: {},
      blitzSeen: {},
      pendingHammerRewards: 0,
    }));
  });
}

async function assertPlaySurface(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#booster-hammer")).toBeVisible();
  await expect(page.locator("#cascade-weekly-card")).toBeVisible();
  await expect(page.locator("#cascade-mobile-menu-toggle")).toBeVisible();

  const bounds = await page.evaluate(() => {
    const board = document.querySelector("#board").getBoundingClientRect();
    const hammer = document.querySelector("#booster-hammer").getBoundingClientRect();
    const blitz = document.querySelector("#cascade-weekly-card").getBoundingClientRect();
    return {
      boardWidth: board.width,
      boardBottom: board.bottom,
      utilityBottom: Math.max(hammer.bottom, blitz.bottom),
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
  expect(bounds.boardWidth).toBeGreaterThanOrEqual(viewport.width - 10);
  expect(bounds.boardBottom).toBeLessThan(viewport.height);
  expect(bounds.utilityBottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(bounds.scrollHeight).toBeLessThanOrEqual(viewport.height + 1);
}

test("Cascade older-eye mobile composition keeps the board dominant at 390x844", async ({ page }) => {
  await prepare(page);
  await assertPlaySurface(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/cascade-crush-older-eyes-390x844.png`, fullPage: false });

  await page.locator("#cascade-mobile-menu-toggle").click();
  await expect(page.locator("#cascade-mobile-menu")).toBeVisible();
  await expect(page.locator("#cascade-mobile-menu #cascade-feedback-card")).toBeVisible();
  await expect(page.locator("#cascade-mobile-menu #level-stars")).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-crush-mobile-game-menu-390x844.png`, fullPage: false });
});

test("Cascade older-eye mobile composition keeps the complete play surface at 360x800", async ({ page }) => {
  await prepare(page);
  await assertPlaySurface(page, { width: 360, height: 800 });
  await page.screenshot({ path: `${output}/cascade-crush-older-eyes-360x800.png`, fullPage: false });
});
