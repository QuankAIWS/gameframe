import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const desktop = { width: 1440, height: 960 };
const mobile = { width: 390, height: 844 };
const bootSeenStorageKey = "scribbles-gameframe.boot-seen:v2";
const playerId = "visual-player-platform";

async function expectPlatformBar(page, active) {
  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator('[data-gameframe-home][href="/"]')).toHaveCount(1);
  await expect(bar.locator('[data-gameframe-games][href="/?catalog=1"]')).toHaveCount(1);
  await expect(bar.locator('[data-gameframe-matches][href="/matches.html"]')).toHaveCount(1);
  await expect(bar.locator('[data-gameframe-leaderboard][href="/leaderboard.html"]')).toHaveCount(1);
  await expect(bar.locator('[data-gameframe-profile][href="/profile.html"]')).toHaveCount(1);
  await expect(bar.locator(active)).toHaveClass(/is-active/);
  await expect(page.locator("#gameframe-session-badge")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function openProfile(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`/profile.html?player=${playerId}`);
  await expectPlatformBar(page, "[data-gameframe-profile]");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  const favorite = page.locator('[data-favorite-game-id="othello"]');
  if (await favorite.getAttribute("aria-pressed") !== "true") {
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#profile-favorites-status")).toHaveText("Favorites saved.");
  }
}

async function openHome(page, viewport) {
  await page.setViewportSize(viewport);
  await page.evaluate((key) => localStorage.setItem(key, "seen"), bootSeenStorageKey);
  await page.goto(`/?player=${playerId}`);
  await expect(page.locator("#gameframe-boot")).toBeHidden({ timeout: 5_000 });
  await expectPlatformBar(page, "[data-gameframe-home]");
  await expect(page.locator(".gameframe-home-dashboard")).toBeVisible();
  await expect(page.locator(".home-news-strip")).toContainText("WHAT'S NEW");
  await expect(page.locator(".home-favorites-section")).toContainText("Othello");
}

async function openLeaderboard(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`/leaderboard.html?player=${playerId}`);
  await expectPlatformBar(page, "[data-gameframe-leaderboard]");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.locator("#leaderboard-list")).toBeVisible();
  await expect(page.locator("#leaderboard-error")).toBeHidden();
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("capture the player platform at desktop and mobile sizes", async ({ page }) => {
  await openProfile(page, desktop);
  await page.screenshot({ path: `${output}/profile-favorites-desktop.png`, fullPage: true });
  await openHome(page, desktop);
  await page.screenshot({ path: `${output}/home-dashboard-desktop.png`, fullPage: true });
  await openLeaderboard(page, desktop);
  await page.screenshot({ path: `${output}/leaderboard-desktop.png`, fullPage: true });

  await openProfile(page, mobile);
  await page.screenshot({ path: `${output}/profile-favorites-mobile.png`, fullPage: true });
  await openHome(page, mobile);
  await page.screenshot({ path: `${output}/home-dashboard-mobile.png`, fullPage: true });
  await openLeaderboard(page, mobile);
  await page.screenshot({ path: `${output}/leaderboard-mobile.png`, fullPage: true });
});
