import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const desktop = { width: 1440, height: 960 };
const mobile = { width: 390, height: 844 };

async function captureCasualGames(page, viewport, filename) {
  await page.setViewportSize(viewport);
  await page.goto("/casual-games.html");

  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-theme", "casual");
  await expect(bar.locator("[data-gameframe-destination-title]")).toHaveText("CASUAL GAMES");
  await expect(bar.locator("[data-gameframe-games]")).toHaveClass(/is-active/);

  await expect(page.locator(".casual-card")).toHaveCount(1);
  const launcher = page.getByRole("link", { name: "Open Cascade Crush", exact: true });
  await expect(launcher).toBeVisible();
  await expect(launcher).toContainText("Cascade Crush");
  await expect(launcher).toContainText("300 levels");
  await expect(launcher.locator(".cascade-preview-board i")).toHaveCount(48);
  await expect(page.getByText("Short games. Dangerous “one more round” energy.")).toHaveCount(0);
  await expect(page.getByText(/Additional casual-game families can land here/)).toHaveCount(0);

  await page.screenshot({ path: `${output}/${filename}`, fullPage: true });
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("capture Casual Games launcher at desktop and mobile sizes", async ({ page }) => {
  await captureCasualGames(page, desktop, "casual-games-desktop.png");
  await captureCasualGames(page, mobile, "casual-games-mobile.png");
});
