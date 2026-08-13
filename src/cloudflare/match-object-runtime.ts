import type { CheckersAction, CheckersState } from "../games/checkers/index.ts";
import type { MonsterMasterAction, MonsterMasterState } from "../games/monster-master/index.ts";
import type { OthelloAction, OthelloState } from "../games/othello/index.ts";
import type {
  TacticalCombatAction,
  TacticalCombatState,
} from "../games/tactical-combat/index.ts";
import type {
  TacticalMovementAction,
  TacticalMovementState,
} from "../games/tactical-core/index.ts";
import type { TicTacToeAction, TicTacToeState } from "../games/tic-tac-toe/index.ts";
import { CheckersMatchService } from "../server/checkers-match-service.ts";
import { MonsterMasterMatchService } from "../server/monster-master-match-service.ts";
import { OthelloMatchService } from "../server/othello-match-service.ts";
import { TacticalCombatMatchService } from "../server/tactical-combat-match-service.ts";
import { TacticalMovementMatchService } from "../server/tactical-movement-match-service.ts";
import { TicTacToeMatchService } from "../server/tic-tac-toe-match-service.ts";
import {
  DurableObjectMatchStore,
  MATCH_SNAPSHOT_KEY,
} from "./durable-object-match-store.ts";
import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

export type DurableGameId =
  | "tic-tac-toe"
  | "american-checkers"
  | "othello"
  | "tactical-movement-canary"
  | "tactical-combat-canary"
  | "monster-master-duel";

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
  readonly #othello: OthelloMatchService;
  readonly #tactical: TacticalMovementMatchService;
  readonly #combat: TacticalCombatMatchService;
  readonly #monsterMaster: MonsterMasterMatchService;
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
    this.#othello = new OthelloMatchService({
      store: new DurableObjectMatchStore<OthelloState, OthelloAction>(storage),
      idGenerator,
    });
    this.#tactical = new TacticalMovementMatchService({
      store: new DurableObjectMatchStore<TacticalMovementState, TacticalMovementAction>(storage),
      idGenerator,
    });
    this.#combat = new TacticalCombatMatchService({
      store: new DurableObjectMatchStore<TacticalCombatState, TacticalCombatAction>(storage),
      idGenerator,
    });
    this.#monsterMaster = new MonsterMasterMatchService({
      store: new DurableObjectMatchStore<MonsterMasterState, MonsterMasterAction>(storage),
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
      : gameId === "american-checkers"
        ? await this.#checkers.view(matchId, playerId)
        : gameId === "othello"
          ? await this.#othello.view(matchId, playerId)
          : gameId === "tactical-movement-canary"
            ? await this.#tactical.view(matchId, playerId)
            : gameId === "tactical-combat-canary"
              ? await this.#combat.view(matchId, playerId)
              : await this.#monsterMaster.view(matchId, playerId);
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
        const arenaInput = record(body.monsterMasterArena);
        const monsterMasterArena = Object.keys(arenaInput).length
          ? { playerId: String(arenaInput.playerId ?? ""), roster: arenaInput.roster }
          : undefined;
        const view = gameId === "tic-tac-toe"
          ? await this.#ticTacToe.createMatch(playerIds, matchId)
          : gameId === "american-checkers"
            ? await this.#checkers.createMatch(playerIds, matchId)
            : gameId === "othello"
              ? await this.#othello.createMatch(playerIds, matchId)
              : gameId === "tactical-movement-canary"
                ? await this.#tactical.createMatch(playerIds, matchId)
                : gameId === "tactical-combat-canary"
                  ? await this.#combat.createMatch(playerIds, matchId)
                  : await this.#monsterMaster.createMatch(playerIds, matchId, undefined, monsterMasterArena);
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
          : gameId === "american-checkers"
            ? await this.#checkers.submitAction({
                ...common,
                action: parseCheckersAction(body.action),
              })
            : gameId === "othello"
              ? await this.#othello.submitAction({
                  ...common,
                  action: parseOthelloAction(body.action),
                })
              : gameId === "tactical-movement-canary"
                ? await this.#tactical.submitAction({
                    ...common,
                    action: parseTacticalMovementAction(body.action),
                  })
                : gameId === "tactical-combat-canary"
                  ? await this.#combat.submitAction({
                      ...common,
                      action: parseTacticalCombatAction(body.action),
                    })
                  : await this.#monsterMaster.submitAction({
                      ...common,
                      action: parseMonsterMasterAction(body.action),
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
    if (
      gameId === "tic-tac-toe"
      || gameId === "american-checkers"
      || gameId === "othello"
      || gameId === "tactical-movement-canary"
      || gameId === "tactical-combat-canary"
      || gameId === "monster-master-duel"
    ) {
      return gameId;
    }
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

function coordinate(value: unknown): { x: number; y: number } {
  const input = record(value);
  return { x: Number(input.x), y: Number(input.y) };
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

function parseOthelloAction(value: unknown): OthelloAction {
  const action = record(value);
  return {
    type: "place",
    row: Number(action.row),
    column: Number(action.column),
  };
}

function parseTacticalMovementAction(value: unknown): TacticalMovementAction {
  const action = record(value);
  const unitId = String(action.unitId ?? "");
  if (action.type === "end-activation") return { type: "end-activation", unitId };
  return {
    type: "move",
    unitId,
    from: coordinate(action.from),
    path: Array.isArray(action.path) ? action.path.map(coordinate) : [],
    movementCost: Number(action.movementCost),
  };
}

function parseTacticalCombatAction(value: unknown): TacticalCombatAction {
  const action = record(value);
  const unitId = String(action.unitId ?? "");
  if (action.type === "end-activation") return { type: "end-activation", unitId };
  if (action.type === "attack") {
    return {
      type: "attack",
      unitId,
      targetUnitId: String(action.targetUnitId ?? ""),
      from: coordinate(action.from),
      target: coordinate(action.target),
      range: Number(action.range),
      damage: Number(action.damage),
    };
  }
  return {
    type: "move",
    unitId,
    from: coordinate(action.from),
    path: Array.isArray(action.path) ? action.path.map(coordinate) : [],
    movementCost: Number(action.movementCost),
  };
}

function parseMonsterMasterAction(value: unknown): MonsterMasterAction {
  const action = record(value);
  const unitId = String(action.unitId ?? "");
  if (action.type === "deploy-unit") {
    return { type: "deploy-unit", unitId, position: coordinate(action.position) };
  }
  if (action.type === "end-activation") return { type: "end-activation", unitId };
  if (action.type === "attack") {
    return {
      type: "attack",
      unitId,
      targetUnitId: String(action.targetUnitId ?? ""),
      from: coordinate(action.from),
      target: coordinate(action.target),
      range: Number(action.range),
      damage: Number(action.damage),
    };
  }
  if (action.type === "use-ability") {
    return {
      type: "use-ability",
      abilityId: "mend",
      unitId,
      targetUnitId: String(action.targetUnitId ?? ""),
      from: coordinate(action.from),
      target: coordinate(action.target),
      range: Number(action.range),
      commandCost: Number(action.commandCost),
      healing: Number(action.healing),
    };
  }
  return {
    type: "move",
    unitId,
    from: coordinate(action.from),
    path: Array.isArray(action.path) ? action.path.map(coordinate) : [],
    movementCost: Number(action.movementCost),
  };
}

// Preserve the original export while the Durable Object class and binding retain their
// migration-stable names. The runtime itself now dispatches every supported game.
export { GameFrameMatchObjectRuntime as TicTacToeMatchObjectRuntime };
export type TicTacToeMatchObjectRuntimeOptions = GameFrameMatchObjectRuntimeOptions;
