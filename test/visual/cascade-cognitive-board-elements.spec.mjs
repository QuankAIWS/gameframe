import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";

async function openLevel(page, level, viewport = { width: 390, height: 844 }) {
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

test("Memory Blooms remain large and legible on mobile", async ({ page }) => {
  await openLevel(page, 751);
  const blooms = page.locator(".cascade-tile.has-memory-bloom");
  await expect(blooms).toHaveCount(4);
  const geometry = await blooms.first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const mark = tile.querySelector(".cascade-bloom-mark").getBoundingClientRect();
    return { tileWidth: tileRect.width, bloomWidth: mark.width };
  });
  expect(geometry.bloomWidth).toBeGreaterThan(geometry.tileWidth * .7);
  await page.screenshot({ path: `${output}/cascade-memory-blooms-mobile.png`, fullPage: true });
});

test("Memory Blooms fit the desktop candy board", async ({ page }) => {
  await openLevel(page, 751, { width: 1440, height: 960 });
  await expect(page.locator(".cascade-tile.has-memory-bloom").first()).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-memory-blooms-desktop.png`, fullPage: true });
});

test("Enchanted Ground reads as a board underlay without obscuring candy", async ({ page }) => {
  await openLevel(page, 801);
  const ground = page.locator(".cascade-tile.has-enchanted-ground");
  await expect(ground).toHaveCount(3);
  const geometry = await ground.first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const mark = tile.querySelector(".cascade-ground-mark").getBoundingClientRect();
    return { tileWidth: tileRect.width, groundWidth: mark.width };
  });
  expect(geometry.groundWidth).toBeGreaterThan(geometry.tileWidth * .85);
  await page.screenshot({ path: `${output}/cascade-enchanted-ground-mobile.png`, fullPage: true });
});
