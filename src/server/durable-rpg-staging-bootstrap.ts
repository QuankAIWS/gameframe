import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const DEFAULT_TITLE = "Monster Master: The Crooked Checkpoint";
const DEFAULT_PARTY_ID = "party:main";

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
 * stable across restarts so SQLite idempotency can reject configuration drift.
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

  return {
    campaignId: identifier(campaignId, "RPG_STAGING_CAMPAIGN_ID"),
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
