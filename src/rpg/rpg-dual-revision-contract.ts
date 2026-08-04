export type RuntimeCommitKind = "runtime.events" | "runtime.encounter_launch";

export type RuntimeNarrativeCommitReceipt = {
  kind: "runtime.narrative_committed";
  runtimeCommitKind: RuntimeCommitKind;
  runtimeCommitId: string;
  sourceCommandId?: string;
  sourceGameframeCoordinationRevision: number;
  previousNarrativeRevision: number;
  narrativeRevision: number;
};

export type GameFrameCoordinationState = {
  gameframeCoordinationRevision: number;
  presentationSequence: number;
  linkedNarrativeRevision: number;
};

export type GameFrameCommandRequest = {
  commandId: string;
  expectedGameframeCoordinationRevision: number;
  presentationEventCount: number;
};

export type GameFrameCommandReceipt = GameFrameCoordinationState & {
  kind: "gameframe.command_committed";
  commandId: string;
};

export type GameFrameRuntimeLinkRequest = {
  coordinationMutationId: string;
  expectedGameframeCoordinationRevision: number;
  presentationEventCount: number;
  runtimeCommit: RuntimeNarrativeCommitReceipt;
};

export type GameFrameRuntimeLinkReceipt = GameFrameCoordinationState & {
  kind: "gameframe.runtime_link_committed";
  coordinationMutationId: string;
  runtimeCommitId: string;
};

export type RpgRevisionContractErrorCode =
  | "invalid-input"
  | "coordination-revision-conflict"
  | "command-conflict"
  | "coordination-mutation-conflict"
  | "runtime-link-conflict"
  | "runtime-source-revision-conflict"
  | "narrative-link-conflict";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_PRESENTATION_EVENTS_PER_TRANSACTION = 16;

export class RpgRevisionContractError extends Error {
  readonly code: RpgRevisionContractErrorCode;

  constructor(code: RpgRevisionContractErrorCode, message: string) {
    super(message);
    this.name = "RpgRevisionContractError";
    this.code = code;
  }
}

/**
 * GameFrame-owned coordination test ledger.
 *
 * It records the latest runtime narrative revision that GameFrame has linked,
 * but it never creates or increments narrative revisions. Production
 * persistence may replace these maps while preserving the same ownership and
 * retry rules.
 */
export class InMemoryGameFrameCoordinationLedger {
  #state: GameFrameCoordinationState;
  readonly #commandReceipts = new Map<
    string,
    { fingerprint: string; receipt: GameFrameCommandReceipt }
  >();
  readonly #coordinationReceipts = new Map<
    string,
    { fingerprint: string; receipt: GameFrameRuntimeLinkReceipt }
  >();
  readonly #linkedRuntimeCommits = new Map<string, string>();

  constructor(startingState: GameFrameCoordinationState) {
    this.#state = normalizeState(startingState);
  }

  get state(): GameFrameCoordinationState {
    return structuredClone(this.#state);
  }

  acceptCommand(request: GameFrameCommandRequest): GameFrameCommandReceipt {
    const normalized = normalizeCommandRequest(request);
    const fingerprint = stableJson(normalized);
    const existing = this.#commandReceipts.get(normalized.commandId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new RpgRevisionContractError(
          "command-conflict",
          `Command ID was reused with different coordination content: ${normalized.commandId}.`,
        );
      }
      return structuredClone(existing.receipt);
    }

    requireCoordinationRevision(
      normalized.expectedGameframeCoordinationRevision,
      this.#state.gameframeCoordinationRevision,
    );
    this.#state = {
      gameframeCoordinationRevision: this.#state.gameframeCoordinationRevision + 1,
      presentationSequence:
        this.#state.presentationSequence + normalized.presentationEventCount,
      linkedNarrativeRevision: this.#state.linkedNarrativeRevision,
    };
    const receipt: GameFrameCommandReceipt = {
      kind: "gameframe.command_committed",
      commandId: normalized.commandId,
      ...this.#state,
    };
    this.#commandReceipts.set(normalized.commandId, {
      fingerprint,
      receipt: structuredClone(receipt),
    });
    return receipt;
  }

  acceptRuntimeLink(
    request: GameFrameRuntimeLinkRequest,
  ): GameFrameRuntimeLinkReceipt {
    const normalized = normalizeRuntimeLinkRequest(request);
    const fingerprint = stableJson(normalized);
    const existing = this.#coordinationReceipts.get(
      normalized.coordinationMutationId,
    );
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new RpgRevisionContractError(
          "coordination-mutation-conflict",
          `Coordination mutation ID was reused with different content: ${normalized.coordinationMutationId}.`,
        );
      }
      return structuredClone(existing.receipt);
    }

    const linkedMutationId = this.#linkedRuntimeCommits.get(
      normalized.runtimeCommit.runtimeCommitId,
    );
    if (linkedMutationId) {
      throw new RpgRevisionContractError(
        "runtime-link-conflict",
        `Runtime commit ${normalized.runtimeCommit.runtimeCommitId} is already linked by ${linkedMutationId}.`,
      );
    }

    requireCoordinationRevision(
      normalized.expectedGameframeCoordinationRevision,
      this.#state.gameframeCoordinationRevision,
    );
    if (
      normalized.runtimeCommit.sourceGameframeCoordinationRevision
      !== normalized.expectedGameframeCoordinationRevision
    ) {
      throw new RpgRevisionContractError(
        "runtime-source-revision-conflict",
        `Runtime commit was derived from GameFrame coordination revision ${normalized.runtimeCommit.sourceGameframeCoordinationRevision}, but linkage expected ${normalized.expectedGameframeCoordinationRevision}.`,
      );
    }
    if (
      normalized.runtimeCommit.previousNarrativeRevision
      !== this.#state.linkedNarrativeRevision
    ) {
      throw new RpgRevisionContractError(
        "narrative-link-conflict",
        `Runtime commit starts at narrative revision ${normalized.runtimeCommit.previousNarrativeRevision}, but GameFrame last linked revision ${this.#state.linkedNarrativeRevision}.`,
      );
    }

    this.#state = {
      gameframeCoordinationRevision: this.#state.gameframeCoordinationRevision + 1,
      presentationSequence:
        this.#state.presentationSequence + normalized.presentationEventCount,
      linkedNarrativeRevision: normalized.runtimeCommit.narrativeRevision,
    };
    const receipt: GameFrameRuntimeLinkReceipt = {
      kind: "gameframe.runtime_link_committed",
      coordinationMutationId: normalized.coordinationMutationId,
      runtimeCommitId: normalized.runtimeCommit.runtimeCommitId,
      ...this.#state,
    };
    this.#coordinationReceipts.set(normalized.coordinationMutationId, {
      fingerprint,
      receipt: structuredClone(receipt),
    });
    this.#linkedRuntimeCommits.set(
      normalized.runtimeCommit.runtimeCommitId,
      normalized.coordinationMutationId,
    );
    return receipt;
  }
}

