import { expect, test } from "@playwright/test";

const gameId = "monster-master-duel";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
}

async function viewAs(page, matchId, playerId) {
  const response = await page.request.get(`/api/matches/${encodeURIComponent(matchId)}`, {
    headers: playerHeaders(playerId),
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function diagnostics(page) {
  return page.locator("#monster-master-details").evaluate((node) => JSON.parse(node.textContent));
}

async function clickBoardCoordinate(page, coordinate) {
  const state = await diagnostics(page);
  const box = await page.locator("#monster-master-canvas").boundingBox();
  expect(box).not.toBeNull();
  const bounds = state.viewport.bounds;
  const cellSize = Math.min(box.width / bounds.columns, box.height / bounds.rows);
  const boardWidth = cellSize * bounds.columns;
  const boardHeight = cellSize * bounds.rows;
  const originX = (box.width - boardWidth) / 2;
  const originY = (box.height - boardHeight) / 2;
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
  expect(view.gameId).toBe(gameId);
  const bounds = state.viewport.bounds;
  const selectedUnitId = state.selectedUnitId;
  const action = view.observation.legalActions.find((candidate) => (
    candidate.type === "deploy-unit"
    && candidate.unitId === selectedUnitId
    && candidate.position.x >= bounds.x
    && candidate.position.y >= bounds.y
    && candidate.position.x < bounds.x + bounds.columns
    && candidate.position.y < bounds.y + bounds.rows
  ));
  expect(action).toBeDefined();
  await clickBoardCoordinate(page, action.position);
}

test("deploys a full roster, advances combat against Theo, and resumes the duel", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-master-human");
  await page.locator("#monster-master-theo").click();

  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 0");
  await expect(page.locator("#monster-master-phase")).toHaveText("Deployment");
  await expect(page.locator("#monster-master-roster-list .combat-roster-unit")).toHaveCount(6);
  await expect(page.locator("#monster-master-status")).toContainText("Deploy Alpha Warden Master");

  for (let deployment = 1; deployment <= 3; deployment += 1) {
    await deploySelectedUnit(page);
    await expect(page.locator("#monster-master-revision")).toHaveText(`Revision ${deployment * 2}`);
  }

  await expect(page.locator("#monster-master-phase")).toHaveText("Combat");
  await expect(page.locator("#monster-master-active-unit")).toContainText("Alpha Emberling");
  await expect(page.locator("#monster-master-status")).toContainText("Your activation");

  await page.locator("#monster-master-select-move").click();
  const move = page.locator('#monster-master-options button[data-action-kind="move"]').first();
  await expect(move).toBeVisible();
  await move.click();
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 7");
  await expect(page.locator("#monster-master-move-budget")).toHaveText("Used");

  await page.locator("#monster-master-end-activation").click();
  await expect(page.locator("#monster-master-active-unit")).toContainText("Alpha Warden Master");
  const matchId = (await diagnostics(page)).matchId;
  const resumedRevision = await page.locator("#monster-master-revision-small").textContent();

  await page.reload();
  await expect(page.locator("#monster-master-revision-small")).toHaveText(resumedRevision);
  await expect(page).toHaveURL(new RegExp(`match=${matchId}`));
  await expect(page.locator("#monster-master-phase")).toHaveText("Combat");
});

test("two browser seats alternate Monster Master deployment on one match", async ({ browser }) => {
  const alphaContext = await browser.newContext();
  const betaContext = await browser.newContext();
  const alpha = await alphaContext.newPage();
  const beta = await betaContext.newPage();
  try {
    await alpha.goto("/monster-master.html?player=monster-alpha");
    await alpha.locator("#monster-master-human").click();
    const inviteInput = alpha.locator("#monster-master-invite-link");
    await expect(inviteInput).toHaveValue(/monster-master\.html.*match=/);
    const invite = await inviteInput.inputValue();

    await beta.goto(invite);
    await expect(beta.locator("#monster-master-status")).toContainText("Opponent");

    await deploySelectedUnit(alpha);
    await expect(beta.locator("#monster-master-status")).toContainText("Deploy Beta Warden Master");
    await deploySelectedUnit(beta);
    await expect(alpha.locator("#monster-master-status")).toContainText("Deploy Alpha Stone Bulwark");
  } finally {
    await alphaContext.close();
    await betaContext.close();
  }
});

test("Monster Master controls remain usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/monster-master.html?player=monster-mobile");
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("#monster-master-canvas")).toBeVisible();
  await expect(page.locator("#monster-master-select-deploy")).toBeVisible();
  await page.locator("#monster-master-zoom-in").click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
