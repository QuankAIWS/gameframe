import { expect, test } from "@playwright/test";

function discordSession(playerId, displayName) {
  return { authenticated: true, playerId, source: "discord", displayName, avatarUrl: null };
}

function pendingInvitation() {
  return {
    invitationId: "invite-mom-checkers",
    gameId: "american-checkers",
    status: "pending",
    inviter: { playerId: "discord:111", displayName: "Mom", avatarUrl: null },
    claimant: null,
    targetPlayerId: "discord:222",
    targetRestricted: true,
    claimToken: "recipient-claim-token",
    issuedAt: Date.now() - 5000,
    updatedAt: Date.now() - 5000,
    expiresAt: Date.now() + 600000,
    matchId: null,
  };
}

async function installRecipientRoutes(page, state) {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:222", "Recipient")),
  }));
  await page.route("**/api/players", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ players: [] }),
  }));
  await page.route("**/api/me/feed", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ invitations: state.pending ? [pendingInvitation()] : [], matches: [] }),
  }));
}

async function expectAlertInSessionBand(page, trigger) {
  const sessionBadge = page.locator("#gameframe-session-badge");
  const [bellBounds, sessionBounds] = await Promise.all([
    trigger.boundingBox(),
    sessionBadge.boundingBox(),
  ]);
  expect(bellBounds).not.toBeNull();
  expect(sessionBounds).not.toBeNull();
  const gap = sessionBounds.x - (bellBounds.x + bellBounds.width);
  const bellCenterY = bellBounds.y + (bellBounds.height / 2);
  const sessionCenterY = sessionBounds.y + (sessionBounds.height / 2);
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(Math.abs(bellCenterY - sessionCenterY)).toBeLessThanOrEqual(4);
  expect(bellBounds.y).toBeGreaterThanOrEqual(0);
  expect(bellBounds.y + bellBounds.height).toBeLessThanOrEqual(72);
}

test("recipient sees a Checkers invite in the game-screen alerts bell and can accept it", async ({ page }) => {
  const state = { pending: true };
  let claimBody = null;
  await installRecipientRoutes(page, state);
  await page.route("**/api/invitations/claim", async (route) => {
    claimBody = route.request().postDataJSON();
    state.pending = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ resumePath: "/?game=american-checkers&match=match-from-alert" }),
    });
  });
  await page.route("**/api/matches/match-from-alert", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      gameId: "american-checkers",
      matchId: "match-from-alert",
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
  const trigger = page.locator("#gameframe-alerts-trigger");
  await expect(trigger).toHaveAttribute("aria-label", "Alerts, 1 pending challenge");
  await expect(trigger.locator("[data-alert-count]")).toHaveText("1");
  await expectAlertInSessionBand(page, trigger);
  await trigger.click();
  const panel = page.locator("#gameframe-alerts-panel");
  await expect(panel).toContainText("Mom challenged you");
  await expect(panel).toContainText("Clockwork Checkers");
  await expect(panel.getByRole("button", { name: "Accept" })).toHaveCSS("background-color", "rgb(182, 239, 105)");
  await panel.getByRole("button", { name: "Accept" }).click();

  expect(claimBody).toEqual({ token: "recipient-claim-token" });
  await page.waitForURL(/\?game=american-checkers&match=match-from-alert$/);
});

test("declining from the game-screen alerts bell clears the recipient badge", async ({ page }) => {
  const state = { pending: true };
  let declineRequests = 0;
  await installRecipientRoutes(page, state);
  await page.route("**/api/invitations/invite-mom-checkers/decline", async (route) => {
    declineRequests += 1;
    state.pending = false;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/?game=american-checkers&menu=1");
  const trigger = page.locator("#gameframe-alerts-trigger");
  await expect(trigger).toHaveAttribute("aria-label", "Alerts, 1 pending challenge");
  await expectAlertInSessionBand(page, trigger);
  await trigger.click();
  const panel = page.locator("#gameframe-alerts-panel");
  await panel.getByRole("button", { name: "Decline" }).click();

  expect(declineRequests).toBe(1);
  await expect(trigger).toHaveAttribute("aria-label", "Alerts, no pending challenges");
  await expect(trigger.locator("[data-alert-count]")).toBeHidden();
  await expect(panel).toContainText("No new challenges.");
});
