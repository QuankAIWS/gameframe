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

test("Memory Blooms read as large fixed flowers without hiding the candy board", async ({ page }) => {
  await openLevel(page, 751);
  const blooms = page.locator(".cascade-tile.has-memory-bloom");
  await expect(blooms).toHaveCount(4);
  const geometry = await blooms.first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const bloom = tile.querySelector(".cascade-bloom-mark").getBoundingClientRect();
    const candy = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      bloomWidth: bloom.width,
      candyWidth: Number.parseFloat(candy.width),
    };
  });
  expect(geometry.bloomWidth).toBeGreaterThan(geometry.tileWidth * .72);
  expect(geometry.candyWidth).toBeGreaterThan(geometry.tileWidth * .5);
  await page.screenshot({ path: `${output}/cascade-memory-blooms-mobile.png`, fullPage: true });
});

test("Enchanted Ground is visible as an underlay rather than another blocker", async ({ page }) => {
  await openLevel(page, 801);
  const ground = page.locator(".cascade-tile.has-enchanted-ground");
  await expect(ground).toHaveCount(3);
  const geometry = await ground.first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const mark = tile.querySelector(".cascade-ground-mark").getBoundingClientRect();
    const candy = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      markWidth: mark.width,
      candyWidth: Number.parseFloat(candy.width),
    };
  });
  expect(geometry.markWidth).toBeGreaterThan(geometry.tileWidth * .88);
  expect(geometry.candyWidth).toBeGreaterThan(geometry.tileWidth * .75);
  await page.screenshot({ path: `${output}/cascade-enchanted-ground-mobile.png`, fullPage: true });
});

test("Bloom plus Ground recombination remains legible on desktop", async ({ page }) => {
  await openLevel(page, 851, { width: 1440, height: 960 });
  await expect(page.locator(".cascade-tile.has-memory-bloom").first()).toBeVisible();
  await expect(page.locator(".cascade-tile.has-enchanted-ground").first()).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-bloom-ground-remix-desktop.png`, fullPage: true });
});
