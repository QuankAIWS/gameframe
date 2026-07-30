import type { AgentPlayer } from "../../agents/agent-player.ts";
import type { GameDefinition, GameStatus, PlayerId } from "../../platform/contracts.ts";
import {
  applyTacticalMove,
  cloneTacticalMap,
  compareCoordinates,
  coordinateKey,
  createTacticalCanaryMap,
  isSameTacticalMovementAction,
  listTacticalMoveActions,
  sameCoordinate,
  tacticalCellAt,
  type TacticalBoardState,
  type TacticalCoordinate,
  type TacticalMap,
  type TacticalMoveAction,
  type TacticalUnit,
} from "../tactical-core/index.ts";

export type TacticalCombatRole = "vanguard" | "ranger";

export interface TacticalCombatUnit extends TacticalUnit {
  role: TacticalCombatRole;
  initiative: number;
  maxHealth: number;
  health: number;
  attackRange: number;
  attackDamage: number;
}

export interface TacticalCombatBoardState {
  map: TacticalMap;
  units: TacticalCombatUnit[];
}

export interface TacticalAttackAction {
  type: "attack";
  unitId: string;
  targetUnitId: string;
  from: TacticalCoordinate;
  target: TacticalCoordinate;
  range: number;
  damage: number;
}

export interface TacticalEndCombatActivationAction {
  type: "end-activation";
  unitId: string;
}

export type TacticalCombatAction =
  | TacticalMoveAction
  | TacticalAttackAction
  | TacticalEndCombatActivationAction;

export type TacticalCombatEffect =
  | {
      type: "unit-moved";
      unitId: string;
      from: TacticalCoordinate;
      to: TacticalCoordinate;
      path: TacticalCoordinate[];
      movementCost: number;
    }
  | {
      type: "unit-damaged";
      sourceUnitId: string;
      targetUnitId: string;
      damage: number;
      remainingHealth: number;
    }
  | {
      type: "unit-defeated";
      sourceUnitId: string;
      targetUnitId: string;
    }
  | {
      type: "activation-ended";
      unitId: string;
    }
  | {
      type: "round-started";
      round: number;
    }
  | {
      type: "combat-completed";
      winnerPlayerId: PlayerId | null;
      draw: boolean;
    };

export interface TacticalCombatState {
  board: TacticalCombatBoardState;
  playerIds: [PlayerId, PlayerId];
  activationOrder: string[];
  activeActivationIndex: number;
  round: number;
  movementUsed: boolean;
  primaryActionUsed: boolean;
  defeatedUnitIds: string[];
  winnerPlayerId: PlayerId | null;
  draw: boolean;
  maxRounds: number;
  lastEffects: TacticalCombatEffect[];
}

export interface TacticalCombatObservation {
  board: TacticalCombatBoardState;
  yourPlayerId: PlayerId;
  activePlayerId: PlayerId | null;
  activeUnitId: string | null;
  round: number;
  movementAvailable: boolean;
  primaryActionAvailable: boolean;
  defeatedUnitIds: string[];
  status: GameStatus;
  legalActions: TacticalCombatAction[];
  lastEffects: TacticalCombatEffect[];
}

export interface TacticalLineOfSightResult {
  aligned: boolean;
  clear: boolean;
  distance: number;
  cells: TacticalCoordinate[];
  blockedAt: TacticalCoordinate | null;
}

export const TACTICAL_COMBAT_GAME_ID = "tactical-combat-canary";
export const TACTICAL_COMBAT_MAX_ROUNDS = 30;

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function cloneCoordinate(coordinate: TacticalCoordinate): TacticalCoordinate {
  return { x: coordinate.x, y: coordinate.y };
}

function cloneEffect(effect: TacticalCombatEffect): TacticalCombatEffect {
  if (effect.type === "unit-moved") {
    return {
      ...effect,
      from: cloneCoordinate(effect.from),
      to: cloneCoordinate(effect.to),
      path: effect.path.map(cloneCoordinate),
    };
  }
  return { ...effect };
}

