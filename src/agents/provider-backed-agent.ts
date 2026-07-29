import {
  chooseAgentDecision,
  type AgentDecision,
  type AgentDecisionContext,
  type AgentPlayer,
} from "./agent-player.ts";
import {
  AGENT_DECISION_PROTOCOL_VERSION,
  AgentDecisionError,
  parseAgentDecisionResponse,
  type AgentDecisionProvider,
  type AgentDecisionRequest,
} from "./decision-protocol.ts";

export interface ProviderBackedAgentOptions<Action, Observation> {
  agentId: string;
  gameId: string;
  provider: AgentDecisionProvider<Action, Observation>;
  isSameAction(left: Action, right: Action): boolean;
  timeoutMs?: number;
  fallback?: AgentPlayer<Action, Observation>;
  requestIdGenerator?: () => string;
  fallbackActionIdGenerator?: () => string;
  now?: () => number;
}

export class ProviderBackedAgentPlayer<Action, Observation>
  implements AgentPlayer<Action, Observation>
{
  readonly agentId: string;
  readonly #gameId: string;
  readonly #provider: AgentDecisionProvider<Action, Observation>;
  readonly #isSameAction: (left: Action, right: Action) => boolean;
  readonly #timeoutMs: number;
  readonly #fallback?: AgentPlayer<Action, Observation>;
  readonly #requestIdGenerator: () => string;
  readonly #fallbackActionIdGenerator: () => string;
  readonly #now: () => number;
  readonly #seenActionIds = new Set<string>();

  constructor(options: ProviderBackedAgentOptions<Action, Observation>) {
    this.agentId = options.agentId.trim();
    this.#gameId = options.gameId.trim();
    this.#provider = options.provider;
    this.#isSameAction = options.isSameAction;
    this.#timeoutMs = options.timeoutMs ?? 5_000;
    this.#fallback = options.fallback;
    this.#requestIdGenerator = options.requestIdGenerator ?? (() => crypto.randomUUID());
    this.#fallbackActionIdGenerator = options.fallbackActionIdGenerator ?? (() => crypto.randomUUID());
    this.#now = options.now ?? Date.now;

    if (!this.agentId || !this.#gameId) {
      throw new Error("Provider-backed agents require non-empty agent and game IDs.");
    }
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new Error("Provider timeout must be a positive finite number.");
    }
    if (this.#fallback && this.#fallback.agentId !== this.agentId) {
      throw new Error("Provider fallback must represent the same stable agent identity.");
    }
  }

  async chooseAction(context: AgentDecisionContext<Action, Observation>): Promise<Action> {
    return (await this.chooseDecision(context)).action;
  }

  async chooseDecision(
    context: AgentDecisionContext<Action, Observation>,
  ): Promise<AgentDecision<Action>> {
    const request = this.#createRequest(context);
    try {
      const rawResponse = await this.#requestDecision(request);
      const response = parseAgentDecisionResponse(rawResponse, request, this.#isSameAction);
      if (this.#seenActionIds.has(response.actionId)) {
        throw new AgentDecisionError(
          "duplicate_action_id",
          `Decision provider reused action ID ${response.actionId}.`,
        );
      }
      this.#seenActionIds.add(response.actionId);
      return {
        actionId: response.actionId,
        action: response.action,
        ...(response.commentary ? { commentary: response.commentary } : {}),
        ...(response.metadata ? { metadata: response.metadata } : {}),
      };
    } catch (caught) {
      if (!this.#fallback) throw caught;
      return await chooseAgentDecision(
        this.#fallback,
        context,
        `${this.agentId}:fallback:${this.#fallbackActionIdGenerator()}`,
      );
    }
  }

  #createRequest(
    context: AgentDecisionContext<Action, Observation>,
  ): AgentDecisionRequest<Action, Observation> {
    const matchId = context.matchId?.trim();
    const playerId = context.playerId?.trim();
    const revision = context.revision;
    if (!matchId || !playerId || !Number.isInteger(revision) || revision! < 0) {
      throw new AgentDecisionError(
        "missing_context",
        "Provider-backed decisions require match ID, player ID, and non-negative revision context.",
      );
    }
    if (playerId !== this.agentId) {
      throw new AgentDecisionError(
        "player_mismatch",
        "Provider-backed agent cannot decide for a different player identity.",
      );
    }
    if (context.gameId && context.gameId !== this.#gameId) {
      throw new AgentDecisionError(
        "protocol_mismatch",
        "Provider-backed agent was invoked for an unexpected game.",
      );
    }
    if (context.legalActions.length === 0) {
      throw new AgentDecisionError("illegal_action", "Provider-backed agent has no legal action to select.");
    }

    const deadlineAt = context.deadlineAt
      ?? new Date(this.#now() + this.#timeoutMs).toISOString();
    return {
      protocolVersion: AGENT_DECISION_PROTOCOL_VERSION,
      requestId: this.#requestIdGenerator(),
      gameId: this.#gameId,
      matchId,
      playerId,
      expectedRevision: revision!,
      observation: context.observation,
      legalActions: [...context.legalActions],
      deadlineAt,
    };
  }

  async #requestDecision(
    request: AgentDecisionRequest<Action, Observation>,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new AgentDecisionError(
          "provider_timeout",
          `Decision provider exceeded the ${this.#timeoutMs} ms deadline.`,
        ));
      }, this.#timeoutMs);
    });

    try {
      const providerCall = Promise.resolve()
        .then(() => this.#provider.decide(request))
        .catch((cause) => {
          if (cause instanceof AgentDecisionError) throw cause;
          throw new AgentDecisionError(
            "provider_unavailable",
            "Decision provider failed before returning a response.",
            { cause },
          );
        });
      return await Promise.race([providerCall, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
