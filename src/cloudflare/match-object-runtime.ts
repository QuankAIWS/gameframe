import type { CheckersAction, CheckersState } from "../games/checkers/index.ts";
import type { TicTacToeAction, TicTacToeState } from "../games/tic-tac-toe/index.ts";
import { CheckersMatchService } from "../server/checkers-match-service.ts";
import { TicTacToeMatchService } from "../server/tic-tac-toe-match-service.ts";
import {
  DurableObjectMatchStore,
  MATCH_SNAPSHOT_KEY,
} from "./durable-object-match-store.ts";
import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

export type DurableGameId = "tic-tac-toe" | "american-checkers";

export interface GameFrameMatchObjectRuntimeOptions {
  onMatchUpdated?: (matchId: string) => Promise<void> | void;
}

interface StoredMatchHeader {
  matchId: string;
  gameId: string;
}

export class GameFrameMatchObjectRuntime {
  readonly #storage: DurableStorageLike;
  readonly #ticTacToe: TicTacToeMatchService;
  readonly #checkers: CheckersMatchService;
  readonly #onMatchUpdated: (matchId: string) => Promise<void> | void;
  #tail: Promise<void> = Promise.resolve();

  constructor(
    storage: DurableStorageLike,
    idGenerator: () => string = () => crypto.randomUUID(),
    options: GameFrameMatchObjectRuntimeOptions = {},
  ) {
    this.#storage = storage;
    this.#ticTacToe = new TicTacToeMatchService({
      store: new DurableObjectMatchStore<TicTacToeState, TicTacToeAction>(storage),
      idGenerator,
    });
    this.#checkers = new CheckersMatchService({
      store: new DurableObjectMatchStore<CheckersState, CheckersAction>(storage),
      idGenerator,
    });
    this.#onMatchUpdated = options.onMatchUpdated ?? (() => undefined);
  }

  fetch(request: Request): Promise<Response> {
    const execute = async () => this.#handle(request);
    const result = this.#tail.then(execute, execute);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async view(matchId: string, playerId: string) {
    const gameId = await this.#gameFor(matchId);
    const view = gameId === "tic-tac-toe"
      ? await this.#ticTacToe.view(matchId, playerId)
      : await this.#checkers.view(matchId, playerId);
    return { gameId, ...view };
  }

  async #handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === "/initialize") {
        const body = await readJson(request);
        const matchId = String(body.matchId ?? "").trim();
        const playerIds = Array.isArray(body.playerIds)
          ? body.playerIds.map((playerId) => String(playerId))
          : [];
        const gameId = this.#normalizeGameId(String(body.gameId ?? "tic-tac-toe"));
        const view = gameId === "tic-tac-toe"
          ? await this.#ticTacToe.createMatch(playerIds, matchId)
          : await this.#checkers.createMatch(playerIds, matchId);
        await this.#notify(matchId);
        return json(201, { gameId, ...view });
      }

      if (request.method === "GET" && url.pathname === "/view") {
        return json(200, await this.view(
          String(url.searchParams.get("matchId") ?? ""),
          String(url.searchParams.get("playerId") ?? ""),
        ));
      }

      if (request.method === "POST" && url.pathname === "/actions") {
        const body = await readJson(request);
        const matchId = String(body.matchId ?? "");
        const gameId = await this.#gameFor(matchId);
        const common = {
          matchId,
          playerId: String(body.playerId ?? ""),
          actionId: String(body.actionId ?? ""),
          expectedRevision: Number(body.expectedRevision),
        };
        const view = gameId === "tic-tac-toe"
          ? await this.#ticTacToe.submitAction({
              ...common,
              action: parseTicTacToeAction(body.action),
            })
          : await this.#checkers.submitAction({
              ...common,
              action: parseCheckersAction(body.action),
            });
        await this.#notify(matchId);
        return json(200, { gameId, ...view });
      }

      return json(404, { error: "not_found" });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async #gameFor(matchId: string): Promise<DurableGameId> {
    const snapshot = await this.#storage.get<StoredMatchHeader>(MATCH_SNAPSHOT_KEY);
    if (!snapshot || snapshot.matchId !== matchId) {
      const error = new Error(`Unknown match: ${matchId}`);
      Object.assign(error, { code: "match_not_found" });
      throw error;
    }
    return this.#normalizeGameId(snapshot.gameId);
  }

  #normalizeGameId(gameId: string): DurableGameId {
    if (gameId === "tic-tac-toe" || gameId === "american-checkers") return gameId;
    const error = new Error(`Unsupported game: ${gameId}`);
    Object.assign(error, { code: "unknown_game" });
    throw error;
  }

  async #notify(matchId: string): Promise<void> {
    try {
      await this.#onMatchUpdated(matchId);
    } catch {
      // Projection delivery must never roll back an already-persisted game action.
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseTicTacToeAction(value: unknown): TicTacToeAction {
  const action = record(value);
  return { type: "place", cell: Number(action.cell) };
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

// Preserve the original export while the Durable Object class and binding retain their
// migration-stable names. The runtime itself now dispatches every supported game.
export { GameFrameMatchObjectRuntime as TicTacToeMatchObjectRuntime };
export type TicTacToeMatchObjectRuntimeOptions = GameFrameMatchObjectRuntimeOptions;
