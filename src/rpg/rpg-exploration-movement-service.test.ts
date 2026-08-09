import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { RpgExplorationProjectionV1 } from "./rpg-exploration-contract.ts";
import { materializeRpgExplorationProjection } from "./rpg-exploration-materializer.ts";
import {
  RpgExplorationMovementError,
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
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-movement-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function projection(): RpgExplorationProjectionV1 {
  return JSON.parse(readFileSync(fixturePath, "utf8")).projection as RpgExplorationProjectionV1;
}

function moveRequest(
  projectionValue: RpgExplorationProjectionV1,
  expectedPositionRevision: number,
  direction: RpgExplorationMoveDirection,
) {
  const materialization = materializeRpgExplorationProjection(projectionValue);
  return {
    type: "exploration_move" as const,
    protocolVersion: 1 as const,
    campaignId: projectionValue.campaignId,
    sceneId: projectionValue.scene.sceneId,
    materializationRef: materialization.materializationRef,
    expectedPositionRevision,
    direction,
  };
}

test("GameFrame movement obeys Crooked Checkpoint terrain and occupied anchors", () => {
  const filePath = databasePath();
  const positions = new SqliteRpgExplorationPositionStore({ filePath });
  const service = new RpgExplorationMovementService({
    positions,
    clock: () => "2026-08-09T13:00:00.000Z",
  });
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  try {
    const attached = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.deepEqual(attached.transform, { x: 14, y: 7, facing: "west" });
    assert.equal(attached.positionRevision, 0);

    let current = attached;
    for (const direction of ["west", "west", "west", "west"] as const) {
      current = service.move(
        semantic.viewer.playerId,
        moveRequest(semantic, current.positionRevision, direction),
      );
      assert.equal(current.moved, true);
    }
    assert.deepEqual(current.transform, { x: 10, y: 7, facing: "west" });

    const cartBlocked = service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, current.positionRevision, "south"),
    );
    assert.equal(cartBlocked.moved, false);
    assert.equal(cartBlocked.blockedBy, "occupied");
    assert.deepEqual(cartBlocked.transform, { x: 10, y: 7, facing: "south" });
    assert.equal(cartBlocked.positionRevision, current.positionRevision + 1);

    current = service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, cartBlocked.positionRevision, "north"),
    );
    current = service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, current.positionRevision, "west"),
    );
    assert.deepEqual(current.transform, { x: 9, y: 6, facing: "west" });

    const wallBlocked = service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, current.positionRevision, "west"),
    );
    assert.equal(wallBlocked.moved, false);
    assert.equal(wallBlocked.blockedBy, "terrain");
    assert.deepEqual(wallBlocked.transform, { x: 9, y: 6, facing: "west" });
    assert.equal(wallBlocked.positionRevision, current.positionRevision);
  } finally {
    positions.close();
  }
});

test("exploration position survives GameFrame restart only for the exact materialization", () => {
  const filePath = databasePath();
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  let lastRevision = 0;

  const firstStore = new SqliteRpgExplorationPositionStore({ filePath });
  try {
    const first = new RpgExplorationMovementService({ positions: firstStore });
    let current = first.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    current = first.move(
      semantic.viewer.playerId,
      moveRequest(semantic, current.positionRevision, "west"),
    );
    current = first.move(
      semantic.viewer.playerId,
      moveRequest(semantic, current.positionRevision, "north"),
    );
    assert.deepEqual(current.transform, { x: 13, y: 6, facing: "north" });
    lastRevision = current.positionRevision;
  } finally {
    firstStore.close();
  }

  const secondStore = new SqliteRpgExplorationPositionStore({ filePath });
  try {
    const second = new RpgExplorationMovementService({ positions: secondStore });
    const recovered = second.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    assert.deepEqual(recovered.transform, { x: 13, y: 6, facing: "north" });
    assert.equal(recovered.positionRevision, lastRevision);

    const changed = structuredClone(semantic) as RpgExplorationProjectionV1;
    changed.scene.materialization.intent = {
      ...changed.scene.materialization.intent,
      themeId: "monster-master-starter-revised",
    };
    const changedMaterialization = materializeRpgExplorationProjection(changed);
    const reset = second.attach({
      playerId: changed.viewer.playerId,
      projection: changed,
      materialization: changedMaterialization,
    });
    assert.deepEqual(reset.transform, { x: 14, y: 7, facing: "west" });
    assert.equal(reset.positionRevision, 0);
  } finally {
    secondStore.close();
  }
});

test("movement rejects stale client position revisions", () => {
  const filePath = databasePath();
  const positions = new SqliteRpgExplorationPositionStore({ filePath });
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const service = new RpgExplorationMovementService({ positions });
  try {
    const attached = service.attach({
      playerId: semantic.viewer.playerId,
      projection: semantic,
      materialization,
    });
    const moved = service.move(
      semantic.viewer.playerId,
      moveRequest(semantic, attached.positionRevision, "west"),
    );
    assert.throws(
      () => service.move(
        semantic.viewer.playerId,
        moveRequest(semantic, attached.positionRevision, "north"),
      ),
      (error: unknown) => error instanceof RpgExplorationMovementError
        && error.code === "position-revision-conflict",
    );
    assert.equal(moved.positionRevision, 1);
  } finally {
    positions.close();
  }
});
