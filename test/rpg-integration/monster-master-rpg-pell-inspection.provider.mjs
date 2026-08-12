import { expect, test } from "@playwright/test";

const campaignId = "monster-master-staging-v6";
const playerId = "rpg-provider-integration-player";
const pellEntityId = "npc.warden-pell";
const maraEntityId = "npc.mara-venn";

async function completeNewPlayerOnboarding(page) {
  await expect(page.locator("#mm-rpg-onboarding")).toBeVisible();
  await page.locator("#mm-rpg-trainer-name").fill("Provider Integration Master");
  await page.locator("#mm-rpg-onboarding-to-starter").click();
  await expect(page.locator('[data-onboarding-step="2"]')).toBeVisible();
  await page.locator("#mm-rpg-onboarding-to-briefing").click();
  await expect(page.locator('[data-onboarding-step="3"]')).toBeVisible();
  await page.locator("#mm-rpg-onboarding-begin").click();
  await expect(page.locator("#mm-rpg-onboarding")).toBeHidden();
}

async function waitForWorld(page) {
  await expect.poll(async () => page.evaluate(() => {
    const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
    const position = window.gameFrameMonsterRpgWorld?.getPlayerPosition?.();
    return payload?.materialization?.anchors?.length > 0 && Boolean(position?.transform);
  })).toBe(true);
}

async function worldAnchor(page, semanticId) {
  return await page.evaluate((id) => {
    const payload = window.gameFrameMonsterRpgWorld?.getPayload?.();
    const anchor = payload?.materialization?.anchors?.find((candidate) => candidate.semanticId === id);
    return anchor ? { x: anchor.x, y: anchor.y, label: anchor.label } : null;
  }, semanticId);
}

async function pathToAdjacentTarget(page, semanticId) {
  return await page.evaluate((targetId) => {
    const world = window.gameFrameMonsterRpgWorld;
    const payload = world?.getPayload?.();
    const player = world?.getPlayerPosition?.();
    const map = payload?.materialization?.map;
    const anchors = payload?.materialization?.anchors;
    if (!map || !Array.isArray(anchors) || !player?.transform) return null;

    const target = anchors.find((candidate) => candidate.semanticId === targetId);
    if (!target) return null;
    const directions = [
      ["north", 0, -1],
      ["east", 1, 0],
      ["south", 0, 1],
      ["west", -1, 0],
    ];
    const occupied = new Set(
      anchors
        .filter((anchor) => anchor.kind !== "route" && anchor.kind !== "player")
        .map((anchor) => `${anchor.x},${anchor.y}`),
    );
    const startKey = `${player.transform.x},${player.transform.y}`;
    const queue = [{ x: player.transform.x, y: player.transform.y, path: [] }];
    const visited = new Set([startKey]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (Math.abs(current.x - target.x) + Math.abs(current.y - target.y) === 1) {
        return current.path;
      }
      for (const [direction, dx, dy] of directions) {
        const x = current.x + dx;
        const y = current.y + dy;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const cell = map.cells[y * map.width + x];
        if (!cell || cell.terrain === "wall") continue;
        if (occupied.has(key)) continue;
        visited.add(key);
        queue.push({ x, y, path: [...current.path, direction] });
      }
    }
    return null;
  }, semanticId);
}

async function walkAdjacentTo(page, semanticId) {
  const path = await pathToAdjacentTarget(page, semanticId);
  expect(path, `Expected a traversable path adjacent to ${semanticId}`).not.toBeNull();
  for (const direction of path) {
    const revisionBefore = await page.evaluate(() =>
      window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.positionRevision ?? -1,
    );
    expect(await page.evaluate(
      (step) => window.gameFrameMonsterRpgWorld?.move?.(step) ?? false,
      direction,
    )).toBe(true);
    await expect.poll(async () => page.evaluate(() =>
      window.gameFrameMonsterRpgWorld?.getPlayerPosition?.()?.positionRevision ?? -1,
    )).toBeGreaterThan(revisionBefore);
  }

  await expect.poll(async () => page.evaluate((targetId) => {
    const world = window.gameFrameMonsterRpgWorld;
    const payload = world?.getPayload?.();
    const player = world?.getPlayerPosition?.();
    const target = payload?.materialization?.anchors?.find((anchor) => anchor.semanticId === targetId);
    if (!target || !player?.transform) return false;
    return Math.abs(player.transform.x - target.x) + Math.abs(player.transform.y - target.y) === 1;
  }, semanticId)).toBe(true);
}

