import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SqliteRpgCampaignStore } from "../rpg/sqlite-rpg-campaign-store.ts";
import {
  CURRENT_STAGING_CAMPAIGN_ID,
  durableRpgStagingBootstrap,
  durableRpgStagingBootstrapForDatabase,
  parseDurableRpgStagingBootstrapConfig,
} from "./durable-rpg-staging-bootstrap.ts";

function stagingConfig(playerId = "discord:123456789") {
  const config = parseDurableRpgStagingBootstrapConfig({
    RPG_STAGING_CAMPAIGN_ID: "monster-master-staging",
    RPG_STAGING_PLAYER_ID: playerId,
    RPG_STAGING_INITIALIZED_AT: "2026-08-07T22:00:00.000Z",
  });
  assert.ok(config);
  return config;
}

test("staging campaign bootstrap is disabled when no staging identity is configured", () => {
  assert.equal(parseDurableRpgStagingBootstrapConfig({}), undefined);
});

test("installed legacy staging identity maps to the current durable generation", () => {
  assert.equal(stagingConfig().campaignId, CURRENT_STAGING_CAMPAIGN_ID);

  const explicit = parseDurableRpgStagingBootstrapConfig({
    RPG_STAGING_CAMPAIGN_ID: "explicit-staging-campaign",
    RPG_STAGING_PLAYER_ID: "discord:123456789",
    RPG_STAGING_INITIALIZED_AT: "2026-08-07T22:00:00.000Z",
  });
  assert.equal(explicit?.campaignId, "explicit-staging-campaign");
});

test("staging campaign bootstrap creates stable party-main membership", () => {
  assert.deepEqual(durableRpgStagingBootstrap(stagingConfig()), {
    campaignId: CURRENT_STAGING_CAMPAIGN_ID,
    title: "Monster Master: The Crooked Checkpoint",
    status: "active",
    state: {
      gameframeCoordinationRevision: 0,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [{
      playerId: "discord:123456789",
      role: "player",
      partyId: "party:main",
      joinedPresentationSequence: 0,
    }],
    events: [],
    initializedAt: "2026-08-07T22:00:00.000Z",
  });
});

test("process restart skips rebootstrap after mutable coordination state advances", () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-staging-bootstrap-"));
  const filePath = join(directory, "gameframe.sqlite");
  try {
    const config = stagingConfig();
    const store = new SqliteRpgCampaignStore({ filePath });
    store.bootstrap(durableRpgStagingBootstrap(config));
    store.close();

    const database = new DatabaseSync(filePath);
    database.prepare(`
      UPDATE rpg_campaign_coordination_v1
      SET gameframe_coordination_revision = 7,
          presentation_sequence = 4,
          linked_narrative_revision = 3
      WHERE campaign_id = ?
    `).run(config.campaignId);
    database.close();

    assert.equal(
      durableRpgStagingBootstrapForDatabase(filePath, config),
      undefined,
      "a progressed campaign must not be compared against revision-zero bootstrap rows",
    );
    assert.throws(
      () => durableRpgStagingBootstrapForDatabase(filePath, stagingConfig("discord:987654321")),
      /seeded for different configuration/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("staging campaign bootstrap fails closed on incomplete or invalid identity", () => {
  assert.throws(() => parseDurableRpgStagingBootstrapConfig({
    RPG_STAGING_CAMPAIGN_ID: "monster-master-staging",
  }), /RPG_STAGING_PLAYER_ID/);
  assert.throws(() => parseDurableRpgStagingBootstrapConfig({
    RPG_STAGING_CAMPAIGN_ID: "monster-master-staging",
    RPG_STAGING_PLAYER_ID: "discord:not numeric?",
    RPG_STAGING_INITIALIZED_AT: "2026-08-07T22:00:00.000Z",
  }), /RPG_STAGING_PLAYER_ID/);
  assert.throws(() => parseDurableRpgStagingBootstrapConfig({
    RPG_STAGING_CAMPAIGN_ID: "monster-master-staging",
    RPG_STAGING_PLAYER_ID: "discord:123456789",
    RPG_STAGING_INITIALIZED_AT: "today",
  }), /RPG_STAGING_INITIALIZED_AT/);
});
