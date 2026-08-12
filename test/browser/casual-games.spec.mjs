import { test, expect } from "@playwright/test";

test("Games catalog opens the focused Casual Games shelf and launches Cascade Crush", async ({ page }) => {
  await page.goto("/?catalog=1&player=casual-games-review");

  const destination = page.locator("#game-card-casual-games");
  await expect(destination).toBeVisible();
  await expect(destination).toContainText("Casual Games");
  await expect(destination).toHaveAttribute("href", "/casual-games.html");
  await destination.click();

  await expect(page).toHaveURL(/\/casual-games\.html$/);
  await expect(page.getByRole("heading", { name: "Casual Games", exact: true })).toBeVisible();
  await expect(page.getByText("Short games. Dangerous “one more round” energy.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Small, polished games built for quick sessions and repeated play.", { exact: true })).toHaveCount(0);
  await expect(page.locator(".casual-future")).toHaveCount(0);

  const cascade = page.getByRole("link", { name: "Open Cascade Crush", exact: true });
  await expect(cascade).toBeVisible();
  await expect(cascade).toHaveAttribute("href", "/cascade.html");
  await expect(cascade).toContainText("Cascade Crush");
  await expect(cascade).toContainText("300 LEVELS");

  const art = cascade.locator(".casual-card-art img");
  await expect(art).toHaveAttribute("src", "/assets/gameframe/cards/cascade-crush-card.webp");
  await expect.poll(() => art.evaluate((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);

  await cascade.click();
  await expect(page).toHaveURL(/\/cascade\.html$/);
  await expect(page).toHaveTitle(/Cascade Crush/);
  await expect(page.getByRole("heading", { name: "Cascade Crush", exact: true })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
});
