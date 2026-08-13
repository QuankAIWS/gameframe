import type { GameDefinition, PlayerId } from "../../platform/contracts.ts";
import {
  createMonsterMasterState,
  monsterMasterDefinition as baseMonsterMasterDefinition,
  type MonsterMasterAction,
  type MonsterMasterObservation,
  type MonsterMasterState,
} from "./index.ts";
import {
  DEFAULT_MONSTER_MASTER_ARENA_ROSTER,
  materializeMonsterMasterArenaRoster,
  normalizeMonsterMasterArenaRosterSelection,
  type MonsterMasterArenaRosterSelection,
} from "./arena-roster.ts";

export const MONSTER_MASTER_ARENA_RULES_VERSION = 5;
export const MONSTER_MASTER_ARENA_MONSTER_SLOTS = 3;
export const GLOAMSPORE_STALKER_CONTENT_ID = "gloamspore-stalker-v1";
export const ROOTMAW_BRUTE_CONTENT_ID = "rootmaw-brute-v1";
const ARENA_UNIT_TAG = `monster-master-arena-v${MONSTER_MASTER_ARENA_RULES_VERSION}`;

export interface MonsterMasterArenaStateOptions {
  rosterSelections?: Readonly<Partial<Record<PlayerId, MonsterMasterArenaRosterSelection>>>;
}

export function createMonsterMasterArenaState(
  playerIds: readonly PlayerId[],
  options: MonsterMasterArenaStateOptions = {},
): MonsterMasterState {
  const state = createMonsterMasterState(playerIds);
  state.playerIds.forEach((playerId, playerIndex) => {
    const selected = options.rosterSelections?.[playerId] ?? DEFAULT_MONSTER_MASTER_ARENA_ROSTER;
    const selection = normalizeMonsterMasterArenaRosterSelection(selected);
    state.rosters[playerId] = materializeMonsterMasterArenaRoster({
      playerIndex,
      prototypes: state.rosters[playerId],
      selection,
      arenaTag: ARENA_UNIT_TAG,
    });
  });
  state.undeployedUnitIds = state.playerIds.flatMap((playerId) => state.rosters[playerId].map((unit) => unit.id));
  return state;
}

export function isMonsterMasterArenaState(state: MonsterMasterState): boolean {
  return Object.values(state.rosters)
    .flat()
    .some((unit) => unit.tags?.some((tag) => tag.startsWith("monster-master-arena-v")));
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
