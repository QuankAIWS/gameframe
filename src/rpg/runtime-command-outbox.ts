import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

export const RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION = 1 as const;
export const MAX_RUNTIME_COMMAND_DELIVERY_BYTES = 16_384;
export const MAX_RUNTIME_COMMAND_TEXT_LENGTH = 4_000;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const OUTBOX_TABLE = "rpg_runtime_command_outbox_v1";

type JsonRecord = Record<string, unknown>;

export type RuntimePlayerCommandV1 =
  | {
      kind: "campaign.submit_action";
      visibility: "public" | "private-to-runtime";
      text: string;
    }
  | {
      kind: "campaign.submit_choice";
      choiceId: string;
      optionId: string;
    };

export type RuntimeCommandDeliveryV1 = {
  protocolVersion: typeof RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION;
  deliveryId: string;
  campaignId: string;
  commandId: string;
  authenticatedPlayerId: string;
  sourceGameframeCoordinationRevision: number;
  acceptedGameframeCoordinationRevision: number;
  sourcePresentationSequence: number;
  acceptedPresentationSequence: number;
  issuedAt: string;
  command: RuntimePlayerCommandV1;
};

export type RuntimeCommandInboxReceiptV1 = {
  protocolVersion: typeof RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION;
  kind: "runtime.command_accepted";
  deliveryId: string;
  campaignId: string;
  commandId: string;
  acceptedAt: string;
};

export type RuntimeCommandOutboxStatus =
  | "pending"
  | "delivering"
  | "runtime-accepted"
  | "reconciliation-required";

export type RuntimeCommandOutboxRecord = {
  delivery: RuntimeCommandDeliveryV1;
  fingerprint: string;
  status: RuntimeCommandOutboxStatus;
  acceptedAt: string;
  updatedAt: string;
  attemptCount: number;
  lease?: {
    token: string;
    expiresAt: string;
  };
  runtimeReceipt?: RuntimeCommandInboxReceiptV1;
  lastFailure?: {
    code: string;
    message: string;
    at: string;
  };
};

export type RuntimeCommandOutboxClaim = {
  record: RuntimeCommandOutboxRecord;
  leaseToken: string;
};

export class RuntimeCommandOutboxError extends Error {
  readonly code:
    | "invalid-delivery"
    | "command-conflict"
    | "not-found"
    | "lease-conflict"
    | "invalid-transition"
    | "corrupt-store";

  constructor(
    code: RuntimeCommandOutboxError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "RuntimeCommandOutboxError";
    this.code = code;
  }
}

type OutboxRow = {
  delivery_id: string;
  campaign_id: string;
  command_id: string;
  fingerprint: string;
  payload_json: string;
  status: string;
  accepted_at: string;
  updated_at: string;
  attempt_count: number;
  lease_token: string | null;
  lease_expires_at: string | null;
  runtime_receipt_json: string | null;
  last_failure_code: string | null;
  last_failure_message: string | null;
  last_failure_at: string | null;
};

export class SqliteRuntimeCommandOutbox {
  readonly #database: DatabaseSync;
  readonly #selectByCommand: StatementSync;
  readonly #selectByDelivery: StatementSync;
  readonly #insert: StatementSync;
  readonly #releaseExpired: StatementSync;
  readonly #selectNextPending: StatementSync;
  readonly #claim: StatementSync;
  readonly #markRuntimeAccepted: StatementSync;
  readonly #markRetryableFailure: StatementSync;
  readonly #markReconciliationRequired: StatementSync;
  readonly #listPending: StatementSync;

