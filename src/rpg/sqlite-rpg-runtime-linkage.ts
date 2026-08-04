import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import {
  SqliteRpgCommandAcceptanceRepository,
} from "./sqlite-rpg-command-acceptance.ts";
import {
  type GameFrameCoordinationState,
  type RuntimeNarrativeCommitReceipt,
} from "./rpg-dual-revision-contract.ts";

const COORDINATION_TABLE = "rpg_campaign_coordination_v1";
const PRESENTATION_TABLE = "rpg_presentation_events_v1";
const RUNTIME_LINK_TABLE = "rpg_runtime_link_receipts_v1";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_EVENTS = 16;
const MAX_EVENT_BYTES = 16_384;
const MAX_BATCH_BYTES = 65_536;

type JsonRecord = Record<string, unknown>;

export type DurableRuntimePresentationEvent = {
  eventId: string;
  type:
    | "choice.presented"
    | "encounter.completed"
    | "scene.presented"
    | "narration.presented"
    | "campaign.reveal";
  audience:
    | { kind: "public" }
    | { kind: "player"; playerId: string }
    | { kind: "party"; partyId: string }
    | { kind: "runtime" };
  payload: JsonRecord;
  createdAt: string;
};

type StoredRuntimePresentationEvent = {
  eventId: string;
  kind: DurableRuntimePresentationEvent["type"];
  audience: DurableRuntimePresentationEvent["audience"];
  payload: JsonRecord;
  campaignId: string;
  presentationSequence: number;
  createdAt: string;
};

export type DurableRuntimeEventBatch = {
  protocolVersion: 2;
  coordinationMutationId: string;
  campaignId: string;
  expectedGameframeCoordinationRevision: number;
  runtimeCommit: RuntimeNarrativeCommitReceipt;
  events: DurableRuntimePresentationEvent[];
};

export type DurableRuntimeLinkReceipt = GameFrameCoordinationState & {
  protocolVersion: 2;
  kind: "gameframe.runtime_link_committed";
  campaignId: string;
  coordinationMutationId: string;
  runtimeCommitId: string;
  eventIds: string[];
};

export class SqliteRpgRuntimeLinkError extends Error {
  readonly code:
    | "invalid-input"
    | "campaign-not-found"
    | "coordination-revision-conflict"
    | "runtime-source-revision-conflict"
    | "narrative-link-conflict"
    | "coordination-mutation-conflict"
    | "runtime-commit-conflict"
    | "presentation-conflict"
    | "corrupt-store";

  constructor(
    code: SqliteRpgRuntimeLinkError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SqliteRpgRuntimeLinkError";
    this.code = code;
  }
}

type CoordinationRow = {
  campaign_id: string;
  gameframe_coordination_revision: number;
  presentation_sequence: number;
  linked_narrative_revision: number;
};

type RuntimeLinkRow = {
  campaign_id: string;
  coordination_mutation_id: string;
  runtime_commit_id: string;
  fingerprint: string;
  receipt_json: string;
  linked_at: string;
};

type PresentationRow = {
  campaign_id: string;
  presentation_sequence: number;
  event_id: string;
  event_json: string;
  created_at: string;
};

export class SqliteRpgRuntimeLinkRepository {
  readonly #database: DatabaseSync;
  readonly #faultInjector?: (stage: string) => void;
  readonly #selectState: StatementSync;
  readonly #updateState: StatementSync;
  readonly #selectByMutation: StatementSync;
  readonly #selectByRuntimeCommit: StatementSync;
  readonly #insertLink: StatementSync;
  readonly #insertPresentation: StatementSync;
  readonly #selectPresentationByEvent: StatementSync;

