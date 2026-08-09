import { expect, test } from "@playwright/test";

const campaignId = "campaign-ui-world";
const playerId = "rpg-world-player";
const materializationId = `rpg-scene:${campaignId}:scene.crooked-checkpoint`;

function campaignProjection() {
  return {
    protocolVersion: 2,
    campaignId,
    title: "Monster Master: Crooked Checkpoint",
    status: "active",
    gameframeCoordinationRevision: 3,
    presentationSequence: 2,
    linkedNarrativeRevision: 1,
    events: [{
      eventId: "event:scene",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: { narration: "The Crooked Checkpoint blocks the settled road." },
      createdAt: "2026-08-09T05:00:00.000Z",
    }],
  };
}

function physicalMap() {
  const width = 18;
  const height = 14;
  const cells = Array.from({ length: width * height }, () => ({ terrain: "floor" }));
  for (const y of [3, 4, 5, 6, 8, 9, 10]) cells[y * width + 8] = { terrain: "wall" };
  for (let x = 2; x <= 15; x += 1) cells[11 * width + x] = { terrain: "difficult" };
  cells[7 * width + 1] = { terrain: "objective" };
  return { width, height, cells };
}

function materializedExploration() {
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_materialized",
    projection: {
      protocolVersion: 1,
      kind: "campaign.exploration_projection",
      campaignId,
      campaignRevision: 40,
      package: {
        packageId: "mm.package.false-warden-roadblock.v1",
        packageVersion: 5,
        gameFamilyId: "monster-master",
        ruleset: {
          rulesetId: "monster-master-rpg",
          rulesetVersion: 1,
          capabilityProfileId: "mm.ruleset.embodied-campaign.v1",
        },
      },
      viewer: {
        playerId,
        playerCharacterEntityId: "trainer:rpg-world-player",
        rulesProfileId: "mm.trainer.vanguard.v1",
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
    },
    materialization: {
      protocolVersion: 1,
      kind: "gameframe.rpg.exploration_materialization",
      campaignId,
      sceneId: "scene.crooked-checkpoint",
      semanticRevision: 3,
      materializationRef: {
        materializationId,
        version: "1",
        hash: "A".repeat(43),
      },
      profileId: "gameframe.rpg.semantic-scene.v1",
      themeId: "monster-master-starter",
      map: physicalMap(),
      anchors: [
        {
          anchorId: "entity:trainer:rpg-world-player",
          kind: "player",
          semanticId: "trainer:rpg-world-player",
          interactionTargetId: "entity:trainer:rpg-world-player",
          label: "You",
          x: 14,
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
          anchorId: "object:object.checkpoint-cart",
          kind: "object",
          semanticId: "object.checkpoint-cart",
          interactionTargetId: "entity:object.checkpoint-cart",
          label: "covered confiscation cart",
          x: 10,
          y: 8,
        },
        {
          anchorId: "route:route.crooked-checkpoint-west-woods",
          kind: "route",
          semanticId: "route.crooked-checkpoint-west-woods",
          label: "West Woods Route",
          x: 1,
          y: 7,
        },
      ],
    },
  };
}

test("Monster Master RPG materializes Crooked Checkpoint through the existing Pixi world", async ({ page }) => {
  let explorationAttachCount = 0;
  let explorationRequest = null;

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(campaignProjection()),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    explorationAttachCount += 1;
    explorationRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(materializedExploration()),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-world-location")).toHaveText("The Crooked Checkpoint");
  await expect(page.locator("#mm-rpg-world-status")).toContainText("Materialized");
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect(page.locator('[data-semantic-id="npc.warden-pell"]')).toContainText("veteran field warden");
  await expect(page.locator('[data-semantic-id="object.checkpoint-cart"]')).toContainText("covered confiscation cart");
  await expect(page.locator('[data-semantic-id="route.crooked-checkpoint-west-woods"]')).toContainText("West Woods Route");
  await expect(page.locator("#mm-rpg-world-materialization")).toContainText(materializationId);

  expect(explorationRequest).toEqual({
    protocolVersion: 1,
    kind: "campaign.exploration.attach",
    campaignId,
  });
  expect(explorationRequest.authenticatedPlayerId).toBeUndefined();

  const stats = await page.evaluate(() => window.gameFrameMonsterPixi?.getTerrainStats?.());
  expect(stats.groundObjects).toBe(1);
  expect(stats.wallCount).toBeGreaterThan(0);
  expect(stats.unitObjects).toBe(2);

  await page.locator("#mm-rpg-refresh").click();
  await expect.poll(() => explorationAttachCount).toBe(2);
  await expect(page.locator("#mm-rpg-world-materialization")).toContainText(materializationId);
});
