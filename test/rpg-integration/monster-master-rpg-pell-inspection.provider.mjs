import { expect, test } from "@playwright/test";

const campaignId = "monster-master-staging-v6";
const playerId = "rpg-provider-integration-player";
const pellId = "npc.warden-pell";
const cartId = "object.checkpoint-cart";
const westWoodsRouteId = "route.crooked-checkpoint-west-woods";

async function onboard(page) {
  await expect(page.locator("#mm-rpg-onboarding")).toBeVisible();
  await page.locator("#mm-rpg-trainer-name").fill("Provider Integration Master");
  await page.locator("#mm-rpg-onboarding-to-starter").click();
  await page.locator("#mm-rpg-onboarding-to-briefing").click();
  await page.locator("#mm-rpg-onboarding-begin").click();
  await expect(page.locator("#mm-rpg-onboarding")).toBeHidden();
}

async function worldReady(page) {
  await expect.poll(() => page.evaluate(() => Boolean(
    window.gameFrameMonsterRpgWorld?.getPayload?.()?.materialization?.anchors?.length
      && window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.transform,
  ))).toBe(true);
}

async function anchor(page, id) {
  return page.evaluate((semanticId) => {
    const item = window.gameFrameMonsterRpgWorld?.getPayload?.()?.materialization?.anchors
      ?.find((candidate) => candidate.semanticId === semanticId);
    return item ? { x: item.x, y: item.y, label: item.label } : null;
  }, id);
}

async function currentSceneId(page) {
  return page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPayload?.()?.projection?.scene?.sceneId ?? null);
}

async function walkAdjacent(page, id) {
  const path = await page.evaluate((targetId) => {
    const world = window.gameFrameMonsterRpgWorld;
    const payload = world?.getPayload?.();
    const player = world?.getPlayerPosition?.();
    const map = payload?.materialization?.map;
    const anchors = payload?.materialization?.anchors;
    const target = anchors?.find((item) => item.semanticId === targetId);
    if (!map || !target || !player?.transform) return null;
    const steps = [["north", 0, -1], ["east", 1, 0], ["south", 0, 1], ["west", -1, 0]];
    const occupied = new Set(anchors.filter((item) => item.kind !== "route" && item.kind !== "player")
      .map((item) => `${item.x},${item.y}`));
    const queue = [{ x: player.transform.x, y: player.transform.y, path: [] }];
    const seen = new Set([`${player.transform.x},${player.transform.y}`]);
    while (queue.length) {
      const current = queue.shift();
      if (Math.abs(current.x - target.x) + Math.abs(current.y - target.y) === 1) return current.path;
      for (const [direction, dx, dy] of steps) {
        const x = current.x + dx;
        const y = current.y + dy;
        const key = `${x},${y}`;
        if (seen.has(key) || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const cell = map.cells[y * map.width + x];
        if (!cell || cell.terrain === "wall" || occupied.has(key)) continue;
        seen.add(key);
        queue.push({ x, y, path: [...current.path, direction] });
      }
    }
    return null;
  }, id);
  expect(path).not.toBeNull();
  for (const direction of path) {
    const before = await page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.positionRevision ?? -1);
    expect(await page.evaluate((step) => window.gameFrameMonsterRpgWorld?.move?.(step), direction)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.positionRevision ?? -1))
      .toBeGreaterThan(before);
  }
}

async function openPell(page) {
  await walkAdjacent(page, pellId);
  const talk = page.locator("#mm-rpg-talk-nearby");
  await expect(talk).toBeVisible();
  const label = (await talk.textContent())?.trim() ?? "";
  await talk.click();
  if (/^Talk · \d+ in scene$/i.test(label)) {
    await page.locator("#mm-rpg-talk-chooser").getByRole("button", { name: /veteran field warden|Warden Pell/i }).click();
  }
  await expect(page.locator("#mm-rpg-talk-panel")).toBeVisible();
}

async function speak(page, text, reply) {
  await page.locator("#mm-rpg-talk-input").fill(text);
  await page.locator(".mm-rpg-talk-form").evaluate((form) => form.requestSubmit());
  await expect(page.locator('#mm-rpg-talk-history .mm-rpg-talk-bubble[data-speaker="character"]').last()).toHaveText(reply);
}

