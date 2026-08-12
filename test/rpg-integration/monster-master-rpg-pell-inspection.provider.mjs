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

async function clickWorldAnchor(page, semanticId) {
  const anchor = await worldAnchor(page, semanticId);
  expect(anchor, `Expected materialized anchor ${semanticId}`).toBeTruthy();
  const target = await page.evaluate(
    ({ x, y }) => window.gameFrameMonsterPixi?.worldToScreen?.({ x, y }) ?? null,
    { x: anchor.x, y: anchor.y },
  );
  expect(target, `Expected Pixi world coordinate for ${semanticId}`).toBeTruthy();
  await page.locator("#monster-master-pixi-canvas").click({ position: { x: target.x, y: target.y } });
}

async function talkToPell(page, text) {
  await clickWorldAnchor(page, pellEntityId);
  const talk = page.getByRole("button", { name: /Talk to veteran field warden/i });
  await expect(talk).toBeVisible();
  await talk.click();
  await expect(page.locator("#mm-rpg-talk-panel")).toBeVisible();
  await expect(page.locator("#mm-rpg-talk-panel-title")).toContainText("veteran field warden");
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
