import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorizeRpgExplorationMonsterControl,
  normalizeRpgExplorationMonsterControlRequest,
} from "./rpg-exploration-monster-control-service.ts";
import type { RpgExplorationProjectionV1 } from "./rpg-exploration-contract.ts";
import type { RpgExplorationPhysicalMaterializationV1 } from "./rpg-exploration-materializer.ts";
import type { RpgExplorationPositionMessageV1 } from "./rpg-exploration-movement-service.ts";

const campaignId = "campaign-control-test";
const sceneId = "scene.crooked-checkpoint";
const materializationRef = {
  materializationId: `rpg-scene:${campaignId}:${sceneId}`,
  version: "1",
  hash: "A".repeat(43),
};

function projection(state: "deployed" | "recalled" | "deployed-elsewhere" = "recalled"):
RpgExplorationProjectionV1 {
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_projection",
    campaignId,
    campaignRevision: 10,
    package: {
      packageId: "mm.package.test",
      packageVersion: 5,
      gameFamilyId: "monster-master",
      ruleset: {
        rulesetId: "monster-master-rpg",
        rulesetVersion: 1,
        capabilityProfileId: "mm.ruleset.embodied-campaign.v1",
      },
    },
    viewer: {
      playerId: "player.one",
      playerCharacterEntityId: "trainer.one",
      monsters: [{
        monsterId: "monster.cinder",
        displayLabel: "Cinder",
        controlTargetId: "roster:monster.cinder",
        rulesProfileId: "mm.monster.skirmisher.v1",
        deploymentState: state,
        ...(state === "deployed"
          ? { deployedSceneId: sceneId }
          : state === "deployed-elsewhere"
            ? { deployedSceneId: "scene.other" }
            : {}),
      }],
    },
    scene: {
      sceneId,
      semanticRevision: 3,
      lifecycleState: "active",
      resolutionMode: "exploration",
      worldNodeId: "world.node.crooked-checkpoint",
      location: {
        locationId: "location.checkpoint",
        label: "Checkpoint",
        description: "A road checkpoint.",
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
          fallbackLabel: "Checkpoint",
        },
      },
      landmarks: [],
      entities: [{
        entityId: "trainer.one",
        entityClass: "player-character",
        displayLabel: "You",
        identityStage: "self",
        interactionTargetId: "entity:trainer.one",
      }],
      objects: [],
      routes: [],
    },
  };
}

const materialization: RpgExplorationPhysicalMaterializationV1 = {
  protocolVersion: 1,
  kind: "gameframe.rpg.exploration_materialization",
  campaignId,
  sceneId,
  semanticRevision: 3,
  materializationRef,
  profileId: "gameframe.rpg.semantic-scene.v1",
  themeId: "monster-master-starter",
  map: { width: 2, height: 2, cells: Array.from({ length: 4 }, () => ({ terrain: "floor" })) },
  anchors: [{
    anchorId: "entity:trainer.one",
    kind: "player",
    semanticId: "trainer.one",
    label: "You",
    x: 0,
    y: 0,
    entityClass: "player-character",
    identityStage: "self",
  }],
};

const position: RpgExplorationPositionMessageV1 = {
  type: "exploration_position",
  protocolVersion: 1,
  campaignId,
  sceneId,
  playerEntityId: "trainer.one",
  materializationRef,
  positionRevision: 7,
  transform: { x: 0, y: 0, facing: "west" },
  moved: false,
};

function request(operation: "deploy" | "recall") {
  return {
    type: "exploration_monster_control",
    protocolVersion: 1,
    campaignId,
    sceneId,
    materializationRef,
    expectedPositionRevision: 7,
    expectedGameframeCoordinationRevision: 12,
    commandId: `command:${operation}-cinder`,
    issuedAt: "2026-08-09T23:00:00.000Z",
    operation,
    controlTargetId: "roster:monster.cinder",
  };
}

describe("RPG exploration monster control", () => {
  it("maps only the authenticated viewer-owned roster handle and ignores irrelevant physical revision drift", () => {
    assert.deepEqual(authorizeRpgExplorationMonsterControl({
      request: { ...request("deploy"), expectedPositionRevision: 999 },
      projection: projection("recalled"),
      materialization,
      position,
    }), {
      campaignId,
      sceneId,
      commandId: "command:deploy-cinder",
      issuedAt: "2026-08-09T23:00:00.000Z",
      expectedGameframeCoordinationRevision: 12,
      operation: "deploy",
      controlTargetId: "roster:monster.cinder",
      targetEntityId: "monster.cinder",
      targetDisplayLabel: "Cinder",
    });
  });

  it("rejects wrong deployment state and browser-supplied canonical target IDs", () => {
    assert.throws(() => authorizeRpgExplorationMonsterControl({
      request: request("deploy"),
      projection: projection("deployed"),
      materialization,
      position,
    }), (error: unknown) =>
      error instanceof Error
      && "code" in error
      && error.code === "control-state-conflict");

    assert.throws(() => normalizeRpgExplorationMonsterControlRequest({
      ...request("recall"),
      targetEntityId: "monster.someone-elses",
    }), /unsupported fields/);
  });
});