export function cloneTacticalCombatUnit(unit: TacticalCombatUnit): TacticalCombatUnit {
  return {
    ...unit,
    position: cloneCoordinate(unit.position),
    ...(unit.tags ? { tags: [...unit.tags] } : {}),
  };
}

export function cloneTacticalCombatBoard(board: TacticalCombatBoardState): TacticalCombatBoardState {
  return {
    map: cloneTacticalMap(board.map),
    units: board.units.map(cloneTacticalCombatUnit),
  };
}

export function cloneTacticalCombatState(state: TacticalCombatState): TacticalCombatState {
  return {
    board: cloneTacticalCombatBoard(state.board),
    playerIds: [...state.playerIds] as [PlayerId, PlayerId],
    activationOrder: [...state.activationOrder],
    activeActivationIndex: state.activeActivationIndex,
    round: state.round,
    movementUsed: state.movementUsed,
    primaryActionUsed: state.primaryActionUsed,
    defeatedUnitIds: [...state.defeatedUnitIds],
    winnerPlayerId: state.winnerPlayerId,
    draw: state.draw,
    maxRounds: state.maxRounds,
    lastEffects: state.lastEffects.map(cloneEffect),
  };
}

export function tacticalCombatUnit(
  board: TacticalCombatBoardState,
  unitId: string,
): TacticalCombatUnit {
  const unit = board.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error(`Unknown tactical combat unit: ${unitId}`);
  return unit;
}

export function validateTacticalCombatBoard(board: TacticalCombatBoardState): void {
  if (board.map.cells.length !== board.map.width * board.map.height) {
    throw new Error("Tactical combat map cell count does not match its dimensions.");
  }
  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const unit of board.units) {
    if (!unit.id.trim() || ids.has(unit.id)) throw new Error("Combat unit IDs must be non-empty and unique.");
    if (!unit.ownerId.trim()) throw new Error("Combat units require an owner ID.");
    positiveInteger(unit.movement, "Combat unit movement");
    positiveInteger(unit.initiative, "Combat unit initiative");
    positiveInteger(unit.maxHealth, "Combat unit maximum health");
    positiveInteger(unit.health, "Combat unit health");
    positiveInteger(unit.attackRange, "Combat unit attack range");
    positiveInteger(unit.attackDamage, "Combat unit attack damage");
    if (unit.health > unit.maxHealth) throw new Error("Combat unit health cannot exceed maximum health.");
    const cell = tacticalCellAt(board.map, unit.position);
    if (cell.blocksMovement) throw new Error(`Combat unit ${unit.id} occupies blocked terrain.`);
    const key = coordinateKey(unit.position);
    if (occupied.has(key)) throw new Error("Combat units cannot share a cell.");
    ids.add(unit.id);
    occupied.add(key);
  }
}

export function createTacticalCombatBoard(
  map: TacticalMap,
  units: readonly TacticalCombatUnit[],
): TacticalCombatBoardState {
  const board = {
    map: cloneTacticalMap(map),
    units: units.map(cloneTacticalCombatUnit),
  };
  validateTacticalCombatBoard(board);
  return board;
}

export function tacticalCombatInitiativeOrder(units: readonly TacticalCombatUnit[]): string[] {
  return [...units]
    .sort((left, right) => right.initiative - left.initiative || left.id.localeCompare(right.id))
    .map((unit) => unit.id);
}

export function activeTacticalCombatUnitId(state: TacticalCombatState): string | null {
  if (state.winnerPlayerId || state.draw || state.board.units.length === 0) return null;
  for (let offset = 0; offset < state.activationOrder.length; offset += 1) {
    const index = (state.activeActivationIndex + offset) % state.activationOrder.length;
    const unitId = state.activationOrder[index];
    if (state.board.units.some((unit) => unit.id === unitId)) return unitId;
  }
  return null;
}

