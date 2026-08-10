import {
  othelloDefinition,
  type OthelloAction,
  type OthelloObservation,
  type OthelloState,
} from "../games/othello/index.ts";
import { MatchSession, type MatchSnapshot } from "../platform/match-session.ts";
import type { MatchSnapshotStore } from "../platform/match-store.ts";

export interface OthelloPublicMatchView {
  matchId: string;
  playerIds: readonly string[];
  revision: number;
  observation: OthelloObservation;
  eventCount: number;
}

export interface OthelloMatchServiceOptions {
  store: MatchSnapshotStore<OthelloState, OthelloAction>;
  idGenerator?: () => string;
}

export class OthelloMatchService {
  readonly #store: MatchSnapshotStore<OthelloState, OthelloAction>;
  readonly #idGenerator: () => string;

  constructor(options: OthelloMatchServiceOptions) {
    this.#store = options.store;
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
  }

  async createMatch(playerIds: readonly string[], requestedMatchId?: string): Promise<OthelloPublicMatchView> {
    const normalizedPlayers = playerIds.map((playerId) => playerId.trim());
    if (
      normalizedPlayers.length !== 2
      || normalizedPlayers.some((playerId) => !playerId)
      || normalizedPlayers[0] === normalizedPlayers[1]
    ) {
      const error = new Error("Othello requires exactly two distinct player IDs.");
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
      definition: othelloDefinition,
      playerIds: normalizedPlayers,
    });
    await this.#store.save(session.snapshot());
    return this.#view(session, normalizedPlayers[0]);
  }

  async view(matchId: string, playerId: string): Promise<OthelloPublicMatchView> {
    return this.#view(await this.#loadSession(matchId), playerId);
  }

  async submitAction(input: {
    matchId: string;
    playerId: string;
    actionId: string;
    expectedRevision: number;
    action: OthelloAction;
  }): Promise<OthelloPublicMatchView> {
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

    await this.#store.save(session.snapshot());
    return this.#view(session, input.playerId);
  }

  async snapshot(matchId: string): Promise<MatchSnapshot<OthelloState, OthelloAction>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) throw new Error(`Unknown match: ${matchId}`);
    return snapshot;
  }

  async replay(matchId: string): Promise<OthelloState> {
    return (await this.#loadSession(matchId)).replay();
  }

  async #loadSession(matchId: string): Promise<MatchSession<OthelloState, OthelloAction, OthelloObservation>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) {
      const error = new Error(`Unknown match: ${matchId}`);
      Object.assign(error, { code: "match_not_found" });
      throw error;
    }
    return new MatchSession({
      matchId,
      definition: othelloDefinition,
      playerIds: snapshot.playerIds,
      snapshot,
    });
  }

  #view(
    session: MatchSession<OthelloState, OthelloAction, OthelloObservation>,
    playerId: string,
  ): OthelloPublicMatchView {
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
