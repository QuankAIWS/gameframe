import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("Quick Recall keeps the player's entered colors visible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cascade.html?player=quick-recall-visual");
  await page.evaluate(() => window.cascadeBonusModes.startQuickRecall(8));

  const dialog = page.locator("#cascade-recall-dialog");
  const choices = dialog.locator("[data-recall-choices]");
  const stage = dialog.locator("[data-recall-stage]");
  await expect(choices).toBeVisible({ timeout: 8_000 });
  await choices.locator("button").nth(1).click();
  await expect(stage.locator(".is-recall-entered")).toHaveCount(1);
  await expect(dialog.locator("[data-recall-progress]")).toHaveText("REPEAT · 1/2");

  await page.screenshot({ path: `${output}/cascade-quick-recall-entry-mobile.png`, fullPage: true });
});
