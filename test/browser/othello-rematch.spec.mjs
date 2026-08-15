import { expect, test } from "@playwright/test";

const completedBoard = Array.from({ length: 8 }, (_, row) =>
  Array.from({ length: 8 }, (_, column) => (row + column) % 2 === 0 ? 1 : -1));

function remoteView(lifecycle = "completed") {
  return {
    gameId: "othello",
    matchId: "finished-othello-match",
    playerIds: ["discord:111", "discord:222"],
    revision: lifecycle === "completed" ? 60 : 8,
    eventCount: lifecycle === "completed" ? 60 : 8,
    observation: {
      board: lifecycle === "completed"
        ? completedBoard
        : [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, -1, 1, 0, 0, 0],
            [0, 0, 0, 1, -1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
          ],
      yourDisc: 1,
      nextDisc: lifecycle === "completed" ? null : 1,
      nextPlayerId: lifecycle === "completed" ? null : "discord:111",
      move: lifecycle === "completed" ? 60 : 8,
      lastMove: lifecycle === "completed" ? [7, 7] : [2, 3],
      status: {
        lifecycle,
        winnerPlayerId: lifecycle === "completed" ? "discord:111" : null,
        draw: false,
      },
      scores: lifecycle === "completed" ? { dark: 32, light: 32 } : { dark: 4, light: 4 },
      legalActions: lifecycle === "completed" ? [] : [{ type: "place", row: 2, column: 4 }],
    },
  };
}

async function mockPlayerPlatform(page, lifecycle, invitationBodies) {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      authenticated: true,
      playerId: "discord:111",
      source: "discord",
      displayName: "Alice",
      avatarUrl: null,
    }),
  }));
  await page.route("**/api/players", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      players: [{ playerId: "discord:222", displayName: "Bob", avatarUrl: null }],
    }),
  }));
  await page.route("**/api/matches/finished-othello-match", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(remoteView(lifecycle)),
  }));
  await page.route("**/api/invitations", async (route) => {
    invitationBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ invitation: { invitationId: "rematch-invite", status: "open" } }),
    });
  });
}

test("completed online Othello exposes a rematch button targeted to the same opponent", async ({ page }) => {
  const invitationBodies = [];
  await mockPlayerPlatform(page, "completed", invitationBodies);

  await page.goto("/othello.html?theme=obsidian&match=finished-othello-match");
  const rematch = page.locator("#othello-rematch");
  await expect(rematch).toBeVisible();
  await expect(rematch).toHaveText("Rematch");

  await rematch.click();

  await expect.poll(() => invitationBodies.length).toBe(1);
  expect(invitationBodies[0]).toEqual({
    gameId: "othello",
    targetPlayerId: "discord:222",
  });
  await expect(rematch).toBeDisabled();
  await expect(rematch).toHaveText("Rematch sent");
  await expect(page.locator("#board-announcement")).toContainText("Rematch challenge sent to Bob.");
});

test("active online Othello does not expose rematch early", async ({ page }) => {
  const invitationBodies = [];
  await mockPlayerPlatform(page, "active", invitationBodies);

  await page.goto("/othello.html?theme=obsidian&match=finished-othello-match");
  await expect(page.locator("#othello-rematch")).toBeHidden();
  expect(invitationBodies).toHaveLength(0);
});