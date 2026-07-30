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

async function firstVisibleDeployment(page) {
  const state = await diagnostics(page);
  const view = await viewAs(page, state.matchId, state.playerId);
  const bounds = state.viewport.bounds;
  return view.observation.legalActions.find((action) => (
    action.type === "deploy-unit"
    && action.unitId === state.selectedUnitId
    && action.position.x >= bounds.x
    && action.position.y >= bounds.y
    && action.position.x < bounds.x + bounds.columns
    && action.position.y < bounds.y + bounds.rows
  ));
}

test("Monster Master camera buttons and keyboard controls update the viewport", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-controls");
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("#monster-master-phase")).toHaveText("Deployment");

  const initial = await diagnostics(page);
  await page.locator("#monster-master-zoom-in").click();
  const zoomed = await diagnostics(page);
  expect(zoomed.viewport.zoom).toBeGreaterThan(initial.viewport.zoom);
  expect(zoomed.viewport.bounds.columns).toBeLessThan(initial.viewport.bounds.columns);

  await page.locator('[data-monster-master-pan-x="3"][data-monster-master-pan-y="0"]').click();
  const panned = await diagnostics(page);
  expect(panned.viewport.centerX).toBeGreaterThan(zoomed.viewport.centerX);

  await page.locator("#monster-master-center-field").click();
  const centered = await diagnostics(page);
  expect(centered.viewport.centerX).toBe(11.5);
  expect(centered.viewport.centerY).toBe(11.5);

  const canvas = page.locator("#monster-master-canvas");
  await canvas.focus();
  await canvas.press("ArrowLeft");
  const keyboardPanned = await diagnostics(page);
  expect(keyboardPanned.viewport.centerX).toBeLessThan(centered.viewport.centerX);

  await canvas.press("d");
  await expect(page.locator("#monster-master-select-deploy")).toHaveAttribute("aria-pressed", "false");
  await canvas.press("d");
  await expect(page.locator("#monster-master-select-deploy")).toHaveAttribute("aria-pressed", "true");
});

test("mobile Monster Master deploys through the Canvas without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/monster-master.html?player=monster-mobile-deploy");
  await page.locator("#monster-master-theo").click();

  const action = await firstVisibleDeployment(page);
  expect(action).toBeDefined();
  await clickBoardCoordinate(page, action.position);
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 2");
  await expect(page.locator("#monster-master-status")).toContainText("Deploy Alpha Stone Bulwark");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Back to setup stops the active surface and allows a fresh duel", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-reset");
  await page.locator("#monster-master-theo").click();
  const firstMatchId = (await diagnostics(page)).matchId;

  await page.locator("#monster-master-new-match").click();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(page.locator("#monster-master-match")).toBeHidden();
  await expect(page).not.toHaveURL(/match=/);

  await page.locator("#monster-master-theo").click();
  const secondMatchId = (await diagnostics(page)).matchId;
  expect(secondMatchId).not.toBe(firstMatchId);
});
