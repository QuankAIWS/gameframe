import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { deriveRpgExplorationMaterializationRef } from "./rpg-exploration-contract.ts";
import { materializeRpgExplorationProjection } from "./rpg-exploration-materializer.ts";

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);

function fixture() {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
}

test("Crooked Checkpoint materializes deterministically from the canonical S6 projection", () => {
  const root = fixture();
  const projection = structuredClone(root.projection);
  const materialization = materializeRpgExplorationProjection(projection);

  assert.equal(materialization.kind, "gameframe.rpg.exploration_materialization");
  assert.equal(materialization.sceneId, "scene.crooked-checkpoint");
  assert.deepEqual(materialization.materializationRef, deriveRpgExplorationMaterializationRef(projection));
  assert.equal(materialization.profileId, "gameframe.rpg.semantic-scene.v1");
  assert.equal(materialization.map.width, 18);
  assert.equal(materialization.map.height, 14);
  assert.equal(materialization.map.cells.length, 18 * 14);
  assert.ok(materialization.map.cells.some((cell) => cell.terrain === "wall"));
  assert.ok(materialization.map.cells.some((cell) => cell.terrain === "difficult"));
  assert.ok(materialization.map.cells.some((cell) => cell.terrain === "objective"));

  const semanticIds = new Set(materialization.anchors.map((anchor) => anchor.semanticId));
  assert.ok(semanticIds.has("trainer:_RmGMYy8smZq7uqHUwdOgs"));
  assert.ok(semanticIds.has("npc.warden-pell"));
  assert.ok(semanticIds.has("object.checkpoint-cart"));
  assert.ok(semanticIds.has("location.maintenance-shed"));
  assert.ok(semanticIds.has("location.confiscation-cart"));
  assert.ok(semanticIds.has("route.crooked-checkpoint-west-woods"));
  assert.ok(!semanticIds.has("npc.mara-venn"));
});

test("viewer knowledge/display changes do not rematerialize Crooked Checkpoint geometry", () => {
  const root = fixture();
  const firstProjection = structuredClone(root.projection) as any;
  const secondProjection = structuredClone(root.projection) as any;
  const pell = secondProjection.scene.entities.find((entity: any) => entity.entityId === "npc.warden-pell");
  pell.displayLabel = "Pell";
  pell.identityStage = "name";
  secondProjection.scene.routes = [];
  secondProjection.campaignRevision += 9;
  secondProjection.scene.semanticRevision += 2;

  const first = materializeRpgExplorationProjection(firstProjection);
  const second = materializeRpgExplorationProjection(secondProjection);

  assert.deepEqual(second.materializationRef, first.materializationRef);
  assert.deepEqual(second.map, first.map);
  assert.notDeepEqual(second.anchors, first.anchors);
  assert.ok(!second.anchors.some((anchor) => anchor.kind === "route"));
});

test("reconnect reuses an accepted scene-bound materialization reference exactly", () => {
  const root = fixture();
  const projection = structuredClone(root.projection) as any;
  const first = materializeRpgExplorationProjection(projection);
  projection.scene.materialization.acceptedRef = first.materializationRef;
  projection.campaignRevision += 1;
  projection.scene.semanticRevision += 1;

  const reconnected = materializeRpgExplorationProjection(projection);
  assert.deepEqual(reconnected.materializationRef, first.materializationRef);
  assert.deepEqual(reconnected.map, first.map);
});
