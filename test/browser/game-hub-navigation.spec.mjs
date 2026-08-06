import { test, expect } from "@playwright/test";

test("the complete game cards open their game-specific menus", async ({ page }) => {
  await page.goto("/?player=hub-navigation-test");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator(".mode-grid")).toBeHidden();
  await expect(page.locator("#game-card-tic-tac-toe")).toContainText("CPU Opponent");

  const ticCard = page.locator("#game-card-tic-tac-toe");
  await expect(ticCard).toHaveAttribute("href", "/?game=tic-tac-toe&menu=1");
  await expect(ticCard.locator(".game-card-play")).toHaveText("Play now");
  await ticCard.locator(".game-card-body").click();
  await expect(page).toHaveURL(/game=tic-tac-toe&menu=1/);
  await expect(page.locator("body.gameframe-game-menu")).toBeVisible();
  await expect(page.locator("#challenge-bot")).toBeVisible();
  await expect(page.locator("#bot-challenge-label")).toHaveText("Challenge CPU Opponent");
  await expect(page.locator("#create-human-match")).toBeVisible();

  await page.locator("#gameframe-destination-bar [data-gameframe-home]").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();

  await page.locator("#game-card-othello .game-card-visual").click();
  await expect(page).toHaveURL(/\/othello\.html$/);
  await expect(page.locator("#othello-game-menu")).toBeVisible();
  await expect(page.locator("#othello-play-bot")).toBeVisible();
  await expect(page.locator("#othello-play-bot")).toContainText("Challenge OthelloBot");
  await expect(page.locator("#othello-play-local")).toBeVisible();
});

test("the destination bar is the only product navigation header during play", async ({ page }) => {
  await page.goto("/?game=american-checkers&menu=1&player=checkers-navigation-test");
  await page.locator("#challenge-bot").click();
  await expect(page.locator("#match-panel")).toBeVisible();
  await expect(page.locator("body.gameframe-shared-match-running")).toBeVisible();
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator(".shell > .hero")).toBeHidden();

  await page.goto("/monster-master.html?player=monster-navigation-test");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator(".monster-master-shell > .hero")).toBeHidden();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
});
