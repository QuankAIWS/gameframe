import { expect, test } from "@playwright/test";

function discordSession(playerId, displayName) {
  return {
    authenticated: true,
    playerId,
    source: "discord",
    displayName,
    avatarUrl: null,
  };
}

test("Discord-authenticated browser creates and follows a secure friend invitation", async ({ page }) => {
  let statusReads = 0;
  let creationBody = null;

  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:111", "Inviter")),
  }));
  await page.route("**/api/invitations", async (route) => {
    creationBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: {
          invitationId: "invite-browser",
          gameId: "tic-tac-toe",
          status: "pending",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: null,
          targetRestricted: false,
          issuedAt: 1000,
          expiresAt: 2000,
          matchId: null,
        },
        inviteUrl: "https://games.example/invite.html?token=signed-token",
      }),
    });
  });
  await page.route("**/api/invitations/invite-browser", async (route) => {
    statusReads += 1;
    const claimed = statusReads > 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: {
          invitationId: "invite-browser",
          gameId: "tic-tac-toe",
          status: claimed ? "claimed" : "pending",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: claimed
            ? { playerId: "discord:222", displayName: "Friend", avatarUrl: null }
            : null,
          targetRestricted: false,
          issuedAt: 1000,
          expiresAt: 2000,
          matchId: claimed ? "match-secure" : null,
        },
        resumePath: claimed ? "/?match=match-secure" : null,
      }),
    });
  });
  await page.route("**/api/matches/match-secure", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      gameId: "tic-tac-toe",
      matchId: "match-secure",
      revision: 0,
      eventCount: 0,
      playerIds: ["discord:111", "discord:222"],
      observation: {
        board: Array(9).fill(null),
        yourMark: "X",
        nextPlayerId: "discord:111",
        status: { lifecycle: "active", winnerPlayerId: null, draw: false },
        legalActions: Array.from({ length: 9 }, (_, cell) => ({ type: "place", cell })),
      },
    }),
  }));

  await page.goto("/");
  await expect(page.locator("#gameframe-session-badge")).toContainText("Inviter");
  await page.locator("#create-human-match").click();

  const dialog = page.locator("#gameframe-invite-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#gameframe-invite-link")).toHaveValue(
    "https://games.example/invite.html?token=signed-token",
  );
  expect(creationBody).toEqual({ gameId: "tic-tac-toe" });
  await expect(dialog.locator("[data-invite-status]")).toContainText("Friend securely claimed");
  await page.waitForURL(/\?match=match-secure$/);
  expect(statusReads).toBeGreaterThanOrEqual(2);
});

test("authenticated recipient claims an invitation and removes the token from browser history", async ({ page }) => {
  let claimBody = null;
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:222", "Friend")),
  }));
  await page.route("**/api/invitations/claim", async (route) => {
    claimBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: {
          invitationId: "invite-claim-page",
          gameId: "tactical-combat-canary",
          status: "claimed",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: { playerId: "discord:222", displayName: "Friend", avatarUrl: null },
          targetRestricted: false,
          issuedAt: 1000,
          expiresAt: 2000,
          matchId: "combat-match",
        },
        resumePath: "/combat.html?match=combat-match",
      }),
    });
  });

  await page.goto("/invite.html?token=signed-token-value");
  await expect(page.locator("#invite-claim-status")).toHaveText("The second seat is securely claimed.");
  await expect(page.locator("#invite-claim-details")).toContainText("Inviter invited you to Tactical Combat");
  await expect(page.locator("#invite-open-match")).toHaveAttribute(
    "href",
    "/combat.html?match=combat-match",
  );
  await expect(page).toHaveURL(/\/invite\.html$/);
  expect(claimBody).toEqual({ token: "signed-token-value" });
});
