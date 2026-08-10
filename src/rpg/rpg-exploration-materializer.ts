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
  objectState?: string;
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

type Point = Readonly<{ x: number; y: number }>;
type AuthoredSceneProfile = Readonly<{
  sceneId: string;
  intentId: string;
  width: number;
  height: number;
  playerAnchor: Point;
  fixedAnchors: Readonly<Record<string, Point>>;
  entitySlots: readonly Point[];
  objectSlots: readonly Point[];
  map: () => RpgExplorationPhysicalMaterializationV1["map"];
}>;

const MATERIALIZATION_PROFILE_ID = "gameframe.rpg.semantic-scene.v1" as const;
const CHECKPOINT_PROFILE: AuthoredSceneProfile = Object.freeze({
  sceneId: "scene.crooked-checkpoint",
  intentId: "mm.materialization.crooked-checkpoint.v1",
  width: 18,
  height: 14,
  playerAnchor: Object.freeze({ x: 14, y: 7 }),
  fixedAnchors: Object.freeze({
    "npc.warden-pell": { x: 9, y: 7 },
    "location.maintenance-shed": { x: 12, y: 3 },
    "object.checkpoint-cart": { x: 10, y: 8 },
    "route.crooked-checkpoint-west-woods": { x: 1, y: 7 },
  }),
  entitySlots: Object.freeze([
    { x: 13, y: 8 },
    { x: 11, y: 9 },
    { x: 7, y: 8 },
    { x: 14, y: 6 },
    { x: 12, y: 7 },
    { x: 13, y: 6 },
    { x: 12, y: 9 },
    { x: 6, y: 8 },
    { x: 15, y: 8 },
    { x: 5, y: 7 },
  ]),
  objectSlots: Object.freeze([
    { x: 10, y: 9 },
    { x: 13, y: 5 },
    { x: 9, y: 9 },
    { x: 12, y: 5 },
    { x: 5, y: 8 },
    { x: 5, y: 9 },
    { x: 15, y: 6 },
    { x: 15, y: 9 },
  ]),
  map: crookedCheckpointMap,
});

const WEST_WOODS_PROFILE: AuthoredSceneProfile = Object.freeze({
  sceneId: "scene.west-woods",
  intentId: "mm.materialization.west-woods.v1",
  width: 20,
  height: 15,
  playerAnchor: Object.freeze({ x: 16, y: 7 }),
  fixedAnchors: Object.freeze({
    "npc.warden-pell": { x: 15, y: 8 },
    "route.crooked-checkpoint-west-woods": { x: 18, y: 7 },
  }),
  entitySlots: Object.freeze([
    { x: 15, y: 7 },
    { x: 16, y: 8 },
    { x: 14, y: 7 },
    { x: 14, y: 8 },
    { x: 13, y: 6 },
    { x: 13, y: 9 },
    { x: 11, y: 7 },
    { x: 10, y: 8 },
  ]),
  objectSlots: Object.freeze([
    { x: 12, y: 5 },
    { x: 12, y: 9 },
    { x: 9, y: 6 },
    { x: 9, y: 9 },
  ]),
  map: westWoodsMap,
});

const AUTHORED_SCENE_PROFILES: readonly AuthoredSceneProfile[] = Object.freeze([
  CHECKPOINT_PROFILE,
  WEST_WOODS_PROFILE,
]);

/**
 * Materializes a committed semantic scene through one of GameFrame's bounded
 * authored scene profiles. Semantic identity, entities, object state, and route
 * disclosure arrive from Runtime; GameFrame alone supplies geometry and physical
 * interaction anchors. Adding the second scene deliberately proves this shared
 * profile path without pretending to be a procedural world generator.
 */
