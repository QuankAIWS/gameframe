import { test, expect } from "@playwright/test";

const playerHeader = (playerId) => ({ "x-gameframe-player-id": playerId });

test("public profiles offer the three shared 1v1 board games", async ({ page }) => {
  const target = "profile-play-target";
  const viewer = "profile-play-viewer";

  const seed = await page.request.post("/api/me/cascade/progression", {
    headers: playerHeader(target),
    data: { highestCompletedLevel: 1, starsByLevel: { "1": 1 } },
  });
  expect(seed.status()).toBe(200);

  await page.goto(`/profile.html?player=${viewer}&view=${target}`);

  const panel = page.locator(".profile-play-together");
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Play together" })).toBeVisible();
  await expect(panel).toContainText("Choose a 1v1 game");
  await expect(panel.getByRole("link", { name: "Tic-Tac-Toe" })).toHaveAttribute(
    "href",
    "/?game=tic-tac-toe&menu=1",
  );
  await expect(panel.getByRole("link", { name: "Clockwork Checkers" })).toHaveAttribute(
    "href",
    "/?game=american-checkers&menu=1",
  );
  await expect(panel.getByRole("link", { name: "Othello" })).toHaveAttribute("href", "/othello.html");
});

test("own profile does not show the play-together panel", async ({ page }) => {
  await page.goto("/profile.html?player=profile-play-owner");
  await expect(page.locator(".profile-play-together")).toHaveCount(0);
});

test("explicit self profile does not show the play-together panel", async ({ page }) => {
  const playerId = "profile-play-explicit-self";
  await page.goto(`/profile.html?player=${playerId}&view=${playerId}`);
  await expect(page.locator("#profile-id")).toHaveText(playerId);
  await expect(page.locator(".profile-play-together")).toHaveCount(0);
});
