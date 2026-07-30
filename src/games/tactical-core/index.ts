import type { AgentPlayer } from "../../agents/agent-player.ts";
import type { GameDefinition, GameStatus, PlayerId } from "../../platform/contracts.ts";

export type TacticalTerrain = "floor" | "difficult" | "wall" | "objective";

export interface TacticalCoordinate {
  x: number;
  y: number;
}

export interface TacticalCell {
  terrain: TacticalTerrain;
  movementCost: number;
  blocksMovement: boolean;
  objectiveId?: string;
  tags?: string[];
}

export interface TacticalMap {
  width: number;
  height: number;
  cells: TacticalCell[];
}

export interface TacticalUnit {
  id: string;
  ownerId: PlayerId;
  position: TacticalCoordinate;
  movement: number;
  tags?: string[];
}

export interface TacticalBoardState {
  map: TacticalMap;
  units: TacticalUnit[];
}

export interface TacticalMoveAction {
  type: "move";
  unitId: string;
  from: TacticalCoordinate;
  path: TacticalCoordinate[];
  movementCost: number;
}

export interface TacticalEndActivationAction {
  type: "end-activation";
  unitId: string;
}

export type TacticalMovementAction = TacticalMoveAction | TacticalEndActivationAction;

export interface TacticalReachableCell {
  coordinate: TacticalCoordinate;
  path: TacticalCoordinate[];
  movementCost: number;
}

export interface TacticalMovementState {
  board: TacticalBoardState;
  playerIds: [PlayerId, PlayerId];
  activationOrder: string[];
  activeActivationIndex: number;
  round: number;
  objectiveId: string;
  winnerPlayerId: PlayerId | null;
  draw: boolean;
  maxRounds: number;
}

export interface TacticalMovementObservation {
  board: TacticalBoardState;
  yourPlayerId: PlayerId;
  activePlayerId: PlayerId | null;
  activeUnitId: string | null;
  round: number;
  objectiveId: string;
  status: GameStatus;
  legalActions: TacticalMovementAction[];
}

export const TACTICAL_CANARY_MAP_WIDTH = 24;
export const TACTICAL_CANARY_MAP_HEIGHT = 24;
export const TACTICAL_CANARY_OBJECTIVE_ID = "central-beacon";

