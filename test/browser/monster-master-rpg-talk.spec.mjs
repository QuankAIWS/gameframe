import { expect, test } from "@playwright/test";

const campaignId = "campaign-ui-talk";
const playerId = "rpg-talk-player";
const playerEntityId = "trainer:rpg-talk-player";
const materializationRef = {
  materializationId: `rpg-scene:${campaignId}:scene.crooked-checkpoint`,
  version: "1",
  hash: "T".repeat(43),
};

function campaignProjection({ replied = false } = {}) {
  const events = [{
    eventId: "event:opening",
    kind: "scene.presented",
    audience: { kind: "public" },
    payload: { narration: "The Crooked Checkpoint blocks the settled road." },
    createdAt: "2026-08-09T18:00:00.000Z",
  }];
  if (replied) {
    events.push(
      {
        eventId: "event:talk-action",
        kind: "campaign.action_submitted",
        audience: { kind: "player", playerId },
        payload: {
          actorId: playerId,
          text: "Does this checkpoint look right to you?",
          interaction: "talk",
          interactionTargetId: "entity:npc.warden-pell",
          targetDisplayLabel: "veteran field warden",
        },
        createdAt: "2026-08-09T18:01:00.000Z",
      },
      {
        eventId: "event:pell-reply",
        kind: "scene.presented",
        audience: { kind: "player", playerId },
        payload: {
          title: "Talk with veteran field warden",
          narration: "He keeps his voice low and watches the barrier.",
          dialogue: [{
            speakerId: "npc.warden-pell",
            speakerName: "veteran field warden",
            text: "No. I wasn't expecting a checkpoint here. Stay close while we figure out what this is.",
          }],
          mechanic: { kind: "none" },
        },
        createdAt: "2026-08-09T18:01:01.000Z",
      },
    );
  }
  return {
    protocolVersion: 2,
    campaignId,
    title: "Monster Master: Crooked Checkpoint",
    status: "active",
    gameframeCoordinationRevision: replied ? 4 : 3,
    presentationSequence: replied ? 4 : 1,
    linkedNarrativeRevision: replied ? 2 : 1,
    events,
  };
}

function physicalMap() {
  const width = 18;
  const height = 14;
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => ({ terrain: "floor" })),
  };
}

function playerPosition() {
  return {
    type: "exploration_position",
    protocolVersion: 1,
    campaignId,
    sceneId: "scene.crooked-checkpoint",
    playerEntityId,
    materializationRef,
    positionRevision: 4,
    transform: { x: 10, y: 7, facing: "west" },
    moved: false,
  };
}

function explorationProjection() {
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_projection",
    campaignId,
    campaignRevision: 41,
    package: {
      packageId: "mm.package.false-warden-roadblock.v1",
      packageVersion: 6,
      gameFamilyId: "monster-master",
      ruleset: {
        rulesetId: "monster-master-rpg",
        rulesetVersion: 1,
        capabilityProfileId: "mm.ruleset.embodied-campaign.v1",
      },
    },
    viewer: {
      playerId,
      playerCharacterEntityId: playerEntityId,
      rulesProfileId: "mm.trainer.vanguard.v1",
      monsters: [],
    },
    scene: {
      sceneId: "scene.crooked-checkpoint",
      semanticRevision: 3,
      lifecycleState: "active",
      resolutionMode: "exploration",
      worldNodeId: "world.node.crooked-checkpoint",
      location: {
        locationId: "location.settled-road-checkpoint",
        label: "The Crooked Checkpoint",
        description: "A timber barrier constricts an otherwise ordinary settled road.",
      },
      materialization: {
        intent: {
          intentId: "mm.materialization.crooked-checkpoint.v1",
          materializationProfileId: "gameframe.rpg.semantic-scene.v1",
          themeId: "monster-master-starter",
          seedPolicy: "stable-location",
          revisitPolicy: "reuse-accepted-materialization",
          requiredAssetRoleIds: ["scene.crooked-checkpoint.background"],
          fallbackMode: "semantic-layout",
          fallbackLabel: "Crooked Checkpoint semantic layout",
        },
      },
      landmarks: [],
      entities: [],
      objects: [],
      routes: [],
    },
  };
}

function materializedExploration({ secondTarget = false } = {}) {
  const anchors = [
    {
      anchorId: `entity:${playerEntityId}`,
      kind: "player",
      semanticId: playerEntityId,
      interactionTargetId: `entity:${playerEntityId}`,
      label: "You",
      x: 10,
      y: 7,
      entityClass: "player-character",
      identityStage: "self",
    },
    {
      anchorId: "entity:npc.warden-pell",
      kind: "entity",
      semanticId: "npc.warden-pell",
      interactionTargetId: "entity:npc.warden-pell",
      label: "veteran field warden",
      x: 9,
      y: 7,
      entityClass: "actor",
      identityStage: "role",
    },
  ];
  if (secondTarget) {
    anchors.push({
      anchorId: "entity:npc.checkpoint-official",
      kind: "entity",
      semanticId: "npc.checkpoint-official",
      interactionTargetId: "entity:npc.checkpoint-official",
      label: "checkpoint official",
      x: 10,
      y: 6,
      entityClass: "actor",
      identityStage: "role",
    });
  }
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_materialized",
    projection: explorationProjection(),
    materialization: {
      protocolVersion: 1,
      kind: "gameframe.rpg.exploration_materialization",
      campaignId,
      sceneId: "scene.crooked-checkpoint",
      semanticRevision: 3,
      materializationRef,
      profileId: "gameframe.rpg.semantic-scene.v1",
      themeId: "monster-master-starter",
      map: physicalMap(),
      anchors,
    },
    playerPosition: playerPosition(),
  };
}

