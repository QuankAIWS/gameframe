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

  await page.goto("/?player=player-mom");
  await expect(page.locator(".gameframe-home-dashboard")).toBeVisible();
  await expect(page.locator(".home-continue-card")).toContainText("YOUR TURN");
  await expect(page.locator(".home-continue-card")).toContainText("Othello");
  await expect(page.locator("[data-gamer-progression]")).toContainText("GAMER LEVEL");
  await expect(page.locator("[data-gamer-progression] .home-level-number strong")).toHaveText("1");
  await expect(page.locator("#game-grid")).toBeHidden();

  await page.goto("/profile.html?player=player-mom");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.locator("#profile-name")).toHaveText("Development player");
  await expect(page.locator("#profile-id")).toHaveText("player-mom");
  await expect(page.locator("#profile-level-number")).toHaveText("1");
  await expect(page.locator("#profile-active-count")).toHaveText("1");
  await expect(page.locator("#profile-active")).toContainText("YOUR TURN");
  await expect(page.locator("#profile-active")).toContainText("Othello");
});

test("favorite games persist in the player profile and become rich Home jump-back-in cards", async ({ page }) => {
  await page.goto("/profile.html?player=favorite-player");
  const othello = page.locator('[data-favorite-game-id="othello"]');
  await expect(othello).toHaveAttribute("aria-pressed", "false");
  await othello.click();
  await expect(othello).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#profile-favorites-status")).toHaveText("Favorites saved.");

  await page.reload();
  await expect(page.locator('[data-favorite-game-id="othello"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#profile-favorites-count")).toHaveText("1");

  await page.goto("/?player=favorite-player");
  const games = page.locator(".home-jump-grid");
  await expect(games).toBeVisible();
  await expect(games).toContainText("Othello");
  await expect(games.getByRole("link", { name: /Othello/ })).toHaveAttribute("href", "/othello.html");
});

test("scored events bind the player, keep the best score, and award Weekly Blitz participation XP once", async ({ page }) => {
  const eventId = "cascade-weekly-blitz-v1:2099-01-05";
  const first = await page.request.post("/api/scores", {
    headers: playerHeader("score-player-a"),
    data: {
      playerId: "forged-player-id",
      gameId: "cascade",
      modeId: "weekly-blitz",
      eventId,
      score: 12_000,
      metrics: { matches: 18, specials: 4, cascades: 5 },
    },
  });
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.entry.playerId).toBe("score-player-a");
  expect(firstBody.entry.score).toBe(12_000);
  expect(firstBody.improved).toBe(true);

  const lower = await page.request.post("/api/scores", {
    headers: playerHeader("score-player-a"),
    data: { gameId: "cascade", modeId: "weekly-blitz", eventId, score: 9_000 },
  });
  expect(lower.status()).toBe(200);
  const lowerBody = await lower.json();
  expect(lowerBody.entry.score).toBe(12_000);
  expect(lowerBody.improved).toBe(false);

  const improved = await page.request.post("/api/scores", {
    headers: playerHeader("score-player-a"),
    data: {
      gameId: "cascade",
      modeId: "weekly-blitz",
      eventId,
      score: 13_250,
      metrics: { matches: 20, specials: 6, cascades: 6 },
    },
  });
  expect(improved.status()).toBe(200);

  const progressionResponse = await page.request.get("/api/me/progression", {
    headers: playerHeader("score-player-a"),
  });
  expect(progressionResponse.status()).toBe(200);
  const progression = await progressionResponse.json();
  expect(progression.gamerXp).toBe(50);
  expect(progression.cascade.weeklyBlitzEntries).toBe(1);
  expect(progression.cascade.weeklyBlitzBestScore).toBe(13_250);

  const second = await page.request.post("/api/scores", {
    headers: playerHeader("score-player-b"),
    data: {
      gameId: "cascade",
      modeId: "weekly-blitz",
      eventId,
      score: 15_500,
      metrics: { matches: 22, specials: 7, cascades: 6 },
    },
  });
  expect(second.status()).toBe(200);

  await page.goto(`/leaderboard.html?player=score-player-a&game=cascade-weekly&event=${encodeURIComponent(eventId)}`);
  await expect(page.getByRole("heading", { name: "Hall of Fame" })).toBeVisible();
  await expect(page.locator("#leaderboard-error")).toBeHidden();
  await expect(page.locator("#leaderboard-rule")).toContainText("Best score per player");
  await expect(page.locator("#leaderboard-rule")).toContainText("shared seed");
  await expect(page.locator("#leaderboard-list .leaderboard-row")).toHaveCount(2);
  const rows = page.locator("#leaderboard-list .leaderboard-row");
  await expect(rows.nth(0).locator(".leaderboard-points strong")).toHaveText("15,500");
  await expect(rows.nth(0)).toContainText("22 match groups");
  await expect(rows.nth(1)).toContainText("You");
  await expect(rows.nth(1).locator(".leaderboard-points strong")).toHaveText("13,250");
});

test("Cascade progression is monotonic, drives Gamer Level, and is visible through public profiles and Hall of Fame", async ({ page }) => {
  const importResponse = await page.request.post("/api/me/cascade/progression", {
    headers: playerHeader("cascade-mom"),
    data: {
      playerId: "forged-player",
      highestCompletedLevel: 12,
      starsByLevel: { "1": 3, "2": 2, "12": 3 },
    },
  });
  expect(importResponse.status()).toBe(200);
  const imported = await importResponse.json();
  expect(imported.playerId).toBe("cascade-mom");
  expect(imported.cascade.highestCompletedLevel).toBe(12);
  expect(imported.cascade.totalBestStars).toBe(8);
  expect(imported.gamerXp).toBe(1_360);
  expect(imported.gamerLevel).toBeGreaterThan(1);

  const duplicateResponse = await page.request.post("/api/me/cascade/progression", {
    headers: playerHeader("cascade-mom"),
    data: { highestCompletedLevel: 12, starsByLevel: { "1": 3, "2": 2, "12": 3 } },
  });
  expect(duplicateResponse.status()).toBe(200);
  const duplicate = await duplicateResponse.json();
  expect(duplicate.gamerXp).toBe(imported.gamerXp);

  const publicResponse = await page.request.get("/api/players/cascade-mom/profile", {
    headers: playerHeader("profile-viewer"),
  });
  expect(publicResponse.status()).toBe(200);
  const publicProfile = await publicResponse.json();
  expect(publicProfile.progression.gamerXp).toBe(imported.gamerXp);
  expect(publicProfile.progression.cascade.highestCompletedLevel).toBe(12);

  await page.goto("/profile.html?player=profile-viewer&view=cascade-mom");
  await expect(page.locator("#profile-level-number")).toHaveText(String(imported.gamerLevel));
  await expect(page.locator("#profile-cascade")).toContainText("12");
  await expect(page.locator("[data-private-profile]").first()).toBeHidden();

  await page.goto("/leaderboard.html?player=profile-viewer");
  await expect(page.getByRole("heading", { name: "Hall of Fame" })).toBeVisible();
  const gamerRows = page.locator("#leaderboard-list .gamer-level-row");
  await expect(gamerRows.first()).toContainText("cascade-mom");
  await expect(gamerRows.first().getByRole("link")).toHaveAttribute("href", "/profile.html?view=cascade-mom");
});

test("Games, Matches, Hall of Fame, and Profile are first-class destination bar links", async ({ page }) => {
  await page.goto("/?catalog=1&player=platform-nav-test");
  await expect(page.locator("#game-grid")).toBeVisible();
  await expect(page.locator("#lobby .section-label")).toHaveText("GAMES");
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-games]")).toHaveClass(/is-active/);
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-matches]")).toHaveAttribute("href", "/matches.html");
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-leaderboard]")).toHaveAttribute("href", "/leaderboard.html");
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-leaderboard]")).toHaveAccessibleName("Hall of Fame");
  await expect(page.locator("#gameframe-destination-bar [data-gameframe-profile]")).toHaveAttribute("href", "/profile.html");

  await page.locator("#gameframe-destination-bar [data-gameframe-matches]").click();
  await expect(page).toHaveURL(/\/matches\.html$/);
  await expect(page.getByRole("heading", { name: "Matches" })).toBeVisible();

  await page.locator("#gameframe-destination-bar [data-gameframe-leaderboard]").click();
  await expect(page).toHaveURL(/\/leaderboard\.html$/);
  await expect(page.getByRole("heading", { name: "Hall of Fame" })).toBeVisible();
  await expect(page.locator("#leaderboard-list")).toBeVisible();
  await expect(page.locator("#leaderboard-error")).toBeHidden();

  await page.locator("#gameframe-destination-bar [data-gameframe-profile]").click();
  await expect(page).toHaveURL(/\/profile\.html$/);
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

  await page.locator("#gameframe-destination-bar [data-gameframe-home]").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".gameframe-home-dashboard")).toBeVisible();
});

test("five platform destinations remain bounded at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/leaderboard.html?player=platform-tablet-test");
  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator("[data-gameframe-home]")).toBeVisible();
  await expect(bar.locator("[data-gameframe-games]")).toBeVisible();
  await expect(bar.locator("[data-gameframe-matches]")).toBeVisible();
  await expect(bar.locator("[data-gameframe-leaderboard]")).toBeVisible();
  await expect(bar.locator("[data-gameframe-profile]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
