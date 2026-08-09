import {
  deriveRpgExplorationMaterializationRef,
  normalizeRpgExplorationProjection,
  type RpgExplorationMaterializationRefV1,
  type RpgExplorationProjectionV1,
} from "./rpg-exploration-contract.ts";

export const RPG_EXPLORATION_MATERIALIZATION_PROTOCOL_VERSION = 1 as const;

export type RpgExplorationTerrainCellV1 = {
  terrain: "floor" | "wall" | "difficult" | "objective";
};

export type RpgExplorationAnchorV1 = {
  anchorId: string;
  kind: "player" | "entity" | "object" | "landmark" | "route";
  semanticId: string;
  interactionTargetId?: string;
  label: string;
  x: number;
  y: number;
  entityClass?: "actor" | "player-character" | "monster";
  identityStage?: "self" | "descriptor" | "role" | "name";
};

export type RpgExplorationPhysicalMaterializationV1 = {
  protocolVersion: typeof RPG_EXPLORATION_MATERIALIZATION_PROTOCOL_VERSION;
  kind: "gameframe.rpg.exploration_materialization";
  campaignId: string;
  sceneId: string;
  semanticRevision: number;
  materializationRef: RpgExplorationMaterializationRefV1;
  profileId: "gameframe.rpg.semantic-scene.v1";
  themeId: string;
  map: {
    width: number;
    height: number;
    cells: RpgExplorationTerrainCellV1[];
  };
  anchors: RpgExplorationAnchorV1[];
};

export class RpgExplorationMaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpgExplorationMaterializationError";
  }
}

const CROOKED_CHECKPOINT_SCENE_ID = "scene.crooked-checkpoint";
const CROOKED_CHECKPOINT_INTENT_ID = "mm.materialization.crooked-checkpoint.v1";
const CROOKED_CHECKPOINT_PROFILE_ID = "gameframe.rpg.semantic-scene.v1";
const CROOKED_CHECKPOINT_WIDTH = 18;
const CROOKED_CHECKPOINT_HEIGHT = 14;

const STATIC_ANCHORS: Readonly<Record<string, { x: number; y: number }>> = Object.freeze({
  "location.maintenance-shed": { x: 12, y: 3 },
  "location.confiscation-cart": { x: 10, y: 8 },
  "object.checkpoint-cart": { x: 10, y: 8 },
  "route.crooked-checkpoint-west-woods": { x: 1, y: 7 },
});

/**
 * Materializes the first accepted semantic-layout profile into GameFrame-owned
 * physical geometry. The materialization identity is derived only from the
 * viewer-independent S6 contract. Viewer-specific entities, labels, objects,
 * and route disclosure are placements over that geometry and do not change it.
 */
export function materializeRpgExplorationProjection(
  projectionValue: unknown,
): RpgExplorationPhysicalMaterializationV1 {
  const projection = normalizeRpgExplorationProjection(projectionValue);
  requireCrookedCheckpointIntent(projection);

  return {
    protocolVersion: RPG_EXPLORATION_MATERIALIZATION_PROTOCOL_VERSION,
    kind: "gameframe.rpg.exploration_materialization",
    campaignId: projection.campaignId,
    sceneId: projection.scene.sceneId,
    semanticRevision: projection.scene.semanticRevision,
    materializationRef: deriveRpgExplorationMaterializationRef(projection),
    profileId: CROOKED_CHECKPOINT_PROFILE_ID,
    themeId: projection.scene.materialization.intent.themeId,
    map: crookedCheckpointMap(),
    anchors: projectAnchors(projection),
  };
}

function requireCrookedCheckpointIntent(projection: RpgExplorationProjectionV1): void {
  const intent = projection.scene.materialization.intent;
  if (projection.scene.sceneId !== CROOKED_CHECKPOINT_SCENE_ID) {
    throw new RpgExplorationMaterializationError(
      `The first semantic-layout materializer does not support scene ${projection.scene.sceneId}.`,
    );
  }
  if (
    intent.intentId !== CROOKED_CHECKPOINT_INTENT_ID
    || intent.materializationProfileId !== CROOKED_CHECKPOINT_PROFILE_ID
    || intent.fallbackMode !== "semantic-layout"
  ) {
    throw new RpgExplorationMaterializationError(
      "Crooked Checkpoint materialization intent is not supported by the current GameFrame profile.",
    );
  }
}

