import { expect, test } from "@playwright/test";

const campaignId = "monster-master-staging-v6";
const playerId = "rpg-integration-player";

function legalAdjacentMove(payload, position) {
  const directions = [
    ["north", 0, -1],
    ["east", 1, 0],
    ["south", 0, 1],
    ["west", -1, 0],
  ];
  const map = payload.materialization.map;
  const occupied = new Set(
    payload.materialization.anchors
      .filter((anchor) => anchor.kind !== "route" && anchor.kind !== "player")
      .map((anchor) => `${anchor.x},${anchor.y}`),
  );
  for (const [direction, dx, dy] of directions) {
    const x = position.transform.x + dx;
    const y = position.transform.y + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    const cell = map.cells[y * map.width + x];
    if (!cell || cell.terrain === "wall") continue;
    if (occupied.has(`${x},${y}`)) continue;
    return { direction, x, y };
  }
  throw new Error("The canonical integration scene has no adjacent traversable cell for the player.");
}

async function completeNewPlayerOnboarding(page) {
  await expect(page.locator("#mm-rpg-onboarding")).toBeVisible();
  await page.locator("#mm-rpg-trainer-name").fill("Integration Master");
  await page.locator("#mm-rpg-onboarding-to-starter").click();
  await expect(page.locator('[data-onboarding-step="2"]')).toBeVisible();
  await page.locator("#mm-rpg-onboarding-to-briefing").click();
  await expect(page.locator('[data-onboarding-step="3"]')).toBeVisible();
  await page.locator("#mm-rpg-onboarding-begin").click();
  await expect(page.locator("#mm-rpg-onboarding")).toBeHidden();
}

async function clickWorldAnchor(page, semanticId) {
  const anchor = await page.evaluate((id) => {
    const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
    return payload?.materialization?.anchors?.find((candidate) => candidate.semanticId === id) ?? null;
  }, semanticId);
  expect(anchor, `Expected materialized anchor ${semanticId}`).toBeTruthy();

  const target = await page.evaluate(
    ({ x, y }) => window.gameFrameMonsterPixi?.worldToScreen?.({ x, y }) ?? null,
    { x: anchor.x, y: anchor.y },
  );
  expect(target, `Expected Pixi world coordinate for ${semanticId}`).toBeTruthy();
  await page.locator("#monster-master-pixi-canvas").click({ position: { x: target.x, y: target.y } });
}

async function exerciseCoveredCart(page) {
  await expect(page.locator('[data-semantic-id="object.checkpoint-cart"]')).toBeVisible();
  await clickWorldAnchor(page, "object.checkpoint-cart");

  const uncover = page.getByRole("button", { name: "Uncover cart" });
  await expect(uncover).toBeVisible();
  await expect(uncover.locator("xpath=..")).toHaveClass(/mm-rpg-dock-nearby-actions/);
  await uncover.click();
  await expect(uncover).toBeHidden();

  await expect.poll(async () => page.evaluate(() => {
    const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
    return payload?.projection?.scene?.objects?.find((object) => object.entityId === "object.checkpoint-cart")?.state ?? null;
  })).toBe("uncovered");
}

async function exerciseCinderControl(page) {
  const recall = page.getByRole("button", { name: "Recall Cinder" });
  const deploy = page.getByRole("button", { name: "Deploy Cinder" });

  await expect.poll(async () => ({
    recall: await recall.isVisible().catch(() => false),
    deploy: await deploy.isVisible().catch(() => false),
  })).toSatisfy(({ recall: canRecall, deploy: canDeploy }) => canRecall !== canDeploy);

  const startedDeployed = await recall.isVisible().catch(() => false);
  const first = startedDeployed ? recall : deploy;
  const second = startedDeployed ? deploy : recall;

  await first.click();
  await expect(second).toBeVisible();
  await second.click();
  await expect(first).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
    return payload?.projection?.viewer?.monsters?.find((monster) => monster.displayLabel === "Cinder")?.deploymentState ?? null;
  })).toBe(startedDeployed ? "deployed" : "recalled");
}

test("Monster Master RPG completes authoritative player actions through real GameFrame and Runtime services", async ({ page }) => {
  const rpgResponses = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/rpg/")) {
      rpgResponses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    }
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  await completeNewPlayerOnboarding(page);

  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign-code")).toHaveText(campaignId);
  await expect(page.locator("#mm-rpg-world-location")).toHaveText("The Crooked Checkpoint");
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect(page.locator('[data-semantic-id="npc.warden-pell"]')).toBeVisible();
  await expect(page.locator('[data-semantic-id="object.checkpoint-cart"]')).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
    const position = window.gameFrameMonsterRpgWorld?.getPlayerPosition?.();
    return payload && position ? { payload, position } : null;
  })).not.toBeNull();

  const stateBefore = await page.evaluate(() => ({
    payload: window.gameFrameMonsterRpgWorld.getPayload(),
    position: window.gameFrameMonsterRpgWorld.getPlayerPosition(),
  }));
  const move = legalAdjacentMove(stateBefore.payload, stateBefore.position);
  const revisionBefore = stateBefore.position.positionRevision;

  expect(await page.evaluate((direction) => window.gameFrameMonsterRpgWorld.move(direction), move.direction)).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.gameFrameMonsterRpgWorld.getPlayerPosition()?.positionRevision)).toBeGreaterThan(revisionBefore);
  await expect.poll(async () => page.evaluate(() => window.gameFrameMonsterRpgWorld.getPlayerPosition()?.transform)).toEqual({
    x: move.x,
    y: move.y,
    facing: move.direction,
  });

  const persistedRevision = await page.evaluate(() => window.gameFrameMonsterRpgWorld.getPlayerPosition().positionRevision);
  await page.reload();

  await expect(page.locator("#mm-rpg-world-location")).toHaveText("The Crooked Checkpoint");
  await expect.poll(async () => page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.positionRevision)).toBe(persistedRevision);
  await expect.poll(async () => page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.transform)).toEqual({
    x: move.x,
    y: move.y,
    facing: move.direction,
  });

  await exerciseCoveredCart(page);
  await exerciseCinderControl(page);

  expect(rpgResponses.some((entry) => entry.method === "POST" && entry.path.endsWith("/attach") && entry.status === 200)).toBe(true);
  expect(rpgResponses.some((entry) => entry.method === "POST" && entry.path.endsWith("/exploration/attach") && entry.status === 200)).toBe(true);
  expect(rpgResponses.some((entry) => entry.method === "POST" && entry.path.endsWith("/exploration/move") && entry.status === 200)).toBe(true);
  expect(rpgResponses.some((entry) => entry.method === "POST" && entry.path.endsWith("/exploration/interact") && entry.status === 200)).toBe(true);
  expect(rpgResponses.filter((entry) => entry.method === "POST" && entry.path.endsWith("/exploration/control") && entry.status === 200)).toHaveLength(2);
});
