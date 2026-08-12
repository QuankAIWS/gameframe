import { expect, test } from "@playwright/test";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
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

async function viewAs(page, matchId, playerId) {
  const response = await page.context().request.get(`/api/matches/${encodeURIComponent(matchId)}`, {
    headers: playerHeaders(playerId),
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function submit(page, view, playerId, action) {
  const response = await page.context().request.post(`/api/matches/${encodeURIComponent(view.matchId)}/actions`, {
    headers: playerHeaders(playerId),
    data: {
      actionId: `stale-precommit-${crypto.randomUUID()}`,
      expectedRevision: view.revision,
      action,
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function dispatchBoardCoordinate(page, coordinate) {
  const dispatched = await page.evaluate(
    (target) => window.gameFrameMonsterPixiBridge.dispatchCoordinate(target),
    coordinate,
  );
  expect(dispatched).toBe(true);
}

test("stale Monster Master deployment refreshes without duplicate mutation", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => (
      delay === 1200 ? 0 : nativeSetInterval(callback, delay, ...args)
    );
  });
  await page.goto("/monster-master.html?player=monster-stale");
  await page.locator("#monster-master-bot").click();
  await waitForPixi(page);
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 0");

  const browserState = await diagnostics(page);
  expect(browserState.selectedUnitId).toBeTruthy();
  const staleView = await viewAs(page, browserState.matchId, browserState.playerId);
  const deployment = staleView.observation.legalActions.find((action) => (
    action.type === "deploy-unit"
    && action.unitId === browserState.selectedUnitId
    && Number.isFinite(action.position?.x)
    && Number.isFinite(action.position?.y)
  ));
  expect(deployment).toBeDefined();

  const committed = await submit(page, staleView, browserState.playerId, deployment);
  expect(committed.revision).toBe(2);
  expect(committed.observation.board.units).toHaveLength(2);
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 0");

  await dispatchBoardCoordinate(page, deployment.position);
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 2");
  await expect(page.locator("#monster-master-error")).toBeHidden();
  await expect(page.locator("#monster-master-roster-list .combat-roster-unit")).toHaveCount(8);

  const refreshed = await viewAs(page, browserState.matchId, browserState.playerId);
  expect(refreshed.revision).toBe(2);
  expect(refreshed.observation.board.units).toHaveLength(2);
});