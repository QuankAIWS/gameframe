import type { AgentPlayer } from "../agents/agent-player.ts";
import type {
  CheckersAction,
  CheckersObservation,
  CheckersState,
} from "../games/checkers/index.ts";
import type {
  MonsterMasterAction,
  MonsterMasterObservation,
  MonsterMasterState,
} from "../games/monster-master/index.ts";
import type {
  TacticalCombatAction,
  TacticalCombatObservation,
  TacticalCombatState,
} from "../games/tactical-combat/index.ts";
import type {
  TacticalMovementAction,
  TacticalMovementObservation,
  TacticalMovementState,
} from "../games/tactical-core/index.ts";
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
import {
  MonsterMasterMatchService,
  type PublicMonsterMasterMatchView,
} from "./monster-master-match-service.ts";
import {
  TacticalCombatMatchService,
  type PublicTacticalCombatMatchView,
} from "./tactical-combat-match-service.ts";
import {
  TacticalMovementMatchService,
  type PublicTacticalMovementMatchView,
} from "./tactical-movement-match-service.ts";
import { TicTacToeMatchService, type PublicMatchView } from "./tic-tac-toe-match-service.ts";

export type SupportedGameId =
  | "tic-tac-toe"
  | "american-checkers"
  | "tactical-movement-canary"
  | "tactical-combat-canary"
  | "monster-master-duel";

export type PublicGameMatchView =
  | ({ gameId: "tic-tac-toe" } & PublicMatchView)
  | ({ gameId: "american-checkers" } & PublicCheckersMatchView)
  | ({ gameId: "tactical-movement-canary" } & PublicTacticalMovementMatchView)
  | ({ gameId: "tactical-combat-canary" } & PublicTacticalCombatMatchView)
  | ({ gameId: "monster-master-duel" } & PublicMonsterMasterMatchView);

export interface InMemoryGameFrameServiceOptions {
  idGenerator?: () => string;
  ticTacToeBot?: AgentPlayer<TicTacToeAction, TicTacToeObservation>;
  checkersBot?: AgentPlayer<CheckersAction, CheckersObservation>;
  tacticalBot?: AgentPlayer<TacticalMovementAction, TacticalMovementObservation>;
  tacticalCombatBot?: AgentPlayer<TacticalCombatAction, TacticalCombatObservation>;
  monsterMasterBot?: AgentPlayer<MonsterMasterAction, MonsterMasterObservation>;
}

export type {
  PublicMatchView,
  PublicCheckersMatchView,
  PublicTacticalMovementMatchView,
  PublicTacticalCombatMatchView,
  PublicMonsterMasterMatchView,
};

export class InMemoryTicTacToeService extends TicTacToeMatchService {
  constructor(bot?: AgentPlayer<TicTacToeAction, TicTacToeObservation>) {
    super({
      store: new InMemoryMatchSnapshotStore<TicTacToeState, TicTacToeAction>(),
      ...(bot ? { bot } : {}),
    });
  }
}

export class InMemoryCheckersService extends CheckersMatchService {
  constructor(bot?: AgentPlayer<CheckersAction, CheckersObservation>) {
    super({
      store: new InMemoryMatchSnapshotStore<CheckersState, CheckersAction>(),
      ...(bot ? { bot } : {}),
    });
  }
}

export class InMemoryTacticalMovementService extends TacticalMovementMatchService {
  constructor(bot?: AgentPlayer<TacticalMovementAction, TacticalMovementObservation>) {
    super({
      store: new InMemoryMatchSnapshotStore<TacticalMovementState, TacticalMovementAction>(),
      ...(bot ? { bot } : {}),
    });
  }
}

export class InMemoryTacticalCombatService extends TacticalCombatMatchService {
  constructor(bot?: AgentPlayer<TacticalCombatAction, TacticalCombatObservation>) {
    super({
      store: new InMemoryMatchSnapshotStore<TacticalCombatState, TacticalCombatAction>(),
      ...(bot ? { bot } : {}),
    });
  }
}

