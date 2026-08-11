import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import {
  normalizeRuntimeCommandDelivery,
  SqliteRuntimeCommandOutbox,
  type RuntimeCommandDeliveryV1,
  type RuntimePlayerCommandV1,
} from "./runtime-command-outbox.ts";
import type { GameFrameCoordinationState } from "./rpg-dual-revision-contract.ts";

const OUTBOX_TABLE = "rpg_runtime_command_outbox_v1";
const COORDINATION_TABLE = "rpg_campaign_coordination_v1";
const COMMAND_TABLE = "rpg_command_receipts_v1";
const PRESENTATION_TABLE = "rpg_presentation_events_v1";
const MEMBERSHIP_TABLE = "rpg_campaign_membership_intervals_v1";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_PRESENTATION_EVENTS = 16;
const MAX_PRESENTATION_EVENT_BYTES = 16_384;
const MAX_TOTAL_PRESENTATION_BYTES = 65_536;

type JsonRecord = Record<string, unknown>;

export type DurableRpgPresentationEvent = {
  eventId: string;
  kind: string;
  audience:
    | { kind: "public" }
    | { kind: "player"; playerId: string }
    | { kind: "party"; partyId: string };
  payload: JsonRecord;
};

export type DurableGameFrameCommandInput = {
  campaignId: string;
  commandId: string;
  authenticatedPlayerId: string;
  expectedGameframeCoordinationRevision: number;
  issuedAt: string;
  command: RuntimePlayerCommandV1;
  presentationEvents: DurableRpgPresentationEvent[];
};

export type DurableGameFrameCommandReceipt = GameFrameCoordinationState & {
  kind: "gameframe.command_committed";
  campaignId: string;
  commandId: string;
  deliveryId: string;
  eventIds: string[];
};

export type StoredRpgPresentationEvent = DurableRpgPresentationEvent & {
  campaignId: string;
  presentationSequence: number;
  createdAt: string;
};

export type DurableCommittedGameFrameCommand = {
  receipt: DurableGameFrameCommandReceipt;
  delivery: RuntimeCommandDeliveryV1;
  presentationEvents: StoredRpgPresentationEvent[];
};

export class SqliteRpgCommandAcceptanceError extends Error {
  readonly code:
    | "invalid-input"
    | "campaign-not-found"
    | "campaign-state-conflict"
    | "coordination-revision-conflict"
    | "command-conflict"
    | "presentation-conflict"
    | "player-not-authorized"
    | "corrupt-store";

  constructor(
    code: SqliteRpgCommandAcceptanceError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SqliteRpgCommandAcceptanceError";
    this.code = code;
  }
}

type CoordinationRow = {
  campaign_id: string;
  gameframe_coordination_revision: number;
  presentation_sequence: number;
  linked_narrative_revision: number;
  updated_at: string;
};

type CommandRow = {
  campaign_id: string;
  command_id: string;
  fingerprint: string;
  receipt_json: string;
  delivery_id: string;
  committed_at: string;
};

type OutboxRow = {
  delivery_id: string;
  campaign_id: string;
  command_id: string;
  fingerprint: string;
  payload_json: string;
};

type PresentationRow = {
  campaign_id: string;
  presentation_sequence: number;
  event_id: string;
  event_json: string;
  created_at: string;
};

export class SqliteRpgCommandAcceptanceRepository {
  readonly #database: DatabaseSync;
  readonly #faultInjector?: (stage: string) => void;
  readonly #selectState: StatementSync;
  readonly #insertState: StatementSync;
  readonly #updateState: StatementSync;
  readonly #selectCommand: StatementSync;
  readonly #insertCommand: StatementSync;
  readonly #selectOutboxByDelivery: StatementSync;
  readonly #selectOutboxByCommand: StatementSync;
  readonly #insertOutbox: StatementSync;
  readonly #insertPresentation: StatementSync;
  readonly #selectPresentation: StatementSync;
  readonly #selectActiveMembership: StatementSync;

