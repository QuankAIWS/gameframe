import type { RpgExplorationProjectionV1 } from "./rpg-exploration-contract.ts";
import type {
  RpgExplorationPhysicalMaterializationV1,
} from "./rpg-exploration-materializer.ts";
import {
  SqliteRpgExplorationPositionStore,
  SqliteRpgExplorationPositionStoreError,
  type RpgExplorationFacing,
  type RpgExplorationMaterializationIdentity,
  type RpgExplorationPositionSnapshot,
} from "./sqlite-rpg-exploration-position-store.ts";

export type RpgExplorationMoveDirection = RpgExplorationFacing;

export type RpgExplorationPositionMessageV1 = {
  type: "exploration_position";
  protocolVersion: 1;
  campaignId: string;
  sceneId: string;
  playerEntityId: string;
  materializationRef: {
    materializationId: string;
    version: string;
    hash: string;
  };
  positionRevision: number;
  transform: {
    x: number;
    y: number;
    facing: RpgExplorationFacing;
  };
  moved: boolean;
  blockedBy?: "bounds" | "terrain" | "occupied";
};

export type RpgExplorationMoveRequestV1 = {
  type: "exploration_move";
  protocolVersion: 1;
  campaignId: string;
  sceneId: string;
  materializationRef: {
    materializationId: string;
    version: string;
    hash: string;
  };
  expectedPositionRevision: number;
  direction: RpgExplorationMoveDirection;
};

export class RpgExplorationMovementError extends Error {
  readonly code:
    | "invalid-input"
    | "exploration-session-unavailable"
    | "stale-materialization"
    | "position-revision-conflict";

  constructor(code: RpgExplorationMovementError["code"], message: string) {
    super(message);
    this.name = "RpgExplorationMovementError";
    this.code = code;
  }
}

type Session = {
  campaignId: string;
  playerId: string;
  playerEntityId: string;
  sceneId: string;
  materialization: RpgExplorationPhysicalMaterializationV1;
  identity: RpgExplorationMaterializationIdentity;
  blocked: Set<string>;
  position: {
    x: number;
    y: number;
    facing: RpgExplorationFacing;
    positionRevision: number;
  };
};

const DELTAS: Readonly<Record<RpgExplorationMoveDirection, { x: number; y: number }>> = Object.freeze({
  north: Object.freeze({ x: 0, y: -1 }),
  east: Object.freeze({ x: 1, y: 0 }),
  south: Object.freeze({ x: 0, y: 1 }),
  west: Object.freeze({ x: -1, y: 0 }),
});

export class RpgExplorationMovementService {
  readonly #positions: SqliteRpgExplorationPositionStore;
  readonly #clock: () => string;
  readonly #sessions = new Map<string, Session>();

  constructor(input: {
    positions: SqliteRpgExplorationPositionStore;
    clock?: () => string;
  }) {
    if (!input?.positions) throw new TypeError("positions is required");
    this.#positions = input.positions;
    this.#clock = input.clock ?? (() => new Date().toISOString());
  }

