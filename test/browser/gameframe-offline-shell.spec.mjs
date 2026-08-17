import { expect, test } from "@playwright/test";

const offlineCatalogAssets = [
  "/assets/checkers/clockwork-eclipse/board-surface.svg",
  "/assets/checkers/clockwork-eclipse/piece-lunar.svg",
  "/assets/checkers/clockwork-eclipse/piece-solar.svg",
  "/assets/gameframe/cards/role-playing-games-card.svg",
  "/assets/gameframe/cards/battle-simulator-card.svg",
];

async function waitForOfflinePack(page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable in this browser.");
    await navigator.serviceWorker.ready;
  });

  await expect.poll(() => page.evaluate(async (catalogAssets) => {
    const cacheNames = await caches.keys();
    const cacheName = cacheNames.find((name) => name === "gameframe-static-v6");
    if (!cacheName) return false;
    const cache = await caches.open(cacheName);
    const required = [
      "/",
      "/gameframe-offline-shell.js",
      "/casual-games.html",
      "/cascade.html",
      "/cascade-runtime-v2.js",
      "/cascade-snowflake-ice.css",
      "/cascade-tv-accessibility.css",
      "/gameframe-build-refresh.js",
      "/leaderboard.html",
      "/leaderboard-app.js",
      "/othello.html",
      "/othello-fidelity-app-4.js",
      "/othello-game-menu.js",
      "/othello-offline-mode.js",
      "/othello-garden-delicacy.css",
      "/othello-garden-ornament-cleanup.css",
      "/othello-garden-lily-pad.svg",
      "/othello-garden-lotus.svg",
      ...catalogAssets,
    ];
    const matches = await Promise.all(required.map((path) => cache.match(path)));
    return matches.every(Boolean);
  }, offlineCatalogAssets), { timeout: 15_000 }).toBe(true);
}

