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

test("Discord-authenticated Checkers challenge stays Checkers through player targeting and claim", async ({ page }) => {
  let statusReads = 0;
  let creationBody = null;

  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:111", "Inviter")),
  }));
  await page.route("**/api/players", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      players: [{ playerId: "discord:222", displayName: "Friend", avatarUrl: null, source: "discord" }],
    }),
  }));
  await page.route("**/api/invitations", async (route) => {
    creationBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: {
          invitationId: "invite-browser",
          gameId: "american-checkers",
          status: "pending",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: null,
          targetPlayerId: "discord:222",
          targetRestricted: true,
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
          gameId: "american-checkers",
          status: claimed ? "claimed" : "pending",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: claimed ? { playerId: "discord:222", displayName: "Friend", avatarUrl: null } : null,
          targetPlayerId: "discord:222",
          targetRestricted: true,
          issuedAt: 1000,
          expiresAt: 2000,
          matchId: claimed ? "match-secure" : null,
        },
        resumePath: claimed ? "/?game=american-checkers&match=match-secure" : null,
      }),
    });
  });
  await page.route("**/api/matches/match-secure", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      gameId: "american-checkers",
      matchId: "match-secure",
      revision: 0,
      eventCount: 0,
      playerIds: ["discord:111", "discord:222"],
      observation: {
        board: Array(64).fill(null),
        activePlayerId: "discord:111",
        nextPlayerId: "discord:111",
        status: { lifecycle: "active", winnerPlayerId: null, draw: false },
        legalActions: [],
        mustCapture: false,
      },
    }),
  }));

  await page.goto("/?game=american-checkers&menu=1");
  await expect(page.locator("#gameframe-session-badge")).toContainText("Inviter");
  await page.locator("#create-human-match").click();
  const dialog = page.locator("#gameframe-invite-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-invite-game]")).toHaveText("Clockwork Checkers");
  await expect(dialog.locator('[data-challenge-player-id="discord:222"]')).toContainText("Friend");
  await dialog.locator('[data-challenge-player-id="discord:222"]').click();

  expect(creationBody).toEqual({ gameId: "american-checkers", targetPlayerId: "discord:222" });
  await expect(dialog.locator("[data-invite-status]")).toContainText(/Challenge sent to Friend|Friend accepted/);
  await page.waitForURL(/\?game=american-checkers&match=match-secure$/);
  await expect(page.locator("#board")).toHaveClass(/board-checkers/);
  expect(statusReads).toBeGreaterThanOrEqual(2);
});

test("profile selection opens Checkers with the same player pinned", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("scribbles-gameframe.boot-seen:v2", "seen"));
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:111", "Viewer")),
  }));
  await page.route("**/api/players/*/profile", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      profile: { playerId: "discord:222", displayName: "Friend", avatarUrl: null, source: "discord" },
      progression: { gamerLevel: 2, gamerXp: 150, xpToNextLevel: 50, progress: 0.75, cascade: {}, games: {} },
    }),
  }));
  await page.route("**/api/players", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ players: [{ playerId: "discord:222", displayName: "Friend", avatarUrl: null, source: "discord" }] }),
  }));

  await page.goto("/profile.html?view=discord%3A222");
  const panel = page.locator(".profile-play-together");
  await expect(panel).toHaveCount(1);
  await panel.getByRole("link", { name: "Clockwork Checkers" }).click();

  const dialog = page.locator("#gameframe-invite-dialog");
  await expect(dialog).toBeVisible();
  const selected = dialog.locator('[data-challenge-player-id="discord:222"]');
  await expect(selected).toHaveAttribute("aria-current", "true");
  await expect(selected).toContainText("Friend");
  await expect(dialog.locator("[data-invite-status]")).toContainText("Player selected from profile");
  await expect(page).toHaveURL(/\?game=american-checkers&menu=1$/);
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
          targetPlayerId: null,
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
  await expect(page.locator("#invite-open-match")).toHaveAttribute("href", "/combat.html?match=combat-match");
  await expect(page).toHaveURL(/\/invite\.html$/);
  expect(claimBody).toEqual({ token: "signed-token-value" });
});