  attach(input: {
    playerId: string;
    projection: RpgExplorationProjectionV1;
    materialization: RpgExplorationPhysicalMaterializationV1;
  }): RpgExplorationPositionMessageV1 {
    const { playerId, projection, materialization } = input;
    if (projection.viewer.playerId !== playerId) {
      throw invalid("Authenticated player does not match exploration projection viewer.");
    }
    if (
      materialization.campaignId !== projection.campaignId
      || materialization.sceneId !== projection.scene.sceneId
    ) {
      throw invalid("Exploration materialization does not match the semantic projection.");
    }
    const playerEntityId = projection.viewer.playerCharacterEntityId;
    const playerAnchor = materialization.anchors.find(
      (anchor) => anchor.kind === "player" && anchor.semanticId === playerEntityId,
    );
    if (!playerAnchor) throw invalid("Exploration materialization is missing the authenticated player anchor.");

    const identity = materializationIdentity(playerId, materialization);
    const stored = this.#positions.load(identity);
    const ownedDeployedMonsterIds = new Set(
      (projection.viewer.monsters ?? [])
        .filter((monster) =>
          monster.deploymentState === "deployed"
          && monster.deployedSceneId === projection.scene.sceneId
        )
        .map((monster) => monster.monsterId),
    );
    const prePlacementBlocked = blockedCells(
      materialization,
      playerEntityId,
      ownedDeployedMonsterIds,
    );
    const preferredPlayerPosition = stored
      && isTraversable(materialization, prePlacementBlocked, stored.x, stored.y)
      ? { x: stored.x, y: stored.y }
      : { x: playerAnchor.x, y: playerAnchor.y };
    placeOwnedDeployedMonstersBesidePlayer(
      materialization,
      ownedDeployedMonsterIds,
      preferredPlayerPosition,
      playerEntityId,
    );
    const blocked = blockedCells(materialization, playerEntityId);

    let position: Session["position"];
    if (stored && isTraversable(materialization, blocked, stored.x, stored.y)) {
      position = positionFromSnapshot(stored);
    } else {
      if (!isTraversable(materialization, blocked, playerAnchor.x, playerAnchor.y)) {
        throw invalid("Exploration player spawn is not traversable.");
      }
      if (stored) {
        const reset = this.#positions.commit({
          ...identity,
          expectedPositionRevision: stored.positionRevision,
          x: playerAnchor.x,
          y: playerAnchor.y,
          facing: "west",
          updatedAt: this.#clock(),
        });
        position = positionFromSnapshot(reset);
      } else {
        position = {
          x: playerAnchor.x,
          y: playerAnchor.y,
          facing: "west",
          positionRevision: 0,
        };
      }
    }

    const session: Session = {
      campaignId: projection.campaignId,
      playerId,
      playerEntityId,
      sceneId: projection.scene.sceneId,
      materialization,
      identity,
      blocked,
      position,
    };
    this.#sessions.set(sessionKey(projection.campaignId, playerId), session);
    return message(session, false);
  }

  move(
    authenticatedPlayerId: string,
    requestValue: unknown,
  ): RpgExplorationPositionMessageV1 {
    const request = normalizeMoveRequest(requestValue);
    const key = sessionKey(request.campaignId, authenticatedPlayerId);
    const session = this.#sessions.get(key);
    if (!session) {
      throw new RpgExplorationMovementError(
        "exploration-session-unavailable",
        "Attach the current exploration scene before sending movement.",
      );
    }
    if (
      request.sceneId !== session.sceneId
      || request.materializationRef.materializationId !== session.materialization.materializationRef.materializationId
      || request.materializationRef.version !== session.materialization.materializationRef.version
      || request.materializationRef.hash !== session.materialization.materializationRef.hash
    ) {
      throw new RpgExplorationMovementError(
        "stale-materialization",
        "Exploration movement refers to a stale physical materialization.",
      );
    }
    if (request.expectedPositionRevision !== session.position.positionRevision) {
      throw new RpgExplorationMovementError(
        "position-revision-conflict",
        `Expected exploration position revision ${request.expectedPositionRevision}, but current revision is ${session.position.positionRevision}.`,
      );
    }

    const delta = DELTAS[request.direction];
    const target = {
      x: session.position.x + delta.x,
      y: session.position.y + delta.y,
    };
    const blockedBy = collision(session, target.x, target.y);
    const nextX = blockedBy ? session.position.x : target.x;
    const nextY = blockedBy ? session.position.y : target.y;
    const changed = nextX !== session.position.x
      || nextY !== session.position.y
      || request.direction !== session.position.facing;
    if (!changed) return message(session, false, blockedBy);

    let committed: RpgExplorationPositionSnapshot;
    try {
      committed = this.#positions.commit({
        ...session.identity,
        expectedPositionRevision: session.position.positionRevision,
        x: nextX,
        y: nextY,
        facing: request.direction,
        updatedAt: this.#clock(),
      });
    } catch (error) {
      if (
        error instanceof SqliteRpgExplorationPositionStoreError
        && error.code === "position-revision-conflict"
      ) {
        throw new RpgExplorationMovementError("position-revision-conflict", error.message);
      }
      throw error;
    }
    session.position = positionFromSnapshot(committed);
    return message(session, !blockedBy, blockedBy);
  }
}

