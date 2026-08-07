import { DatabaseSync, type StatementSync } from "node:sqlite";

import type { MatchSnapshot } from "./match-session.ts";
import type { MatchSnapshotStore } from "./match-store.ts";

const MATCH_TABLE = "gameframe_match_snapshots_v1";

type MatchRow = {
  match_id: string;
  game_id: string;
  revision: number;
  snapshot_json: string;
};

/**
 * Durable single-process match snapshot store for the initial VM deployment.
 *
 * RPG campaign, encounter, and RPG-bound battle state intentionally share one
 * SQLite database file. The service lifecycle remains single-owner; callers
 * must serialize competing actions for the same match before load/apply/save.
 */
export class SqliteMatchSnapshotStore<State, Action>
  implements MatchSnapshotStore<State, Action>
{
  readonly #database: DatabaseSync;
  readonly #select: StatementSync;
  readonly #upsert: StatementSync;
  readonly #clock: () => string;

  constructor(input: { filePath: string; clock?: () => string }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    const filePath = input.filePath.trim();
    this.#clock = input.clock ?? (() => new Date().toISOString());
    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA synchronous = FULL");
    if (filePath !== ":memory:") this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS ${MATCH_TABLE} (
        match_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 0),
        snapshot_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.#select = this.#database.prepare(
      `SELECT match_id, game_id, revision, snapshot_json FROM ${MATCH_TABLE} WHERE match_id = ?`,
    );
    this.#upsert = this.#database.prepare(`
      INSERT INTO ${MATCH_TABLE} (match_id, game_id, revision, snapshot_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(match_id) DO UPDATE SET
        game_id = excluded.game_id,
        revision = excluded.revision,
        snapshot_json = excluded.snapshot_json,
        updated_at = excluded.updated_at
    `);
  }

  async load(matchId: string): Promise<MatchSnapshot<State, Action> | null> {
    const normalizedMatchId = requiredText(matchId, "matchId");
    const row = this.#select.get(normalizedMatchId) as MatchRow | undefined;
    if (!row) return null;
    let snapshot: MatchSnapshot<State, Action>;
    try {
      snapshot = JSON.parse(row.snapshot_json) as MatchSnapshot<State, Action>;
    } catch (error) {
      throw new Error(`Stored match ${normalizedMatchId} contains invalid JSON.`, { cause: error });
    }
    if (
      !snapshot
      || snapshot.matchId !== row.match_id
      || snapshot.gameId !== row.game_id
      || snapshot.revision !== row.revision
      || !Array.isArray(snapshot.playerIds)
      || !Array.isArray(snapshot.events)
    ) {
      throw new Error(`Stored match ${normalizedMatchId} is corrupt.`);
    }
    return structuredClone(snapshot);
  }

  async save(snapshot: MatchSnapshot<State, Action>): Promise<void> {
    if (!snapshot || typeof snapshot !== "object") throw new TypeError("snapshot is required");
    const matchId = requiredText(snapshot.matchId, "snapshot.matchId");
    const gameId = requiredText(snapshot.gameId, "snapshot.gameId");
    if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0) {
      throw new TypeError("snapshot.revision must be a non-negative integer");
    }
    const snapshotJson = JSON.stringify(structuredClone(snapshot));
    this.#upsert.run(matchId, gameId, snapshot.revision, snapshotJson, this.#clock());
  }

  close(): void {
    this.#database.close();
  }
}

function requiredText(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}
