import { expect, test } from "@playwright/test";

const reviewStates = {
  obsidian: 34,
  neon: 27,
  garden: 27,
};

for (const [theme, state] of Object.entries(reviewStates)) {
  test(`captures the ${theme} Othello product theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(`/othello.html?theme=${theme}&state=${state}&snapshot=1`);
    await expect(page.locator("#othello-board")).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-theme", theme);
    await page.screenshot({
      path: test.info().outputPath(`othello-${theme}-desktop.png`),
      fullPage: false,
    });
  });
}

test("captures the Living Garden water-integration composition", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/othello.html?theme=garden&state=27&snapshot=1");
  await expect(page.locator("#othello-board")).toBeVisible();
  await expect(page.locator(".garden-pad-a")).toHaveCSS("opacity", "0.66");
  await expect(page.locator(".garden-ripple-a")).toHaveCSS("border-top-width", "0px");
  await page.screenshot({
    path: test.info().outputPath("othello-garden-water-integration.png"),
    fullPage: false,
  });
});

test("captures the Living Garden mobile composition", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/othello.html?theme=garden&state=27&snapshot=1");
  await expect(page.locator("#othello-board")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "garden");
  await page.screenshot({
    path: test.info().outputPath("othello-garden-mobile.png"),
    fullPage: true,
  });
});
