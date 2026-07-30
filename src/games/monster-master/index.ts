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
import { tacticalCombatLineOfSight } from "../tactical-combat/index.ts";

export const MONSTER_MASTER_GAME_ID = "monster-master-duel";
export const MONSTER_MASTER_MAX_ROUNDS = 24;
export const MONSTER_MASTER_MAX_COMMAND = 3;
export const MONSTER_MASTER_STARTING_COMMAND = 2;

export type MonsterMasterPhase = "deployment" | "combat";
export type MonsterMasterRole = "master" | "bulwark" | "emberling";
export type MonsterMasterAbilityId = "mend";

export interface MonsterMasterUnit extends TacticalUnit {
  contentId: string;
  role: MonsterMasterRole;
  initiative: number;
  maxHealth: number;
  health: number;
  attackRange: number;
  attackDamage: number;
  abilityIds: MonsterMasterAbilityId[];
}

export interface MonsterMasterBoardState {
  map: TacticalMap;
  units: MonsterMasterUnit[];
}

export interface MonsterMasterDeployAction {
  type: "deploy-unit";
  unitId: string;
  position: TacticalCoordinate;
}

export interface MonsterMasterAttackAction {
  type: "attack";
  unitId: string;
  targetUnitId: string;
  from: TacticalCoordinate;
  target: TacticalCoordinate;
  range: number;
  damage: number;
}

export interface MonsterMasterAbilityAction {
  type: "use-ability";
  abilityId: MonsterMasterAbilityId;
  unitId: string;
  targetUnitId: string;
  from: TacticalCoordinate;
  target: TacticalCoordinate;
  range: number;
  commandCost: number;
  healing: number;
}

export interface MonsterMasterEndActivationAction {
  type: "end-activation";
  unitId: string;
}

export type MonsterMasterAction =
  | MonsterMasterDeployAction
  | TacticalMoveAction
  | MonsterMasterAttackAction
  | MonsterMasterAbilityAction
  | MonsterMasterEndActivationAction;

export type MonsterMasterEffect =
  | { type: "unit-deployed"; unitId: string; position: TacticalCoordinate }
  | { type: "combat-started"; round: number }
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
      type: "unit-healed";
      sourceUnitId: string;
      targetUnitId: string;
      healing: number;
      resultingHealth: number;
    }
  | { type: "command-spent"; playerId: PlayerId; amount: number; remaining: number }
  | { type: "command-restored"; playerId: PlayerId; amount: number; resulting: number }
  | { type: "unit-defeated"; sourceUnitId: string; targetUnitId: string; role: MonsterMasterRole }
  | { type: "activation-ended"; unitId: string }
  | { type: "round-started"; round: number }
  | { type: "duel-completed"; winnerPlayerId: PlayerId | null; draw: boolean };

export interface MonsterMasterState {
  phase: MonsterMasterPhase;
  board: MonsterMasterBoardState;
  playerIds: [PlayerId, PlayerId];
  rosters: Record<PlayerId, MonsterMasterUnit[]>;
  undeployedUnitIds: string[];
  deploymentPlayerIndex: number;
  activationOrder: string[];
  activeActivationIndex: number;
  round: number;
  movementUsed: boolean;
  primaryActionUsed: boolean;
  commandByPlayer: Record<PlayerId, number>;
  defeatedUnitIds: string[];
  winnerPlayerId: PlayerId | null;
  draw: boolean;
  maxRounds: number;
  lastEffects: MonsterMasterEffect[];
}

export interface MonsterMasterObservation {
  phase: MonsterMasterPhase;
  board: MonsterMasterBoardState;
  yourPlayerId: PlayerId;
  playerIds: [PlayerId, PlayerId];
  rosters: Record<PlayerId, MonsterMasterUnit[]>;
  undeployedUnitIds: string[];
  activePlayerId: PlayerId | null;
  activeUnitId: string | null;
  round: number;
  movementAvailable: boolean;
  primaryActionAvailable: boolean;
  commandByPlayer: Record<PlayerId, number>;
  defeatedUnitIds: string[];
  status: GameStatus;
  legalActions: MonsterMasterAction[];
  lastEffects: MonsterMasterEffect[];
}

