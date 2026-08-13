import {
  cloneMonsterMasterUnit,
  type MonsterMasterUnit,
} from "./index.ts";

export const MONSTER_MASTER_ARENA_TRAINER_CONTENT_IDS = [
  "vanguard-trainer-v1",
  "commander-trainer-v1",
  "arcanic-trainer-v1",
  "medic-trainer-v1",
  "caller-trainer-v1",
] as const;

export const MONSTER_MASTER_ARENA_MONSTER_CONTENT_IDS = [
  "rootmaw-brute-v1",
  "gloamspore-stalker-v1",
  "voidshard-reaver-v1",
  "stormcrest-skitter-v1",
  "mossmaw-colossus-v1",
] as const;

export type MonsterMasterArenaTrainerContentId = typeof MONSTER_MASTER_ARENA_TRAINER_CONTENT_IDS[number];
export type MonsterMasterArenaMonsterContentId = typeof MONSTER_MASTER_ARENA_MONSTER_CONTENT_IDS[number];

export interface MonsterMasterArenaRosterSelection {
  trainerContentId: MonsterMasterArenaTrainerContentId;
  monsterContentIds: readonly [
    MonsterMasterArenaMonsterContentId,
    MonsterMasterArenaMonsterContentId,
    MonsterMasterArenaMonsterContentId,
  ];
}

interface ArenaMonsterProfile {
  readonly contentId: MonsterMasterArenaMonsterContentId;
  readonly label: string;
  readonly prototypeRole: "bulwark" | "emberling";
  readonly idSuffix: string;
  readonly movement: number;
  readonly initiative: number;
  readonly maxHealth: number;
  readonly attackRange: number;
  readonly attackDamage: number;
}

export const MONSTER_MASTER_ARENA_MONSTER_PROFILES: Readonly<Record<MonsterMasterArenaMonsterContentId, ArenaMonsterProfile>> = Object.freeze({
  "rootmaw-brute-v1": Object.freeze({ contentId: "rootmaw-brute-v1", label: "Rootmaw Brute", prototypeRole: "bulwark", idSuffix: "rootmaw", movement: 3, initiative: 4, maxHealth: 16, attackRange: 1, attackDamage: 5 }),
  "gloamspore-stalker-v1": Object.freeze({ contentId: "gloamspore-stalker-v1", label: "Gloamspore Stalker", prototypeRole: "emberling", idSuffix: "gloamspore", movement: 6, initiative: 9, maxHealth: 8, attackRange: 3, attackDamage: 3 }),
  "voidshard-reaver-v1": Object.freeze({ contentId: "voidshard-reaver-v1", label: "Voidshard Reaver", prototypeRole: "emberling", idSuffix: "voidshard", movement: 5, initiative: 8, maxHealth: 11, attackRange: 1, attackDamage: 5 }),
  "stormcrest-skitter-v1": Object.freeze({ contentId: "stormcrest-skitter-v1", label: "Stormcrest Skitter", prototypeRole: "emberling", idSuffix: "stormcrest", movement: 6, initiative: 10, maxHealth: 9, attackRange: 2, attackDamage: 3 }),
  "mossmaw-colossus-v1": Object.freeze({ contentId: "mossmaw-colossus-v1", label: "Mossmaw Colossus", prototypeRole: "bulwark", idSuffix: "mossmaw", movement: 2, initiative: 3, maxHealth: 18, attackRange: 1, attackDamage: 4 }),
});

