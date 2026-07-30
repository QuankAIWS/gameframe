import { expect, test } from "@playwright/test";

const gameId = "tactical-combat-canary";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
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

async function settlePage(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.scrollTo(0, 0);
  });
}

async function capture(page, testInfo, name, options = {}) {
  await settlePage(page);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: options.fullPage ?? true,
    animations: "disabled",
  });
}

async function createCombat(request, playerIds) {
  const response = await request.post("/api/matches", {
    headers: playerHeaders(playerIds[0]),
    data: { gameId, playerIds },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function viewAs(request, matchId, playerId) {
  const response = await request.get(`/api/matches/${encodeURIComponent(matchId)}`, {
    headers: playerHeaders(playerId),
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function submit(request, view, playerId, action) {
  const response = await request.post(`/api/matches/${encodeURIComponent(view.matchId)}/actions`, {
    headers: playerHeaders(playerId),
    data: {
      actionId: `visual-combat-${crypto.randomUUID()}`,
      expectedRevision: view.revision,
      action,
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

function destination(action) {
  return action.path.at(-1);
}

function approachMove(view) {
  const active = view.observation.board.units.find((unit) => unit.id === view.observation.activeUnitId);
  const enemies = view.observation.board.units.filter((unit) => unit.ownerId !== active.ownerId);
  const moves = view.observation.legalActions.filter((action) => action.type === "move");
  return [...moves].sort((left, right) => {
    const leftDestination = destination(left);
    const rightDestination = destination(right);
    const leftDistance = Math.min(...enemies.map((enemy) => Math.max(
      Math.abs(leftDestination.x - enemy.position.x),
      Math.abs(leftDestination.y - enemy.position.y),
    )));
    const rightDistance = Math.min(...enemies.map((enemy) => Math.max(
      Math.abs(rightDestination.x - enemy.position.x),
      Math.abs(rightDestination.y - enemy.position.y),
    )));
    return leftDistance - rightDistance || right.movementCost - left.movementCost;
  })[0] ?? null;
}

async function prepareLegalAttack(request) {
  let view = await createCombat(request, ["visual-alpha", "visual-beta"]);
  for (let step = 0; step < 40; step += 1) {
    const playerId = view.observation.activePlayerId;
    view = await viewAs(request, view.matchId, playerId);
    if (view.observation.legalActions.some((action) => action.type === "attack")) return view;

    const move = approachMove(view);
    if (move) view = await submit(request, view, playerId, move);
    if (view.observation.legalActions.some((action) => action.type === "attack")) return view;

    const end = view.observation.legalActions.find((action) => action.type === "end-activation");
    expect(end).toBeDefined();
    view = await submit(request, view, playerId, end);
  }
  throw new Error("The curated combat scenario did not reach a legal attack.");
}

test("captures board-game lobby, active, completed, error, and mobile states", async ({ page }, testInfo) => {
  await page.goto("/?player=visual-board-user");
  await expect(page.locator("#lobby")).toBeVisible();
  await capture(page, testInfo, "01-main-lobby-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, "02-main-lobby-mobile");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Challenge Theo" }).click();
  await expect(page.locator("#match-panel")).toBeVisible();
  await capture(page, testInfo, "03-tic-tac-toe-active");

  for (let turn = 0; turn < 7; turn += 1) {
    if ((await page.locator("#status").textContent())?.includes("complete")) break;
    const legal = page.locator(".cell:enabled");
    if (await legal.count() === 0) break;
    await legal.first().click();
    await expect(page.locator("#status")).not.toHaveText("Submitting move…");
  }
  await expect(page.locator("#status")).toContainText(/Match complete|Draw/);
  await capture(page, testInfo, "04-tic-tac-toe-complete");

  await page.goto("/?player=visual-board-error&match=missing-visual-match");
  await expect(page.locator("#error-banner")).toBeVisible();
  await capture(page, testInfo, "05-invalid-resume");
});

test("captures Checkers initial and selected-piece states", async ({ page }, testInfo) => {
  await page.goto("/?player=visual-checkers-user");
  await page.locator("#select-checkers").click();
  await page.getByRole("button", { name: "Challenge Theo" }).click();
  await expect(page.locator(".checkers-cell")).toHaveCount(64);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1_100);
  await capture(page, testInfo, "06-checkers-initial");

  const piece = page.locator(".checkers-cell.selectable-piece:enabled").first();
  await piece.click();
  await expect(page.locator(".checkers-cell.legal-destination:enabled").first()).toBeVisible();
  await capture(page, testInfo, "07-checkers-selected-piece");
});

test("captures tactical movement camera and path states", async ({ page }, testInfo) => {
  await page.goto("/tactical.html?player=visual-tactical-user");
  await page.getByRole("button", { name: "Race Theo" }).click();
  await expect(page.locator("#tactical-canvas")).toBeVisible();
  await capture(page, testInfo, "08-tactical-movement-initial");

  await page.getByRole("button", { name: "Pan camera east" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.locator("#tactical-canvas").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tactical-destinations button").first()).toBeVisible();
  await capture(page, testInfo, "09-tactical-movement-paths");
});

test("captures tactical combat activation, move, attack, and damage states", async ({ page, request }, testInfo) => {
  await page.goto("/combat.html?player=visual-combat-user");
  await page.getByRole("button", { name: "Skirmish with Theo" }).click();
  await expect(page.locator("#combat-canvas")).toBeVisible();
  await capture(page, testInfo, "10-tactical-combat-activation");

  await page.locator("#combat-select-move").click();
  await expect(page.locator('#combat-options button[data-action-kind="move"]').first()).toBeVisible();
  await capture(page, testInfo, "11-tactical-combat-move-options");

  const prepared = await prepareLegalAttack(request);
  const actingPlayer = prepared.observation.activePlayerId;
  await page.goto(`/combat.html?match=${encodeURIComponent(prepared.matchId)}&player=${encodeURIComponent(actingPlayer)}`);
  await expect(page.locator("#combat-revision")).toHaveText(`Revision ${prepared.revision}`);
  await page.locator("#combat-select-attack").click();
  const target = page.locator('#combat-options button[data-action-kind="attack"]').first();
  await expect(target).toBeVisible();
  await capture(page, testInfo, "12-tactical-combat-attack-options");
  await target.click();
  await expect(page.locator("#combat-effects .damage")).toBeVisible();
  await capture(page, testInfo, "13-tactical-combat-damage");
});

test("captures hosted authentication and signed-session presentation", async ({ page }, testInfo) => {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "authentication_required", message: "Authentication required." }),
  }));
  await page.goto("/");
  await expect(page.locator("#gameframe-auth-gate")).toBeVisible();
  await capture(page, testInfo, "14-hosted-authentication-gate");

  await page.unroute("**/api/session");
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:111222333", "Synthetic Discord User")),
  }));
  await page.reload();
  await expect(page.locator("#gameframe-session-badge")).toContainText("Synthetic Discord User");
  await capture(page, testInfo, "15-authenticated-session-badge");
});

test("captures secure invitation pending, success, and error states", async ({ page }, testInfo) => {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:111", "Synthetic Inviter")),
  }));
  await page.route("**/api/invitations", (route) => route.fulfill({
    status: 201,
    contentType: "application/json",
    body: JSON.stringify({
      invitation: {
        invitationId: "visual-invite",
        gameId: "tic-tac-toe",
        status: "pending",
        inviter: { playerId: "discord:111", displayName: "Synthetic Inviter", avatarUrl: null },
        claimant: null,
        targetRestricted: false,
        issuedAt: 1_000,
        expiresAt: 2_000,
        matchId: null,
      },
      inviteUrl: "https://visual.example/invite.html?token=synthetic-signed-token",
    }),
  }));
  await page.route("**/api/invitations/visual-invite", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      invitation: {
        invitationId: "visual-invite",
        gameId: "tic-tac-toe",
        status: "pending",
        inviter: { playerId: "discord:111", displayName: "Synthetic Inviter", avatarUrl: null },
        claimant: null,
        targetRestricted: false,
        issuedAt: 1_000,
        expiresAt: 2_000,
        matchId: null,
      },
      resumePath: null,
    }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Play with a friend" }).click();
  await expect(page.locator("#gameframe-invite-dialog")).toBeVisible();
  await capture(page, testInfo, "16-secure-invitation-pending");

  await page.unroute("**/api/invitations");
  await page.unroute("**/api/invitations/visual-invite");
  await page.route("**/api/invitations/claim", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      invitation: {
        invitationId: "visual-claim",
        gameId: "tactical-combat-canary",
        status: "claimed",
        inviter: { playerId: "discord:111", displayName: "Synthetic Inviter", avatarUrl: null },
        claimant: { playerId: "discord:222", displayName: "Synthetic Friend", avatarUrl: null },
        targetRestricted: false,
        issuedAt: 1_000,
        expiresAt: 2_000,
        matchId: "visual-combat-match",
      },
      resumePath: "/combat.html?match=visual-combat-match",
    }),
  }));
  await page.goto("/invite.html?token=synthetic-claim-token");
  await expect(page.locator("#invite-claim-status")).toHaveText("The second seat is securely claimed.");
  await capture(page, testInfo, "17-invitation-claim-success");

  await page.unroute("**/api/invitations/claim");
  await page.goto("/invite.html");
  await expect(page.locator("#invite-claim-status")).toHaveText("The invitation could not be claimed.");
  await capture(page, testInfo, "18-invitation-claim-error");
});
