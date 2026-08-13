import type { GameDefinition, PlayerId } from "../../platform/contracts.ts";
import {
  cloneMonsterMasterUnit,
  createMonsterMasterState,
  monsterMasterDefinition as baseMonsterMasterDefinition,
  type MonsterMasterAction,
  type MonsterMasterObservation,
  type MonsterMasterState,
  type MonsterMasterUnit,
} from "./index.ts";

export const MONSTER_MASTER_ARENA_RULES_VERSION = 3;
export const MONSTER_MASTER_ARENA_MONSTER_SLOTS = 3;
export const ROOTMAW_BRUTE_CONTENT_ID = "rootmaw-brute-v1";
const ARENA_UNIT_TAG = `monster-master-arena-v${MONSTER_MASTER_ARENA_RULES_VERSION}`;

function arenaPrefix(playerIndex: number): "alpha" | "beta" {
  return playerIndex === 0 ? "alpha" : "beta";
}

function rootmawBrute(
  playerIndex: number,
  source: MonsterMasterUnit,
): MonsterMasterUnit {
  const unit = cloneMonsterMasterUnit(source);
  unit.id = `${arenaPrefix(playerIndex)}-rootmaw`;
  unit.contentId = ROOTMAW_BRUTE_CONTENT_ID;
  unit.movement = 3;
  unit.initiative = 4;
  unit.maxHealth = 16;
  unit.health = unit.maxHealth;
  unit.attackRange = 1;
  unit.attackDamage = 5;
  unit.abilityIds = [];
  unit.tags = [...(unit.tags ?? []), ARENA_UNIT_TAG, "arena-monster-slot-3", ROOTMAW_BRUTE_CONTENT_ID];
  return unit;
}

export function createMonsterMasterArenaState(playerIds: readonly PlayerId[]): MonsterMasterState {
  const state = createMonsterMasterState(playerIds);
  state.playerIds.forEach((playerId, playerIndex) => {
    const roster = state.rosters[playerId];
    const bulwark = roster.find((unit) => unit.role === "bulwark");
    if (!bulwark) throw new Error("Monster Master Arena requires a Bulwark prototype unit.");
    const extra = rootmawBrute(playerIndex, bulwark);
    roster.push(extra);
    state.undeployedUnitIds.push(extra.id);
  });
  return state;
}

export function isMonsterMasterArenaState(state: MonsterMasterState): boolean {
  return Object.values(state.rosters)
    .flat()
    .some((unit) => unit.tags?.includes(ARENA_UNIT_TAG));
}

function defeatedMasterOwner(state: MonsterMasterState): PlayerId | null {
  const defeatedMaster = state.lastEffects.find((effect) => (
    effect.type === "unit-defeated" && effect.role === "master"
  ));
  if (!defeatedMaster || defeatedMaster.type !== "unit-defeated") return null;
  for (const [playerId, roster] of Object.entries(state.rosters)) {
    if (roster.some((unit) => unit.id === defeatedMaster.targetUnitId)) return playerId;
  }
  return null;
}

function completeOnMasterDefeat(state: MonsterMasterState): void {
  if (state.winnerPlayerId || state.draw) return;
  const defeatedOwnerId = defeatedMasterOwner(state);
  if (!defeatedOwnerId) return;
  const winnerPlayerId = state.playerIds.find((playerId) => playerId !== defeatedOwnerId) ?? null;
  if (!winnerPlayerId) return;
  state.winnerPlayerId = winnerPlayerId;
  state.lastEffects.push({ type: "duel-completed", winnerPlayerId, draw: false });
}

export const monsterMasterArenaDefinition: GameDefinition<
  MonsterMasterState,
  MonsterMasterAction,
  MonsterMasterObservation
> = {
  gameId: baseMonsterMasterDefinition.gameId,

  createInitialState(playerIds) {
    return createMonsterMasterArenaState(playerIds);
  },

  getStatus: baseMonsterMasterDefinition.getStatus,
  getActivePlayerId: baseMonsterMasterDefinition.getActivePlayerId,
  listLegalActions: baseMonsterMasterDefinition.listLegalActions,
  isSameAction: baseMonsterMasterDefinition.isSameAction,

  applyAction(state, playerId, action) {
    const result = baseMonsterMasterDefinition.applyAction(state, playerId, action);
    completeOnMasterDefeat(result.state);
    return result;
  },

  getObservation: baseMonsterMasterDefinition.getObservation,

  cloneState(state) {
    return baseMonsterMasterDefinition.cloneState(state);
  },
};
