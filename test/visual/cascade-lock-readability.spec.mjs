import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";

async function openLevel(page, level, viewport = { width: 1440, height: 960 }) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize(viewport);
  await page.addInitScript(({ key, targetLevel }) => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem(key, JSON.stringify({
      level: targetLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { key: stateKey, targetLevel: level });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText(String(level));
}

test("Cascade Cages remain obvious without obscuring candy identity", async ({ page }) => {
  await openLevel(page, 651);
  const cages = page.locator(".cascade-tile.has-cage");
  await expect(cages.first()).toBeVisible();
  const geometry = await cages.first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const candy = getComputedStyle(tile, "::before");
    const mark = tile.querySelector(".cascade-lock-mark").getBoundingClientRect();
    return {
      tileWidth: tileRect.width,
      candyWidth: Number.parseFloat(candy.width),
      markWidth: mark.width,
    };
  });
  expect(geometry.candyWidth).toBeGreaterThan(geometry.tileWidth * .7);
  expect(geometry.markWidth).toBeGreaterThan(geometry.tileWidth * .72);
  await page.screenshot({ path: `${output}/cascade-cages-desktop.png`, fullPage: true });
});

test("Cascade Cages stay readable on a phone-sized board", async ({ page }) => {
  await openLevel(page, 651, { width: 390, height: 844 });
  await expect(page.locator(".cascade-tile.has-cage").first()).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-cages-mobile.png`, fullPage: true });
});

test("Cascade Recall Locks expose large redundant color-symbol cues", async ({ page }) => {
  await openLevel(page, 701, { width: 390, height: 844 });
  const recalls = page.locator(".cascade-tile.has-recall-lock");
  await expect(recalls.first()).toBeVisible();
  await expect(page.locator(".cascade-lock-mark.is-revealed").first()).toBeVisible();
  const cue = await page.locator(".cascade-lock-mark.is-revealed").first().evaluate((element) => ({
    text: element.textContent,
    fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
  }));
  expect(["♥", "◆", "★", "●", "✦", "✿"]).toContain(cue.text);
  expect(cue.fontSize).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: `${output}/cascade-recall-locks-mobile.png`, fullPage: true });
});