function normalizeState(state: GameFrameCoordinationState): GameFrameCoordinationState {
  const gameframeCoordinationRevision = integer(
    state?.gameframeCoordinationRevision,
    "gameframeCoordinationRevision",
    0,
  );
  const presentationSequence = integer(
    state?.presentationSequence,
    "presentationSequence",
    0,
  );
  const linkedNarrativeRevision = integer(
    state?.linkedNarrativeRevision,
    "linkedNarrativeRevision",
    0,
  );
  return {
    gameframeCoordinationRevision,
    presentationSequence,
    linkedNarrativeRevision,
  };
}

function normalizeCommandRequest(
  request: GameFrameCommandRequest,
): GameFrameCommandRequest {
  return {
    commandId: identifier(request?.commandId, "commandId"),
    expectedGameframeCoordinationRevision: integer(
      request?.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
      0,
    ),
    presentationEventCount: boundedPresentationEventCount(
      request?.presentationEventCount,
    ),
  };
}

function normalizeRuntimeLinkRequest(
  request: GameFrameRuntimeLinkRequest,
): GameFrameRuntimeLinkRequest {
  return {
    coordinationMutationId: identifier(
      request?.coordinationMutationId,
      "coordinationMutationId",
    ),
    expectedGameframeCoordinationRevision: integer(
      request?.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
      0,
    ),
    presentationEventCount: boundedPresentationEventCount(
      request?.presentationEventCount,
    ),
    runtimeCommit: normalizeRuntimeCommitReceipt(request?.runtimeCommit),
  };
}

function normalizeRuntimeCommitReceipt(
  receipt: RuntimeNarrativeCommitReceipt,
): RuntimeNarrativeCommitReceipt {
  if (receipt?.kind !== "runtime.narrative_committed") {
    throw invalid("Unsupported runtime narrative receipt kind.");
  }
  if (
    receipt.runtimeCommitKind !== "runtime.events"
    && receipt.runtimeCommitKind !== "runtime.encounter_launch"
  ) {
    throw invalid("Unsupported runtime commit kind.");
  }
  const sourceGameframeCoordinationRevision = integer(
    receipt.sourceGameframeCoordinationRevision,
    "sourceGameframeCoordinationRevision",
    0,
  );
  const previousNarrativeRevision = integer(
    receipt.previousNarrativeRevision,
    "previousNarrativeRevision",
    0,
  );
  const narrativeRevision = integer(
    receipt.narrativeRevision,
    "narrativeRevision",
    1,
  );
  if (narrativeRevision !== previousNarrativeRevision + 1) {
    throw invalid("Runtime narrative receipt must advance exactly one revision.");
  }
  return {
    kind: "runtime.narrative_committed",
    runtimeCommitKind: receipt.runtimeCommitKind,
    runtimeCommitId: identifier(receipt.runtimeCommitId, "runtimeCommitId"),
    ...(receipt.sourceCommandId
      ? { sourceCommandId: identifier(receipt.sourceCommandId, "sourceCommandId") }
      : {}),
    sourceGameframeCoordinationRevision,
    previousNarrativeRevision,
    narrativeRevision,
  };
}

function boundedPresentationEventCount(value: unknown): number {
  const count = integer(value, "presentationEventCount", 0);
  if (count > MAX_PRESENTATION_EVENTS_PER_TRANSACTION) {
    throw invalid(
      `presentationEventCount cannot exceed ${MAX_PRESENTATION_EVENTS_PER_TRANSACTION}.`,
    );
  }
  return count;
}

function requireCoordinationRevision(expected: number, actual: number): void {
  if (expected !== actual) {
    throw new RpgRevisionContractError(
      "coordination-revision-conflict",
      `Expected GameFrame coordination revision ${expected}, actual ${actual}.`,
    );
  }
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
