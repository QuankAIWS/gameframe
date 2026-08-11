import { expect, test } from "@playwright/test";

const campaignId = "campaign-ui-talk-switch";
const playerId = "rpg-talk-switch-player";
const playerEntityId = "trainer:rpg-talk-switch-player";
const materializationRef = {
  materializationId: `rpg-scene:${campaignId}:scene.crooked-checkpoint`,
  version: "1",
  hash: "S".repeat(43),
};

function campaignProjection({ replied = false } = {}) {
  const events = [{
    eventId: "event:opening",
    kind: "scene.presented",
    audience: { kind: "public" },
    payload: { narration: "The Crooked Checkpoint blocks the settled road." },
    createdAt: "2026-08-11T20:00:00.000Z",
  }];
  if (replied) {
    events.push(
      {
        eventId: "event:pell-talk-action",
        kind: "campaign.action_submitted",
        audience: { kind: "player", playerId },
        payload: {
          actorId: playerId,
          text: "Pell, what's going on here?",
          interaction: "talk",
          interactionTargetId: "entity:npc.warden-pell",
          targetDisplayLabel: "veteran field warden",
        },
        createdAt: "2026-08-11T20:01:00.000Z",
      },
      {
        eventId: "event:pell-reply",
        kind: "scene.presented",
        audience: { kind: "player", playerId },
        payload: {
          title: "Talk with veteran field warden",
          narration: "Pell studies the checkpoint.",
          dialogue: [{
            speakerId: "npc.warden-pell",
            speakerName: "veteran field warden",
            text: "I don't know. That's what I'd like to know.",
          }],
          mechanic: { kind: "none" },
        },
        createdAt: "2026-08-11T20:01:01.000Z",
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

function materializedExploration() {
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
      anchors: [
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
        {
          anchorId: "entity:npc.checkpoint-official",
          kind: "entity",
          semanticId: "npc.checkpoint-official",
          interactionTargetId: "entity:npc.checkpoint-official",
          label: "checkpoint official",
          x: 12,
          y: 5,
          entityClass: "actor",
          identityStage: "role",
        },
      ],
    },
    playerPosition: playerPosition(),
  };
}

test("after talking to Pell, the checkpoint official map bubble retargets Talk instead of walking", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  let pellCommitted = false;
  const talkRequests = [];
  let moveRequestCount = 0;

  await page.addInitScript(() => {
    window.__rpgCoordinateClaimCount = 0;
    window.addEventListener("gameframe:monster-master-coordinate", () => {
      window.__rpgCoordinateClaimCount += 1;
    });
  });

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(campaignProjection({ replied: pellCommitted })),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(materializedExploration()),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/move`, async (route) => {
    moveRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(playerPosition()),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/interact`, async (route) => {
    const request = route.request().postDataJSON();
    talkRequests.push(request);
    if (request.interactionTargetId === "entity:npc.warden-pell") pellCommitted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.exploration_interaction_committed",
        interaction: "talk",
        interactionTargetId: request.interactionTargetId,
        command: {
          kind: "gameframe.command_committed",
          campaignId,
          commandId: request.commandId,
          deliveryId: `delivery:${talkRequests.length}`,
          gameframeCoordinationRevision: request.expectedGameframeCoordinationRevision + 1,
          presentationSequence: talkRequests.length + 1,
          linkedNarrativeRevision: 1,
          eventIds: [`event:talk-${talkRequests.length}`],
        },
        playerPosition: playerPosition(),
        replayed: false,
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  const talkButton = page.getByRole("button", { name: "Choose among 2 nearby characters to talk to" });
  await expect(talkButton).toBeVisible();
  await talkButton.click();
  const chooser = page.locator("#mm-rpg-talk-chooser");
  await expect(chooser).toBeVisible();
  await chooser.getByRole("button", { name: "veteran field warden" }).click();
  await expect(page.locator("#mm-rpg-talk-panel-title")).toHaveText("veteran field warden");

  const input = page.locator("#mm-rpg-talk-input");
  await input.fill("Pell, what's going on here?");
  await input.press("Enter");
  await expect.poll(() => talkRequests.length).toBe(1);
  expect(talkRequests[0].interactionTargetId).toBe("entity:npc.warden-pell");
  await expect(page.locator("#mm-rpg-events")).toContainText("That's what I'd like to know.");
  await expect(page.locator("#mm-rpg-talk-send")).toHaveText("Speak");

  const officialBubble = page.getByRole("button", { name: "Open conversation with checkpoint official" });
  await expect(officialBubble).toBeVisible();
  await officialBubble.click();

  await expect(page.locator("#mm-rpg-talk-panel-title")).toHaveText("checkpoint official");
  expect(await page.evaluate(() => window.__rpgCoordinateClaimCount)).toBe(0);
  expect(moveRequestCount).toBe(0);

  await input.fill("What is going on at this checkpoint?");
  await input.press("Enter");
  await expect.poll(() => talkRequests.length).toBe(2);
  expect(talkRequests[1].interactionTargetId).toBe("entity:npc.checkpoint-official");
  expect(await page.evaluate(() => window.__rpgCoordinateClaimCount)).toBe(0);
  expect(moveRequestCount).toBe(0);
});
