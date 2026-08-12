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

test("Monster Master RPG materializes and persists movement through real GameFrame and Runtime services", async ({ page }) => {
  const rpgResponses = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/rpg/")) {
      rpgResponses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    }
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign-code")).toHaveText(campaignId);
  await expect(page.locator("#mm-rpg-world-location")).toHaveText("The Crooked Checkpoint");
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect(page.locator('[data-semantic-id="npc.warden-pell"]')).toBeVisible();
  await expect(page.locator('[data-semantic-id="object.checkpoint-cart"]')).toBeVisible();

  const before = await expect.poll(async () => page.evaluate(() => {
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

  expect(rpgResponses.some((entry) => entry.method === "POST" && entry.path.endsWith("/attach") && entry.status === 200)).toBe(true);
  expect(rpgResponses.some((entry) => entry.method === "POST" && entry.path.endsWith("/exploration/attach") && entry.status === 200)).toBe(true);
  expect(rpgResponses.some((entry) => entry.method === "POST" && entry.path.endsWith("/exploration/move") && entry.status === 200)).toBe(true);
});
