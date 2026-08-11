import { expect, test } from "@playwright/test";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
}

async function createMatch(request, gameId, playerIds) {
  const response = await request.post("/api/matches", {
    headers: playerHeaders(playerIds[0]),
    data: { gameId, playerIds },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function expectSafeSetup(page) {
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(page.locator("#monster-master-match")).toBeHidden();
  await expect(page.locator("#monster-master-error")).toBeVisible();
  await expect(page).not.toHaveURL(/match=/);
}

test("unknown Monster Master resume returns to safe setup", async ({ page }) => {
  await page.goto("/monster-master.html?match=missing-monster-master&player=monster-recovery");

  await expectSafeSetup(page);
  await expect(page.locator("#monster-master-error")).toContainText("Unknown match");
  await expect(page.locator("#monster-master-lobby-message")).toContainText("could not be resumed");
});

test("a different game cannot be rendered through the Monster Master client", async ({ page, request }) => {
  const match = await createMatch(request, "tic-tac-toe", ["monster-wrong-game", "monster-wrong-opponent"]);
  await page.goto(`/monster-master.html?match=${encodeURIComponent(match.matchId)}&player=monster-wrong-game`);

  await expectSafeSetup(page);
  await expect(page.locator("#monster-master-error")).toContainText("not a Monster Master duel");
});

test("an unseated identity receives no Monster Master observation", async ({ page, request }) => {
  const match = await createMatch(request, "monster-master-duel", ["monster-seat-alpha", "monster-seat-beta"]);
  await page.goto(`/monster-master.html?match=${encodeURIComponent(match.matchId)}&player=monster-intruder`);

  await expectSafeSetup(page);
  await expect(page.locator("#monster-master-error")).toContainText(/Unknown player|not in this match/i);
  await expect(page.locator("#monster-master-roster-list .combat-roster-unit")).toHaveCount(0);
  await expect(page.locator("#monster-master-details")).toHaveText("");
});

test("failed duel creation restores usable lobby controls", async ({ page }) => {
  let rejectCreation = true;
  await page.route("**/api/matches", async (route) => {
    if (route.request().method() === "POST" && rejectCreation) {
      rejectCreation = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporarily_unavailable", message: "Synthetic creation outage." }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/monster-master.html?player=monster-create-recovery");
  await expect(page.locator("#monster-master-lobby-message")).toHaveText(
    "Choose an opponent to begin the first Monster Master duel.",
  );
  await page.locator("#monster-master-bot").click();
  await expect(page.locator("#monster-master-error")).toContainText("Synthetic creation outage");
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(page.locator("#monster-master-bot")).toBeEnabled();
  await expect(page.locator("#monster-master-human")).toBeEnabled();

  await page.locator("#monster-master-bot").click();
  await expect(page.locator("#monster-master-match")).toBeVisible();
  await expect(page.locator("#monster-master-phase")).toHaveText("Deployment");
});
