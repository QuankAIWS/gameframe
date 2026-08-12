import { expect, test } from "@playwright/test";

const stateKey = "scribbles-gameframe.cascade-state:v1";

async function prepare(page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      level: 9,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, stateKey);
}

test("Cascade Quick Recall cannot be dismissed with Escape mid-round", async ({ page }) => {
  await prepare(page);
  await page.goto("/cascade.html");
  await expect.poll(() => page.evaluate(() => Boolean(window.cascadeBonusModes))).toBe(true);

  await page.evaluate(() => window.cascadeBonusModes.startQuickRecall(8));
  const dialog = page.locator("#cascade-recall-dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-recall-kicker]")).toHaveText("QUICK RECALL");
});
