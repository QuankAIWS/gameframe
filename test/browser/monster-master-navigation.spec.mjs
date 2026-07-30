import { expect, test } from "@playwright/test";

test("opens Monster Master from the existing tactical navigation chain", async ({ page }) => {
  await page.goto("/tactical.html?player=monster-navigation");
  await page.getByRole("link", { name: "Monster Master" }).click();
  await expect(page).toHaveURL(/\/monster-master\.html/);
  await expect(page.getByRole("heading", { name: "Monster Master", exact: true })).toBeVisible();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
});

test("returns from Monster Master to Tactical Combat", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-navigation-return");
  await page.getByRole("link", { name: "Combat canary" }).click();
  await expect(page).toHaveURL(/\/combat\.html/);
  await expect(page.getByRole("heading", { name: "Tactical Combat", exact: true })).toBeVisible();
});
