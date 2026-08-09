import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  deriveRpgExplorationMaterializationRef,
  normalizeRpgExplorationProjection,
  RpgExplorationContractError,
} from "./rpg-exploration-contract.ts";

type JsonRecord = Record<string, unknown>;

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);

function fixture(): JsonRecord {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as JsonRecord;
}

function record(value: unknown, label: string): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonRecord;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

test("canonical Crooked Checkpoint projection is viewer-safe and materialization-stable", () => {
  const root = fixture();
  assert.equal(root.fixtureVersion, 1);
  assert.equal(root.contract, "rpg-exploration-port");
  assert.equal(root.slice, "crooked-checkpoint");

  const request = record(root.request, "request");
  assert.deepEqual(request, {
    protocolVersion: 1,
    kind: "campaign.exploration.attach",
    campaignId: "campaign-monster-master-reference",
    connectionId: "connection-ada",
  });

  const projection = normalizeRpgExplorationProjection(root.projection);
  assert.equal(projection.package.packageVersion, 5);
  assert.equal(projection.package.gameFamilyId, "monster-master");
  assert.equal(projection.package.ruleset.rulesetId, "monster-master-rpg");
  assert.equal(projection.scene.sceneId, "scene.crooked-checkpoint");
  assert.equal(projection.scene.worldNodeId, "world.node.crooked-checkpoint");
  assert.deepEqual(
    projection.scene.routes.map((route) => route.routeId),
    ["route.crooked-checkpoint-west-woods"],
  );
  assert.ok(projection.scene.entities.some((entity) =>
    entity.entityId === projection.viewer.playerCharacterEntityId
    && entity.identityStage === "self"
  ));
  assert.ok(projection.scene.entities.some((entity) => entity.entityId === "npc.warden-pell"));
  assert.ok(!projection.scene.entities.some((entity) => entity.entityId === "npc.mara-venn"));

  const serialized = JSON.stringify(projection);
  const expected = record(root.expected, "expected");
  const forbiddenFields = expected.forbiddenProjectionFields;
  assert.ok(Array.isArray(forbiddenFields));
  for (const field of forbiddenFields) {
    assert.equal(typeof field, "string");
    assert.equal(serialized.includes(`\"${field}\"`), false, `projection leaked forbidden field ${field}`);
  }

  const firstRef = deriveRpgExplorationMaterializationRef(projection);
  assert.match(firstRef.hash ?? "", /^[A-Za-z0-9_-]{43}$/);

  const renamed = clone(projection);
  const pell = renamed.scene.entities.find((entity) => entity.entityId === "npc.warden-pell");
  assert.ok(pell);
  pell.displayLabel = "Pell";
  pell.identityStage = "name";
  assert.deepEqual(
    deriveRpgExplorationMaterializationRef(renamed),
    firstRef,
    "knowledge/display changes must not rematerialize the scene",
  );

  const routesChanged = clone(projection);
  routesChanged.scene.routes = [];
  assert.deepEqual(
    deriveRpgExplorationMaterializationRef(routesChanged),
    firstRef,
    "viewer-authorized route changes must not split shared materialization identity",
  );

  const reconnected = clone(projection);
  reconnected.campaignRevision += 9;
  reconnected.scene.semanticRevision += 2;
  reconnected.scene.materialization.acceptedRef = firstRef;
  assert.deepEqual(
    deriveRpgExplorationMaterializationRef(reconnected),
    firstRef,
    "reconnect must reuse the accepted materialization",
  );
  assert.equal(expected.materializationIdentityIgnoresDynamicEntityDisplay, true);
  assert.equal(expected.reconnectReusesAcceptedMaterialization, true);
  assert.equal(expected.movementFramesAreRuntimeJournalEvents, false);
});

test("exploration projection rejects geometry and hidden extension fields", () => {
  const root = fixture();
  const projection = record(root.projection, "projection");

  const withGeometry = clone(projection);
  record(withGeometry.scene, "scene").x = 42;
  assert.throws(
    () => normalizeRpgExplorationProjection(withGeometry),
    (error: unknown) =>
      error instanceof RpgExplorationContractError
      && error.message.includes("unsupported fields: x"),
  );

  const withHiddenLocation = clone(projection);
  record(record(withHiddenLocation.scene, "scene").location, "location").privateFacts = [
    "The inspector is a fraud.",
  ];
  assert.throws(
    () => normalizeRpgExplorationProjection(withHiddenLocation),
    (error: unknown) =>
      error instanceof RpgExplorationContractError
      && error.message.includes("unsupported fields: privateFacts"),
  );
});

test("accepted materialization reference must be bounded and scene-bound", () => {
  const root = fixture();
  const invalidHash = clone(record(root.projection, "projection"));
  record(record(invalidHash.scene, "scene").materialization, "materialization").acceptedRef = {
    materializationId: "rpg-scene:campaign-monster-master-reference:scene.crooked-checkpoint",
    version: "1",
    hash: "not a valid hash with spaces",
  };
  assert.throws(
    () => normalizeRpgExplorationProjection(invalidHash),
    (error: unknown) =>
      error instanceof RpgExplorationContractError
      && error.message.includes("acceptedRef.hash is invalid"),
  );

  const wrongScene = clone(record(root.projection, "projection"));
  record(record(wrongScene.scene, "scene").materialization, "materialization").acceptedRef = {
    materializationId: "rpg-scene:campaign-monster-master-reference:scene.west-woods",
    version: "1",
    hash: "A".repeat(43),
  };
  assert.throws(
    () => normalizeRpgExplorationProjection(wrongScene),
    (error: unknown) =>
      error instanceof RpgExplorationContractError
      && error.message.includes("acceptedRef.materializationId must equal"),
  );

  const wrongVersion = clone(record(root.projection, "projection"));
  record(record(wrongVersion.scene, "scene").materialization, "materialization").acceptedRef = {
    materializationId: "rpg-scene:campaign-monster-master-reference:scene.crooked-checkpoint",
    version: "2",
    hash: "B".repeat(43),
  };
  assert.throws(
    () => normalizeRpgExplorationProjection(wrongVersion),
    (error: unknown) =>
      error instanceof RpgExplorationContractError
      && error.message.includes("acceptedRef.version must equal 1"),
  );
});
