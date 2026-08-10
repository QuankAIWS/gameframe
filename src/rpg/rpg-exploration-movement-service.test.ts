import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { normalizeRpgExplorationProjection } from "./rpg-exploration-contract.ts";
import {
  materializeRpgExplorationProjection,
} from "./rpg-exploration-materializer.ts";
import {
  normalizeMoveRequest,
  RpgExplorationMovementError,
  RpgExplorationMovementService,
} from "./rpg-exploration-movement-service.ts";
import { SqliteRpgExplorationPositionStore } from "./sqlite-rpg-exploration-position-store.ts";
import explorationFixture from "../../planning/fixtures/rpg/v1/exploration-port-a.json" with { type: "json" };

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-position-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function projection() {
  return normalizeRpgExplorationProjection(explorationFixture.projection);
}

function moveRequest(
  semantic: ReturnType<typeof projection>,
  expectedPositionRevision: number,
  direction: "north" | "south" | "east" | "west",
) {
  return {
    type: "exploration_move",
    protocolVersion: 1,
    campaignId: semantic.campaignId,
    sceneId: semantic.scene.sceneId,
    materializationRef: materializeRpgExplorationProjection(semantic).materializationRef,
    expectedPositionRevision,
    direction,
  };
}

test("normalizes strict movement requests", () => {
  const semantic = projection();
  assert.equal(normalizeMoveRequest(
    moveRequest(semantic, 0, "west"),
  ).direction, "west");
  assert.throws(() => normalizeMoveRequest({
    ...moveRequest(semantic, 0, "west"),
    x: 99,
  }), /unsupported fields/);
});

test("materialized movement is collision-aware and revisioned per player", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const positions = new SqliteRpgExplorationPositionStore({
    filePath: databasePath(),
  });
  const service = new RpgExplorationMovementService({ positions });
  try {
    const initial = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.deepEqual(initial.transform, { x: 14, y: 7, facing: "west" });
    assert.equal(initial.positionRevision, 0);

    let position = initial;
    for (const direction of ["west", "west", "west", "west"] as const) {
      position = service.move(
        semantic.viewer.playerId,
        moveRequest(semantic, position.positionRevision, direction),
      );
    }
    assert.deepEqual(position.transform, { x: 10, y: 7, facing: "west" });
    assert.equal(position.positionRevision, 4);

    const blocked = service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, position.positionRevision, "south"),
    );
    assert.equal(blocked.moved, false);
    assert.equal(blocked.blockedBy, "occupied");
    assert.deepEqual(blocked.transform, { x: 10, y: 7, facing: "south" });
    assert.equal(blocked.positionRevision, 5);
  } finally {
    positions.close();
  }
});

test("player movement persists across service restart for the same materialization", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const filePath = databasePath();
  let positions = new SqliteRpgExplorationPositionStore({ filePath });
  let service = new RpgExplorationMovementService({ positions });
  const initial = service.attach({
    playerId: semantic.viewer.playerId,
    projection: semantic,
    materialization,
  });
  service.move(
    semantic.viewer.playerId,
    moveRequest(semantic, initial.positionRevision, "west"),
  );
  positions.close();

  positions = new SqliteRpgExplorationPositionStore({ filePath });
  service = new RpgExplorationMovementService({ positions });
  try {
    const recovered = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.deepEqual(recovered.transform, { x: 13, y: 7, facing: "west" });
    assert.equal(recovered.positionRevision, 1);
  } finally {
    positions.close();
  }
});

test("materialization identity changes reset stale physical positions", () => {
  const semantic = projection();
  const filePath = databasePath();
  const materialization = materializeRpgExplorationProjection(semantic);
  const positions = new SqliteRpgExplorationPositionStore({ filePath });
  const service = new RpgExplorationMovementService({ positions });
  try {
    const initial = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, initial.positionRevision, "west"),
    );

    const nextSemantic = structuredClone(semantic);
    nextSemantic.scene.semanticRevision += 1;
    nextSemantic.scene.materialization.acceptedRef = {
      materializationId: materialization.materializationRef.materializationId,
      version: "2",
      hash: "V2-pqiWVXyRuvk0jBq9Elj-IiSwsi2yu1RAEYo_lQ",
    };
    const nextMaterialization = materializeRpgExplorationProjection(nextSemantic);
    const reset = service.attach({
      playerId: nextSemantic.viewer.playerId,
      projection: nextSemantic,
      materialization: nextMaterialization,
    });
    assert.deepEqual(reset.transform, { x: 14, y: 7, facing: "west" });
    assert.equal(reset.positionRevision, 0);
  } finally {
    positions.close();
  }
});

