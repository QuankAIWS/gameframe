import { expect, test } from "@playwright/test";

const campaignId = "campaign-mobile-world";
const playerId = "rpg-mobile-player";
const playerEntityId = "trainer:rpg-mobile-player";
const materializationRef = {
  materializationId: `rpg-scene:${campaignId}:scene.crooked-checkpoint`,
  version: "1",
  hash: "M".repeat(43),
};

function campaignProjection() {
  return {
    protocolVersion: 2,
    campaignId,
    title: "Monster Master: Crooked Checkpoint",
    status: "active",
    gameframeCoordinationRevision: 3,
    presentationSequence: 2,
    linkedNarrativeRevision: 1,
    events: [],
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

function positionMessage(position, moved = false) {
  return {
    type: "exploration_position",
    protocolVersion: 1,
    campaignId,
    sceneId: "scene.crooked-checkpoint",
    playerEntityId,
    materializationRef,
    positionRevision: position.positionRevision,
    transform: {
      x: position.x,
      y: position.y,
      facing: position.facing,
    },
    moved,
  };
}

function materializedExploration(position) {
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
        playerCharacterEntityId: playerEntityId,
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
          x: 9,
          y: 6,
          entityClass: "player-character",
          identityStage: "self",
        },
        {
          anchorId: "entity:npc.warden-pell",
          kind: "entity",
          semanticId: "npc.warden-pell",
          interactionTargetId: "entity:npc.warden-pell",
          label: "veteran field warden",
          x: 12,
          y: 7,
          entityClass: "actor",
          identityStage: "role",
        },
      ],
    },
    playerPosition: positionMessage(position),
  };
}

function moveResult(position, request) {
  const deltas = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  };
  expect(request.expectedPositionRevision).toBe(position.positionRevision);
  expect(request.materializationRef).toEqual(materializationRef);
  const delta = deltas[request.direction];
  position.x += delta.x;
  position.y += delta.y;
  position.facing = request.direction;
  position.positionRevision += 1;
  return positionMessage(position, true);
}

test("phone controls drive the same authenticated HTTP exploration movement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const position = { x: 9, y: 6, facing: "west", positionRevision: 4 };
  const movementRequests = [];

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(campaignProjection()),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(materializedExploration(position)),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/move`, async (route) => {
    const request = route.request().postDataJSON();
    movementRequests.push(request);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(moveResult(position, request)),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();

  const controls = page.locator("#mm-rpg-touch-controls");
  await expect(controls).toBeVisible();
  await expect(page.getByRole("button", { name: "Move up" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move left" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move right" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move down" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rotate view left" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rotate view right" })).toBeVisible();

  const moveRightBox = await page.getByRole("button", { name: "Move right" }).boundingBox();
  expect(moveRightBox.width).toBeGreaterThanOrEqual(48);
  expect(moveRightBox.height).toBeGreaterThanOrEqual(48);

  await page.getByRole("button", { name: "Move right" }).click();
  await expect.poll(() => movementRequests.length).toBe(1);
  expect(movementRequests[0].direction).toBe("east");
  await expect(page.locator("#mm-rpg-world-status")).toContainText("Exploring · 10,6");

  await page.getByRole("button", { name: "Rotate view right" }).click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi?.getCamera?.()?.quarter)).toBe(1);

  await page.getByRole("button", { name: "Move up" }).click();
  await expect.poll(() => movementRequests.length).toBe(2);
  expect(movementRequests[1].direction).toBe("west");
  await expect(page.locator("#mm-rpg-world-status")).toContainText("Exploring · 9,6");

  expect(await page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.().transform)).toEqual({
    x: 9,
    y: 6,
    facing: "west",
  });
});