export function tacticalCombatStatus(state: TacticalCombatState): GameStatus {
  if (state.winnerPlayerId) {
    return { lifecycle: "completed", winnerPlayerId: state.winnerPlayerId, draw: false };
  }
  if (state.draw) return { lifecycle: "completed", winnerPlayerId: null, draw: true };
  return { lifecycle: "active", winnerPlayerId: null, draw: false };
}

function lineStep(from: TacticalCoordinate, to: TacticalCoordinate): TacticalCoordinate | null {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const aligned = deltaX === 0 || deltaY === 0 || Math.abs(deltaX) === Math.abs(deltaY);
  if (!aligned || (deltaX === 0 && deltaY === 0)) return null;
  return { x: Math.sign(deltaX), y: Math.sign(deltaY) };
}

export function tacticalCombatLineOfSight(
  board: TacticalCombatBoardState,
  from: TacticalCoordinate,
  to: TacticalCoordinate,
  options: { ignoreUnitIds?: readonly string[] } = {},
): TacticalLineOfSightResult {
  const step = lineStep(from, to);
  if (!step) {
    return { aligned: false, clear: false, distance: 0, cells: [], blockedAt: null };
  }
  const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const cells: TacticalCoordinate[] = [];
  for (let index = 1; index < distance; index += 1) {
    cells.push({ x: from.x + step.x * index, y: from.y + step.y * index });
  }
  const ignored = new Set(options.ignoreUnitIds ?? []);
  const occupied = new Set(
    board.units
      .filter((unit) => !ignored.has(unit.id))
      .map((unit) => coordinateKey(unit.position)),
  );
  const blockedAt = cells.find((coordinate) => (
    tacticalCellAt(board.map, coordinate).terrain === "wall"
    || occupied.has(coordinateKey(coordinate))
  )) ?? null;
  return {
    aligned: true,
    clear: blockedAt === null,
    distance,
    cells: cells.map(cloneCoordinate),
    blockedAt: blockedAt ? cloneCoordinate(blockedAt) : null,
  };
}

export function listTacticalAttackActions(
  board: TacticalCombatBoardState,
  unitId: string,
): TacticalAttackAction[] {
  const attacker = tacticalCombatUnit(board, unitId);
  return board.units
    .filter((target) => target.ownerId !== attacker.ownerId)
    .flatMap((target) => {
      const sight = tacticalCombatLineOfSight(board, attacker.position, target.position, {
        ignoreUnitIds: [attacker.id, target.id],
      });
      if (!sight.aligned || !sight.clear || sight.distance > attacker.attackRange) return [];
      return [{
        type: "attack" as const,
        unitId: attacker.id,
        targetUnitId: target.id,
        from: cloneCoordinate(attacker.position),
        target: cloneCoordinate(target.position),
        range: sight.distance,
        damage: attacker.attackDamage,
      }];
    })
    .sort((left, right) => (
      left.range - right.range
      || left.targetUnitId.localeCompare(right.targetUnitId)
    ));
}

export function isSameTacticalAttackAction(
  left: TacticalAttackAction,
  right: TacticalAttackAction,
): boolean {
  return left.unitId === right.unitId
    && left.targetUnitId === right.targetUnitId
    && sameCoordinate(left.from, right.from)
    && sameCoordinate(left.target, right.target)
    && left.range === right.range
    && left.damage === right.damage;
}

export function isSameTacticalCombatAction(
  left: TacticalCombatAction,
  right: TacticalCombatAction,
): boolean {
  if (left.type !== right.type || left.unitId !== right.unitId) return false;
  if (left.type === "move" && right.type === "move") {
    return isSameTacticalMovementAction(left, right);
  }
  if (left.type === "attack" && right.type === "attack") {
    return isSameTacticalAttackAction(left, right);
  }
  return left.type === "end-activation" && right.type === "end-activation";
}

