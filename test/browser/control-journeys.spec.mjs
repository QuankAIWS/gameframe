import { expect, test } from "@playwright/test";

function uniquePlayer(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function discordSession(playerId, displayName) {
  return {
    authenticated: true,
    playerId,
    source: "discord",
    displayName,
    avatarUrl: null,
  };
}

test("navigates game surfaces, diagnostics, and setup reset controls", async ({ page }) => {
  await page.goto(`/?player=${encodeURIComponent(uniquePlayer("controls"))}`);

  await page.locator("#select-checkers").click();
  await expect(page.getByRole("heading", { name: "American Checkers" })).toBeVisible();
  await expect(page.locator("#select-checkers")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#select-tic-tac-toe").click();
  await expect(page.getByRole("heading", { name: "Tic-Tac-Toe" })).toBeVisible();
  await expect(page.locator("#select-tic-tac-toe")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#open-tactical-canary").click();
  await expect(page).toHaveURL(/\/tactical\.html$/);
  await expect(page.getByRole("heading", { name: "Tactical Movement" })).toBeVisible();

  await page.getByRole("link", { name: "Other games" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Challenge GameFrameBot" }).click();
  await expect(page.locator("#match-panel")).toBeVisible();

  const diagnostics = page.locator("details.diagnostics");
  await diagnostics.locator("summary").click();
  await expect(diagnostics).toHaveAttribute("open", "");
  await expect(page.locator("#details")).not.toBeEmpty();
  await diagnostics.locator("summary").click();
  await expect(diagnostics).not.toHaveAttribute("open", "");

  await page.getByRole("button", { name: "Back to match setup" }).click();
  await expect(page.locator("#lobby")).toBeVisible();
  await expect(page.locator("#match-panel")).toBeHidden();
});

test("exercises tactical camera controls and navigation", async ({ page }) => {
  await page.goto(`/tactical.html?player=${encodeURIComponent(uniquePlayer("camera"))}`);
  await page.getByRole("button", { name: "Race GameFrameBot" }).click();
  await expect(page.locator("#tactical-canvas")).toBeVisible();

  const viewport = page.locator("#tactical-viewport-label");
  const initial = await viewport.textContent();

  await page.getByRole("button", { name: "Pan camera east" }).click();
  await expect(viewport).not.toHaveText(initial);
  const east = await viewport.textContent();

  await page.getByRole("button", { name: "Pan camera south" }).click();
  await expect(viewport).not.toHaveText(east);

  await page.getByRole("button", { name: "Beacon" }).click();
  const beacon = await viewport.textContent();
  await page.getByRole("button", { name: "Active" }).click();
  await expect(viewport).not.toHaveText(beacon);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(viewport).toContainText("1.25×");
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect(viewport).toContainText("1.00×");

  await page.getByRole("button", { name: "Pan camera west" }).click();
  await page.getByRole("button", { name: "Pan camera north" }).click();

  const diagnostics = page.locator("details.diagnostics");
  await diagnostics.locator("summary").click();
  await expect(diagnostics).toHaveAttribute("open", "");

  await page.getByRole("link", { name: "Other games" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("exercises combat camera, diagnostics, and setup controls", async ({ page }) => {
  await page.goto(`/combat.html?player=${encodeURIComponent(uniquePlayer("combat-controls"))}`);
  await page.getByRole("button", { name: "Skirmish with GameFrameBot" }).click();
  await expect(page.locator("#combat-canvas")).toBeVisible();

  await page.getByRole("button", { name: "Pan camera east" }).click();
  await page.getByRole("button", { name: "Pan camera south" }).click();
  await page.getByRole("button", { name: "Center" }).click();
  await page.getByRole("button", { name: "Active" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("button", { name: "Pan camera west" }).click();
  await page.getByRole("button", { name: "Pan camera north" }).click();

  const diagnostics = page.locator("details.diagnostics");
  await diagnostics.locator("summary").click();
  await expect(diagnostics).toHaveAttribute("open", "");
  await expect(page.locator("#combat-details")).not.toBeEmpty();

  await page.getByRole("button", { name: "Back to setup" }).click();
  await expect(page.locator("#combat-lobby")).toBeVisible();
  await expect(page.locator("#combat-match")).toBeHidden();

  await page.getByRole("link", { name: "Movement canary" }).click();
  await expect(page).toHaveURL(/\/tactical\.html$/);
});

test("logs out a Discord-authenticated browser and restores the authentication gate", async ({ page }) => {
  let authenticated = true;
  let logoutRequests = 0;

  await page.route("**/api/session", (route) => route.fulfill({
    status: authenticated ? 200 : 401,
    contentType: "application/json",
    body: authenticated
      ? JSON.stringify(discordSession("discord:111", "Journey User"))
      : JSON.stringify({ error: "authentication_required", message: "Authentication required." }),
  }));
  await page.route("**/auth/logout", async (route) => {
    logoutRequests += 1;
    authenticated = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    });
  });

  await page.goto("/");
  await expect(page.locator("#gameframe-session-badge")).toContainText("Journey User");
  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page.locator("#gameframe-auth-gate")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discord sign-in required" })).toBeVisible();
  expect(logoutRequests).toBe(1);
});

test("copies and cancels a secure invitation", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let cancelled = false;

  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:111", "Inviter")),
  }));
  await page.route("**/api/invitations", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: {
          invitationId: "copy-cancel-invite",
          gameId: "tic-tac-toe",
          status: "pending",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: null,
          targetRestricted: false,
          issuedAt: 1_000,
          expiresAt: 2_000,
          matchId: null,
        },
        inviteUrl: "https://games.example/invite.html?token=copy-cancel-token",
      }),
    });
  });
  await page.route("**/api/invitations/copy-cancel-invite/cancel", async (route) => {
    cancelled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: {
          invitationId: "copy-cancel-invite",
          gameId: "tic-tac-toe",
          status: "cancelled",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: null,
          targetRestricted: false,
          issuedAt: 1_000,
          expiresAt: 2_000,
          matchId: null,
        },
      }),
    });
  });
  await page.route("**/api/invitations/copy-cancel-invite", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        invitation: {
          invitationId: "copy-cancel-invite",
          gameId: "tic-tac-toe",
          status: cancelled ? "cancelled" : "pending",
          inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
          claimant: null,
          targetRestricted: false,
          issuedAt: 1_000,
          expiresAt: 2_000,
          matchId: null,
        },
        resumePath: null,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Play with a friend" }).click();
  const dialog = page.locator("#gameframe-invite-dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Copy" }).click();
  await expect(dialog.locator("[data-invite-status]")).toContainText("Invitation copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://games.example/invite.html?token=copy-cancel-token",
  );

  await dialog.getByRole("button", { name: "Cancel invitation" }).click();
  await expect(dialog.locator("[data-invite-status]")).toHaveText("Invitation cancelled.");
  await expect(dialog.getByRole("button", { name: "Cancel invitation" })).toBeDisabled();
  expect(cancelled).toBe(true);
});

test("shows safe invitation errors for missing and rejected tokens", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:222", "Recipient")),
  }));

  await page.goto("/invite.html");
  await expect(page.locator("#invite-claim-status")).toHaveText("The invitation could not be claimed.");
  await expect(page.locator("#invite-claim-details")).toHaveText("This invitation link is missing or malformed.");
  await expect(page.locator("#invite-open-match")).toBeHidden();

  await page.route("**/api/invitations/claim", (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({
      error: "invitation_claimed",
      message: "This invitation has already been claimed by another authenticated user.",
    }),
  }));
  await page.goto("/invite.html?token=already-claimed-token");
  await expect(page.locator("#invite-claim-status")).toHaveText("The invitation could not be claimed.");
  await expect(page.locator("#invite-claim-details")).toContainText("already been claimed");
  await expect(page.locator("#invite-open-match")).toBeHidden();
});
