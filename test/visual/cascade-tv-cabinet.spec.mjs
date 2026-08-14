import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const soundKey = "scribbles-gameframe.cascade-sound:v1";
const effectsKey = "scribbles-gameframe.cascade-effects:v1";

async function prepare(page) {
  await mkdir(output, { recursive: true });
  await page.addInitScript(({ stateKey: key, soundKey: audioKey, effectsKey: fxKey }) => {
    localStorage.setItem(audioKey, "off");
    localStorage.setItem(fxKey, "full");
    localStorage.setItem(key, JSON.stringify({
      level: 58,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
  }, { stateKey, soundKey, effectsKey });
}

test("Cascade pastel cabinet uses television width while keeping the board height-first", async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html");

  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator(".cascade-map")).toBeVisible();
  await expect(page.locator(".cascade-side")).toBeVisible();
  await expect(page.locator(".cascade-status")).toBeVisible();
  await expect(page.locator("#moves")).toBeVisible();

  const board = await page.locator("#board").boundingBox();
  expect(board).toBeTruthy();
  expect(board.y + board.height).toBeLessThanOrEqual(540);
  expect(board.width).toBeGreaterThan(350);

  await page.screenshot({ path: `${output}/cascade-tv-cabinet-zoom.png`, fullPage: true });
});

test("Cascade pastel cabinet remains composed on a wide desktop television viewport", async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cascade.html");

  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  const board = await page.locator("#board").boundingBox();
  const map = await page.locator(".cascade-map").boundingBox();
  const status = await page.locator(".cascade-status").boundingBox();
  expect(board).toBeTruthy();
  expect(map).toBeTruthy();
  expect(status).toBeTruthy();
  expect(map.x + map.width).toBeLessThan(board.x);
  expect(board.x + board.width).toBeLessThan(status.x);

  await page.screenshot({ path: `${output}/cascade-tv-cabinet-wide.png`, fullPage: true });
});
