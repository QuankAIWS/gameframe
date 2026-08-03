import { test, expect } from "@playwright/test";

async function expectStyledDestinationBar(page, theme) {
  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-theme", theme);
  await expect.poll(() => bar.evaluate((node) => getComputedStyle(node).display)).toBe("grid");
  await expect.poll(() => bar.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
  await expect.poll(() => page.locator("#gameframe-session-badge").evaluate((node) => getComputedStyle(node).position)).toBe("fixed");
}

test("Tic-Tac-Toe keeps only the styled universal destination bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?game=tic-tac-toe&menu=1&player=tic-style-regression");
  await page.locator("#challenge-theo").click();

  await expect(page.locator("body.tic-tac-toe-noir-running")).toBeVisible();
  await expectStyledDestinationBar(page, "tic");
  await expect(page.locator(".tic-noir-topbar")).toHaveCount(0);
  await expect(page.locator(".tic-noir-board-frame")).toBeVisible();
  await expect(page.locator(".tic-noir-control-rail")).toBeVisible();
});

test("Checkers never inherits Tic-Tac-Toe presentation wrappers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?game=american-checkers&menu=1&player=checkers-style-regression");
  await page.locator("#challenge-theo").click();

  await expect(page.locator("body.gameframe-shared-match-running")).toBeVisible();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toHaveCount(0);
  await expectStyledDestinationBar(page, "checkers");
  await expect(page.locator("#board.board-checkers")).toBeVisible();
  await expect(page.locator("#board .checkers-cell")).toHaveCount(64);
  await expect(page.locator(".tic-noir-board-frame")).toHaveCount(0);
  await expect(page.locator(".tic-noir-control-rail")).toHaveCount(0);
  await expect(page.locator(".tic-noir-footer")).toHaveCount(0);
});
