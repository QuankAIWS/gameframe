import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const desktop = { width: 1440, height: 960 };
const mobile = { width: 390, height: 844 };
const bootSeenStorageKey = "scribbles-gameframe.boot-seen:v2";
const cascadeStateKey = "scribbles-gameframe.cascade-state:v1";
const cascadePerformanceKey = "scribbles-gameframe.cascade-performance:v1";
const cascadeOwnerKey = "scribbles-gameframe.cascade-progression-owner:v1";
const playerId = "visual-player-platform";
const playerHeader = { "x-gameframe-player-id": playerId };
const visualStarsByLevel = Object.fromEntries(Array.from({ length: 180 }, (_, index) => [String(index + 1), index % 5 === 0 ? 2 : 3]));

async function seedPlayerProgression(page) {
  const cascade = await page.request.post("/api/me/cascade/progression", {
    headers: playerHeader,
    data: {
      highestCompletedLevel: 180,
      starsByLevel: visualStarsByLevel,
    },
  });
  expect(cascade.ok()).toBe(true);
  const blitz = await page.request.post("/api/scores", {
    headers: playerHeader,
    data: {
      gameId: "cascade",
      modeId: "weekly-blitz",
      eventId: "cascade-weekly-blitz-v1:2099-01-05",
      score: 88_420,
      metrics: { matches: 42, specials: 14, cascades: 11 },
    },
  });
  expect(blitz.ok()).toBe(true);
  const theme = await page.request.post("/api/me/preferences", {
    headers: playerHeader,
    data: { themeId: "cascade" },
  });
  expect(theme.ok()).toBe(true);
  expect((await theme.json()).themeId).toBe("cascade");
}

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
  await expect(page.locator("#gameframe-alerts-trigger")).toBeVisible();
  await expect(page.locator("#gameframe-theme-trigger")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function returnToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

async function openProfile(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`/profile.html?player=${playerId}`);
  await expectPlatformBar(page, "[data-gameframe-profile]");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-gameframe-theme", "cascade");
  await expect(page.locator(".profile-shell")).toHaveAttribute("data-profile-theme", "cascade");
  await expect(page.locator("#profile-level-number")).not.toHaveText("1");
  await expect(page.locator("#profile-cascade")).toContainText("180");
  const favorite = page.locator('[data-favorite-game-id="othello"]');
  if (await favorite.getAttribute("aria-pressed") !== "true") {
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#profile-favorites-status")).toHaveText("Favorites saved.");
  }
  await returnToTop(page);
}

async function openViewedProfile(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`/profile.html?player=visual-theme-viewer&view=${playerId}`);
  await expectPlatformBar(page, "[data-gameframe-profile]");
  await expect(page.locator("body")).toHaveAttribute("data-gameframe-theme", "classic");
  await expect(page.locator(".profile-shell")).toHaveAttribute("data-profile-theme", "cascade");
  await expect(page.locator("#profile-level-number")).not.toHaveText("1");
  await expect(page.locator("#profile-cascade")).toContainText("180");
  await returnToTop(page);
}

async function openHome(page, viewport) {
  await page.setViewportSize(viewport);
  await page.evaluate(({ bootKey, stateKey, performanceKey, ownerKey, owner, stars }) => {
    localStorage.setItem(bootKey, "seen");
    localStorage.setItem(ownerKey, owner);
    localStorage.setItem(stateKey, JSON.stringify({ level: 181, lives: 5, lastLifeAt: Date.now(), streak: 7, hammers: 4 }));
    localStorage.setItem(performanceKey, JSON.stringify({
      starsByLevel: stars,
      blitzBest: { "after-170": 88420 },
      blitzStars: { "after-170": 3 },
      blitzSeen: { "after-170": true },
      pendingHammerRewards: 0,
    }));
  }, {
    bootKey: bootSeenStorageKey,
    stateKey: cascadeStateKey,
    performanceKey: cascadePerformanceKey,
    ownerKey: cascadeOwnerKey,
    owner: playerId,
    stars: visualStarsByLevel,
  });
  await page.goto(`/?player=${playerId}`);
  await expect(page.locator("#gameframe-boot")).toBeHidden({ timeout: 5_000 });
  await expectPlatformBar(page, "[data-gameframe-home]");
  await expect(page.locator("body")).toHaveAttribute("data-gameframe-theme", "cascade");
  await expect(page.locator(".gameframe-home-dashboard")).toBeVisible();
  await expect(page.locator(".home-continue-card")).toContainText("CONTINUE PLAYING");
  await expect(page.locator(".home-continue-card")).toContainText("Level 181");
  await expect(page.locator("[data-gamer-progression]")).toContainText("GAMER LEVEL");
  await expect(page.locator("[data-gamer-progression] .home-level-number strong")).not.toHaveText("1");
  await expect(page.locator(".home-jump-grid")).toContainText("Othello");
  await returnToTop(page);
}

async function openLeaderboard(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`/leaderboard.html?player=${playerId}`);
  await expectPlatformBar(page, "[data-gameframe-leaderboard]");
  await expect(page.locator("body")).toHaveAttribute("data-gameframe-theme", "cascade");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.locator(`#hall-podium a[href="/profile.html?view=${playerId}"]`)).toHaveCount(1);
  await expect(page.locator("#hall-categories .hall-category-card")).toHaveCount(3);
  await expect(page.locator("#leaderboard-list")).toBeVisible();
  await expect(page.locator("#leaderboard-error")).toBeHidden();
  await returnToTop(page);
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("capture the player platform at desktop and mobile sizes", async ({ page }) => {
  await seedPlayerProgression(page);

  await openProfile(page, desktop);
  await page.screenshot({ path: `${output}/profile-favorites-desktop.png`, fullPage: true });
  await openViewedProfile(page, desktop);
  await page.screenshot({ path: `${output}/profile-viewed-theme-desktop.png`, fullPage: true });
  await openHome(page, desktop);
  await page.screenshot({ path: `${output}/home-dashboard-desktop.png`, fullPage: true });
  await openLeaderboard(page, desktop);
  await page.screenshot({ path: `${output}/leaderboard-desktop.png`, fullPage: true });

  await openProfile(page, mobile);
  await page.screenshot({ path: `${output}/profile-favorites-mobile.png`, fullPage: true });
  await openViewedProfile(page, mobile);
  await page.screenshot({ path: `${output}/profile-viewed-theme-mobile.png`, fullPage: true });
  await openHome(page, mobile);
  await page.screenshot({ path: `${output}/home-dashboard-mobile.png`, fullPage: true });
  await openLeaderboard(page, mobile);
  await page.screenshot({ path: `${output}/leaderboard-mobile.png`, fullPage: true });
});