  constructor(input: {
    filePath: string;
    faultInjector?: (stage: string) => void;
  }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    const filePath = input.filePath.trim();
    const commandRepository = new SqliteRpgCommandAcceptanceRepository({ filePath });
    commandRepository.close();

    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA synchronous = FULL");
    if (filePath !== ":memory:") this.#database.exec("PRAGMA journal_mode = WAL");
    this.#faultInjector = input.faultInjector;
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS ${RUNTIME_LINK_TABLE} (
        campaign_id TEXT NOT NULL,
        coordination_mutation_id TEXT NOT NULL,
        runtime_commit_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        linked_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, coordination_mutation_id),
        UNIQUE (campaign_id, runtime_commit_id),
        FOREIGN KEY (campaign_id) REFERENCES ${COORDINATION_TABLE}(campaign_id)
      );
    `);

    this.#selectState = this.#database.prepare(`
      SELECT campaign_id, gameframe_coordination_revision,
             presentation_sequence, linked_narrative_revision
      FROM ${COORDINATION_TABLE} WHERE campaign_id = ?
    `);
    this.#updateState = this.#database.prepare(`
      UPDATE ${COORDINATION_TABLE}
      SET gameframe_coordination_revision = ?, presentation_sequence = ?,
          linked_narrative_revision = ?, updated_at = ?
      WHERE campaign_id = ? AND gameframe_coordination_revision = ?
    `);
    this.#selectByMutation = this.#database.prepare(`
      SELECT * FROM ${RUNTIME_LINK_TABLE}
      WHERE campaign_id = ? AND coordination_mutation_id = ?
    `);
    this.#selectByRuntimeCommit = this.#database.prepare(`
      SELECT * FROM ${RUNTIME_LINK_TABLE}
      WHERE campaign_id = ? AND runtime_commit_id = ?
    `);
    this.#insertLink = this.#database.prepare(`
      INSERT INTO ${RUNTIME_LINK_TABLE} (
        campaign_id, coordination_mutation_id, runtime_commit_id,
        fingerprint, receipt_json, linked_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.#insertPresentation = this.#database.prepare(`
      INSERT INTO ${PRESENTATION_TABLE} (
        campaign_id, presentation_sequence, event_id, event_json, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.#selectPresentationByEvent = this.#database.prepare(`
      SELECT * FROM ${PRESENTATION_TABLE}
      WHERE campaign_id = ? AND event_id = ?
    `);
  }

  close(): void {
    this.#database.close();
  }

  acceptEvents(
    batchValue: unknown,
    input: { linkedAt: string },
  ): DurableRuntimeLinkReceipt {
    const batch = normalizeBatch(batchValue);
    const linkedAt = timestamp(input?.linkedAt, "linkedAt");
    const batchFingerprint = fingerprint(stableJson(batch));

    return this.#transaction(() => {
      const existing = this.#selectByMutation.get(
        batch.campaignId,
        batch.coordinationMutationId,
      ) as RuntimeLinkRow | undefined;
      if (existing) {
        if (existing.fingerprint !== batchFingerprint) {
          throw new SqliteRpgRuntimeLinkError(
            "coordination-mutation-conflict",
            `Coordination mutation ${batch.coordinationMutationId} was reused with different content.`,
          );
        }
        const receipt = parseReceipt(existing.receipt_json, batch);
        this.#validatePresentationRows(batch, receipt);
        return receipt;
      }

      const reusedCommit = this.#selectByRuntimeCommit.get(
        batch.campaignId,
        batch.runtimeCommit.runtimeCommitId,
      ) as RuntimeLinkRow | undefined;
      if (reusedCommit) {
        throw new SqliteRpgRuntimeLinkError(
          "runtime-commit-conflict",
          `Runtime commit ${batch.runtimeCommit.runtimeCommitId} is already linked by another mutation.`,
        );
      }

      const stateRow = this.#selectState.get(batch.campaignId) as CoordinationRow | undefined;
      if (!stateRow) {
        throw new SqliteRpgRuntimeLinkError(
          "campaign-not-found",
          `Campaign ${batch.campaignId} is not initialized.`,
        );
      }
      const current = stateFromRow(stateRow);
      if (
        batch.expectedGameframeCoordinationRevision
        !== current.gameframeCoordinationRevision
      ) {
        throw new SqliteRpgRuntimeLinkError(
          "coordination-revision-conflict",
          `Expected GameFrame coordination revision ${batch.expectedGameframeCoordinationRevision}, actual ${current.gameframeCoordinationRevision}.`,
        );
      }
      if (
        batch.runtimeCommit.sourceGameframeCoordinationRevision
        !== current.gameframeCoordinationRevision
      ) {
        throw new SqliteRpgRuntimeLinkError(
          "runtime-source-revision-conflict",
          "Runtime commit was derived from a different GameFrame coordination revision.",
        );
      }
      if (
        batch.runtimeCommit.previousNarrativeRevision
        !== current.linkedNarrativeRevision
        || batch.runtimeCommit.narrativeRevision
        !== current.linkedNarrativeRevision + 1
      ) {
        throw new SqliteRpgRuntimeLinkError(
          "narrative-link-conflict",
          `Runtime narrative link must advance from ${current.linkedNarrativeRevision} to ${current.linkedNarrativeRevision + 1}.`,
        );
      }

      const next: GameFrameCoordinationState = {
        gameframeCoordinationRevision: current.gameframeCoordinationRevision + 1,
        presentationSequence: current.presentationSequence + batch.events.length,
        linkedNarrativeRevision: batch.runtimeCommit.narrativeRevision,
      };
      const eventIds: string[] = [];
      batch.events.forEach((event, index) => {
        const sequence = current.presentationSequence + index + 1;
        const stored: StoredRuntimePresentationEvent = {
          eventId: event.eventId,
          kind: event.type,
          audience: event.audience,
          payload: event.payload,
          campaignId: batch.campaignId,
          presentationSequence: sequence,
          createdAt: event.createdAt,
        };
        const storedJson = stableJson(stored);
        try {
          this.#insertPresentation.run(
            batch.campaignId,
            sequence,
            event.eventId,
            storedJson,
            event.createdAt,
          );
        } catch (error) {
          throw new SqliteRpgRuntimeLinkError(
            "presentation-conflict",
            `Presentation event ${event.eventId} conflicts with existing campaign presentation.`,
            { cause: error },
          );
        }
        eventIds.push(event.eventId);
      });
      this.#fault("after-presentation-insert");

      const updated = this.#updateState.run(
        next.gameframeCoordinationRevision,
        next.presentationSequence,
        next.linkedNarrativeRevision,
        linkedAt,
        batch.campaignId,
        current.gameframeCoordinationRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new SqliteRpgRuntimeLinkError(
          "coordination-revision-conflict",
          `Campaign ${batch.campaignId} changed during runtime linkage.`,
        );
      }
      this.#fault("after-coordination-update");

      const receipt: DurableRuntimeLinkReceipt = {
        protocolVersion: 2,
        kind: "gameframe.runtime_link_committed",
        campaignId: batch.campaignId,
        coordinationMutationId: batch.coordinationMutationId,
        runtimeCommitId: batch.runtimeCommit.runtimeCommitId,
        eventIds,
        ...next,
      };
      this.#insertLink.run(
        batch.campaignId,
        batch.coordinationMutationId,
        batch.runtimeCommit.runtimeCommitId,
        batchFingerprint,
        stableJson(receipt),
        linkedAt,
      );
      this.#fault("after-link-receipt-insert");
      return receipt;
    });
  }

  #validatePresentationRows(
    batch: DurableRuntimeEventBatch,
    receipt: DurableRuntimeLinkReceipt,
  ): void {
    const firstSequence = receipt.presentationSequence - batch.events.length + 1;
    batch.events.forEach((event, index) => {
      const row = this.#selectPresentationByEvent.get(
        batch.campaignId,
        event.eventId,
      ) as PresentationRow | undefined;
      if (!row) {
        throw new SqliteRpgRuntimeLinkError(
          "corrupt-store",
          `Runtime link ${batch.coordinationMutationId} is missing event ${event.eventId}.`,
        );
      }
      let stored: Record<string, unknown>;
      try {
        stored = JSON.parse(row.event_json) as Record<string, unknown>;
      } catch (error) {
        throw new SqliteRpgRuntimeLinkError(
          "corrupt-store",
          `Presentation event ${event.eventId} contains invalid JSON.`,
          { cause: error },
        );
      }
      const expected = stableJson({
        eventId: event.eventId,
        kind: event.type,
        audience: event.audience,
        payload: event.payload,
        campaignId: batch.campaignId,
        presentationSequence: firstSequence + index,
        createdAt: event.createdAt,
      });
      if (
        row.campaign_id !== batch.campaignId
        || row.presentation_sequence !== firstSequence + index
        || row.event_id !== event.eventId
        || stableJson(stored) !== expected
      ) {
        throw new SqliteRpgRuntimeLinkError(
          "corrupt-store",
          `Presentation event ${event.eventId} does not match its runtime link receipt.`,
        );
      }
    });
  }

  #fault(stage: string): void {
    this.#faultInjector?.(stage);
  }

  #transaction<T>(work: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the authoritative failure.
      }
      throw error;
    }
  }
}

function normalizeBatch(value: unknown): DurableRuntimeEventBatch {
  const batch = record(value, "runtime event batch");
  if (batch.protocolVersion !== 2) throw invalid("protocolVersion must be 2");
  const runtimeCommit = normalizeRuntimeCommit(batch.runtimeCommit);
  if (runtimeCommit.runtimeCommitKind !== "runtime.events") {
    throw invalid("runtimeCommitKind must be runtime.events");
  }
  if (!Array.isArray(batch.events) || batch.events.length < 1 || batch.events.length > MAX_EVENTS) {
    throw invalid(`events must contain from 1 through ${MAX_EVENTS} entries`);
  }
  const events = batch.events.map(normalizeEvent);
  if (new Set(events.map((event) => event.eventId)).size !== events.length) {
    throw invalid("event IDs must be unique within a runtime batch");
  }
  if (Buffer.byteLength(stableJson(events), "utf8") > MAX_BATCH_BYTES) {
    throw invalid(`runtime event batch exceeds ${MAX_BATCH_BYTES} bytes`);
  }
  return {
    protocolVersion: 2,
    coordinationMutationId: identifier(
      batch.coordinationMutationId,
      "coordinationMutationId",
    ),
    campaignId: identifier(batch.campaignId, "campaignId"),
    expectedGameframeCoordinationRevision: integer(
      batch.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
      0,
    ),
    runtimeCommit,
    events,
  };
}

function normalizeRuntimeCommit(value: unknown): RuntimeNarrativeCommitReceipt {
  const receipt = record(value, "runtimeCommit");
  if (receipt.kind !== "runtime.narrative_committed") {
    throw invalid("runtimeCommit.kind is invalid");
  }
  if (
    receipt.runtimeCommitKind !== "runtime.events"
    && receipt.runtimeCommitKind !== "runtime.encounter_launch"
  ) {
    throw invalid("runtimeCommit.runtimeCommitKind is invalid");
  }
  return {
    kind: "runtime.narrative_committed",
    runtimeCommitKind: receipt.runtimeCommitKind,
    runtimeCommitId: identifier(receipt.runtimeCommitId, "runtimeCommitId"),
    ...(receipt.sourceCommandId === undefined
      ? {}
      : { sourceCommandId: identifier(receipt.sourceCommandId, "sourceCommandId") }),
    sourceGameframeCoordinationRevision: integer(
      receipt.sourceGameframeCoordinationRevision,
      "sourceGameframeCoordinationRevision",
      0,
    ),
    previousNarrativeRevision: integer(
      receipt.previousNarrativeRevision,
      "previousNarrativeRevision",
      0,
    ),
    narrativeRevision: integer(receipt.narrativeRevision, "narrativeRevision", 1),
  };
}

function normalizeEvent(value: unknown): DurableRuntimePresentationEvent {
  const event = record(value, "runtime event");
  if (
    event.type !== "choice.presented"
    && event.type !== "encounter.completed"
    && event.type !== "scene.presented"
    && event.type !== "narration.presented"
    && event.type !== "campaign.reveal"
  ) {
    throw invalid("runtime event type is not supported");
  }
  const audienceValue = record(event.audience, "runtime event audience");
  const audience = audienceValue.kind === "public"
    ? { kind: "public" as const }
    : audienceValue.kind === "runtime"
      ? { kind: "runtime" as const }
      : audienceValue.kind === "player"
        ? {
            kind: "player" as const,
            playerId: identifier(audienceValue.playerId, "audience.playerId"),
          }
        : audienceValue.kind === "party"
          ? {
              kind: "party" as const,
              partyId: identifier(audienceValue.partyId, "audience.partyId"),
            }
          : undefined;
  if (!audience) throw invalid("runtime event audience is not supported");
  const payload = record(event.payload, "runtime event payload");
  const normalized: DurableRuntimePresentationEvent = {
    eventId: identifier(event.eventId, "eventId"),
    type: event.type,
    audience,
    payload: structuredClone(payload),
    createdAt: timestamp(event.createdAt, "createdAt"),
  };
  if (Buffer.byteLength(stableJson(normalized), "utf8") > MAX_EVENT_BYTES) {
    throw invalid(`runtime event exceeds ${MAX_EVENT_BYTES} bytes`);
  }
  return normalized;
}

function parseReceipt(
  value: string,
  batch: DurableRuntimeEventBatch,
): DurableRuntimeLinkReceipt {
  try {
    const receipt = JSON.parse(value) as DurableRuntimeLinkReceipt;
    if (
      receipt.protocolVersion !== 2
      || receipt.kind !== "gameframe.runtime_link_committed"
      || receipt.campaignId !== batch.campaignId
      || receipt.coordinationMutationId !== batch.coordinationMutationId
      || receipt.runtimeCommitId !== batch.runtimeCommit.runtimeCommitId
      || !Array.isArray(receipt.eventIds)
      || stableJson(receipt.eventIds) !== stableJson(batch.events.map((event) => event.eventId))
    ) {
      throw new Error("runtime link receipt identity is invalid");
    }
    return {
      protocolVersion: 2,
      kind: "gameframe.runtime_link_committed",
      campaignId: batch.campaignId,
      coordinationMutationId: batch.coordinationMutationId,
      runtimeCommitId: batch.runtimeCommit.runtimeCommitId,
      eventIds: receipt.eventIds.map((eventId) => identifier(eventId, "receipt.eventId")),
      ...normalizeState(receipt),
    };
  } catch (error) {
    throw new SqliteRpgRuntimeLinkError(
      "corrupt-store",
      `Runtime link ${batch.coordinationMutationId} receipt is corrupt.`,
      { cause: error },
    );
  }
}

function stateFromRow(row: CoordinationRow): GameFrameCoordinationState {
  return normalizeState({
    gameframeCoordinationRevision: row.gameframe_coordination_revision,
    presentationSequence: row.presentation_sequence,
    linkedNarrativeRevision: row.linked_narrative_revision,
  });
}

function normalizeState(value: unknown): GameFrameCoordinationState {
  const state = record(value, "coordination state");
  return {
    gameframeCoordinationRevision: integer(
      state.gameframeCoordinationRevision,
      "gameframeCoordinationRevision",
      0,
    ),
    presentationSequence: integer(state.presentationSequence, "presentationSequence", 0),
    linkedNarrativeRevision: integer(
      state.linkedNarrativeRevision,
      "linkedNarrativeRevision",
      0,
    ),
  };
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalid(`${label} is not a valid identifier`);
  }
  return value;
}

function integer(value: unknown, label: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw invalid(`${label} must be an integer of at least ${minimum}`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw invalid(`${label} must be a timestamp`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw invalid(`${label} must be a valid timestamp`);
  return new Date(milliseconds).toISOString();
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function invalid(message: string): SqliteRpgRuntimeLinkError {
  return new SqliteRpgRuntimeLinkError("invalid-input", message);
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }
  return value;
}