interface UnitTemplate {
  role: MonsterMasterRole;
  contentId: string;
  movement: number;
  initiative: number;
  maxHealth: number;
  attackRange: number;
  attackDamage: number;
  abilityIds: MonsterMasterAbilityId[];
}

const UNIT_TEMPLATES: Record<MonsterMasterRole, UnitTemplate> = {
  master: {
    role: "master",
    contentId: "warden-master-v1",
    movement: 4,
    initiative: 7,
    maxHealth: 14,
    attackRange: 4,
    attackDamage: 3,
    abilityIds: ["mend"],
  },
  bulwark: {
    role: "bulwark",
    contentId: "stone-bulwark-v1",
    movement: 3,
    initiative: 5,
    maxHealth: 12,
    attackRange: 1,
    attackDamage: 4,
    abilityIds: [],
  },
  emberling: {
    role: "emberling",
    contentId: "emberling-skirmisher-v1",
    movement: 6,
    initiative: 9,
    maxHealth: 8,
    attackRange: 3,
    attackDamage: 3,
    abilityIds: [],
  },
};

const ROLE_ORDER: MonsterMasterRole[] = ["master", "bulwark", "emberling"];

function cloneCoordinate(coordinate: TacticalCoordinate): TacticalCoordinate {
  return { x: coordinate.x, y: coordinate.y };
}

function cloneEffect(effect: MonsterMasterEffect): MonsterMasterEffect {
  if (effect.type === "unit-deployed") return { ...effect, position: cloneCoordinate(effect.position) };
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

export function cloneMonsterMasterUnit(unit: MonsterMasterUnit): MonsterMasterUnit {
  return {
    ...unit,
    position: cloneCoordinate(unit.position),
    abilityIds: [...unit.abilityIds],
    ...(unit.tags ? { tags: [...unit.tags] } : {}),
  };
}

export function cloneMonsterMasterBoard(board: MonsterMasterBoardState): MonsterMasterBoardState {
  return {
    map: cloneTacticalMap(board.map),
    units: board.units.map(cloneMonsterMasterUnit),
  };
}

function cloneRosterMap(rosters: Record<PlayerId, MonsterMasterUnit[]>): Record<PlayerId, MonsterMasterUnit[]> {
  return Object.fromEntries(
    Object.entries(rosters).map(([playerId, units]) => [playerId, units.map(cloneMonsterMasterUnit)]),
  );
}

export function cloneMonsterMasterState(state: MonsterMasterState): MonsterMasterState {
  return {
    phase: state.phase,
    board: cloneMonsterMasterBoard(state.board),
    playerIds: [...state.playerIds] as [PlayerId, PlayerId],
    rosters: cloneRosterMap(state.rosters),
    undeployedUnitIds: [...state.undeployedUnitIds],
    deploymentPlayerIndex: state.deploymentPlayerIndex,
    activationOrder: [...state.activationOrder],
    activeActivationIndex: state.activeActivationIndex,
    round: state.round,
    movementUsed: state.movementUsed,
    primaryActionUsed: state.primaryActionUsed,
    commandByPlayer: { ...state.commandByPlayer },
    defeatedUnitIds: [...state.defeatedUnitIds],
    winnerPlayerId: state.winnerPlayerId,
    draw: state.draw,
    maxRounds: state.maxRounds,
    lastEffects: state.lastEffects.map(cloneEffect),
  };
}

function validatePlayers(playerIds: readonly PlayerId[]): [PlayerId, PlayerId] {
  const normalized = playerIds.map((playerId) => playerId.trim());
  if (
    normalized.length !== 2
    || normalized.some((playerId) => !playerId)
    || normalized[0] === normalized[1]
  ) {
    throw new Error("Monster Master requires exactly two distinct player IDs.");
  }
  return normalized as [PlayerId, PlayerId];
}

function createRosterUnit(playerIndex: number, ownerId: PlayerId, role: MonsterMasterRole): MonsterMasterUnit {
  const template = UNIT_TEMPLATES[role];
  return {
    id: `${playerIndex === 0 ? "alpha" : "beta"}-${role}`,
    ownerId,
    contentId: template.contentId,
    role,
    position: { x: -1, y: -1 },
    movement: template.movement,
    initiative: template.initiative,
    maxHealth: template.maxHealth,
    health: template.maxHealth,
    attackRange: template.attackRange,
    attackDamage: template.attackDamage,
    abilityIds: [...template.abilityIds],
    tags: ["monster-master-unit", role],
  };
}

export function createMonsterMasterRoster(
  playerIndex: number,
  ownerId: PlayerId,
): MonsterMasterUnit[] {
  return ROLE_ORDER.map((role) => createRosterUnit(playerIndex, ownerId, role));
}

function deploymentCoordinates(map: TacticalMap, playerIndex: number): TacticalCoordinate[] {
  const minimumX = playerIndex === 0 ? 1 : map.width - 5;
  const maximumX = playerIndex === 0 ? 4 : map.width - 2;
  const coordinates: TacticalCoordinate[] = [];
  for (let y = 3; y < map.height - 3; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const coordinate = { x, y };
      if (!tacticalCellAt(map, coordinate).blocksMovement) coordinates.push(coordinate);
    }
  }
  return coordinates.sort(compareCoordinates);
}

