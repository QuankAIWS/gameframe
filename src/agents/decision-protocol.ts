import type { AgentDecision } from "./agent-player.ts";

export const AGENT_DECISION_PROTOCOL_VERSION = "1" as const;

export interface AgentDecisionRequest<Action, Observation> {
  protocolVersion: typeof AGENT_DECISION_PROTOCOL_VERSION;
  requestId: string;
  gameId: string;
  matchId: string;
  playerId: string;
  expectedRevision: number;
  observation: Observation;
  legalActions: readonly Action[];
  deadlineAt?: string;
}

export interface AgentDecisionResponse<Action> extends AgentDecision<Action> {
  protocolVersion: typeof AGENT_DECISION_PROTOCOL_VERSION;
  requestId: string;
  playerId: string;
  expectedRevision: number;
}

export interface AgentDecisionProvider<Action, Observation> {
  decide(request: AgentDecisionRequest<Action, Observation>): Promise<unknown>;
}

export type AgentDecisionErrorCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "malformed_response"
  | "protocol_mismatch"
  | "request_mismatch"
  | "player_mismatch"
  | "stale_revision"
  | "invalid_action_id"
  | "illegal_action"
  | "duplicate_action_id"
  | "missing_context";

export class AgentDecisionError extends Error {
  readonly code: AgentDecisionErrorCode;

  constructor(code: AgentDecisionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AgentDecisionError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function parseAgentDecisionResponse<Action, Observation>(
  value: unknown,
  request: AgentDecisionRequest<Action, Observation>,
  isSameAction: (left: Action, right: Action) => boolean,
): AgentDecisionResponse<Action> {
  if (!isRecord(value)) {
    throw new AgentDecisionError("malformed_response", "Decision provider returned a non-object response.");
  }

  if (value.protocolVersion !== AGENT_DECISION_PROTOCOL_VERSION) {
    throw new AgentDecisionError("protocol_mismatch", "Decision provider used an unsupported protocol version.");
  }
  if (value.requestId !== request.requestId) {
    throw new AgentDecisionError("request_mismatch", "Decision provider response did not match the pending request.");
  }
  if (value.playerId !== request.playerId) {
    throw new AgentDecisionError("player_mismatch", "Decision provider response did not match the assigned player.");
  }
  if (value.expectedRevision !== request.expectedRevision) {
    throw new AgentDecisionError("stale_revision", "Decision provider response used a stale or future revision.");
  }

  const actionId = nonEmptyString(value.actionId);
  if (!actionId) {
    throw new AgentDecisionError("invalid_action_id", "Decision provider response requires a non-empty action ID.");
  }

  if (!("action" in value)) {
    throw new AgentDecisionError("malformed_response", "Decision provider response omitted the structured action.");
  }
  const action = value.action as Action;
  const legalAction = request.legalActions.find((candidate) => isSameAction(candidate, action));
  if (!legalAction) {
    throw new AgentDecisionError("illegal_action", "Decision provider selected an action that is not currently legal.");
  }

  const commentary = value.commentary === undefined
    ? undefined
    : nonEmptyString(value.commentary);
  if (value.commentary !== undefined && commentary === null) {
    throw new AgentDecisionError("malformed_response", "Decision provider commentary must be a non-empty string when present.");
  }

  const metadata = value.metadata === undefined
    ? undefined
    : isRecord(value.metadata)
      ? Object.freeze({ ...value.metadata })
      : null;
  if (metadata === null) {
    throw new AgentDecisionError("malformed_response", "Decision provider metadata must be an object when present.");
  }

  return {
    protocolVersion: AGENT_DECISION_PROTOCOL_VERSION,
    requestId: request.requestId,
    playerId: request.playerId,
    expectedRevision: request.expectedRevision,
    actionId,
    action: legalAction,
    ...(commentary ? { commentary } : {}),
    ...(metadata ? { metadata } : {}),
  };
}
