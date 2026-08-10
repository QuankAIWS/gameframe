import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { deriveRpgExplorationMaterializationRef } from "./rpg-exploration-contract.ts";
import {
  materializeRpgExplorationProjection,
  RpgExplorationMaterializationError,
} from "./rpg-exploration-materializer.ts";

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);

function fixture() {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
}

function extraObject(index: number) {
  return {
    entityId: `object.extra-${index}`,
    displayLabel: `visible object ${index}`,
    interactionTargetId: `entity:object.extra-${index}`,
    state: "idle",
  };
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
  assert.ok(!semanticIds.has("location.confiscation-cart"));
  assert.ok(semanticIds.has("route.crooked-checkpoint-west-woods"));
  assert.ok(!semanticIds.has("npc.mara-venn"));

  const cartAnchors = materialization.anchors.filter((anchor) =>
    anchor.semanticId === "object.checkpoint-cart"
    || anchor.semanticId === "location.confiscation-cart"
  );
  assert.equal(cartAnchors.length, 1, "the physical scene must contain one authoritative checkpoint cart");
  assert.equal(cartAnchors[0]?.kind, "object");
  assert.equal(cartAnchors[0]?.objectState, "covered");
  assert.match(cartAnchors[0]?.label ?? "", /covered/);
});

test("checkpoint cart state changes presentation without changing physical map identity", () => {
  const root = fixture();
  const coveredProjection = structuredClone(root.projection) as any;
  const uncoveredProjection = structuredClone(root.projection) as any;
  const cart = uncoveredProjection.scene.objects.find(
    (object: any) => object.entityId === "object.checkpoint-cart",
  );
  cart.state = "uncovered";
  uncoveredProjection.campaignRevision += 1;
  uncoveredProjection.scene.semanticRevision += 1;

  const covered = materializeRpgExplorationProjection(coveredProjection);
  const uncovered = materializeRpgExplorationProjection(uncoveredProjection);
  const coveredCart = covered.anchors.find((anchor) => anchor.semanticId === "object.checkpoint-cart");
  const uncoveredCart = uncovered.anchors.find((anchor) => anchor.semanticId === "object.checkpoint-cart");

  assert.deepEqual(uncovered.materializationRef, covered.materializationRef);
  assert.deepEqual(uncovered.map, covered.map);
  assert.deepEqual(
    { x: uncoveredCart?.x, y: uncoveredCart?.y },
    { x: coveredCart?.x, y: coveredCart?.y },
  );
  assert.equal(coveredCart?.objectState, "covered");
  assert.equal(uncoveredCart?.objectState, "uncovered");
  assert.notEqual(uncoveredCart?.label, coveredCart?.label);
});

test("additional visible entities never reuse Pell or other occupied physical anchors", () => {
  const root = fixture();
  const projection = structuredClone(root.projection) as any;
  projection.scene.entities.push({
    entityId: "npc.visible-extra",
    entityClass: "actor",
    displayLabel: "another visible traveler",
    identityStage: "descriptor",
    interactionTargetId: "entity:npc.visible-extra",
  });

  const materialization = materializeRpgExplorationProjection(projection);
  const pell = materialization.anchors.find((anchor) => anchor.semanticId === "npc.warden-pell");
  const extra = materialization.anchors.find((anchor) => anchor.semanticId === "npc.visible-extra");
  assert.ok(pell);
  assert.ok(extra);
  assert.notDeepEqual(
    { x: extra.x, y: extra.y },
    { x: pell.x, y: pell.y },
  );

  const entityPositions = materialization.anchors
    .filter((anchor) => anchor.kind === "player" || anchor.kind === "entity")
    .map((anchor) => `${anchor.x},${anchor.y}`);
  assert.equal(new Set(entityPositions).size, entityPositions.length);
});

test("three additional visible objects allocate distinct bounded fallback anchors", () => {
  const root = fixture();
  const projection = structuredClone(root.projection) as any;
  projection.scene.objects.push(extraObject(1), extraObject(2), extraObject(3));

  const materialization = materializeRpgExplorationProjection(projection);
  const objectPositions = materialization.anchors
    .filter((anchor) => anchor.kind === "object")
    .map((anchor) => `${anchor.x},${anchor.y}`);
  assert.equal(objectPositions.length, 4);
  assert.equal(new Set(objectPositions).size, objectPositions.length);
});

test("unsupported object density fails closed instead of cycling through occupied slots", () => {
  const root = fixture();
  const projection = structuredClone(root.projection) as any;
  projection.scene.objects.push(...Array.from({ length: 12 }, (_, index) => extraObject(index + 1)));

  assert.throws(
    () => materializeRpgExplorationProjection(projection),
    (error: unknown) => error instanceof RpgExplorationMaterializationError
      && error.message.includes("no remaining physical anchor slots"),
  );
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