async function returnToWorld(page) {
  await page.locator('[data-mm-rpg-dock-tab="world"]').click();
  await expect(page.locator("#mm-rpg-talk-panel")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterRpgTalk?.getSelectedTarget?.() ?? null)).toBeNull();
  await expect(page.locator(".mm-rpg-dock-nearby")).toBeVisible();
}

async function exerciseCinderControl(page) {
  const recall = page.getByRole("button", { name: "Recall Cinder" });
  const deploy = page.getByRole("button", { name: "Deploy Cinder" });
  await expect.poll(async () => {
    const canRecall = await recall.isVisible().catch(() => false);
    const canDeploy = await deploy.isVisible().catch(() => false);
    return canRecall !== canDeploy;
  }).toBe(true);
  const startedDeployed = await recall.isVisible().catch(() => false);
  const first = startedDeployed ? recall : deploy;
  const second = startedDeployed ? deploy : recall;
  await first.click();
  await expect(second).toBeVisible();
  await second.click();
  await expect(first).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
    return payload?.projection?.viewer?.monsters?.find((monster) => monster.displayLabel === "Cinder")?.deploymentState ?? null;
  })).toBe(startedDeployed ? "deployed" : "recalled");
}

test("RPG provider path remains playable through inspection, world controls, and travel without reload", async ({ page }, testInfo) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  await onboard(page);
  await worldReady(page);
  await page.screenshot({ path: testInfo.outputPath("01-initial.png"), fullPage: true });

  const before = await anchor(page, pellId);
  await openPell(page);
  await page.screenshot({ path: testInfo.outputPath("02-pell-before-inspection.png"), fullPage: true });
  await speak(page, "Pell, go check her badge.", "Give me a second. I'll check her badge.");

  await expect.poll(async () => {
    const after = await anchor(page, pellId);
    return Boolean(after && before && `${after.x},${after.y}` !== `${before.x},${before.y}`);
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("03-pell-moved.png"), fullPage: true });

  await returnToWorld(page);
  await expect(page.locator("#mm-rpg-talk-nearby")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("04-world-recovered.png"), fullPage: true });

  await openPell(page);
  await speak(page, "What did her badge say?", "The badge gives her name as Mara Venn.");
  await page.screenshot({ path: testInfo.outputPath("05-learned-identity.png"), fullPage: true });

  await returnToWorld(page);
  await exerciseCinderControl(page);
  await page.screenshot({ path: testInfo.outputPath("06-cinder-round-trip.png"), fullPage: true });

  await walkAdjacent(page, cartId);
  await expect(page.getByRole("button", { name: "Uncover cart" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("07-cart-available.png"), fullPage: true });

  await walkAdjacent(page, westWoodsRouteId);
  const travel = page.locator("#mm-rpg-travel-control");
  await expect(travel).toBeVisible();
  await expect(travel).toHaveText(/^Travel · /);
  await page.screenshot({ path: testInfo.outputPath("08-route-travel-available.png"), fullPage: true });

  const cameraBeforeTravel = await page.evaluate(() => window.gameFrameMonsterPixi?.getCamera?.() ?? null);
  expect(cameraBeforeTravel).not.toBeNull();
  expect(await currentSceneId(page)).toBe("scene.crooked-checkpoint");
  await travel.click();
  await expect.poll(() => currentSceneId(page), { timeout: 20_000 }).toBe("scene.west-woods");
  await expect(page.locator("#mm-rpg-world-location")).toHaveText("West Woods Route");
  await expect.poll(() => page.evaluate(() => {
    const camera = window.gameFrameMonsterPixi?.getCamera?.();
    const player = window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.transform;
    return Boolean(camera && player && camera.x === player.x && camera.y === player.y);
  })).toBe(true);
  const cameraAfterTravel = await page.evaluate(() => window.gameFrameMonsterPixi?.getCamera?.() ?? null);
  expect(cameraAfterTravel?.zoom).toBe(cameraBeforeTravel?.zoom);
  expect(cameraAfterTravel?.quarter).toBe(cameraBeforeTravel?.quarter);
  await page.screenshot({ path: testInfo.outputPath("09-west-woods-after-travel.png"), fullPage: true });

  expect(browserErrors).toEqual([]);
});