export class InMemoryMonsterMasterService extends MonsterMasterMatchService {
  constructor(bot?: AgentPlayer<MonsterMasterAction, MonsterMasterObservation>) {
    super({
      store: new InMemoryMatchSnapshotStore<MonsterMasterState, MonsterMasterAction>(),
      ...(bot ? { bot } : {}),
    });
  }
}

export class InMemoryGameFrameService {
  readonly #idGenerator: () => string;
  readonly #ticTacToe: TicTacToeMatchService;
  readonly #checkers: CheckersMatchService;
  readonly #tactical: TacticalMovementMatchService;
  readonly #combat: TacticalCombatMatchService;
  readonly #monsterMaster: MonsterMasterMatchService;
  readonly #matchGames = new Map<string, SupportedGameId>();

  constructor(options: InMemoryGameFrameServiceOptions = {}) {
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.#ticTacToe = new TicTacToeMatchService({
      store: new InMemoryMatchSnapshotStore<TicTacToeState, TicTacToeAction>(),
      ...(options.ticTacToeBot ? { bot: options.ticTacToeBot } : {}),
    });
    this.#checkers = new CheckersMatchService({
      store: new InMemoryMatchSnapshotStore<CheckersState, CheckersAction>(),
      ...(options.checkersBot ? { bot: options.checkersBot } : {}),
    });
    this.#tactical = new TacticalMovementMatchService({
      store: new InMemoryMatchSnapshotStore<TacticalMovementState, TacticalMovementAction>(),
      ...(options.tacticalBot ? { bot: options.tacticalBot } : {}),
    });
    this.#combat = new TacticalCombatMatchService({
      store: new InMemoryMatchSnapshotStore<TacticalCombatState, TacticalCombatAction>(),
      ...(options.tacticalCombatBot ? { bot: options.tacticalCombatBot } : {}),
    });
    this.#monsterMaster = new MonsterMasterMatchService({
      store: new InMemoryMatchSnapshotStore<MonsterMasterState, MonsterMasterAction>(),
      ...(options.monsterMasterBot ? { bot: options.monsterMasterBot } : {}),
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
      : normalizedGameId === "american-checkers"
        ? await this.#checkers.createMatch(playerIds, matchId)
        : normalizedGameId === "tactical-movement-canary"
          ? await this.#tactical.createMatch(playerIds, matchId)
          : normalizedGameId === "tactical-combat-canary"
            ? await this.#combat.createMatch(playerIds, matchId)
            : await this.#monsterMaster.createMatch(playerIds, matchId);
    this.#matchGames.set(matchId, normalizedGameId);
    return { gameId: normalizedGameId, ...view } as PublicGameMatchView;
  }

  async view(matchId: string, playerId: string): Promise<PublicGameMatchView> {
    const gameId = this.#gameFor(matchId);
    const view = gameId === "tic-tac-toe"
      ? await this.#ticTacToe.view(matchId, playerId)
      : gameId === "american-checkers"
        ? await this.#checkers.view(matchId, playerId)
        : gameId === "tactical-movement-canary"
          ? await this.#tactical.view(matchId, playerId)
          : gameId === "tactical-combat-canary"
            ? await this.#combat.view(matchId, playerId)
            : await this.#monsterMaster.view(matchId, playerId);
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
    if (gameId === "american-checkers") {
      const view = await this.#checkers.submitAction({
        ...input,
        action: parseCheckersAction(input.action),
      });
      return { gameId, ...view };
    }
    if (gameId === "tactical-movement-canary") {
      const view = await this.#tactical.submitAction({
        ...input,
        action: parseTacticalMovementAction(input.action),
      });
      return { gameId, ...view };
    }
    if (gameId === "tactical-combat-canary") {
      const view = await this.#combat.submitAction({
        ...input,
        action: parseTacticalCombatAction(input.action),
      });
      return { gameId, ...view };
    }
    const view = await this.#monsterMaster.submitAction({
      ...input,
      action: parseMonsterMasterAction(input.action),
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
    if (
      gameId === "tic-tac-toe"
      || gameId === "american-checkers"
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
