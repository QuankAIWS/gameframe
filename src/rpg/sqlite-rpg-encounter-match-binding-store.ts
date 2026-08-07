import { DatabaseSync, type StatementSync } from "node:sqlite";

const ENCOUNTER_TABLE = "rpg_encounters_v1";
const BINDING_TABLE = "rpg_encounter_match_bindings_v1";

type JsonRecord = Record<string, unknown>;

type BindingRow = {
  encounter_id: string;
  match_id: string;
  binding_json: string;
};

type LaunchRow = { request_json: string };

export type DurableRpgEncounterMatchBinding = {
  protocolVersion: 1;
  encounterId: string;
  campaignId: string;
  rulesetId: string;
  gameId: "monster-master-duel";
  matchId: string;
  authorizedPlayerIds: string[];
  playerTeamId: string;
  oppositionTeamId: string;
  playerTeamSeatId: string;
  participants: Array<{
    participantId: string;
    controller: { kind: string; playerId?: string };
    teamId: string;
  }>;
  objectives: Array<{ objectiveId: string }>;
  mappingMode: "shared-team-roster";
  teamUnitIds: Record<string, string[]>;
  participantUnitIds: Record<string, string[]>;
};

export class SqliteRpgEncounterMatchBindingError extends Error {
  readonly code: "binding-conflict" | "corrupt-binding";

  constructor(code: SqliteRpgEncounterMatchBindingError["code"], message: string) {
    super(message);
    this.name = "SqliteRpgEncounterMatchBindingError";
    this.code = code;
  }
}

/**
 * Stores the durable RPG encounter-to-match identity in the same SQLite file as
 * campaign and encounter authority. It is intentionally not a second encounter
 * database. Exact retries either recover the same binding or fail closed.
 */
export class SqliteRpgEncounterMatchBindingStore {
  readonly #database: DatabaseSync;
  readonly #selectByEncounter: StatementSync;
  readonly #selectByMatch: StatementSync;
  readonly #selectLaunch: StatementSync;
  readonly #insert: StatementSync;

