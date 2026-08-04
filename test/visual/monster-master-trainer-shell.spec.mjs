import { expect, test } from "@playwright/test";

test("Monster Master presents the player as trainer with compact optional battlefield hints", async ({ page }, testInfo) => {
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
  await expect(page.locator("body.monster-master-hints-ready")).toBeVisible();

  const setup = page.locator("#gameframe-destination-bar #monster-master-new-match");
  const hints = page.locator("#monster-master-hints-enabled");
  const hintControl = page.locator(".monster-master-hints-toggle");
  const toast = page.locator("#monster-master-status-toast");
  await expect(setup).toBeVisible();
  await expect(setup).toHaveText("Setup");
  await expect(page.locator(".monster-master-board-briefing")).toHaveClass(/monster-master-hint-layer/);
  await expect(hintControl).toBeVisible();
  await expect(hints).toBeChecked();
  await expect(toast).toHaveClass(/is-visible/);
  await expect(page.locator("#monster-master-status")).toContainText(/deploy|activation/i);
  await expect(page.locator("#monster-master-roster-list")).toContainText("Verdant Sage");
  await expect(page.locator("#monster-master-match")).not.toContainText("Warden Master");
  await expect(page.locator("#monster-master-match")).not.toContainText("Warden Duel");

  const stageGeometry = await page.locator(".monster-master-battlefield-stage").evaluate((stage) => {
    const frame = stage.querySelector(".combat-canvas-frame");
    const layer = stage.querySelector(".monster-master-hint-layer");
    return {
      stageHeight: stage.getBoundingClientRect().height,
      frameHeight: frame?.getBoundingClientRect().height ?? 0,
      layerPosition: layer ? getComputedStyle(layer).position : "",
    };
  });
  expect(Math.abs(stageGeometry.stageHeight - stageGeometry.frameHeight)).toBeLessThanOrEqual(2);
  expect(stageGeometry.layerPosition).toBe("absolute");

  await hintControl.click();
  await expect(hints).not.toBeChecked();
  await expect(page.locator("body.monster-master-hints-disabled")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gameframe:monster-master:hints-enabled"))).toBe("false");
  await hintControl.click();
  await expect(hints).toBeChecked();
  await expect(page.locator("body.monster-master-hints-disabled")).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath("monster-master-trainer-shell-desktop.png"),
    fullPage: true,
  });

  await setup.click();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(setup).toBeHidden();
});
