import { expect, test } from "@playwright/test";

test("opens Monster Master from the current game library", async ({ page }) => {
  await page.goto("/?player=monster-navigation");
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  const card = page.locator("#game-card-monster-master");
  await expect(card).toHaveAttribute("href", "/monster-master.html");
  await card.locator(".game-card-body").click();
  await expect(page).toHaveURL(/\/monster-master\.html/);
  await expect(page).toHaveTitle(/Monster Master/);
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
});

test("returns from Monster Master through the universal destination bar", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-navigation-home");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator('.combat-nav a[href="/combat.html"], .combat-nav a[href="/tactical.html"]')).toHaveCount(0);
  await page.locator("#gameframe-destination-bar [data-gameframe-home]").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await expect(page.locator("#game-card-monster-master")).toBeVisible();
});

test("opens and closes Monster Master diagnostics", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-diagnostics");
  await page.locator("#monster-master-bot").click();
  await expect(page.locator("#monster-master-match")).toBeVisible();

  const diagnostics = page.locator("details.diagnostics");
  await diagnostics.locator("summary").click();
  await expect(diagnostics).toHaveAttribute("open", "");
  await expect(page.locator("#monster-master-details")).toContainText("monster-master-duel");

  await diagnostics.locator("summary").click();
  await expect(diagnostics).not.toHaveAttribute("open", "");
});
