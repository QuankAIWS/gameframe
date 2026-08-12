import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";

async function seed(page, level, seen = {}) {
  await page.addInitScript(({ tutorialKey, stateKey, levelNumber, seenTips }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: seenTips }));
    localStorage.setItem(stateKey, JSON.stringify({
      level: levelNumber,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY, levelNumber: level, seenTips: seen });
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("Cascade striped-special tutorial fits the desktop game language", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, 2, { match: true });
  await page.goto("/cascade.html?player=tutorial-visual-desktop&tutorials=force");
  await expect(page.locator("#cascade-tutorial-dialog")).toBeVisible();
  await expect(page.locator(".cascade-tutorial-visual.is-stripe")).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-tutorial-stripe-desktop.png`, fullPage: true });
});

test("Cascade ice tutorial remains readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, 31, { match: true, stripe: true, bomb: true, combo: true, color: true });
  await page.goto("/cascade.html?player=tutorial-visual-mobile&tutorials=force");
  await expect(page.locator("#cascade-tutorial-dialog")).toBeVisible();
  await expect(page.locator(".cascade-tutorial-visual.is-ice")).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-tutorial-ice-mobile.png`, fullPage: true });
});
