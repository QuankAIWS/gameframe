import { expect, test } from "@playwright/test";

const campaignId = "campaign-ui-world";
const playerId = "rpg-world-player";
const playerEntityId = "trainer:rpg-world-player";
const materializationId = `rpg-scene:${campaignId}:scene.crooked-checkpoint`;
const materializationRef = {
  materializationId,
  version: "1",
  hash: "A".repeat(43),
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

function positionMessage(position, { moved = false, blockedBy } = {}) {
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
    ...(blockedBy ? { blockedBy } : {}),
  };
}

function materializedExploration(position, { cartState = "covered" } = {}) {
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
        objects: [{
          entityId: "object.checkpoint-cart",
          displayLabel: "covered confiscation cart",
          state: cartState,
          interactionTargetId: "entity:object.checkpoint-cart",
        }],
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
          objectState: cartState,
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
  const target = { x: position.x + delta.x, y: position.y + delta.y };
  const map = physicalMap();
  const cell = map.cells[target.y * map.width + target.x];
  const occupied = (target.x === 9 && target.y === 7) || (target.x === 10 && target.y === 8);
  const blockedBy = !cell ? "bounds" : cell.terrain === "wall" ? "terrain" : occupied ? "occupied" : null;
  const changedFacing = position.facing !== request.direction;
  if (!blockedBy) {
    position.x = target.x;
    position.y = target.y;
  }
  position.facing = request.direction;
  if (!blockedBy || changedFacing) position.positionRevision += 1;
  return positionMessage(position, { moved: !blockedBy, ...(blockedBy ? { blockedBy } : {}) });
}

test("Monster Master RPG uses click for the Master and WASD for the camera", async ({ page }) => {
  let explorationAttachCount = 0;
  let explorationRequest = null;
  const movementRequests = [];
  const position = { x: 9, y: 6, facing: "west", positionRevision: 4 };

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(campaignProjection()) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    explorationAttachCount += 1;
    explorationRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(materializedExploration(position)) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/move`, async (route) => {
    const request = route.request().postDataJSON();
    movementRequests.push(request);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(moveResult(position, request)) });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-world-location")).toHaveText("The Crooked Checkpoint");
  await expect(page.locator("#mm-rpg-world-status")).toContainText("Exploring · 9,6");
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  const pell = page.locator('[data-semantic-id="npc.warden-pell"]');
  await expect(pell).toContainText("veteran field warden");
  await expect(page.locator('[data-semantic-id="object.checkpoint-cart"]')).toContainText("covered confiscation cart");
  await expect(page.locator('[data-semantic-id="route.crooked-checkpoint-west-woods"]')).toContainText("West Woods Route");
  await expect(page.locator("#mm-rpg-world-materialization")).toContainText(materializationId);

  expect(explorationRequest).toEqual({ protocolVersion: 1, kind: "campaign.exploration.attach", campaignId });
  expect(explorationRequest.authenticatedPlayerId).toBeUndefined();

  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi?.getTerrainStats?.()?.groundObjects ?? 0)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi?.getTerrainStats?.()?.wallCount ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi?.getTerrainStats?.()?.unitObjects ?? 0)).toBe(2);

  const target = await page.evaluate(() => window.gameFrameMonsterPixi?.worldToScreen?.({ x: 10, y: 6 }));
  expect(target).toBeTruthy();
  await page.locator("#monster-master-pixi-canvas").click({ position: { x: target.x, y: target.y } });
  await expect.poll(() => movementRequests.length).toBe(1);
  expect(movementRequests[0].direction).toBe("east");
  await expect(page.locator("#mm-rpg-world-status")).toContainText("Arrived · 10,6");

  const cameraBeforeWasd = await page.evaluate(() => window.gameFrameMonsterPixi?.getCamera?.());
  await page.keyboard.press("KeyA");
  await page.waitForTimeout(150);
  expect(movementRequests).toHaveLength(1);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi?.getCamera?.())).not.toEqual(cameraBeforeWasd);
  expect(await page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.().transform)).toEqual({ x: 10, y: 6, facing: "east" });

  await page.keyboard.press("KeyE");
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi?.getCamera?.()?.quarter)).toBe(1);
  await page.keyboard.press("KeyW");
  await page.waitForTimeout(150);
  expect(movementRequests).toHaveLength(1);

  const revisionBeforeRefresh = position.positionRevision;
  await page.locator("#mm-rpg-refresh").click();
  await expect.poll(() => explorationAttachCount).toBe(3);
  await expect(page.locator("#mm-rpg-world-materialization")).toContainText(materializationId);
  expect(await page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.().positionRevision)).toBe(revisionBeforeRefresh);
  expect(await page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.().transform)).toEqual({ x: 10, y: 6, facing: "east" });
});

test("clicking the covered cart walks adjacent and exposes Uncover cart in Nearby Actions", async ({ page }) => {
  const movementRequests = [];
  let interactionRequest = null;
  let cartState = "covered";
  const position = { x: 14, y: 7, facing: "west", positionRevision: 1 };

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(campaignProjection()) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(materializedExploration(position, { cartState })),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/move`, async (route) => {
    const request = route.request().postDataJSON();
    movementRequests.push(request);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(moveResult(position, request)) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/interact`, async (route) => {
    interactionRequest = route.request().postDataJSON();
    cartState = "uncovered";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.exploration_interaction_committed",
        interaction: "talk",
        interactionTargetId: "entity:object.checkpoint-cart",
        command: { commandId: interactionRequest.commandId },
        replayed: false,
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect(page.locator(".mm-rpg-dock-nearby")).toBeHidden();

  const cart = await page.evaluate(() => window.gameFrameMonsterPixi?.worldToScreen?.({ x: 10, y: 8 }));
  expect(cart).toBeTruthy();
  await page.locator("#monster-master-pixi-canvas").click({ position: { x: cart.x, y: cart.y } });

  await expect.poll(() => Math.abs(position.x - 10) + Math.abs(position.y - 8)).toBe(1);
  expect(movementRequests.length).toBeGreaterThan(0);
  const nearby = page.locator(".mm-rpg-dock-nearby");
  await expect(nearby).toBeVisible();
  await expect(nearby).toContainText("NEARBY ACTIONS");
  const uncover = page.getByRole("button", { name: "Uncover cart" });
  await expect(uncover).toBeVisible();
  await expect(uncover.locator("xpath=..")).toHaveClass(/mm-rpg-dock-nearby-actions/);

  await uncover.click();
  await expect.poll(() => interactionRequest).not.toBeNull();
  expect(interactionRequest.interactionTargetId).toBe("entity:object.checkpoint-cart");
  expect(interactionRequest.text).toBe("Uncover the checkpoint cart.");
  expect(interactionRequest.authenticatedPlayerId).toBeUndefined();
  await expect(uncover).toBeHidden();
});

test("Monster Master RPG touch controls use the same HTTP movement authority", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const movementRequests = [];
  const position = { x: 9, y: 6, facing: "west", positionRevision: 4 };

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(campaignProjection()) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(materializedExploration(position)) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/move`, async (route) => {
    const request = route.request().postDataJSON();
    movementRequests.push(request);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(moveResult(position, request)) });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect(page.locator("#mm-rpg-touch-controls")).toBeVisible();

  for (const label of ["Move up", "Move left", "Move right", "Move down", "Rotate view left", "Rotate view right"]) {
    await expect(page.getByRole("button", { name: label })).toBeVisible();
  }

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

  expect(await page.evaluate(() => window.gameFrameMonsterRpgWorld?.getPlayerPosition?.().transform)).toEqual({ x: 9, y: 6, facing: "west" });
});