test("reattach keeps a persisted player position when companion placement occupies the authored spawn", () => {
  const filePath = databasePath();
  const positions = new SqliteRpgExplorationPositionStore({ filePath });
  const semantic = projection();
  const monsterId = "monster:cinder-reattach-test";
  semantic.viewer.monsters = [{
    monsterId,
    displayLabel: "Cinder",
    controlTargetId: `roster:${monsterId}`,
    rulesProfileId: "mm.monster.skirmisher.v1",
    deploymentState: "deployed",
    deployedSceneId: semantic.scene.sceneId,
  }];
  semantic.scene.entities.push({
    entityId: monsterId,
    entityClass: "monster",
    displayLabel: "Cinder",
    identityStage: "name",
    interactionTargetId: `entity:${monsterId}`,
    rulesProfileId: "mm.monster.skirmisher.v1",
  });
  const service = new RpgExplorationMovementService({ positions });
  try {
    const firstMaterialization = materializeRpgExplorationProjection(semantic);
    const attached = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization: firstMaterialization,
    });
    assert.deepEqual(attached.transform, { x: 14, y: 7, facing: "west" });

    const moved = service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, attached.positionRevision, "east"),
    );
    assert.deepEqual(moved.transform, { x: 15, y: 7, facing: "east" });

    const freshMaterialization = materializeRpgExplorationProjection(semantic);
    const recovered = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization: freshMaterialization,
    });
    assert.deepEqual(recovered.transform, { x: 15, y: 7, facing: "east" });
    const companion = freshMaterialization.anchors.find((anchor) =>
      anchor.semanticId === monsterId
    );
    assert.ok(companion);
    assert.deepEqual({ x: companion.x, y: companion.y }, { x: 14, y: 7 });
  } finally {
    positions.close();
  }
});

test("companion placement widens deterministically when every cardinal cell is blocked", () => {
  const positions = new SqliteRpgExplorationPositionStore({ filePath: databasePath() });
  const semantic = projection();
  const monsterId = "monster:cinder-crowded-test";
  semantic.viewer.monsters = [{
    monsterId,
    displayLabel: "Cinder",
    controlTargetId: `roster:${monsterId}`,
    rulesProfileId: "mm.monster.skirmisher.v1",
    deploymentState: "deployed",
    deployedSceneId: semantic.scene.sceneId,
  }];
  semantic.scene.entities.push({
    entityId: monsterId,
    entityClass: "monster",
    displayLabel: "Cinder",
    identityStage: "name",
    interactionTargetId: `entity:${monsterId}`,
    rulesProfileId: "mm.monster.skirmisher.v1",
  });
  const materialization = materializeRpgExplorationProjection(semantic);
  const blockers = [
    { x: 13, y: 7 },
    { x: 14, y: 8 },
    { x: 14, y: 6 },
    { x: 15, y: 7 },
  ];
  blockers.forEach((position, index) => {
    materialization.anchors.push({
      anchorId: `test:blocker:${index}`,
      kind: "object",
      semanticId: `object:blocker:${index}`,
      label: `Blocker ${index}`,
      x: position.x,
      y: position.y,
    });
  });
  const service = new RpgExplorationMovementService({ positions });
  try {
    const attached = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.deepEqual(attached.transform, { x: 14, y: 7, facing: "west" });
    const companion = materialization.anchors.find((anchor) => anchor.semanticId === monsterId);
    assert.ok(companion);
    assert.equal(Math.abs(companion.x - 14) + Math.abs(companion.y - 7), 2);
    assert.equal(blockers.some(({ x, y }) => x === companion.x && y === companion.y), false);
  } finally {
    positions.close();
  }
});

test("movement rejects stale client position revisions", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const positions = new SqliteRpgExplorationPositionStore({
    filePath: databasePath(),
  });
  const service = new RpgExplorationMovementService({ positions });
  try {
    service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, 0, "west"),
    );
    assert.throws(
      () => service.move(
        semantic.viewer.playerId,
        moveRequest(semantic, 0, "south"),
      ),
      (error: unknown) =>
        error instanceof RpgExplorationMovementError
        && error.code === "position-revision-conflict"
        && error.retryable,
    );
  } finally {
    positions.close();
  }
});

test("movement does not journal semantic events into Runtime", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const positions = new SqliteRpgExplorationPositionStore({
    filePath: databasePath(),
  });
  const service = new RpgExplorationMovementService({ positions });
  try {
    service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    const before = JSON.stringify(semantic);
    service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, 0, "west"),
    );
    assert.equal(JSON.stringify(semantic), before);
  } finally {
    positions.close();
  }
});