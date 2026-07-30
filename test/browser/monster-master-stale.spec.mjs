import { expect, test } from "@playwright/test";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
}

async function diagnostics(page) {
  return page.locator("#monster-master-details").evaluate((node) => JSON.parse(node.textContent));
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

test("stale Monster Master deployment refreshes without duplicate mutation", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => (
      delay === 1200 ? 0 : nativeSetInterval(callback, delay, ...args)
    );
  });
  await page.goto("/monster-master.html?player=monster-stale");
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 0");

  const browserState = await diagnostics(page);
  const staleView = await viewAs(page, browserState.matchId, browserState.playerId);
  const bounds = browserState.viewport.bounds;
  const deployment = staleView.observation.legalActions.find((action) => (
    action.type === "deploy-unit"
    && action.unitId === browserState.selectedUnitId
    && action.position.x >= bounds.x
    && action.position.y >= bounds.y
    && action.position.x < bounds.x + bounds.columns
    && action.position.y < bounds.y + bounds.rows
  ));
  expect(deployment).toBeDefined();

  const committed = await submit(page, staleView, browserState.playerId, deployment);
  expect(committed.revision).toBe(2);
  expect(committed.observation.board.units).toHaveLength(2);
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 0");

  await clickBoardCoordinate(page, deployment.position);
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 2");
  await expect(page.locator("#monster-master-error")).toBeHidden();
  await expect(page.locator("#monster-master-roster-list .combat-roster-unit")).toHaveCount(6);

  const refreshed = await viewAs(page, browserState.matchId, browserState.playerId);
  expect(refreshed.revision).toBe(2);
  expect(refreshed.observation.board.units).toHaveLength(2);
});
