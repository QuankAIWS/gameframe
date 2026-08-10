import { expect, test } from "@playwright/test";

const campaignId = "campaign-interaction-shell";
const playerId = "interaction-shell-player";
const playerEntityId = `trainer:${playerId}`;
const materializationRef = {
  materializationId: `rpg-scene:${campaignId}:scene.crooked-checkpoint`,
  version: "1",
  hash: "S".repeat(43),
};

function campaignProjection({ gmReplied = false, coordinationRevision = 3 } = {}) {
  const events = [{
    eventId: "event:opening-shell",
    kind: "scene.presented",
    audience: { kind: "public" },
    payload: {
      title: "Crooked Checkpoint",
      narration: "An unscheduled checkpoint blocks the settled road.",
    },
    createdAt: "2026-08-09T21:00:00.000Z",
  }];
  if (gmReplied) {
    events.push({
      eventId: "event:private-gm-shell",
      kind: "scene.presented",
      audience: { kind: "player", playerId },
      payload: {
        title: "Game Master",
        narration: "You know the checkpoint is unscheduled for Pell's route. Your suspicion is not proof of who these people are.",
        dialogue: [],
        mechanic: { kind: "none" },
        presentationMode: "ask-gm-private",
      },
      createdAt: "2026-08-09T21:01:00.000Z",
    });
  }
  return {
    protocolVersion: 2,
    campaignId,
    title: "Monster Master: Crooked Checkpoint",
    status: "active",
    gameframeCoordinationRevision: coordinationRevision,
    presentationSequence: gmReplied ? 2 : 1,
    linkedNarrativeRevision: gmReplied ? 2 : 1,
    events,
  };
}

function explorationPayload(coordinationRevision = 3) {
  const width = 18;
  const height = 14;
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_materialized",
    projection: {
      protocolVersion: 1,
      kind: "campaign.exploration_projection",
      campaignId,
      campaignRevision: 48,
      gameframeCoordinationRevision: coordinationRevision,
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
        semanticRevision: 4,
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
        entities: [{
          entityId: "npc.warden-pell",
          entityClass: "actor",
          displayLabel: "Warden Pell",
          identityStage: "name",
          interactionTargetId: "entity:npc.warden-pell",
        }],
        objects: [],
        routes: [],
      },
    },
    materialization: {
      protocolVersion: 1,
      kind: "gameframe.rpg.exploration_materialization",
      campaignId,
      sceneId: "scene.crooked-checkpoint",
      semanticRevision: 4,
      materializationRef,
      profileId: "gameframe.rpg.semantic-scene.v1",
      themeId: "monster-master-starter",
      map: {
        width,
        height,
        cells: Array.from({ length: width * height }, () => ({ terrain: "floor" })),
      },
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
          label: "Warden Pell",
          x: 9,
          y: 7,
          entityClass: "actor",
          identityStage: "name",
        },
      ],
    },
    playerPosition: {
      type: "exploration_position",
      protocolVersion: 1,
      campaignId,
      sceneId: "scene.crooked-checkpoint",
      playerEntityId,
      materializationRef,
      positionRevision: 3,
      transform: { x: 10, y: 7, facing: "west" },
      moved: false,
    },
  };
}

test("RPG play shell separates private Ask GM, in-world Action, and character Talk", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  let gmReplied = false;
  let coordinationRevision = 3;
  const commands = [];

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(campaignProjection({ gmReplied, coordinationRevision })),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(explorationPayload(coordinationRevision)),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/commands`, async (route) => {
    const request = route.request().postDataJSON();
    commands.push(request);
    coordinationRevision += 1;
    if (request.command.visibility === "private-to-runtime") gmReplied = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "gameframe.command_committed",
        campaignId,
        commandId: request.commandId,
        deliveryId: `delivery:${commands.length}`,
        gameframeCoordinationRevision: coordinationRevision,
        presentationSequence: commands.length + 1,
        linkedNarrativeRevision: 1,
        eventIds: [],
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=${playerId}&campaign=${campaignId}`);

  await expect(page.locator("body")).toHaveClass(/mm-rpg-play-shell/);
  const worldBox = await page.locator("#mm-rpg-world .mm-rpg-world-stage").boundingBox();
  expect(worldBox.height).toBeGreaterThan(650);
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(scrollHeight).toBeLessThanOrEqual(810);

  await page.getByRole("button", { name: "Open private Game Master chat" }).click();
  await expect(page.locator("#mm-rpg-ask-gm-panel")).toBeVisible();
  await expect(page.locator("#mm-rpg-ask-gm-status")).toContainText("will not become dialogue");
  await page.locator("#mm-rpg-ask-gm-input").fill("They look suspicious. What do I actually know?");
  await page.locator(".mm-rpg-ask-gm-form").evaluate((form) => form.requestSubmit());

  await expect.poll(() => commands.length).toBe(1);
  expect(commands[0]).toMatchObject({
    protocolVersion: 2,
    campaignId,
    command: {
      kind: "campaign.submit_action",
      visibility: "private-to-runtime",
      text: "They look suspicious. What do I actually know?",
    },
  });
  await page.locator("#mm-rpg-refresh").click();
  await expect(page.locator("#mm-rpg-ask-gm-history")).toContainText(
    "Your suspicion is not proof of who these people are.",
  );

  await page.getByRole("button", { name: "Describe an in-world action" }).click();
  await expect(page.locator("#mm-rpg-action-form")).toBeVisible();
  await expect(page.locator('label[for="mm-rpg-action"]')).toHaveText("What do you do?");
  await expect(page.locator("#mm-rpg-send")).toHaveText("Do it");
  await expect(page.locator("#mm-rpg-action")).toHaveAttribute("placeholder", /in-world action/i);
  await page.locator("#mm-rpg-action").fill("I walk toward the checkpoint and inspect the barrier.");
  await page.locator("#mm-rpg-action-form").evaluate((form) => form.requestSubmit());

  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1].command).toMatchObject({
    kind: "campaign.submit_action",
    visibility: "public",
    text: "I walk toward the checkpoint and inspect the barrier.",
  });

  await page.getByRole("button", { name: "Talk to Warden Pell" }).click();
  await expect(page.locator("#mm-rpg-talk-panel")).toBeVisible();
  await expect(page.locator("#mm-rpg-talk-status")).toContainText("spoken in the world");
  await expect(page.locator("#mm-rpg-action-form")).toBeHidden();
});
