import { createHash } from "node:crypto";

export const RPG_EXPLORATION_PROTOCOL_VERSION = 1 as const;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const HASH_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_LABEL_LENGTH = 240;
const MAX_DESCRIPTION_LENGTH = 1_200;
const MAX_COLLECTION = 128;

type JsonRecord = Record<string, unknown>;

export type RpgExplorationMaterializationRefV1 = {
  materializationId: string;
  version: string;
  hash?: string;
};

export type RpgExplorationMaterializationIntentV1 = {
  intentId: string;
  materializationProfileId: string;
  themeId: string;
  seedPolicy: "stable-location";
  revisitPolicy: "reuse-accepted-materialization";
  requiredAssetRoleIds: string[];
  fallbackMode: "semantic-layout";
  fallbackLabel: string;
};

export type RpgExplorationEntityV1 = {
  entityId: string;
  entityClass: "actor" | "player-character" | "monster";
  displayLabel: string;
  identityStage: "self" | "descriptor" | "role" | "name";
  interactionTargetId: string;
  knownRole?: string;
  rulesProfileId?: string;
};

export type RpgExplorationObjectV1 = {
  entityId: string;
  displayLabel: string;
  interactionTargetId: string;
};

export type RpgExplorationRouteV1 = {
  routeId: string;
  destinationNodeId: string;
  destinationSceneId: string;
  destinationLocationId: string;
  destinationLabel: string;
  traversalKind: "walk";
  publicDescription: string;
};

export type RpgExplorationLandmarkV1 = {
  locationId: string;
  label: string;
  description: string;
};

export type RpgExplorationProjectionV1 = {
  protocolVersion: typeof RPG_EXPLORATION_PROTOCOL_VERSION;
  kind: "campaign.exploration_projection";
  campaignId: string;
  campaignRevision: number;
  package: {
    packageId: string;
    packageVersion: number;
    gameFamilyId: string;
    ruleset: {
      rulesetId: string;
      rulesetVersion: number;
      capabilityProfileId: string;
    };
  };
  viewer: {
    playerId: string;
    playerCharacterEntityId: string;
    rulesProfileId?: string;
  };
  scene: {
    sceneId: string;
    semanticRevision: number;
    lifecycleState: "active" | "inactive" | "closed";
    resolutionMode: "exploration";
    worldNodeId: string;
    location: {
      locationId: string;
      label: string;
      description: string;
    };
    materialization: {
      intent: RpgExplorationMaterializationIntentV1;
      acceptedRef?: RpgExplorationMaterializationRefV1;
    };
    landmarks: RpgExplorationLandmarkV1[];
    entities: RpgExplorationEntityV1[];
    objects: RpgExplorationObjectV1[];
    routes: RpgExplorationRouteV1[];
  };
};

export class RpgExplorationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpgExplorationContractError";
  }
}