export function isMonsterMasterDeploymentCoordinate(
  map: TacticalMap,
  playerIndex: number,
  coordinate: TacticalCoordinate,
): boolean {
  return deploymentCoordinates(map, playerIndex).some((candidate) => sameCoordinate(candidate, coordinate));
}

export function createMonsterMasterState(playerIds: readonly PlayerId[]): MonsterMasterState {
  const players = validatePlayers(playerIds);
  const alphaRoster = createMonsterMasterRoster(0, players[0]);
  const betaRoster = createMonsterMasterRoster(1, players[1]);
  const rosters = {
    [players[0]]: alphaRoster,
    [players[1]]: betaRoster,
  };
  return {
    phase: "deployment",
    board: { map: createTacticalCanaryMap(), units: [] },
    playerIds: players,
    rosters,
    undeployedUnitIds: [...alphaRoster, ...betaRoster].map((unit) => unit.id),
    deploymentPlayerIndex: 0,
    activationOrder: [],
    activeActivationIndex: 0,
    round: 0,
    movementUsed: false,
    primaryActionUsed: false,
    commandByPlayer: {
      [players[0]]: MONSTER_MASTER_STARTING_COMMAND,
      [players[1]]: MONSTER_MASTER_STARTING_COMMAND,
    },
    defeatedUnitIds: [],
    winnerPlayerId: null,
    draw: false,
    maxRounds: MONSTER_MASTER_MAX_ROUNDS,
    lastEffects: [],
  };
}

export function monsterMasterUnit(
  stateOrBoard: MonsterMasterState | MonsterMasterBoardState,
  unitId: string,
): MonsterMasterUnit {
  const board = "board" in stateOrBoard ? stateOrBoard.board : stateOrBoard;
  const deployed = board.units.find((unit) => unit.id === unitId);
  if (deployed) return deployed;
  if ("rosters" in stateOrBoard) {
    for (const roster of Object.values(stateOrBoard.rosters)) {
      const unit = roster.find((candidate) => candidate.id === unitId);
      if (unit) return unit;
    }
  }
  throw new Error(`Unknown Monster Master unit: ${unitId}`);
}

function deploymentActivePlayerId(state: MonsterMasterState): PlayerId | null {
  return state.phase === "deployment" ? state.playerIds[state.deploymentPlayerIndex] : null;
}

