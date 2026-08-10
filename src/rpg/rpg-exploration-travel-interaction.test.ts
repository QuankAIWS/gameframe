import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { RpgExplorationProjectionV1 } from "./rpg-exploration-contract.ts";
import {
  authorizeRpgExplorationInteraction,
  normalizeRpgExplorationInteractionRequest,
  RpgExplorationInteractionError,
} from "./rpg-exploration-interaction-service.ts";
import { materializeRpgExplorationProjection } from "./rpg-exploration-materializer.ts";
import type { RpgExplorationPositionMessageV1 } from "./rpg-exploration-movement-service.ts";

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);

function projection(): RpgExplorationProjectionV1 {
  return JSON.parse(readFileSync(fixturePath, "utf8")).projection as RpgExplorationProjectionV1;
}

function routeRequest(semantic: RpgExplorationProjectionV1, positionRevision: number) {
  const materialization = materializeRpgExplorationProjection(semantic);
  const route = materialization.anchors.find((anchor) => anchor.kind === "route");
  if (!route?.interactionTargetId) throw new Error("fixture route is not interactive");
  return {
    type: "exploration_interact" as const,
    protocolVersion: 1 as const,
    campaignId: semantic.campaignId,
    sceneId: semantic.scene.sceneId,
    materializationRef: materialization.materializationRef,
    expectedPositionRevision: positionRevision,
    expectedGameframeCoordinationRevision: 12,
    commandId: "command:travel-west",
    issuedAt: "2026-08-10T15:20:00.000Z",
    interaction: "travel" as const,
    interactionTargetId: route.interactionTargetId,
  };
}

function positionAdjacentToRoute(semantic: RpgExplorationProjectionV1): RpgExplorationPositionMessageV1 {
  const materialization = materializeRpgExplorationProjection(semantic);
  const route = materialization.anchors.find((anchor) => anchor.kind === "route");
  if (!route) throw new Error("fixture route is missing");
  return {
    type: "exploration_position",
    protocolVersion: 1,
    campaignId: semantic.campaignId,
    sceneId: semantic.scene.sceneId,
    playerEntityId: semantic.viewer.playerCharacterEntityId,
    materializationRef: materialization.materializationRef,
    positionRevision: 7,
    transform: { x: route.x + 1, y: route.y, facing: "west" },
    moved: true,
  };
}

test("Travel resolves only the adjacent viewer-safe route handle to Runtime route identity", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const position = positionAdjacentToRoute(semantic);
  const request = routeRequest(semantic, position.positionRevision);

  assert.deepEqual(authorizeRpgExplorationInteraction({ request, materialization, position }), {
    campaignId: semantic.campaignId,
    sceneId: semantic.scene.sceneId,
    commandId: "command:travel-west",
    issuedAt: "2026-08-10T15:20:00.000Z",
    expectedGameframeCoordinationRevision: 12,
    interaction: "travel",
    interactionTargetId: request.interactionTargetId,
    routeId: "route.crooked-checkpoint-west-woods",
    routeDisplayLabel: "West Woods Route",
  });
});

test("Travel rejects stale distance and browser-supplied destination or action text", () => {
  const semantic = projection();
  const materialization = materializeRpgExplorationProjection(semantic);
  const position = positionAdjacentToRoute(semantic);
  const request = routeRequest(semantic, position.positionRevision);

  assert.throws(
    () => authorizeRpgExplorationInteraction({
      request,
      materialization,
      position: {
        ...position,
        transform: { x: position.transform.x + 3, y: position.transform.y, facing: "west" },
      },
    }),
    (error: unknown) => error instanceof RpgExplorationInteractionError
      && error.code === "interaction-out-of-range",
  );

  for (const injected of [
    { destinationSceneId: "scene.west-woods" },
    { text: "Go west." },
  ]) {
    assert.throws(
      () => normalizeRpgExplorationInteractionRequest({ ...request, ...injected }),
      (error: unknown) => error instanceof RpgExplorationInteractionError
        && error.code === "invalid-input",
    );
  }
});