export function normalizeMoveRequest(value: unknown): RpgExplorationMoveRequestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("Exploration movement message must be an object.");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "type",
    "protocolVersion",
    "campaignId",
    "sceneId",
    "materializationRef",
    "expectedPositionRevision",
    "direction",
  ]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw invalid(`Exploration movement contains unsupported fields: ${unknown.sort().join(", ")}`);
  }
  if (input.type !== "exploration_move" || input.protocolVersion !== 1) {
    throw invalid("Exploration movement protocol or type is not supported.");
  }
  const materializationRef = input.materializationRef;
  if (!materializationRef || typeof materializationRef !== "object" || Array.isArray(materializationRef)) {
    throw invalid("materializationRef is required.");
  }
  const reference = materializationRef as Record<string, unknown>;
  if (Object.keys(reference).some((key) => !["materializationId", "version", "hash"].includes(key))) {
    throw invalid("materializationRef contains unsupported fields.");
  }
  const direction = normalizeDirection(input.direction);
  return {
    type: "exploration_move",
    protocolVersion: 1,
    campaignId: requiredText(input.campaignId, "campaignId"),
    sceneId: requiredText(input.sceneId, "sceneId"),
    materializationRef: {
      materializationId: requiredText(reference.materializationId, "materializationId"),
      version: requiredText(reference.version, "materialization version"),
      hash: requiredText(reference.hash, "materialization hash"),
    },
    expectedPositionRevision: nonNegativeInteger(input.expectedPositionRevision, "expectedPositionRevision"),
    direction,
  };
}

function materializationIdentity(
  playerId: string,
  materialization: RpgExplorationPhysicalMaterializationV1,
): RpgExplorationMaterializationIdentity {
  return {
    campaignId: materialization.campaignId,
    playerId,
    sceneId: materialization.sceneId,
    materializationId: materialization.materializationRef.materializationId,
    materializationVersion: materialization.materializationRef.version,
    materializationHash: materialization.materializationRef.hash,
  };
}

function blockedCells(
  materialization: RpgExplorationPhysicalMaterializationV1,
  playerEntityId: string,
  ignoredEntityIds: ReadonlySet<string> = new Set(),
): Set<string> {
  return new Set(materialization.anchors
    .filter((anchor) => anchor.semanticId !== playerEntityId)
    .filter((anchor) => !ignoredEntityIds.has(anchor.semanticId))
    .filter((anchor) => anchor.kind === "entity" || anchor.kind === "object")
    .map((anchor) => coordinateKey(anchor.x, anchor.y)));
}

function placeOwnedDeployedMonstersBesidePlayer(
  materialization: RpgExplorationPhysicalMaterializationV1,
  monsterIds: ReadonlySet<string>,
  player: { x: number; y: number },
  playerEntityId: string,
): void {
  if (monsterIds.size === 0) return;
  const companions = materialization.anchors
    .filter((anchor) =>
      anchor.kind === "entity"
      && anchor.entityClass === "monster"
      && monsterIds.has(anchor.semanticId)
    )
    .sort((left, right) => left.semanticId.localeCompare(right.semanticId));
  const occupied = blockedCells(materialization, playerEntityId, monsterIds);
  occupied.add(coordinateKey(player.x, player.y));
  const candidates = deterministicPlacementCandidates(materialization, player);
  for (const companion of companions) {
    const position = candidates.find((candidate) =>
      isTraversable(materialization, occupied, candidate.x, candidate.y)
    );
    if (!position) {
      throw invalid(`No legal deployment cell is available for ${companion.label}.`);
    }
    companion.x = position.x;
    companion.y = position.y;
    occupied.add(coordinateKey(position.x, position.y));
  }
}