export function normalizeRpgExplorationProjection(
  value: unknown,
): RpgExplorationProjectionV1 {
  const root = record(value, "exploration projection");
  knownKeys(
    root,
    ["protocolVersion", "kind", "campaignId", "campaignRevision", "package", "viewer", "scene"],
    "exploration projection",
  );
  if (root.protocolVersion !== RPG_EXPLORATION_PROTOCOL_VERSION) {
    throw invalid("exploration protocol version is not supported");
  }
  if (root.kind !== "campaign.exploration_projection") {
    throw invalid("exploration projection kind is not supported");
  }

  const packageValue = record(root.package, "package");
  knownKeys(packageValue, ["packageId", "packageVersion", "gameFamilyId", "ruleset"], "package");
  const ruleset = record(packageValue.ruleset, "package.ruleset");
  knownKeys(ruleset, ["rulesetId", "rulesetVersion", "capabilityProfileId"], "package.ruleset");

  const viewer = record(root.viewer, "viewer");
  knownKeys(viewer, ["playerId", "playerCharacterEntityId", "rulesProfileId"], "viewer");

  const scene = record(root.scene, "scene");
  knownKeys(
    scene,
    [
      "sceneId",
      "semanticRevision",
      "lifecycleState",
      "resolutionMode",
      "worldNodeId",
      "location",
      "materialization",
      "landmarks",
      "entities",
      "objects",
      "routes",
    ],
    "scene",
  );
  const lifecycleState = enumValue(
    scene.lifecycleState,
    ["active", "inactive", "closed"] as const,
    "scene.lifecycleState",
  );
  if (scene.resolutionMode !== "exploration") {
    throw invalid("scene.resolutionMode must equal exploration");
  }

  const location = record(scene.location, "scene.location");
  knownKeys(location, ["locationId", "label", "description"], "scene.location");

  const materialization = record(scene.materialization, "scene.materialization");
  knownKeys(materialization, ["intent", "acceptedRef"], "scene.materialization");

  const normalized: RpgExplorationProjectionV1 = {
    protocolVersion: RPG_EXPLORATION_PROTOCOL_VERSION,
    kind: "campaign.exploration_projection",
    campaignId: identifier(root.campaignId, "campaignId"),
    campaignRevision: nonNegativeInteger(root.campaignRevision, "campaignRevision"),
    package: {
      packageId: identifier(packageValue.packageId, "package.packageId"),
      packageVersion: positiveInteger(packageValue.packageVersion, "package.packageVersion"),
      gameFamilyId: identifier(packageValue.gameFamilyId, "package.gameFamilyId"),
      ruleset: {
        rulesetId: identifier(ruleset.rulesetId, "package.ruleset.rulesetId"),
        rulesetVersion: positiveInteger(ruleset.rulesetVersion, "package.ruleset.rulesetVersion"),
        capabilityProfileId: identifier(
          ruleset.capabilityProfileId,
          "package.ruleset.capabilityProfileId",
        ),
      },
    },
    viewer: {
      playerId: identifier(viewer.playerId, "viewer.playerId"),
      playerCharacterEntityId: identifier(
        viewer.playerCharacterEntityId,
        "viewer.playerCharacterEntityId",
      ),
      ...(viewer.rulesProfileId === undefined
        ? {}
        : { rulesProfileId: identifier(viewer.rulesProfileId, "viewer.rulesProfileId") }),
    },
    scene: {
      sceneId: identifier(scene.sceneId, "scene.sceneId"),
      semanticRevision: nonNegativeInteger(scene.semanticRevision, "scene.semanticRevision"),
      lifecycleState,
      resolutionMode: "exploration",
      worldNodeId: identifier(scene.worldNodeId, "scene.worldNodeId"),
      location: {
        locationId: identifier(location.locationId, "scene.location.locationId"),
        label: text(location.label, "scene.location.label", MAX_LABEL_LENGTH),
        description: text(
          location.description,
          "scene.location.description",
          MAX_DESCRIPTION_LENGTH,
        ),
      },
      materialization: {
        intent: normalizeIntent(materialization.intent),
        ...(materialization.acceptedRef === undefined
          ? {}
          : { acceptedRef: normalizeMaterializationRef(materialization.acceptedRef) }),
      },
      landmarks: boundedArray(scene.landmarks, "scene.landmarks").map((entry, index) =>
        normalizeLandmark(entry, `scene.landmarks[${index}]`)
      ),
      entities: boundedArray(scene.entities, "scene.entities").map((entry, index) =>
        normalizeEntity(entry, `scene.entities[${index}]`)
      ),
      objects: boundedArray(scene.objects, "scene.objects").map((entry, index) =>
        normalizeObject(entry, `scene.objects[${index}]`)
      ),
      routes: boundedArray(scene.routes, "scene.routes").map((entry, index) =>
        normalizeRoute(entry, `scene.routes[${index}]`)
      ),
    },
  };

  unique(normalized.scene.landmarks.map((entry) => entry.locationId), "scene landmark location IDs");
  unique(normalized.scene.entities.map((entry) => entry.entityId), "scene entity IDs");
  unique(normalized.scene.objects.map((entry) => entry.entityId), "scene object IDs");
  unique(normalized.scene.routes.map((entry) => entry.routeId), "scene route IDs");
  if (!normalized.scene.entities.some((entry) =>
    entry.entityId === normalized.viewer.playerCharacterEntityId && entry.identityStage === "self"
  )) {
    throw invalid("viewer player-character must appear in scene.entities as identityStage self");
  }
  const acceptedRef = normalized.scene.materialization.acceptedRef;
  if (acceptedRef) {
    const expectedId = materializationIdFor(normalized);
    if (acceptedRef.materializationId !== expectedId) {
      throw invalid(
        `scene.materialization.acceptedRef.materializationId must equal ${expectedId}`,
      );
    }
    if (acceptedRef.version !== "1") {
      throw invalid("scene.materialization.acceptedRef.version must equal 1");
    }
  }
  return normalized;
}

