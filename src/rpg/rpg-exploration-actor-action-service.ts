import type { RpgExplorationPhysicalMaterializationV1 } from "./rpg-exploration-materializer.ts";
import { SqliteRpgExplorationActorPositionStore } from "./sqlite-rpg-exploration-actor-position-store.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

type Point = { x: number; y: number };
type Facing = "north" | "south" | "east" | "west";

export type RpgExplorationActorInspectRequestV1 = {
  protocolVersion: 1;
  kind: "campaign.exploration_actor_inspect";
  operationId: string;
  campaignId: string;
  sceneId: string;
  authenticatedPlayerId: string;
  actorEntityId: string;
  targetEntityId: string;
  issuedAt: string;
};

export type RpgExplorationActorInspectReceiptV1 = {
  protocolVersion: 1;
  kind: "campaign.exploration_actor_inspected";
  operationId: string;
  campaignId: string;
  sceneId: string;
  actorEntityId: string;
  targetEntityId: string;
  actorPositionRevision: number;
  transform: { x: number; y: number; facing: Facing };
  path: Point[];
};

export class RpgExplorationActorActionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RpgExplorationActorActionError";
    this.code = code;
  }
}

export class RpgExplorationActorActionService {
  readonly #positions: SqliteRpgExplorationActorPositionStore;

  constructor(input: { positions: SqliteRpgExplorationActorPositionStore }) {
    this.#positions = input.positions;
  }

  applyPersistedTransforms(materialization: RpgExplorationPhysicalMaterializationV1): void {
    for (const anchor of materialization.anchors) {
      if (anchor.kind !== "entity" || anchor.entityClass !== "actor") continue;
      const stored = this.#positions.read(materialization.campaignId, anchor.semanticId);
      if (!stored) continue;
      if (
        stored.sceneId !== materialization.sceneId
        || !sameRef(stored.materializationRef, materialization.materializationRef)
      ) continue;
      anchor.x = stored.transform.x;
      anchor.y = stored.transform.y;
    }
  }

  inspect(inputValue: unknown, materialization: RpgExplorationPhysicalMaterializationV1): RpgExplorationActorInspectReceiptV1 {
    const input = normalizeActorInspectRequest(inputValue);
    if (input.campaignId !== materialization.campaignId || input.sceneId !== materialization.sceneId) {
      throw new RpgExplorationActorActionError("scene-conflict", "Actor inspection does not match the current materialized scene.");
    }
    this.applyPersistedTransforms(materialization);
    const actor = materialization.anchors.find((anchor) =>
      anchor.semanticId === input.actorEntityId && anchor.kind === "entity" && anchor.entityClass === "actor"
    );
    const target = materialization.anchors.find((anchor) =>
      anchor.semanticId === input.targetEntityId && anchor.kind === "entity" && anchor.entityClass === "actor"
    );
    if (!actor) throw new RpgExplorationActorActionError("actor-unavailable", `Actor ${input.actorEntityId} is not physically present.`);
    if (!target) throw new RpgExplorationActorActionError("target-unavailable", `Target ${input.targetEntityId} is not physically present.`);
    if (actor.semanticId === target.semanticId) {
      throw new RpgExplorationActorActionError("invalid-target", "An actor cannot inspect itself through this operation.");
    }

    const current = { x: actor.x, y: actor.y };
    const existing = this.#positions.read(input.campaignId, input.actorEntityId);
    if (existing?.operationId === input.operationId) {
      return {
        protocolVersion: 1,
        kind: "campaign.exploration_actor_inspected",
        operationId: input.operationId,
        campaignId: input.campaignId,
        sceneId: input.sceneId,
        actorEntityId: input.actorEntityId,
        targetEntityId: input.targetEntityId,
        actorPositionRevision: existing.positionRevision,
        transform: structuredClone(existing.transform),
        path: [current, { x: existing.transform.x, y: existing.transform.y }],
      };
    }

    const path = shortestApproachPath(materialization, current, { x: target.x, y: target.y }, actor.semanticId);
    if (!path) {
      throw new RpgExplorationActorActionError("path-unavailable", `${actor.label} cannot legally reach ${target.label}.`);
    }
    const destination = path.at(-1)!;
    const transform = {
      x: destination.x,
      y: destination.y,
      facing: facingToward(destination, { x: target.x, y: target.y }),
    };
    const stored = this.#positions.commit({
      campaignId: input.campaignId,
      sceneId: input.sceneId,
      actorEntityId: input.actorEntityId,
      materializationRef: materialization.materializationRef,
      transform,
      operationId: input.operationId,
    });
    actor.x = stored.transform.x;
    actor.y = stored.transform.y;
    return {
      protocolVersion: 1,
      kind: "campaign.exploration_actor_inspected",
      operationId: input.operationId,
      campaignId: input.campaignId,
      sceneId: input.sceneId,
      actorEntityId: input.actorEntityId,
      targetEntityId: input.targetEntityId,
      actorPositionRevision: stored.positionRevision,
      transform: structuredClone(stored.transform),
      path,
    };
  }
}

