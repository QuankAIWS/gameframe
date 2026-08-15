import { DatabaseSync } from "node:sqlite";

import {
  normalizeRuntimeCommandDelivery,
  normalizeRuntimeCommandInboxReceipt,
  type RuntimeCommandDeliveryV1,
  type RuntimeCommandInboxReceiptV1,
} from "./runtime-command-outbox.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_EVENTS = 2_048;
const MAX_COMMANDS = 2_048;
const REDACTED = "[REDACTED]";

const METADATA_TABLE = "rpg_campaign_metadata_v1";
const COORDINATION_TABLE = "rpg_campaign_coordination_v1";
const MEMBERSHIP_TABLE = "rpg_campaign_membership_intervals_v1";
const PRESENTATION_TABLE = "rpg_presentation_events_v1";
const COMMAND_TABLE = "rpg_command_receipts_v1";
const OUTBOX_TABLE = "rpg_runtime_command_outbox_v1";

type JsonRecord = Record<string, unknown>;

type MetadataRow = {
  campaign_id: string;
  title: string;
  status: string;
  initialized_at: string;
  updated_at: string;
};

type CoordinationRow = {
  campaign_id: string;
  gameframe_coordination_revision: number;
  presentation_sequence: number;
  linked_narrative_revision: number;
  updated_at: string;
};

type MembershipRow = {
  player_id: string;
  role: string;
  party_id: string | null;
  joined_presentation_sequence: number;
  left_presentation_sequence: number | null;
};

type PresentationRow = {
  presentation_sequence: number;
  event_json: string;
};

type CommandRow = {
  command_id: string;
  delivery_id: string;
  receipt_json: string;
  committed_at: string;
};

type OutboxRow = {
  delivery_id: string;
  command_id: string;
  payload_json: string;
  status: string;
  accepted_at: string;
  updated_at: string;
  attempt_count: number;
  runtime_receipt_json: string | null;
  last_failure_code: string | null;
  last_failure_message: string | null;
  last_failure_at: string | null;
};

export type RpgSessionDiagnosticsV1 = {
  schemaVersion: "gameframe.rpg.session-diagnostics.v1";
  generatedAt: string;
  campaign: {
    campaignId: string;
    title: string;
    status: string;
    initializedAt: string;
    updatedAt: string;
    coordination: {
      gameframeCoordinationRevision: number;
      presentationSequence: number;
      linkedNarrativeRevision: number;
      updatedAt: string;
    };
    memberships: unknown[];
  };
  events: unknown[];
  commands: unknown[];
  limits: {
    maximumEvents: number;
    maximumCommands: number;
    eventsTruncated: boolean;
    commandsTruncated: boolean;
  };
};

/**
 * Builds an administrator-only, read-only support snapshot from the same SQLite
 * authority used by the RPG campaign and Runtime command outbox. It deliberately
 * omits fingerprints and delivery lease tokens; those are internal custody data,
 * not useful support evidence. A final recursive redaction pass protects against
 * accidentally introducing credentials into future event or error payloads.
 */
