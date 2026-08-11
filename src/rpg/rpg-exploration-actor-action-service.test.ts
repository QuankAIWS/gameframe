import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RpgExplorationActorActionService } from "./rpg-exploration-actor-action-service.ts";
import { materializeRpgExplorationProjection } from "./rpg-exploration-materializer.ts";
import { SqliteRpgExplorationActorPositionStore } from "./sqlite-rpg-exploration-actor-position-store.ts";

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);
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
    entityId: "npc.mara-venn",
    entityClass: "actor",
    displayLabel: "checkpoint official",
    identityStage: "role",
    interactionTargetId: "entity:npc.mara-venn",
  });
  return value;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_actor_inspect",
    operationId: "operation:pell-check-badge",
    campaignId: "campaign-monster-master-reference",
    sceneId: "scene.crooked-checkpoint",
    authenticatedPlayerId: "player:ada",
    actorEntityId: "npc.warden-pell",
    targetEntityId: "npc.mara-venn",
    issuedAt: "2026-08-10T17:00:00.000Z",
    ...overrides,
  };
}

test("Pell approaches Mara through legal GameFrame cells without crossing occupied cells", () => {
  const positions = store();
  try {
    const service = new RpgExplorationActorActionService({ positions });
    const materialization = materializeRpgExplorationProjection(projection());
    const target = materialization.anchors.find((anchor) => anchor.semanticId === "npc.mara-venn");
    assert.ok(target);
    service.applyPlayerPosition(materialization, "trainer:_RmGMYy8smZq7uqHUwdOgs", { x: 8, y: 7 });
    const receipt = service.inspect(request(), materialization);
    assert.equal(receipt.replayed, false);
    assert.ok(receipt.path.length >= 1);
    assert.equal(Math.abs(receipt.transform.x - target.x) + Math.abs(receipt.transform.y - target.y), 1);
    assert.equal(receipt.path.some((point) => point.x === target.x && point.y === target.y), false);
    assert.equal(receipt.path.some((point) => point.x === 8 && point.y === 7), false);

    const rematerialized = materializeRpgExplorationProjection(projection());
    service.applyPersistedTransforms(rematerialized);
    const recovered = rematerialized.anchors.find((anchor) => anchor.semanticId === "npc.warden-pell");
    assert.deepEqual({ x: recovered?.x, y: recovered?.y }, { x: receipt.transform.x, y: receipt.transform.y });
  } finally {
    positions.close();
  }
});

test("exact operation retry is idempotent and changed reuse fails closed", () => {
  const positions = store();
  try {
    const service = new RpgExplorationActorActionService({ positions });
    const first = service.inspect(request(), materializeRpgExplorationProjection(projection()));
    const second = service.inspect(request(), materializeRpgExplorationProjection(projection()));
    assert.equal(second.replayed, true);
    assert.equal(second.actorPositionRevision, first.actorPositionRevision);
    assert.deepEqual(second.transform, first.transform);
    assert.throws(
      () => service.inspect(request({ targetEntityId: "npc.warden-pell" }), materializeRpgExplorationProjection(projection())),
      /reused with different custody/,
    );
  } finally {
    positions.close();
  }
});

test("actor transforms are scoped per scene instead of overwriting other scene positions", () => {
  const positions = store();
  try {
    const checkpointRef = { materializationId: "rpg-exploration:checkpoint", version: "1", hash: "hash-checkpoint" };
    const woodsRef = { materializationId: "rpg-exploration:woods", version: "1", hash: "hash-woods" };
    positions.commit({
      campaignId: "campaign-one",
      sceneId: "scene.crooked-checkpoint",
      actorEntityId: "npc.warden-pell",
      targetEntityId: "npc.mara-venn",
      materializationRef: checkpointRef,
      transform: { x: 7, y: 6, facing: "west" },
      operationId: "operation:checkpoint",
    });
    positions.commit({
      campaignId: "campaign-one",
      sceneId: "scene.west-woods",
      actorEntityId: "npc.warden-pell",
      targetEntityId: "npc.someone-else",
      materializationRef: woodsRef,
      transform: { x: 12, y: 8, facing: "east" },
      operationId: "operation:woods",
    });
    assert.equal(positions.read("campaign-one", "scene.crooked-checkpoint", "npc.warden-pell")?.transform.x, 7);
    assert.equal(positions.read("campaign-one", "scene.west-woods", "npc.warden-pell")?.transform.x, 12);
  } finally {
    positions.close();
  }
});
