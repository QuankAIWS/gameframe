import type {
  RpgExplorationPhysicalMaterializationV1,
} from "./rpg-exploration-materializer.ts";
import type {
  RpgExplorationPositionMessageV1,
} from "./rpg-exploration-movement-service.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_TALK_TEXT_LENGTH = 2_000;

export type RpgExplorationTalkRequestV1 = {
  type: "exploration_interact";
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
  interaction: "talk";
  interactionTargetId: string;
  text: string;
};

export type AuthorizedRpgExplorationTalkV1 = {
  campaignId: string;
  sceneId: string;
  commandId: string;
  issuedAt: string;
  expectedGameframeCoordinationRevision: number;
  interaction: "talk";
  interactionTargetId: string;
  targetEntityId: string;
  targetDisplayLabel: string;
  text: string;
};

export class RpgExplorationInteractionError extends Error {
  readonly code:
    | "invalid-input"
    | "stale-materialization"
    | "position-revision-conflict"
    | "interaction-target-unavailable"
    | "interaction-out-of-range";

  constructor(code: RpgExplorationInteractionError["code"], message: string) {
    super(message);
    this.name = "RpgExplorationInteractionError";
    this.code = code;
  }
}

/**
 * Converts a viewer-safe materialization target into a canonical semantic entity
 * only after GameFrame has proved current physical eligibility.
 *
 * The request deliberately contains no targetEntityId field. Browsers may select
 * only an interactionTargetId that already exists in the authenticated viewer's
 * current accepted materialization.
 */
export function authorizeRpgExplorationTalk(input: {
  request: unknown;
  materialization: RpgExplorationPhysicalMaterializationV1;
  position: RpgExplorationPositionMessageV1;
}): AuthorizedRpgExplorationTalkV1 {
  const request = normalizeRpgExplorationTalkRequest(input.request);
  const { materialization, position } = input;
  if (
    request.campaignId !== materialization.campaignId
    || request.sceneId !== materialization.sceneId
    || request.campaignId !== position.campaignId
    || request.sceneId !== position.sceneId
    || !sameMaterializationRef(request.materializationRef, materialization.materializationRef)
    || !sameMaterializationRef(request.materializationRef, position.materializationRef)
  ) {
    throw new RpgExplorationInteractionError(
      "stale-materialization",
      "Exploration interaction refers to a stale physical materialization.",
    );
  }
  if (request.expectedPositionRevision !== position.positionRevision) {
    throw new RpgExplorationInteractionError(
      "position-revision-conflict",
      `Expected exploration position revision ${request.expectedPositionRevision}, but current revision is ${position.positionRevision}.`,
    );
  }

  const target = materialization.anchors.find((anchor) =>
    anchor.interactionTargetId === request.interactionTargetId
  );
  if (
    !target
    || target.kind !== "entity"
    || typeof target.semanticId !== "string"
    || target.semanticId === position.playerEntityId
  ) {
    throw new RpgExplorationInteractionError(
      "interaction-target-unavailable",
      "The selected Talk target is not available in the current viewer-safe scene.",
    );
  }
  const distance = Math.abs(target.x - position.transform.x)
    + Math.abs(target.y - position.transform.y);
  if (distance !== 1) {
    throw new RpgExplorationInteractionError(
      "interaction-out-of-range",
      "Move next to the character before talking.",
    );
  }

  return {
    campaignId: request.campaignId,
    sceneId: request.sceneId,
    commandId: request.commandId,
    issuedAt: request.issuedAt,
    expectedGameframeCoordinationRevision:
      request.expectedGameframeCoordinationRevision,
    interaction: "talk",
    interactionTargetId: request.interactionTargetId,
    targetEntityId: target.semanticId,
    targetDisplayLabel: target.label,
    text: request.text,
  };
}

export function normalizeRpgExplorationTalkRequest(
  value: unknown,
): RpgExplorationTalkRequestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("Exploration interaction must be an object.");
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
    "interaction",
    "interactionTargetId",
    "text",
  ]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw invalid(`Exploration interaction contains unsupported fields: ${unknown.sort().join(", ")}`);
  }
  if (input.type !== "exploration_interact" || input.protocolVersion !== 1) {
    throw invalid("Exploration interaction protocol or type is not supported.");
  }
  if (input.interaction !== "talk") {
    throw invalid("Only Talk is supported by the current exploration interaction slice.");
  }
  const materializationRef = normalizeMaterializationRef(input.materializationRef);
  return {
    type: "exploration_interact",
    protocolVersion: 1,
    campaignId: identifier(input.campaignId, "campaignId"),
    sceneId: identifier(input.sceneId, "sceneId"),
    materializationRef,
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
    interaction: "talk",
    interactionTargetId: identifier(input.interactionTargetId, "interactionTargetId"),
    text: boundedText(input.text, "text", MAX_TALK_TEXT_LENGTH),
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
  right: { materializationId: string; version: string; hash: string },
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

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw invalid(`${label} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw invalid(`${label} must contain from 1 through ${maximum} characters.`);
  }
  return normalized;
}

function invalid(message: string): RpgExplorationInteractionError {
  return new RpgExplorationInteractionError("invalid-input", message);
}