export function materializeRpgExplorationProjection(
  projectionValue: unknown,
): RpgExplorationPhysicalMaterializationV1 {
  const projection = normalizeRpgExplorationProjection(projectionValue);
  const profile = requireAuthoredSceneProfile(projection);

  return {
    protocolVersion: RPG_EXPLORATION_MATERIALIZATION_PROTOCOL_VERSION,
    kind: "gameframe.rpg.exploration_materialization",
    campaignId: projection.campaignId,
    sceneId: projection.scene.sceneId,
    semanticRevision: projection.scene.semanticRevision,
    materializationRef: deriveRpgExplorationMaterializationRef(projection),
    profileId: MATERIALIZATION_PROFILE_ID,
    themeId: projection.scene.materialization.intent.themeId,
    map: profile.map(),
    anchors: projectAnchors(projection, profile),
  };
}

function requireAuthoredSceneProfile(
  projection: RpgExplorationProjectionV1,
): AuthoredSceneProfile {
  const intent = projection.scene.materialization.intent;
  if (
    intent.materializationProfileId !== MATERIALIZATION_PROFILE_ID
    || intent.fallbackMode !== "semantic-layout"
  ) {
    throw new RpgExplorationMaterializationError(
      `Scene ${projection.scene.sceneId} does not use the supported semantic-scene materialization profile.`,
    );
  }
  const profile = AUTHORED_SCENE_PROFILES.find((candidate) =>
    candidate.sceneId === projection.scene.sceneId
    && candidate.intentId === intent.intentId
  );
  if (!profile) {
    throw new RpgExplorationMaterializationError(
      `No accepted authored semantic-layout profile supports scene ${projection.scene.sceneId} with intent ${intent.intentId}.`,
    );
  }
  return profile;
}

function crookedCheckpointMap(): RpgExplorationPhysicalMaterializationV1["map"] {
  const map = blankMap(CHECKPOINT_PROFILE.width, CHECKPOINT_PROFILE.height);
  const set = mapSetter(map);

  for (const y of [3, 4, 5, 6, 8, 9, 10]) set(8, y, "wall");
  for (const [x, y] of [[11, 2], [12, 2], [11, 3], [12, 3], [11, 4], [12, 4]]) {
    set(x, y, "wall");
  }
  for (const [x, y] of [[6, 4], [6, 5], [7, 4]]) set(x, y, "wall");
  for (let x = 2; x <= 15; x += 1) set(x, 11, "difficult");
  set(1, 7, "objective");
  return map;
}

function westWoodsMap(): RpgExplorationPhysicalMaterializationV1["map"] {
  const map = blankMap(WEST_WOODS_PROFILE.width, WEST_WOODS_PROFILE.height);
  const set = mapSetter(map);

  for (let x = 0; x < WEST_WOODS_PROFILE.width; x += 1) {
    set(x, 0, "wall");
    set(x, WEST_WOODS_PROFILE.height - 1, "wall");
  }
  for (let y = 1; y < WEST_WOODS_PROFILE.height - 1; y += 1) {
    set(0, y, "wall");
    set(WEST_WOODS_PROFILE.width - 1, y, "wall");
  }

  for (const [x, y] of [
    [3, 2], [4, 2], [5, 2], [3, 3], [4, 3],
    [7, 10], [8, 10], [7, 11], [8, 11], [9, 11],
    [11, 2], [12, 2], [12, 3], [16, 11], [17, 11], [17, 12],
  ]) {
    set(x, y, "wall");
  }
  for (const [x, y] of [
    [4, 7], [5, 7], [6, 7], [7, 7], [8, 7],
    [10, 5], [10, 6], [10, 7], [10, 8], [10, 9],
    [13, 9], [14, 9], [15, 9],
  ]) {
    set(x, y, "difficult");
  }
  set(18, 7, "objective");
  return map;
}

function blankMap(
  width: number,
  height: number,
): RpgExplorationPhysicalMaterializationV1["map"] {
  return {
    width,
    height,
    cells: Array.from(
      { length: width * height },
      () => ({ terrain: "floor" as const }),
    ),
  };
}

