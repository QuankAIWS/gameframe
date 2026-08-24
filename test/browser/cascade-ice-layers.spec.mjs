import { expect, test } from "@playwright/test";

const CASCADE_STATE_KEY = "scribbles-gameframe.cascade-state:v1";

async function shellColors(coating) {
  return coating.locator(".cascade-ice-shell").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderTopColor));
}

async function markerColors(coating) {
  return coating.locator(".cascade-ice-marker").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
}

async function coatingVisual(coating) {
  return coating.evaluate((node) => {
    const style = getComputedStyle(node);
    const snowflake = getComputedStyle(node, "::before");
    return {
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
      filter: style.filter,
      snowflakeOpacity: Number.parseFloat(snowflake.opacity),
      snowflakeColor: snowflake.color,
      snowflakeStroke: snowflake.webkitTextStroke,
    };
  });
}

async function tileAura(tile) {
  return tile.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      backgroundImage: style.backgroundImage,
      aura: style.getPropertyValue("--ice-color-aura").trim(),
      halo: style.getPropertyValue("--ice-color-halo").trim(),
      filter: style.filter,
    };
  });
}

test("Cascade ice coatings expose exact durability without obscuring candy color", async ({ page }) => {
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
  await expect(page.locator('link[href="/cascade-ice-visibility.css"]')).toHaveCount(1);

  const icedTile = page.locator('.cascade-tile[data-ice="2"]').first();
  await expect(icedTile).toBeVisible();
  const index = await icedTile.getAttribute("data-index");
  expect(index).not.toBeNull();

  const originalKind = await icedTile.getAttribute("data-kind");
  expect(originalKind).not.toBeNull();

  const initialAura = await tileAura(icedTile);
  expect(initialAura.backgroundImage).toContain("radial-gradient");
  expect(initialAura.aura).not.toBe("");
  expect(initialAura.halo).not.toBe("");
  expect(initialAura.filter).toBe("none");

  await page.evaluate(({ tileIndex, originalTileKind }) => {
    const tile = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    if (!tile) return;
    const nextKind = String((Number(originalTileKind) + 1) % 6);
    tile.dataset.kind = nextKind;
  }, { tileIndex: index, originalTileKind: originalKind });

  const alternateAura = await tileAura(icedTile);
  expect(alternateAura.aura).not.toBe(initialAura.aura);

  await page.evaluate(({ tileIndex, originalTileKind }) => {
    const tile = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    if (tile) tile.dataset.kind = originalTileKind;
  }, { tileIndex: index, originalTileKind: originalKind });

  const coating = page.locator(`.cascade-cell-coating-layer:not(.cascade-cell-coating-effects) .cascade-cell-coating[data-index="${index}"]`);
  await expect(coating).toHaveAttribute("data-layers", "2");
  await expect(coating).toHaveClass(/ice-2/);
  await expect(coating.locator(".cascade-ice-shell")).toHaveCount(2);
  await expect(coating.locator(".cascade-ice-marker")).toHaveCount(2);
  expect(new Set(await shellColors(coating)).size).toBe(2);
  expect(new Set(await markerColors(coating)).size).toBe(2);

  const ice2Visual = await coatingVisual(coating);
  expect(ice2Visual.filter).toBe("none");
  expect(ice2Visual.snowflakeOpacity).toBeLessThanOrEqual(0.6);

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

  const ice3Visual = await coatingVisual(coating);
  expect(ice3Visual.backgroundImage).toBe(ice2Visual.backgroundImage);
  expect(ice3Visual.boxShadow).toBe(ice2Visual.boxShadow);
  expect(ice3Visual.filter).toBe(ice2Visual.filter);
  expect(ice3Visual.snowflakeOpacity).toBe(ice2Visual.snowflakeOpacity);
  expect(ice3Visual.snowflakeColor).toBe(ice2Visual.snowflakeColor);
  expect(ice3Visual.snowflakeStroke).toBe(ice2Visual.snowflakeStroke);

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

  const ice1Visual = await coatingVisual(coating);
  expect(ice1Visual.backgroundImage).toBe(ice2Visual.backgroundImage);
  expect(ice1Visual.boxShadow).toBe(ice2Visual.boxShadow);
  expect(ice1Visual.filter).toBe(ice2Visual.filter);
  expect(ice1Visual.snowflakeOpacity).toBe(ice2Visual.snowflakeOpacity);
  expect(ice1Visual.snowflakeColor).toBe(ice2Visual.snowflakeColor);
  expect(ice1Visual.snowflakeStroke).toBe(ice2Visual.snowflakeStroke);
});
