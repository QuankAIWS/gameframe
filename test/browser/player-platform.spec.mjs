import { test, expect } from "@playwright/test";

const playerHeader = (playerId) => ({ "x-gameframe-player-id": playerId });

test("an Othello move survives browser closure and appears as the other player's turn", async ({ page }) => {
  const createdResponse = await page.request.post("/api/matches", {
    headers: playerHeader("player-alice"),
    data: {
      gameId: "othello",
      playerIds: ["player-alice", "player-mom"],
    },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  expect(created.gameId).toBe("othello");
  expect(created.observation.nextPlayerId).toBe("player-alice");
  expect(created.observation.legalActions).toHaveLength(4);

  await page.goto(`/othello.html?match=${encodeURIComponent(created.matchId)}&player=player-alice`);
  await expect(page.locator("body")).toHaveAttribute("data-gameframe-remote-match", created.matchId);
  await expect(page.locator("#othello-game-menu")).toBeHidden();
  await expect(page.locator("#move-number")).toHaveText("0 / 60");
  await expect(page.locator(".score-rail-dark > span")).toHaveText("You");

  const moveResponse = await page.request.post(`/api/matches/${encodeURIComponent(created.matchId)}/actions`, {
    headers: playerHeader("player-alice"),
    data: {
      actionId: "alice-first-move",
      expectedRevision: created.revision,
      action: created.observation.legalActions[0],
    },
  });
  expect(moveResponse.status()).toBe(200);
  const moved = await moveResponse.json();
  expect(moved.revision).toBe(1);
  expect(moved.observation.nextPlayerId).toBe("player-mom");

  // Simulate Alice closing the browser and Mom opening GameFrame later.
  await page.goto("/matches.html?player=player-mom");
  await expect(page.getByRole("heading", { name: "Matches" })).toBeVisible();
  await expect(page.locator("#your-turn-count")).toHaveText("1");
  const turnRow = page.locator("#your-turn-list .platform-row").first();
  await expect(turnRow).toContainText("YOUR TURN");
  await expect(turnRow).toContainText("Othello");
  await expect(turnRow).toContainText("Revision 1");
  await expect(turnRow.getByRole("link", { name: "Play move" })).toHaveAttribute(
    "href",
    `/othello.html?match=${created.matchId}`,
  );

  await turnRow.getByRole("link", { name: "Play move" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-gameframe-remote-match", created.matchId);
  await expect(page.locator("#move-number")).toHaveText("1 / 60");
  await expect(page.locator(".score-rail-light > span")).toHaveText("You");

  await page.goto("/");
  await expect(page.locator(".gameframe-home-dashboard")).toBeVisible();
  await expect(page.locator(".gameframe-home-dashboard")).toContainText("YOUR TURN");
  await expect(page.locator(".gameframe-home-dashboard")).toContainText("Othello");
  await expect(page.locator("#game-grid")).toBeHidden();

  await page.goto("/profile.html?player=player-mom");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.locator("#profile-name")).toContainText("player-mom");
  await expect(page.locator("#profile-active-count")).toHaveText("1");
  await expect(page.locator("#profile-active")).toContainText("YOUR TURN");
  await expect(page.locator("#profile-active")).toContainText("Othello");
});

test("Games, Matches, and Profile are first-class destination bar links", async ({ page }) => {
  await page.goto("/?catalog=1&player=platform-nav-test");
  await expect(page.locator("#game-grid")).toBeVisible();
  await expect(page.locator("#lobby .section-label")).toHaveText("GAMES");
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-games]")).toHaveClass(/is-active/);
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-matches]")).toHaveAttribute("href", "/matches.html");
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-profile]")).toHaveAttribute("href", "/profile.html");

  await page.locator("#gameframe-destination-bar [data-gameframe-matches]").click();
  await expect(page).toHaveURL(/\/matches\.html$/);
  await expect(page.getByRole("heading", { name: "Matches" })).toBeVisible();

  await page.locator("#gameframe-destination-bar [data-gameframe-profile]").click();
  await expect(page).toHaveURL(/\/profile\.html$/);
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

  await page.locator("#gameframe-destination-bar [data-gameframe-home]").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".gameframe-home-dashboard")).toBeVisible();
});
