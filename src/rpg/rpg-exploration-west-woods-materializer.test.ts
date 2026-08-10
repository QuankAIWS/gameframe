import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { materializeRpgExplorationProjection } from "./rpg-exploration-materializer.ts";

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);

function westWoodsProjection(): any {
  const projection = JSON.parse(readFileSync(fixturePath, "utf8")).projection;
  projection.campaignRevision += 10;
  projection.scene = {
    ...projection.scene,
    sceneId: "scene.west-woods",
    semanticRevision: 1,
    worldNodeId: "world.node.west-woods",
    location: {
      locationId: "location.west-woods",
      label: "West Woods Route",
      description: "A lightly used woodland route threads between old trees, brush, and drainage cuts west of the checkpoint.",
    },
    materialization: {
      intent: {
        ...projection.scene.materialization.intent,
        intentId: "mm.materialization.west-woods.v1",
        fallbackLabel: "Woodland route, tree masses, brush, drainage cuts, and the eastbound checkpoint return",
      },
    },
    landmarks: [],
    objects: [],
    routes: [{
      routeId: "route.crooked-checkpoint-west-woods",
      destinationNodeId: "world.node.crooked-checkpoint",
      destinationSceneId: "scene.crooked-checkpoint",
      destinationLocationId: "location.settled-road-checkpoint",
      destinationLabel: "The Crooked Checkpoint",
      traversalKind: "walk",
      publicDescription: "The marked woodland path returns east to the checkpoint road.",
    }],
  };
  return projection;
}

test("West Woods uses the shared authored scene materializer and exposes the return route", () => {
  const materialization = materializeRpgExplorationProjection(westWoodsProjection());
  assert.equal(materialization.sceneId, "scene.west-woods");
  assert.equal(materialization.profileId, "gameframe.rpg.semantic-scene.v1");
  assert.equal(materialization.map.width, 20);
  assert.equal(materialization.map.height, 15);
  assert.ok(materialization.map.cells.some((cell) => cell.terrain === "wall"));
  assert.ok(materialization.map.cells.some((cell) => cell.terrain === "difficult"));
  assert.ok(materialization.map.cells.some((cell) => cell.terrain === "objective"));

  const player = materialization.anchors.find((anchor) => anchor.kind === "player");
  assert.deepEqual({ x: player?.x, y: player?.y }, { x: 16, y: 7 });
  const pell = materialization.anchors.find((anchor) => anchor.semanticId === "npc.warden-pell");
  assert.deepEqual({ x: pell?.x, y: pell?.y }, { x: 15, y: 8 });
  const route = materialization.anchors.find((anchor) =>
    anchor.semanticId === "route.crooked-checkpoint-west-woods"
  );
  assert.deepEqual(
    { x: route?.x, y: route?.y, interactionTargetId: route?.interactionTargetId },
    { x: 18, y: 7, interactionTargetId: "route:route.crooked-checkpoint-west-woods" },
  );
});
