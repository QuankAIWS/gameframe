import { expect, test } from "@playwright/test";

test("Monster Master presents the player as trainer and keeps Setup in the top navigation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/monster-master.html?player=monster-trainer-shell");

  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(page.locator(".monster-master-match-topbar")).toHaveCount(0);
  await expect(page.getByText("Warden Duel", { exact: true })).toHaveCount(0);
  await expect(page.locator("#monster-master-new-match")).toBeHidden();
  await expect(page.locator(".hero-copy")).toContainText("trainer's seat");

  await page.locator("#monster-master-theo").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();

  const setup = page.locator("#gameframe-destination-bar #monster-master-new-match");
  await expect(setup).toBeVisible();
  await expect(setup).toHaveText("Setup");
  await expect(page.locator(".monster-master-board-briefing #monster-master-status")).toBeVisible();
  await expect(page.locator("#monster-master-roster-list")).toContainText("Verdant Sage");
  await expect(page.locator("#monster-master-match")).not.toContainText("Warden Master");
  await expect(page.locator("#monster-master-match")).not.toContainText("Warden Duel");

  await page.screenshot({
    path: testInfo.outputPath("monster-master-trainer-shell-desktop.png"),
    fullPage: true,
  });

  await setup.click();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(setup).toBeHidden();
});