async function openPellTalk(page) {
  await walkAdjacentTo(page, pellEntityId);

  const directTalk = page.getByRole("button", { name: /Talk to (?:veteran field warden|Warden Pell)/i });
  const chooserTalk = page.getByRole("button", { name: /Choose among \d+ nearby characters to talk to/i });
  await expect.poll(async () =>
    (await directTalk.isVisible().catch(() => false))
    || (await chooserTalk.isVisible().catch(() => false)),
  ).toBe(true);

  if (await directTalk.isVisible().catch(() => false)) {
    await directTalk.click();
  } else {
    await chooserTalk.click();
    const chooser = page.locator("#mm-rpg-talk-chooser");
    await expect(chooser).toBeVisible();
    await chooser.getByRole("button", { name: /veteran field warden|Warden Pell/i }).click();
  }

  await expect(page.locator("#mm-rpg-talk-panel")).toBeVisible();
  await expect(page.locator("#mm-rpg-talk-panel-title")).toContainText(/veteran field warden|Warden Pell/i);
}

async function talkToPell(page, text) {
  await openPellTalk(page);
  await page.locator("#mm-rpg-talk-input").fill(text);
  await page.locator(".mm-rpg-talk-form").evaluate((form) => form.requestSubmit());
}

function containsCommittedInspection(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsCommittedInspection);
  if (
    value.kind === "actor-inspect"
    && value.state === "committed"
    && value.operation === "inspect-present-actor"
    && value.actorEntityId === pellEntityId
    && value.targetEntityId === maraEntityId
    && Number.isInteger(value.actorPositionRevision)
  ) {
    return true;
  }
  return Object.values(value).some(containsCommittedInspection);
}

test("Pell inspection crosses model personhood, physical authority, receipt, and learned identity", async ({ page }) => {
  const campaignAttachPayloads = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      response.request().method() === "POST"
      && url.pathname === `/api/rpg/campaigns/${campaignId}/attach`
      && response.status() === 200
    ) {
      void response.json().then((payload) => campaignAttachPayloads.push(payload)).catch(() => undefined);
    }
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  await completeNewPlayerOnboarding(page);
  await waitForWorld(page);

  await expect(page.locator('[data-semantic-id="npc.warden-pell"]')).toBeVisible();
  await expect(page.locator('[data-semantic-id="npc.mara-venn"]')).toBeVisible();

  const pellBefore = await worldAnchor(page, pellEntityId);
  const mara = await worldAnchor(page, maraEntityId);
  expect(pellBefore).toBeTruthy();
  expect(mara).toBeTruthy();

  await talkToPell(page, "Pell, go check her badge.");
  await expect(page.locator("#mm-rpg-events")).toContainText("Give me a second. I'll check her badge.");

  await expect.poll(() => campaignAttachPayloads.some(containsCommittedInspection)).toBe(true);

  await page.reload();
  await waitForWorld(page);
  const pellAfter = await worldAnchor(page, pellEntityId);
  expect(pellAfter).toBeTruthy();
  expect(`${pellAfter.x},${pellAfter.y}`).not.toBe(`${pellBefore.x},${pellBefore.y}`);
  expect(Math.abs(pellAfter.x - mara.x) + Math.abs(pellAfter.y - mara.y)).toBeLessThanOrEqual(1);

  await talkToPell(page, "What did her badge say?");
  await expect(page.locator("#mm-rpg-events")).toContainText("The badge gives her name as Mara Venn.");

  // The fake provider refuses the first personhood request if Mara's durable
  // identity leaked before inspection, and refuses the second if the physical
  // receipt did not update Pell's Observer Knowledge. Reaching this assertion
  // therefore proves the knowledge transition as well as the visible reply.
  expect(campaignAttachPayloads.some(containsCommittedInspection)).toBe(true);
});
