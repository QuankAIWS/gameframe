import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/casual-games";
const desktop = { width: 1440, height: 960 };
const mobile = { width: 390, height: 844 };

async function captureCasualGames(page, viewport, filename) {
  await page.setViewportSize(viewport);
  await page.goto("/casual-games.html?player=casual-games-visual-review");

  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Casual Games", exact: true })).toBeVisible();
  await expect(page.getByText("Short games. Dangerous “one more round” energy.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Small, polished games built for quick sessions and repeated play.", { exact: true })).toHaveCount(0);
  await expect(page.locator(".casual-future")).toHaveCount(0);

  const card = page.getByRole("link", { name: "Open Cascade Crush", exact: true });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", "/cascade.html");
  await expect(card).toContainText("Cascade Crush");
  await expect(card).toContainText("300 LEVELS");
  await expect(card.locator(".casual-card-art img")).toBeVisible();
  await expect(card.locator(".casual-card-art img")).toHaveAttribute("src", "/assets/gameframe/cards/cascade-crush-card.webp");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.screenshot({ path: `${output}/${filename}`, fullPage: true });
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("Casual Games is a focused Cascade Crush shelf on desktop and mobile", async ({ page }) => {
  await captureCasualGames(page, desktop, "casual-games-desktop.png");
  await captureCasualGames(page, mobile, "casual-games-mobile.png");
});
