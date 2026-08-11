import type { RpgExplorationProjectionV1 } from "./rpg-exploration-contract.ts";
import type {
  RpgExplorationPhysicalMaterializationV1,
} from "./rpg-exploration-materializer.ts";
import type {
  RpgExplorationPositionMessageV1,
} from "./rpg-exploration-movement-service.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export type RpgExplorationMonsterControlRequestV1 = {
  type: "exploration_monster_control";
  protocolVersion: 1;
  campaignId: string;
  sceneId: string;
  materializationRef: {
    materializationId: string;
    version: string;
    hash: string;
  };
  expectedPositionRevision: number;
  expectedGameframeCoordinationRevision: number;
  commandId: string;
  issuedAt: string;
  operation: "deploy" | "recall";
  controlTargetId: string;
};

export type AuthorizedRpgExplorationMonsterControlV1 = {
  campaignId: string;
  sceneId: string;
  commandId: string;
  issuedAt: string;
  expectedGameframeCoordinationRevision: number;
  operation: "deploy" | "recall";
  controlTargetId: string;
  targetEntityId: string;
  targetDisplayLabel: string;
};

export class RpgExplorationMonsterControlError extends Error {
  readonly code:
    | "invalid-input"
    | "stale-materialization"
    | "control-target-unavailable"
    | "control-state-conflict";

  constructor(code: RpgExplorationMonsterControlError["code"], message: string) {
    super(message);
    this.name = "RpgExplorationMonsterControlError";
    this.code = code;
  }
}

/**
 * Converts a viewer-owned roster handle into a canonical monster entity after
 * GameFrame proves the request belongs to the current authenticated exploration
 * scene/materialization. Exact player x/y is deliberately not an authority
 * input: recall is semantic roster control, and deployment materializes beside
 * the player's current stored position after the semantic commit. Coordination
 * revision remains the concurrency guard for roster state. The browser never
 * supplies a targetEntityId and cannot control another player's roster.
 */
export function authorizeRpgExplorationMonsterControl(input: {
  request: unknown;
  projection: RpgExplorationProjectionV1;
  materialization: RpgExplorationPhysicalMaterializationV1;
  position: RpgExplorationPositionMessageV1;
}): AuthorizedRpgExplorationMonsterControlV1 {
  const request = normalizeRpgExplorationMonsterControlRequest(input.request);
  const { projection, materialization, position } = input;
  if (
    request.campaignId !== projection.campaignId
    || request.sceneId !== projection.scene.sceneId
    || request.campaignId !== materialization.campaignId
    || request.sceneId !== materialization.sceneId
    || request.campaignId !== position.campaignId
    || request.sceneId !== position.sceneId
    || !sameMaterializationRef(request.materializationRef, materialization.materializationRef)
    || !sameMaterializationRef(request.materializationRef, position.materializationRef)
  ) {
    throw new RpgExplorationMonsterControlError(
      "stale-materialization",
      "Monster control refers to a stale exploration materialization.",
    );
  }

  const target = projection.viewer.monsters.find((monster) =>
    monster.controlTargetId === request.controlTargetId
  );
  if (!target) {
    throw new RpgExplorationMonsterControlError(
      "control-target-unavailable",
      "The selected roster monster is not available to the authenticated viewer.",
    );
  }
  const validState = request.operation === "deploy"
    ? target.deploymentState === "recalled"
    : target.deploymentState === "deployed"
      && target.deployedSceneId === projection.scene.sceneId;
  if (!validState) {
    throw new RpgExplorationMonsterControlError(
      "control-state-conflict",
      request.operation === "deploy"
        ? `${target.displayLabel} is not currently recalled and available to deploy.`
        : `${target.displayLabel} is not currently deployed with you in this scene.`,
    );
  }

  return {
    campaignId: request.campaignId,
    sceneId: request.sceneId,
    commandId: request.commandId,
    issuedAt: request.issuedAt,
    expectedGameframeCoordinationRevision:
      request.expectedGameframeCoordinationRevision,
    operation: request.operation,
    controlTargetId: request.controlTargetId,
    targetEntityId: target.monsterId,
    targetDisplayLabel: target.displayLabel,
  };
}

export function normalizeRpgExplorationMonsterControlRequest(
  value: unknown,
): RpgExplorationMonsterControlRequestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("Exploration monster control must be an object.");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "type",
    "protocolVersion",
    "campaignId",
    "sceneId",
    "materializationRef",
    "expectedPositionRevision",
    "expectedGameframeCoordinationRevision",
    "commandId",
    "issuedAt",
    "operation",
    "controlTargetId",
  ]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw invalid(`Exploration monster control contains unsupported fields: ${unknown.sort().join(", ")}`);
  }
  if (input.type !== "exploration_monster_control" || input.protocolVersion !== 1) {
    throw invalid("Exploration monster control protocol or type is not supported.");
  }
  if (input.operation !== "deploy" && input.operation !== "recall") {
    throw invalid("Monster control operation must be deploy or recall.");
  }
  return {
    type: "exploration_monster_control",
    protocolVersion: 1,
    campaignId: identifier(input.campaignId, "campaignId"),
    sceneId: identifier(input.sceneId, "sceneId"),
    materializationRef: normalizeMaterializationRef(input.materializationRef),
    expectedPositionRevision: revision(
      input.expectedPositionRevision,
      "expectedPositionRevision",
    ),
    expectedGameframeCoordinationRevision: revision(
      input.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    ),
    commandId: identifier(input.commandId, "commandId"),
    issuedAt: timestamp(input.issuedAt, "issuedAt"),
    operation: input.operation,
    controlTargetId: identifier(input.controlTargetId, "controlTargetId"),
  };
}

function normalizeMaterializationRef(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("materializationRef is required.");
  }
  const ref = value as Record<string, unknown>;
  const unknown = Object.keys(ref).filter(
    (key) => !["materializationId", "version", "hash"].includes(key),
  );
  if (unknown.length > 0) throw invalid("materializationRef contains unsupported fields.");
  return {
    materializationId: identifier(ref.materializationId, "materializationRef.materializationId"),
    version: identifier(ref.version, "materializationRef.version"),
    hash: identifier(ref.hash, "materializationRef.hash"),
  };
}

function sameMaterializationRef(
  left: { materializationId: string; version: string; hash: string },
  right: { materializationId: string; version: string; hash?: string },
): boolean {
  return left.materializationId === right.materializationId
    && left.version === right.version
    && left.hash === right.hash;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalid(`${label} is not a valid identifier.`);
  }
  return value;
}

function revision(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw invalid(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw invalid(`${label} must be a timestamp.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw invalid(`${label} must be a valid timestamp.`);
  return new Date(milliseconds).toISOString();
}

function invalid(message: string): RpgExplorationMonsterControlError {
  return new RpgExplorationMonsterControlError("invalid-input", message);
}
