import { test, expect } from "@playwright/test";

test("Casual Games stays focused on Cascade Crush and launches it", async ({ page }) => {
  await page.goto("/casual-games.html?player=casual-games-review");

  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-theme", "casual");
  await expect(bar.locator("[data-gameframe-destination-title]")).toHaveText("CASUAL GAMES");
  await expect(bar.locator("[data-gameframe-games]")).toHaveClass(/is-active/);

  await expect(page.getByRole("heading", { name: "Casual Games", exact: true })).toBeAttached();
  await expect(page.locator(".casual-card")).toHaveCount(1);
  await expect(page.getByText("Short games. Dangerous “one more round” energy.")).toHaveCount(0);
  await expect(page.getByText(/Additional casual-game families can land here/)).toHaveCount(0);

  const launcher = page.getByRole("link", { name: "Open Cascade Crush", exact: true });
  await expect(launcher).toBeVisible();
  await expect(launcher).toContainText("Cascade Crush");
  await expect(launcher).toContainText("300 levels");
  await expect(launcher.locator(".cascade-preview-board i")).toHaveCount(48);

  await launcher.click();
  await expect(page).toHaveURL(/\/cascade\.html$/);
  await expect(page).toHaveTitle(/Cascade Crush/);
  await expect(page.getByRole("heading", { name: "Cascade Crush", exact: true })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
});
