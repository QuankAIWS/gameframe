import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { RpgExplorationMaterializationRefV1 } from "./rpg-exploration-contract.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export type RpgExplorationActorFacing = "north" | "south" | "east" | "west";

export type RpgExplorationActorTransformV1 = {
  campaignId: string;
  sceneId: string;
  actorEntityId: string;
  targetEntityId: string;
  materializationRef: RpgExplorationMaterializationRefV1;
  positionRevision: number;
  transform: { x: number; y: number; facing: RpgExplorationActorFacing };
  operationId: string;
};

type ActorPositionRow = {
  campaign_id: string;
  scene_id: string;
  actor_entity_id: string;
  target_entity_id: string;
  materialization_id: string;
  materialization_version: string;
  materialization_hash: string;
  position_revision: number;
  x: number;
  y: number;
  facing: RpgExplorationActorFacing;
  operation_id: string;
};

export class SqliteRpgExplorationActorPositionStore {
  readonly #database: DatabaseSync;

  constructor(input: { filePath: string }) {
    if (!input?.filePath?.trim()) throw new TypeError("filePath is required");
    const filePath = input.filePath.trim();
    if (filePath !== ":memory:") mkdirSync(dirname(filePath), { recursive: true });
    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS rpg_exploration_actor_positions_v1 (
        campaign_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        actor_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        materialization_id TEXT NOT NULL,
        materialization_version TEXT NOT NULL,
        materialization_hash TEXT NOT NULL,
        position_revision INTEGER NOT NULL CHECK(position_revision >= 0),
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        facing TEXT NOT NULL CHECK(facing IN ('north','south','east','west')),
        operation_id TEXT NOT NULL,
        PRIMARY KEY (campaign_id, scene_id, actor_entity_id)
      );
      CREATE TABLE IF NOT EXISTS rpg_exploration_actor_operations_v1 (
        campaign_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        actor_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        materialization_id TEXT NOT NULL,
        materialization_version TEXT NOT NULL,
        materialization_hash TEXT NOT NULL,
        position_revision INTEGER NOT NULL CHECK(position_revision >= 0),
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        facing TEXT NOT NULL CHECK(facing IN ('north','south','east','west')),
        PRIMARY KEY (campaign_id, operation_id)
      )
    `);
  }

  close(): void {
    this.#database.close();
  }

  read(campaignIdValue: unknown, sceneIdValue: unknown, actorEntityIdValue: unknown): RpgExplorationActorTransformV1 | undefined {
    const campaignId = identifier(campaignIdValue, "campaignId");
    const sceneId = identifier(sceneIdValue, "sceneId");
    const actorEntityId = identifier(actorEntityIdValue, "actorEntityId");
    const row = this.#database.prepare(`
      SELECT * FROM rpg_exploration_actor_positions_v1
      WHERE campaign_id = ? AND scene_id = ? AND actor_entity_id = ?
    `).get(campaignId, sceneId, actorEntityId) as ActorPositionRow | undefined;
    return row ? fromRow(row) : undefined;
  }

  readOperation(campaignIdValue: unknown, operationIdValue: unknown): RpgExplorationActorTransformV1 | undefined {
    const campaignId = identifier(campaignIdValue, "campaignId");
    const operationId = identifier(operationIdValue, "operationId");
    const row = this.#database.prepare(`
      SELECT * FROM rpg_exploration_actor_operations_v1
      WHERE campaign_id = ? AND operation_id = ?
    `).get(campaignId, operationId) as ActorPositionRow | undefined;
    return row ? fromRow(row) : undefined;
  }

  commit(input: {
    campaignId: string;
    sceneId: string;
    actorEntityId: string;
    targetEntityId: string;
    materializationRef: RpgExplorationMaterializationRefV1;
    transform: RpgExplorationActorTransformV1["transform"];
    operationId: string;
  }): RpgExplorationActorTransformV1 {
    const campaignId = identifier(input.campaignId, "campaignId");
    const sceneId = identifier(input.sceneId, "sceneId");
    const actorEntityId = identifier(input.actorEntityId, "actorEntityId");
    const targetEntityId = identifier(input.targetEntityId, "targetEntityId");
    const operationId = identifier(input.operationId, "operationId");
    const repeated = this.readOperation(campaignId, operationId);
    if (repeated) {
      assertSameCustody(repeated, { sceneId, actorEntityId, targetEntityId, materializationRef: input.materializationRef, operationId });
      return repeated;
    }

    const existing = this.read(campaignId, sceneId, actorEntityId);
    const sameMaterialization = existing && sameRef(existing.materializationRef, input.materializationRef);
    const revision = sameMaterialization ? existing.positionRevision + 1 : 0;
    const x = integer(input.transform.x, "transform.x");
    const y = integer(input.transform.y, "transform.y");
    const direction = facing(input.transform.facing);

    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(`
        INSERT INTO rpg_exploration_actor_positions_v1 (
          campaign_id, scene_id, actor_entity_id, target_entity_id,
          materialization_id, materialization_version, materialization_hash,
          position_revision, x, y, facing, operation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, scene_id, actor_entity_id) DO UPDATE SET
          target_entity_id=excluded.target_entity_id,
          materialization_id=excluded.materialization_id,
          materialization_version=excluded.materialization_version,
          materialization_hash=excluded.materialization_hash,
          position_revision=excluded.position_revision,
          x=excluded.x,
          y=excluded.y,
          facing=excluded.facing,
          operation_id=excluded.operation_id
      `).run(campaignId, sceneId, actorEntityId, targetEntityId, input.materializationRef.materializationId, input.materializationRef.version, input.materializationRef.hash, revision, x, y, direction, operationId);
      this.#database.prepare(`
        INSERT INTO rpg_exploration_actor_operations_v1 (
          campaign_id, operation_id, scene_id, actor_entity_id, target_entity_id,
          materialization_id, materialization_version, materialization_hash,
          position_revision, x, y, facing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(campaignId, operationId, sceneId, actorEntityId, targetEntityId, input.materializationRef.materializationId, input.materializationRef.version, input.materializationRef.hash, revision, x, y, direction);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      const raced = this.readOperation(campaignId, operationId);
      if (raced) {
        assertSameCustody(raced, { sceneId, actorEntityId, targetEntityId, materializationRef: input.materializationRef, operationId });
        return raced;
      }
      throw error;
    }
    return this.readOperation(campaignId, operationId)!;
  }
}

