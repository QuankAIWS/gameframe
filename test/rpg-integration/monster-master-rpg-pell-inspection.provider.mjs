import { expect, test } from "@playwright/test";

const campaignId = "monster-master-staging-v6";
const playerId = "rpg-provider-integration-player";
const pellId = "npc.warden-pell";

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

test("Pell visibly completes inspection without a browser reload", async ({ page }, testInfo) => {
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

  await page.locator('[data-mm-rpg-dock-tab="world"]').click();
  await expect(page.locator("#mm-rpg-talk-panel")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterRpgTalk?.getSelectedTarget?.() ?? null)).toBeNull();
  await expect(page.locator("#mm-rpg-talk-nearby")).toBeVisible();
  await expect(page.locator(".mm-rpg-dock-nearby")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("04-world-recovered.png"), fullPage: true });

  await openPell(page);
  await speak(page, "What did her badge say?", "The badge gives her name as Mara Venn.");
  await page.screenshot({ path: testInfo.outputPath("05-learned-identity.png"), fullPage: true });

  expect(browserErrors).toEqual([]);
});
