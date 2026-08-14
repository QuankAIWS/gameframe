import { expect, test } from "@playwright/test";

async function expectBoardFirstMenu(page, gameId) {
  await page.goto(`/?game=${gameId}&menu=1&player=board-menu-${gameId}`);
  const menu = page.locator("#board-game-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("heading", { name: "Start a game" })).toBeVisible();
  await expect(page.locator("#match-panel")).toBeVisible();
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator(".game-menu-hero")).toHaveCount(0);
  await expect(menu.getByRole("button", { name: /Challenge a player/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Play the computer/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Two players here/ })).toBeVisible();
  return menu;
}

test("Tic-Tac-Toe opens on its board and supports true local alternating turns", async ({ page }) => {
  const menu = await expectBoardFirstMenu(page, "tic-tac-toe");
  await menu.getByRole("button", { name: /Two players here/ }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator("body")).toHaveClass(/board-game-local/);
  await expect(page.locator("#match-title")).toContainText("Pass & play");
  await expect(page.locator("#status")).toHaveText("X to move.");

  await page.locator(".tic-cell:enabled").first().click();
  await expect(page.locator("#status")).toHaveText("O to move.");
  await page.locator(".tic-cell:enabled").first().click();
  await expect(page.locator("#status")).toHaveText("X to move.");

  await page.locator("#new-match").click();
  await expect(menu).toBeVisible();
  await expect(page.locator("#new-match")).toHaveText("Game menu");
});

test("Clockwork Checkers opens on its board and local play changes sides", async ({ page }) => {
  const menu = await expectBoardFirstMenu(page, "american-checkers");
  await menu.getByRole("button", { name: /Two players here/ }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator("body")).toHaveClass(/board-game-local/);
  await expect(page.locator("#match-title")).toContainText("Pass & play");
  await expect(page.locator("#status")).toHaveText("Black to move.");
  await expect(page.locator(".checkers-piece")).toHaveCount(24);

  const piece = page.locator(".checkers-cell.selectable-piece").first();
  await expect(piece).toBeEnabled();
  await piece.click();
  const destination = page.locator(".checkers-cell.legal-destination").first();
  await expect(destination).toBeEnabled();
  await destination.click();
  await expect(page.locator("#status")).toHaveText("Red to move.");
  await expect(page.locator(".checkers-piece")).toHaveCount(24);

  await page.locator("#new-match").click();
  await expect(menu).toBeVisible();
});
