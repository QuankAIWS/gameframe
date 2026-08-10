import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { RpgExplorationMaterializationRefV1 } from "./rpg-exploration-contract.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export type RpgExplorationActorTransformV1 = {
  campaignId: string;
  sceneId: string;
  actorEntityId: string;
  materializationRef: RpgExplorationMaterializationRefV1;
  positionRevision: number;
  transform: { x: number; y: number; facing: "north" | "south" | "east" | "west" };
  operationId: string;
};

export class SqliteRpgExplorationActorPositionStore {
  readonly #database: DatabaseSync;

  constructor(input: { filePath: string }) {
    if (!input?.filePath?.trim()) throw new TypeError("filePath is required");
    if (input.filePath !== ":memory:") mkdirSync(dirname(input.filePath), { recursive: true });
    this.#database = new DatabaseSync(input.filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS rpg_exploration_actor_positions_v1 (
        campaign_id TEXT NOT NULL,
        actor_entity_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        materialization_id TEXT NOT NULL,
        materialization_version TEXT NOT NULL,
        materialization_hash TEXT NOT NULL,
        position_revision INTEGER NOT NULL CHECK(position_revision >= 0),
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        facing TEXT NOT NULL CHECK(facing IN ('north','south','east','west')),
        operation_id TEXT NOT NULL,
        PRIMARY KEY (campaign_id, actor_entity_id)
      )
    `);
  }

  close(): void { this.#database.close(); }

  read(campaignIdValue: unknown, actorEntityIdValue: unknown): RpgExplorationActorTransformV1 | undefined {
    const campaignId = identifier(campaignIdValue, "campaignId");
    const actorEntityId = identifier(actorEntityIdValue, "actorEntityId");
    const row = this.#database.prepare(`
      SELECT * FROM rpg_exploration_actor_positions_v1
      WHERE campaign_id = ? AND actor_entity_id = ?
    `).get(campaignId, actorEntityId) as any;
    if (!row) return undefined;
    return {
      campaignId,
      actorEntityId,
      sceneId: String(row.scene_id),
      materializationRef: {
        materializationId: String(row.materialization_id),
        version: String(row.materialization_version),
        hash: String(row.materialization_hash),
      },
      positionRevision: Number(row.position_revision),
      transform: { x: Number(row.x), y: Number(row.y), facing: row.facing },
      operationId: String(row.operation_id),
    };
  }

  commit(input: {
    campaignId: string;
    sceneId: string;
    actorEntityId: string;
    materializationRef: RpgExplorationMaterializationRefV1;
    transform: RpgExplorationActorTransformV1["transform"];
    operationId: string;
  }): RpgExplorationActorTransformV1 {
    const campaignId = identifier(input.campaignId, "campaignId");
    const sceneId = identifier(input.sceneId, "sceneId");
    const actorEntityId = identifier(input.actorEntityId, "actorEntityId");
    const operationId = identifier(input.operationId, "operationId");
    const existing = this.read(campaignId, actorEntityId);
    if (existing?.operationId === operationId) return existing;
    const sameMaterialization = existing
      && existing.sceneId === sceneId
      && sameRef(existing.materializationRef, input.materializationRef);
    const revision = sameMaterialization ? existing.positionRevision + 1 : 0;
    this.#database.prepare(`
      INSERT INTO rpg_exploration_actor_positions_v1 (
        campaign_id, actor_entity_id, scene_id, materialization_id,
        materialization_version, materialization_hash, position_revision,
        x, y, facing, operation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id, actor_entity_id) DO UPDATE SET
        scene_id=excluded.scene_id,
        materialization_id=excluded.materialization_id,
        materialization_version=excluded.materialization_version,
        materialization_hash=excluded.materialization_hash,
        position_revision=excluded.position_revision,
        x=excluded.x, y=excluded.y, facing=excluded.facing,
        operation_id=excluded.operation_id
    `).run(
      campaignId, actorEntityId, sceneId,
      input.materializationRef.materializationId,
      input.materializationRef.version,
      input.materializationRef.hash,
      revision,
      input.transform.x,
      input.transform.y,
      input.transform.facing,
      operationId,
    );
    return this.read(campaignId, actorEntityId)!;
  }
}

function sameRef(left: RpgExplorationMaterializationRefV1, right: RpgExplorationMaterializationRefV1): boolean {
  return left.materializationId === right.materializationId
    && left.version === right.version
    && left.hash === right.hash;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${label} is not a valid identifier`);
  }
  return value;
}
