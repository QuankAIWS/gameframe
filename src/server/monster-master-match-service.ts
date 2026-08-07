import {
  chooseAgentDecision,
  type AgentPlayer,
} from "../agents/agent-player.ts";
import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import {
  DeterministicMonsterMasterPlayer,
  monsterMasterDefinition,
  type MonsterMasterAction,
  type MonsterMasterObservation,
  type MonsterMasterState,
} from "../games/monster-master/index.ts";
import { MatchSession, type MatchSnapshot } from "../platform/match-session.ts";
import type { MatchSnapshotStore } from "../platform/match-store.ts";

export interface PublicMonsterMasterMatchView {
  matchId: string;
  playerIds: readonly string[];
  revision: number;
  observation: MonsterMasterObservation;
  eventCount: number;
}

export interface MonsterMasterMatchServiceOptions {
  store: MatchSnapshotStore<MonsterMasterState, MonsterMasterAction>;
  idGenerator?: () => string;
  bot?: AgentPlayer<MonsterMasterAction, MonsterMasterObservation>;
}

export class MonsterMasterMatchService {
  readonly #store: MatchSnapshotStore<MonsterMasterState, MonsterMasterAction>;
  readonly #idGenerator: () => string;
  readonly #bot: AgentPlayer<MonsterMasterAction, MonsterMasterObservation>;

  constructor(options: MonsterMasterMatchServiceOptions) {
    this.#store = options.store;
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.#bot = options.bot ?? new DeterministicMonsterMasterPlayer(GAMEFRAME_BOT_PLAYER_ID);
  }

  async createMatch(
    playerIds: readonly string[],
    requestedMatchId?: string,
    initialState?: MonsterMasterState,
  ): Promise<PublicMonsterMasterMatchView> {
    const normalizedPlayers = playerIds.map((playerId) => playerId.trim());
    if (
      normalizedPlayers.length !== 2
      || normalizedPlayers.some((playerId) => !playerId)
      || normalizedPlayers[0] === normalizedPlayers[1]
    ) {
      const error = new Error("Monster Master requires exactly two distinct player IDs.");
      Object.assign(error, { code: "invalid_players" });
      throw error;
    }
    if (
      initialState
      && (
        initialState.playerIds.length !== normalizedPlayers.length
        || initialState.playerIds.some((playerId, index) => playerId !== normalizedPlayers[index])
      )
    ) {
      const error = new Error("Configured Monster Master state player order does not match the match seats.");
      Object.assign(error, { code: "invalid_initial_state" });
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
      definition: monsterMasterDefinition,
      playerIds: normalizedPlayers,
      ...(initialState
        ? {
            snapshot: {
              matchId,
              gameId: monsterMasterDefinition.gameId,
              playerIds: normalizedPlayers,
              revision: 0,
              initialState,
              state: initialState,
              events: [],
            },
          }
        : {}),
    });
    await this.#runBotActionsIfNeeded(session);
    await this.#store.save(session.snapshot());
    const requestingPlayerId = normalizedPlayers.find((playerId) => playerId !== this.#bot.agentId)
      ?? normalizedPlayers[0];
    return this.#view(session, requestingPlayerId);
  }

  async view(matchId: string, playerId: string): Promise<PublicMonsterMasterMatchView> {
    return this.#view(await this.#loadSession(matchId), playerId);
  }

  async submitAction(input: {
    matchId: string;
    playerId: string;
    actionId: string;
    expectedRevision: number;
    action: MonsterMasterAction;
  }): Promise<PublicMonsterMasterMatchView> {
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

    await this.#runBotActionsIfNeeded(session);
    await this.#store.save(session.snapshot());
    return this.#view(session, input.playerId);
  }

  async snapshot(
    matchId: string,
  ): Promise<MatchSnapshot<MonsterMasterState, MonsterMasterAction>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) {
      const error = new Error(`Unknown match: ${matchId}`);
      Object.assign(error, { code: "match_not_found" });
      throw error;
    }
    return snapshot;
  }

  async replay(matchId: string): Promise<MonsterMasterState> {
    return (await this.#loadSession(matchId)).replay();
  }

  async #runBotActionsIfNeeded(
    session: MatchSession<MonsterMasterState, MonsterMasterAction, MonsterMasterObservation>,
  ): Promise<void> {
    if (!session.snapshot().playerIds.includes(this.#bot.agentId)) return;

    for (let actionCount = 0; actionCount < 12; actionCount += 1) {
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
          gameId: monsterMasterDefinition.gameId,
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
        throw new Error(`Monster Master BattleBot decision was rejected: ${result.message}`);
      }
    }

    throw new Error("Monster Master BattleBot turn exceeded the bounded action limit.");
  }

  async #loadSession(
    matchId: string,
  ): Promise<MatchSession<MonsterMasterState, MonsterMasterAction, MonsterMasterObservation>> {
    const snapshot = await this.#store.load(matchId);
    if (!snapshot) {
      const error = new Error(`Unknown match: ${matchId}`);
      Object.assign(error, { code: "match_not_found" });
      throw error;
    }
    return new MatchSession({
      matchId,
      definition: monsterMasterDefinition,
      playerIds: snapshot.playerIds,
      snapshot,
    });
  }

  #view(
    session: MatchSession<MonsterMasterState, MonsterMasterAction, MonsterMasterObservation>,
    playerId: string,
  ): PublicMonsterMasterMatchView {
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