function movementBoard(board: TacticalCombatBoardState): TacticalBoardState {
  return {
    map: board.map,
    units: board.units,
  };
}

function applyCombatMove(
  board: TacticalCombatBoardState,
  action: TacticalMoveAction,
): TacticalCombatBoardState {
  const moved = applyTacticalMove(movementBoard(board), action);
  const next = createTacticalCombatBoard(
    moved.map,
    moved.units.map((unit) => ({
      ...tacticalCombatUnit(board, unit.id),
      position: cloneCoordinate(unit.position),
    })),
  );
  return next;
}

function survivingOwners(state: TacticalCombatState): PlayerId[] {
  return state.playerIds.filter((playerId) => state.board.units.some((unit) => unit.ownerId === playerId));
}

function completeCombatIfNeeded(state: TacticalCombatState): void {
  const owners = survivingOwners(state);
  if (owners.length === 1) {
    state.winnerPlayerId = owners[0];
    state.lastEffects.push({
      type: "combat-completed",
      winnerPlayerId: owners[0],
      draw: false,
    });
  } else if (owners.length === 0) {
    state.draw = true;
    state.lastEffects.push({ type: "combat-completed", winnerPlayerId: null, draw: true });
  }
}

function advanceCombatActivation(state: TacticalCombatState): void {
  const currentIndex = state.activeActivationIndex;
  const orderLength = state.activationOrder.length;
  if (orderLength === 0 || state.board.units.length === 0) return;

  for (let offset = 1; offset <= orderLength; offset += 1) {
    const candidateIndex = (currentIndex + offset) % orderLength;
    const unitId = state.activationOrder[candidateIndex];
    if (!state.board.units.some((unit) => unit.id === unitId)) continue;
    if (candidateIndex <= currentIndex) {
      state.round += 1;
      state.lastEffects.push({ type: "round-started", round: state.round });
    }
    state.activeActivationIndex = candidateIndex;
    state.movementUsed = false;
    state.primaryActionUsed = false;
    if (state.round > state.maxRounds) {
      state.draw = true;
      state.lastEffects.push({ type: "combat-completed", winnerPlayerId: null, draw: true });
    }
    return;
  }
}

function makeCombatUnit(input: TacticalCombatUnit): TacticalCombatUnit {
  return cloneTacticalCombatUnit(input);
}

export function createTacticalCombatState(playerIds: readonly PlayerId[]): TacticalCombatState {
  if (playerIds.length !== 2 || !playerIds[0]?.trim() || !playerIds[1]?.trim() || playerIds[0] === playerIds[1]) {
    throw new Error("The tactical combat canary requires exactly two distinct players.");
  }
  const players = [playerIds[0].trim(), playerIds[1].trim()] as [PlayerId, PlayerId];
  const units = [
    makeCombatUnit({
      id: "alpha-vanguard",
      ownerId: players[0],
      role: "vanguard",
      position: { x: 3, y: 3 },
      movement: 6,
      initiative: 12,
      maxHealth: 8,
      health: 8,
      attackRange: 1,
      attackDamage: 3,
      tags: ["melee", "frontline"],
    }),
    makeCombatUnit({
      id: "beta-vanguard",
      ownerId: players[1],
      role: "vanguard",
      position: { x: 20, y: 20 },
      movement: 6,
      initiative: 11,
      maxHealth: 8,
      health: 8,
      attackRange: 1,
      attackDamage: 3,
      tags: ["melee", "frontline"],
    }),
    makeCombatUnit({
      id: "alpha-ranger",
      ownerId: players[0],
      role: "ranger",
      position: { x: 4, y: 2 },
      movement: 5,
      initiative: 8,
      maxHealth: 5,
      health: 5,
      attackRange: 6,
      attackDamage: 2,
      tags: ["ranged"],
    }),
    makeCombatUnit({
      id: "beta-ranger",
      ownerId: players[1],
      role: "ranger",
      position: { x: 19, y: 21 },
      movement: 5,
      initiative: 7,
      maxHealth: 5,
      health: 5,
      attackRange: 6,
      attackDamage: 2,
      tags: ["ranged"],
    }),
  ];
  const board = createTacticalCombatBoard(createTacticalCanaryMap(), units);
  return {
    board,
    playerIds: players,
    activationOrder: tacticalCombatInitiativeOrder(units),
    activeActivationIndex: 0,
    round: 1,
    movementUsed: false,
    primaryActionUsed: false,
    defeatedUnitIds: [],
    winnerPlayerId: null,
    draw: false,
    maxRounds: TACTICAL_COMBAT_MAX_ROUNDS,
    lastEffects: [{ type: "round-started", round: 1 }],
  };
}

