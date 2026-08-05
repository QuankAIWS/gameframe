import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { SqliteRpgCommandAcceptanceRepository } from "./sqlite-rpg-command-acceptance.ts";
import type { GameFrameCoordinationState } from "./rpg-dual-revision-contract.ts";

const COORDINATION_TABLE = "rpg_campaign_coordination_v1";
const PRESENTATION_TABLE = "rpg_presentation_events_v1";
const METADATA_TABLE = "rpg_campaign_metadata_v1";
export const RPG_CAMPAIGN_MEMBERSHIP_TABLE = "rpg_campaign_membership_intervals_v1";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_BOOTSTRAP_EVENTS = 256;
const MAX_BOOTSTRAP_MEMBERSHIPS = 128;
const MAX_EVENT_BYTES = 16_384;
const MAX_BOOTSTRAP_BYTES = 1_048_576;

type JsonRecord = Record<string, unknown>;

export type DurableCampaignMembershipInterval = {
  playerId: string;
  role: "player" | "observer";
  partyId?: string;
  joinedPresentationSequence: number;
  leftPresentationSequence?: number;
};

export type DurableCampaignPresentationEvent = {
  eventId: string;
  kind: string;
  audience:
    | { kind: "public" }
    | { kind: "player"; playerId: string }
    | { kind: "party"; partyId: string }
    | { kind: "runtime" };
  payload: JsonRecord;
  createdAt: string;
};

export type DurableCampaignBootstrap = {
  campaignId: string;
  title: string;
  status: "active" | "paused" | "completed";
  state: GameFrameCoordinationState;
  memberships: DurableCampaignMembershipInterval[];
  events: DurableCampaignPresentationEvent[];
  initializedAt: string;
};

export type DurableCampaignBootstrapReceipt = {
  kind: "gameframe.campaign_bootstrapped";
  campaignId: string;
  title: string;
  status: DurableCampaignBootstrap["status"];
  memberCount: number;
  eventIds: string[];
  state: GameFrameCoordinationState;
  initializedAt: string;
};

export type PlayerCampaignProjectionEvent = {
  eventId: string;
  kind: string;
  payload: JsonRecord;
  createdAt: string;
  presentationSequence: number;
};

export type PlayerCampaignProjection = GameFrameCoordinationState & {
  protocolVersion: 2;
  kind: "campaign.attached";
  campaignId: string;
  title: string;
  status: DurableCampaignBootstrap["status"];
  playerId: string;
  role: DurableCampaignMembershipInterval["role"];
  partyId?: string;
  events: PlayerCampaignProjectionEvent[];
  cursor: string;
  hasMore: false;
};

export class SqliteRpgCampaignStoreError extends Error {
  readonly code:
    | "invalid-input"
    | "campaign-not-found"
    | "campaign-bootstrap-conflict"
    | "campaign-access-denied"
    | "corrupt-store";

  constructor(
    code: SqliteRpgCampaignStoreError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SqliteRpgCampaignStoreError";
    this.code = code;
  }
}

type MetadataRow = {
  campaign_id: string;
  title: string;
  status: string;
  bootstrap_fingerprint: string;
  bootstrap_json: string;
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
  campaign_id: string;
  player_id: string;
  role: string;
  party_id: string | null;
  joined_presentation_sequence: number;
  left_presentation_sequence: number | null;
};

type PresentationRow = {
  campaign_id: string;
  presentation_sequence: number;
  event_id: string;
  event_json: string;
  created_at: string;
};

export class SqliteRpgCampaignStore {
  readonly #database: DatabaseSync;
  readonly #faultInjector?: (stage: string) => void;
  readonly #selectMetadata: StatementSync;
  readonly #insertMetadata: StatementSync;
  readonly #selectState: StatementSync;
  readonly #insertState: StatementSync;
  readonly #insertMembership: StatementSync;
  readonly #selectMemberships: StatementSync;
  readonly #selectActiveMembership: StatementSync;
  readonly #insertPresentation: StatementSync;
  readonly #selectPresentations: StatementSync;

