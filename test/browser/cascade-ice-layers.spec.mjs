import { expect, test } from "@playwright/test";

const CASCADE_STATE_KEY = "scribbles-gameframe.cascade-state:v1";

async function shellColors(coating) {
  return coating.locator(".cascade-ice-shell").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderTopColor));
}

async function markerColors(coating) {
  return coating.locator(".cascade-ice-marker").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
}

test("Cascade ice coatings expose exact durability with shells, color, and edge markers", async ({ page }) => {
  await page.addInitScript((stateKey) => {
    window.localStorage.setItem(stateKey, JSON.stringify({
      level: 151,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, CASCADE_STATE_KEY);

  await page.goto("/cascade.html?cascadeTestLevel=151");
  await expect(page.locator('link[href="/cascade-ice-layers.css"]')).toHaveCount(1);

  const icedTile = page.locator('.cascade-tile[data-ice="2"]').first();
  await expect(icedTile).toBeVisible();
  const index = await icedTile.getAttribute("data-index");
  expect(index).not.toBeNull();

  const coating = page.locator(`.cascade-cell-coating-layer:not(.cascade-cell-coating-effects) .cascade-cell-coating[data-index="${index}"]`);
  await expect(coating).toHaveAttribute("data-layers", "2");
  await expect(coating).toHaveClass(/ice-2/);
  await expect(coating.locator(".cascade-ice-shell")).toHaveCount(2);
  await expect(coating.locator(".cascade-ice-marker")).toHaveCount(2);
  expect(new Set(await shellColors(coating)).size).toBe(2);
  expect(new Set(await markerColors(coating)).size).toBe(2);

  await page.evaluate((tileIndex) => {
    const tile = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    if (tile) tile.dataset.ice = "3";
  }, index);

  await expect(coating).toHaveAttribute("data-layers", "3");
  await expect(coating).toHaveClass(/ice-3/);
  await expect(coating.locator(".cascade-ice-shell")).toHaveCount(3);
  await expect(coating.locator(".cascade-ice-marker")).toHaveCount(3);
  expect(new Set(await shellColors(coating)).size).toBe(3);
  expect(new Set(await markerColors(coating)).size).toBe(3);

  await page.evaluate((tileIndex) => {
    const tile = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    if (tile) tile.dataset.ice = "2";
  }, index);

  await expect(coating).toHaveAttribute("data-layers", "2");
  await expect(coating.locator(".cascade-ice-shell")).toHaveCount(2);
  await expect(coating.locator(".cascade-ice-marker")).toHaveCount(2);
  await expect.poll(async () => page.locator(`.cascade-cell-coating-effects .is-shedding-shell[data-index="${index}"] .cascade-ice-shell`).count(), {
    timeout: 400,
    intervals: [20, 30, 50],
  }).toBe(1);

  await page.evaluate((tileIndex) => {
    const tile = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    if (tile) tile.dataset.ice = "1";
  }, index);

  await expect(coating).toHaveAttribute("data-layers", "1");
  await expect(coating).toHaveClass(/ice-1/);
  await expect(coating.locator(".cascade-ice-shell")).toHaveCount(1);
  await expect(coating.locator(".cascade-ice-marker")).toHaveCount(1);
});