export const tacticalCombatDefinition: GameDefinition<
  TacticalCombatState,
  TacticalCombatAction,
  TacticalCombatObservation
> = {
  gameId: TACTICAL_COMBAT_GAME_ID,

  createInitialState: createTacticalCombatState,

  getStatus: tacticalCombatStatus,

  getActivePlayerId(state) {
    const unitId = activeTacticalCombatUnitId(state);
    return unitId ? tacticalCombatUnit(state.board, unitId).ownerId : null;
  },

  listLegalActions(state, playerId) {
    if (this.getStatus(state).lifecycle !== "active" || this.getActivePlayerId(state) !== playerId) return [];
    const unitId = activeTacticalCombatUnitId(state)!;
    const actions: TacticalCombatAction[] = [];
    if (!state.movementUsed) actions.push(...listTacticalMoveActions(movementBoard(state.board), unitId));
    if (!state.primaryActionUsed) actions.push(...listTacticalAttackActions(state.board, unitId));
    actions.push({ type: "end-activation", unitId });
    return actions;
  },

  isSameAction: isSameTacticalCombatAction,

  applyAction(state, playerId, action) {
    if (this.getActivePlayerId(state) !== playerId) {
      throw new Error("Cannot apply an action for an inactive tactical combat player.");
    }
    const canonical = this.listLegalActions(state, playerId)
      .find((candidate) => this.isSameAction(candidate, action));
    if (!canonical) throw new Error("Illegal tactical combat action.");

    const next = cloneTacticalCombatState(state);
    next.lastEffects = [];
    let summary: string;

    if (canonical.type === "move") {
      next.board = applyCombatMove(next.board, canonical);
      next.movementUsed = true;
      const destination = canonical.path.at(-1)!;
      next.lastEffects.push({
        type: "unit-moved",
        unitId: canonical.unitId,
        from: cloneCoordinate(canonical.from),
        to: cloneCoordinate(destination),
        path: canonical.path.map(cloneCoordinate),
        movementCost: canonical.movementCost,
      });
      summary = `${playerId} moved ${canonical.unitId} to ${coordinateKey(destination)}.`;
    } else if (canonical.type === "attack") {
      const target = tacticalCombatUnit(next.board, canonical.targetUnitId);
      const actualDamage = Math.min(canonical.damage, target.health);
      target.health -= actualDamage;
      next.primaryActionUsed = true;
      next.lastEffects.push({
        type: "unit-damaged",
        sourceUnitId: canonical.unitId,
        targetUnitId: target.id,
        damage: actualDamage,
        remainingHealth: target.health,
      });
      summary = `${playerId}'s ${canonical.unitId} dealt ${actualDamage} damage to ${target.id}.`;
      if (target.health === 0) {
        next.board.units = next.board.units.filter((unit) => unit.id !== target.id);
        next.defeatedUnitIds.push(target.id);
        next.lastEffects.push({
          type: "unit-defeated",
          sourceUnitId: canonical.unitId,
          targetUnitId: target.id,
        });
        summary += ` ${target.id} was defeated.`;
      }
      completeCombatIfNeeded(next);
    } else {
      next.lastEffects.push({ type: "activation-ended", unitId: canonical.unitId });
      summary = `${playerId} ended ${canonical.unitId}'s activation.`;
      advanceCombatActivation(next);
    }

    validateTacticalCombatBoard(next.board);
    return { state: next, summary };
  },

  getObservation(state, playerId) {
    return {
      board: cloneTacticalCombatBoard(state.board),
      yourPlayerId: playerId,
      activePlayerId: this.getActivePlayerId(state),
      activeUnitId: activeTacticalCombatUnitId(state),
      round: state.round,
      movementAvailable: !state.movementUsed,
      primaryActionAvailable: !state.primaryActionUsed,
      defeatedUnitIds: [...state.defeatedUnitIds],
      status: this.getStatus(state),
      legalActions: this.listLegalActions(state, playerId).map((action) => {
        if (action.type === "move") {
          return {
            ...action,
            from: cloneCoordinate(action.from),
            path: action.path.map(cloneCoordinate),
          };
        }
        if (action.type === "attack") {
          return {
            ...action,
            from: cloneCoordinate(action.from),
            target: cloneCoordinate(action.target),
          };
        }
        return { ...action };
      }),
      lastEffects: state.lastEffects.map(cloneEffect),
    };
  },

  cloneState: cloneTacticalCombatState,
};

