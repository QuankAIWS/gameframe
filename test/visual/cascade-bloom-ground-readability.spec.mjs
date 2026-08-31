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

test("Cascade Memory Blooms are large, fixed, and readable on mobile", async ({ page }) => {
  await openLevel(page, 751, { width: 390, height: 844 });
  const blooms = page.locator(".cascade-tile.has-memory-bloom");
  await expect(blooms).toHaveCount(4);
  const geometry = await blooms.first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const markRect = tile.querySelector(".cascade-bloom-mark").getBoundingClientRect();
    return { tileWidth: tileRect.width, markWidth: markRect.width };
  });
  expect(geometry.markWidth).toBeGreaterThan(geometry.tileWidth * .72);
  await page.screenshot({ path: `${output}/cascade-memory-blooms-mobile.png`, fullPage: true });
});

test("Cascade open Memory Bloom shows redundant symbol and color", async ({ page }) => {
  await openLevel(page, 751, { width: 390, height: 844 });
  const exported = await page.evaluate(() => window.cascadeResearch.exportLevel());
  const bloomIndex = exported.progress.blooms.symbols.findIndex((symbol) => symbol >= 0);
  expect(bloomIndex).toBeGreaterThanOrEqual(0);

  await page.evaluate((index) => {
    const live = window.cascadeResearch.exportLevel();
    live.progress.blooms.activeIndex = index;
  }, bloomIndex);
  // Reload through the production pagehide persistence path. Mutating only
  // localStorage here is invalid because the runtime correctly commits its
  // live in-memory run during pagehide.
  await page.reload();

  const open = page.locator(".cascade-tile.has-memory-bloom .cascade-bloom-mark.is-revealed");
  await expect(open).toHaveCount(1);
  const cue = await open.evaluate((element) => ({
    text: element.textContent,
    fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
  }));
  expect(["♥", "◆", "★", "●", "✦", "✿"]).toContain(cue.text);
  expect(cue.fontSize).toBeGreaterThanOrEqual(18);
  await page.screenshot({ path: `${output}/cascade-memory-bloom-revealed-mobile.png`, fullPage: true });
});

test("Cascade Enchanted Ground remains visible beneath candy on desktop and mobile", async ({ page }) => {
  await openLevel(page, 801);
  await expect(page.locator(".cascade-tile.has-enchanted-ground")).toHaveCount(3);
  await page.screenshot({ path: `${output}/cascade-enchanted-ground-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".cascade-tile.has-enchanted-ground").first()).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-enchanted-ground-mobile.png`, fullPage: true });
});
