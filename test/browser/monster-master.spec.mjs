import { expect, test } from "@playwright/test";

const gameId = "monster-master-duel";
const roleOrder = ["master", "bulwark", "emberling"];

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
}

async function createMonsterMaster(request, playerIds = ["browser-monster-alpha", "browser-monster-beta"]) {
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
      actionId: `browser-monster-master-${crypto.randomUUID()}`,
      expectedRevision: view.revision,
      action,
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function diagnostics(page) {
  return page.locator("#monster-master-details").evaluate((node) => JSON.parse(node.textContent));
}

async function waitForPixi(page) {
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterPixiBridge))).toBe(true);
}

async function dispatchBoardCoordinate(page, coordinate) {
  const dispatched = await page.evaluate(
    (target) => window.gameFrameMonsterPixiBridge.dispatchCoordinate(target),
    coordinate,
  );
  expect(dispatched).toBe(true);
}

async function deploySelectedUnit(page) {
  const action = await page.evaluate(() => {
    const view = window.gameFrameMonsterController.getView();
    const state = JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
    return view.observation.legalActions.find((candidate) => (
      candidate.type === "deploy-unit" && candidate.unitId === state.selectedUnitId
    )) ?? null;
  });
  expect(action).not.toBeNull();
  await dispatchBoardCoordinate(page, action.position);
}

function rosterUnit(view, unitId) {
  return Object.values(view.observation.rosters).flat().find((unit) => unit.id === unitId);
}

function chooseDeployment(view) {
  const activePlayerId = view.observation.activePlayerId;
  const playerIndex = view.observation.playerIds.indexOf(activePlayerId);
  return [...view.observation.legalActions]
    .filter((action) => action.type === "deploy-unit")
    .sort((left, right) => {
      const leftRole = rosterUnit(view, left.unitId)?.role;
      const rightRole = rosterUnit(view, right.unitId)?.role;
      const roleDifference = roleOrder.indexOf(leftRole) - roleOrder.indexOf(rightRole);
      if (roleDifference) return roleDifference;
      const edgeDifference = playerIndex === 0
        ? right.position.x - left.position.x
        : left.position.x - right.position.x;
      return edgeDifference
        || Math.abs(left.position.y - 11) - Math.abs(right.position.y - 11)
        || left.position.y - right.position.y
        || left.position.x - right.position.x;
    })[0];
}

function destination(action) {
  return action.path.at(-1);
}

function distanceToEnemyMaster(view, action) {
  const active = view.observation.board.units.find((unit) => unit.id === action.unitId);
  const enemyMaster = view.observation.board.units.find((unit) => (
    unit.ownerId !== active.ownerId && unit.role === "master"
  ));
  if (!enemyMaster) return 0;
  const target = destination(action);
  return Math.max(
    Math.abs(target.x - enemyMaster.position.x),
    Math.abs(target.y - enemyMaster.position.y),
  );
}

function chooseDeterministicAction(view, { passiveCombat = false } = {}) {
  if (view.observation.phase === "deployment") return chooseDeployment(view);
  const actions = view.observation.legalActions;
  if (passiveCombat) return actions.find((action) => action.type === "end-activation");

  const enemyMasterAttack = actions.find((action) => (
    action.type === "attack"
    && view.observation.board.units.find((unit) => unit.id === action.targetUnitId)?.role === "master"
  ));
  if (enemyMasterAttack) return enemyMasterAttack;

  const attack = actions.find((action) => action.type === "attack");
  if (attack) return attack;

  const mend = [...actions]
    .filter((action) => action.type === "use-ability")
    .sort((left, right) => right.healing - left.healing || left.targetUnitId.localeCompare(right.targetUnitId))[0];
  if (mend) return mend;

  const move = [...actions]
    .filter((action) => action.type === "move")
    .sort((left, right) => (
      distanceToEnemyMaster(view, left) - distanceToEnemyMaster(view, right)
      || right.movementCost - left.movementCost
      || destination(left).y - destination(right).y
      || destination(left).x - destination(right).x
    ))[0];
  if (move) return move;

  return actions.find((action) => action.type === "end-activation");
}

async function prepareAuthoritativeState(request, predicate, options = {}) {
  let view = await createMonsterMaster(request, options.playerIds);
  for (let step = 0; step < (options.maximumActions ?? 600); step += 1) {
    if (predicate(view)) return view;
    if (view.observation.status.lifecycle === "completed") break;
    const activePlayerId = view.observation.activePlayerId;
    view = await viewAs(request, view.matchId, activePlayerId);
    if (predicate(view)) return view;
    const action = chooseDeterministicAction(view, options);
    expect(action).toBeDefined();
    view = await submit(request, view, activePlayerId, action);
  }
  if (predicate(view)) return view;
  throw new Error("The deterministic Monster Master browser setup did not reach the requested state.");
}

