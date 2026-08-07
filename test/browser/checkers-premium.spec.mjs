import { expect, test } from "@playwright/test";

test("selecting Checkers exposes the premium board title as a real heading", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?player=checkers-heading-contract");
  await page.locator("#select-checkers").click();
  await expect(page.getByRole("heading", { name: "American Checkers" })).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/checkers-premium-active/);
});

test("premium Checkers skin preserves authoritative selection and movement", async ({ page }) => {
  await page.goto("/?game=american-checkers&player=browser-checkers-premium");
  await page.locator("#challenge-bot").click();

  await expect(page.locator("#board")).toHaveClass(/board-checkers/);
  await expect(page.locator("body")).toHaveClass(/checkers-premium-active/);
  await expect(page.locator("#checkers-intel-rail")).toBeVisible();
  await expect(page.locator(".checkers-board-shell")).toBeVisible();
  await expect(page.locator("#player-x .checkers-captured-summary")).toBeVisible();

  const blackPieceImage = await page.locator(".piece-black").first().evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(blackPieceImage).toContain("/assets/checkers/clockwork-eclipse/piece-lunar.svg");

  const selectable = page.locator(".checkers-cell.selectable-piece").first();
  await expect(selectable).toBeEnabled();
  await selectable.click();
  await expect(page.locator(".checkers-cell.selected-piece")).toHaveCount(1);
  const destinations = page.locator(".checkers-cell.legal-destination");
  await expect(destinations.first()).toBeVisible();

  const before = Number((await page.locator("#revision").textContent()).match(/\d+/)?.[0] ?? 0);
  await destinations.first().click();
  await expect.poll(async () => Number((await page.locator("#revision").textContent()).match(/\d+/)?.[0] ?? 0)).toBeGreaterThan(before);
  await expect(page.locator("#board")).toHaveClass(/board-checkers/);
});

test("premium Checkers layout remains bounded on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?game=american-checkers&player=mobile-checkers-premium");
  await page.locator("#challenge-bot").click();
  await expect(page.locator("body")).toHaveClass(/checkers-premium-active/);
  await expect(page.locator("#board")).toBeVisible();
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    boardWidth: document.querySelector("#board")?.getBoundingClientRect().width ?? 0,
  }));
  expect(overflow.horizontal).toBeLessThanOrEqual(1);
  expect(overflow.boardWidth).toBeGreaterThan(260);
});
