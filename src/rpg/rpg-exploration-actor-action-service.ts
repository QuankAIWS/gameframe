import type { RpgExplorationPhysicalMaterializationV1 } from "./rpg-exploration-materializer.ts";
import {
  SqliteRpgExplorationActorPositionStore,
  type RpgExplorationActorFacing,
} from "./sqlite-rpg-exploration-actor-position-store.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

type Point = { x: number; y: number };
type Anchor = RpgExplorationPhysicalMaterializationV1["anchors"][number];

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
  transform: { x: number; y: number; facing: RpgExplorationActorFacing };
  path: Point[];
  replayed: boolean;
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
    if (!input?.positions) throw new TypeError("positions is required");
    this.#positions = input.positions;
  }

  applyPersistedTransforms(materialization: RpgExplorationPhysicalMaterializationV1): void {
    for (const anchor of materialization.anchors) {
      if (anchor.kind !== "entity" || anchor.entityClass !== "actor") continue;
      const stored = this.#positions.read(
        materialization.campaignId,
        materialization.sceneId,
        anchor.semanticId,
      );
      if (!stored || !sameRef(stored.materializationRef, materialization.materializationRef)) continue;
      anchor.x = stored.transform.x;
      anchor.y = stored.transform.y;
    }
  }

  applyPlayerPosition(
    materialization: RpgExplorationPhysicalMaterializationV1,
    playerEntityId: string,
    transform: { x: number; y: number },
  ): void {
    const player = materialization.anchors.find((anchor) =>
      anchor.kind === "player" && anchor.semanticId === playerEntityId
    );
    if (!player) {
      throw new RpgExplorationActorActionError(
        "player-unavailable",
        `Player entity ${playerEntityId} is not physically present.`,
      );
    }
    player.x = integer(transform.x, "player transform.x");
    player.y = integer(transform.y, "player transform.y");
  }

  inspect(
    inputValue: unknown,
    materialization: RpgExplorationPhysicalMaterializationV1,
  ): RpgExplorationActorInspectReceiptV1 {
    const input = normalizeActorInspectRequest(inputValue);
    if (input.campaignId !== materialization.campaignId || input.sceneId !== materialization.sceneId) {
      throw new RpgExplorationActorActionError(
        "scene-conflict",
        "Actor inspection does not match the current materialized scene.",
      );
    }

    this.applyPersistedTransforms(materialization);
    const repeated = this.#positions.readOperation(input.campaignId, input.operationId);
    if (repeated) {
      if (
        repeated.sceneId !== input.sceneId
        || repeated.actorEntityId !== input.actorEntityId
        || repeated.targetEntityId !== input.targetEntityId
        || !sameRef(repeated.materializationRef, materialization.materializationRef)
      ) {
        throw new RpgExplorationActorActionError(
          "operation-conflict",
          `Actor inspection operation ${input.operationId} was reused with different custody.`,
        );
      }
      return {
        protocolVersion: 1,
        kind: "campaign.exploration_actor_inspected",
        operationId: input.operationId,
        campaignId: input.campaignId,
        sceneId: input.sceneId,
        actorEntityId: input.actorEntityId,
        targetEntityId: input.targetEntityId,
        actorPositionRevision: repeated.positionRevision,
        transform: structuredClone(repeated.transform),
        path: [{ x: repeated.transform.x, y: repeated.transform.y }],
        replayed: true,
      };
    }

    const actor = actorAnchor(materialization, input.actorEntityId, "actor");
    const target = actorAnchor(materialization, input.targetEntityId, "target");
    if (actor.semanticId === target.semanticId) {
      throw new RpgExplorationActorActionError(
        "invalid-target",
        "An actor cannot inspect itself through this operation.",
      );
    }

    const current = { x: actor.x, y: actor.y };
    const targetPoint = { x: target.x, y: target.y };
    const path = shortestApproachPath(materialization, current, targetPoint, actor.semanticId);
    if (!path) {
      throw new RpgExplorationActorActionError(
        "path-unavailable",
        `${actor.label} cannot legally reach ${target.label}.`,
      );
    }
    const destination = path.at(-1)!;
    const transform = {
      x: destination.x,
      y: destination.y,
      facing: facingToward(destination, targetPoint),
    };
    const stored = this.#positions.commit({
      campaignId: input.campaignId,
      sceneId: input.sceneId,
      actorEntityId: input.actorEntityId,
      targetEntityId: input.targetEntityId,
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
      replayed: false,
    };
  }
}

