import { expect, test } from "@playwright/test";

async function waitForOfflinePack(page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable in this browser.");
    await navigator.serviceWorker.ready;
  });

  await expect.poll(() => page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const cacheName = cacheNames.find((name) => name === "gameframe-static-v5");
    if (!cacheName) return false;
    const cache = await caches.open(cacheName);
    const required = [
      "/",
      "/gameframe-offline-shell.js",
      "/casual-games.html",
      "/cascade.html",
      "/cascade-runtime-v2.js",
      "/leaderboard.html",
      "/leaderboard-app.js",
      "/othello.html",
      "/othello-fidelity-app-4.js",
      "/othello-game-menu.js",
      "/othello-offline-mode.js",
      "/othello-garden-delicacy.css",
    ];
    const matches = await Promise.all(required.map((path) => cache.match(path)));
    return matches.every(Boolean);
  }), { timeout: 15_000 }).toBe(true);
}

test("installed GameFrame cold-launches offline with Cascade, local Othello, and cached leaderboard", async ({ page, context }) => {
  const playerId = "gameframe-offline-shell-player";

  // Prime the trusted/cached display identity and install the complete offline pack
  // from the actual GameFrame launcher rather than from a Cascade-only route.
  await page.goto(`/?catalog=1&player=${playerId}`);
  await expect(page.locator("#game-card-othello")).toBeVisible();
  await waitForOfflinePack(page);

  // The leaderboard snapshot is application data, not an authenticated HTTP cache.
  // Load it once online so the offline route has an explicit last-known payload.
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

  // Make sure the active worker controls a normal GameFrame navigation before the
  // simulated device is disconnected, then launch a fresh page while offline.
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

  // Navigate through the normal Casual Games surface and prove Cascade is not
  // merely viewable: its local board still accepts player interaction offline.
  await offlinePage.locator("#game-card-casual-games").click();
  await expect(offlinePage).toHaveURL(/\/casual-games\.html$/);
  await expect(offlinePage.locator(".casual-card-cascade")).toBeVisible();
  await offlinePage.locator(".casual-card-cascade").click();
  await expect(offlinePage).toHaveURL(/\/cascade\.html$/);
  await expect(offlinePage.locator("#board .cascade-tile")).toHaveCount(64, { timeout: 8_000 });
  await offlinePage.locator("#board .cascade-tile").first().click();
  await expect(offlinePage.locator("#board .cascade-tile").first()).toHaveClass(/is-selected/);

  // Return through the GameFrame bar and launch Othello without ever reconnecting.
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
  // Initial Obsidian legal move: row 2, column 3. Convert the 960px canvas
  // coordinate into the current responsive display box.
  const canvasX = 72 + (3.5 * 102);
  const canvasY = 72 + (2.5 * 102);
  await offlinePage.mouse.click(
    boardBox.x + (canvasX / 960) * boardBox.width,
    boardBox.y + (canvasY / 960) * boardBox.height,
  );
  await expect(offlinePage.locator("#move-number")).not.toHaveText("0 / 60", { timeout: 3_000 });

  // Cached standings remain visibly stale rather than masquerading as live data.
  await offlinePage.locator("[data-gameframe-leaderboard]").click();
  await expect(offlinePage).toHaveURL(/\/leaderboard\.html$/);
  await expect(offlinePage.locator("#leaderboard-error")).toContainText("Offline · showing the last leaderboard");
  await expect(offlinePage.locator("#leaderboard-game option").first()).toHaveText(/Gamer Level/);
});