export function activeMonsterMasterUnitId(state: MonsterMasterState): string | null {
  if (state.phase !== "combat" || state.winnerPlayerId || state.draw) return null;
  for (let offset = 0; offset < state.activationOrder.length; offset += 1) {
    const index = (state.activeActivationIndex + offset) % state.activationOrder.length;
    const unitId = state.activationOrder[index];
    if (state.board.units.some((unit) => unit.id === unitId)) return unitId;
  }
  return null;
}

export function monsterMasterStatus(state: MonsterMasterState): GameStatus {
  if (state.winnerPlayerId) {
    return { lifecycle: "completed", winnerPlayerId: state.winnerPlayerId, draw: false };
  }
  if (state.draw) return { lifecycle: "completed", winnerPlayerId: null, draw: true };
  return { lifecycle: "active", winnerPlayerId: null, draw: false };
}

function currentActivePlayerId(state: MonsterMasterState): PlayerId | null {
  if (monsterMasterStatus(state).lifecycle === "completed") return null;
  if (state.phase === "deployment") return deploymentActivePlayerId(state);
  const unitId = activeMonsterMasterUnitId(state);
  return unitId ? monsterMasterUnit(state, unitId).ownerId : null;
}

function deploymentActions(state: MonsterMasterState, playerId: PlayerId): MonsterMasterDeployAction[] {
  if (deploymentActivePlayerId(state) !== playerId) return [];
  const playerIndex = state.playerIds.indexOf(playerId);
  const occupied = new Set(state.board.units.map((unit) => coordinateKey(unit.position)));
  const undeployed = state.rosters[playerId]
    .filter((unit) => state.undeployedUnitIds.includes(unit.id))
    .sort((left, right) => ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role));
  return undeployed.flatMap((unit) => deploymentCoordinates(state.board.map, playerIndex)
    .filter((coordinate) => !occupied.has(coordinateKey(coordinate)))
    .map((position) => ({
      type: "deploy-unit" as const,
      unitId: unit.id,
      position: cloneCoordinate(position),
    })));
}

function movementBoard(board: MonsterMasterBoardState): TacticalBoardState {
  return { map: board.map, units: board.units };
}

