import {
  chooseAgentDecision,
  type AgentPlayer,
} from "../agents/agent-player.ts";
import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import {
  DeterministicTacticalMovementPlayer,
  tacticalMovementDefinition,
  type TacticalMovementAction,
  type TacticalMovementObservation,
  type TacticalMovementState,
} from "../games/tactical-core/index.ts";
import { MatchSession, type MatchSnapshot } from "../platform/match-session.ts";
import type { MatchSnapshotStore } from "../platform/match-store.ts";

export interface PublicTacticalMovementMatchView {
  matchId: string;
  playerIds: readonly string[];
  revision: number;
  observation: TacticalMovementObservation;
  eventCount: number;
}

export interface TacticalMovementMatchServiceOptions {
  store: MatchSnapshotStore<TacticalMovementState, TacticalMovementAction>;
  idGenerator?: () => string;
  bot?: AgentPlayer<TacticalMovementAction, TacticalMovementObservation>;
}

export class TacticalMovementMatchService {
  readonly #store: MatchSnapshotStore<TacticalMovementState, TacticalMovementAction>;
  readonly #idGenerator: () => string;
  readonly #bot: AgentPlayer<TacticalMovementAction, TacticalMovementObservation>;

  constructor(options: TacticalMovementMatchServiceOptions) {
    this.#store = options.store;
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.#bot = options.bot ?? new DeterministicTacticalMovementPlayer(GAMEFRAME_BOT_PLAYER_ID);
  }

  async createMatch(
    playerIds: readonly string[],
    requestedMatchId?: string,
  ): Promise<PublicTacticalMovementMatchView> {
    const normalizedPlayers = playerIds.map((playerId) => playerId.trim());
    if (
      normalizedPlayers.length !== 2
      || normalizedPlayers.some((playerId) => !playerId)
      || normalizedPlayers[0] === normalizedPlayers[1]
    ) {
      const error = new Error("The tactical movement canary requires exactly two distinct player IDs.");
      Object.assign(error, { code: "invalid_players" });
      throw error;
    }

    const matchId = requestedMatchId ?? this.#idGenerator();
    if (await this.#store.load(matchId)) {
      const error = new Error(`Match already exists: ${matchId}`);
      Object.assign(error, { code: "match_exists" });
      throw error;
    }

    const session = new MatchSession({
      matchId,
      definition: tacticalMovementDefinition,
      playerIds: normalizedPlayers,
    });
    await this.#runBotTurnIfNeeded(session);
    await this.#store.save(session.snapshot());
    const requestingPlayerId = normalizedPlayers.find((playerId) => playerId !== this.#bot.agentId)
      ?? normalizedPlayers[0];
    return this.#view(session, requestingPlayerId);
  }

  async view(matchId: string, playerId: string): Promise<PublicTacticalMovementMatchView> {
    return this.#view(await this.#loadSession(matchId), playerId);
  }

  async submitAction(input: {
    matchId: string;
    playerId: string;
    actionId: string;
    expectedRevision: number;
    action: TacticalMovementAction;
  }): Promise<PublicTacticalMovementMatchView> {
    const session = await this.#loadSession(input.matchId);
    const result = session.submit({
      actionId: input.actionId,
      playerId: input.playerId,
      expectedRevision: input.expectedRevision,
      action: input.action,
    });
    if (!result.accepted) {
      await this.#store.save(session.snapshot());
      const error = new Error(result.message);
      Object.assign(error, { code: result.code, revision: result.revision });
      throw error;
    }

    await this.#runBotTurnIfNeeded(session);
    await this.#store.save(session.snapshot());
    return this.#view(session, input.playerId);
  }

  async snapshot(
    matchId: string,
  ): Promise<MatchSnapshot<TacticalMovementState, TacticalMovementAction>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) throw new Error(`Unknown match: ${matchId}`);
    return snapshot;
  }

  async replay(matchId: string): Promise<TacticalMovementState> {
    return (await this.#loadSession(matchId)).replay();
  }

  async #runBotTurnIfNeeded(
    session: MatchSession<TacticalMovementState, TacticalMovementAction, TacticalMovementObservation>,
  ): Promise<void> {
    const snapshot = session.snapshot();
    if (!snapshot.playerIds.includes(this.#bot.agentId)) return;

    const observation = session.observe(this.#bot.agentId);
    if (
      observation.status.lifecycle !== "active"
      || observation.activePlayerId !== this.#bot.agentId
    ) {
      return;
    }

    const decision = await chooseAgentDecision(
      this.#bot,
      {
        gameId: tacticalMovementDefinition.gameId,
        matchId: session.matchId,
        playerId: this.#bot.agentId,
        revision: session.revision,
        observation,
        legalActions: observation.legalActions,
      },
      `${this.#bot.agentId}:${this.#idGenerator()}`,
    );
    const result = session.submit({
      actionId: decision.actionId,
      playerId: this.#bot.agentId,
      expectedRevision: session.revision,
      action: decision.action,
    });
    if (!result.accepted) {
      throw new Error(`ArenaBot tactical movement decision was rejected: ${result.message}`);
    }
  }

  async #loadSession(
    matchId: string,
  ): Promise<MatchSession<TacticalMovementState, TacticalMovementAction, TacticalMovementObservation>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) {
      const error = new Error(`Unknown match: ${matchId}`);
      Object.assign(error, { code: "match_not_found" });
      throw error;
    }
    return new MatchSession({
      matchId,
      definition: tacticalMovementDefinition,
      playerIds: snapshot.playerIds,
      snapshot,
    });
  }

  #view(
    session: MatchSession<TacticalMovementState, TacticalMovementAction, TacticalMovementObservation>,
    playerId: string,
  ): PublicTacticalMovementMatchView {
    const snapshot = session.snapshot();
    return {
      matchId: session.matchId,
      playerIds: [...snapshot.playerIds],
      revision: session.revision,
      observation: session.observe(playerId),
      eventCount: snapshot.events.length,
    };
  }
}
