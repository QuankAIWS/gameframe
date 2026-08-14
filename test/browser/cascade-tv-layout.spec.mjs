import { expect, test } from "@playwright/test";

test("Cascade keeps the TV side rail under aggressive browser-zoom dimensions", async ({ page }) => {
  // 960x540 approximates a 1920x1080 television viewed at 200% browser zoom.
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html?player=cascade-tv-layout-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const status = page.locator(".cascade-status");
  const header = page.locator(".cascade-header");
  const boardWrap = page.locator(".cascade-board-wrap");
  const board = page.locator(".cascade-board");

  const [statusBox, headerBox, boardWrapBox, boardBox] = await Promise.all([
    status.boundingBox(),
    header.boundingBox(),
    boardWrap.boundingBox(),
    board.boundingBox(),
  ]);

  expect(statusBox).toBeTruthy();
  expect(headerBox).toBeTruthy();
  expect(boardWrapBox).toBeTruthy();
  expect(boardBox).toBeTruthy();

  // Branding and primary status live beside the board instead of consuming
  // vertical space above it.
  expect(statusBox.x + statusBox.width).toBeLessThan(boardWrapBox.x);
  expect(headerBox.x + headerBox.width).toBeLessThan(boardWrapBox.x);

  // The active board remains fully visible in the zoomed viewport.
  expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(540);
  expect(boardBox.width).toBeGreaterThan(360);

  // Nonessential active-play chrome gets out of the way.
  await expect(page.locator(".cascade-map")).toBeHidden();
  await expect(page.locator(".cascade-help")).toBeHidden();

  // MOVES LEFT remains the strongest at-a-glance read on the rail.
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
