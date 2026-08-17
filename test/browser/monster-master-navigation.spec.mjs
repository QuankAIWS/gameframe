import { expect, test } from "@playwright/test";

test("opens Monster Master through Battle Simulator", async ({ page }) => {
  await page.goto("/?catalog=1&player=monster-navigation");
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();

  const simulatorCard = page.locator("#game-card-battle-simulator");
  await expect(simulatorCard).toBeVisible();
  await expect(simulatorCard).toHaveAttribute("href", "/battle-simulator.html");
  await simulatorCard.locator(".game-card-body").click();

  await expect(page).toHaveURL(/\/battle-simulator\.html/);
  await expect(page.getByRole("heading", { name: "Monster Master Arena Battles" })).toBeVisible();

  const monsterMasterLink = page.getByRole("link", { name: "Open Monster Master Arena" });
  await expect(monsterMasterLink).toHaveAttribute("href", "/monster-master.html");
  await monsterMasterLink.click();

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
  await expect(page.locator(".gameframe-home-dashboard")).toBeVisible();
  await expect(page.locator("#game-grid")).toBeHidden();
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-home]")).toHaveClass(/is-active/);
});

test("opens and closes Monster Master diagnostics", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-diagnostics");
  await page.locator("#monster-master-bot").click();
  await expect(page.locator("#monster-master-match")).toBeVisible();

  const diagnostics = page.locator("details.diagnostics");
  await diagnostics.locator("summary").dispatchEvent("click");
  await expect(diagnostics).toHaveAttribute("open", "");
  await expect(page.locator("#monster-master-details")).toContainText("monster-master-duel");

  await diagnostics.locator("summary").dispatchEvent("click");
  await expect(diagnostics).not.toHaveAttribute("open", "");
});
