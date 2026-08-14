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

async function cabinetSurfaceStats(page) {
  return page.evaluate(() => {
    const shell = getComputedStyle(document.querySelector(".cascade-shell"));
    const card = getComputedStyle(document.querySelector(".cascade-side .cascade-card"));
    const ordinaryStatus = getComputedStyle(document.querySelector(".cascade-status > div:first-child"));
    const movesStatus = getComputedStyle(document.querySelector(".cascade-status > div:nth-child(4)"));
    const side = getComputedStyle(document.querySelector(".cascade-side"));
    return {
      shellRadius: Number.parseFloat(shell.borderTopLeftRadius),
      shellBorder: Number.parseFloat(shell.borderTopWidth),
      cardRadius: Number.parseFloat(card.borderTopLeftRadius),
      cardBorder: Number.parseFloat(card.borderTopWidth),
      cardShadow: card.boxShadow,
      ordinaryStatusRadius: Number.parseFloat(ordinaryStatus.borderTopLeftRadius),
      ordinaryStatusBorder: Number.parseFloat(ordinaryStatus.borderTopWidth),
      movesStatusRadius: Number.parseFloat(movesStatus.borderTopLeftRadius),
      sideGap: side.rowGap,
    };
  });
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

  const surfaces = await cabinetSurfaceStats(page);
  expect(surfaces.shellRadius).toBeGreaterThanOrEqual(24);
  expect(surfaces.shellBorder).toBeGreaterThanOrEqual(2);
  expect(surfaces.cardRadius).toBe(0);
  expect(surfaces.cardBorder).toBe(0);
  expect(surfaces.cardShadow).toBe("none");
  expect(surfaces.ordinaryStatusRadius).toBe(0);
  expect(surfaces.ordinaryStatusBorder).toBe(0);
  expect(surfaces.movesStatusRadius).toBeGreaterThanOrEqual(14);
  expect(surfaces.sideGap).toBe("0px");

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

  const surfaces = await cabinetSurfaceStats(page);
  expect(surfaces.shellRadius).toBeGreaterThanOrEqual(24);
  expect(surfaces.cardRadius).toBe(0);
  expect(surfaces.ordinaryStatusRadius).toBe(0);
  expect(surfaces.movesStatusRadius).toBeGreaterThanOrEqual(14);

  await page.screenshot({ path: `${output}/cascade-tv-cabinet-wide.png`, fullPage: true });
});