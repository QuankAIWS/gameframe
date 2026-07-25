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

  async createHumanVsTheo(humanPlayerId: string, requestedMatchId?: string): Promise<PublicMatchView> {
    if (!humanPlayerId || humanPlayerId === "theo") {
      throw new Error("A distinct human player ID is required.");
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
      playerIds: [humanPlayerId, "theo"],
    });
    await this.#store.save(session.snapshot());
    return this.#view(session, humanPlayerId);
  }

  async view(matchId: string, playerId: string): Promise<PublicMatchView> {
    return this.#view(await this.#loadSession(matchId), playerId);
  }

  async submitHumanAction(input: {
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

    const theoObservation = session.observe("theo");
    if (theoObservation.status.lifecycle === "active" && theoObservation.nextPlayerId === "theo") {
      const action = await this.#theo.chooseAction({
        observation: theoObservation,
        legalActions: theoObservation.legalActions,
      });
      const theoResult = session.submit({
        actionId: `theo:${this.#idGenerator()}`,
        playerId: "theo",
        expectedRevision: session.revision,
        action,
      });
      if (!theoResult.accepted) {
        throw new Error(`Deterministic Theo action was rejected: ${theoResult.message}`);
      }
    }

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
    return {
      matchId: session.matchId,
      revision: session.revision,
      observation: session.observe(playerId),
      eventCount: session.snapshot().events.length,
    };
  }
}
