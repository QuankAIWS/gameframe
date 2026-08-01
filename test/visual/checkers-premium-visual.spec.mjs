import { expect, test } from "@playwright/test";

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.scrollTo(0, 0);
  });
}

async function capture(page, testInfo, name) {
  await settle(page);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test("captures premium Checkers match and move-selection states", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/?game=american-checkers&player=visual-checkers-premium");
  await page.locator("#challenge-theo").click();
  await expect(page.locator("body")).toHaveClass(/checkers-premium-active/);
  await expect(page.locator("#checkers-intel-rail")).toBeVisible();
  await capture(page, testInfo, "31-checkers-premium-opening");

  await page.locator(".checkers-cell.selectable-piece").first().click();
  await expect(page.locator(".checkers-cell.legal-destination").first()).toBeVisible();
  await capture(page, testInfo, "32-checkers-premium-move-selection");

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, "33-checkers-premium-mobile");
});