function mapSetter(map: RpgExplorationPhysicalMaterializationV1["map"]) {
  return (
    x: number,
    y: number,
    terrain: RpgExplorationTerrainCellV1["terrain"],
  ) => {
    map.cells[y * map.width + x] = { terrain };
  };
}

function projectAnchors(
  projection: RpgExplorationProjectionV1,
  profile: AuthoredSceneProfile,
): RpgExplorationAnchorV1[] {
  const anchors: RpgExplorationAnchorV1[] = [];
  const unavailable = reservedAnchorPositions(projection, profile);

  for (const landmark of projection.scene.landmarks) {
    const position = profile.fixedAnchors[landmark.locationId];
    if (!position) continue;
    anchors.push({
      anchorId: `landmark:${landmark.locationId}`,
      kind: "landmark",
      semanticId: landmark.locationId,
      label: landmark.label,
      ...position,
    });
  }

  for (const entity of projection.scene.entities) {
    const isPlayer = entity.entityId === projection.viewer.playerCharacterEntityId;
    const position = isPlayer
      ? profile.playerAnchor
      : profile.fixedAnchors[entity.entityId]
        ?? claimAvailableSlot(profile.entitySlots, unavailable, profile.sceneId, `entity ${entity.entityId}`);
    unavailable.add(positionKey(position));
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

  for (const object of projection.scene.objects) {
    const position = profile.fixedAnchors[object.entityId]
      ?? claimAvailableSlot(profile.objectSlots, unavailable, profile.sceneId, `object ${object.entityId}`);
    unavailable.add(positionKey(position));
    anchors.push({
      anchorId: `object:${object.entityId}`,
      kind: "object",
      semanticId: object.entityId,
      interactionTargetId: object.interactionTargetId,
      label: objectLabel(object.displayLabel, object.state),
      objectState: object.state,
      ...position,
    });
  }

  for (const route of projection.scene.routes) {
    const position = profile.fixedAnchors[route.routeId];
    if (!position) continue;
    anchors.push({
      anchorId: `route:${route.routeId}`,
      kind: "route",
      semanticId: route.routeId,
      interactionTargetId: `route:${route.routeId}`,
      label: route.destinationLabel,
      ...position,
    });
  }

  return anchors.sort((left, right) => left.anchorId.localeCompare(right.anchorId));
}

function objectLabel(displayLabel: string, state: string): string {
  if (state === "covered") return `${displayLabel} · covered`;
  if (state === "uncovered") return `${displayLabel} · uncovered`;
  return displayLabel;
}

function reservedAnchorPositions(
  projection: RpgExplorationProjectionV1,
  profile: AuthoredSceneProfile,
): Set<string> {
  const reserved = new Set<string>();
  for (const landmark of projection.scene.landmarks) reserveFixed(reserved, profile, landmark.locationId);
  for (const route of projection.scene.routes) reserveFixed(reserved, profile, route.routeId);
  for (const object of projection.scene.objects) reserveFixed(reserved, profile, object.entityId);
  for (const entity of projection.scene.entities) {
    if (entity.entityId === projection.viewer.playerCharacterEntityId) {
      reserved.add(positionKey(profile.playerAnchor));
    } else {
      reserveFixed(reserved, profile, entity.entityId);
    }
  }
  return reserved;
}

function reserveFixed(reserved: Set<string>, profile: AuthoredSceneProfile, semanticId: string): void {
  const position = profile.fixedAnchors[semanticId];
  if (position) reserved.add(positionKey(position));
}

function claimAvailableSlot(
  slots: readonly Point[],
  unavailable: Set<string>,
  sceneId: string,
  label: string,
): Point {
  for (const slot of slots) {
    if (unavailable.has(positionKey(slot))) continue;
    unavailable.add(positionKey(slot));
    return slot;
  }
  throw new RpgExplorationMaterializationError(
    `${sceneId} has no remaining physical anchor slots for ${label}.`,
  );
}

function positionKey(position: Point): string {
  return `${position.x},${position.y}`;
}
