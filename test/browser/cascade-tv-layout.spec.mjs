import { expect, test } from "@playwright/test";

test("Cascade keeps the full TV cabinet around a board-height playfield under browser zoom", async ({ page }) => {
  // 960x540 approximates a 1920x1080 television viewed at 200% browser zoom.
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html?player=cascade-tv-layout-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const header = page.locator(".cascade-header");
  const map = page.locator(".cascade-map");
  const boardWrap = page.locator(".cascade-board-wrap");
  const board = page.locator(".cascade-board");
  const utility = page.locator(".cascade-side");
  const status = page.locator(".cascade-status");

  await expect(map).toBeVisible();
  await expect(page.locator(".cascade-help")).toBeHidden();

  // Even at level 1 the run track should fill from the available future
  // levels instead of showing four dots in a mostly-empty sidewall.
  const visibleLevelRows = await page.locator("#level-map > li:visible").count();
  expect(visibleLevelRows).toBeGreaterThanOrEqual(10);
  expect(visibleLevelRows).toBeLessThanOrEqual(11);

  const [headerBox, mapBox, boardWrapBox, boardBox, utilityBox, statusBox] = await Promise.all([
    header.boundingBox(),
    map.boundingBox(),
    boardWrap.boundingBox(),
    board.boundingBox(),
    utility.boundingBox(),
    status.boundingBox(),
  ]);

  for (const box of [headerBox, mapBox, boardWrapBox, boardBox, utilityBox, statusBox]) expect(box).toBeTruthy();

  // TV topology: brand/progress | board | one right-side game dock. The dock
  // puts the compact Moves/Lives HUD above the utility controls instead of
  // spending a second full-height column on primary readouts.
  expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(boardWrapBox.x);
  expect(mapBox.x + mapBox.width).toBeLessThanOrEqual(boardWrapBox.x);
  expect(boardWrapBox.x + boardWrapBox.width).toBeLessThanOrEqual(statusBox.x);
  expect(boardWrapBox.x + boardWrapBox.width).toBeLessThanOrEqual(utilityBox.x);
  expect(Math.abs(statusBox.x - utilityBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(statusBox.width - utilityBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs((statusBox.y + statusBox.height) - utilityBox.y)).toBeLessThanOrEqual(2);

  // The combined right dock owns the cabinet height while the board remains a
  // shallow recessed window. It should bracket the board closely without an
  // empty full-height status trough beside it.
  const boardBottom = boardWrapBox.y + boardWrapBox.height;
  const utilityBottom = utilityBox.y + utilityBox.height;
  expect(statusBox.y).toBeLessThanOrEqual(boardWrapBox.y);
  expect(utilityBottom).toBeGreaterThanOrEqual(boardBottom);
  expect(boardWrapBox.y - statusBox.y).toBeLessThanOrEqual(8);
  expect(utilityBottom - boardBottom).toBeLessThanOrEqual(8);
  expect(statusBox.height).toBeLessThan(boardWrapBox.height * .3);

  // The active board remains fully visible and large at aggressive zoom.
  expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(540);
  expect(boardBox.width).toBeGreaterThan(350);

  // MOVES LEFT remains the strongest at-a-glance readout without occupying a
  // whole side rail.
  const moves = page.locator("#moves");
  const level = page.locator("#level-number");
  const [movesSize, levelSize] = await Promise.all([
    moves.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    level.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ]);
  expect(movesSize).toBeGreaterThan(levelSize * 1.5);
});

test("Cascade keeps the compact mobile layout in portrait", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto("/cascade.html?player=cascade-tv-layout-mobile-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const statusBox = await page.locator(".cascade-status").boundingBox();
  const boardWrapBox = await page.locator(".cascade-board-wrap").boundingBox();
  expect(statusBox).toBeTruthy();
  expect(boardWrapBox).toBeTruthy();
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(boardWrapBox.y);
});