function listAttackActions(state: MonsterMasterState, unitId: string): MonsterMasterAttackAction[] {
  const attacker = monsterMasterUnit(state, unitId);
  return state.board.units
    .filter((target) => target.ownerId !== attacker.ownerId)
    .flatMap((target) => {
      const sight = tacticalCombatLineOfSight(
        { map: state.board.map, units: state.board.units },
        attacker.position,
        target.position,
        { ignoreUnitIds: [attacker.id, target.id] },
      );
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
    .sort((left, right) => left.range - right.range || left.targetUnitId.localeCompare(right.targetUnitId));
}

function listMendActions(state: MonsterMasterState, unitId: string): MonsterMasterAbilityAction[] {
  const source = monsterMasterUnit(state, unitId);
  if (
    source.role !== "master"
    || !source.abilityIds.includes("mend")
    || state.commandByPlayer[source.ownerId] < 1
  ) {
    return [];
  }
  return state.board.units
    .filter((target) => target.ownerId === source.ownerId && target.health < target.maxHealth)
    .flatMap((target) => {
      const sight = tacticalCombatLineOfSight(
        { map: state.board.map, units: state.board.units },
        source.position,
        target.position,
        { ignoreUnitIds: [source.id, target.id] },
      );
      if (!sight.aligned || !sight.clear || sight.distance > 3) return [];
      return [{
        type: "use-ability" as const,
        abilityId: "mend" as const,
        unitId: source.id,
        targetUnitId: target.id,
        from: cloneCoordinate(source.position),
        target: cloneCoordinate(target.position),
        range: sight.distance,
        commandCost: 1,
        healing: Math.min(3, target.maxHealth - target.health),
      }];
    })
    .sort((left, right) => left.range - right.range || left.targetUnitId.localeCompare(right.targetUnitId));
}

function combatActions(state: MonsterMasterState, playerId: PlayerId): MonsterMasterAction[] {
  const unitId = activeMonsterMasterUnitId(state);
  if (!unitId || monsterMasterUnit(state, unitId).ownerId !== playerId) return [];
  const actions: MonsterMasterAction[] = [];
  if (!state.movementUsed) actions.push(...listTacticalMoveActions(movementBoard(state.board), unitId));
  if (!state.primaryActionUsed) {
    actions.push(...listAttackActions(state, unitId));
    actions.push(...listMendActions(state, unitId));
  }
  actions.push({ type: "end-activation", unitId });
  return actions;
}

function sameDeploy(left: MonsterMasterDeployAction, right: MonsterMasterDeployAction): boolean {
  return left.unitId === right.unitId && sameCoordinate(left.position, right.position);
}

function sameAttack(left: MonsterMasterAttackAction, right: MonsterMasterAttackAction): boolean {
  return left.unitId === right.unitId
    && left.targetUnitId === right.targetUnitId
    && sameCoordinate(left.from, right.from)
    && sameCoordinate(left.target, right.target)
    && left.range === right.range
    && left.damage === right.damage;
}

function sameAbility(left: MonsterMasterAbilityAction, right: MonsterMasterAbilityAction): boolean {
  return left.abilityId === right.abilityId
    && left.unitId === right.unitId
    && left.targetUnitId === right.targetUnitId
    && sameCoordinate(left.from, right.from)
    && sameCoordinate(left.target, right.target)
    && left.range === right.range
    && left.commandCost === right.commandCost
    && left.healing === right.healing;
}

export function isSameMonsterMasterAction(
  left: MonsterMasterAction,
  right: MonsterMasterAction,
): boolean {
  if (left.type !== right.type) return false;
  if (left.type === "deploy-unit" && right.type === "deploy-unit") return sameDeploy(left, right);
  if (left.type === "move" && right.type === "move") return isSameTacticalMovementAction(left, right);
  if (left.type === "attack" && right.type === "attack") return sameAttack(left, right);
  if (left.type === "use-ability" && right.type === "use-ability") return sameAbility(left, right);
  return left.type === "end-activation"
    && right.type === "end-activation"
    && left.unitId === right.unitId;
}

function beginCombat(state: MonsterMasterState): void {
  state.phase = "combat";
  state.activationOrder = [...state.board.units]
    .sort((left, right) => right.initiative - left.initiative || left.id.localeCompare(right.id))
    .map((unit) => unit.id);
  state.activeActivationIndex = 0;
  state.round = 1;
  state.movementUsed = false;
  state.primaryActionUsed = false;
  state.lastEffects.push({ type: "combat-started", round: 1 });
}

function applyDeployment(state: MonsterMasterState, action: MonsterMasterDeployAction): void {
  const playerId = deploymentActivePlayerId(state);
  if (!playerId) throw new Error("No Monster Master player is deploying.");
  const unit = monsterMasterUnit(state, action.unitId);
  const playerIndex = state.playerIds.indexOf(playerId);
  if (unit.ownerId !== playerId) throw new Error("Cannot deploy another player's unit.");
  if (!state.undeployedUnitIds.includes(unit.id)) throw new Error("Monster Master unit is already deployed.");
  if (!isMonsterMasterDeploymentCoordinate(state.board.map, playerIndex, action.position)) {
    throw new Error("Monster Master deployment position is outside the player's zone.");
  }
  if (state.board.units.some((candidate) => sameCoordinate(candidate.position, action.position))) {
    throw new Error("Monster Master deployment position is occupied.");
  }
  const deployed = cloneMonsterMasterUnit(unit);
  deployed.position = cloneCoordinate(action.position);
  state.board.units.push(deployed);
  state.undeployedUnitIds = state.undeployedUnitIds.filter((unitId) => unitId !== unit.id);
  state.lastEffects = [{ type: "unit-deployed", unitId: unit.id, position: cloneCoordinate(action.position) }];
  if (state.undeployedUnitIds.length === 0) {
    beginCombat(state);
  } else {
    state.deploymentPlayerIndex = (state.deploymentPlayerIndex + 1) % state.playerIds.length;
  }
}

function applyMove(state: MonsterMasterState, action: TacticalMoveAction): void {
  const unit = monsterMasterUnit(state, action.unitId);
  const moved = applyTacticalMove(movementBoard(state.board), action);
  state.board = {
    map: cloneTacticalMap(moved.map),
    units: moved.units.map((movedUnit) => ({
      ...cloneMonsterMasterUnit(monsterMasterUnit(state, movedUnit.id)),
      position: cloneCoordinate(movedUnit.position),
    })),
  };
  const destination = action.path.at(-1)!;
  state.movementUsed = true;
  state.lastEffects = [{
    type: "unit-moved",
    unitId: unit.id,
    from: cloneCoordinate(action.from),
    to: cloneCoordinate(destination),
    path: action.path.map(cloneCoordinate),
    movementCost: action.movementCost,
  }];
}

function completeIfMasterDefeated(
  state: MonsterMasterState,
  defeated: MonsterMasterUnit,
  attackerOwnerId: PlayerId,
): void {
  if (defeated.role !== "master") return;
  state.winnerPlayerId = attackerOwnerId;
  state.lastEffects.push({
    type: "duel-completed",
    winnerPlayerId: attackerOwnerId,
    draw: false,
  });
}

function applyAttack(state: MonsterMasterState, action: MonsterMasterAttackAction): void {
  const source = monsterMasterUnit(state, action.unitId);
  const target = monsterMasterUnit(state, action.targetUnitId);
  target.health = Math.max(0, target.health - action.damage);
  state.primaryActionUsed = true;
  state.lastEffects = [{
    type: "unit-damaged",
    sourceUnitId: source.id,
    targetUnitId: target.id,
    damage: action.damage,
    remainingHealth: target.health,
  }];
  if (target.health === 0) {
    state.defeatedUnitIds.push(target.id);
    state.board.units = state.board.units.filter((unit) => unit.id !== target.id);
    state.lastEffects.push({
      type: "unit-defeated",
      sourceUnitId: source.id,
      targetUnitId: target.id,
      role: target.role,
    });
    completeIfMasterDefeated(state, target, source.ownerId);
  }
}

function applyAbility(state: MonsterMasterState, action: MonsterMasterAbilityAction): void {
  const source = monsterMasterUnit(state, action.unitId);
  const target = monsterMasterUnit(state, action.targetUnitId);
  const available = state.commandByPlayer[source.ownerId];
  if (available < action.commandCost) throw new Error("Insufficient command energy.");
  state.commandByPlayer[source.ownerId] = available - action.commandCost;
  target.health = Math.min(target.maxHealth, target.health + action.healing);
  state.primaryActionUsed = true;
  state.lastEffects = [
    {
      type: "command-spent",
      playerId: source.ownerId,
      amount: action.commandCost,
      remaining: state.commandByPlayer[source.ownerId],
    },
    {
      type: "unit-healed",
      sourceUnitId: source.id,
      targetUnitId: target.id,
      healing: action.healing,
      resultingHealth: target.health,
    },
  ];
}

function restoreCommandAtRoundStart(state: MonsterMasterState): MonsterMasterEffect[] {
  const effects: MonsterMasterEffect[] = [];
  for (const playerId of state.playerIds) {
    const before = state.commandByPlayer[playerId];
    const resulting = Math.min(MONSTER_MASTER_MAX_COMMAND, before + 1);
    state.commandByPlayer[playerId] = resulting;
    if (resulting > before) {
      effects.push({
        type: "command-restored",
        playerId,
        amount: resulting - before,
        resulting,
      });
    }
  }
  return effects;
}

function advanceActivation(state: MonsterMasterState): void {
  const previousUnitId = activeMonsterMasterUnitId(state);
  if (previousUnitId) state.lastEffects.push({ type: "activation-ended", unitId: previousUnitId });
  if (state.winnerPlayerId || state.draw) return;

  const startIndex = state.activeActivationIndex;
  let wrapped = false;
  do {
    state.activeActivationIndex += 1;
    if (state.activeActivationIndex >= state.activationOrder.length) {
      state.activeActivationIndex = 0;
      wrapped = true;
    }
    const candidate = state.activationOrder[state.activeActivationIndex];
    if (state.board.units.some((unit) => unit.id === candidate)) break;
  } while (state.activeActivationIndex !== startIndex);

  if (wrapped) {
    state.round += 1;
    if (state.round > state.maxRounds) {
      state.draw = true;
      state.lastEffects.push({ type: "duel-completed", winnerPlayerId: null, draw: true });
      return;
    }
    state.lastEffects.push({ type: "round-started", round: state.round });
    state.lastEffects.push(...restoreCommandAtRoundStart(state));
  }
  state.movementUsed = false;
  state.primaryActionUsed = false;
}

function actionSummary(action: MonsterMasterAction, playerId: PlayerId): string {
  if (action.type === "deploy-unit") {
    return `${playerId} deployed ${action.unitId} at ${coordinateKey(action.position)}.`;
  }
  if (action.type === "move") {
    return `${playerId} moved ${action.unitId} to ${coordinateKey(action.path.at(-1)!)}.`;
  }
  if (action.type === "attack") {
    return `${playerId} attacked ${action.targetUnitId} with ${action.unitId} for ${action.damage} damage.`;
  }
  if (action.type === "use-ability") {
    return `${playerId} used ${action.abilityId} on ${action.targetUnitId}.`;
  }
  return `${playerId} ended ${action.unitId}'s activation.`;
}

export const monsterMasterDefinition: GameDefinition<
  MonsterMasterState,
  MonsterMasterAction,
  MonsterMasterObservation
> = {
  gameId: MONSTER_MASTER_GAME_ID,

  createInitialState(playerIds) {
    return createMonsterMasterState(playerIds);
  },

  getStatus: monsterMasterStatus,

  getActivePlayerId(state) {
    return currentActivePlayerId(state);
  },

  listLegalActions(state, playerId) {
    if (monsterMasterStatus(state).lifecycle === "completed") return [];
    return state.phase === "deployment"
      ? deploymentActions(state, playerId)
      : combatActions(state, playerId);
  },

  isSameAction: isSameMonsterMasterAction,

  applyAction(state, playerId, action) {
    if (currentActivePlayerId(state) !== playerId) {
      throw new Error("Cannot apply a Monster Master action for an inactive player.");
    }
    const canonical = this.listLegalActions(state, playerId)
      .find((candidate) => this.isSameAction(candidate, action));
    if (!canonical) throw new Error("Illegal Monster Master action.");

    const next = cloneMonsterMasterState(state);
    if (canonical.type === "deploy-unit") applyDeployment(next, canonical);
    else if (canonical.type === "move") applyMove(next, canonical);
    else if (canonical.type === "attack") applyAttack(next, canonical);
    else if (canonical.type === "use-ability") applyAbility(next, canonical);
    else {
      next.lastEffects = [];
      advanceActivation(next);
    }

    if (
      next.phase === "combat"
      && !next.winnerPlayerId
      && !next.draw
      && canonical.type !== "end-activation"
      && next.movementUsed
      && next.primaryActionUsed
    ) {
      advanceActivation(next);
    }

    return { state: next, summary: actionSummary(canonical, playerId) };
  },

  getObservation(state, playerId) {
    return {
      phase: state.phase,
      board: cloneMonsterMasterBoard(state.board),
      yourPlayerId: playerId,
      playerIds: [...state.playerIds] as [PlayerId, PlayerId],
      rosters: cloneRosterMap(state.rosters),
      undeployedUnitIds: [...state.undeployedUnitIds],
      activePlayerId: currentActivePlayerId(state),
      activeUnitId: activeMonsterMasterUnitId(state),
      round: state.round,
      movementAvailable: state.phase === "combat" && !state.movementUsed,
      primaryActionAvailable: state.phase === "combat" && !state.primaryActionUsed,
      commandByPlayer: { ...state.commandByPlayer },
      defeatedUnitIds: [...state.defeatedUnitIds],
      status: monsterMasterStatus(state),
      legalActions: this.listLegalActions(state, playerId).map((action) => {
        if (action.type === "deploy-unit") return { ...action, position: cloneCoordinate(action.position) };
        if (action.type === "move") {
          return {
            ...action,
            from: cloneCoordinate(action.from),
            path: action.path.map(cloneCoordinate),
          };
        }
        if (action.type === "attack" || action.type === "use-ability") {
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

  cloneState: cloneMonsterMasterState,
};

function distanceToEnemyMaster(observation: MonsterMasterObservation, action: TacticalMoveAction): number {
  const destination = action.path.at(-1)!;
  const active = monsterMasterUnit({
    ...createMonsterMasterState(observation.playerIds),
    board: observation.board,
    rosters: observation.rosters,
  }, action.unitId);
  const enemyMaster = observation.board.units.find((unit) => (
    unit.ownerId !== active.ownerId && unit.role === "master"
  ));
  if (!enemyMaster) return 0;
  return Math.max(
    Math.abs(destination.x - enemyMaster.position.x),
    Math.abs(destination.y - enemyMaster.position.y),
  );
}

export class DeterministicMonsterMasterPlayer
  implements AgentPlayer<MonsterMasterAction, MonsterMasterObservation>
{
  readonly agentId: string;

  constructor(agentId = "theo") {
    this.agentId = agentId;
  }

  async chooseAction({
    observation,
    legalActions,
  }: {
    observation: MonsterMasterObservation;
    legalActions: readonly MonsterMasterAction[];
  }): Promise<MonsterMasterAction> {
    if (observation.activePlayerId !== this.agentId || legalActions.length === 0) {
      throw new Error("Deterministic Monster Master player cannot act in this state.");
    }

    if (observation.phase === "deployment") {
      return [...legalActions]
        .filter((action): action is MonsterMasterDeployAction => action.type === "deploy-unit")
        .sort((left, right) => (
          ROLE_ORDER.indexOf(monsterMasterUnit({
            ...createMonsterMasterState(observation.playerIds),
            board: observation.board,
            rosters: observation.rosters,
          }, left.unitId).role)
          - ROLE_ORDER.indexOf(monsterMasterUnit({
            ...createMonsterMasterState(observation.playerIds),
            board: observation.board,
            rosters: observation.rosters,
          }, right.unitId).role)
          || (this.agentId === observation.playerIds[0]
            ? right.position.x - left.position.x
            : left.position.x - right.position.x)
          || compareCoordinates(left.position, right.position)
        ))[0];
    }

    const enemyMasterAttack = legalActions.find((action) => (
      action.type === "attack"
      && observation.board.units.find((unit) => unit.id === action.targetUnitId)?.role === "master"
    ));
    if (enemyMasterAttack) return enemyMasterAttack;

    const attack = legalActions.find((action) => action.type === "attack");
    if (attack) return attack;

    const mend = legalActions
      .filter((action): action is MonsterMasterAbilityAction => action.type === "use-ability")
      .sort((left, right) => right.healing - left.healing || left.targetUnitId.localeCompare(right.targetUnitId))[0];
    if (mend) return mend;

    const move = legalActions
      .filter((action): action is TacticalMoveAction => action.type === "move")
      .sort((left, right) => (
        distanceToEnemyMaster(observation, left) - distanceToEnemyMaster(observation, right)
        || right.movementCost - left.movementCost
        || compareCoordinates(left.path.at(-1)!, right.path.at(-1)!)
      ))[0];
    if (move) return move;

    const end = legalActions.find((action) => action.type === "end-activation");
    if (!end) throw new Error("Deterministic Monster Master player found no bounded action.");
    return end;
  }
}
