import { expect, test } from "@playwright/test";

const campaignId = "campaign-ui-test";
const stagingCampaignId = "monster-master-staging-v6";

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

function stagingProjection() {
  return {
    protocolVersion: 2,
    campaignId: stagingCampaignId,
    title: "Monster Master: Crooked Checkpoint",
    status: "active",
    gameframeCoordinationRevision: 2,
    presentationSequence: 2,
    linkedNarrativeRevision: 1,
    events: [{
      eventId: "event:staging-opening",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: {
        speakerName: "Pell",
        narration: "Pell waits beside the Crooked Checkpoint marker while the route ahead disappears into the trees.",
      },
      createdAt: "2026-08-08T02:40:00.000Z",
    }],
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

test("idle RPG campaign no longer uses the former 2.5-second polling loop", async ({ page }) => {
  let attachCount = 0;
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    attachCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(projection()),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=rpg-idle-player&campaign=${campaignId}`);
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect.poll(() => attachCount).toBe(1);

  await page.waitForTimeout(3_200);
  expect(attachCount).toBe(1);
});

test("lists Monster Master RPG under Role-Playing Games", async ({ page }) => {
  await page.goto("/?player=rpg-library-player");

  const rpgCard = page.locator("#game-card-role-playing-games");
  await expect(rpgCard).toBeVisible();
  await expect(rpgCard).toHaveAttribute("href", "/gameframe-rpg.html");
  await rpgCard.click();

  await expect(page).toHaveURL(/\/gameframe-rpg\.html$/);
  await expect(page.getByRole("heading", { name: "Monster Master RPG" })).toBeVisible();
  const monsterMasterRpg = page.getByRole("link", { name: "Open Monster Master RPG" });
  await expect(monsterMasterRpg).toHaveAttribute("href", `/monster-master-rpg.html?campaign=${stagingCampaignId}`);
});

test("staging campaign onboards a Master before exposing the long-form campaign console", async ({ page }) => {
  await page.route(`**/api/rpg/campaigns/${stagingCampaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(stagingProjection()),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=rpg-onboarding-player&campaign=${stagingCampaignId}`);

  await expect(page.locator("#mm-rpg-onboarding")).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign")).toBeHidden();
  await expect(page.locator('[data-onboarding-step="1"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /Field Medic/ })).toBeDisabled();

  await page.locator("#mm-rpg-trainer-name").fill("Rook");
  await page.locator("#mm-rpg-onboarding-to-starter").click();
  const starterStep = page.locator('[data-onboarding-step="2"]');
  await expect(starterStep).toBeVisible();
  await expect(starterStep.getByRole("button", { name: /Cinder/ })).toBeVisible();

  await page.locator("#mm-rpg-onboarding-to-briefing").click();
  await expect(page.locator('[data-onboarding-step="3"]')).toBeVisible();
  await expect(page.locator('[data-onboarding-step="3"]')).toContainText("Crooked Checkpoint Route");
  await expect(page.locator('[data-onboarding-step="3"]')).toContainText("Investigate irregular activity");

  await page.locator("#mm-rpg-onboarding-begin").click();
  await expect(page.locator("#mm-rpg-onboarding")).toBeHidden();
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-sidebar-player")).toHaveText("Rook");
  await expect(page.locator("#mm-rpg-trainer-summary")).toHaveText("Caller · Caravan Handler");
  await expect(page.locator("#mm-rpg-starter-name")).toHaveText("Cinder");
  await expect(page.locator("#mm-rpg-current-objective")).toContainText("Crooked Checkpoint route");
  await expect(page.locator("#mm-rpg-current-situation")).toContainText("Pell waits beside the Crooked Checkpoint marker");
  await expect(page.locator("#mm-rpg-edit-staging-profile")).toBeVisible();

  const persisted = await page.evaluate((expectedCampaignId) => JSON.parse(
    localStorage.getItem(`scribbles-gameframe.monster-master-rpg.profile.v1:${expectedCampaignId}`),
  ), stagingCampaignId);
  expect(persisted).toMatchObject({
    campaignId: stagingCampaignId,
    trainerName: "Rook",
    archetypeId: "trainer.archetype.caller",
    starterSpeciesId: "monster.emberling-skirmisher",
  });

  await page.reload();
  await expect(page.locator("#mm-rpg-onboarding")).toBeHidden();
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-sidebar-player")).toHaveText("Rook");
});