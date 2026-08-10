import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  RpgExplorationActorActionService,
} from "./rpg-exploration-actor-action-service.ts";
import { materializeRpgExplorationProjection } from "./rpg-exploration-materializer.ts";
import { SqliteRpgExplorationActorPositionStore } from "./sqlite-rpg-exploration-actor-position-store.ts";

const fixturePath = fileURLToPath(new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url));
const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function store() {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-actor-action-"));
  directories.push(directory);
  return new SqliteRpgExplorationActorPositionStore({ filePath: join(directory, "gameframe.sqlite") });
}

function projection(): any {
  const value = JSON.parse(readFileSync(fixturePath, "utf8")).projection;
  value.scene.entities.push({
    entityId: "npc.checkpoint-official",
    entityClass: "actor",
    displayLabel: "checkpoint official",
    identityStage: "role",
    interactionTargetId: "entity:npc.checkpoint-official",
  });
  return value;
}

function request() {
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_actor_inspect",
    operationId: "operation:pell-check-badge",
    campaignId: "campaign-mm-alpha",
    sceneId: "scene.crooked-checkpoint",
    authenticatedPlayerId: "player-ada",
    actorEntityId: "npc.warden-pell",
    targetEntityId: "npc.checkpoint-official",
    issuedAt: "2026-08-10T17:00:00.000Z",
  };
}

test("Pell approaches a present actor through legal GameFrame cells and persists the transform", () => {
  const positions = store();
  try {
    const service = new RpgExplorationActorActionService({ positions });
    const materialization = materializeRpgExplorationProjection(projection());
    const before = materialization.anchors.find((anchor) => anchor.semanticId === "npc.warden-pell");
    const target = materialization.anchors.find((anchor) => anchor.semanticId === "npc.checkpoint-official");
    assert.ok(before && target);
    const receipt = service.inspect(request(), materialization);
    assert.ok(receipt.path.length >= 1);
    assert.equal(
      Math.abs(receipt.transform.x - target.x) + Math.abs(receipt.transform.y - target.y),
      1,
    );

    const rematerialized = materializeRpgExplorationProjection(projection());
    service.applyPersistedTransforms(rematerialized);
    const recovered = rematerialized.anchors.find((anchor) => anchor.semanticId === "npc.warden-pell");
    assert.deepEqual({ x: recovered?.x, y: recovered?.y }, { x: receipt.transform.x, y: receipt.transform.y });
  } finally {
    positions.close();
  }
});

test("exact operation retry is idempotent", () => {
  const positions = store();
  try {
    const service = new RpgExplorationActorActionService({ positions });
    const first = service.inspect(request(), materializeRpgExplorationProjection(projection()));
    const second = service.inspect(request(), materializeRpgExplorationProjection(projection()));
    assert.equal(second.actorPositionRevision, first.actorPositionRevision);
    assert.deepEqual(second.transform, first.transform);
  } finally {
    positions.close();
  }
});