test("installed GameFrame cold-launches offline with Cascade, local Othello, and cached leaderboard", async ({ page, context }) => {
  const playerId = "gameframe-offline-shell-player";

  await page.goto(`/?catalog=1&player=${playerId}`);
  await expect(page.locator("#game-card-othello")).toBeVisible();
  await waitForOfflinePack(page);

  await page.goto(`/leaderboard.html?player=${playerId}`);
  await expect(page.locator("#leaderboard-game option").first()).toHaveText(/Gamer Level/);
  await expect.poll(() => page.evaluate(() => {
    try {
      const snapshot = JSON.parse(localStorage.getItem("scribbles-gameframe.leaderboard-snapshot:v1") || "null");
      return snapshot?.version === 1 && snapshot?.body && typeof snapshot.body === "object";
    } catch {
      return false;
    }
  })).toBe(true);

  await page.goto("/?catalog=1");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await page.close();

  await offlinePage.goto("/?catalog=1", { waitUntil: "domcontentloaded" });
  await expect(offlinePage.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(offlinePage.locator(".gameframe-offline-summary")).toContainText("Offline mode");
  await expect(offlinePage.locator('#game-card-casual-games[href="/casual-games.html"]')).toBeVisible();
  await expect(offlinePage.locator('#game-card-othello[href="/othello.html"]')).toBeVisible();
  await expect(offlinePage.locator("#game-card-american-checkers")).toHaveAttribute("aria-disabled", "true");
  await expect(offlinePage.locator("[data-gameframe-matches]")).toHaveAttribute("aria-disabled", "true");
  await expect(offlinePage.locator("[data-gameframe-profile]")).toHaveAttribute("aria-disabled", "true");
  const catalogAssetsAvailable = await offlinePage.evaluate(async (paths) => {
    const responses = await Promise.all(paths.map((path) => fetch(path)));
    return responses.every((response) => response.ok);
  }, offlineCatalogAssets);
  expect(catalogAssetsAvailable).toBe(true);

  await offlinePage.locator("#game-card-casual-games").click();
  await expect(offlinePage).toHaveURL(/\/casual-games\.html$/);
  await expect(offlinePage.locator(".casual-card-cascade")).toBeVisible();
  await offlinePage.locator(".casual-card-cascade").click();
  await expect(offlinePage).toHaveURL(/\/cascade\.html$/);
  await expect(offlinePage.locator("#board .cascade-tile")).toHaveCount(64, { timeout: 8_000 });
  await offlinePage.locator("#board .cascade-tile").first().click();
  await expect(offlinePage.locator("#board .cascade-tile").first()).toHaveClass(/is-selected/);

  await offlinePage.locator("[data-gameframe-games]").click();
  await expect(offlinePage.locator(".gameframe-offline-summary")).toBeVisible();
  await offlinePage.locator("#game-card-othello").click();
  await expect(offlinePage).toHaveURL(/\/othello\.html$/);
  await expect(offlinePage.locator("#othello-game-menu")).toBeVisible({ timeout: 8_000 });
  await expect(offlinePage.locator("#othello-challenge-player")).toBeDisabled();
  await expect(offlinePage.locator("[data-othello-online-status]")).toContainText("Offline mode");
  await offlinePage.locator("#othello-play-bot").click();
  await expect(offlinePage.locator("#othello-game-menu")).toBeHidden();
  await expect(offlinePage.locator("body")).toHaveAttribute("data-othello-mode", "bot");

  const boardBox = await offlinePage.locator("#othello-board").boundingBox();
  expect(boardBox).not.toBeNull();
  const canvasX = 72 + (3.5 * 102);
  const canvasY = 72 + (2.5 * 102);
  await offlinePage.mouse.click(
    boardBox.x + (canvasX / 960) * boardBox.width,
    boardBox.y + (canvasY / 960) * boardBox.height,
  );
  await expect(offlinePage.locator("#move-number")).not.toHaveText("0 / 60", { timeout: 3_000 });

  await offlinePage.locator('.theme-button[data-theme="garden"]').click();
  await expect(offlinePage.locator("body")).toHaveAttribute("data-theme", "garden");
  const gardenAssetsAvailable = await offlinePage.evaluate(async () => {
    const [pad, lotus] = await Promise.all([
      fetch("/othello-garden-lily-pad.svg"),
      fetch("/othello-garden-lotus.svg"),
    ]);
    return pad.ok && lotus.ok;
  });
  expect(gardenAssetsAvailable).toBe(true);

  await offlinePage.locator("[data-gameframe-leaderboard]").click();
  await expect(offlinePage).toHaveURL(/\/leaderboard\.html$/);
  await expect(offlinePage.locator("#leaderboard-error")).toContainText("Offline · showing the last leaderboard");
  await expect(offlinePage.locator("#leaderboard-game option").first()).toHaveText(/Gamer Level/);

  const revalidationNavigation = offlinePage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10_000 });
  await context.setOffline(false);
  await revalidationNavigation;
  await expect.poll(() => offlinePage.evaluate(() => ({
    online: navigator.onLine,
    offlineIdentity: window.gameFrameIdentity?.offline === true,
    offlineShell: window.gameFrameOffline === true,
  })), { timeout: 8_000 }).toEqual({ online: true, offlineIdentity: false, offlineShell: false });
  await expect(offlinePage.locator("[data-gameframe-matches]")).toHaveAttribute("href", "/matches.html");
  await expect(offlinePage.locator("[data-gameframe-profile]")).toHaveAttribute("href", "/profile.html");
});

test("cached identity revalidates after a session request outage even when navigator stays online", async ({ page }) => {
  const playerId = "gameframe-online-flag-recovery";
  await page.goto(`/?catalog=1&player=${playerId}`);
  await expect(page.locator("#game-card-othello")).toBeVisible();

  await page.route("**/api/session", (route) => route.abort("failed"));
  await page.goto("/?catalog=1");
  await expect(page.locator(".gameframe-offline-summary")).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    online: navigator.onLine,
    offlineIdentity: window.gameFrameIdentity?.offline === true,
    offlineShell: window.gameFrameOffline === true,
  }))).toEqual({ online: true, offlineIdentity: true, offlineShell: true });

  const revalidationNavigation = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10_000 });
  await page.unroute("**/api/session");
  await revalidationNavigation;
  await expect.poll(() => page.evaluate(() => ({
    online: navigator.onLine,
    offlineIdentity: window.gameFrameIdentity?.offline === true,
    offlineShell: window.gameFrameOffline === true,
  })), { timeout: 8_000 }).toEqual({ online: true, offlineIdentity: false, offlineShell: false });
  await expect(page.locator(".gameframe-offline-summary")).toHaveCount(0);
  await expect(page.locator("[data-gameframe-matches]")).toHaveAttribute("href", "/matches.html");
});

test("Othello disables online-only controls when connectivity drops after an online launch", async ({ page, context }) => {
  const playerId = "gameframe-othello-drop-player";
  await page.goto(`/othello.html?player=${playerId}`);
  await expect(page.locator("#othello-game-menu")).toBeVisible({ timeout: 8_000 });

  await context.setOffline(true);
  await expect(page.locator("#othello-challenge-player")).toBeDisabled();
  await expect(page.locator("[data-othello-online-status]")).toContainText("Offline mode");
});
