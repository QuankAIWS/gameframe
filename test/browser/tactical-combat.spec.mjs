import { expect, test } from "@playwright/test";

const gameId = "tactical-combat-canary";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
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
      actionId: `browser-combat-${crypto.randomUUID()}`,
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
  let view = await createCombat(request, ["browser-alpha", "browser-beta"]);
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
  throw new Error("The deterministic browser scenario did not reach a legal attack.");
}

test("moves, ends, observes Theo, and resumes a tactical combat match", async ({ page }) => {
  await page.goto("/combat.html?player=combat-human");
  await page.locator("#combat-theo").click();

  await expect(page.locator("#combat-revision")).toHaveText("Revision 0");
  await expect(page.locator("#combat-active-unit")).toContainText("Blue Vanguard");
  await expect(page.locator("#combat-status")).toContainText("Your activation");

  await page.locator("#combat-select-move").click();
  const firstMove = page.locator('#combat-options button[data-action-kind="move"]').first();
  await expect(firstMove).toBeVisible();
  await firstMove.click();
  await expect(page.locator("#combat-revision")).toHaveText("Revision 1");
  await expect(page.locator("#combat-move-budget")).toHaveText("Used");

  await page.locator("#combat-end-activation").click();
  await expect(page.locator("#combat-revision")).toHaveText("Revision 4");
  await expect(page.locator("#combat-active-unit")).toContainText("Blue Ranger");
  const matchId = await page.locator("#combat-details").evaluate((node) => JSON.parse(node.textContent).matchId);

  await page.reload();
  await expect(page.locator("#combat-revision")).toHaveText("Revision 4");
  await expect(page).toHaveURL(new RegExp(`match=${matchId}`));
  await expect(page.locator("#combat-roster-list .combat-roster-unit")).toHaveCount(4);
});

test("two browser seats share and advance one combat match", async ({ browser }) => {
  const alphaContext = await browser.newContext();
  const betaContext = await browser.newContext();
  const alpha = await alphaContext.newPage();
  const beta = await betaContext.newPage();
  try {
    await alpha.goto("/combat.html?player=combat-alpha");
    await alpha.locator("#combat-human").click();
    const inviteInput = alpha.locator("#combat-invite-link");
    await expect(inviteInput).toHaveValue(/combat\.html.*match=/);
    const invite = await inviteInput.inputValue();

    await beta.goto(invite);
    await expect(beta.locator("#combat-status")).toContainText("Opponent");
    await alpha.locator("#combat-end-activation").click();
    await expect(beta.locator("#combat-status")).toContainText("Your activation");

    await beta.locator("#combat-select-move").click();
    await beta.locator('#combat-options button[data-action-kind="move"]').first().click();
    await expect(beta.locator("#combat-revision")).toHaveText("Revision 2");
    await beta.locator("#combat-end-activation").click();
    await expect(alpha.locator("#combat-revision")).toHaveText("Revision 3");
    await expect(alpha.locator("#combat-active-unit")).toContainText("Blue Ranger");
  } finally {
    await alphaContext.close();
    await betaContext.close();
  }
});

test("selects and commits a legal Canvas combat attack", async ({ page, request }) => {
  const prepared = await prepareLegalAttack(request);
  const actingPlayer = prepared.observation.activePlayerId;
  await page.goto(`/combat.html?match=${encodeURIComponent(prepared.matchId)}&player=${encodeURIComponent(actingPlayer)}`);
  await expect(page.locator("#combat-revision")).toHaveText(`Revision ${prepared.revision}`);

  await page.locator("#combat-select-attack").click();
  const target = page.locator('#combat-options button[data-action-kind="attack"]').first();
  await expect(target).toBeVisible();
  await target.click();

  await expect(page.locator("#combat-revision")).toHaveText(`Revision ${prepared.revision + 1}`);
  await expect(page.locator("#combat-effects .damage")).toBeVisible();
});

test("combat Canvas controls remain usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/combat.html?player=combat-mobile");
  await page.locator("#combat-theo").click();
  await expect(page.locator("#combat-canvas")).toBeVisible();
  await expect(page.locator("#combat-select-move")).toBeVisible();
  await page.locator("#combat-zoom-in").click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
