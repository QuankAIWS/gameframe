import { expect, test } from "@playwright/test";

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

async function deploySelectedUnit(page) {
  const state = await diagnostics(page);
  const view = await viewAs(page, state.matchId, state.playerId);
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
    "Use the action controls and highlighted battlefield cells to resolve the duel.",
  );
  await capture(page, testInfo, "22-monster-master-combat-activation");

  await page.locator("#monster-master-select-move").click();
  await expect(page.locator('#monster-master-options button[data-action-kind="move"]').first()).toBeVisible();
  await capture(page, testInfo, "23-monster-master-move-options");
});