  constructor(input: {
    filePath: string;
    faultInjector?: (stage: string) => void;
  }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    const filePath = input.filePath.trim();
    const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
    commands.close();

    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA synchronous = FULL");
    if (filePath !== ":memory:") this.#database.exec("PRAGMA journal_mode = WAL");
    this.#faultInjector = input.faultInjector;
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS ${METADATA_TABLE} (
        campaign_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
        bootstrap_fingerprint TEXT NOT NULL,
        bootstrap_json TEXT NOT NULL,
        initialized_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES ${COORDINATION_TABLE}(campaign_id)
      );
      CREATE TABLE IF NOT EXISTS ${RPG_CAMPAIGN_MEMBERSHIP_TABLE} (
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
        ON ${RPG_CAMPAIGN_MEMBERSHIP_TABLE} (
          campaign_id, player_id, joined_presentation_sequence, left_presentation_sequence
        );
    `);

    this.#selectMetadata = this.#database.prepare(`
      SELECT * FROM ${METADATA_TABLE} WHERE campaign_id = ?
    `);
    this.#insertMetadata = this.#database.prepare(`
      INSERT INTO ${METADATA_TABLE} (
        campaign_id, title, status, bootstrap_fingerprint, bootstrap_json,
        initialized_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
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
    this.#insertMembership = this.#database.prepare(`
      INSERT INTO ${RPG_CAMPAIGN_MEMBERSHIP_TABLE} (
        campaign_id, player_id, role, party_id,
        joined_presentation_sequence, left_presentation_sequence
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.#selectMemberships = this.#database.prepare(`
      SELECT * FROM ${RPG_CAMPAIGN_MEMBERSHIP_TABLE}
      WHERE campaign_id = ?
      ORDER BY player_id ASC, joined_presentation_sequence ASC
    `);
    this.#selectActiveMembership = this.#database.prepare(`
      SELECT * FROM ${RPG_CAMPAIGN_MEMBERSHIP_TABLE}
      WHERE campaign_id = ? AND player_id = ?
        AND joined_presentation_sequence <= ?
        AND (
          left_presentation_sequence IS NULL
          OR left_presentation_sequence > ?
        )
      ORDER BY joined_presentation_sequence DESC
      LIMIT 1
    `);
    this.#insertPresentation = this.#database.prepare(`
      INSERT INTO ${PRESENTATION_TABLE} (
        campaign_id, presentation_sequence, event_id, event_json, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.#selectPresentations = this.#database.prepare(`
      SELECT * FROM ${PRESENTATION_TABLE}
      WHERE campaign_id = ?
      ORDER BY presentation_sequence ASC
    `);
  }

  close(): void {
    this.#database.close();
  }

  bootstrap(
    inputValue: unknown,
  ): { kind: "initialized" | "existing"; receipt: DurableCampaignBootstrapReceipt } {
    const input = normalizeBootstrap(inputValue);
    const bootstrapJson = stableJson(input);
    const bootstrapFingerprint = fingerprint(bootstrapJson);
    return this.#transaction(() => {
      const metadata = this.#selectMetadata.get(input.campaignId) as MetadataRow | undefined;
      if (metadata) {
        if (
          metadata.bootstrap_fingerprint !== bootstrapFingerprint
          || metadata.bootstrap_json !== bootstrapJson
        ) {
          throw new SqliteRpgCampaignStoreError(
            "campaign-bootstrap-conflict",
            `Campaign ${input.campaignId} was already bootstrapped with different content.`,
          );
        }
        this.#validateBootstrapRows(input);
        return { kind: "existing" as const, receipt: bootstrapReceipt(input) };
      }
      if (this.#selectState.get(input.campaignId)) {
        throw new SqliteRpgCampaignStoreError(
          "corrupt-store",
          `Campaign ${input.campaignId} has coordination state without bootstrap metadata.`,
        );
      }

      this.#insertState.run(
        input.campaignId,
        input.state.gameframeCoordinationRevision,
        input.state.presentationSequence,
        input.state.linkedNarrativeRevision,
        input.initializedAt,
      );
      this.#fault("after-state-insert");

      this.#insertMetadata.run(
        input.campaignId,
        input.title,
        input.status,
        bootstrapFingerprint,
        bootstrapJson,
        input.initializedAt,
        input.initializedAt,
      );
      input.memberships.forEach((membership) => {
        this.#insertMembership.run(
          input.campaignId,
          membership.playerId,
          membership.role,
          membership.partyId ?? null,
          membership.joinedPresentationSequence,
          membership.leftPresentationSequence ?? null,
        );
      });
      this.#fault("after-membership-insert");

      input.events.forEach((event, index) => {
        const presentationSequence = index + 1;
        const stored = {
          eventId: event.eventId,
          kind: event.kind,
          audience: event.audience,
          payload: event.payload,
          campaignId: input.campaignId,
          presentationSequence,
          createdAt: event.createdAt,
        };
        this.#insertPresentation.run(
          input.campaignId,
          presentationSequence,
          event.eventId,
          stableJson(stored),
          event.createdAt,
        );
      });
      this.#fault("after-presentation-insert");
      return { kind: "initialized" as const, receipt: bootstrapReceipt(input) };
    });
  }

  attach(input: {
    campaignId: string;
    authenticatedPlayerId: string;
  }): PlayerCampaignProjection {
    const campaignId = identifier(input?.campaignId, "campaignId");
    const playerId = identifier(input?.authenticatedPlayerId, "authenticatedPlayerId");
    const metadata = this.#selectMetadata.get(campaignId) as MetadataRow | undefined;
    const stateRow = this.#selectState.get(campaignId) as CoordinationRow | undefined;
    if (!metadata || !stateRow) {
      throw new SqliteRpgCampaignStoreError(
        "campaign-not-found",
        `Campaign ${campaignId} does not exist.`,
      );
    }
    const state = stateFromRow(stateRow);
    const membership = this.#membershipAt(
      campaignId,
      playerId,
      state.presentationSequence,
    );
    if (!membership) {
      throw new SqliteRpgCampaignStoreError(
        "campaign-access-denied",
        `Player ${playerId} is not an active campaign member.`,
      );
    }

    const events = (this.#selectPresentations.all(campaignId) as PresentationRow[])
      .map((row) => parseStoredEvent(row, campaignId))
      .filter((event) => this.#canView(campaignId, playerId, event))
      .map(({ audience: _audience, campaignId: _campaignId, ...event }) => event);

    return {
      protocolVersion: 2,
      kind: "campaign.attached",
      campaignId,
      title: metadata.title,
      status: normalizeStatus(metadata.status),
      playerId,
      role: normalizeRole(membership.role),
      ...(membership.party_id ? { partyId: identifier(membership.party_id, "partyId") } : {}),
      events,
      cursor: `campaign:${campaignId}:presentation:${state.presentationSequence}`,
      hasMore: false,
      ...state,
    };
  }

  #canView(
    campaignId: string,
    playerId: string,
    event: StoredCampaignPresentationEvent,
  ): boolean {
    if (event.audience.kind === "public") return true;
    if (event.audience.kind === "runtime") return false;
    if (event.audience.kind === "player") {
      return event.audience.playerId === playerId;
    }
    const membership = this.#membershipAt(
      campaignId,
      playerId,
      event.presentationSequence,
    );
    return membership?.party_id === event.audience.partyId;
  }

  #membershipAt(
    campaignId: string,
    playerId: string,
    presentationSequence: number,
  ): MembershipRow | undefined {
    return this.#selectActiveMembership.get(
      campaignId,
      playerId,
      presentationSequence,
      presentationSequence,
    ) as MembershipRow | undefined;
  }

  #validateBootstrapRows(input: DurableCampaignBootstrap): void {
    const stateRow = this.#selectState.get(input.campaignId) as CoordinationRow | undefined;
    if (!stateRow || stableJson(stateFromRow(stateRow)) !== stableJson(input.state)) {
      throw new SqliteRpgCampaignStoreError(
        "corrupt-store",
        `Campaign ${input.campaignId} coordination state does not match bootstrap custody.`,
      );
    }
    const memberships = (this.#selectMemberships.all(input.campaignId) as MembershipRow[])
      .map(membershipFromRow);
    if (stableJson(memberships) !== stableJson(input.memberships)) {
      throw new SqliteRpgCampaignStoreError(
        "corrupt-store",
        `Campaign ${input.campaignId} membership custody does not match bootstrap metadata.`,
      );
    }
    const events = (this.#selectPresentations.all(input.campaignId) as PresentationRow[])
      .map((row) => {
        const stored = parseStoredEvent(row, input.campaignId);
        const {
          campaignId: _campaignId,
          presentationSequence: _presentationSequence,
          ...event
        } = stored;
        return event;
      });
    if (stableJson(events) !== stableJson(input.events)) {
      throw new SqliteRpgCampaignStoreError(
        "corrupt-store",
        `Campaign ${input.campaignId} presentation custody does not match bootstrap metadata.`,
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

type StoredCampaignPresentationEvent = DurableCampaignPresentationEvent & {
  campaignId: string;
  presentationSequence: number;
};

function normalizeBootstrap(value: unknown): DurableCampaignBootstrap {
  const input = record(value, "campaign bootstrap");
  const eventsValue = input.events;
  const membershipsValue = input.memberships;
  if (!Array.isArray(eventsValue) || eventsValue.length > MAX_BOOTSTRAP_EVENTS) {
    throw invalid(`events must be an array with at most ${MAX_BOOTSTRAP_EVENTS} entries`);
  }
  if (!Array.isArray(membershipsValue) || membershipsValue.length > MAX_BOOTSTRAP_MEMBERSHIPS) {
    throw invalid(
      `memberships must be an array with at most ${MAX_BOOTSTRAP_MEMBERSHIPS} entries`,
    );
  }
  const events = eventsValue.map(normalizeEvent);
  const memberships = membershipsValue.map(normalizeMembership);
  if (new Set(events.map((event) => event.eventId)).size !== events.length) {
    throw invalid("bootstrap event IDs must be unique");
  }
  assertMembershipIntervals(memberships);
  const state = normalizeState(input.state);
  if (state.presentationSequence !== events.length) {
    throw invalid("initial presentationSequence must equal bootstrap event count");
  }
  const normalized: DurableCampaignBootstrap = {
    campaignId: identifier(input.campaignId, "campaignId"),
    title: text(input.title, "title", 200),
    status: normalizeStatus(input.status),
    state,
    memberships,
    events,
    initializedAt: timestamp(input.initializedAt, "initializedAt"),
  };
  if (Buffer.byteLength(stableJson(normalized), "utf8") > MAX_BOOTSTRAP_BYTES) {
    throw invalid(`campaign bootstrap exceeds ${MAX_BOOTSTRAP_BYTES} bytes`);
  }
  const knownPlayers = new Set(memberships.map((membership) => membership.playerId));
  const knownParties = new Set(
    memberships.flatMap((membership) => membership.partyId ? [membership.partyId] : []),
  );
  for (const event of events) {
    if (event.audience.kind === "player" && !knownPlayers.has(event.audience.playerId)) {
      throw invalid(`event ${event.eventId} targets an unknown player`);
    }
    if (event.audience.kind === "party" && !knownParties.has(event.audience.partyId)) {
      throw invalid(`event ${event.eventId} targets an unknown party`);
    }
  }
  return normalized;
}

function normalizeMembership(value: unknown): DurableCampaignMembershipInterval {
  const membership = record(value, "membership");
  const joined = integer(
    membership.joinedPresentationSequence,
    "joinedPresentationSequence",
    0,
  );
  const left = membership.leftPresentationSequence === undefined
    ? undefined
    : integer(membership.leftPresentationSequence, "leftPresentationSequence", 1);
  if (left !== undefined && left <= joined) {
    throw invalid("leftPresentationSequence must exceed joinedPresentationSequence");
  }
  return {
    playerId: identifier(membership.playerId, "playerId"),
    role: normalizeRole(membership.role),
    ...(membership.partyId === undefined
      ? {}
      : { partyId: identifier(membership.partyId, "partyId") }),
    joinedPresentationSequence: joined,
    ...(left === undefined ? {} : { leftPresentationSequence: left }),
  };
}

function assertMembershipIntervals(
  memberships: DurableCampaignMembershipInterval[],
): void {
  const byPlayer = new Map<string, DurableCampaignMembershipInterval[]>();
  for (const membership of memberships) {
    const intervals = byPlayer.get(membership.playerId) ?? [];
    intervals.push(membership);
    byPlayer.set(membership.playerId, intervals);
  }
  for (const [playerId, intervals] of byPlayer) {
    intervals.sort(
      (left, right) =>
        left.joinedPresentationSequence - right.joinedPresentationSequence,
    );
    for (let index = 1; index < intervals.length; index += 1) {
      const previous = intervals[index - 1]!;
      const current = intervals[index]!;
      if (
        previous.leftPresentationSequence === undefined
        || previous.leftPresentationSequence > current.joinedPresentationSequence
      ) {
        throw invalid(`membership intervals overlap for ${playerId}`);
      }
    }
  }
}

function normalizeEvent(value: unknown): DurableCampaignPresentationEvent {
  const event = record(value, "campaign event");
  const audienceValue = record(event.audience, "campaign event audience");
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
  if (!audience) throw invalid("campaign event audience is not supported");
  const normalized: DurableCampaignPresentationEvent = {
    eventId: identifier(event.eventId, "eventId"),
    kind: identifier(event.kind, "event.kind"),
    audience,
    payload: structuredClone(record(event.payload, "event.payload")),
    createdAt: timestamp(event.createdAt, "event.createdAt"),
  };
  if (Buffer.byteLength(stableJson(normalized), "utf8") > MAX_EVENT_BYTES) {
    throw invalid(`campaign event exceeds ${MAX_EVENT_BYTES} bytes`);
  }
  return normalized;
}

function parseStoredEvent(
  row: PresentationRow,
  campaignId: string,
): StoredCampaignPresentationEvent {
  try {
    const value = JSON.parse(row.event_json) as Record<string, unknown>;
    const event = normalizeEvent({
      eventId: value.eventId,
      kind: value.kind,
      audience: value.audience,
      payload: value.payload,
      createdAt: value.createdAt,
    });
    if (
      row.campaign_id !== campaignId
      || value.campaignId !== campaignId
      || value.presentationSequence !== row.presentation_sequence
      || row.event_id !== event.eventId
      || value.createdAt !== row.created_at
    ) {
      throw new Error("presentation row identity does not match stored event");
    }
    return {
      ...event,
      campaignId,
      presentationSequence: row.presentation_sequence,
    };
  } catch (error) {
    throw new SqliteRpgCampaignStoreError(
      "corrupt-store",
      `Campaign ${campaignId} presentation event ${row.event_id} is corrupt.`,
      { cause: error },
    );
  }
}

function membershipFromRow(row: MembershipRow): DurableCampaignMembershipInterval {
  return {
    playerId: identifier(row.player_id, "playerId"),
    role: normalizeRole(row.role),
    ...(row.party_id ? { partyId: identifier(row.party_id, "partyId") } : {}),
    joinedPresentationSequence: integer(
      row.joined_presentation_sequence,
      "joinedPresentationSequence",
      0,
    ),
    ...(row.left_presentation_sequence === null
      ? {}
      : {
          leftPresentationSequence: integer(
            row.left_presentation_sequence,
            "leftPresentationSequence",
            1,
          ),
        }),
  };
}

function bootstrapReceipt(input: DurableCampaignBootstrap): DurableCampaignBootstrapReceipt {
  return {
    kind: "gameframe.campaign_bootstrapped",
    campaignId: input.campaignId,
    title: input.title,
    status: input.status,
    memberCount: input.memberships.length,
    eventIds: input.events.map((event) => event.eventId),
    state: input.state,
    initializedAt: input.initializedAt,
  };
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

function normalizeRole(value: unknown): DurableCampaignMembershipInterval["role"] {
  if (value === "player" || value === "observer") return value;
  throw invalid("membership role is not supported");
}

function normalizeStatus(value: unknown): DurableCampaignBootstrap["status"] {
  if (value === "active" || value === "paused" || value === "completed") {
    return value;
  }
  throw invalid("campaign status is not supported");
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
  if (typeof value !== "string" || !value.trim()) {
    throw invalid(`${label} must be a timestamp`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw invalid(`${label} must be a valid timestamp`);
  }
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

function invalid(message: string): SqliteRpgCampaignStoreError {
  return new SqliteRpgCampaignStoreError("invalid-input", message);
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
