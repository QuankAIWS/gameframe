import {
  AGENT_DECISION_PROTOCOL_VERSION,
  type AgentDecisionProvider,
  type AgentDecisionRequest,
  type AgentDecisionResponse,
} from "./decision-protocol.ts";

export type MockDecisionProviderMode =
  | "deterministic"
  | "scripted"
  | "seeded-random"
  | "delayed"
  | "unavailable"
  | "malformed"
  | "illegal"
  | "duplicate"
  | "stale"
  | "mismatched-request"
  | "mismatched-player";

export interface MockDecisionProviderOptions<Action> {
  mode?: MockDecisionProviderMode;
  scriptedActions?: readonly Action[];
  seed?: number;
  delayMs?: number;
  illegalAction?: Action;
  commentary?: string;
}

export class MockDecisionProvider<Action, Observation>
  implements AgentDecisionProvider<Action, Observation>
{
  readonly mode: MockDecisionProviderMode;
  readonly requests: AgentDecisionRequest<Action, Observation>[] = [];
  readonly #scriptedActions: Action[];
  readonly #delayMs: number;
  readonly #illegalAction?: Action;
  readonly #commentary?: string;
  #randomState: number;
  #responseCount = 0;

  constructor(options: MockDecisionProviderOptions<Action> = {}) {
    this.mode = options.mode ?? "deterministic";
    this.#scriptedActions = [...(options.scriptedActions ?? [])];
    this.#delayMs = options.delayMs ?? 25;
    this.#illegalAction = options.illegalAction;
    this.#commentary = options.commentary;
    this.#randomState = (options.seed ?? 1) >>> 0;
  }

  async decide(request: AgentDecisionRequest<Action, Observation>): Promise<unknown> {
    this.requests.push({ ...request, legalActions: [...request.legalActions] });
    this.#responseCount += 1;

    if (this.mode === "unavailable") {
      throw new Error("Mock decision provider is unavailable.");
    }
    if (this.mode === "delayed") {
      await new Promise((resolve) => setTimeout(resolve, this.#delayMs));
    }
    if (this.mode === "malformed") {
      return {
        protocolVersion: AGENT_DECISION_PROTOCOL_VERSION,
        requestId: request.requestId,
        playerId: request.playerId,
        expectedRevision: request.expectedRevision,
        actionId: "",
      };
    }

    const action = this.#selectAction(request);
    const response: AgentDecisionResponse<Action> = {
      protocolVersion: AGENT_DECISION_PROTOCOL_VERSION,
      requestId: this.mode === "mismatched-request"
        ? `${request.requestId}:mismatch`
        : request.requestId,
      playerId: this.mode === "mismatched-player"
        ? `${request.playerId}:mismatch`
        : request.playerId,
      expectedRevision: this.mode === "stale"
        ? Math.max(0, request.expectedRevision - 1)
        : request.expectedRevision,
      actionId: this.mode === "duplicate"
        ? "mock:duplicate-action"
        : `mock:${this.#responseCount}`,
      action,
      ...(this.#commentary ? { commentary: this.#commentary } : {}),
      metadata: { mockMode: this.mode },
    };
    return response;
  }

  #selectAction(request: AgentDecisionRequest<Action, Observation>): Action {
    if (this.mode === "illegal") {
      return this.#illegalAction ?? ({ type: "mock-illegal-action" } as Action);
    }
    if (this.mode === "scripted" && this.#scriptedActions.length > 0) {
      return this.#scriptedActions.shift()!;
    }
    if (this.mode === "seeded-random") {
      const index = Math.floor(this.#nextRandom() * request.legalActions.length);
      return request.legalActions[index]!;
    }
    return request.legalActions[0]!;
  }

  #nextRandom(): number {
    this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#randomState / 0x1_0000_0000;
  }
}
