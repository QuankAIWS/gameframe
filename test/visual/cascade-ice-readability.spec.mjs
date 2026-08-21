import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";

async function openLevel(page, level) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.addInitScript(({ key, targetLevel }) => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem(key, JSON.stringify({
      level: targetLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 7,
      hammers: 2,
    }));
  }, { key: stateKey, targetLevel: level });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText(String(level));
  await expect.poll(() => page.locator(".cascade-cell-coating").count()).toBeGreaterThan(0);
}

function alphaFromCssColor(value) {
  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return numbers.length >= 4 ? numbers[3] : 1;
}

async function coatingPresentation(locator) {
  return locator.evaluate((coating) => {
    const coatingStyle = getComputedStyle(coating);
    const snowflakeStyle = getComputedStyle(coating, "::before");
    return {
      backgroundImage: coatingStyle.backgroundImage,
      backgroundColor: coatingStyle.backgroundColor,
      fill: snowflakeStyle.color,
      strokeColor: snowflakeStyle.webkitTextStrokeColor,
      strokeWidth: Number.parseFloat(snowflakeStyle.webkitTextStrokeWidth || "0"),
    };
  });
}

test("Cascade one-layer ice frames the candy instead of whitening its center", async ({ page }) => {
  await openLevel(page, 105);

  const coating = page.locator(".cascade-cell-coating:not(.ice-2)").first();
  await expect(coating).toBeVisible();
  const presentation = await coatingPresentation(coating);

  expect(presentation.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect((presentation.backgroundImage.match(/radial-gradient/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect(presentation.backgroundImage.includes("linear-gradient")).toBe(false);
  expect(alphaFromCssColor(presentation.fill)).toBeLessThanOrEqual(.35);
  expect(alphaFromCssColor(presentation.strokeColor)).toBeGreaterThanOrEqual(.75);
  expect(presentation.strokeWidth).toBeGreaterThanOrEqual(.75);

  await page.screenshot({ path: `${output}/cascade-crush-ice-readable-desktop.png`, fullPage: true });
});

test("Cascade two-layer ice increases the perimeter signal without filling the candy", async ({ page }) => {
  await openLevel(page, 181);

  const coating = page.locator(".cascade-cell-coating.ice-2").first();
  await expect(coating).toBeVisible();
  const presentation = await coatingPresentation(coating);

  expect(presentation.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect((presentation.backgroundImage.match(/radial-gradient/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect(presentation.backgroundImage.includes("linear-gradient")).toBe(false);
  expect(alphaFromCssColor(presentation.fill)).toBeLessThanOrEqual(.4);
  expect(alphaFromCssColor(presentation.strokeColor)).toBeGreaterThanOrEqual(.8);
  expect(presentation.strokeWidth).toBeGreaterThanOrEqual(1);

  await page.screenshot({ path: `${output}/cascade-crush-ice-2-readable-desktop.png`, fullPage: true });
});
