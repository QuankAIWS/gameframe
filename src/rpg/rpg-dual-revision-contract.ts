export type RpgRevisionPosition = {
  gameframeCoordinationRevision: number;
  narrativeRevision: number;
};

export type GameFrameCoordinationCommand = {
  commandId: string;
  expectedGameframeCoordinationRevision: number;
  gameframeEventCount: number;
};

export type RuntimeCommitKind = "runtime.events" | "runtime.encounter_launch";

export type RuntimeCommitRequest = {
  kind: RuntimeCommitKind;
  runtimeCommitId: string;
  sourceCommandId?: string;
  expectedGameframeCoordinationRevision: number;
  expectedNarrativeRevision: number;
  gameframeEventCount: number;
};

export type RuntimeCommitReceipt = {
  kind: RuntimeCommitKind;
  runtimeCommitId: string;
  sourceCommandId?: string;
  gameframeCoordinationRevision: number;
  narrativeRevision: number;
};

export type RpgRevisionContractErrorCode =
  | "invalid-input"
  | "coordination-revision-conflict"
  | "narrative-revision-conflict"
  | "runtime-commit-conflict";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_GAMEFRAME_EVENTS_PER_COMMIT = 16;

export class RpgRevisionContractError extends Error {
  readonly code: RpgRevisionContractErrorCode;

  constructor(code: RpgRevisionContractErrorCode, message: string) {
    super(message);
    this.name = "RpgRevisionContractError";
    this.code = code;
  }
}

/**
 * Small transport-neutral ledger used to prove the split between GameFrame's
 * coordination position and RPG GM Runtime's narrative journal position.
 * Persistence adapters may replace the in-memory maps, but not these rules.
 */
export class InMemoryRpgRevisionLedger {
  #position: RpgRevisionPosition;
  readonly #runtimeReceipts = new Map<
    string,
    { fingerprint: string; receipt: RuntimeCommitReceipt }
  >();

  constructor(startingPosition: RpgRevisionPosition) {
    this.#position = normalizePosition(startingPosition);
  }

  get position(): RpgRevisionPosition {
    return structuredClone(this.#position);
  }

  acceptGameFrameCommand(command: GameFrameCoordinationCommand): RpgRevisionPosition {
    const normalized = normalizeGameFrameCommand(command);
    if (
      normalized.expectedGameframeCoordinationRevision
      !== this.#position.gameframeCoordinationRevision
    ) {
      throw new RpgRevisionContractError(
        "coordination-revision-conflict",
        `Expected GameFrame coordination revision ${normalized.expectedGameframeCoordinationRevision}, actual ${this.#position.gameframeCoordinationRevision}.`,
      );
    }

    this.#position = {
      gameframeCoordinationRevision:
        this.#position.gameframeCoordinationRevision + normalized.gameframeEventCount,
      narrativeRevision: this.#position.narrativeRevision,
    };
    return this.position;
  }

  acceptRuntimeCommit(request: RuntimeCommitRequest): RuntimeCommitReceipt {
    const normalized = normalizeRuntimeCommit(request);
    const fingerprint = stableJson(normalized);
    const existing = this.#runtimeReceipts.get(normalized.runtimeCommitId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new RpgRevisionContractError(
          "runtime-commit-conflict",
          `Runtime commit ID was reused with different content: ${normalized.runtimeCommitId}.`,
        );
      }
      return structuredClone(existing.receipt);
    }

    if (
      normalized.expectedGameframeCoordinationRevision
      !== this.#position.gameframeCoordinationRevision
    ) {
      throw new RpgRevisionContractError(
        "coordination-revision-conflict",
        `Expected GameFrame coordination revision ${normalized.expectedGameframeCoordinationRevision}, actual ${this.#position.gameframeCoordinationRevision}.`,
      );
    }
    if (normalized.expectedNarrativeRevision !== this.#position.narrativeRevision) {
      throw new RpgRevisionContractError(
        "narrative-revision-conflict",
        `Expected narrative revision ${normalized.expectedNarrativeRevision}, actual ${this.#position.narrativeRevision}.`,
      );
    }

    this.#position = {
      gameframeCoordinationRevision:
        this.#position.gameframeCoordinationRevision + normalized.gameframeEventCount,
      narrativeRevision: this.#position.narrativeRevision + 1,
    };
    const receipt: RuntimeCommitReceipt = {
      kind: normalized.kind,
      runtimeCommitId: normalized.runtimeCommitId,
      ...(normalized.sourceCommandId
        ? { sourceCommandId: normalized.sourceCommandId }
        : {}),
      ...this.#position,
    };
    this.#runtimeReceipts.set(normalized.runtimeCommitId, {
      fingerprint,
      receipt: structuredClone(receipt),
    });
    return receipt;
  }
}

function normalizePosition(position: RpgRevisionPosition): RpgRevisionPosition {
  return {
    gameframeCoordinationRevision: integer(
      position?.gameframeCoordinationRevision,
      "gameframeCoordinationRevision",
      0,
    ),
    narrativeRevision: integer(position?.narrativeRevision, "narrativeRevision", 0),
  };
}

function normalizeGameFrameCommand(
  command: GameFrameCoordinationCommand,
): GameFrameCoordinationCommand {
  return {
    commandId: identifier(command?.commandId, "commandId"),
    expectedGameframeCoordinationRevision: integer(
      command?.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
      0,
    ),
    gameframeEventCount: integer(command?.gameframeEventCount, "gameframeEventCount", 1),
  };
}

function normalizeRuntimeCommit(request: RuntimeCommitRequest): RuntimeCommitRequest {
  if (request?.kind !== "runtime.events" && request?.kind !== "runtime.encounter_launch") {
    throw invalid("Unsupported runtime commit kind.");
  }
  const gameframeEventCount = integer(
    request.gameframeEventCount,
    "gameframeEventCount",
    0,
  );
  if (gameframeEventCount > MAX_GAMEFRAME_EVENTS_PER_COMMIT) {
    throw invalid(
      `gameframeEventCount cannot exceed ${MAX_GAMEFRAME_EVENTS_PER_COMMIT}.`,
    );
  }
  if (request.kind === "runtime.encounter_launch" && gameframeEventCount !== 0) {
    throw invalid("runtime.encounter_launch cannot append GameFrame campaign events.");
  }
  if (request.kind === "runtime.events" && gameframeEventCount === 0) {
    throw invalid("runtime.events must append at least one GameFrame campaign event.");
  }

  return {
    kind: request.kind,
    runtimeCommitId: identifier(request.runtimeCommitId, "runtimeCommitId"),
    ...(request.sourceCommandId
      ? { sourceCommandId: identifier(request.sourceCommandId, "sourceCommandId") }
      : {}),
    expectedGameframeCoordinationRevision: integer(
      request.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
      0,
    ),
    expectedNarrativeRevision: integer(
      request.expectedNarrativeRevision,
      "expectedNarrativeRevision",
      0,
    ),
    gameframeEventCount,
  };
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalid(`${label} is not a valid identifier.`);
  }
  return value;
}

function integer(value: unknown, label: string, minimum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > 10_000_000) {
    throw invalid(`${label} must be an integer of at least ${minimum}.`);
  }
  return Number(value);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function invalid(message: string): RpgRevisionContractError {
  return new RpgRevisionContractError("invalid-input", message);
}
