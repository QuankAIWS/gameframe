import { expect, test } from "@playwright/test";

const themes = ["obsidian", "neon", "garden"];

for (const theme of themes) {
  test(`captures the ${theme} Othello procedural theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(`/othello.html?theme=${theme}&state=midgame`);
    await expect(page.locator("#othello-board")).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-theme", theme);
    await page.screenshot({
      path: test.info().outputPath(`othello-${theme}-desktop.png`),
      fullPage: true,
    });
  });
}

test("captures the Living Garden mobile composition", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/othello.html?theme=garden&state=midgame");
  await expect(page.locator("#othello-board")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "garden");
  await page.screenshot({
    path: test.info().outputPath("othello-garden-mobile.png"),
    fullPage: true,
  });
});
