import { DatabaseSync, type StatementSync } from "node:sqlite";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const CAMPAIGN_METADATA_TABLE = "rpg_campaign_metadata_v1";
const CAMPAIGN_COORDINATION_TABLE = "rpg_campaign_coordination_v1";
const CAMPAIGN_MEMBERSHIP_TABLE = "rpg_campaign_membership_intervals_v1";

export type PlayerCampaignIndexEntryV1 = {
  campaignId: string;
  title: string;
  status: "active" | "paused" | "completed";
  role: "player" | "observer";
  partyId?: string;
  gameframeCoordinationRevision: number;
  presentationSequence: number;
  linkedNarrativeRevision: number;
  updatedAt: string;
};

export type PlayerCampaignIndexV1 = {
  protocolVersion: 1;
  kind: "campaign.index";
  playerId: string;
  campaigns: PlayerCampaignIndexEntryV1[];
};

type CampaignIndexRow = {
  campaign_id: string;
  title: string;
  status: string;
  role: string;
  party_id: string | null;
  gameframe_coordination_revision: number;
  presentation_sequence: number;
  linked_narrative_revision: number;
  updated_at: string;
};

export class SqliteRpgCampaignIndex {
  readonly #database: DatabaseSync;
  readonly #selectForPlayer: StatementSync;

  constructor(input: { filePath: string }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    this.#database = new DatabaseSync(input.filePath.trim());
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    if (input.filePath.trim() !== ":memory:") this.#database.exec("PRAGMA journal_mode = WAL");
    this.#selectForPlayer = this.#database.prepare(`
      SELECT
        metadata.campaign_id,
        metadata.title,
        metadata.status,
        membership.role,
        membership.party_id,
        coordination.gameframe_coordination_revision,
        coordination.presentation_sequence,
        coordination.linked_narrative_revision,
        coordination.updated_at
      FROM ${CAMPAIGN_METADATA_TABLE} AS metadata
      INNER JOIN ${CAMPAIGN_COORDINATION_TABLE} AS coordination
        ON coordination.campaign_id = metadata.campaign_id
      INNER JOIN ${CAMPAIGN_MEMBERSHIP_TABLE} AS membership
        ON membership.campaign_id = metadata.campaign_id
      WHERE membership.player_id = ?
        AND membership.joined_presentation_sequence <= coordination.presentation_sequence
        AND (
          membership.left_presentation_sequence IS NULL
          OR membership.left_presentation_sequence > coordination.presentation_sequence
        )
      ORDER BY coordination.updated_at DESC, metadata.campaign_id ASC
    `);
  }

  close(): void {
    this.#database.close();
  }

  listForPlayer(playerIdValue: string): PlayerCampaignIndexV1 {
    const playerId = identifier(playerIdValue, "playerId");
    const rows = this.#selectForPlayer.all(playerId) as CampaignIndexRow[];
    return {
      protocolVersion: 1,
      kind: "campaign.index",
      playerId,
      campaigns: rows.map(normalizeRow),
    };
  }
}

function normalizeRow(row: CampaignIndexRow): PlayerCampaignIndexEntryV1 {
  const status = campaignStatus(row.status);
  const role = campaignRole(row.role);
  const partyId = row.party_id === null ? undefined : identifier(row.party_id, "partyId");
  return {
    campaignId: identifier(row.campaign_id, "campaignId"),
    title: boundedText(row.title, "title", 240),
    status,
    role,
    ...(partyId ? { partyId } : {}),
    gameframeCoordinationRevision: revision(row.gameframe_coordination_revision, "gameframeCoordinationRevision"),
    presentationSequence: revision(row.presentation_sequence, "presentationSequence"),
    linkedNarrativeRevision: revision(row.linked_narrative_revision, "linkedNarrativeRevision"),
    updatedAt: timestamp(row.updated_at, "updatedAt"),
  };
}

function campaignStatus(value: unknown): PlayerCampaignIndexEntryV1["status"] {
  if (value === "active" || value === "paused" || value === "completed") return value;
  throw new TypeError("campaign status is invalid");
}

function campaignRole(value: unknown): PlayerCampaignIndexEntryV1["role"] {
  if (value === "player" || value === "observer") return value;
  throw new TypeError("campaign role is invalid");
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${label} is not a valid identifier`);
  }
  return value;
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  const text = value.trim();
  if (!text || text.length > maximum) throw new TypeError(`${label} is invalid`);
  return text;
}

function revision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return Number(value);
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${label} must be an ISO timestamp`);
  }
  return value;
}
