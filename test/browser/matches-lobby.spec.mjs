import { expect, test } from "@playwright/test";

test("Matches presents the board-game 1v1 lobby before match activity", async ({ page }) => {
  await page.goto("/matches.html?player=matches-lobby-ui");

  await expect(page.getByRole("heading", { name: "Matches" })).toBeVisible();
  await expect(page.getByText("Your 1v1 lobby.")).toBeVisible();

  const start = page.getByRole("region", { name: "Start a match" });
  await expect(start).toBeVisible();
  await expect(start.getByRole("link", { name: "Tic-Tac-Toe", exact: true }).first()).toHaveAttribute(
    "href",
    "/?game=tic-tac-toe&menu=1",
  );
  await expect(start.getByRole("link", { name: "Checkers", exact: true }).first()).toHaveAttribute(
    "href",
    "/?game=american-checkers&menu=1",
  );
  await expect(start.getByRole("link", { name: "Othello", exact: true }).first()).toHaveAttribute(
    "href",
    "/othello.html",
  );

  await expect(start.getByRole("link", { name: "All", exact: true })).toHaveAttribute("href", "/matches.html");
  await expect(start.getByRole("link", { name: "Checkers", exact: true }).last()).toHaveAttribute(
    "href",
    "/matches.html?game=american-checkers",
  );

  const sectionOrder = await page.locator(".platform-grid > .platform-section h2").allTextContents();
  expect(sectionOrder).toEqual(["Start a match", "Challenges", "Your turn", "Waiting", "Completed"]);
});

test("incoming challenge can be declined from the Matches lobby", async ({ page }) => {
  let declined = false;
  let declineMethod = null;

  await page.route("**/api/players", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ players: [] }),
  }));
  await page.route("**/api/me/feed", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      matches: [],
      invitations: declined ? [] : [{
        invitationId: "decline-me",
        gameId: "american-checkers",
        status: "pending",
        inviter: { playerId: "discord:111", displayName: "Mom", avatarUrl: null },
        claimant: null,
        targetRestricted: true,
        issuedAt: Math.floor(Date.now() / 1000) - 10,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        matchId: null,
        claimToken: "recipient-only-token",
        updatedAt: Date.now() - 10_000,
      }],
      favoriteGameIds: [],
    }),
  }));
  await page.route("**/api/invitations/decline-me/decline", async (route) => {
    declineMethod = route.request().method();
    declined = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: { invitationId: "decline-me", status: "declined" },
        resumePath: null,
      }),
    });
  });

  await page.goto("/matches.html?player=discord%3A222");
  const challenges = page.locator("#challenges-list");
  await expect(challenges).toContainText("Mom challenged you to Clockwork Checkers");
  await expect(challenges.getByRole("button", { name: "Accept" })).toBeVisible();
  await challenges.getByRole("button", { name: "Decline" }).click();

  await expect.poll(() => declineMethod).toBe("POST");
  await expect(page.locator("#challenges-count")).toHaveText("0");
  await expect(challenges).toContainText("No pending challenges.");
});