export const DEFAULT_MONSTER_MASTER_ARENA_ROSTER: MonsterMasterArenaRosterSelection = {
  trainerContentId: "vanguard-trainer-v1",
  monsterContentIds: ["rootmaw-brute-v1", "gloamspore-stalker-v1", "stormcrest-skitter-v1"],
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isTrainerContentId(value: string): value is MonsterMasterArenaTrainerContentId {
  return (MONSTER_MASTER_ARENA_TRAINER_CONTENT_IDS as readonly string[]).includes(value);
}

function isMonsterContentId(value: string): value is MonsterMasterArenaMonsterContentId {
  return (MONSTER_MASTER_ARENA_MONSTER_CONTENT_IDS as readonly string[]).includes(value);
}

export function normalizeMonsterMasterArenaRosterSelection(value: unknown): MonsterMasterArenaRosterSelection {
  const input = record(value);
  const trainerContentId = String(input.trainerContentId ?? "");
  const monsterContentIds = Array.isArray(input.monsterContentIds) ? input.monsterContentIds.map(String) : [];
  if (!isTrainerContentId(trainerContentId)) {
    const error = new Error("Choose a valid Monster Master Arena trainer.");
    Object.assign(error, { code: "invalid_arena_roster" });
    throw error;
  }
  if (monsterContentIds.length !== 3 || new Set(monsterContentIds).size !== 3 || monsterContentIds.some((contentId) => !isMonsterContentId(contentId))) {
    const error = new Error("Choose exactly three distinct Monster Master Arena monsters.");
    Object.assign(error, { code: "invalid_arena_roster" });
    throw error;
  }
  return { trainerContentId, monsterContentIds: monsterContentIds as MonsterMasterArenaRosterSelection["monsterContentIds"] };
}

function seedHash(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 0x9e3779b9;
}

function seededNext(state: { value: number }): number {
  let value = state.value >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.value = value >>> 0;
  return state.value;
}

function seededShuffle<T>(items: readonly T[], state: { value: number }): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = seededNext(state) % (index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

export function createDeterministicMonsterMasterArenaRoster(seed: string): MonsterMasterArenaRosterSelection {
  const state = { value: seedHash(seed) };
  const trainers = seededShuffle(MONSTER_MASTER_ARENA_TRAINER_CONTENT_IDS, state);
  const monsters = seededShuffle(MONSTER_MASTER_ARENA_MONSTER_CONTENT_IDS, state);
  return { trainerContentId: trainers[0], monsterContentIds: monsters.slice(0, 3) as MonsterMasterArenaRosterSelection["monsterContentIds"] };
}

export function materializeMonsterMasterArenaRoster(input: {
  playerIndex: number;
  prototypes: readonly MonsterMasterUnit[];
  selection: MonsterMasterArenaRosterSelection;
  arenaTag: string;
}): MonsterMasterUnit[] {
  const prefix = input.playerIndex === 0 ? "alpha" : "beta";
  const masterPrototype = input.prototypes.find((unit) => unit.role === "master");
  const bulwarkPrototype = input.prototypes.find((unit) => unit.role === "bulwark");
  const emberlingPrototype = input.prototypes.find((unit) => unit.role === "emberling");
  if (!masterPrototype || !bulwarkPrototype || !emberlingPrototype) throw new Error("Monster Master Arena requires Master, Bulwark, and Emberling prototype units.");

  const trainer = cloneMonsterMasterUnit(masterPrototype);
  trainer.contentId = input.selection.trainerContentId;
  trainer.tags = [...(trainer.tags ?? []).filter((tag) => tag !== masterPrototype.contentId), input.arenaTag, "arena-trainer", trainer.contentId];

  const monsters = input.selection.monsterContentIds.map((contentId, slotIndex) => {
    const profile = MONSTER_MASTER_ARENA_MONSTER_PROFILES[contentId];
    const source = profile.prototypeRole === "bulwark" ? bulwarkPrototype : emberlingPrototype;
    const unit = cloneMonsterMasterUnit(source);
    unit.id = `${prefix}-${profile.idSuffix}`;
    unit.contentId = profile.contentId;
    unit.movement = profile.movement;
    unit.initiative = profile.initiative;
    unit.maxHealth = profile.maxHealth;
    unit.health = profile.maxHealth;
    unit.attackRange = profile.attackRange;
    unit.attackDamage = profile.attackDamage;
    unit.abilityIds = [];
    unit.tags = [...(unit.tags ?? []).filter((tag) => tag !== source.contentId), input.arenaTag, `arena-monster-slot-${slotIndex + 1}`, profile.contentId];
    return unit;
  });
  return [trainer, ...monsters];
}