/**
 * Produces the shared GameFrame materialization identity for one semantic scene.
 * Viewer-specific routes, landmarks, identities, and object presence are
 * deliberately excluded so knowledge changes cannot split physical map identity.
 */
export function deriveRpgExplorationMaterializationRef(
  projectionValue: unknown,
): RpgExplorationMaterializationRefV1 {
  const projection = normalizeRpgExplorationProjection(projectionValue);
  const accepted = projection.scene.materialization.acceptedRef;
  if (accepted) return structuredClone(accepted);

  const identity = {
    protocolVersion: projection.protocolVersion,
    campaignId: projection.campaignId,
    packageId: projection.package.packageId,
    packageVersion: projection.package.packageVersion,
    gameFamilyId: projection.package.gameFamilyId,
    rulesetId: projection.package.ruleset.rulesetId,
    rulesetVersion: projection.package.ruleset.rulesetVersion,
    capabilityProfileId: projection.package.ruleset.capabilityProfileId,
    sceneId: projection.scene.sceneId,
    worldNodeId: projection.scene.worldNodeId,
    locationId: projection.scene.location.locationId,
    materializationIntent: projection.scene.materialization.intent,
  };
  const hash = createHash("sha256").update(stableJson(identity), "utf8").digest("base64url");
  return {
    materializationId: materializationIdFor(projection),
    version: "1",
    hash,
  };
}

function materializationIdFor(projection: RpgExplorationProjectionV1): string {
  return `rpg-scene:${projection.campaignId}:${projection.scene.sceneId}`;
}

function normalizeIntent(value: unknown): RpgExplorationMaterializationIntentV1 {
  const root = record(value, "scene.materialization.intent");
  knownKeys(
    root,
    [
      "intentId",
      "materializationProfileId",
      "themeId",
      "seedPolicy",
      "revisitPolicy",
      "requiredAssetRoleIds",
      "fallbackMode",
      "fallbackLabel",
    ],
    "scene.materialization.intent",
  );
  if (root.seedPolicy !== "stable-location") {
    throw invalid("scene.materialization.intent.seedPolicy must equal stable-location");
  }
  if (root.revisitPolicy !== "reuse-accepted-materialization") {
    throw invalid(
      "scene.materialization.intent.revisitPolicy must equal reuse-accepted-materialization",
    );
  }
  if (root.fallbackMode !== "semantic-layout") {
    throw invalid("scene.materialization.intent.fallbackMode must equal semantic-layout");
  }
  return {
    intentId: identifier(root.intentId, "scene.materialization.intent.intentId"),
    materializationProfileId: identifier(
      root.materializationProfileId,
      "scene.materialization.intent.materializationProfileId",
    ),
    themeId: identifier(root.themeId, "scene.materialization.intent.themeId"),
    seedPolicy: "stable-location",
    revisitPolicy: "reuse-accepted-materialization",
    requiredAssetRoleIds: identifierArray(
      root.requiredAssetRoleIds,
      "scene.materialization.intent.requiredAssetRoleIds",
    ),
    fallbackMode: "semantic-layout",
    fallbackLabel: text(
      root.fallbackLabel,
      "scene.materialization.intent.fallbackLabel",
      MAX_LABEL_LENGTH,
    ),
  };
}

function normalizeMaterializationRef(value: unknown): RpgExplorationMaterializationRefV1 {
  const root = record(value, "scene.materialization.acceptedRef");
  knownKeys(root, ["materializationId", "version", "hash"], "scene.materialization.acceptedRef");
  const result: RpgExplorationMaterializationRefV1 = {
    materializationId: identifier(
      root.materializationId,
      "scene.materialization.acceptedRef.materializationId",
    ),
    version: identifier(root.version, "scene.materialization.acceptedRef.version"),
  };
  if (root.hash !== undefined) {
    if (typeof root.hash !== "string" || !HASH_PATTERN.test(root.hash)) {
      throw invalid("scene.materialization.acceptedRef.hash is invalid");
    }
    result.hash = root.hash;
  }
  return result;
}