  constructor(input: {
    filePath: string;
    faultInjector?: (stage: string) => void;
  }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    const filePath = input.filePath.trim();
    const outbox = new SqliteRuntimeCommandOutbox({ filePath });
    outbox.close();

    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA synchronous = FULL");
    if (filePath !== ":memory:") this.#database.exec("PRAGMA journal_mode = WAL");
    this.#faultInjector = input.faultInjector;
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS ${COORDINATION_TABLE} (
        campaign_id TEXT PRIMARY KEY,
        gameframe_coordination_revision INTEGER NOT NULL CHECK (gameframe_coordination_revision >= 0),
        presentation_sequence INTEGER NOT NULL CHECK (presentation_sequence >= 0),
        linked_narrative_revision INTEGER NOT NULL CHECK (linked_narrative_revision >= 0),
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${COMMAND_TABLE} (
        campaign_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        delivery_id TEXT NOT NULL UNIQUE,
        committed_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, command_id),
        FOREIGN KEY (campaign_id) REFERENCES ${COORDINATION_TABLE}(campaign_id)
      );
      CREATE TABLE IF NOT EXISTS ${PRESENTATION_TABLE} (
        campaign_id TEXT NOT NULL,
        presentation_sequence INTEGER NOT NULL CHECK (presentation_sequence >= 1),
        event_id TEXT NOT NULL,
        event_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, presentation_sequence),
        UNIQUE (campaign_id, event_id),
        FOREIGN KEY (campaign_id) REFERENCES ${COORDINATION_TABLE}(campaign_id)
      );
      CREATE TABLE IF NOT EXISTS ${MEMBERSHIP_TABLE} (
        campaign_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('player', 'observer')),
        party_id TEXT,
        joined_presentation_sequence INTEGER NOT NULL CHECK (joined_presentation_sequence >= 0),
        left_presentation_sequence INTEGER,
        PRIMARY KEY (campaign_id, player_id, joined_presentation_sequence),
        CHECK (
          left_presentation_sequence IS NULL
          OR left_presentation_sequence > joined_presentation_sequence
        ),
        FOREIGN KEY (campaign_id) REFERENCES ${COORDINATION_TABLE}(campaign_id)
      );
      CREATE INDEX IF NOT EXISTS rpg_campaign_membership_active_v1
        ON ${MEMBERSHIP_TABLE} (
          campaign_id, player_id, joined_presentation_sequence, left_presentation_sequence
        );
    `);

    this.#selectState = this.#database.prepare(`
      SELECT * FROM ${COORDINATION_TABLE} WHERE campaign_id = ?
    `);
    this.#insertState = this.#database.prepare(`
      INSERT INTO ${COORDINATION_TABLE} (
        campaign_id, gameframe_coordination_revision, presentation_sequence,
        linked_narrative_revision, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.#updateState = this.#database.prepare(`
      UPDATE ${COORDINATION_TABLE}
      SET gameframe_coordination_revision = ?, presentation_sequence = ?, updated_at = ?
      WHERE campaign_id = ? AND gameframe_coordination_revision = ?
    `);
    this.#selectCommand = this.#database.prepare(`
      SELECT * FROM ${COMMAND_TABLE} WHERE campaign_id = ? AND command_id = ?
    `);
    this.#insertCommand = this.#database.prepare(`
      INSERT INTO ${COMMAND_TABLE} (
        campaign_id, command_id, fingerprint, receipt_json, delivery_id, committed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.#selectOutboxByDelivery = this.#database.prepare(`
      SELECT delivery_id, campaign_id, command_id, fingerprint, payload_json
      FROM ${OUTBOX_TABLE} WHERE delivery_id = ?
    `);
    this.#selectOutboxByCommand = this.#database.prepare(`
      SELECT delivery_id, campaign_id, command_id, fingerprint, payload_json
      FROM ${OUTBOX_TABLE} WHERE campaign_id = ? AND command_id = ?
    `);
    this.#insertOutbox = this.#database.prepare(`
      INSERT INTO ${OUTBOX_TABLE} (
        delivery_id, campaign_id, command_id, fingerprint, payload_json,
        status, accepted_at, updated_at, attempt_count
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0)
    `);
    this.#insertPresentation = this.#database.prepare(`
      INSERT INTO ${PRESENTATION_TABLE} (
        campaign_id, presentation_sequence, event_id, event_json, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.#selectPresentation = this.#database.prepare(`
      SELECT * FROM ${PRESENTATION_TABLE}
      WHERE campaign_id = ? AND presentation_sequence > ?
      ORDER BY presentation_sequence ASC
    `);
    this.#selectActiveMembership = this.#database.prepare(`
      SELECT role FROM ${MEMBERSHIP_TABLE}
      WHERE campaign_id = ? AND player_id = ?
        AND joined_presentation_sequence <= ?
        AND (
          left_presentation_sequence IS NULL
          OR left_presentation_sequence > ?
        )
      ORDER BY joined_presentation_sequence DESC
      LIMIT 1
    `);
  }

  close(): void {
    this.#database.close();
  }

  initializeCampaign(input: {
    campaignId: string;
    state: GameFrameCoordinationState;
    initializedAt: string;
  }): { kind: "initialized" | "existing"; state: GameFrameCoordinationState } {
    const campaignId = identifier(input?.campaignId, "campaignId");
    const state = normalizeState(input?.state);
    const initializedAt = timestamp(input?.initializedAt, "initializedAt");
    return this.#transaction(() => {
      const row = this.#selectState.get(campaignId) as CoordinationRow | undefined;
      if (row) {
        const existing = stateFromRow(row);
        if (stableJson(existing) !== stableJson(state)) {
          throw new SqliteRpgCommandAcceptanceError(
            "campaign-state-conflict",
            `Campaign ${campaignId} is already initialized with different coordination state.`,
          );
        }
        return { kind: "existing" as const, state: existing };
      }
      this.#insertState.run(
        campaignId,
        state.gameframeCoordinationRevision,
        state.presentationSequence,
        state.linkedNarrativeRevision,
        initializedAt,
      );
      return { kind: "initialized" as const, state };
    });
  }

  state(campaignIdValue: unknown): GameFrameCoordinationState | undefined {
    const campaignId = identifier(campaignIdValue, "campaignId");
    const row = this.#selectState.get(campaignId) as CoordinationRow | undefined;
    return row ? stateFromRow(row) : undefined;
  }

  committedCommand(
    campaignIdValue: unknown,
    commandIdValue: unknown,
  ): DurableCommittedGameFrameCommand | undefined {
    const campaignId = identifier(campaignIdValue, "campaignId");
    const commandId = identifier(commandIdValue, "commandId");
    const commandRow = this.#selectCommand.get(campaignId, commandId) as CommandRow | undefined;
    if (!commandRow) return undefined;
    const receipt = parseReceipt(commandRow.receipt_json, campaignId, commandId);
    const outboxRow = this.#selectOutboxByCommand.get(campaignId, commandId) as OutboxRow | undefined;
    if (!outboxRow) {
      throw new SqliteRpgCommandAcceptanceError(
        "corrupt-store",
        `Command ${campaignId}/${commandId} has no durable outbox record.`,
      );
    }
    const delivery = normalizeRuntimeCommandDelivery(JSON.parse(outboxRow.payload_json));
    const deliveryFingerprint = fingerprint(stableJson(delivery));
    if (
      outboxRow.delivery_id !== receipt.deliveryId
      || outboxRow.campaign_id !== campaignId
      || outboxRow.command_id !== commandId
      || delivery.deliveryId !== receipt.deliveryId
      || delivery.campaignId !== campaignId
      || delivery.commandId !== commandId
      || outboxRow.fingerprint !== deliveryFingerprint
    ) {
      throw new SqliteRpgCommandAcceptanceError(
        "corrupt-store",
        `Command ${campaignId}/${commandId} durable identity is corrupt.`,
      );
    }
    const eventIds = new Set(receipt.eventIds);
    const presentationEvents = this.presentationEvents(campaignId, 0)
      .filter((event) => eventIds.has(event.eventId));
    if (presentationEvents.length !== receipt.eventIds.length) {
      throw new SqliteRpgCommandAcceptanceError(
        "corrupt-store",
        `Command ${campaignId}/${commandId} presentation custody is incomplete.`,
      );
    }
    return { receipt, delivery, presentationEvents };
  }

  acceptCommand(inputValue: unknown): DurableGameFrameCommandReceipt {
    const input = normalizeCommandInput(inputValue);
    const commandFingerprint = fingerprint(stableJson(input));
    return this.#transaction(() => {
      const existing = this.#selectCommand.get(
        input.campaignId,
        input.commandId,
      ) as CommandRow | undefined;
      if (existing) {
        if (existing.fingerprint !== commandFingerprint) {
          throw new SqliteRpgCommandAcceptanceError(
            "command-conflict",
            `Command ${input.campaignId}/${input.commandId} was reused with different content.`,
          );
        }
        const receipt = parseReceipt(existing.receipt_json, input.campaignId, input.commandId);
        this.#requireMatchingOutbox(receipt.deliveryId, input.campaignId, input.commandId);
        return receipt;
      }

      const orphaned = this.#selectOutboxByCommand.get(
        input.campaignId,
        input.commandId,
      ) as OutboxRow | undefined;
      if (orphaned) {
        throw new SqliteRpgCommandAcceptanceError(
          "corrupt-store",
          `Command ${input.campaignId}/${input.commandId} has outbox custody without a command receipt.`,
        );
      }

      const stateRow = this.#selectState.get(input.campaignId) as CoordinationRow | undefined;
      if (!stateRow) {
        throw new SqliteRpgCommandAcceptanceError(
          "campaign-not-found",
          `Campaign ${input.campaignId} is not initialized.`,
        );
      }
      const current = stateFromRow(stateRow);
      const membership = this.#selectActiveMembership.get(
        input.campaignId,
        input.authenticatedPlayerId,
        current.presentationSequence,
        current.presentationSequence,
      ) as { role: string } | undefined;
      if (membership?.role !== "player") {
        throw new SqliteRpgCommandAcceptanceError(
          "player-not-authorized",
          `Player ${input.authenticatedPlayerId} is not an active campaign player.`,
        );
      }
      if (
        input.expectedGameframeCoordinationRevision
        !== current.gameframeCoordinationRevision
      ) {
        throw new SqliteRpgCommandAcceptanceError(
          "coordination-revision-conflict",
          `Expected GameFrame coordination revision ${input.expectedGameframeCoordinationRevision}, actual ${current.gameframeCoordinationRevision}.`,
        );
      }

      const next: GameFrameCoordinationState = {
        gameframeCoordinationRevision: current.gameframeCoordinationRevision + 1,
        presentationSequence: current.presentationSequence + input.presentationEvents.length,
        linkedNarrativeRevision: current.linkedNarrativeRevision,
      };
      const delivery = normalizeRuntimeCommandDelivery({
        protocolVersion: 1,
        deliveryId: deliveryId(input.campaignId, input.commandId),
        campaignId: input.campaignId,
        commandId: input.commandId,
        authenticatedPlayerId: input.authenticatedPlayerId,
        sourceGameframeCoordinationRevision: current.gameframeCoordinationRevision,
        acceptedGameframeCoordinationRevision: next.gameframeCoordinationRevision,
        sourcePresentationSequence: current.presentationSequence,
        acceptedPresentationSequence: next.presentationSequence,
        issuedAt: input.issuedAt,
        command: input.command,
      } satisfies RuntimeCommandDeliveryV1);
      const deliveryJson = stableJson(delivery);
      const deliveryFingerprint = fingerprint(deliveryJson);
      const eventIds: string[] = [];
      input.presentationEvents.forEach((event, index) => {
        const sequence = current.presentationSequence + index + 1;
        const stored: StoredRpgPresentationEvent = {
          ...event,
          campaignId: input.campaignId,
          presentationSequence: sequence,
          createdAt: input.issuedAt,
        };
        try {
          this.#insertPresentation.run(
            input.campaignId,
            sequence,
            event.eventId,
            stableJson(stored),
            input.issuedAt,
          );
        } catch (error) {
          throw new SqliteRpgCommandAcceptanceError(
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
        input.issuedAt,
        input.campaignId,
        current.gameframeCoordinationRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new SqliteRpgCommandAcceptanceError(
          "coordination-revision-conflict",
          `Campaign ${input.campaignId} changed during command acceptance.`,
        );
      }
      this.#fault("after-coordination-update");

      this.#insertOutbox.run(
        delivery.deliveryId,
        delivery.campaignId,
        delivery.commandId,
        deliveryFingerprint,
        deliveryJson,
        input.issuedAt,
        input.issuedAt,
      );
      this.#fault("after-outbox-insert");

      const receipt: DurableGameFrameCommandReceipt = {
        kind: "gameframe.command_committed",
        campaignId: input.campaignId,
        commandId: input.commandId,
        deliveryId: delivery.deliveryId,
        eventIds,
        ...next,
      };
      this.#insertCommand.run(
        input.campaignId,
        input.commandId,
        commandFingerprint,
        stableJson(receipt),
        delivery.deliveryId,
        input.issuedAt,
      );
      this.#fault("after-command-receipt-insert");
      return receipt;
    });
  }

  presentationEvents(
    campaignIdValue: unknown,
    afterSequenceValue: unknown = 0,
  ): StoredRpgPresentationEvent[] {
    const campaignId = identifier(campaignIdValue, "campaignId");
    const afterSequence = integer(afterSequenceValue, "afterSequence", 0);
    const rows = this.#selectPresentation.all(
      campaignId,
      afterSequence,
    ) as PresentationRow[];
    return rows.map((row) => parsePresentationRow(row, campaignId));
  }

  #requireMatchingOutbox(
    deliveryIdValue: unknown,
    campaignId: string,
    commandId: string,
  ): void {
    const deliveryIdValueNormalized = identifier(deliveryIdValue, "deliveryId");
    const row = this.#selectOutboxByDelivery.get(
      deliveryIdValueNormalized,
    ) as OutboxRow | undefined;
    if (!row) {
      throw new SqliteRpgCommandAcceptanceError(
        "corrupt-store",
        `Command ${campaignId}/${commandId} has no durable outbox record.`,
      );
    }
    const delivery = normalizeRuntimeCommandDelivery(JSON.parse(row.payload_json));
    const rowFingerprint = fingerprint(stableJson(delivery));
    if (
      row.delivery_id !== deliveryIdValueNormalized
      || row.campaign_id !== campaignId
      || row.command_id !== commandId
      || delivery.deliveryId !== deliveryIdValueNormalized
      || delivery.campaignId !== campaignId
      || delivery.commandId !== commandId
      || row.fingerprint !== rowFingerprint
    ) {
      throw new SqliteRpgCommandAcceptanceError(
        "corrupt-store",
        `Command ${campaignId}/${commandId} outbox identity or fingerprint is corrupt.`,
      );
    }
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

function normalizeCommandInput(value: unknown): DurableGameFrameCommandInput {
  const input = record(value, "command input");
  const presentationEventsValue = input.presentationEvents;
  if (!Array.isArray(presentationEventsValue)) {
    throw invalid("presentationEvents must be an array");
  }
  if (presentationEventsValue.length > MAX_PRESENTATION_EVENTS) {
    throw invalid(`presentationEvents cannot exceed ${MAX_PRESENTATION_EVENTS} entries`);
  }
  const presentationEvents = presentationEventsValue.map(normalizePresentationEvent);
  const totalBytes = presentationEvents.reduce(
    (sum, event) => sum + Buffer.byteLength(stableJson(event), "utf8"),
    0,
  );
  if (totalBytes > MAX_TOTAL_PRESENTATION_BYTES) {
    throw invalid(`presentationEvents exceed ${MAX_TOTAL_PRESENTATION_BYTES} bytes`);
  }
  return {
    campaignId: identifier(input.campaignId, "campaignId"),
    commandId: identifier(input.commandId, "commandId"),
    authenticatedPlayerId: identifier(input.authenticatedPlayerId, "authenticatedPlayerId"),
    expectedGameframeCoordinationRevision: integer(
      input.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
      0,
    ),
    issuedAt: timestamp(input.issuedAt, "issuedAt"),
    command: normalizePlayerCommand(input.command),
    presentationEvents,
  };
}

function normalizePlayerCommand(value: unknown): RuntimePlayerCommandV1 {
  const command = record(value, "command");
  if (command.kind === "campaign.submit_action") {
    if (command.visibility !== "public" && command.visibility !== "private-to-runtime") {
      throw invalid("command.visibility is not supported");
    }
    const interaction = normalizeInteraction(command.interaction);
    const communication = normalizeCommunication(command.communication);
    if (communication === "ask-gm" && command.visibility !== "private-to-runtime") {
      throw invalid("Ask GM commands must use private-to-runtime visibility");
    }
    if (communication === "ask-gm" && interaction !== undefined) {
      throw invalid("Ask GM commands cannot also declare an in-world interaction");
    }
    return {
      kind: "campaign.submit_action",
      visibility: command.visibility,
      text: text(command.text, "command.text", 4_000),
      ...(communication ? { communication } : {}),
      ...(interaction ? { interaction } : {}),
    };
  }
  if (command.kind === "campaign.submit_choice") {
    return {
      kind: "campaign.submit_choice",
      choiceId: identifier(command.choiceId, "command.choiceId"),
      optionId: identifier(command.optionId, "command.optionId"),
    };
  }
  throw invalid("command.kind is not supported");
}

function normalizeCommunication(value: unknown): "ask-gm" | undefined {
  if (value === undefined) return undefined;
  if (value === "ask-gm") return value;
  throw invalid("command.communication is not supported");
}

function normalizeInteraction(
  value: unknown,
):
  | { kind: "talk"; targetEntityId: string }
  | { kind: "monster-control"; operation: "deploy" | "recall"; targetEntityId: string }
  | { kind: "travel"; routeId: string }
  | undefined {
  if (value === undefined) return undefined;
  const interaction = record(value, "command.interaction");
  const allowed = interaction.kind === "monster-control"
    ? new Set(["kind", "operation", "targetEntityId"])
    : interaction.kind === "travel"
      ? new Set(["kind", "routeId"])
      : new Set(["kind", "targetEntityId"]);
  const unknown = Object.keys(interaction).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw invalid(`command.interaction contains unsupported fields: ${unknown.sort().join(", ")}`);
  }
  if (interaction.kind === "travel") {
    return {
      kind: "travel",
      routeId: identifier(interaction.routeId, "command.interaction.routeId"),
    };
  }
  const targetEntityId = identifier(
    interaction.targetEntityId,
    "command.interaction.targetEntityId",
  );
  if (interaction.kind === "talk") return { kind: "talk", targetEntityId };
  if (interaction.kind === "monster-control") {
    if (interaction.operation !== "deploy" && interaction.operation !== "recall") {
      throw invalid("command.interaction.operation must be deploy or recall");
    }
    return {
      kind: "monster-control",
      operation: interaction.operation,
      targetEntityId,
    };
  }
  throw invalid("command.interaction.kind is not supported");
}

function normalizePresentationEvent(value: unknown): DurableRpgPresentationEvent {
  const event = record(value, "presentation event");
  const audienceValue = record(event.audience, "presentation event audience");
  let audience: DurableRpgPresentationEvent["audience"];
  if (audienceValue.kind === "public") {
    audience = { kind: "public" };
  } else if (audienceValue.kind === "player") {
    audience = { kind: "player", playerId: identifier(audienceValue.playerId, "audience.playerId") };
  } else if (audienceValue.kind === "party") {
    audience = { kind: "party", partyId: identifier(audienceValue.partyId, "audience.partyId") };
  } else {
    throw invalid("presentation event audience is not supported");
  }
  const payload = record(event.payload, "presentation event payload");
  const normalized: DurableRpgPresentationEvent = {
    eventId: identifier(event.eventId, "eventId"),
    kind: identifier(event.kind, "event.kind"),
    audience,
    payload: structuredClone(payload),
  };
  if (Buffer.byteLength(stableJson(normalized), "utf8") > MAX_PRESENTATION_EVENT_BYTES) {
    throw invalid(`presentation event exceeds ${MAX_PRESENTATION_EVENT_BYTES} bytes`);
  }
  return normalized;
}

function parseReceipt(
  value: string,
  campaignId: string,
  commandId: string,
): DurableGameFrameCommandReceipt {
  try {
    const receipt = JSON.parse(value) as DurableGameFrameCommandReceipt;
    if (
      receipt.kind !== "gameframe.command_committed"
      || receipt.campaignId !== campaignId
      || receipt.commandId !== commandId
      || !Array.isArray(receipt.eventIds)
    ) {
      throw new Error("receipt identity is invalid");
    }
    return {
      kind: "gameframe.command_committed",
      campaignId,
      commandId,
      deliveryId: identifier(receipt.deliveryId, "receipt.deliveryId"),
      eventIds: receipt.eventIds.map((eventId) => identifier(eventId, "receipt.eventId")),
      ...normalizeState(receipt),
    };
  } catch (error) {
    throw new SqliteRpgCommandAcceptanceError(
      "corrupt-store",
      `Command ${campaignId}/${commandId} receipt is corrupt.`,
      { cause: error },
    );
  }
}

function parsePresentationRow(
  row: PresentationRow,
  campaignId: string,
): StoredRpgPresentationEvent {
  try {
    const event = JSON.parse(row.event_json) as StoredRpgPresentationEvent;
    const normalized = normalizePresentationEvent(event);
    if (
      row.campaign_id !== campaignId
      || event.campaignId !== campaignId
      || event.presentationSequence !== row.presentation_sequence
      || normalized.eventId !== row.event_id
    ) {
      throw new Error("presentation row identity is invalid");
    }
    return {
      ...normalized,
      campaignId,
      presentationSequence: integer(row.presentation_sequence, "presentationSequence", 1),
      createdAt: timestamp(row.created_at, "createdAt"),
    };
  } catch (error) {
    throw new SqliteRpgCommandAcceptanceError(
      "corrupt-store",
      `Campaign ${campaignId} presentation record is corrupt.`,
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
    presentationSequence: integer(
      state.presentationSequence,
      "presentationSequence",
      0,
    ),
    linkedNarrativeRevision: integer(
      state.linkedNarrativeRevision,
      "linkedNarrativeRevision",
      0,
    ),
  };
}

function deliveryId(campaignId: string, commandId: string): string {
  return `delivery:${createHash("sha256")
    .update(campaignId, "utf8")
    .update("\0")
    .update(commandId, "utf8")
    .digest("base64url")}`;
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

function text(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw invalid(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw invalid(`${label} must contain from 1 through ${maximumLength} characters`);
  }
  return normalized;
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function invalid(message: string): SqliteRpgCommandAcceptanceError {
  return new SqliteRpgCommandAcceptanceError("invalid-input", message);
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