  constructor(input: { filePath: string }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    const filePath = input.filePath.trim();
    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA synchronous = FULL");
    if (filePath !== ":memory:") this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS ${BINDING_TABLE} (
        encounter_id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL UNIQUE,
        binding_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (encounter_id) REFERENCES ${ENCOUNTER_TABLE}(encounter_id)
      );
    `);
    this.#selectByEncounter = this.#database.prepare(
      `SELECT encounter_id, match_id, binding_json FROM ${BINDING_TABLE} WHERE encounter_id = ?`,
    );
    this.#selectByMatch = this.#database.prepare(
      `SELECT encounter_id, match_id, binding_json FROM ${BINDING_TABLE} WHERE match_id = ?`,
    );
    this.#selectLaunch = this.#database.prepare(
      `SELECT request_json FROM ${ENCOUNTER_TABLE} WHERE encounter_id = ?`,
    );
    this.#insert = this.#database.prepare(`
      INSERT INTO ${BINDING_TABLE} (
        encounter_id, match_id, binding_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
  }

  loadByEncounter(encounterIdValue: unknown): DurableRpgEncounterMatchBinding | null {
    const encounterId = identifier(encounterIdValue, "encounterId");
    const row = this.#selectByEncounter.get(encounterId) as BindingRow | undefined;
    return row ? parseBindingRow(row) : null;
  }

  loadByMatch(matchIdValue: unknown): DurableRpgEncounterMatchBinding | null {
    const matchId = identifier(matchIdValue, "matchId");
    const row = this.#selectByMatch.get(matchId) as BindingRow | undefined;
    return row ? parseBindingRow(row) : null;
  }

  loadEncounterLaunch(encounterIdValue: unknown): JsonRecord | null {
    const encounterId = identifier(encounterIdValue, "encounterId");
    const row = this.#selectLaunch.get(encounterId) as LaunchRow | undefined;
    if (!row) return null;
    try {
      const value = JSON.parse(row.request_json) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      return structuredClone(value as JsonRecord);
    } catch {
      throw new SqliteRpgEncounterMatchBindingError(
        "corrupt-binding",
        `Encounter ${encounterId} contains an invalid stored launch request.`,
      );
    }
  }

  saveExact(
    bindingValue: DurableRpgEncounterMatchBinding,
    timestampValue: string,
  ): DurableRpgEncounterMatchBinding {
    const binding = normalizeBinding(bindingValue);
    const timestamp = requiredText(timestampValue, "timestamp");
    const bindingJson = stableJson(binding);
    const existingByEncounter = this.#selectByEncounter.get(binding.encounterId) as BindingRow | undefined;
    if (existingByEncounter) return exactExisting(existingByEncounter, binding, bindingJson);
    const existingByMatch = this.#selectByMatch.get(binding.matchId) as BindingRow | undefined;
    if (existingByMatch) {
      throw new SqliteRpgEncounterMatchBindingError(
        "binding-conflict",
        `Match ${binding.matchId} is already bound to encounter ${existingByMatch.encounter_id}.`,
      );
    }
    try {
      this.#insert.run(binding.encounterId, binding.matchId, bindingJson, timestamp, timestamp);
    } catch (error) {
      const raced = this.#selectByEncounter.get(binding.encounterId) as BindingRow | undefined;
      if (raced) return exactExisting(raced, binding, bindingJson);
      throw error;
    }
    return structuredClone(binding);
  }

  close(): void {
    this.#database.close();
  }
}

function exactExisting(
  row: BindingRow,
  binding: DurableRpgEncounterMatchBinding,
  bindingJson: string,
): DurableRpgEncounterMatchBinding {
  if (row.match_id !== binding.matchId || stableJson(parseBindingRow(row)) !== bindingJson) {
    throw new SqliteRpgEncounterMatchBindingError(
      "binding-conflict",
      `Encounter ${binding.encounterId} is already bound with different tactical identity.`,
    );
  }
  return parseBindingRow(row);
}

function parseBindingRow(row: BindingRow): DurableRpgEncounterMatchBinding {
  try {
    const value = JSON.parse(row.binding_json) as DurableRpgEncounterMatchBinding;
    const binding = normalizeBinding(value);
    if (binding.encounterId !== row.encounter_id || binding.matchId !== row.match_id) throw new Error();
    return binding;
  } catch (error) {
    if (error instanceof SqliteRpgEncounterMatchBindingError) throw error;
    throw new SqliteRpgEncounterMatchBindingError(
      "corrupt-binding",
      `Encounter ${row.encounter_id} has a corrupt match binding.`,
    );
  }
}

function normalizeBinding(value: DurableRpgEncounterMatchBinding): DurableRpgEncounterMatchBinding {
  if (!value || value.protocolVersion !== 1 || value.gameId !== "monster-master-duel") {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", "RPG match binding is invalid.");
  }
  const authorizedPlayerIds = uniqueIdentifiers(value.authorizedPlayerIds, "authorizedPlayerIds");
  if (authorizedPlayerIds.length === 0) {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", "RPG match binding has no players.");
  }
  const participants = value.participants.map((participant) => ({
    participantId: identifier(participant.participantId, "participantId"),
    controller: {
      kind: requiredText(participant.controller?.kind, "participant.controller.kind"),
      ...(participant.controller?.playerId
        ? { playerId: identifier(participant.controller.playerId, "participant.controller.playerId") }
        : {}),
    },
    teamId: identifier(participant.teamId, "participant.teamId"),
  }));
  const objectives = value.objectives.map((objective) => ({
    objectiveId: identifier(objective.objectiveId, "objectiveId"),
  }));
  if (value.mappingMode !== "shared-team-roster") {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", "RPG unit mapping mode is invalid.");
  }
  return {
    protocolVersion: 1,
    encounterId: identifier(value.encounterId, "encounterId"),
    campaignId: identifier(value.campaignId, "campaignId"),
    rulesetId: identifier(value.rulesetId, "rulesetId"),
    gameId: "monster-master-duel",
    matchId: identifier(value.matchId, "matchId"),
    authorizedPlayerIds,
    playerTeamId: identifier(value.playerTeamId, "playerTeamId"),
    oppositionTeamId: identifier(value.oppositionTeamId, "oppositionTeamId"),
    playerTeamSeatId: identifier(value.playerTeamSeatId, "playerTeamSeatId"),
    participants,
    objectives,
    mappingMode: "shared-team-roster",
    teamUnitIds: normalizeUnitMap(value.teamUnitIds, "teamUnitIds"),
    participantUnitIds: normalizeUnitMap(value.participantUnitIds, "participantUnitIds"),
  };
}

function normalizeUnitMap(value: Record<string, string[]>, label: string): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", `${label} is invalid.`);
  }
  const output: Record<string, string[]> = {};
  for (const [key, unitIds] of Object.entries(value)) {
    output[identifier(key, `${label} key`)] = uniqueIdentifiers(unitIds, `${label}.${key}`);
  }
  return output;
}

function uniqueIdentifiers(values: unknown, label: string): string[] {
  if (!Array.isArray(values)) {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", `${label} must be an array.`);
  }
  const normalized = values.map((value, index) => identifier(value, `${label}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", `${label} contains duplicates.`);
  }
  return normalized;
}

function identifier(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(text)) {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", `${label} is invalid.`);
  }
  return text;
}

function requiredText(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new SqliteRpgEncounterMatchBindingError("corrupt-binding", `${label} is required.`);
  }
  return text;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJson(nested)]),
  );
}
