import { DatabaseSync, type StatementSync } from "node:sqlite";

const TABLE = "rpg_exploration_player_position_v1";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const HASH_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type RpgExplorationFacing = "north" | "east" | "south" | "west";

export type RpgExplorationMaterializationIdentity = {
  campaignId: string;
  playerId: string;
  sceneId: string;
  materializationId: string;
  materializationVersion: string;
  materializationHash: string;
};

export type RpgExplorationPositionSnapshot = RpgExplorationMaterializationIdentity & {
  x: number;
  y: number;
  facing: RpgExplorationFacing;
  positionRevision: number;
  updatedAt: string;
};

export class SqliteRpgExplorationPositionStoreError extends Error {
  readonly code: "invalid-input" | "position-revision-conflict" | "corrupt-store";

  constructor(
    code: SqliteRpgExplorationPositionStoreError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SqliteRpgExplorationPositionStoreError";
    this.code = code;
  }
}

type PositionRow = {
  campaign_id: string;
  player_id: string;
  scene_id: string;
  materialization_id: string;
  materialization_version: string;
  materialization_hash: string;
  x: number;
  y: number;
  facing: string;
  position_revision: number;
  updated_at: string;
};

export class SqliteRpgExplorationPositionStore {
  readonly #database: DatabaseSync;
  readonly #select: StatementSync;
  readonly #insert: StatementSync;
  readonly #update: StatementSync;

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
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        campaign_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        materialization_id TEXT NOT NULL,
        materialization_version TEXT NOT NULL,
        materialization_hash TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        facing TEXT NOT NULL CHECK (facing IN ('north', 'east', 'south', 'west')),
        position_revision INTEGER NOT NULL CHECK (position_revision >= 0),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, player_id)
      );
    `);
    this.#select = this.#database.prepare(`
      SELECT * FROM ${TABLE} WHERE campaign_id = ? AND player_id = ?
    `);
    this.#insert = this.#database.prepare(`
      INSERT INTO ${TABLE} (
        campaign_id, player_id, scene_id, materialization_id,
        materialization_version, materialization_hash,
        x, y, facing, position_revision, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.#update = this.#database.prepare(`
      UPDATE ${TABLE}
      SET scene_id = ?, materialization_id = ?, materialization_version = ?,
          materialization_hash = ?, x = ?, y = ?, facing = ?,
          position_revision = ?, updated_at = ?
      WHERE campaign_id = ? AND player_id = ?
    `);
  }

  load(identityValue: RpgExplorationMaterializationIdentity): RpgExplorationPositionSnapshot | undefined {
    const identity = normalizeIdentity(identityValue);
    const row = this.#select.get(identity.campaignId, identity.playerId) as PositionRow | undefined;
    if (!row) return undefined;
    const snapshot = snapshotFromRow(row);
    return sameMaterialization(snapshot, identity) ? snapshot : undefined;
  }

  commit(input: RpgExplorationMaterializationIdentity & {
    expectedPositionRevision: number;
    x: number;
    y: number;
    facing: RpgExplorationFacing;
    updatedAt: string;
  }): RpgExplorationPositionSnapshot {
    const identity = normalizeIdentity(input);
    const expectedPositionRevision = nonNegativeInteger(
      input.expectedPositionRevision,
      "expectedPositionRevision",
    );
    const x = integer(input.x, "x");
    const y = integer(input.y, "y");
    const facing = normalizeFacing(input.facing);
    const updatedAt = timestamp(input.updatedAt);
    const existingRow = this.#select.get(identity.campaignId, identity.playerId) as PositionRow | undefined;

    if (!existingRow) {
      if (expectedPositionRevision !== 0) throw revisionConflict(expectedPositionRevision, 0);
      const positionRevision = 1;
      this.#insert.run(
        identity.campaignId,
        identity.playerId,
        identity.sceneId,
        identity.materializationId,
        identity.materializationVersion,
        identity.materializationHash,
        x,
        y,
        facing,
        positionRevision,
        updatedAt,
      );
      return { ...identity, x, y, facing, positionRevision, updatedAt };
    }

    const existing = snapshotFromRow(existingRow);
    const sameIdentity = sameMaterialization(existing, identity);
    if (sameIdentity && existing.positionRevision !== expectedPositionRevision) {
      throw revisionConflict(expectedPositionRevision, existing.positionRevision);
    }
    if (!sameIdentity && expectedPositionRevision !== 0) {
      throw revisionConflict(expectedPositionRevision, 0);
    }

    const positionRevision = sameIdentity ? existing.positionRevision + 1 : 1;
    this.#update.run(
      identity.sceneId,
      identity.materializationId,
      identity.materializationVersion,
      identity.materializationHash,
      x,
      y,
      facing,
      positionRevision,
      updatedAt,
      identity.campaignId,
      identity.playerId,
    );
    return { ...identity, x, y, facing, positionRevision, updatedAt };
  }

  close(): void {
    this.#database.close();
  }
}

function normalizeIdentity(
  value: RpgExplorationMaterializationIdentity,
): RpgExplorationMaterializationIdentity {
  if (!value || typeof value !== "object") throw invalidInput("materialization identity is required");
  return {
    campaignId: identifier(value.campaignId, "campaignId"),
    playerId: identifier(value.playerId, "playerId"),
    sceneId: identifier(value.sceneId, "sceneId"),
    materializationId: identifier(value.materializationId, "materializationId"),
    materializationVersion: identifier(value.materializationVersion, "materializationVersion"),
    materializationHash: materializationHash(value.materializationHash),
  };
}

function snapshotFromRow(row: PositionRow): RpgExplorationPositionSnapshot {
  try {
    const identity = normalizeIdentity({
      campaignId: row.campaign_id,
      playerId: row.player_id,
      sceneId: row.scene_id,
      materializationId: row.materialization_id,
      materializationVersion: row.materialization_version,
      materializationHash: row.materialization_hash,
    });
    return {
      ...identity,
      x: integer(row.x, "stored x"),
      y: integer(row.y, "stored y"),
      facing: normalizeFacing(row.facing),
      positionRevision: nonNegativeInteger(row.position_revision, "stored positionRevision"),
      updatedAt: timestamp(row.updated_at),
    };
  } catch (error) {
    throw new SqliteRpgExplorationPositionStoreError(
      "corrupt-store",
      `Stored RPG exploration position is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

function sameMaterialization(
  left: RpgExplorationMaterializationIdentity,
  right: RpgExplorationMaterializationIdentity,
): boolean {
  return left.campaignId === right.campaignId
    && left.playerId === right.playerId
    && left.sceneId === right.sceneId
    && left.materializationId === right.materializationId
    && left.materializationVersion === right.materializationVersion
    && left.materializationHash === right.materializationHash;
}

function identifier(value: unknown, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!IDENTIFIER_PATTERN.test(normalized)) throw invalidInput(`${label} is invalid`);
  return normalized;
}

function materializationHash(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!HASH_PATTERN.test(normalized)) throw invalidInput("materializationHash is invalid");
  return normalized;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw invalidInput(`${label} must be an integer`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const normalized = integer(value, label);
  if (normalized < 0) throw invalidInput(`${label} must be non-negative`);
  return normalized;
}

function normalizeFacing(value: unknown): RpgExplorationFacing {
  if (value === "north" || value === "east" || value === "south" || value === "west") return value;
  throw invalidInput("facing is invalid");
}

function timestamp(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  const time = Date.parse(normalized);
  if (!normalized || !Number.isFinite(time)) throw invalidInput("updatedAt must be an ISO timestamp");
  return new Date(time).toISOString();
}

function invalidInput(message: string): SqliteRpgExplorationPositionStoreError {
  return new SqliteRpgExplorationPositionStoreError("invalid-input", message);
}

function revisionConflict(expected: number, actual: number): SqliteRpgExplorationPositionStoreError {
  return new SqliteRpgExplorationPositionStoreError(
    "position-revision-conflict",
    `Expected exploration position revision ${expected}, but current revision is ${actual}.`,
  );
}