export function normalizeActorInspectRequest(value: unknown): RpgExplorationActorInspectRequestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("Actor inspection must be an object.");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "protocolVersion",
    "kind",
    "operationId",
    "campaignId",
    "sceneId",
    "authenticatedPlayerId",
    "actorEntityId",
    "targetEntityId",
    "issuedAt",
  ]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw invalid(`Actor inspection contains unsupported fields: ${unknown.sort().join(", ")}`);
  }
  if (input.protocolVersion !== 1 || input.kind !== "campaign.exploration_actor_inspect") {
    throw invalid("Actor inspection protocol or kind is invalid.");
  }
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

function actorAnchor(
  materialization: RpgExplorationPhysicalMaterializationV1,
  entityId: string,
  label: string,
): Anchor {
  const anchor = materialization.anchors.find((candidate) =>
    candidate.semanticId === entityId
    && candidate.kind === "entity"
    && candidate.entityClass === "actor"
  );
  if (!anchor) {
    throw new RpgExplorationActorActionError(
      `${label}-unavailable`,
      `${label === "actor" ? "Actor" : "Target"} ${entityId} is not physically present.`,
    );
  }
  return anchor;
}

function shortestApproachPath(
  materialization: RpgExplorationPhysicalMaterializationV1,
  start: Point,
  target: Point,
  movingEntityId: string,
): Point[] | undefined {
  const goals = cardinal(target).filter((point) => passable(materialization, point, movingEntityId));
  const goalKeys = new Set(goals.map(key));
  if (goalKeys.has(key(start))) return [start];
  const queue: Point[] = [start];
  const previous = new Map<string, string | null>([[key(start), null]]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of cardinal(current)) {
      const nextKey = key(next);
      if (previous.has(nextKey) || !passable(materialization, next, movingEntityId)) continue;
      previous.set(nextKey, key(current));
      if (goalKeys.has(nextKey)) return reconstruct(previous, nextKey);
      queue.push(next);
    }
  }
  return undefined;
}

function passable(
  materialization: RpgExplorationPhysicalMaterializationV1,
  point: Point,
  movingEntityId: string,
): boolean {
  if (
    point.x < 0
    || point.y < 0
    || point.x >= materialization.map.width
    || point.y >= materialization.map.height
  ) return false;
  const terrain = materialization.map.cells[point.y * materialization.map.width + point.x]?.terrain;
  if (terrain === "wall") return false;
  return !materialization.anchors.some((anchor) =>
    anchor.semanticId !== movingEntityId
    && occupiesPhysicalCell(anchor.kind)
    && anchor.x === point.x
    && anchor.y === point.y
  );
}

function occupiesPhysicalCell(kind: Anchor["kind"]): boolean {
  return kind === "player" || kind === "entity" || kind === "object";
}

function reconstruct(previous: Map<string, string | null>, end: string): Point[] {
  const result: Point[] = [];
  let cursor: string | null = end;
  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    result.push({ x: x!, y: y! });
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

function facingToward(from: Point, to: Point): RpgExplorationActorFacing {
  if (to.x > from.x) return "east";
  if (to.x < from.x) return "west";
  if (to.y > from.y) return "south";
  return "north";
}

function key(point: Point): string {
  return `${point.x},${point.y}`;
}

function sameRef(left: any, right: any): boolean {
  return left.materializationId === right.materializationId
    && left.version === right.version
    && left.hash === right.hash;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalid(`${label} is not a valid identifier.`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw invalid(`${label} must be a valid timestamp.`);
  }
  return new Date(Date.parse(value)).toISOString();
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw invalid(`${label} must be a safe integer.`);
  return Number(value);
}

function invalid(message: string): RpgExplorationActorActionError {
  return new RpgExplorationActorActionError("invalid-input", message);
}
