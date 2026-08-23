import { expect, test } from "@playwright/test";

const CASCADE_STATE_KEY = "scribbles-gameframe.cascade-state:v1";

test("Cascade ice coatings expose exact durability as countable shells", async ({ page }) => {
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

  const twoLayerCoating = page.locator(`.cascade-cell-coating-layer:not(.cascade-cell-coating-effects) .cascade-cell-coating[data-index="${index}"]`);
  await expect(twoLayerCoating).toHaveAttribute("data-layers", "2");
  await expect(twoLayerCoating).toHaveClass(/ice-2/);
  await expect(twoLayerCoating.locator(".cascade-ice-shell")).toHaveCount(2);

  await page.evaluate((tileIndex) => {
    const tile = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    if (tile) tile.dataset.ice = "3";
  }, index);

  const threeLayerCoating = page.locator(`.cascade-cell-coating-layer:not(.cascade-cell-coating-effects) .cascade-cell-coating[data-index="${index}"]`);
  await expect(threeLayerCoating).toHaveAttribute("data-layers", "3");
  await expect(threeLayerCoating).toHaveClass(/ice-3/);
  await expect(threeLayerCoating.locator(".cascade-ice-shell")).toHaveCount(3);

  await page.evaluate((tileIndex) => {
    const tile = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    if (tile) tile.dataset.ice = "2";
  }, index);

  await expect(twoLayerCoating).toHaveAttribute("data-layers", "2");
  await expect(twoLayerCoating.locator(".cascade-ice-shell")).toHaveCount(2);
  await expect.poll(async () => page.locator(`.cascade-cell-coating-effects .is-shedding-shell[data-index="${index}"] .cascade-ice-shell`).count(), {
    timeout: 400,
    intervals: [20, 30, 50],
  }).toBe(1);
});
