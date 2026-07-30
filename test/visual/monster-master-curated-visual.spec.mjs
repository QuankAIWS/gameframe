import { expect, test } from "@playwright/test";

const gameId = "monster-master-duel";
const roleOrder = ["master", "bulwark", "emberling"];

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
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

async function diagnostics(page) {
  return page.locator("#monster-master-details").evaluate((node) => JSON.parse(node.textContent));
}

async function createMonsterMaster(request, playerIds) {
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
      actionId: `visual-monster-master-${crypto.randomUUID()}`,
      expectedRevision: view.revision,
      action,
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function clickBoardCoordinate(page, coordinate) {
  const state = await diagnostics(page);
  const box = await page.locator("#monster-master-canvas").boundingBox();
  expect(box).not.toBeNull();
  const bounds = state.viewport.bounds;
  const cellSize = Math.min(box.width / bounds.columns, box.height / bounds.rows);
  const originX = (box.width - cellSize * bounds.columns) / 2;
  const originY = (box.height - cellSize * bounds.rows) / 2;
  await page.locator("#monster-master-canvas").click({
    position: {
      x: originX + (coordinate.x - bounds.x + 0.5) * cellSize,
      y: originY + (coordinate.y - bounds.y + 0.5) * cellSize,
    },
  });
}

async function deploySelectedUnit(page) {
  const state = await diagnostics(page);
  const view = await viewAs(page.context().request, state.matchId, state.playerId);
  const bounds = state.viewport.bounds;
  const action = view.observation.legalActions.find((candidate) => (
    candidate.type === "deploy-unit"
    && candidate.unitId === state.selectedUnitId
    && candidate.position.x >= bounds.x
    && candidate.position.y >= bounds.y
    && candidate.position.x < bounds.x + bounds.columns
    && candidate.position.y < bounds.y + bounds.rows
  ));
  expect(action).toBeDefined();
  await clickBoardCoordinate(page, action.position);
  await expect.poll(async () => (await diagnostics(page)).revision).toBeGreaterThan(state.revision);
}

function rosterUnit(view, unitId) {
  return Object.values(view.observation.rosters)
    .flat()
    .find((unit) => unit.id === unitId);
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
  const suffix = crypto.randomUUID();
  let view = await createMonsterMaster(request, [
    `visual-alpha-${suffix}`,
    `visual-beta-${suffix}`,
  ]);
  for (let step = 0; step < (options.maximumActions ?? 600); step += 1) {
    if (predicate(view)) return view;
    if (view.observation.status.lifecycle === "completed") break;
    const activePlayerId = view.observation.activePlayerId;
    expect(activePlayerId).toBeTruthy();
    view = await viewAs(request, view.matchId, activePlayerId);
    if (predicate(view)) return view;
    const action = chooseDeterministicAction(view, options);
    expect(action).toBeDefined();
    view = await submit(request, view, activePlayerId, action);
  }
  if (predicate(view)) return view;
  throw new Error("The deterministic Monster Master visual setup did not reach the requested state.");
}

async function openPreparedState(page, prepared, playerId = prepared.observation.activePlayerId ?? prepared.playerIds[0]) {
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.matchId)}&player=${encodeURIComponent(playerId)}`);
  await expect(page.locator("#monster-master-revision")).toHaveText(`Revision ${prepared.revision}`);
  await expect(page.locator("#monster-master-invite-panel")).not.toHaveAttribute("open", "");
}

function coordinateVisible(coordinate, bounds) {
  return coordinate.x >= bounds.x
    && coordinate.y >= bounds.y
    && coordinate.x < bounds.x + bounds.columns
    && coordinate.y < bounds.y + bounds.rows;
}

async function panCameraToCoordinate(page, coordinate) {
  for (let step = 0; step < 10; step += 1) {
    const state = await diagnostics(page);
    const bounds = state.viewport.bounds;
    if (coordinateVisible(coordinate, bounds)) return;
    if (coordinate.x < bounds.x) {
      await page.getByRole("button", { name: "Pan camera west" }).click();
    } else if (coordinate.x >= bounds.x + bounds.columns) {
      await page.getByRole("button", { name: "Pan camera east" }).click();
    } else if (coordinate.y < bounds.y) {
      await page.getByRole("button", { name: "Pan camera north" }).click();
    } else {
      await page.getByRole("button", { name: "Pan camera south" }).click();
    }
  }
  const state = await diagnostics(page);
  expect(coordinateVisible(coordinate, state.viewport.bounds)).toBe(true);
}

test("captures Monster Master lobby, deployment, combat, and move-selection states", async ({ page }, testInfo) => {
  await page.goto("/monster-master.html?player=visual-monster-master");
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await capture(page, testInfo, "19-monster-master-lobby-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, "20-monster-master-lobby-mobile");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("#monster-master-phase")).toHaveText("Deployment");
  await expect(page.locator('#monster-master-options button[data-action-kind="deploy-unit"]')).toHaveCount(3);
  await capture(page, testInfo, "21-monster-master-deployment");

  for (let deployment = 0; deployment < 3; deployment += 1) {
    await deploySelectedUnit(page);
  }
  await expect(page.locator("#monster-master-phase")).toHaveText("Combat");
  await expect(page.locator("#monster-master-help")).toHaveText(
    "Battlefield actions, targets, and resolved outcomes appear here.",
  );
  await capture(page, testInfo, "22-monster-master-combat-activation");

  await page.locator("#monster-master-select-move").click();
  await expect(page.locator('#monster-master-options button[data-action-kind="move"]').first()).toBeVisible();
  await capture(page, testInfo, "23-monster-master-move-options");
});

test("captures Monster Master attack targeting and result", async ({ page, request }, testInfo) => {
  const prepared = await prepareAuthoritativeState(
    request,
    (view) => view.observation.legalActions.some((action) => action.type === "attack"),
  );
  const attack = prepared.observation.legalActions.find((action) => action.type === "attack");
  await openPreparedState(page, prepared);

  await page.locator("#monster-master-select-attack").click();
  const target = page.locator(`#monster-master-options button[data-action-kind="attack"][data-target-unit-id="${attack.targetUnitId}"]`);
  await expect(target).toBeVisible();
  await capture(page, testInfo, "24-monster-master-attack-targeting");

  await target.click();
  await expect(page.locator("#monster-master-revision")).toHaveText(`Revision ${prepared.revision + 1}`);
  await expect(page.locator("#monster-master-effects .damage")).toContainText("took");
  await capture(page, testInfo, "25-monster-master-attack-result");
});