async function routeCampaignAndWorld(page, options = {}) {
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(campaignProjection(options.campaignState?.() ?? {})),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(materializedExploration({ secondTarget: options.secondTarget })),
    });
  });
}

test("nearby Talk opens an in-world conversation panel and never uses the generic action composer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let talkCommitted = false;
  let talkRequest = null;
  let genericCommandCount = 0;

  await routeCampaignAndWorld(page, {
    campaignState: () => ({ replied: talkCommitted }),
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/interact`, async (route) => {
    talkRequest = route.request().postDataJSON();
    talkCommitted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.exploration_interaction_committed",
        interaction: "talk",
        interactionTargetId: "entity:npc.warden-pell",
        command: {
          kind: "gameframe.command_committed",
          campaignId,
          commandId: talkRequest.commandId,
          deliveryId: "delivery:talk-browser-proof",
          gameframeCoordinationRevision: 4,
          presentationSequence: 2,
          linkedNarrativeRevision: 1,
          eventIds: ["event:talk-action"],
        },
        playerPosition: playerPosition(),
        replayed: false,
      }),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/commands`, async (route) => {
    genericCommandCount += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  const talkButton = page.getByRole("button", { name: "Talk to veteran field warden" });
  await expect(talkButton).toBeVisible();
  const talkBox = await talkButton.boundingBox();
  expect(talkBox.height).toBeGreaterThanOrEqual(48);

  await talkButton.click();
  await expect(page.locator("#mm-rpg-talk-panel")).toBeVisible();
  await expect(page.locator("#mm-rpg-talk-panel-title")).toHaveText("veteran field warden");
  await expect(page.locator("#mm-rpg-talk-status")).toContainText("spoken in the world");
  await expect(page.locator("#mm-rpg-action-form")).toBeHidden();

  await page.locator("#mm-rpg-talk-input").fill("Does this checkpoint look right to you?");
  await page.locator(".mm-rpg-talk-form").evaluate((form) => form.requestSubmit());

  await expect.poll(() => talkRequest).not.toBeNull();
  expect(talkRequest).toMatchObject({
    type: "exploration_interact",
    protocolVersion: 1,
    campaignId,
    sceneId: "scene.crooked-checkpoint",
    materializationRef,
    expectedPositionRevision: 4,
    expectedGameframeCoordinationRevision: 3,
    interaction: "talk",
    interactionTargetId: "entity:npc.warden-pell",
    text: "Does this checkpoint look right to you?",
  });
  expect(talkRequest.commandId).toMatch(/^command:/);
  expect(Date.parse(talkRequest.issuedAt)).not.toBeNaN();
  expect(talkRequest.targetEntityId).toBeUndefined();
  expect(genericCommandCount).toBe(0);

  await expect(page.locator("#mm-rpg-events")).toContainText(
    "No. I wasn't expecting a checkpoint here. Stay close while we figure out what this is.",
  );
});

test("multiple adjacent Talk targets require an explicit viewer-safe choice before opening conversation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await routeCampaignAndWorld(page, { secondTarget: true });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  const talkButton = page.getByRole("button", { name: "Choose among 2 nearby characters to talk to" });
  await expect(talkButton).toBeVisible();
  await talkButton.click();

  const chooser = page.locator("#mm-rpg-talk-chooser");
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole("button", { name: "checkpoint official" })).toBeVisible();
  await expect(chooser.getByRole("button", { name: "veteran field warden" })).toBeVisible();

  await chooser.getByRole("button", { name: "checkpoint official" }).click();
  await expect(page.locator("#mm-rpg-talk-panel")).toBeVisible();
  await expect(page.locator("#mm-rpg-talk-panel-title")).toHaveText("checkpoint official");
  await expect(chooser).toBeHidden();
});

test("an unconfirmed Talk survives campaign refresh and retries the exact same spoken request", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = [];
  let campaignAttachCount = 0;

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    campaignAttachCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(campaignProjection()) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(materializedExploration()) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/interact`, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "runtime-unavailable",
        message: "Delivery status is unknown.",
        retryable: true,
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  await page.getByRole("button", { name: "Talk to veteran field warden" }).click();
  const talkInput = page.locator("#mm-rpg-talk-input");
  await talkInput.fill("Keep this between us: what looks wrong here?");
  await page.locator(".mm-rpg-talk-form").evaluate((form) => form.requestSubmit());

  await expect.poll(() => requests.length).toBe(1);
  await expect(page.locator("#mm-rpg-talk-send")).toHaveText("Retry Speak");
  await expect(talkInput).toHaveValue("Keep this between us: what looks wrong here?");

  const beforeRefresh = campaignAttachCount;
  await page.locator("#mm-rpg-refresh").click();
  await expect.poll(() => campaignAttachCount).toBeGreaterThan(beforeRefresh);
  await expect(page.locator("#mm-rpg-talk-panel")).toBeVisible();
  await expect(talkInput).toHaveValue("Keep this between us: what looks wrong here?");

  await page.locator(".mm-rpg-talk-form").evaluate((form) => form.requestSubmit());
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0].commandId).toMatch(/^command:/);
  expect(Date.parse(requests[0].issuedAt)).not.toBeNaN();
});
