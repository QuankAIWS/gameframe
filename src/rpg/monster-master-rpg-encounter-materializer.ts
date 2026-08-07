import {
  cloneMonsterMasterUnit,
  createMonsterMasterState,
  type MonsterMasterRole,
  type MonsterMasterState,
  type MonsterMasterUnit,
} from "../games/monster-master/index.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_TEAM_CREATURES = 3;
const SUPPORTED_RULES_STATE_KEYS = new Set(["creatureIds"]);
const SUPPORTED_BATTLEFIELD_KEYS = new Set([
  "theme",
  "environmentTags",
  "layoutHint",
  "assetIds",
]);
const SUPPORTED_DIFFICULTY_KEYS = new Set([
  "id",
  "profile",
  "encounterPressure",
  "enemyTacticalIntensity",
  "defeatConsequences",
  "characterDeathRisk",
  "recoverySupport",
]);

type JsonRecord = Record<string, unknown>;

export type MonsterMasterRpgEncounterParticipant = {
  participantId: string;
  teamId: string;
  controller: { kind: string; playerId?: string };
  rulesState: JsonRecord;
};

export type MonsterMasterRpgEncounterObjective = {
  objectiveId: string;
  kind: string;
  rules?: JsonRecord;
};

export type MaterializedMonsterMasterRpgEncounter = {
  initialState: MonsterMasterState;
  teamUnitIds: Record<string, string[]>;
  participantUnitIds: Record<string, string[]>;
};

export class MonsterMasterRpgEncounterConfigurationError extends Error {
  readonly code = "unsupported-encounter-configuration";
  readonly status = 400;
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "MonsterMasterRpgEncounterConfigurationError";
  }
}

/**
 * Converts the deliberately narrow Monster Master RPG encounter vocabulary into
 * an authoritative revision-zero Monster Master state.
 *
 * Trainers remain encounter participants/controllers. They are not tactical
 * creatures. The first executable package vocabulary supplies only creatureIds,
 * and each supported creature ID maps to a rules implementation that already
 * exists in MM-0001. Unsupported combat-relevant fields fail closed rather than
 * silently falling back to the standalone fixed duel roster.
 */
