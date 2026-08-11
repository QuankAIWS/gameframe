import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { RpgExplorationProjectionV1 } from "./rpg-exploration-contract.ts";
import {
  authorizeRpgExplorationTalk,
  RpgExplorationInteractionError,
} from "./rpg-exploration-interaction-service.ts";
import { materializeRpgExplorationProjection } from "./rpg-exploration-materializer.ts";
import {
  RpgExplorationMovementService,
  type RpgExplorationMoveDirection,
} from "./rpg-exploration-movement-service.ts";
import { SqliteRpgExplorationPositionStore } from "./sqlite-rpg-exploration-position-store.ts";

const directories: string[] = [];
const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);
const CART_ACTION = "Uncover the checkpoint cart.";
const CART_TARGET = "entity:object.checkpoint-cart";

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-interaction-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function projection(): RpgExplorationProjectionV1 {
  return JSON.parse(readFileSync(fixturePath, "utf8")).projection as RpgExplorationProjectionV1;
}

function moveRequest(
  semantic: RpgExplorationProjectionV1,
  expectedPositionRevision: number,
  direction: RpgExplorationMoveDirection,
) {
  const materialization = materializeRpgExplorationProjection(semantic);
  return {
    type: "exploration_move" as const,
    protocolVersion: 1 as const,
    campaignId: semantic.campaignId,
    sceneId: semantic.scene.sceneId,
    materializationRef: materialization.materializationRef,
    expectedPositionRevision,
    direction,
  };
}

function talkRequest(
  semantic: RpgExplorationProjectionV1,
  positionRevision: number,
  interactionTargetId = "entity:npc.warden-pell",
  text = "Pell, does this checkpoint look right to you?",
) {
  const materialization = materializeRpgExplorationProjection(semantic);
  return {
    type: "exploration_interact" as const,
    protocolVersion: 1 as const,
    campaignId: semantic.campaignId,
    sceneId: semantic.scene.sceneId,
    materializationRef: materialization.materializationRef,
    expectedPositionRevision: positionRevision,
    expectedGameframeCoordinationRevision: 12,
    commandId: "talk-command-one",
    issuedAt: "2026-08-09T18:01:00.000Z",
    interaction: "talk" as const,
    interactionTargetId,
    text,
  };
}

test("Talk resolves a present actor anywhere in the current materialized scene", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const positions = new SqliteRpgExplorationPositionStore({ filePath: databasePath() });
  const movement = new RpgExplorationMovementService({ positions });
  try {
    const position = movement.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.deepEqual(position.transform, { x: 14, y: 7, facing: "west" });
    const pell = materialization.anchors.find((anchor) => anchor.semanticId === "npc.warden-pell");
    assert.equal(Math.abs((pell?.x ?? 0) - position.transform.x) + Math.abs((pell?.y ?? 0) - position.transform.y), 5);

    const authorized = authorizeRpgExplorationTalk({
      request: talkRequest(semantic, position.positionRevision),
      materialization,
      position,
    });
    assert.deepEqual(authorized, {
      campaignId: semantic.campaignId,
      sceneId: semantic.scene.sceneId,
      commandId: "talk-command-one",
      issuedAt: "2026-08-09T18:01:00.000Z",
      expectedGameframeCoordinationRevision: 12,
      interaction: "talk",
      interactionTargetId: "entity:npc.warden-pell",
      targetEntityId: "npc.warden-pell",
      targetDisplayLabel: "veteran field warden",
      text: "Pell, does this checkpoint look right to you?",
    });
  } finally {
    positions.close();
  }
});