function assertSameCustody(existing: RpgExplorationActorTransformV1, input: Pick<RpgExplorationActorTransformV1, "sceneId" | "actorEntityId" | "targetEntityId" | "materializationRef" | "operationId">): void {
  if (existing.sceneId !== input.sceneId || existing.actorEntityId !== input.actorEntityId || existing.targetEntityId !== input.targetEntityId || !sameRef(existing.materializationRef, input.materializationRef)) {
    throw new Error(`Actor operation ${input.operationId} was reused with different physical custody.`);
  }
}

function fromRow(row: ActorPositionRow): RpgExplorationActorTransformV1 {
  return {
    campaignId: identifier(row.campaign_id, "campaignId"),
    sceneId: identifier(row.scene_id, "sceneId"),
    actorEntityId: identifier(row.actor_entity_id, "actorEntityId"),
    targetEntityId: identifier(row.target_entity_id, "targetEntityId"),
    materializationRef: { materializationId: String(row.materialization_id), version: String(row.materialization_version), hash: String(row.materialization_hash) },
    positionRevision: integer(row.position_revision, "positionRevision"),
    transform: { x: integer(row.x, "x"), y: integer(row.y, "y"), facing: facing(row.facing) },
    operationId: identifier(row.operation_id, "operationId"),
  };
}

function sameRef(left: RpgExplorationMaterializationRefV1, right: RpgExplorationMaterializationRefV1): boolean {
  return left.materializationId === right.materializationId && left.version === right.version && left.hash === right.hash;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw new TypeError(`${label} is not a valid identifier`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer`);
  return Number(value);
}

function facing(value: unknown): RpgExplorationActorFacing {
  if (value === "north" || value === "south" || value === "east" || value === "west") return value;
  throw new TypeError("facing is invalid");
}