export function materializeMonsterMasterRpgEncounter(input: {
  matchPlayerIds: readonly [string, string];
  playerTeamId: string;
  oppositionTeamId: string;
  participants: readonly MonsterMasterRpgEncounterParticipant[];
  objectives: readonly MonsterMasterRpgEncounterObjective[];
  difficulty: JsonRecord;
  battlefield: JsonRecord;
}): MaterializedMonsterMasterRpgEncounter {
  const [playerSeatId, oppositionSeatId] = validatePlayers(input.matchPlayerIds);
  const playerTeamId = identifier(input.playerTeamId, "playerTeamId");
  const oppositionTeamId = identifier(input.oppositionTeamId, "oppositionTeamId");
  if (playerTeamId === oppositionTeamId) {
    throw unsupported("Monster Master RPG player and opposition teams must be distinct.");
  }
  validateDifficulty(input.difficulty);
  validateBattlefield(input.battlefield);
  validateObjectives(input.objectives, oppositionTeamId);

  const base = createMonsterMasterState([playerSeatId, oppositionSeatId]);
  const templates = templateUnits(base);
  const teamUnits: Record<string, MonsterMasterUnit[]> = {
    [playerTeamId]: [],
    [oppositionTeamId]: [],
  };
  const participantUnitIds: Record<string, string[]> = {};
  const seenParticipants = new Set<string>();
  const seenCreatures = new Set<string>();

  for (const [index, participantValue] of input.participants.entries()) {
    const participantId = identifier(
      participantValue.participantId,
      `participants[${index}].participantId`,
    );
    if (seenParticipants.has(participantId)) {
      throw unsupported(`Monster Master RPG participant ${participantId} is duplicated.`);
    }
    seenParticipants.add(participantId);
    const teamId = identifier(participantValue.teamId, `participants[${index}].teamId`);
    const ownerId = teamId === playerTeamId
      ? playerSeatId
      : teamId === oppositionTeamId
        ? oppositionSeatId
        : undefined;
    if (!ownerId) {
      throw unsupported(`Monster Master RPG participant ${participantId} uses an unsupported team.`);
    }

    const rulesState = record(
      participantValue.rulesState,
      `participants[${index}].rulesState`,
    );
    rejectUnknownKeys(rulesState, SUPPORTED_RULES_STATE_KEYS, `participant ${participantId} rulesState`);
    const creatureIds = identifierArray(
      rulesState.creatureIds,
      `participants[${index}].rulesState.creatureIds`,
      1,
      MAX_TEAM_CREATURES,
    );
    const mappedIds: string[] = [];
    for (const creatureId of creatureIds) {
      if (seenCreatures.has(creatureId)) {
        throw unsupported(`Monster Master RPG creature ${creatureId} is assigned more than once.`);
      }
      seenCreatures.add(creatureId);
      const role = roleForCreatureId(creatureId);
      const template = templates[role];
      const unit = cloneMonsterMasterUnit(template);
      unit.id = creatureId;
      unit.ownerId = ownerId;
      unit.position = { x: -1, y: -1 };
      teamUnits[teamId]!.push(unit);
      mappedIds.push(creatureId);
    }
    participantUnitIds[participantId] = mappedIds;
  }

  for (const teamId of [playerTeamId, oppositionTeamId]) {
    const count = teamUnits[teamId]!.length;
    if (count < 1 || count > MAX_TEAM_CREATURES) {
      throw unsupported(
        `Monster Master RPG team ${teamId} must materialize from 1 through ${MAX_TEAM_CREATURES} supported creatures.`,
      );
    }
  }

  const playerRoster = teamUnits[playerTeamId]!.map(cloneMonsterMasterUnit);
  const oppositionRoster = teamUnits[oppositionTeamId]!.map(cloneMonsterMasterUnit);
  const initialState: MonsterMasterState = {
    ...base,
    board: {
      map: base.board.map,
      units: [],
    },
    rosters: {
      [playerSeatId]: playerRoster,
      [oppositionSeatId]: oppositionRoster,
    },
    undeployedUnitIds: [...playerRoster, ...oppositionRoster].map((unit) => unit.id),
  };

  return {
    initialState,
    teamUnitIds: {
      [playerTeamId]: playerRoster.map((unit) => unit.id),
      [oppositionTeamId]: oppositionRoster.map((unit) => unit.id),
    },
    participantUnitIds,
  };
}

function templateUnits(state: MonsterMasterState): Record<"bulwark" | "emberling", MonsterMasterUnit> {
  const roster = state.rosters[state.playerIds[0]] ?? [];
  const bulwark = roster.find((unit) => unit.role === "bulwark");
  const emberling = roster.find((unit) => unit.role === "emberling");
  if (!bulwark || !emberling) {
    throw new Error("Monster Master built-in creature templates are unavailable.");
  }
  return { bulwark, emberling };
}

function roleForCreatureId(creatureId: string): Exclude<MonsterMasterRole, "master"> {
  if (/^creature:emberling:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(creatureId)) return "emberling";
  if (/^creature:bulwark:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(creatureId)) return "bulwark";
  throw unsupported(
    `Monster Master RPG creature ${creatureId} has no implemented tactical species profile.`,
  );
}

function validateDifficulty(value: JsonRecord): void {
  const difficulty = record(value, "difficulty");
  rejectUnknownKeys(difficulty, SUPPORTED_DIFFICULTY_KEYS, "difficulty");
  exactOptional(difficulty, "id", "normal", "difficulty.id");
  exactOptional(difficulty, "profile", "normal", "difficulty.profile");
  exactOptional(difficulty, "encounterPressure", "standard", "difficulty.encounterPressure");
  exactOptional(
    difficulty,
    "enemyTacticalIntensity",
    "competent",
    "difficulty.enemyTacticalIntensity",
  );
  exactOptional(
    difficulty,
    "defeatConsequences",
    "consequential",
    "difficulty.defeatConsequences",
  );
  exactOptional(difficulty, "characterDeathRisk", "real", "difficulty.characterDeathRisk");
  exactOptional(difficulty, "recoverySupport", "standard", "difficulty.recoverySupport");
}