function crookedCheckpointMap(): RpgExplorationPhysicalMaterializationV1["map"] {
  const cells = Array.from(
    { length: CROOKED_CHECKPOINT_WIDTH * CROOKED_CHECKPOINT_HEIGHT },
    () => ({ terrain: "floor" as const }),
  );
  const set = (
    x: number,
    y: number,
    terrain: RpgExplorationTerrainCellV1["terrain"],
  ) => {
    cells[y * CROOKED_CHECKPOINT_WIDTH + x] = { terrain };
  };

  // Timber checkpoint barrier. The center gap remains traversable and becomes
  // the later interaction/authority seam rather than baked semantic state.
  for (const y of [3, 4, 5, 6, 8, 9, 10]) set(8, y, "wall");

  // Road maintenance shed mass.
  for (const [x, y] of [[11, 2], [12, 2], [11, 3], [12, 3], [11, 4], [12, 4]]) {
    set(x, y, "wall");
  }

  // Inspection shelter / citation-crate edge. Kept low and sparse so this
  // first scene proves semantic composition without pretending final art exists.
  for (const [x, y] of [[6, 4], [6, 5], [7, 4]]) set(x, y, "wall");

  // Drainage/gravel edge along the settled road.
  for (let x = 2; x <= 15; x += 1) set(x, 11, "difficult");

  // Physical westbound route mouth. Route authorization remains semantic and
  // viewer-specific; this tile merely makes the world opening visible.
  set(1, 7, "objective");

  return {
    width: CROOKED_CHECKPOINT_WIDTH,
    height: CROOKED_CHECKPOINT_HEIGHT,
    cells,
  };
}

function projectAnchors(projection: RpgExplorationProjectionV1): RpgExplorationAnchorV1[] {
  const anchors: RpgExplorationAnchorV1[] = [];

  for (const landmark of projection.scene.landmarks) {
    const position = STATIC_ANCHORS[landmark.locationId];
    if (!position) continue;
    anchors.push({
      anchorId: `landmark:${landmark.locationId}`,
      kind: "landmark",
      semanticId: landmark.locationId,
      label: landmark.label,
      ...position,
    });
  }

  const occupied = new Set<string>();
  const entitySlots = [
    { x: 9, y: 7 },
    { x: 13, y: 8 },
    { x: 11, y: 9 },
    { x: 7, y: 8 },
    { x: 14, y: 6 },
  ];
  let entitySlot = 0;
  for (const entity of projection.scene.entities) {
    const isPlayer = entity.entityId === projection.viewer.playerCharacterEntityId;
    const position = isPlayer
      ? { x: 14, y: 7 }
      : entity.entityId === "npc.warden-pell"
        ? { x: 9, y: 7 }
        : entitySlots[entitySlot++ % entitySlots.length]!;
    occupied.add(`${position.x},${position.y}`);
    anchors.push({
      anchorId: `entity:${entity.entityId}`,
      kind: isPlayer ? "player" : "entity",
      semanticId: entity.entityId,
      interactionTargetId: entity.interactionTargetId,
      label: entity.displayLabel,
      x: position.x,
      y: position.y,
      entityClass: entity.entityClass,
      identityStage: entity.identityStage,
    });
  }

  const objectSlots = [{ x: 10, y: 8 }, { x: 10, y: 9 }, { x: 13, y: 5 }];
  let objectSlot = 0;
  for (const object of projection.scene.objects) {
    let position = STATIC_ANCHORS[object.entityId] ?? objectSlots[objectSlot++ % objectSlots.length]!;
    while (occupied.has(`${position.x},${position.y}`)) {
      position = objectSlots[objectSlot++ % objectSlots.length]!;
    }
    occupied.add(`${position.x},${position.y}`);
    anchors.push({
      anchorId: `object:${object.entityId}`,
      kind: "object",
      semanticId: object.entityId,
      interactionTargetId: object.interactionTargetId,
      label: object.displayLabel,
      ...position,
    });
  }

  for (const route of projection.scene.routes) {
    const position = STATIC_ANCHORS[route.routeId];
    if (!position) continue;
    anchors.push({
      anchorId: `route:${route.routeId}`,
      kind: "route",
      semanticId: route.routeId,
      label: route.destinationLabel,
      ...position,
    });
  }

  return anchors.sort((left, right) => left.anchorId.localeCompare(right.anchorId));
}
