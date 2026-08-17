import { Buffer } from "node:buffer";
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
const MAX_MEMBERSHIPS = 1_024;
// The Cloudflare admin proxy rejects responses above 4 MiB. Keep the durable
// server comfortably below that ceiling so headers/transport differences can
// never turn a successful diagnostic read into an edge-level 502.
const MAX_SERIALIZED_BYTES = 3_500_000;
const TARGET_SERIALIZED_BYTES = 3_400_000;
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

type JoinedCommandRow = {
  command_id: string;
  delivery_id: string;
  receipt_json: string;
  committed_at: string;
  outbox_delivery_id: string | null;
  outbox_campaign_id: string | null;
  outbox_command_id: string | null;
  payload_json: string | null;
  status: string | null;
  accepted_at: string | null;
  updated_at: string | null;
  attempt_count: number | null;
  runtime_receipt_json: string | null;
  last_failure_code: string | null;
  last_failure_message: string | null;
  last_failure_at: string | null;
};

type CountRow = { count: number };

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
    maximumMemberships: number;
    maximumEvents: number;
    maximumCommands: number;
    maximumSerializedBytes: number;
    membershipsAvailable: number;
    eventsAvailable: number;
    commandsAvailable: number;
    membershipsReturned: number;
    eventsReturned: number;
    commandsReturned: number;
    membershipsTruncated: boolean;
    eventsTruncated: boolean;
    commandsTruncated: boolean;
    payloadTruncated: boolean;
    payloadBytes: number;
  };
};

