import {
  chooseAgentDecision,
  type AgentPlayer,
} from "../agents/agent-player.ts";
import {
  PerfectTicTacToePlayer,
  ticTacToeDefinition,
  type TicTacToeAction,
  type TicTacToeObservation,
  type TicTacToeState,
} from "../games/tic-tac-toe/index.ts";
import { MatchSession, type MatchSnapshot } from "../platform/match-session.ts";
import type { MatchSnapshotStore } from "../platform/match-store.ts";

export interface PublicMatchView {
  matchId: string;
  playerIds: readonly string[];
  revision: number;
  observation: TicTacToeObservation;
  eventCount: number;
}

export interface TicTacToeMatchServiceOptions {
  store: MatchSnapshotStore<TicTacToeState, TicTacToeAction>;
  idGenerator?: () => string;
  theo?: AgentPlayer<TicTacToeAction, TicTacToeObservation>;
}

export class TicTacToeMatchService {
  readonly #store: MatchSnapshotStore<TicTacToeState, TicTacToeAction>;
  readonly #idGenerator: () => string;
  readonly #theo: AgentPlayer<TicTacToeAction, TicTacToeObservation>;

  constructor(options: TicTacToeMatchServiceOptions) {
    this.#store = options.store;
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.#theo = options.theo ?? new PerfectTicTacToePlayer("theo");
  }

  async createMatch(playerIds: readonly string[], requestedMatchId?: string): Promise<PublicMatchView> {
    const normalizedPlayers = playerIds.map((playerId) => playerId.trim());
    if (
      normalizedPlayers.length !== 2 ||
      normalizedPlayers.some((playerId) => !playerId) ||
      normalizedPlayers[0] === normalizedPlayers[1]
    ) {
      const error = new Error("Tic-tac-toe requires exactly two distinct player IDs.");
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
      definition: ticTacToeDefinition,
      playerIds: normalizedPlayers,
    });
    await this.#runTheoTurnIfNeeded(session);
    await this.#store.save(session.snapshot());
    const requestingPlayerId = normalizedPlayers.find((playerId) => playerId !== this.#theo.agentId)
      ?? normalizedPlayers[0];
    return this.#view(session, requestingPlayerId);
  }

  async view(matchId: string, playerId: string): Promise<PublicMatchView> {
    return this.#view(await this.#loadSession(matchId), playerId);
  }

  async submitAction(input: {
    matchId: string;
    playerId: string;
    actionId: string;
    expectedRevision: number;
    action: TicTacToeAction;
  }): Promise<PublicMatchView> {
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

    await this.#runTheoTurnIfNeeded(session);
    await this.#store.save(session.snapshot());
    return this.#view(session, input.playerId);
  }

  async snapshot(matchId: string): Promise<MatchSnapshot<TicTacToeState, TicTacToeAction>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) throw new Error(`Unknown match: ${matchId}`);
    return snapshot;
  }

  async replay(matchId: string): Promise<TicTacToeState> {
    return (await this.#loadSession(matchId)).replay();
  }

  async #runTheoTurnIfNeeded(
    session: MatchSession<TicTacToeState, TicTacToeAction, TicTacToeObservation>,
  ): Promise<void> {
    const snapshot = session.snapshot();
    if (!snapshot.playerIds.includes(this.#theo.agentId)) return;

    const theoObservation = session.observe(this.#theo.agentId);
    if (
      theoObservation.status.lifecycle !== "active" ||
      theoObservation.nextPlayerId !== this.#theo.agentId
    ) {
      return;
    }

    const decision = await chooseAgentDecision(
      this.#theo,
      {
        gameId: ticTacToeDefinition.gameId,
        matchId: session.matchId,
        playerId: this.#theo.agentId,
        revision: session.revision,
        observation: theoObservation,
        legalActions: theoObservation.legalActions,
      },
      `${this.#theo.agentId}:${this.#idGenerator()}`,
    );
    const theoResult = session.submit({
      actionId: decision.actionId,
      playerId: this.#theo.agentId,
      expectedRevision: session.revision,
      action: decision.action,
    });
    if (!theoResult.accepted) {
      throw new Error(`Theo decision was rejected: ${theoResult.message}`);
    }
  }

  async #loadSession(matchId: string): Promise<MatchSession<TicTacToeState, TicTacToeAction, TicTacToeObservation>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) {
      const error = new Error(`Unknown match: ${matchId}`);
      Object.assign(error, { code: "match_not_found" });
      throw error;
    }
    return new MatchSession({
      matchId,
      definition: ticTacToeDefinition,
      playerIds: snapshot.playerIds,
      snapshot,
    });
  }

  #view(
    session: MatchSession<TicTacToeState, TicTacToeAction, TicTacToeObservation>,
    playerId: string,
  ): PublicMatchView {
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