/**
 * Produces stable Manhattan rings around the player's persisted position. The
 * first ring preserves the original west/south/north/east preference; wider
 * rings prevent a valid semantic scene from becoming unloadable merely because
 * all four adjacent cells are occupied.
 */
function deterministicPlacementCandidates(
  materialization: RpgExplorationPhysicalMaterializationV1,
  player: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number }> = [];
  const maximumDistance = materialization.map.width + materialization.map.height;
  for (let distance = 1; distance <= maximumDistance; distance += 1) {
    for (let xOffset = -distance; xOffset <= distance; xOffset += 1) {
      const yMagnitude = distance - Math.abs(xOffset);
      if (yMagnitude === 0) {
        candidates.push({ x: player.x + xOffset, y: player.y });
        continue;
      }
      candidates.push({ x: player.x + xOffset, y: player.y + yMagnitude });
      candidates.push({ x: player.x + xOffset, y: player.y - yMagnitude });
    }
  }
  return candidates;
}

function collision(
  session: Session,
  x: number,
  y: number,
): RpgExplorationPositionMessageV1["blockedBy"] | undefined {
  if (
    x < 0
    || y < 0
    || x >= session.materialization.map.width
    || y >= session.materialization.map.height
  ) return "bounds";
  const cell = session.materialization.map.cells[y * session.materialization.map.width + x];
  if (!cell || cell.terrain === "wall") return "terrain";
  if (session.blocked.has(coordinateKey(x, y))) return "occupied";
  return undefined;
}

function isTraversable(
  materialization: RpgExplorationPhysicalMaterializationV1,
  blocked: Set<string>,
  x: number,
  y: number,
): boolean {
  if (x < 0 || y < 0 || x >= materialization.map.width || y >= materialization.map.height) return false;
  const cell = materialization.map.cells[y * materialization.map.width + x];
  return Boolean(cell && cell.terrain !== "wall" && !blocked.has(coordinateKey(x, y)));
}

function message(
  session: Session,
  moved: boolean,
  blockedBy?: RpgExplorationPositionMessageV1["blockedBy"],
): RpgExplorationPositionMessageV1 {
  return {
    type: "exploration_position",
    protocolVersion: 1,
    campaignId: session.campaignId,
    sceneId: session.sceneId,
    playerEntityId: session.playerEntityId,
    materializationRef: { ...session.materialization.materializationRef },
    positionRevision: session.position.positionRevision,
    transform: {
      x: session.position.x,
      y: session.position.y,
      facing: session.position.facing,
    },
    moved,
    ...(blockedBy ? { blockedBy } : {}),
  };
}

function positionFromSnapshot(snapshot: RpgExplorationPositionSnapshot) {
  return {
    x: snapshot.x,
    y: snapshot.y,
    facing: snapshot.facing,
    positionRevision: snapshot.positionRevision,
  };
}

function sessionKey(campaignId: string, playerId: string): string {
  return `${campaignId}\u0000${playerId}`;
}

function coordinateKey(x: number, y: number): string {
  return `${x},${y}`;
}

function normalizeDirection(value: unknown): RpgExplorationMoveDirection {
  if (value === "north" || value === "east" || value === "south" || value === "west") return value;
  throw invalid("direction is invalid");
}

function requiredText(value: unknown, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || /[\r\n\0]/.test(normalized)) {
    throw invalid(`${label} is invalid`);
  }
  return normalized;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalid(`${label} must be a non-negative integer`);
  }
  return value;
}

function invalid(message: string): RpgExplorationMovementError {
  return new RpgExplorationMovementError("invalid-input", message);
}