/**
 * Builds an administrator-only, read-only support snapshot from the same SQLite
 * authority used by the RPG campaign and Runtime command outbox. Only known
 * support columns are selected; fingerprints and delivery lease material never
 * leave SQLite. Event/error payloads receive a final recursive credential scrub.
 *
 * The query surface is fixed-size: no per-command outbox lookups are performed.
 * For long-lived campaigns the newest bounded evidence window is selected first,
 * then restored to chronological order for human inspection.
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

    const membershipCount = countRows(database, MEMBERSHIP_TABLE, campaignId);
    const eventCount = countRows(database, PRESENTATION_TABLE, campaignId);
    const commandCount = countRows(database, COMMAND_TABLE, campaignId);

    const membershipRows = database.prepare(`
      SELECT player_id, role, party_id, joined_presentation_sequence, left_presentation_sequence
      FROM (
        SELECT player_id, role, party_id, joined_presentation_sequence, left_presentation_sequence
        FROM ${MEMBERSHIP_TABLE}
        WHERE campaign_id = ?
        ORDER BY joined_presentation_sequence DESC, player_id DESC
        LIMIT ?
      )
      ORDER BY joined_presentation_sequence ASC, player_id ASC
    `).all(campaignId, MAX_MEMBERSHIPS) as MembershipRow[];

    const eventRows = database.prepare(`
      SELECT presentation_sequence, event_json
      FROM (
        SELECT presentation_sequence, event_json
        FROM ${PRESENTATION_TABLE}
        WHERE campaign_id = ?
        ORDER BY presentation_sequence DESC
        LIMIT ?
      )
      ORDER BY presentation_sequence ASC
    `).all(campaignId, MAX_EVENTS) as PresentationRow[];
    const events = eventRows.map((row) => {
      const event = parseJsonRecord(row.event_json, "campaign presentation event");
      return sanitize({
        ...event,
        // SQLite ordering is authoritative even if duplicated JSON is corrupt.
        presentationSequence: row.presentation_sequence,
      });
    });

    // Join the bounded newest command window to Runtime outbox custody in one
    // query. This avoids the old diagnostics N+1 pattern and keeps support reads
    // predictable even when a campaign has thousands of commands.
    const commandRows = database.prepare(`
      SELECT
        recent.command_id,
        recent.delivery_id,
        recent.receipt_json,
        recent.committed_at,
        outbox.delivery_id AS outbox_delivery_id,
        outbox.campaign_id AS outbox_campaign_id,
        outbox.command_id AS outbox_command_id,
        outbox.payload_json,
        outbox.status,
        outbox.accepted_at,
        outbox.updated_at,
        outbox.attempt_count,
        outbox.runtime_receipt_json,
        outbox.last_failure_code,
        outbox.last_failure_message,
        outbox.last_failure_at
      FROM (
        SELECT command_id, delivery_id, receipt_json, committed_at
        FROM ${COMMAND_TABLE}
        WHERE campaign_id = ?
        ORDER BY committed_at DESC, command_id DESC
        LIMIT ?
      ) AS recent
      LEFT JOIN ${OUTBOX_TABLE} AS outbox
        ON outbox.campaign_id = ? AND outbox.command_id = recent.command_id
      ORDER BY recent.committed_at ASC, recent.command_id ASC
    `).all(campaignId, MAX_COMMANDS, campaignId) as JoinedCommandRow[];

    const commands = commandRows.map((row) => commandDiagnostics(row, campaignId));
    const memberships = membershipRows.map((row) => ({
      playerId: row.player_id,
      role: row.role,
      ...(row.party_id ? { partyId: row.party_id } : {}),
      joinedPresentationSequence: row.joined_presentation_sequence,
      ...(row.left_presentation_sequence === null
        ? {}
        : { leftPresentationSequence: row.left_presentation_sequence }),
    }));

    const base = sanitize({
      schemaVersion: "gameframe.rpg.session-diagnostics.v1" as const,
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
        memberships,
      },
    });

    return fitPayloadBudget({
      base,
      events,
      commands,
      membershipCount,
      eventCount,
      commandCount,
    });
  } finally {
    database.close();
  }
}

export class RpgSessionDiagnosticsError extends Error {
  readonly code: "campaign-not-found" | "corrupt-store" | "payload-too-large";

  constructor(code: RpgSessionDiagnosticsError["code"], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RpgSessionDiagnosticsError";
    this.code = code;
  }
}

function commandDiagnostics(row: JoinedCommandRow, campaignId: string): unknown {
  if (
    row.outbox_delivery_id === null
    || row.outbox_campaign_id === null
    || row.outbox_command_id === null
    || row.payload_json === null
    || row.status === null
    || row.accepted_at === null
    || row.updated_at === null
    || row.attempt_count === null
  ) {
    throw new RpgSessionDiagnosticsError(
      "corrupt-store",
      `Command ${campaignId}/${row.command_id} has no Runtime outbox record.`,
    );
  }

  const delivery = parseRuntimeDelivery(
    row.payload_json,
    `Runtime delivery ${row.outbox_delivery_id}`,
  );
  if (
    delivery.campaignId !== campaignId
    || delivery.commandId !== row.command_id
    || delivery.deliveryId !== row.delivery_id
    || row.outbox_delivery_id !== row.delivery_id
    || row.outbox_campaign_id !== campaignId
    || row.outbox_command_id !== row.command_id
  ) {
    throw new RpgSessionDiagnosticsError(
      "corrupt-store",
      `Command ${campaignId}/${row.command_id} has inconsistent delivery identity.`,
    );
  }

  const gameframeReceipt = parseJsonRecord(row.receipt_json, "GameFrame command receipt");
  if (
    gameframeReceipt.campaignId !== campaignId
    || gameframeReceipt.commandId !== row.command_id
    || gameframeReceipt.deliveryId !== row.delivery_id
  ) {
    throw new RpgSessionDiagnosticsError(
      "corrupt-store",
      `Command ${campaignId}/${row.command_id} has inconsistent GameFrame receipt identity.`,
    );
  }

  const runtimeReceipt = row.runtime_receipt_json === null
    ? undefined
    : parseRuntimeReceipt(
        row.runtime_receipt_json,
        `Runtime receipt ${row.outbox_delivery_id}`,
      );
  if (
    runtimeReceipt
    && (
      runtimeReceipt.campaignId !== campaignId
      || runtimeReceipt.commandId !== row.command_id
      || runtimeReceipt.deliveryId !== row.delivery_id
    )
  ) {
    throw new RpgSessionDiagnosticsError(
      "corrupt-store",
      `Command ${campaignId}/${row.command_id} has inconsistent Runtime receipt identity.`,
    );
  }

  const failure = failureFromRow(row);
  return sanitize({
    commandId: row.command_id,
    deliveryId: row.delivery_id,
    committedAt: row.committed_at,
    receipt: gameframeReceipt,
    delivery,
    runtime: {
      status: row.status,
      acceptedAt: row.accepted_at,
      updatedAt: row.updated_at,
      attemptCount: row.attempt_count,
      ...(runtimeReceipt ? { receipt: runtimeReceipt } : {}),
      ...(failure ? { lastFailure: failure } : {}),
    },
  });
}

function fitPayloadBudget(input: {
  base: Omit<RpgSessionDiagnosticsV1, "events" | "commands" | "limits">;
  events: unknown[];
  commands: unknown[];
  membershipCount: number;
  eventCount: number;
  commandCount: number;
}): RpgSessionDiagnosticsV1 {
  let eventStart = 0;
  let commandStart = 0;
  const eventSizes = input.events.map(jsonBytes);
  const commandSizes = input.commands.map(jsonBytes);
  let eventContribution = arrayContribution(eventSizes, eventStart);
  let commandContribution = arrayContribution(commandSizes, commandStart);

  let initial = buildDiagnostics(input, eventStart, commandStart, 0);
  let estimatedBytes = jsonBytes(initial);

  // Drop oldest evidence from the currently larger evidence pool until there is
  // comfortable transport headroom. The newest record of each kind is therefore
  // always retained as long as at least one record of that kind can fit.
  while (estimatedBytes > TARGET_SERIALIZED_BYTES) {
    if (eventStart >= input.events.length && commandStart >= input.commands.length) break;
    const dropEvent = eventStart < input.events.length
      && (commandStart >= input.commands.length || eventContribution >= commandContribution);
    if (dropEvent) {
      const reduction = eventSizes[eventStart]
        + (input.events.length - eventStart > 1 ? 1 : 0);
      eventStart += 1;
      eventContribution -= reduction;
      estimatedBytes -= reduction;
    } else {
      const reduction = commandSizes[commandStart]
        + (input.commands.length - commandStart > 1 ? 1 : 0);
      commandStart += 1;
      commandContribution -= reduction;
      estimatedBytes -= reduction;
    }
  }

  let candidate = withStablePayloadBytes(
    buildDiagnostics(input, eventStart, commandStart, 0),
  );

  // Metadata digit-width changes are tiny, but make the final guarantee exact.
  while (candidate.limits.payloadBytes > MAX_SERIALIZED_BYTES) {
    if (eventStart >= input.events.length && commandStart >= input.commands.length) {
      throw new RpgSessionDiagnosticsError(
        "payload-too-large",
        "RPG session diagnostics metadata exceeds the bounded support response size.",
      );
    }
    const dropEvent = eventStart < input.events.length
      && (commandStart >= input.commands.length || eventContribution >= commandContribution);
    if (dropEvent) {
      const reduction = eventSizes[eventStart]
        + (input.events.length - eventStart > 1 ? 1 : 0);
      eventStart += 1;
      eventContribution -= reduction;
    } else {
      const reduction = commandSizes[commandStart]
        + (input.commands.length - commandStart > 1 ? 1 : 0);
      commandStart += 1;
      commandContribution -= reduction;
    }
    candidate = withStablePayloadBytes(
      buildDiagnostics(input, eventStart, commandStart, 0),
    );
  }

  return candidate;
}

function buildDiagnostics(
  input: {
    base: Omit<RpgSessionDiagnosticsV1, "events" | "commands" | "limits">;
    events: unknown[];
    commands: unknown[];
    membershipCount: number;
    eventCount: number;
    commandCount: number;
  },
  eventStart: number,
  commandStart: number,
  payloadBytes: number,
): RpgSessionDiagnosticsV1 {
  const events = input.events.slice(eventStart);
  const commands = input.commands.slice(commandStart);
  const membershipsReturned = input.base.campaign.memberships.length;
  return {
    ...input.base,
    events,
    commands,
    limits: {
      maximumMemberships: MAX_MEMBERSHIPS,
      maximumEvents: MAX_EVENTS,
      maximumCommands: MAX_COMMANDS,
      maximumSerializedBytes: MAX_SERIALIZED_BYTES,
      membershipsAvailable: input.membershipCount,
      eventsAvailable: input.eventCount,
      commandsAvailable: input.commandCount,
      membershipsReturned,
      eventsReturned: events.length,
      commandsReturned: commands.length,
      membershipsTruncated: input.membershipCount > membershipsReturned,
      eventsTruncated: input.eventCount > events.length,
      commandsTruncated: input.commandCount > commands.length,
      payloadTruncated: eventStart > 0 || commandStart > 0,
      payloadBytes,
    },
  };
}

function withStablePayloadBytes(value: RpgSessionDiagnosticsV1): RpgSessionDiagnosticsV1 {
  let bytes = jsonBytes(value);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    value.limits.payloadBytes = bytes;
    const next = jsonBytes(value);
    if (next === bytes) return value;
    bytes = next;
  }
  value.limits.payloadBytes = bytes;
  return value;
}

function arrayContribution(sizes: number[], start: number): number {
  const count = Math.max(0, sizes.length - start);
  if (count === 0) return 0;
  return sizes.slice(start).reduce((sum, value) => sum + value, 0) + count - 1;
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function countRows(database: DatabaseSync, table: string, campaignId: string): number {
  const row = database.prepare(`
    SELECT COUNT(*) AS count FROM ${table} WHERE campaign_id = ?
  `).get(campaignId) as CountRow;
  return Number(row.count);
}

function failureFromRow(row: JoinedCommandRow): { code: string; message: string; at: string } | undefined {
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
  if (typeof value === "string") return sanitizeString(value);
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

function sanitizeString(value: string): string {
  return value
    .replace(
      /\bAuthorization\s*[:=]\s*(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi,
      "Authorization: $1 [REDACTED]",
    )
    .replace(
      /\bAuthorization\s*[:=]\s*(?!(?:Bearer|Basic)\b)[^\s,;]+/gi,
      "Authorization=[REDACTED]",
    )
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi, "$1 [REDACTED]")
    .replace(
      /\b(password|passwd|secret|token|api[-_]?key|hmac|credential|client[-_]?secret|private[-_]?key|access[-_]?key|signing[-_]?key)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    );
}

function secretKey(value: string): boolean {
  return /(authorization|cookie|password|passwd|secret|token|api[-_]?key|hmac|credential|client[-_]?secret|private[-_]?key|access[-_]?key|signing[-_]?key)/i.test(value);
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
