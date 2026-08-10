import { expect, test } from "@playwright/test";

const campaignId = "campaign-ui-control";
const playerId = "rpg-control-player";
const playerEntityId = "trainer:rpg-control-player";
const monsterId = "monster:cinder-control";
const controlTargetId = "roster:monster:cinder-control";
const materializationRef = {
  materializationId: `rpg-scene:${campaignId}:scene.crooked-checkpoint`,
  version: "1",
  hash: "C".repeat(43),
};

function campaignProjection(gameframeCoordinationRevision = 5) {
  return {
    protocolVersion: 2,
    campaignId,
    title: "Monster Master: Crooked Checkpoint",
    status: "active",
    gameframeCoordinationRevision,
    presentationSequence: 2,
    linkedNarrativeRevision: 1,
    events: [{
      eventId: "event:opening",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: { narration: "The Crooked Checkpoint blocks the road." },
      createdAt: "2026-08-09T22:00:00.000Z",
    }],
  };
}

function worldPayload(deployed) {
  const monster = {
    monsterId,
    displayLabel: "Cinder",
    controlTargetId,
    rulesProfileId: "mm.monster.skirmisher.v1",
    deploymentState: deployed ? "deployed" : "recalled",
    ...(deployed ? { deployedSceneId: "scene.crooked-checkpoint" } : {}),
  };
  const entities = [
    {
      entityId: playerEntityId,
      entityClass: "player-character",
      displayLabel: "You",
      identityStage: "self",
      interactionTargetId: `entity:${playerEntityId}`,
    },
    ...(deployed
      ? [{
          entityId: monsterId,
          entityClass: "monster",
          displayLabel: "Cinder",
          identityStage: "name",
          interactionTargetId: `entity:${monsterId}`,
          rulesProfileId: "mm.monster.skirmisher.v1",
        }]
      : []),
  ];
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
    ...(deployed
      ? [{
          anchorId: `entity:${monsterId}`,
          kind: "entity",
          semanticId: monsterId,
          interactionTargetId: `entity:${monsterId}`,
          label: "Cinder",
          x: 9,
          y: 7,
          entityClass: "monster",
          identityStage: "name",
        }]
      : []),
  ];
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_materialized",
    projection: {
      protocolVersion: 1,
      kind: "campaign.exploration_projection",
      campaignId,
      campaignRevision: deployed ? 50 : 51,
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
        rulesProfileId: "mm.trainer.caller.v1",
        monsters: [monster],
      },
      scene: {
        sceneId: "scene.crooked-checkpoint",
        semanticRevision: deployed ? 8 : 9,
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
            requiredAssetRoleIds: [],
            fallbackMode: "semantic-layout",
            fallbackLabel: "Crooked Checkpoint semantic layout",
          },
        },
        landmarks: [],
        entities,
        objects: [],
        routes: [],
      },
    },
    materialization: {
      protocolVersion: 1,
      kind: "gameframe.rpg.exploration_materialization",
      campaignId,
      sceneId: "scene.crooked-checkpoint",
      semanticRevision: deployed ? 8 : 9,
      materializationRef,
      profileId: "gameframe.rpg.semantic-scene.v1",
      themeId: "monster-master-starter",
      map: {
        width: 18,
        height: 14,
        cells: Array.from({ length: 18 * 14 }, () => ({ terrain: "floor" })),
      },
      anchors,
    },
    playerPosition: {
      type: "exploration_position",
      protocolVersion: 1,
      campaignId,
      sceneId: "scene.crooked-checkpoint",
      playerEntityId,
      materializationRef,
      positionRevision: 6,
      transform: { x: 10, y: 7, facing: "west" },
      moved: false,
    },
  };
}

test("direct Recall and Deploy use viewer-owned roster handles and reconcile the physical scene", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let deployed = true;
  const controlRequests = [];
  let genericCommands = 0;

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
      body: JSON.stringify(worldPayload(deployed)),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/control`, async (route) => {
    const request = route.request().postDataJSON();
    controlRequests.push(request);
    deployed = request.operation === "deploy";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.exploration_monster_control_committed",
        operation: request.operation,
        controlTargetId: request.controlTargetId,
        command: {
          kind: "gameframe.command_committed",
          campaignId,
          commandId: request.commandId,
          deliveryId: `delivery:${request.operation}-cinder`,
          gameframeCoordinationRevision: 6,
          presentationSequence: 3,
          linkedNarrativeRevision: 1,
          eventIds: [`event:${request.operation}-cinder`],
        },
        replayed: false,
      }),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/commands`, async (route) => {
    genericCommands += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  const recall = page.getByRole("button", { name: "Recall Cinder" });
  await expect(recall).toBeVisible();
  const box = await recall.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(48);
  await recall.click();

  await expect.poll(() => controlRequests.length).toBe(1);
  expect(controlRequests[0]).toMatchObject({
    type: "exploration_monster_control",
    protocolVersion: 1,
    campaignId,
    sceneId: "scene.crooked-checkpoint",
    materializationRef,
    expectedPositionRevision: 6,
    expectedGameframeCoordinationRevision: 5,
    operation: "recall",
    controlTargetId,
  });
  expect(controlRequests[0].commandId).toMatch(/^command:/);
  expect(Date.parse(controlRequests[0].issuedAt)).not.toBeNaN();
  expect(controlRequests[0].targetEntityId).toBeUndefined();
  expect(genericCommands).toBe(0);

  const deploy = page.getByRole("button", { name: "Deploy Cinder" });
  await expect(deploy).toBeVisible();
  await deploy.click();
  await expect.poll(() => controlRequests.length).toBe(2);
  expect(controlRequests[1]).toMatchObject({
    operation: "deploy",
    controlTargetId,
  });
  expect(controlRequests[1].targetEntityId).toBeUndefined();
  expect(genericCommands).toBe(0);
  await expect(page.getByRole("button", { name: "Recall Cinder" })).toBeVisible();
});

test("coordination conflicts clear the stale retry and prepare a fresh control command", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let coordinationRevision = 5;
  const controlRequests = [];

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(campaignProjection(coordinationRevision)),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(worldPayload(true)),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/control`, async (route) => {
    const request = route.request().postDataJSON();
    controlRequests.push(request);
    if (controlRequests.length === 1) {
      coordinationRevision = 6;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "coordination-revision-conflict",
          message: "Expected GameFrame coordination revision 5, actual 6.",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.exploration_monster_control_committed",
        operation: request.operation,
        controlTargetId: request.controlTargetId,
        command: {
          kind: "gameframe.command_committed",
          campaignId,
          commandId: request.commandId,
          deliveryId: "delivery:fresh-recall-cinder",
          gameframeCoordinationRevision: 7,
          presentationSequence: 3,
          linkedNarrativeRevision: 1,
          eventIds: ["event:fresh-recall-cinder"],
        },
        replayed: false,
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);
  const recall = page.getByRole("button", { name: "Recall Cinder" });
  await expect(recall).toBeVisible();
  await recall.click();
  await expect.poll(() => controlRequests.length).toBe(1);
  const staleCommandId = controlRequests[0].commandId;
  expect(controlRequests[0].expectedGameframeCoordinationRevision).toBe(5);

  await expect.poll(async () => page.locator("#mm-rpg-coordination").textContent()).toBe("6");
  await expect(recall).toBeVisible();
  await expect(recall).not.toHaveText(/Retry/);
  await recall.click();
  await expect.poll(() => controlRequests.length).toBe(2);
  expect(controlRequests[1].expectedGameframeCoordinationRevision).toBe(6);
  expect(controlRequests[1].commandId).not.toBe(staleCommandId);
});