import { expect, test } from "@playwright/test";

const completedBoard = Array.from({ length: 8 }, (_, row) =>
  Array.from({ length: 8 }, (_, column) => (row + column) % 2 === 0 ? 1 : -1));

function remoteView(lifecycle = "completed", matchId = "finished-othello-match") {
  return {
    gameId: "othello",
    matchId,
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

async function mockBasePlayerPlatform(page) {
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
  await page.route("**/api/me/feed", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ matches: [], invitations: [] }),
  }));
}

async function mockRemotePlayerPlatform(page, lifecycle, invitationBodies, invitationState) {
  await mockBasePlayerPlatform(page);
  await page.route("**/api/matches/finished-othello-match", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(remoteView(lifecycle)),
  }));
  await page.route("**/api/matches/accepted-rematch-match", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(remoteView("active", "accepted-rematch-match")),
  }));
  await page.route("**/api/invitations", async (route) => {
    invitationBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: { invitationId: "rematch-invite", gameId: "othello", status: "pending" },
      }),
    });
  });
  await page.route("**/api/invitations/rematch-invite", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      invitation: { invitationId: "rematch-invite", gameId: "othello", status: invitationState.status },
      resumePath: invitationState.status === "claimed"
        ? "/othello.html?match=accepted-rematch-match"
        : null,
    }),
  }));
}

async function mockChallengePlayerPlatform(page, invitationBodies, invitationState, cancelCount) {
  await mockBasePlayerPlatform(page);
  await page.route("**/api/matches/accepted-challenge-match", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(remoteView("active", "accepted-challenge-match")),
  }));
  await page.route("**/api/invitations", async (route) => {
    invitationBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: { invitationId: "challenge-invite", gameId: "othello", status: "pending" },
      }),
    });
  });
  await page.route("**/api/invitations/challenge-invite/cancel", async (route) => {
    cancelCount.value += 1;
    invitationState.status = "cancelled";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: { invitationId: "challenge-invite", gameId: "othello", status: "cancelled" },
        resumePath: null,
      }),
    });
  });
  await page.route("**/api/invitations/challenge-invite", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      invitation: { invitationId: "challenge-invite", gameId: "othello", status: invitationState.status },
      resumePath: invitationState.status === "claimed"
        ? "/othello.html?match=accepted-challenge-match"
        : null,
    }),
  }));
}

test("completed online Othello rematch waits for the same opponent and opens the accepted board", async ({ page }) => {
  const invitationBodies = [];
  const invitationState = { status: "pending" };
  await mockRemotePlayerPlatform(page, "completed", invitationBodies, invitationState);

  await page.goto("/othello.html?theme=obsidian&match=finished-othello-match");
  const rematch = page.locator("#othello-rematch");
  await expect(rematch).toBeVisible();
  await expect(rematch).toHaveText("Rematch");

  await rematch.click();

  await expect.poll(() => invitationBodies.length).toBe(1);
  expect(invitationBodies[0]).toEqual({ gameId: "othello", targetPlayerId: "discord:222" });
  await expect(rematch).toBeDisabled();
  await expect(rematch).toContainText("Waiting for Bob");
  await expect(page.locator("#board-announcement")).toContainText("Waiting for them to accept");

  invitationState.status = "claimed";
  await page.evaluate(() => window.gameFrameOthello.refreshInvitation());
  await expect(page).toHaveURL(/match=accepted-rematch-match/);
});

test("challenger waits on the invitation and automatically enters the match after acceptance", async ({ page }) => {
  const invitationBodies = [];
  const invitationState = { status: "pending" };
  const cancelCount = { value: 0 };
  await mockChallengePlayerPlatform(page, invitationBodies, invitationState, cancelCount);

  await page.goto("/othello.html?theme=obsidian");
  await page.locator("#othello-challenge-player").click();
  await expect(page.locator(".othello-player-choice")).toHaveCount(1);
  await page.locator(".othello-player-choice").click();

  await expect.poll(() => invitationBodies.length).toBe(1);
  expect(invitationBodies[0]).toEqual({ gameId: "othello", targetDiscordUserId: "222" });
  await expect(page.locator("[data-othello-online-status]")).toContainText("Waiting for them to accept");
  await expect(page.locator("[data-othello-player-picker]")).toContainText("Waiting for Bob");
  await expect(page.locator("#othello-cancel-challenge")).toBeVisible();
  await expect(page.locator("#othello-challenge-player")).toBeDisabled();
  await expect(page.locator("#othello-play-bot")).toBeDisabled();
  await expect(page.locator("#othello-play-local")).toBeDisabled();

  invitationState.status = "claimed";
  await page.evaluate(() => window.gameFrameOthello.refreshInvitation());
  await expect(page).toHaveURL(/match=accepted-challenge-match/);
});

test("challenger can cancel a pending Othello invitation without leaving a stale waiting state", async ({ page }) => {
  const invitationBodies = [];
  const invitationState = { status: "pending" };
  const cancelCount = { value: 0 };
  await mockChallengePlayerPlatform(page, invitationBodies, invitationState, cancelCount);

  await page.goto("/othello.html?theme=obsidian");
  await page.locator("#othello-challenge-player").click();
  await page.locator(".othello-player-choice").click();
  await expect(page.locator("#othello-cancel-challenge")).toBeVisible();

  await page.locator("#othello-cancel-challenge").click();

  await expect.poll(() => cancelCount.value).toBe(1);
  await expect(page.locator("[data-othello-online-status]")).toContainText("Challenge to Bob cancelled");
  await expect(page.locator("#othello-cancel-challenge")).toBeHidden();
  await expect(page.locator("#othello-challenge-player")).toBeEnabled();
  await expect(page.locator("#othello-play-bot")).toBeEnabled();
});

test("active online Othello does not expose rematch early", async ({ page }) => {
  const invitationBodies = [];
  const invitationState = { status: "pending" };
  await mockRemotePlayerPlatform(page, "active", invitationBodies, invitationState);

  await page.goto("/othello.html?theme=obsidian&match=finished-othello-match");
  await expect(page.locator("#othello-rematch")).toBeHidden();
  expect(invitationBodies).toHaveLength(0);
});

test("non-remote Othello pages do not create a rematch control", async ({ page }) => {
  await page.goto("/othello.html?theme=obsidian&state=opening");
  await expect(page.locator("#othello-rematch")).toHaveCount(0);
});