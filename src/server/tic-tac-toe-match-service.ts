import type { AgentPlayer } from "../agents/agent-player.ts";
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
  scribblesAgent?: AgentPlayer<TicTacToeAction, TicTacToeObservation>;
}

export class TicTacToeMatchService {
  readonly #store: MatchSnapshotStore<TicTacToeState, TicTacToeAction>;
  readonly #idGenerator: () => string;
  readonly #scribblesAgent: AgentPlayer<TicTacToeAction, TicTacToeObservation>;

  constructor(options: TicTacToeMatchServiceOptions) {
    this.#store = options.store;
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.#scribblesAgent = options.scribblesAgent ?? new PerfectTicTacToePlayer("scribbles");
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
    await this.#runScribblesTurnIfNeeded(session);
    await this.#store.save(session.snapshot());
    const requestingPlayerId = normalizedPlayers.find(
      (playerId) => playerId !== this.#scribblesAgent.agentId,
    ) ?? normalizedPlayers[0];
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

    await this.#runScribblesTurnIfNeeded(session);
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

  async #runScribblesTurnIfNeeded(
    session: MatchSession<TicTacToeState, TicTacToeAction, TicTacToeObservation>,
  ): Promise<void> {
    const snapshot = session.snapshot();
    if (!snapshot.playerIds.includes(this.#scribblesAgent.agentId)) return;

    const scribblesObservation = session.observe(this.#scribblesAgent.agentId);
    if (
      scribblesObservation.status.lifecycle !== "active" ||
      scribblesObservation.nextPlayerId !== this.#scribblesAgent.agentId
    ) {
      return;
    }

    const action = await this.#scribblesAgent.chooseAction({
      observation: scribblesObservation,
      legalActions: scribblesObservation.legalActions,
    });
    const scribblesResult = session.submit({
      actionId: `${this.#scribblesAgent.agentId}:${this.#idGenerator()}`,
      playerId: this.#scribblesAgent.agentId,
      expectedRevision: session.revision,
      action,
    });
    if (!scribblesResult.accepted) {
      throw new Error(`Deterministic Scribbles action was rejected: ${scribblesResult.message}`);
    }
  }

  async #loadSession(
    matchId: string,
  ): Promise<MatchSession<TicTacToeState, TicTacToeAction, TicTacToeObservation>> {
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
