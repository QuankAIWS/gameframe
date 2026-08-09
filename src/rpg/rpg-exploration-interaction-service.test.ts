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
    text: "Pell, does this checkpoint look right to you?",
  };
}

test("Talk resolves Pell only after GameFrame proves adjacency", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
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
        request: talkRequest(semantic, position.positionRevision),
        materialization,
        position,
      }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "interaction-out-of-range",
    );

    for (const direction of ["west", "west", "west", "west"] as const) {
      position = movement.move(
        semantic.viewer.playerId,
        moveRequest(semantic, position.positionRevision, direction),
      );
    }
    assert.deepEqual(position.transform, { x: 10, y: 7, facing: "west" });

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
