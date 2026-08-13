import { test, expect } from "@playwright/test";

async function expectStyledDestinationBar(page, theme) {
  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-theme", theme);
  await expect.poll(() => bar.evaluate((node) => getComputedStyle(node).display)).toBe("grid");
  await expect.poll(() => bar.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
  await expect.poll(() => page.locator("#gameframe-session-badge").evaluate((node) => getComputedStyle(node).position)).toBe("fixed");
}

async function openTic(page, viewport, player) {
  await page.setViewportSize(viewport);
  await page.goto(`/?game=tic-tac-toe&menu=1&player=${player}`);
  await expect(page.locator("#board-game-menu")).toBeVisible();
  await page.locator("#board-menu-computer").click();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toBeVisible();
  await expectStyledDestinationBar(page, "tic");
  await expect(page.locator(".tic-noir-topbar")).toHaveCount(0);
  await expect(page.locator(".tic-noir-board-frame")).toBeVisible();
  await expect(page.locator(".tic-noir-control-rail")).toBeVisible();
}

test("Tic-Tac-Toe keeps only the styled universal destination bar on mobile", async ({ page }) => {
  await openTic(page, { width: 390, height: 844 }, "tic-style-regression-mobile");

  const board = await page.locator(".tic-noir-board-frame").boundingBox();
  if (!board) throw new Error("Tic mobile board did not produce layout bounds.");
  expect(board.width).toBeGreaterThanOrEqual(330);
  expect(board.height).toBeGreaterThanOrEqual(330);
});

test("Tic-Tac-Toe uses a two-row desktop viewport with an unclipped board and telemetry", async ({ page }) => {
  await openTic(page, { width: 1440, height: 960 }, "tic-style-regression-desktop");

  const rows = await page.locator("#match-panel").evaluate((node) =>
    getComputedStyle(node).gridTemplateRows.split(/\s+/).filter(Boolean),
  );
  expect(rows).toHaveLength(2);

  const board = await page.locator(".tic-noir-board-frame").boundingBox();
  const firstPlayer = await page.locator("#player-x").boundingBox();
  const secondPlayer = await page.locator("#player-o").boundingBox();
  const footer = await page.locator(".tic-noir-footer").boundingBox();
  if (!board || !firstPlayer || !secondPlayer || !footer) {
    throw new Error("Tic desktop composition did not produce complete layout bounds.");
  }

  expect(board.width).toBeGreaterThanOrEqual(460);
  expect(board.width).toBeLessThanOrEqual(700);
  expect(board.height).toBeGreaterThanOrEqual(460);
  expect(firstPlayer.height).toBeGreaterThanOrEqual(70);
  expect(secondPlayer.height).toBeGreaterThanOrEqual(70);
  expect(footer.height).toBeLessThanOrEqual(64);
  expect(board.y).toBeGreaterThanOrEqual(80);
  expect(board.y + board.height).toBeLessThanOrEqual(footer.y);
});

test("Checkers never inherits Tic-Tac-Toe presentation wrappers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?game=american-checkers&menu=1&player=checkers-style-regression");
  await expect(page.locator("#board-game-menu")).toBeVisible();
  await page.locator("#board-menu-computer").click();

  await expect(page.locator("body.gameframe-shared-match-running")).toBeVisible();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toHaveCount(0);
  await expectStyledDestinationBar(page, "checkers");
  await expect(page.locator("#board.board-checkers")).toBeVisible();
  await expect(page.locator("#board .checkers-cell")).toHaveCount(64);
  await expect(page.locator(".tic-noir-board-frame")).toHaveCount(0);
  await expect(page.locator(".tic-noir-control-rail")).toHaveCount(0);
  await expect(page.locator(".tic-noir-footer")).toHaveCount(0);
});