test("checkpoint cart uncover resolves only after GameFrame proves current covered adjacency", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const cart = materialization.anchors.find((anchor) => anchor.semanticId === "object.checkpoint-cart");
  assert.deepEqual(
    { x: cart?.x, y: cart?.y, state: cart?.objectState },
    { x: 10, y: 8, state: "covered" },
  );
  const positions = new SqliteRpgExplorationPositionStore({ filePath: databasePath() });
  const movement = new RpgExplorationMovementService({ positions });
  try {
    let position = movement.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.throws(
      () => authorizeRpgExplorationTalk({
        request: talkRequest(semantic, position.positionRevision, CART_TARGET, CART_ACTION),
        materialization,
        position,
      }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "interaction-out-of-range",
    );

    for (const direction of ["west", "west", "west", "south"] as const) {
      position = movement.move(
        semantic.viewer.playerId,
        moveRequest(semantic, position.positionRevision, direction),
      );
    }
    assert.deepEqual(position.transform, { x: 11, y: 8, facing: "south" });

    const authorized = authorizeRpgExplorationTalk({
      request: talkRequest(semantic, position.positionRevision, CART_TARGET, CART_ACTION),
      materialization,
      position,
    });
    assert.deepEqual(authorized, {
      campaignId: semantic.campaignId,
      sceneId: semantic.scene.sceneId,
      commandId: "talk-command-one",
      issuedAt: "2026-08-09T18:01:00.000Z",
      expectedGameframeCoordinationRevision: 12,
      interaction: "talk",
      interactionTargetId: CART_TARGET,
      targetEntityId: "object.checkpoint-cart",
      targetDisplayLabel: "covered confiscation cart · covered",
      text: CART_ACTION,
    });

    assert.throws(
      () => authorizeRpgExplorationTalk({
        request: talkRequest(
          semantic,
          position.positionRevision,
          CART_TARGET,
          "Tell me what is in the cart.",
        ),
        materialization,
        position,
      }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "interaction-target-unavailable",
    );

    const uncoveredMaterialization = structuredClone(materialization);
    const uncoveredCart = uncoveredMaterialization.anchors.find((anchor) =>
      anchor.semanticId === "object.checkpoint-cart"
    );
    if (!uncoveredCart) throw new Error("fixture cart is missing");
    uncoveredCart.objectState = "uncovered";
    assert.throws(
      () => authorizeRpgExplorationTalk({
        request: talkRequest(semantic, position.positionRevision, CART_TARGET, CART_ACTION),
        materialization: uncoveredMaterialization,
        position,
      }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "interaction-target-unavailable",
    );
  } finally {
    positions.close();
  }
});

test("Talk rejects stale position and browser-supplied semantic target fields", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const positions = new SqliteRpgExplorationPositionStore({ filePath: databasePath() });
  const movement = new RpgExplorationMovementService({ positions });
  try {
    const position = movement.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    const stale = talkRequest(semantic, position.positionRevision + 1);
    assert.throws(
      () => authorizeRpgExplorationTalk({ request: stale, materialization, position }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "position-revision-conflict",
    );

    assert.throws(
      () => authorizeRpgExplorationTalk({
        request: {
          ...talkRequest(semantic, position.positionRevision),
          targetEntityId: "npc.warden-pell",
        },
        materialization,
        position,
      }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "invalid-input",
    );
  } finally {
    positions.close();
  }
});

test("Talk rejects a present non-actor entity even though actor speech is scene-wide", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  materialization.anchors.push({
    anchorId: "entity:monster.synthetic",
    kind: "entity",
    semanticId: "monster.synthetic",
    interactionTargetId: "entity:monster.synthetic",
    label: "nearby monster",
    x: 15,
    y: 7,
    entityClass: "monster",
    identityStage: "name",
  });
  const positions = new SqliteRpgExplorationPositionStore({ filePath: databasePath() });
  const movement = new RpgExplorationMovementService({ positions });
  try {
    const position = movement.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.throws(
      () => authorizeRpgExplorationTalk({
        request: talkRequest(
          semantic,
          position.positionRevision,
          "entity:monster.synthetic",
        ),
        materialization,
        position,
      }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "interaction-target-unavailable",
    );
  } finally {
    positions.close();
  }
});
