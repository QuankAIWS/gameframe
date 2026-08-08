import { expect, test } from "@playwright/test";

const campaignId = "campaign-ui-test";

function projection({ coordination = 3, presentation = 2, narrative = 1, includeResult = false } = {}) {
  const events = [
    {
      eventId: "event:scene",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: { narration: "The academy gate is sealed beneath a flickering hazard lamp." },
      createdAt: "2026-08-05T03:20:01.000Z",
    },
    {
      eventId: "event:private",
      kind: "campaign.reveal",
      audience: { kind: "player", playerId: "rpg-ui-player" },
      payload: { text: "You recognize the crest as a recent forgery." },
      createdAt: "2026-08-05T03:20:02.000Z",
    },
  ];
  if (includeResult) {
    events.push({
      eventId: "event:result",
      kind: "dialogue.turn",
      audience: { kind: "public" },
      payload: {
        speakerName: "Groundskeeper",
        dialogue: "That lock was not broken from outside.",
      },
      createdAt: "2026-08-05T03:20:03.000Z",
    });
  }
  return {
    protocolVersion: 2,
    campaignId,
    title: "Academy Gate Incident",
    status: "active",
    gameframeCoordinationRevision: coordination,
    presentationSequence: presentation,
    linkedNarrativeRevision: narrative,
    events,
  };
}

test("opens the RPG destination, resumes a campaign, and submits an action", async ({ page }) => {
  let command = null;
  let commandAccepted = false;

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(commandAccepted
        ? projection({ coordination: 4, presentation: 3, narrative: 1, includeResult: true })
        : projection()),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/commands`, async (route) => {
    command = route.request().postDataJSON();
    commandAccepted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocolVersion: 2,
        campaignId,
        commandId: command.commandId,
        deliveryId: "delivery:ui-test",
        gameframeCoordinationRevision: 4,
        presentationSequence: 3,
        linkedNarrativeRevision: 1,
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=rpg-ui-player&campaign=${campaignId}`);

  await expect(page).toHaveTitle(/Monster Master RPG/);
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign-title")).toHaveText("Academy Gate Incident");
  await expect(page.locator("#mm-rpg-coordination")).toHaveText("3");
  await expect(page.locator("#mm-rpg-events .mm-rpg-event")).toHaveCount(2);
  await expect(page.locator('[data-event-id="event:private"]')).toContainText("Private");

  await page.locator("#mm-rpg-action").fill("Inspect the gate and compare the forged crest with my field guide.");
  await page.locator("#mm-rpg-send").click();

  await expect.poll(() => command).not.toBeNull();
  expect(command.protocolVersion).toBe(2);
  expect(command.campaignId).toBe(campaignId);
  expect(command.command.kind).toBe("campaign.submit_action");
  expect(command.command.expectedGameframeCoordinationRevision).toBe(3);
  expect(command.command.text).toBe("Inspect the gate and compare the forged crest with my field guide.");
  expect(command.commandId).toMatch(/^command:/);

  await expect(page.locator("#mm-rpg-action")).toHaveValue("");
  await expect(page.locator("#mm-rpg-coordination")).toHaveText("4");
  await expect(page.locator('[data-event-id="event:result"]')).toContainText("Groundskeeper");
  await expect(page.locator("#mm-rpg-action-status")).toContainText("Action accepted");
});

test("lists Monster Master RPG as the seeded staging campaign destination", async ({ page }) => {
  await page.goto("/?player=rpg-library-player");
  const card = page.locator("#game-card-monster-master-rpg");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", "/monster-master-rpg.html?campaign=monster-master-staging");
  await expect(card).toContainText("Monster Master RPG");
});