function integer(value: number, name: string): number {
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

export function coordinateKey(coordinate: TacticalCoordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

export function sameCoordinate(left: TacticalCoordinate, right: TacticalCoordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

export function compareCoordinates(left: TacticalCoordinate, right: TacticalCoordinate): number {
  return left.y - right.y || left.x - right.x;
}

export function isCoordinateInBounds(map: Pick<TacticalMap, "width" | "height">, coordinate: TacticalCoordinate): boolean {
  return Number.isInteger(coordinate.x)
    && Number.isInteger(coordinate.y)
    && coordinate.x >= 0
    && coordinate.y >= 0
    && coordinate.x < map.width
    && coordinate.y < map.height;
}

export function tacticalCellIndex(map: Pick<TacticalMap, "width" | "height">, coordinate: TacticalCoordinate): number {
  if (!isCoordinateInBounds(map, coordinate)) {
    throw new Error(`Coordinate ${coordinateKey(coordinate)} is outside the tactical map.`);
  }
  return coordinate.y * map.width + coordinate.x;
}

export function tacticalCoordinateAt(map: Pick<TacticalMap, "width" | "height">, index: number): TacticalCoordinate {
  if (!Number.isInteger(index) || index < 0 || index >= map.width * map.height) {
    throw new Error(`Cell index ${index} is outside the tactical map.`);
  }
  return { x: index % map.width, y: Math.floor(index / map.width) };
}

export function tacticalCellAt(map: TacticalMap, coordinate: TacticalCoordinate): TacticalCell {
  return map.cells[tacticalCellIndex(map, coordinate)];
}

export function cloneTacticalMap(map: TacticalMap): TacticalMap {
  return {
    width: map.width,
    height: map.height,
    cells: map.cells.map((cell) => ({
      ...cell,
      ...(cell.tags ? { tags: [...cell.tags] } : {}),
    })),
  };
}

export function cloneTacticalBoardState(board: TacticalBoardState): TacticalBoardState {
  return {
    map: cloneTacticalMap(board.map),
    units: board.units.map((unit) => ({
      ...unit,
      position: { ...unit.position },
      ...(unit.tags ? { tags: [...unit.tags] } : {}),
    })),
  };
}

export function createTacticalMap(input: {
  width: number;
  height: number;
  defaultCell?: TacticalCell;
  overrides?: ReadonlyArray<{ coordinate: TacticalCoordinate; cell: TacticalCell }>;
}): TacticalMap {
  const width = integer(input.width, "Tactical map width");
  const height = integer(input.height, "Tactical map height");
  if (width < 1 || width > 128 || height < 1 || height > 128) {
    throw new Error("Tactical map dimensions must be between 1 and 128 cells.");
  }
  const defaultCell = validateCell(input.defaultCell ?? {
    terrain: "floor",
    movementCost: 1,
    blocksMovement: false,
  });
  const map: TacticalMap = {
    width,
    height,
    cells: Array.from({ length: width * height }, () => cloneCell(defaultCell)),
  };
  for (const override of input.overrides ?? []) {
    map.cells[tacticalCellIndex(map, override.coordinate)] = cloneCell(validateCell(override.cell));
  }
  return map;
}

function cloneCell(cell: TacticalCell): TacticalCell {
  return { ...cell, ...(cell.tags ? { tags: [...cell.tags] } : {}) };
}

function validateCell(cell: TacticalCell): TacticalCell {
  if (!Number.isFinite(cell.movementCost) || cell.movementCost <= 0) {
    throw new Error("Tactical cell movement cost must be positive and finite.");
  }
  if (cell.terrain === "wall" && !cell.blocksMovement) {
    throw new Error("Wall terrain must block movement.");
  }
  if (cell.terrain === "objective" && !cell.objectiveId?.trim()) {
    throw new Error("Objective terrain requires a stable objective ID.");
  }
  return cell;
}

export function createTacticalBoardState(map: TacticalMap, units: readonly TacticalUnit[]): TacticalBoardState {
  const board: TacticalBoardState = {
    map: cloneTacticalMap(map),
    units: units.map((unit) => ({
      ...unit,
      id: unit.id.trim(),
      ownerId: unit.ownerId.trim(),
      position: { ...unit.position },
      ...(unit.tags ? { tags: [...unit.tags] } : {}),
    })),
  };
  validateTacticalBoardState(board);
  return board;
}

export function validateTacticalBoardState(board: TacticalBoardState): void {
  if (board.map.cells.length !== board.map.width * board.map.height) {
    throw new Error("Tactical map cell count does not match its dimensions.");
  }
  board.map.cells.forEach(validateCell);

  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const unit of board.units) {
    if (!unit.id || ids.has(unit.id)) throw new Error("Tactical unit IDs must be non-empty and unique.");
    if (!unit.ownerId) throw new Error("Tactical units require a non-empty owner ID.");
    if (!Number.isInteger(unit.movement) || unit.movement < 1) {
      throw new Error("Tactical unit movement must be a positive integer.");
    }
    if (!isCoordinateInBounds(board.map, unit.position)) {
      throw new Error(`Tactical unit ${unit.id} is outside the map.`);
    }
    if (tacticalCellAt(board.map, unit.position).blocksMovement) {
      throw new Error(`Tactical unit ${unit.id} occupies blocked terrain.`);
    }
    const key = coordinateKey(unit.position);
    if (occupied.has(key)) throw new Error("Tactical units cannot share a cell.");
    ids.add(unit.id);
    occupied.add(key);
  }
}

export function tacticalUnit(board: TacticalBoardState, unitId: string): TacticalUnit {
  const unit = board.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error(`Unknown tactical unit: ${unitId}`);
  return unit;
}

export function tacticalOccupancy(board: TacticalBoardState, ignoredUnitId?: string): Map<string, TacticalUnit> {
  return new Map(
    board.units
      .filter((unit) => unit.id !== ignoredUnitId)
      .map((unit) => [coordinateKey(unit.position), unit]),
  );
}

export function tacticalNeighbors(map: TacticalMap, coordinate: TacticalCoordinate): TacticalCoordinate[] {
  return [
    { x: coordinate.x, y: coordinate.y - 1 },
    { x: coordinate.x - 1, y: coordinate.y },
    { x: coordinate.x + 1, y: coordinate.y },
    { x: coordinate.x, y: coordinate.y + 1 },
  ]
    .filter((candidate) => isCoordinateInBounds(map, candidate))
    .sort(compareCoordinates);
}

function comparePaths(left: readonly TacticalCoordinate[], right: readonly TacticalCoordinate[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const coordinateDifference = compareCoordinates(left[index], right[index]);
    if (coordinateDifference) return coordinateDifference;
  }
  return left.length - right.length;
}

interface TacticalSearchRecord {
  coordinate: TacticalCoordinate;
  path: TacticalCoordinate[];
  movementCost: number;
}

function searchReachable(board: TacticalBoardState, unitId: string, maximumCost: number): Map<string, TacticalSearchRecord> {
  const unit = tacticalUnit(board, unitId);
  const occupied = tacticalOccupancy(board, unitId);
  const origin: TacticalSearchRecord = {
    coordinate: { ...unit.position },
    path: [],
    movementCost: 0,
  };
  const best = new Map<string, TacticalSearchRecord>([[coordinateKey(origin.coordinate), origin]]);
  const frontier: TacticalSearchRecord[] = [origin];

  while (frontier.length > 0) {
    frontier.sort((left, right) => (
      left.movementCost - right.movementCost
      || compareCoordinates(left.coordinate, right.coordinate)
      || comparePaths(left.path, right.path)
    ));
    const current = frontier.shift()!;
    const currentBest = best.get(coordinateKey(current.coordinate));
    if (!currentBest || currentBest.movementCost !== current.movementCost || comparePaths(currentBest.path, current.path) !== 0) {
      continue;
    }

    for (const neighbor of tacticalNeighbors(board.map, current.coordinate)) {
      const cell = tacticalCellAt(board.map, neighbor);
      if (cell.blocksMovement || occupied.has(coordinateKey(neighbor))) continue;
      const movementCost = current.movementCost + cell.movementCost;
      if (movementCost > maximumCost) continue;
      const path = [...current.path, { ...neighbor }];
      const key = coordinateKey(neighbor);
      const existing = best.get(key);
      if (
        !existing
        || movementCost < existing.movementCost
        || (movementCost === existing.movementCost && comparePaths(path, existing.path) < 0)
      ) {
        const next = { coordinate: { ...neighbor }, path, movementCost };
        best.set(key, next);
        frontier.push(next);
      }
    }
  }

  best.delete(coordinateKey(unit.position));
  return best;
}

export function listTacticalReachableCells(
  board: TacticalBoardState,
  unitId: string,
  maximumCost = tacticalUnit(board, unitId).movement,
): TacticalReachableCell[] {
  if (!Number.isFinite(maximumCost) || maximumCost < 0) {
    throw new Error("Maximum tactical movement cost must be non-negative and finite.");
  }
  return [...searchReachable(board, unitId, maximumCost).values()]
    .sort((left, right) => (
      left.movementCost - right.movementCost
      || compareCoordinates(left.coordinate, right.coordinate)
      || comparePaths(left.path, right.path)
    ))
    .map((record) => ({
      coordinate: { ...record.coordinate },
      path: record.path.map((coordinate) => ({ ...coordinate })),
      movementCost: record.movementCost,
    }));
}

export function findTacticalPath(
  board: TacticalBoardState,
  unitId: string,
  destination: TacticalCoordinate,
  maximumCost = tacticalUnit(board, unitId).movement,
): TacticalReachableCell | null {
  const record = searchReachable(board, unitId, maximumCost).get(coordinateKey(destination));
  return record
    ? {
        coordinate: { ...record.coordinate },
        path: record.path.map((coordinate) => ({ ...coordinate })),
        movementCost: record.movementCost,
      }
    : null;
}

export function listTacticalMoveActions(board: TacticalBoardState, unitId: string): TacticalMoveAction[] {
  const unit = tacticalUnit(board, unitId);
  return listTacticalReachableCells(board, unitId).map((reachable) => ({
    type: "move",
    unitId,
    from: { ...unit.position },
    path: reachable.path.map((coordinate) => ({ ...coordinate })),
    movementCost: reachable.movementCost,
  }));
}

function sameCoordinateArray(left: readonly TacticalCoordinate[], right: readonly TacticalCoordinate[]): boolean {
  return left.length === right.length && left.every((coordinate, index) => sameCoordinate(coordinate, right[index]));
}

export function isSameTacticalMovementAction(
  left: TacticalMovementAction,
  right: TacticalMovementAction,
): boolean {
  if (left.type !== right.type || left.unitId !== right.unitId) return false;
  if (left.type === "end-activation" || right.type === "end-activation") return true;
  return sameCoordinate(left.from, right.from)
    && left.movementCost === right.movementCost
    && sameCoordinateArray(left.path, right.path);
}

export function applyTacticalMove(board: TacticalBoardState, action: TacticalMoveAction): TacticalBoardState {
  const canonical = listTacticalMoveActions(board, action.unitId)
    .find((candidate) => isSameTacticalMovementAction(candidate, action));
  if (!canonical) throw new Error("Illegal tactical movement action.");
  const destination = canonical.path.at(-1)!;
  const next = cloneTacticalBoardState(board);
  tacticalUnit(next, canonical.unitId).position = { ...destination };
  validateTacticalBoardState(next);
  return next;
}

function wallCell(): TacticalCell {
  return { terrain: "wall", movementCost: 1, blocksMovement: true, tags: ["blocks-movement"] };
}

function difficultCell(): TacticalCell {
  return { terrain: "difficult", movementCost: 2, blocksMovement: false, tags: ["slow"] };
}

function objectiveCell(): TacticalCell {
  return {
    terrain: "objective",
    movementCost: 1,
    blocksMovement: false,
    objectiveId: TACTICAL_CANARY_OBJECTIVE_ID,
    tags: ["objective"],
  };
}

export function createTacticalCanaryMap(): TacticalMap {
  const overrides: Array<{ coordinate: TacticalCoordinate; cell: TacticalCell }> = [];
  for (let y = 4; y <= 19; y += 1) {
    if (y !== 9 && y !== 15) overrides.push({ coordinate: { x: 8, y }, cell: wallCell() });
    if (y !== 7 && y !== 14) overrides.push({ coordinate: { x: 15, y }, cell: wallCell() });
  }
  for (let x = 4; x <= 19; x += 1) {
    if (x >= 10 && x <= 13) continue;
    overrides.push({ coordinate: { x, y: 11 }, cell: difficultCell() });
  }
  overrides.push({ coordinate: { x: 12, y: 12 }, cell: objectiveCell() });
  return createTacticalMap({
    width: TACTICAL_CANARY_MAP_WIDTH,
    height: TACTICAL_CANARY_MAP_HEIGHT,
    overrides,
  });
}

export function createTacticalMovementState(playerIds: readonly PlayerId[]): TacticalMovementState {
  if (playerIds.length !== 2 || !playerIds[0]?.trim() || !playerIds[1]?.trim() || playerIds[0] === playerIds[1]) {
    throw new Error("The tactical movement canary requires exactly two distinct players.");
  }
  const normalizedPlayers = [playerIds[0].trim(), playerIds[1].trim()] as [PlayerId, PlayerId];
  const board = createTacticalBoardState(createTacticalCanaryMap(), [
    {
      id: "unit-alpha",
      ownerId: normalizedPlayers[0],
      position: { x: 2, y: 2 },
      movement: 6,
      tags: ["canary-unit"],
    },
    {
      id: "unit-beta",
      ownerId: normalizedPlayers[1],
      position: { x: 21, y: 21 },
      movement: 6,
      tags: ["canary-unit"],
    },
  ]);
  return {
    board,
    playerIds: normalizedPlayers,
    activationOrder: ["unit-alpha", "unit-beta"],
    activeActivationIndex: 0,
    round: 1,
    objectiveId: TACTICAL_CANARY_OBJECTIVE_ID,
    winnerPlayerId: null,
    draw: false,
    maxRounds: 20,
  };
}

export function cloneTacticalMovementState(state: TacticalMovementState): TacticalMovementState {
  return {
    board: cloneTacticalBoardState(state.board),
    playerIds: [...state.playerIds] as [PlayerId, PlayerId],
    activationOrder: [...state.activationOrder],
    activeActivationIndex: state.activeActivationIndex,
    round: state.round,
    objectiveId: state.objectiveId,
    winnerPlayerId: state.winnerPlayerId,
    draw: state.draw,
    maxRounds: state.maxRounds,
  };
}

export function activeTacticalUnitId(state: TacticalMovementState): string | null {
  if (state.winnerPlayerId || state.draw) return null;
  return state.activationOrder[state.activeActivationIndex] ?? null;
}

function tacticalMovementStatus(state: TacticalMovementState): GameStatus {
  if (state.winnerPlayerId) {
    return { lifecycle: "completed", winnerPlayerId: state.winnerPlayerId, draw: false };
  }
  if (state.draw) return { lifecycle: "completed", winnerPlayerId: null, draw: true };
  return { lifecycle: "active", winnerPlayerId: null, draw: false };
}

function objectiveCoordinate(state: TacticalMovementState): TacticalCoordinate {
  const index = state.board.map.cells.findIndex((cell) => cell.objectiveId === state.objectiveId);
  if (index < 0) throw new Error(`Unknown tactical objective: ${state.objectiveId}`);
  return tacticalCoordinateAt(state.board.map, index);
}

function advanceTacticalActivation(state: TacticalMovementState): void {
  state.activeActivationIndex += 1;
  if (state.activeActivationIndex >= state.activationOrder.length) {
    state.activeActivationIndex = 0;
    state.round += 1;
  }
  if (state.round > state.maxRounds) state.draw = true;
}

export const tacticalMovementDefinition: GameDefinition<
  TacticalMovementState,
  TacticalMovementAction,
  TacticalMovementObservation
> = {
  gameId: "tactical-movement-canary",

  createInitialState(playerIds) {
    return createTacticalMovementState(playerIds);
  },

  getStatus: tacticalMovementStatus,

  getActivePlayerId(state) {
    const unitId = activeTacticalUnitId(state);
    return unitId ? tacticalUnit(state.board, unitId).ownerId : null;
  },

  listLegalActions(state, playerId) {
    if (this.getStatus(state).lifecycle !== "active" || this.getActivePlayerId(state) !== playerId) return [];
    const unitId = activeTacticalUnitId(state)!;
    const moves = listTacticalMoveActions(state.board, unitId);
    return moves.length > 0 ? moves : [{ type: "end-activation", unitId }];
  },

  isSameAction: isSameTacticalMovementAction,

  applyAction(state, playerId, action) {
    if (this.getActivePlayerId(state) !== playerId) {
      throw new Error("Cannot apply an action for an inactive tactical player.");
    }
    const canonical = this.listLegalActions(state, playerId)
      .find((candidate) => this.isSameAction(candidate, action));
    if (!canonical) throw new Error("Illegal tactical movement-canary action.");

    const next = cloneTacticalMovementState(state);
    if (canonical.type === "move") {
      next.board = applyTacticalMove(next.board, canonical);
      const unit = tacticalUnit(next.board, canonical.unitId);
      if (sameCoordinate(unit.position, objectiveCoordinate(next))) {
        next.winnerPlayerId = unit.ownerId;
      }
    }
    if (!next.winnerPlayerId) advanceTacticalActivation(next);

    const summary = canonical.type === "move"
      ? `${playerId} moved ${canonical.unitId} to ${coordinateKey(canonical.path.at(-1)!)} for ${canonical.movementCost} movement.`
      : `${playerId} ended ${canonical.unitId}'s activation.`;
    return { state: next, summary };
  },

  getObservation(state, playerId) {
    return {
      board: cloneTacticalBoardState(state.board),
      yourPlayerId: playerId,
      activePlayerId: this.getActivePlayerId(state),
      activeUnitId: activeTacticalUnitId(state),
      round: state.round,
      objectiveId: state.objectiveId,
      status: this.getStatus(state),
      legalActions: this.listLegalActions(state, playerId).map((action) => (
        action.type === "move"
          ? {
              ...action,
              from: { ...action.from },
              path: action.path.map((coordinate) => ({ ...coordinate })),
            }
          : { ...action }
      )),
    };
  },

  cloneState: cloneTacticalMovementState,
};

export class DeterministicTacticalMovementPlayer
  implements AgentPlayer<TacticalMovementAction, TacticalMovementObservation>
{
  readonly agentId: string;

  constructor(agentId = "theo") {
    this.agentId = agentId;
  }

  async chooseAction({
    observation,
    legalActions,
  }: {
    observation: TacticalMovementObservation;
    legalActions: readonly TacticalMovementAction[];
  }): Promise<TacticalMovementAction> {
    if (observation.activePlayerId !== this.agentId || legalActions.length === 0) {
      throw new Error("The tactical movement agent cannot act in the supplied observation.");
    }
    const objectiveIndex = observation.board.map.cells.findIndex(
      (cell) => cell.objectiveId === observation.objectiveId,
    );
    const objective = tacticalCoordinateAt(observation.board.map, objectiveIndex);
    return [...legalActions].sort((left, right) => {
      if (left.type !== right.type) return left.type === "move" ? -1 : 1;
      if (left.type === "end-activation" || right.type === "end-activation") return 0;
      const leftDestination = left.path.at(-1)!;
      const rightDestination = right.path.at(-1)!;
      const leftDistance = Math.abs(leftDestination.x - objective.x) + Math.abs(leftDestination.y - objective.y);
      const rightDistance = Math.abs(rightDestination.x - objective.x) + Math.abs(rightDestination.y - objective.y);
      return leftDistance - rightDistance
        || right.movementCost - left.movementCost
        || comparePaths(left.path, right.path);
    })[0];
  }
}
