import type { AgentPlayer } from "../agents/agent-player.ts";
import type {
  CheckersAction,
  CheckersObservation,
  CheckersState,
} from "../games/checkers/index.ts";
import type {
  TicTacToeAction,
  TicTacToeObservation,
  TicTacToeState,
} from "../games/tic-tac-toe/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import {
  CheckersMatchService,
  type PublicCheckersMatchView,
} from "./checkers-match-service.ts";
import { TicTacToeMatchService, type PublicMatchView } from "./tic-tac-toe-match-service.ts";

export type SupportedGameId = "tic-tac-toe" | "american-checkers";

export type PublicGameMatchView =
  | ({ gameId: "tic-tac-toe" } & PublicMatchView)
  | ({ gameId: "american-checkers" } & PublicCheckersMatchView);

export interface InMemoryGameFrameServiceOptions {
  idGenerator?: () => string;
  ticTacToeTheo?: AgentPlayer<TicTacToeAction, TicTacToeObservation>;
  checkersTheo?: AgentPlayer<CheckersAction, CheckersObservation>;
}

export type { PublicMatchView, PublicCheckersMatchView };

export class InMemoryTicTacToeService extends TicTacToeMatchService {
  constructor(theo?: AgentPlayer<TicTacToeAction, TicTacToeObservation>) {
    super({
      store: new InMemoryMatchSnapshotStore<TicTacToeState, TicTacToeAction>(),
      ...(theo ? { theo } : {}),
    });
  }
}

export class InMemoryCheckersService extends CheckersMatchService {
  constructor(theo?: AgentPlayer<CheckersAction, CheckersObservation>) {
    super({
      store: new InMemoryMatchSnapshotStore<CheckersState, CheckersAction>(),
      ...(theo ? { theo } : {}),
    });
  }
}

export class InMemoryGameFrameService {
  readonly #idGenerator: () => string;
  readonly #ticTacToe: TicTacToeMatchService;
  readonly #checkers: CheckersMatchService;
  readonly #matchGames = new Map<string, SupportedGameId>();

  constructor(options: InMemoryGameFrameServiceOptions = {}) {
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.#ticTacToe = new TicTacToeMatchService({
      store: new InMemoryMatchSnapshotStore<TicTacToeState, TicTacToeAction>(),
      ...(options.ticTacToeTheo ? { theo: options.ticTacToeTheo } : {}),
    });
    this.#checkers = new CheckersMatchService({
      store: new InMemoryMatchSnapshotStore<CheckersState, CheckersAction>(),
      ...(options.checkersTheo ? { theo: options.checkersTheo } : {}),
    });
  }

  async createMatch(
    gameId: string,
    playerIds: readonly string[],
    requestedMatchId?: string,
  ): Promise<PublicGameMatchView> {
    const normalizedGameId = this.#normalizeGameId(gameId);
    const matchId = requestedMatchId ?? this.#idGenerator();
    if (this.#matchGames.has(matchId)) {
      const error = new Error(`Match already exists: ${matchId}`);
      Object.assign(error, { code: "match_exists" });
      throw error;
    }

    const view = normalizedGameId === "tic-tac-toe"
      ? await this.#ticTacToe.createMatch(playerIds, matchId)
      : await this.#checkers.createMatch(playerIds, matchId);
    this.#matchGames.set(matchId, normalizedGameId);
    return { gameId: normalizedGameId, ...view } as PublicGameMatchView;
  }

  async view(matchId: string, playerId: string): Promise<PublicGameMatchView> {
    const gameId = this.#gameFor(matchId);
    const view = gameId === "tic-tac-toe"
      ? await this.#ticTacToe.view(matchId, playerId)
      : await this.#checkers.view(matchId, playerId);
    return { gameId, ...view } as PublicGameMatchView;
  }

  async submitAction(input: {
    matchId: string;
    playerId: string;
    actionId: string;
    expectedRevision: number;
    action: unknown;
  }): Promise<PublicGameMatchView> {
    const gameId = this.#gameFor(input.matchId);
    if (gameId === "tic-tac-toe") {
      const view = await this.#ticTacToe.submitAction({
        ...input,
        action: parseTicTacToeAction(input.action),
      });
      return { gameId, ...view };
    }
    const view = await this.#checkers.submitAction({
      ...input,
      action: parseCheckersAction(input.action),
    });
    return { gameId, ...view };
  }

  #gameFor(matchId: string): SupportedGameId {
    const gameId = this.#matchGames.get(matchId);
    if (!gameId) {
      const error = new Error(`Unknown match: ${matchId}`);
      Object.assign(error, { code: "match_not_found" });
      throw error;
    }
    return gameId;
  }

  #normalizeGameId(gameId: string): SupportedGameId {
    if (gameId === "tic-tac-toe" || gameId === "american-checkers") return gameId;
    const error = new Error(`Unsupported game: ${gameId}`);
    Object.assign(error, { code: "unknown_game" });
    throw error;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseTicTacToeAction(value: unknown): TicTacToeAction {
  const action = record(value);
  return {
    type: "place",
    cell: Number(action.cell),
  };
}

function parseCheckersAction(value: unknown): CheckersAction {
  const action = record(value);
  return {
    type: "move",
    pieceId: String(action.pieceId ?? ""),
    from: Number(action.from),
    path: Array.isArray(action.path) ? action.path.map((square) => Number(square)) : [],
    capturedPieceIds: Array.isArray(action.capturedPieceIds)
      ? action.capturedPieceIds.map((pieceId) => String(pieceId))
      : [],
  };
}
