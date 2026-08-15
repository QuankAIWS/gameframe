import { test, expect } from "@playwright/test";

test("Casual Games keeps the player session visible and launches Cascade Crush", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "discord:casual-games-review",
        displayName: "Casual Player",
        source: "discord",
        admin: false,
      }),
    });
  });

  await page.goto("/casual-games.html");

  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-theme", "casual");
  await expect(bar.locator("[data-gameframe-destination-title]")).toHaveText("CASUAL GAMES");
  await expect(bar.locator("[data-gameframe-games]")).toHaveClass(/is-active/);

  const session = page.locator("#gameframe-session-badge");
  await expect(session).toBeVisible();
  await expect(session).toContainText("Casual Player");
  await session.locator("#gameframe-account-trigger").click();
  await expect(page.locator("#gameframe-account-panel")).toBeVisible();
  await expect(page.locator("#gameframe-account-panel")).toContainText("GameFrame account");

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
