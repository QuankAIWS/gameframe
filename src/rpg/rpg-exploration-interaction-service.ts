import type {
  RpgExplorationPhysicalMaterializationV1,
} from "./rpg-exploration-materializer.ts";
import type {
  RpgExplorationPositionMessageV1,
} from "./rpg-exploration-movement-service.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_TALK_TEXT_LENGTH = 2_000;
const CHECKPOINT_CART_ENTITY_ID = "object.checkpoint-cart";
const CHECKPOINT_CART_UNCOVER_ACTION = "Uncover the checkpoint cart.";

export type RpgExplorationInteractionRequestV1 = {
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
  interactionTargetId: string;
} & (
  | { interaction: "talk"; text: string }
  | { interaction: "travel" }
);

export type RpgExplorationTalkRequestV1 = Extract<
  RpgExplorationInteractionRequestV1,
  { interaction: "talk" }
>;
export type RpgExplorationTravelRequestV1 = Extract<
  RpgExplorationInteractionRequestV1,
  { interaction: "travel" }
>;

export type AuthorizedRpgExplorationInteractionV1 =
  | {
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
    }
  | {
      campaignId: string;
      sceneId: string;
      commandId: string;
      issuedAt: string;
      expectedGameframeCoordinationRevision: number;
      interaction: "travel";
      interactionTargetId: string;
      routeId: string;
      routeDisplayLabel: string;
    };

export type AuthorizedRpgExplorationTalkV1 = Extract<
  AuthorizedRpgExplorationInteractionV1,
  { interaction: "talk" }
>;
export type AuthorizedRpgExplorationTravelV1 = Extract<
  AuthorizedRpgExplorationInteractionV1,
  { interaction: "travel" }
>;

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
 * Converts a viewer-safe physical handle into one bounded semantic interaction
 * only after GameFrame proves the current scene/materialization/position. The
 * browser never supplies a Runtime entity ID, destination scene, or destination
 * location. Talk resolves an adjacent actor (plus the existing checkpoint-cart
 * CHANGE canary); Travel resolves only an adjacent route anchor already exposed
 * by the current viewer-safe materialization.
 */
export function authorizeRpgExplorationInteraction(input: {
  request: unknown;
  materialization: RpgExplorationPhysicalMaterializationV1;
  position: RpgExplorationPositionMessageV1;
}): AuthorizedRpgExplorationInteractionV1 {
  const request = normalizeRpgExplorationInteractionRequest(input.request);
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
  if (!target) {
    throw new RpgExplorationInteractionError(
      "interaction-target-unavailable",
      "The selected interaction target is not available in the current viewer-safe scene.",
    );
  }
  const distance = Math.abs(target.x - position.transform.x)
    + Math.abs(target.y - position.transform.y);
  if (distance !== 1) {
    throw new RpgExplorationInteractionError(
      "interaction-out-of-range",
      request.interaction === "travel"
        ? "Move next to the route edge before traveling."
        : "Move next to the interaction target first.",
    );
  }

  const common = {
    campaignId: request.campaignId,
    sceneId: request.sceneId,
    commandId: request.commandId,
    issuedAt: request.issuedAt,
    expectedGameframeCoordinationRevision: request.expectedGameframeCoordinationRevision,
    interactionTargetId: request.interactionTargetId,
  };

  if (request.interaction === "travel") {
    if (
      target.kind !== "route"
      || typeof target.semanticId !== "string"
      || target.semanticId.length === 0
    ) {
      throw new RpgExplorationInteractionError(
        "interaction-target-unavailable",
        "The selected target is not an available route in the current viewer-safe scene.",
      );
    }
    return {
      ...common,
      interaction: "travel",
      routeId: target.semanticId,
      routeDisplayLabel: target.label,
    };
  }

  const talkActor = Boolean(
    target.kind === "entity"
    && target.entityClass === "actor"
    && typeof target.semanticId === "string"
    && target.semanticId !== position.playerEntityId
  );
  const checkpointCartUncover = Boolean(
    target.kind === "object"
    && target.semanticId === CHECKPOINT_CART_ENTITY_ID
    && target.objectState === "covered"
    && request.text === CHECKPOINT_CART_UNCOVER_ACTION
  );
  if (!talkActor && !checkpointCartUncover) {
    throw new RpgExplorationInteractionError(
      "interaction-target-unavailable",
      "The selected Talk target is not available in the current viewer-safe scene.",
    );
  }
  return {
    ...common,
    interaction: "talk",
    targetEntityId: target.semanticId,
    targetDisplayLabel: target.label,
    text: request.text,
  };
}

export function authorizeRpgExplorationTalk(input: {
  request: unknown;
  materialization: RpgExplorationPhysicalMaterializationV1;
  position: RpgExplorationPositionMessageV1;
}): AuthorizedRpgExplorationTalkV1 {
  const authorized = authorizeRpgExplorationInteraction(input);
  if (authorized.interaction !== "talk") {
    throw invalid("Expected a Talk exploration interaction.");
  }
  return authorized;
}

export function normalizeRpgExplorationInteractionRequest(
  value: unknown,
): RpgExplorationInteractionRequestV1 {
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
  if (input.interaction !== "talk" && input.interaction !== "travel") {
    throw invalid("Exploration interaction must be Talk or Travel.");
  }
  const base = {
    type: "exploration_interact" as const,
    protocolVersion: 1 as const,
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
    interactionTargetId: identifier(input.interactionTargetId, "interactionTargetId"),
  };
  if (input.interaction === "travel") {
    if (input.text !== undefined) {
      throw invalid("Travel interaction does not accept browser-supplied action text.");
    }
    return { ...base, interaction: "travel" };
  }
  return {
    ...base,
    interaction: "talk",
    text: boundedText(input.text, "text", MAX_TALK_TEXT_LENGTH),
  };
}

export function normalizeRpgExplorationTalkRequest(
  value: unknown,
): RpgExplorationTalkRequestV1 {
  const request = normalizeRpgExplorationInteractionRequest(value);
  if (request.interaction !== "talk") throw invalid("Expected a Talk exploration interaction.");
  return request;
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