test("captures Monster Master Mend targeting and result", async ({ page, request }, testInfo) => {
  const prepared = await prepareAuthoritativeState(
    request,
    (view) => view.observation.legalActions.some((action) => action.type === "use-ability"),
  );
  const mend = prepared.observation.legalActions.find((action) => action.type === "use-ability");
  await openPreparedState(page, prepared);

  await page.locator("#monster-master-select-mend").click();
  const target = page.locator(`#monster-master-options button[data-action-kind="use-ability"][data-target-unit-id="${mend.targetUnitId}"]`);
  await expect(target).toBeVisible();
  await capture(page, testInfo, "26-monster-master-mend-targeting");

  await target.click();
  await expect(page.locator("#monster-master-revision")).toHaveText(`Revision ${prepared.revision + 1}`);
  await expect(page.locator("#monster-master-effects")).toContainText("recovered");
  await capture(page, testInfo, "27-monster-master-mend-result");
});

test("captures Monster Master defeat aftermath", async ({ page, request }, testInfo) => {
  const prepared = await prepareAuthoritativeState(
    request,
    (view) => view.observation.lastEffects.some((effect) => effect.type === "unit-defeated"),
  );
  await openPreparedState(page, prepared, prepared.playerIds[0]);
  await expect(page.locator("#monster-master-roster-list .is-defeated")).toHaveCount(prepared.observation.defeatedUnitIds.length);
  await expect(page.locator("#monster-master-effects .defeat")).toContainText("defeated");
  await capture(page, testInfo, "28-monster-master-defeat");
});

test("captures Monster Master victory", async ({ page, request }, testInfo) => {
  const prepared = await prepareAuthoritativeState(
    request,
    (view) => view.observation.status.lifecycle === "completed" && Boolean(view.observation.status.winnerPlayerId),
  );
  await openPreparedState(page, prepared, prepared.playerIds[0]);
  await expect(page.locator("#monster-master-status")).toContainText("won the duel");
  await expect(page.locator("#monster-master-effects .victory")).toBeVisible();
  await capture(page, testInfo, "29-monster-master-victory");
});

test("captures Monster Master bounded draw", async ({ page, request }, testInfo) => {
  const prepared = await prepareAuthoritativeState(
    request,
    (view) => view.observation.status.lifecycle === "completed" && view.observation.status.draw,
    { passiveCombat: true },
  );
  await openPreparedState(page, prepared, prepared.playerIds[0]);
  await expect(page.locator("#monster-master-status")).toContainText("draw");
  await expect(page.locator("#monster-master-effects .victory")).toContainText("draw");
  const survivingUnit = prepared.observation.board.units.find((unit) => unit.ownerId === prepared.playerIds[0])
    ?? prepared.observation.board.units[0];
  expect(survivingUnit).toBeDefined();
  await panCameraToCoordinate(page, survivingUnit.position);
  await capture(page, testInfo, "30-monster-master-draw");
});