function distanceBetween(left: TacticalCoordinate, right: TacticalCoordinate): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function compareMovePaths(left: TacticalMoveAction, right: TacticalMoveAction): number {
  const leftDestination = left.path.at(-1)!;
  const rightDestination = right.path.at(-1)!;
  return compareCoordinates(leftDestination, rightDestination)
    || left.movementCost - right.movementCost
    || left.path.length - right.path.length;
}

export class DeterministicTacticalCombatPlayer
  implements AgentPlayer<TacticalCombatAction, TacticalCombatObservation>
{
  readonly agentId: string;

  constructor(agentId = "theo") {
    this.agentId = agentId;
  }

  async chooseAction({
    observation,
    legalActions,
  }: {
    observation: TacticalCombatObservation;
    legalActions: readonly TacticalCombatAction[];
  }): Promise<TacticalCombatAction> {
    if (observation.activePlayerId !== this.agentId || legalActions.length === 0) {
      throw new Error("The tactical combat agent cannot act in the supplied observation.");
    }

    const attacks = legalActions.filter((action): action is TacticalAttackAction => action.type === "attack");
    if (attacks.length > 0) {
      return [...attacks].sort((left, right) => {
        const leftTarget = tacticalCombatUnit(observation.board, left.targetUnitId);
        const rightTarget = tacticalCombatUnit(observation.board, right.targetUnitId);
        const leftLethal = left.damage >= leftTarget.health ? 0 : 1;
        const rightLethal = right.damage >= rightTarget.health ? 0 : 1;
        return leftLethal - rightLethal
          || leftTarget.health - rightTarget.health
          || left.range - right.range
          || left.targetUnitId.localeCompare(right.targetUnitId);
      })[0];
    }

    const moves = legalActions.filter((action): action is TacticalMoveAction => action.type === "move");
    if (moves.length > 0) {
      const enemies = observation.board.units.filter((unit) => unit.ownerId !== this.agentId);
      return [...moves].sort((left, right) => {
        const leftDestination = left.path.at(-1)!;
        const rightDestination = right.path.at(-1)!;
        const leftDistance = Math.min(...enemies.map((enemy) => distanceBetween(leftDestination, enemy.position)));
        const rightDistance = Math.min(...enemies.map((enemy) => distanceBetween(rightDestination, enemy.position)));
        return leftDistance - rightDistance
          || right.movementCost - left.movementCost
          || compareMovePaths(left, right);
      })[0];
    }

    return legalActions.find((action) => action.type === "end-activation")!;
  }
}