function normalizeEntity(value: unknown, label: string): RpgExplorationEntityV1 {
  const root = record(value, label);
  knownKeys(
    root,
    [
      "entityId",
      "entityClass",
      "displayLabel",
      "identityStage",
      "interactionTargetId",
      "knownRole",
      "rulesProfileId",
    ],
    label,
  );
  const entityClass = enumValue(
    root.entityClass,
    ["actor", "player-character", "monster"] as const,
    `${label}.entityClass`,
  );
  const identityStage = enumValue(
    root.identityStage,
    ["self", "descriptor", "role", "name"] as const,
    `${label}.identityStage`,
  );
  return {
    entityId: identifier(root.entityId, `${label}.entityId`),
    entityClass,
    displayLabel: text(root.displayLabel, `${label}.displayLabel`, MAX_LABEL_LENGTH),
    identityStage,
    interactionTargetId: identifier(root.interactionTargetId, `${label}.interactionTargetId`),
    ...(root.knownRole === undefined
      ? {}
      : { knownRole: text(root.knownRole, `${label}.knownRole`, MAX_LABEL_LENGTH) }),
    ...(root.rulesProfileId === undefined
      ? {}
      : { rulesProfileId: identifier(root.rulesProfileId, `${label}.rulesProfileId`) }),
  };
}

function normalizeObject(value: unknown, label: string): RpgExplorationObjectV1 {
  const root = record(value, label);
  knownKeys(root, ["entityId", "displayLabel", "interactionTargetId"], label);
  return {
    entityId: identifier(root.entityId, `${label}.entityId`),
    displayLabel: text(root.displayLabel, `${label}.displayLabel`, MAX_LABEL_LENGTH),
    interactionTargetId: identifier(root.interactionTargetId, `${label}.interactionTargetId`),
  };
}

function normalizeRoute(value: unknown, label: string): RpgExplorationRouteV1 {
  const root = record(value, label);
  knownKeys(
    root,
    [
      "routeId",
      "destinationNodeId",
      "destinationSceneId",
      "destinationLocationId",
      "destinationLabel",
      "traversalKind",
      "publicDescription",
    ],
    label,
  );
  if (root.traversalKind !== "walk") throw invalid(`${label}.traversalKind must equal walk`);
  return {
    routeId: identifier(root.routeId, `${label}.routeId`),
    destinationNodeId: identifier(root.destinationNodeId, `${label}.destinationNodeId`),
    destinationSceneId: identifier(root.destinationSceneId, `${label}.destinationSceneId`),
    destinationLocationId: identifier(root.destinationLocationId, `${label}.destinationLocationId`),
    destinationLabel: text(root.destinationLabel, `${label}.destinationLabel`, MAX_LABEL_LENGTH),
    traversalKind: "walk",
    publicDescription: text(
      root.publicDescription,
      `${label}.publicDescription`,
      MAX_DESCRIPTION_LENGTH,
    ),
  };
}

function normalizeLandmark(value: unknown, label: string): RpgExplorationLandmarkV1 {
  const root = record(value, label);
  knownKeys(root, ["locationId", "label", "description"], label);
  return {
    locationId: identifier(root.locationId, `${label}.locationId`),
    label: text(root.label, `${label}.label`, MAX_LABEL_LENGTH),
    description: text(root.description, `${label}.description`, MAX_DESCRIPTION_LENGTH),
  };
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function knownKeys(root: JsonRecord, allowed: string[], label: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(root).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw invalid(`${label} contains unsupported fields: ${unknown.sort().join(", ")}`);
  }
}

function boundedArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_COLLECTION) {
    throw invalid(`${label} must be an array with at most ${MAX_COLLECTION} entries`);
  }
  return value;
}

function identifierArray(value: unknown, label: string): string[] {
  const result = boundedArray(value, label).map((entry, index) =>
    identifier(entry, `${label}[${index}]`)
  );
  unique(result, label);
  return result;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalid(`${label} is not a valid identifier`);
  }
  return value;
}

function text(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw invalid(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) throw invalid(`${label} is invalid`);
  return normalized;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw invalid(`${label} must be a positive integer`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw invalid(`${label} must be a non-negative integer`);
  }
  return value;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    throw invalid(`${label} is not supported`);
  }
  return value as T[number];
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw invalid(`${label} must be unique`);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

function invalid(message: string): RpgExplorationContractError {
  return new RpgExplorationContractError(message);
}