async function openPrepared(page, prepared, playerId) {
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.matchId)}&player=${encodeURIComponent(playerId)}`);
  await waitForPixi(page);
}

test("deploys a full creature roster, advances combat against Theo, and resumes the battle", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/monster-master.html?player=monster-master-human");
  await page.locator("#monster-master-theo").click();
  await waitForPixi(page);

  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 0");
  await expect(page.locator("#monster-master-phase")).toHaveText("Deployment");
  await expect(page.locator("#monster-master-roster-list .combat-roster-unit")).toHaveCount(6);
  await expect(page.locator("#monster-master-status")).toContainText("Verdant Sage");

  for (let deployment = 1; deployment <= 3; deployment += 1) {
    await deploySelectedUnit(page);
    await expect(page.locator("#monster-master-revision")).toHaveText(`Revision ${deployment * 2}`);
  }

  await expect(page.locator("#monster-master-phase")).toHaveText("Combat");
  await page.locator("#monster-master-select-move").click();
  await page.locator('#monster-master-options button[data-action-kind="move"]').first().click();
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 7");
  await expect(page.locator(".combat-canvas-frame")).toHaveAttribute("data-last-effect-types", /unit-moved/);

  await page.locator("#monster-master-end-activation").click();
  const matchId = (await diagnostics(page)).matchId;
  const resumedRevision = await page.locator("#monster-master-revision-small").textContent();
  await page.reload();
  await waitForPixi(page);
  await expect(page.locator("#monster-master-revision-small")).toHaveText(resumedRevision);
  await expect(page).toHaveURL(new RegExp(`match=${matchId}`));
});

test("two browser seats alternate Monster Master deployment on one Pixi battlefield", async ({ browser }) => {
  test.setTimeout(45_000);
  const alphaContext = await browser.newContext();
  const betaContext = await browser.newContext();
  const alpha = await alphaContext.newPage();
  const beta = await betaContext.newPage();
  try {
    await alpha.goto("/monster-master.html?player=monster-alpha");
    await alpha.locator("#monster-master-human").click();
    await waitForPixi(alpha);
    const invite = await alpha.locator("#monster-master-invite-link").inputValue();
    await beta.goto(invite);
    await waitForPixi(beta);

    await deploySelectedUnit(alpha);
    await expect(beta.locator("#monster-master-status")).toContainText("Beta Verdant Sage");
    await deploySelectedUnit(beta);
    await expect(alpha.locator("#monster-master-status")).toContainText("Stone Bulwark");
  } finally {
    await alphaContext.close().catch(() => {});
    await betaContext.close().catch(() => {});
  }
});

test("commits an attack and presents its authoritative battlefield damage effect", async ({ page, request }) => {
  const prepared = await prepareAuthoritativeState(request, (view) => view.observation.legalActions.some((action) => action.type === "attack"));
  const actingPlayer = prepared.observation.activePlayerId;
  const attack = prepared.observation.legalActions.find((action) => action.type === "attack");
  await openPrepared(page, prepared, actingPlayer);
  await page.locator("#monster-master-select-attack").click();
  await page.locator(`#monster-master-options button[data-target-unit-id="${attack.targetUnitId}"]`).click();
  await expect(page.locator("#monster-master-revision")).toHaveText(`Revision ${prepared.revision + 1}`);
  await expect(page.locator(".combat-canvas-frame")).toHaveAttribute("data-last-effect-types", /unit-damaged/);
  await expect(page.locator("#monster-master-effects .damage")).toContainText("took");
});

test("spends command energy and presents a legal Mend effect", async ({ page, request }) => {
  const prepared = await prepareAuthoritativeState(request, (view) => view.observation.legalActions.some((action) => action.type === "use-ability"));
  const actingPlayer = prepared.observation.activePlayerId;
  const mend = prepared.observation.legalActions.find((action) => action.type === "use-ability");
  const commandBefore = prepared.observation.commandByPlayer[actingPlayer];
  await openPrepared(page, prepared, actingPlayer);
  await page.locator("#monster-master-select-mend").click();
  await page.locator(`#monster-master-options button[data-target-unit-id="${mend.targetUnitId}"]`).click();
  await expect(page.locator(".combat-canvas-frame")).toHaveAttribute("data-last-effect-types", /unit-healed/);
  expect((await diagnostics(page)).commandByPlayer[actingPlayer]).toBe(commandBefore - mend.commandCost);
});

test("renders defeated creatures and the authoritative defeat presentation", async ({ page, request }) => {
  const prepared = await prepareAuthoritativeState(request, (view) => view.observation.lastEffects.some((effect) => effect.type === "unit-defeated"));
  await openPrepared(page, prepared, prepared.playerIds[0]);
  await expect(page.locator("#monster-master-roster-list .is-defeated")).toHaveCount(prepared.observation.defeatedUnitIds.length);
  await expect(page.locator(".combat-canvas-frame")).toHaveAttribute("data-last-effect-types", /unit-defeated/);
});

test("renders a completed Monster Master victory and disables actions", async ({ page, request }) => {
  const prepared = await prepareAuthoritativeState(request, (view) => view.observation.status.lifecycle === "completed" && Boolean(view.observation.status.winnerPlayerId));
  await openPrepared(page, prepared, prepared.playerIds[0]);
  await expect(page.locator("#monster-master-result-screen")).toBeVisible();
  await expect(page.locator("#monster-master-select-move")).toBeDisabled();
  await expect(page.locator("#monster-master-select-attack")).toBeDisabled();
  await expect(page.locator("#monster-master-end-activation")).toBeDisabled();
});

test("renders the bounded round-cap draw", async ({ page, request }) => {
  const prepared = await prepareAuthoritativeState(request, (view) => view.observation.status.draw, { passiveCombat: true, maximumActions: 220 });
  await openPrepared(page, prepared, prepared.playerIds[0]);
  await expect(page.locator("#monster-master-result-screen")).toBeVisible();
  await expect(page.locator("#monster-master-result-title")).toHaveText("Draw");
  await expect(page.locator("#monster-master-end-activation")).toBeDisabled();
});

test("Monster Master controls remain usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/monster-master.html?player=monster-mobile");
  await page.locator("#monster-master-theo").click();
  await waitForPixi(page);
  await expect(page.locator("#monster-master-select-deploy")).toBeVisible();
  await page.locator("#monster-master-zoom-in").click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
