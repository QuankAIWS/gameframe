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

  const [headerBox, mapBox, boardWrapBox, boardBox, utilityBox, statusBox] = await Promise.all([
    header.boundingBox(),
    map.boundingBox(),
    boardWrap.boundingBox(),
    board.boundingBox(),
    utility.boundingBox(),
    status.boundingBox(),
  ]);

  for (const box of [headerBox, mapBox, boardWrapBox, boardBox, utilityBox, statusBox]) expect(box).toBeTruthy();

  // TV topology: brand/progress | board | utilities | primary readouts.
  expect(headerBox.x + headerBox.width).toBeLessThan(boardWrapBox.x);
  expect(mapBox.x + mapBox.width).toBeLessThan(boardWrapBox.x);
  expect(boardWrapBox.x + boardWrapBox.width).toBeLessThan(utilityBox.x);
  expect(utilityBox.x + utilityBox.width).toBeLessThan(statusBox.x);

  // Persistent UI consumes width, not extra height beyond the play cabinet.
  expect(Math.abs(utilityBox.y - boardWrapBox.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(statusBox.y - boardWrapBox.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(utilityBox.height - boardWrapBox.height)).toBeLessThanOrEqual(3);
  expect(Math.abs(statusBox.height - boardWrapBox.height)).toBeLessThanOrEqual(3);

  // The active board remains fully visible and large at aggressive zoom.
  expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(540);
  expect(boardBox.width).toBeGreaterThan(350);

  // MOVES LEFT remains the strongest at-a-glance readout.
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
