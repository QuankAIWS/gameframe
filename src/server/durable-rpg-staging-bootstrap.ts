import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const DEFAULT_TITLE = "Monster Master: The Crooked Checkpoint";
const DEFAULT_PARTY_ID = "party:main";
const METADATA_TABLE = "rpg_campaign_metadata_v1";
const LEGACY_STAGING_CAMPAIGN_ID = "monster-master-staging";
export const CURRENT_STAGING_CAMPAIGN_ID = "monster-master-staging-v5";

export type DurableRpgStagingBootstrapConfig = {
  campaignId: string;
  playerId: string;
  title: string;
  partyId: string;
  initializedAt: string;
};

/**
 * Optional deployment-only seed for the current single-player staging slice.
 * Production composition stays unchanged when the RPG_STAGING_* variables are
 * absent. When enabled, all fields are validated and the resulting bootstrap is
 * stable across restarts.
 */
export function parseDurableRpgStagingBootstrapConfig(
  environment: NodeJS.ProcessEnv,
): DurableRpgStagingBootstrapConfig | undefined {
  const campaignId = environment.RPG_STAGING_CAMPAIGN_ID?.trim() ?? "";
  const playerId = environment.RPG_STAGING_PLAYER_ID?.trim() ?? "";
  const initializedAt = environment.RPG_STAGING_INITIALIZED_AT?.trim() ?? "";
  const title = environment.RPG_STAGING_CAMPAIGN_TITLE?.trim() || DEFAULT_TITLE;
  const partyId = environment.RPG_STAGING_PARTY_ID?.trim() || DEFAULT_PARTY_ID;

  const enabled = Boolean(campaignId || playerId || initializedAt);
  if (!enabled) return undefined;

  const validatedCampaignId = identifier(campaignId, "RPG_STAGING_CAMPAIGN_ID");
  return {
    // The installed root-owned helper still emits the legacy unversioned
    // staging ID. Translate only that deployment identity to the current
    // durable generation so new code can seed beside the preserved old rows.
    campaignId: validatedCampaignId === LEGACY_STAGING_CAMPAIGN_ID
      ? CURRENT_STAGING_CAMPAIGN_ID
      : validatedCampaignId,
    playerId: identifier(playerId, "RPG_STAGING_PLAYER_ID"),
    title: text(title, "RPG_STAGING_CAMPAIGN_TITLE", 160),
    partyId: identifier(partyId, "RPG_STAGING_PARTY_ID"),
    initializedAt: timestamp(initializedAt, "RPG_STAGING_INITIALIZED_AT"),
  };
}

export function durableRpgStagingBootstrap(
  config: DurableRpgStagingBootstrapConfig,
): DurableCampaignBootstrap {
  return {
    campaignId: config.campaignId,
    title: config.title,
    status: "active",
    state: {
      gameframeCoordinationRevision: 0,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [
      {
        playerId: config.playerId,
        role: "player",
        partyId: config.partyId,
        joinedPresentationSequence: 0,
      },
    ],
    events: [],
    initializedAt: config.initializedAt,
  };
}

/**
 * Returns a bootstrap only when the configured campaign has never been seeded.
 * Once metadata exists, compare only the immutable stored bootstrap payload.
 * Mutable coordination/presentation rows are deliberately not revalidated here
 * because normal play advances them after the initial seed.
 */
export function durableRpgStagingBootstrapForDatabase(
  filePath: string,
  config: DurableRpgStagingBootstrapConfig,
): DurableCampaignBootstrap | undefined {
  const expected = durableRpgStagingBootstrap(config);
  if (!existsSync(filePath)) return expected;

  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    const table = database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(METADATA_TABLE) as { name: string } | undefined;
    if (!table) return expected;

    const row = database.prepare(
      `SELECT bootstrap_json FROM ${METADATA_TABLE} WHERE campaign_id = ?`,
    ).get(config.campaignId) as { bootstrap_json: string } | undefined;
    if (!row) return expected;

    let stored: unknown;
    try {
      stored = JSON.parse(row.bootstrap_json);
    } catch (error) {
      throw new Error("Existing staging campaign bootstrap metadata is invalid JSON.", {
        cause: error,
      });
    }
    if (stableJson(stored) !== stableJson(expected)) {
      throw new Error(
        `Existing staging campaign ${config.campaignId} was seeded for different configuration.`,
      );
    }
    return undefined;
  } finally {
    database.close();
  }
}

function identifier(value: string, label: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${label} must be a valid GameFrame identifier.`);
  }
  return value;
}

function text(value: string, label: string, maximumLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength || /[\r\n\0]/.test(normalized)) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function timestamp(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 UTC timestamp.`);
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}