export function normalizeActorInspectRequest(value: unknown): RpgExplorationActorInspectRequestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Actor inspection must be an object.");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["protocolVersion","kind","operationId","campaignId","sceneId","authenticatedPlayerId","actorEntityId","targetEntityId","issuedAt"]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length) throw invalid(`Actor inspection contains unsupported fields: ${unknown.sort().join(", ")}`);
  if (input.protocolVersion !== 1 || input.kind !== "campaign.exploration_actor_inspect") throw invalid("Actor inspection protocol or kind is invalid.");
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_actor_inspect",
    operationId: identifier(input.operationId, "operationId"),
    campaignId: identifier(input.campaignId, "campaignId"),
    sceneId: identifier(input.sceneId, "sceneId"),
    authenticatedPlayerId: identifier(input.authenticatedPlayerId, "authenticatedPlayerId"),
    actorEntityId: identifier(input.actorEntityId, "actorEntityId"),
    targetEntityId: identifier(input.targetEntityId, "targetEntityId"),
    issuedAt: timestamp(input.issuedAt, "issuedAt"),
  };
}

function shortestApproachPath(
  materialization: RpgExplorationPhysicalMaterializationV1,
  start: Point,
  target: Point,
  movingEntityId: string,
): Point[] | undefined {
  const goals = cardinal(target).filter((point) => passable(materialization, point, movingEntityId, target));
  const goalKeys = new Set(goals.map(key));
  if (goalKeys.has(key(start))) return [start];
  const queue: Point[] = [start];
  const previous = new Map<string, string | null>([[key(start), null]]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of cardinal(current)) {
      const nextKey = key(next);
      if (previous.has(nextKey) || !passable(materialization, next, movingEntityId, target)) continue;
      previous.set(nextKey, key(current));
      if (goalKeys.has(nextKey)) return reconstruct(previous, nextKey);
      queue.push(next);
    }
  }
  return undefined;
}

function passable(materialization: RpgExplorationPhysicalMaterializationV1, point: Point, movingEntityId: string, target: Point): boolean {
  if (point.x < 0 || point.y < 0 || point.x >= materialization.map.width || point.y >= materialization.map.height) return false;
  const terrain = materialization.map.cells[point.y * materialization.map.width + point.x]?.terrain;
  if (terrain === "wall") return false;
  return !materialization.anchors.some((anchor) =>
    anchor.semanticId !== movingEntityId
    && anchor.x === point.x && anchor.y === point.y
    && !(point.x === target.x && point.y === target.y)
  );
}

function reconstruct(previous: Map<string, string | null>, end: string): Point[] {
  const result: Point[] = [];
  let cursor: string | null = end;
  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    result.push({ x, y });
    cursor = previous.get(cursor) ?? null;
  }
  return result.reverse();
}

function cardinal(point: Point): Point[] {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
  ];
}
function facingToward(from: Point, to: Point): Facing {
  if (to.x > from.x) return "east";
  if (to.x < from.x) return "west";
  if (to.y > from.y) return "south";
  return "north";
}
function key(point: Point): string { return `${point.x},${point.y}`; }
function sameRef(left: any, right: any): boolean { return left.materializationId === right.materializationId && left.version === right.version && left.hash === right.hash; }
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw invalid(`${label} is not a valid identifier.`);
  return value;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw invalid(`${label} must be a valid timestamp.`);
  return new Date(Date.parse(value)).toISOString();
}
function invalid(message: string): RpgExplorationActorActionError { return new RpgExplorationActorActionError("invalid-input", message); }