function validateBattlefield(value: JsonRecord): void {
  const battlefield = record(value, "battlefield");
  rejectUnknownKeys(battlefield, SUPPORTED_BATTLEFIELD_KEYS, "battlefield");
  exactOptional(battlefield, "layoutHint", "compact-duel", "battlefield.layoutHint");
  if (battlefield.theme !== undefined) requiredText(battlefield.theme, "battlefield.theme");
  if (battlefield.environmentTags !== undefined) {
    identifierArray(battlefield.environmentTags, "battlefield.environmentTags", 0, 16);
  }
  if (battlefield.assetIds !== undefined) {
    identifierArray(battlefield.assetIds, "battlefield.assetIds", 0, 32);
  }
}

function validateObjectives(
  objectives: readonly MonsterMasterRpgEncounterObjective[],
  oppositionTeamId: string,
): void {
  if (!Array.isArray(objectives) || objectives.length === 0) {
    throw unsupported("Monster Master RPG requires at least one tactical objective.");
  }
  for (const [index, objective] of objectives.entries()) {
    identifier(objective.objectiveId, `objectives[${index}].objectiveId`);
    if (objective.kind !== "defeat" && objective.kind !== "defeat-opposition") {
      throw unsupported(
        `Monster Master RPG objective ${objective.objectiveId} uses unsupported kind ${objective.kind}.`,
      );
    }
    if (objective.rules !== undefined) {
      const rules = record(objective.rules, `objectives[${index}].rules`);
      rejectUnknownKeys(rules, new Set(["targetTeamId"]), `objective ${objective.objectiveId} rules`);
      if (
        rules.targetTeamId !== undefined
        && identifier(rules.targetTeamId, `objectives[${index}].rules.targetTeamId`) !== oppositionTeamId
      ) {
        throw unsupported(
          `Monster Master RPG objective ${objective.objectiveId} must target the opposition team.`,
        );
      }
    }
  }
}

function validatePlayers(value: readonly [string, string]): [string, string] {
  const players = value.map((playerId, index) => identifier(playerId, `matchPlayerIds[${index}]`));
  if (players.length !== 2 || players[0] === players[1]) {
    throw unsupported("Monster Master RPG requires two distinct tactical team seats.");
  }
  return players as [string, string];
}

function rejectUnknownKeys(value: JsonRecord, supported: Set<string>, label: string): void {
  const unknown = Object.keys(value).filter((key) => !supported.has(key));
  if (unknown.length > 0) {
    throw unsupported(`${label} contains unsupported combat configuration: ${unknown.sort().join(", ")}.`);
  }
}

function exactOptional(value: JsonRecord, key: string, expected: string, label: string): void {
  if (value[key] === undefined) return;
  if (value[key] !== expected) {
    throw unsupported(`${label}=${String(value[key])} is not implemented by the current Arena rules.`);
  }
}

function identifierArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw unsupported(`${label} must contain from ${minimum} through ${maximum} identifiers.`);
  }
  return value.map((entry, index) => identifier(entry, `${label}[${index}]`));
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw unsupported(`${label} must be an object.`);
  }
  return structuredClone(value as JsonRecord);
}

function identifier(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (!IDENTIFIER_PATTERN.test(text)) throw unsupported(`${label} is not a valid identifier.`);
  return text;
}

function requiredText(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw unsupported(`${label} is required.`);
  return text;
}

function unsupported(message: string): MonsterMasterRpgEncounterConfigurationError {
  return new MonsterMasterRpgEncounterConfigurationError(message);
}