export function readRpgSessionDiagnostics(input: {
  filePath: string;
  campaignId: string;
  generatedAt?: string;
}): RpgSessionDiagnosticsV1 {
  if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
    throw new TypeError("filePath is required");
  }
  const campaignId = identifier(input.campaignId, "campaignId");
  const generatedAt = timestamp(input.generatedAt ?? new Date().toISOString(), "generatedAt");
  const database = new DatabaseSync(input.filePath.trim());
  database.exec("PRAGMA busy_timeout = 5000");
  try {
    const metadata = database.prepare(`
      SELECT campaign_id, title, status, initialized_at, updated_at
      FROM ${METADATA_TABLE}
      WHERE campaign_id = ?
    `).get(campaignId) as MetadataRow | undefined;
    const coordination = database.prepare(`
      SELECT campaign_id, gameframe_coordination_revision, presentation_sequence,
             linked_narrative_revision, updated_at
      FROM ${COORDINATION_TABLE}
      WHERE campaign_id = ?
    `).get(campaignId) as CoordinationRow | undefined;
    if (!metadata || !coordination) {
      throw new RpgSessionDiagnosticsError(
        "campaign-not-found",
        `Campaign ${campaignId} does not exist.`,
      );
    }

    const memberships = database.prepare(`
      SELECT player_id, role, party_id, joined_presentation_sequence, left_presentation_sequence
      FROM ${MEMBERSHIP_TABLE}
      WHERE campaign_id = ?
      ORDER BY player_id ASC, joined_presentation_sequence ASC
    `).all(campaignId) as MembershipRow[];

    const eventRows = database.prepare(`
      SELECT presentation_sequence, event_json
      FROM ${PRESENTATION_TABLE}
      WHERE campaign_id = ?
      ORDER BY presentation_sequence ASC
      LIMIT ?
    `).all(campaignId, MAX_EVENTS + 1) as PresentationRow[];
    const eventsTruncated = eventRows.length > MAX_EVENTS;
    const events = eventRows.slice(0, MAX_EVENTS).map((row) => {
      const event = parseJsonRecord(row.event_json, "campaign presentation event");
      return sanitize({
        ...event,
        presentationSequence: row.presentation_sequence,
      });
    });

    const commandRows = database.prepare(`
      SELECT command_id, delivery_id, receipt_json, committed_at
      FROM ${COMMAND_TABLE}
      WHERE campaign_id = ?
      ORDER BY committed_at ASC, command_id ASC
      LIMIT ?
    `).all(campaignId, MAX_COMMANDS + 1) as CommandRow[];
    const selectOutboxByCommand = database.prepare(`
      SELECT delivery_id, command_id, payload_json, status, accepted_at, updated_at,
             attempt_count, runtime_receipt_json, last_failure_code,
             last_failure_message, last_failure_at
      FROM ${OUTBOX_TABLE}
      WHERE campaign_id = ? AND command_id = ?
    `);
    const commandsTruncated = commandRows.length > MAX_COMMANDS;
    const commands = commandRows.slice(0, MAX_COMMANDS).map((commandRow) => {
      const outbox = selectOutboxByCommand.get(
        campaignId,
        commandRow.command_id,
      ) as OutboxRow | undefined;
      if (!outbox) {
        throw new RpgSessionDiagnosticsError(
          "corrupt-store",
          `Command ${campaignId}/${commandRow.command_id} has no Runtime outbox record.`,
        );
      }
      const delivery = parseRuntimeDelivery(
        outbox.payload_json,
        `Runtime delivery ${outbox.delivery_id}`,
      );
      if (
        delivery.campaignId !== campaignId
        || delivery.commandId !== commandRow.command_id
        || delivery.deliveryId !== commandRow.delivery_id
        || outbox.delivery_id !== commandRow.delivery_id
        || outbox.command_id !== commandRow.command_id
      ) {
        throw new RpgSessionDiagnosticsError(
          "corrupt-store",
          `Command ${campaignId}/${commandRow.command_id} has inconsistent delivery identity.`,
        );
      }
      const runtimeReceipt = outbox.runtime_receipt_json === null
        ? undefined
        : parseRuntimeReceipt(
            outbox.runtime_receipt_json,
            `Runtime receipt ${outbox.delivery_id}`,
          );
      const failure = failureFromRow(outbox);
      return sanitize({
        commandId: commandRow.command_id,
        deliveryId: commandRow.delivery_id,
        committedAt: commandRow.committed_at,
        receipt: parseJsonRecord(commandRow.receipt_json, "GameFrame command receipt"),
        delivery,
        runtime: {
          status: outbox.status,
          acceptedAt: outbox.accepted_at,
          updatedAt: outbox.updated_at,
          attemptCount: outbox.attempt_count,
          ...(runtimeReceipt ? { receipt: runtimeReceipt } : {}),
          ...(failure ? { lastFailure: failure } : {}),
        },
      });
    });

    return sanitize({
      schemaVersion: "gameframe.rpg.session-diagnostics.v1",
      generatedAt,
      campaign: {
        campaignId,
        title: metadata.title,
        status: metadata.status,
        initializedAt: metadata.initialized_at,
        updatedAt: metadata.updated_at,
        coordination: {
          gameframeCoordinationRevision: coordination.gameframe_coordination_revision,
          presentationSequence: coordination.presentation_sequence,
          linkedNarrativeRevision: coordination.linked_narrative_revision,
          updatedAt: coordination.updated_at,
        },
        memberships: memberships.map((row) => ({
          playerId: row.player_id,
          role: row.role,
          ...(row.party_id ? { partyId: row.party_id } : {}),
          joinedPresentationSequence: row.joined_presentation_sequence,
          ...(row.left_presentation_sequence === null
            ? {}
            : { leftPresentationSequence: row.left_presentation_sequence }),
        })),
      },
      events,
      commands,
      limits: {
        maximumEvents: MAX_EVENTS,
        maximumCommands: MAX_COMMANDS,
        eventsTruncated,
        commandsTruncated,
      },
    }) as RpgSessionDiagnosticsV1;
  } finally {
    database.close();
  }
}

export class RpgSessionDiagnosticsError extends Error {
  readonly code: "campaign-not-found" | "corrupt-store";

  constructor(code: RpgSessionDiagnosticsError["code"], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RpgSessionDiagnosticsError";
    this.code = code;
  }
}

function failureFromRow(row: OutboxRow): { code: string; message: string; at: string } | undefined {
  const values = [row.last_failure_code, row.last_failure_message, row.last_failure_at];
  if (values.every((value) => value === null)) return undefined;
  if (values.some((value) => value === null)) {
    throw new RpgSessionDiagnosticsError(
      "corrupt-store",
      `Runtime delivery ${row.delivery_id} contains incomplete failure evidence.`,
    );
  }
  return {
    code: String(row.last_failure_code),
    message: String(row.last_failure_message),
    at: String(row.last_failure_at),
  };
}

function parseJsonRecord(value: string, label: string): JsonRecord {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} is not an object`);
    }
    return parsed as JsonRecord;
  } catch (error) {
    throw corruptJson(label, error);
  }
}

function parseRuntimeDelivery(value: string, label: string): RuntimeCommandDeliveryV1 {
  try {
    return normalizeRuntimeCommandDelivery(JSON.parse(value));
  } catch (error) {
    throw corruptJson(label, error);
  }
}

function parseRuntimeReceipt(value: string, label: string): RuntimeCommandInboxReceiptV1 {
  try {
    return normalizeRuntimeCommandInboxReceipt(JSON.parse(value));
  } catch (error) {
    throw corruptJson(label, error);
  }
}

function corruptJson(label: string, cause: unknown): RpgSessionDiagnosticsError {
  return new RpgSessionDiagnosticsError(
    "corrupt-store",
    `${label} is not valid canonical JSON.`,
    { cause },
  );
}

function sanitize<T>(value: T): T {
  return sanitizeValue(value) as T;
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (secretKey(key)) return REDACTED;
  if (typeof value === "string") {
    return /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i.test(value)
      ? value.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
      : value;
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([entryKey, entry]) => [
        entryKey,
        sanitizeValue(entry, entryKey),
      ]),
    );
  }
  return value;
}

function secretKey(value: string): boolean {
  return /(authorization|cookie|password|secret|token|api[-_]?key|hmac)/i.test(value);
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a bounded identifier`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${label} must be a valid timestamp`);
  }
  return new Date(value).toISOString();
}
