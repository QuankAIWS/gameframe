import { expect, test } from "@playwright/test";

async function expectBoardFullyContained(page) {
  const geometry = await page.locator(".cascade-board-wrap").evaluate((wrap) => {
    const board = wrap.querySelector(".cascade-board");
    const tiles = board ? [...board.querySelectorAll(".cascade-tile")] : [];
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };

    const wrapRect = rect(wrap);
    const boardRect = board ? rect(board) : null;
    const tileRects = tiles.map((tile) => rect(tile));
    const blockedTileIndexes = tiles.flatMap((tile, index) => {
      const box = tile.getBoundingClientRect();
      const x = box.left + (box.width / 2);
      const y = box.top + (box.height / 2);
      const hit = document.elementFromPoint(x, y);
      return hit && (hit === tile || tile.contains(hit)) ? [] : [index];
    });

    return { wrapRect, boardRect, tileRects, blockedTileIndexes };
  });

  expect(geometry.boardRect).toBeTruthy();
  expect(geometry.tileRects).toHaveLength(64);
  expect(geometry.blockedTileIndexes).toEqual([]);

  const epsilon = 1;
  expect(geometry.boardRect.left).toBeGreaterThanOrEqual(geometry.wrapRect.left - epsilon);
  expect(geometry.boardRect.top).toBeGreaterThanOrEqual(geometry.wrapRect.top - epsilon);
  expect(geometry.boardRect.right).toBeLessThanOrEqual(geometry.wrapRect.right + epsilon);
  expect(geometry.boardRect.bottom).toBeLessThanOrEqual(geometry.wrapRect.bottom + epsilon);

  for (const tileRect of geometry.tileRects) {
    expect(tileRect.left).toBeGreaterThanOrEqual(geometry.wrapRect.left - epsilon);
    expect(tileRect.top).toBeGreaterThanOrEqual(geometry.wrapRect.top - epsilon);
    expect(tileRect.right).toBeLessThanOrEqual(geometry.wrapRect.right + epsilon);
    expect(tileRect.bottom).toBeLessThanOrEqual(geometry.wrapRect.bottom + epsilon);
    expect(tileRect.width).toBeGreaterThan(0);
    expect(tileRect.height).toBeGreaterThan(0);
  }
}

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
  await expect(page.locator("#score")).toBeVisible();

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
  // stacks a compact Score row above the Moves/Lives row and utility controls
  // instead of spending a second full-height column on primary readouts.
  expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(boardWrapBox.x);
  expect(mapBox.x + mapBox.width).toBeLessThanOrEqual(boardWrapBox.x);
  expect(boardWrapBox.x + boardWrapBox.width).toBeLessThanOrEqual(statusBox.x);
  expect(boardWrapBox.x + boardWrapBox.width).toBeLessThanOrEqual(utilityBox.x);
  expect(Math.abs(statusBox.x - utilityBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(statusBox.width - utilityBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs((statusBox.y + statusBox.height) - utilityBox.y)).toBeLessThanOrEqual(2);

  const boardBottom = boardWrapBox.y + boardWrapBox.height;
  const utilityBottom = utilityBox.y + utilityBox.height;
  expect(statusBox.y).toBeLessThanOrEqual(boardWrapBox.y);
  expect(utilityBottom).toBeGreaterThanOrEqual(boardBottom);
  expect(boardWrapBox.y - statusBox.y).toBeLessThanOrEqual(8);
  expect(utilityBottom - boardBottom).toBeLessThanOrEqual(8);
  // Score + Moves/Lives must still consume well under half the board height.
  expect(statusBox.height).toBeLessThan(boardWrapBox.height * .42);

  // The active board remains fully visible, fully contained by its recess,
  // and every tile center stays hittable at aggressive zoom.
  expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(540);
  expect(boardBox.width).toBeGreaterThan(350);
  await expectBoardFullyContained(page);

  // MOVES LEFT remains a strong at-a-glance readout while Score gets its own
  // wide counter above it.
  const moves = page.locator("#moves");
  const level = page.locator("#level-number");
  const [movesSize, levelSize] = await Promise.all([
    moves.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    level.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ]);
  expect(movesSize).toBeGreaterThan(levelSize * 1.5);
});

test("Cascade keeps every tile contained in the wide TV cabinet", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cascade.html?player=cascade-tv-layout-wide-containment-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expectBoardFullyContained(page);
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