  constructor(input: { filePath: string }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    const filePath = input.filePath.trim();
    if (filePath !== ":memory:") {
      mkdirSync(dirname(filePath), { recursive: true });
    }

    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA synchronous = FULL");
    if (filePath !== ":memory:") {
      this.#database.exec("PRAGMA journal_mode = WAL");
    }
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS ${OUTBOX_TABLE} (
        delivery_id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (
          status IN ('pending', 'delivering', 'runtime-accepted', 'reconciliation-required')
        ),
        accepted_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        lease_token TEXT,
        lease_expires_at TEXT,
        runtime_receipt_json TEXT,
        last_failure_code TEXT,
        last_failure_message TEXT,
        last_failure_at TEXT,
        UNIQUE (campaign_id, command_id),
        CHECK (
          (status = 'delivering' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
          OR (status != 'delivering' AND lease_token IS NULL AND lease_expires_at IS NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS rpg_runtime_command_outbox_pending_v1
        ON ${OUTBOX_TABLE} (status, accepted_at, delivery_id);
    `);
    if (filePath !== ":memory:") {
      try {
        chmodSync(filePath, 0o600);
      } catch {
        // Windows and restricted filesystems may not support POSIX permissions.
      }
    }

    this.#selectByCommand = this.#database.prepare(`
      SELECT * FROM ${OUTBOX_TABLE}
      WHERE campaign_id = ? AND command_id = ?
    `);
    this.#selectByDelivery = this.#database.prepare(`
      SELECT * FROM ${OUTBOX_TABLE}
      WHERE delivery_id = ?
    `);
    this.#insert = this.#database.prepare(`
      INSERT INTO ${OUTBOX_TABLE} (
        delivery_id, campaign_id, command_id, fingerprint, payload_json,
        status, accepted_at, updated_at, attempt_count
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0)
    `);
    this.#releaseExpired = this.#database.prepare(`
      UPDATE ${OUTBOX_TABLE}
      SET status = 'pending', lease_token = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE status = 'delivering' AND lease_expires_at <= ?
    `);
    this.#selectNextPending = this.#database.prepare(`
      SELECT * FROM ${OUTBOX_TABLE}
      WHERE status = 'pending'
      ORDER BY accepted_at ASC, delivery_id ASC
      LIMIT 1
    `);
    this.#claim = this.#database.prepare(`
      UPDATE ${OUTBOX_TABLE}
      SET status = 'delivering', attempt_count = attempt_count + 1,
          lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE delivery_id = ? AND status = 'pending'
    `);
    this.#markRuntimeAccepted = this.#database.prepare(`
      UPDATE ${OUTBOX_TABLE}
      SET status = 'runtime-accepted', lease_token = NULL, lease_expires_at = NULL,
          runtime_receipt_json = ?, updated_at = ?,
          last_failure_code = NULL, last_failure_message = NULL, last_failure_at = NULL
      WHERE delivery_id = ? AND status = 'delivering' AND lease_token = ?
    `);
    this.#markRetryableFailure = this.#database.prepare(`
      UPDATE ${OUTBOX_TABLE}
      SET status = 'pending', lease_token = NULL, lease_expires_at = NULL,
          last_failure_code = ?, last_failure_message = ?, last_failure_at = ?, updated_at = ?
      WHERE delivery_id = ? AND status = 'delivering' AND lease_token = ?
    `);
    this.#markReconciliationRequired = this.#database.prepare(`
      UPDATE ${OUTBOX_TABLE}
      SET status = 'reconciliation-required', lease_token = NULL, lease_expires_at = NULL,
          last_failure_code = ?, last_failure_message = ?, last_failure_at = ?, updated_at = ?
      WHERE delivery_id = ? AND status = 'delivering' AND lease_token = ?
    `);
    this.#listPending = this.#database.prepare(`
      SELECT * FROM ${OUTBOX_TABLE}
      WHERE status IN ('pending', 'delivering')
      ORDER BY accepted_at ASC, delivery_id ASC
    `);
  }

  close(): void {
    this.#database.close();
  }

  enqueue(
    deliveryValue: unknown,
    input: { acceptedAt?: string } = {},
  ): { kind: "enqueued" | "duplicate"; record: RuntimeCommandOutboxRecord } {
    const delivery = normalizeRuntimeCommandDelivery(deliveryValue);
    const acceptedAt = normalizeTimestamp(input.acceptedAt ?? delivery.issuedAt, "acceptedAt");
    const payloadJson = stableJson(delivery);
    const fingerprint = fingerprintJson(payloadJson);

    return this.#transaction(() => {
      const existing = this.#selectByCommand.get(
        delivery.campaignId,
        delivery.commandId,
      ) as OutboxRow | undefined;
      if (existing) {
        const record = rowToRecord(existing);
        if (record.fingerprint !== fingerprint || record.delivery.deliveryId !== delivery.deliveryId) {
          throw new RuntimeCommandOutboxError(
            "command-conflict",
            `Command ${delivery.campaignId}/${delivery.commandId} was reused with different delivery content.`,
          );
        }
        return { kind: "duplicate" as const, record };
      }

      try {
        this.#insert.run(
          delivery.deliveryId,
          delivery.campaignId,
          delivery.commandId,
          fingerprint,
          payloadJson,
          acceptedAt,
          acceptedAt,
        );
      } catch (error) {
        throw new RuntimeCommandOutboxError(
          "command-conflict",
          `Delivery ${delivery.deliveryId} collides with an existing outbox record.`,
          { cause: error },
        );
      }
      return {
        kind: "enqueued" as const,
        record: this.#requiredRecord(delivery.deliveryId),
      };
    });
  }

  get(deliveryIdValue: unknown): RuntimeCommandOutboxRecord | undefined {
    const deliveryId = normalizeIdentifier(deliveryIdValue, "deliveryId");
    const row = this.#selectByDelivery.get(deliveryId) as OutboxRow | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  claimNext(input: {
    now: string;
    leaseDurationMs: number;
  }): RuntimeCommandOutboxClaim | undefined {
    const now = normalizeTimestamp(input.now, "now");
    const leaseDurationMs = normalizeLeaseDuration(input.leaseDurationMs);
    const leaseExpiresAt = new Date(Date.parse(now) + leaseDurationMs).toISOString();

    return this.#transaction(() => {
      this.#releaseExpired.run(now, now);
      const row = this.#selectNextPending.get() as OutboxRow | undefined;
      if (!row) return undefined;

      const leaseToken = randomUUID();
      const result = this.#claim.run(leaseToken, leaseExpiresAt, now, row.delivery_id);
      if (Number(result.changes) !== 1) {
        throw new RuntimeCommandOutboxError(
          "lease-conflict",
          `Delivery ${row.delivery_id} could not be claimed.`,
        );
      }
      return {
        record: this.#requiredRecord(row.delivery_id),
        leaseToken,
      };
    });
  }

  markRuntimeAccepted(input: {
    deliveryId: string;
    leaseToken: string;
    receipt: unknown;
    now: string;
  }): RuntimeCommandOutboxRecord {
    const deliveryId = normalizeIdentifier(input.deliveryId, "deliveryId");
    const leaseToken = normalizeIdentifier(input.leaseToken, "leaseToken");
    const now = normalizeTimestamp(input.now, "now");
    const receipt = normalizeRuntimeCommandInboxReceipt(input.receipt);
    if (receipt.deliveryId !== deliveryId) {
      throw new RuntimeCommandOutboxError(
        "invalid-delivery",
        "Runtime receipt deliveryId must match the claimed delivery.",
      );
    }

    return this.#transaction(() => {
      const result = this.#markRuntimeAccepted.run(
        stableJson(receipt),
        now,
        deliveryId,
        leaseToken,
      );
      this.#requireLeaseMutation(result.changes, deliveryId);
      return this.#requiredRecord(deliveryId);
    });
  }

  markRetryableFailure(input: {
    deliveryId: string;
    leaseToken: string;
    code: string;
    message: string;
    now: string;
  }): RuntimeCommandOutboxRecord {
    return this.#markFailure("retry", input);
  }

  markReconciliationRequired(input: {
    deliveryId: string;
    leaseToken: string;
    code: string;
    message: string;
    now: string;
  }): RuntimeCommandOutboxRecord {
    return this.#markFailure("reconciliation", input);
  }

  listPending(): RuntimeCommandOutboxRecord[] {
    return (this.#listPending.all() as OutboxRow[]).map(rowToRecord);
  }

  #markFailure(
    kind: "retry" | "reconciliation",
    input: {
      deliveryId: string;
      leaseToken: string;
      code: string;
      message: string;
      now: string;
    },
  ): RuntimeCommandOutboxRecord {
    const deliveryId = normalizeIdentifier(input.deliveryId, "deliveryId");
    const leaseToken = normalizeIdentifier(input.leaseToken, "leaseToken");
    const code = normalizeIdentifier(input.code, "code");
    const message = normalizeText(input.message, "message", 1_000);
    const now = normalizeTimestamp(input.now, "now");

    return this.#transaction(() => {
      const statement = kind === "retry"
        ? this.#markRetryableFailure
        : this.#markReconciliationRequired;
      const result = statement.run(
        code,
        message,
        now,
        now,
        deliveryId,
        leaseToken,
      );
      this.#requireLeaseMutation(result.changes, deliveryId);
      return this.#requiredRecord(deliveryId);
    });
  }

  #requireLeaseMutation(changes: number | bigint, deliveryId: string): void {
    if (Number(changes) === 1) return;
    const existing = this.get(deliveryId);
    if (!existing) {
      throw new RuntimeCommandOutboxError(
        "not-found",
        `Delivery ${deliveryId} does not exist.`,
      );
    }
    throw new RuntimeCommandOutboxError(
      existing.status === "delivering" ? "lease-conflict" : "invalid-transition",
      `Delivery ${deliveryId} is ${existing.status} and cannot accept this lease mutation.`,
    );
  }

  #requiredRecord(deliveryId: string): RuntimeCommandOutboxRecord {
    const row = this.#selectByDelivery.get(deliveryId) as OutboxRow | undefined;
    if (!row) {
      throw new RuntimeCommandOutboxError(
        "corrupt-store",
        `Outbox write completed without record ${deliveryId}.`,
      );
    }
    return rowToRecord(row);
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
        // Preserve the original failure.
      }
      throw error;
    }
  }
}

export function normalizeRuntimeCommandDelivery(value: unknown): RuntimeCommandDeliveryV1 {
  const delivery = record(value, "runtime command delivery");
  if (delivery.protocolVersion !== RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION) {
    throw invalid("protocolVersion must be 1");
  }
  const normalized: RuntimeCommandDeliveryV1 = {
    protocolVersion: RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION,
    deliveryId: normalizeIdentifier(delivery.deliveryId, "deliveryId"),
    campaignId: normalizeIdentifier(delivery.campaignId, "campaignId"),
    commandId: normalizeIdentifier(delivery.commandId, "commandId"),
    authenticatedPlayerId: normalizeIdentifier(
      delivery.authenticatedPlayerId,
      "authenticatedPlayerId",
    ),
    sourceGameframeCoordinationRevision: normalizeRevision(
      delivery.sourceGameframeCoordinationRevision,
      "sourceGameframeCoordinationRevision",
    ),
    acceptedGameframeCoordinationRevision: normalizeRevision(
      delivery.acceptedGameframeCoordinationRevision,
      "acceptedGameframeCoordinationRevision",
    ),
    sourcePresentationSequence: normalizeRevision(
      delivery.sourcePresentationSequence,
      "sourcePresentationSequence",
    ),
    acceptedPresentationSequence: normalizeRevision(
      delivery.acceptedPresentationSequence,
      "acceptedPresentationSequence",
    ),
    issuedAt: normalizeTimestamp(delivery.issuedAt, "issuedAt"),
    command: normalizeCommand(delivery.command),
  };
  if (
    normalized.acceptedGameframeCoordinationRevision
      !== normalized.sourceGameframeCoordinationRevision + 1
  ) {
    throw invalid("acceptedGameframeCoordinationRevision must advance exactly once");
  }
  if (normalized.acceptedPresentationSequence < normalized.sourcePresentationSequence) {
    throw invalid("acceptedPresentationSequence cannot precede the source sequence");
  }
  const bytes = Buffer.byteLength(stableJson(normalized), "utf8");
  if (bytes > MAX_RUNTIME_COMMAND_DELIVERY_BYTES) {
    throw invalid(`runtime command delivery exceeds ${MAX_RUNTIME_COMMAND_DELIVERY_BYTES} bytes`);
  }
  return normalized;
}

export function normalizeRuntimeCommandInboxReceipt(
  value: unknown,
): RuntimeCommandInboxReceiptV1 {
  const receipt = record(value, "runtime command receipt");
  if (
    receipt.protocolVersion !== RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION
    || receipt.kind !== "runtime.command_accepted"
  ) {
    throw invalid("runtime command receipt protocolVersion or kind is invalid");
  }
  return {
    protocolVersion: RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION,
    kind: "runtime.command_accepted",
    deliveryId: normalizeIdentifier(receipt.deliveryId, "receipt.deliveryId"),
    campaignId: normalizeIdentifier(receipt.campaignId, "receipt.campaignId"),
    commandId: normalizeIdentifier(receipt.commandId, "receipt.commandId"),
    acceptedAt: normalizeTimestamp(receipt.acceptedAt, "receipt.acceptedAt"),
  };
}

function rowToRecord(row: OutboxRow): RuntimeCommandOutboxRecord {
  try {
    const delivery = normalizeRuntimeCommandDelivery(JSON.parse(row.payload_json));
    if (
      delivery.deliveryId !== row.delivery_id
      || delivery.campaignId !== row.campaign_id
      || delivery.commandId !== row.command_id
    ) {
      throw new Error("row identity does not match payload identity");
    }
    const fingerprint = fingerprintJson(stableJson(delivery));
    if (fingerprint !== row.fingerprint) {
      throw new Error("row fingerprint does not match payload");
    }
    const status = normalizeStatus(row.status);
    const record: RuntimeCommandOutboxRecord = {
      delivery,
      fingerprint,
      status,
      acceptedAt: normalizeTimestamp(row.accepted_at, "accepted_at"),
      updatedAt: normalizeTimestamp(row.updated_at, "updated_at"),
      attemptCount: normalizeRevision(row.attempt_count, "attempt_count"),
    };
    if (status === "delivering") {
      record.lease = {
        token: normalizeIdentifier(row.lease_token, "lease_token"),
        expiresAt: normalizeTimestamp(row.lease_expires_at, "lease_expires_at"),
      };
    } else if (row.lease_token !== null || row.lease_expires_at !== null) {
      throw new Error("non-delivering row contains a lease");
    }
    if (row.runtime_receipt_json !== null) {
      const receipt = normalizeRuntimeCommandInboxReceipt(
        JSON.parse(row.runtime_receipt_json),
      );
      if (
        receipt.deliveryId !== delivery.deliveryId
        || receipt.campaignId !== delivery.campaignId
        || receipt.commandId !== delivery.commandId
      ) {
        throw new Error("runtime receipt identity does not match delivery");
      }
      record.runtimeReceipt = receipt;
    }
    const failureValues = [
      row.last_failure_code,
      row.last_failure_message,
      row.last_failure_at,
    ];
    if (failureValues.every((entry) => entry === null)) {
      return record;
    }
    if (failureValues.some((entry) => entry === null)) {
      throw new Error("failure evidence is incomplete");
    }
    record.lastFailure = {
      code: normalizeIdentifier(row.last_failure_code, "last_failure_code"),
      message: normalizeText(row.last_failure_message, "last_failure_message", 1_000),
      at: normalizeTimestamp(row.last_failure_at, "last_failure_at"),
    };
    return record;
  } catch (error) {
    if (error instanceof RuntimeCommandOutboxError && error.code === "corrupt-store") {
      throw error;
    }
    throw new RuntimeCommandOutboxError(
      "corrupt-store",
      `Runtime command outbox record ${String(row.delivery_id)} is corrupt.`,
      { cause: error },
    );
  }
}

function normalizeStatus(value: unknown): RuntimeCommandOutboxStatus {
  if (
    value === "pending"
    || value === "delivering"
    || value === "runtime-accepted"
    || value === "reconciliation-required"
  ) {
    return value;
  }
  throw new Error("status is invalid");
}

function normalizeCommand(value: unknown): RuntimePlayerCommandV1 {
  const command = record(value, "command");
  if (command.kind === "campaign.submit_action") {
    if (command.visibility !== "public" && command.visibility !== "private-to-runtime") {
      throw invalid("command.visibility is not supported");
    }
    return {
      kind: "campaign.submit_action",
      visibility: command.visibility,
      text: normalizeText(command.text, "command.text", MAX_RUNTIME_COMMAND_TEXT_LENGTH),
    };
  }
  if (command.kind === "campaign.submit_choice") {
    return {
      kind: "campaign.submit_choice",
      choiceId: normalizeIdentifier(command.choiceId, "command.choiceId"),
      optionId: normalizeIdentifier(command.optionId, "command.optionId"),
    };
  }
  throw invalid("command.kind is not supported");
}

function normalizeLeaseDuration(value: unknown): number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < 1_000
    || value > 300_000
  ) {
    throw new TypeError("leaseDurationMs must be an integer from 1000 through 300000");
  }
  return value;
}

function normalizeRevision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw invalid(`${label} must be a non-negative integer`);
  }
  return value;
}

function normalizeIdentifier(value: unknown, label: string): string {
  const normalized = normalizeText(value, label, 160);
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw invalid(`${label} is not a valid identifier`);
  }
  return normalized;
}

function normalizeTimestamp(value: unknown, label: string): string {
  const normalized = normalizeText(value, label, 64);
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) {
    throw invalid(`${label} must be a valid timestamp`);
  }
  return new Date(milliseconds).toISOString();
}

function normalizeText(
  value: unknown,
  label: string,
  maximumLength: number,
): string {
  if (typeof value !== "string") {
    throw invalid(`${label} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw invalid(`${label} must not be empty`);
  }
  if (normalized.length > maximumLength) {
    throw invalid(`${label} must be at most ${maximumLength} characters`);
  }
  return normalized;
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function invalid(message: string): RuntimeCommandOutboxError {
  return new RuntimeCommandOutboxError("invalid-delivery", message);
}

function fingerprintJson(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }
  return value;
}
