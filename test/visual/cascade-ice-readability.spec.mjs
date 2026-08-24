import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const iceShellColors = [
  "rgb(18, 207, 234)",
  "rgb(240, 68, 173)",
  "rgb(240, 181, 46)",
];

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
      boxShadow: coatingStyle.boxShadow,
      filter: coatingStyle.filter,
      fill: snowflakeStyle.color,
      strokeColor: snowflakeStyle.webkitTextStrokeColor,
      strokeWidth: Number.parseFloat(snowflakeStyle.webkitTextStrokeWidth || "0"),
      opacity: Number.parseFloat(snowflakeStyle.opacity || "1"),
      textShadow: snowflakeStyle.textShadow,
    };
  });
}

async function shellPresentation(locator) {
  return locator.locator(".cascade-ice-shell").evaluateAll((shells) => shells.map((shell) => {
    const style = getComputedStyle(shell);
    return {
      color: style.borderTopColor,
      width: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
    };
  }));
}

async function icedCandyPresentation(locator) {
  return locator.evaluate((tile) => {
    const style = getComputedStyle(tile);
    return {
      backgroundImage: style.backgroundImage,
      aura: style.getPropertyValue("--ice-color-aura").trim(),
      halo: style.getPropertyValue("--ice-color-halo").trim(),
      filter: style.filter,
    };
  });
}

function expectReadableTransparentIce(presentation) {
  expect(presentation.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect((presentation.backgroundImage.match(/radial-gradient/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect(presentation.backgroundImage.includes("linear-gradient")).toBe(false);
  expect(presentation.filter).toBe("none");
  expect(alphaFromCssColor(presentation.fill)).toBeLessThanOrEqual(.08);
  expect(alphaFromCssColor(presentation.strokeColor)).toBeGreaterThanOrEqual(.35);
  expect(alphaFromCssColor(presentation.strokeColor)).toBeLessThanOrEqual(.55);
  expect(presentation.strokeWidth).toBeGreaterThanOrEqual(.75);
  expect(presentation.opacity).toBeLessThanOrEqual(.6);
  expect(presentation.textShadow).toContain("255, 255, 255");
}

function expectHighContrastShells(shells, widths) {
  expect(shells.map(({ color }) => color)).toEqual(iceShellColors.slice(0, shells.length));
  expect(shells.map(({ width }) => width)).toEqual(widths);
  expect(new Set(shells.map(({ radius }) => radius)).size).toBe(shells.length);
  for (const shell of shells) {
    expect(shell.shadow).toContain("49, 34, 66");
  }
}

async function expectColorAura(tile) {
  const presentation = await icedCandyPresentation(tile);
  expect(presentation.backgroundImage).toContain("radial-gradient");
  expect(presentation.aura).not.toBe("");
  expect(presentation.halo).not.toBe("");
  expect(presentation.filter).toBe("none");
}

test("Cascade one-layer ice keeps the candy color dominant", async ({ page }) => {
  await openLevel(page, 105);

  const coating = page.locator(".cascade-cell-coating:not(.ice-2):not(.ice-3)").first();
  await expect(coating).toBeVisible();
  expectReadableTransparentIce(await coatingPresentation(coating));
  expectHighContrastShells(await shellPresentation(coating), ["3px"]);

  const index = await coating.getAttribute("data-index");
  const tile = page.locator(`.cascade-tile[data-index="${index}"]`);
  await expect(tile).toBeVisible();
  await expectColorAura(tile);

  await page.screenshot({ path: `${output}/cascade-crush-ice-readable-desktop.png`, fullPage: true });
});

test("Cascade two-layer ice adds durability cues without darkening the candy", async ({ page }) => {
  await openLevel(page, 181);

  const coating = page.locator(".cascade-cell-coating.ice-2").first();
  await expect(coating).toBeVisible();
  expectReadableTransparentIce(await coatingPresentation(coating));
  await expect(coating.locator(".cascade-ice-shell")).toHaveCount(2);
  await expect(coating.locator(".cascade-ice-marker")).toHaveCount(2);
  expectHighContrastShells(await shellPresentation(coating), ["3px", "3.5px"]);

  const index = await coating.getAttribute("data-index");
  const tile = page.locator(`.cascade-tile[data-index="${index}"]`);
  await expect(tile).toBeVisible();
  await expectColorAura(tile);

  await page.screenshot({ path: `${output}/cascade-crush-ice-2-readable-desktop.png`, fullPage: true });
});

test("Cascade iced candy colors remain obvious on a phone-sized board", async ({ page }) => {
  await openLevel(page, 181, { width: 390, height: 844 });

  const coating = page.locator(".cascade-cell-coating.ice-2").first();
  await expect(coating).toBeVisible();
  expectReadableTransparentIce(await coatingPresentation(coating));
  expectHighContrastShells(await shellPresentation(coating), ["3px", "3.25px"]);

  const index = await coating.getAttribute("data-index");
  const tile = page.locator(`.cascade-tile[data-index="${index}"]`);
  await expect(tile).toBeVisible();
  await expectColorAura(tile);

  await page.screenshot({ path: `${output}/cascade-crush-ice-readable-mobile.png`, fullPage: true });
});
