import assert from "node:assert/strict";
import test from "node:test";

import {
  durableRpgStagingBootstrap,
  parseDurableRpgStagingBootstrapConfig,
} from "./durable-rpg-staging-bootstrap.ts";

test("staging campaign bootstrap is disabled when no staging identity is configured", () => {
  assert.equal(parseDurableRpgStagingBootstrapConfig({}), undefined);
});

test("staging campaign bootstrap creates stable party-main membership", () => {
  const config = parseDurableRpgStagingBootstrapConfig({
    RPG_STAGING_CAMPAIGN_ID: "monster-master-staging",
    RPG_STAGING_PLAYER_ID: "discord:123456789",
    RPG_STAGING_INITIALIZED_AT: "2026-08-07T22:00:00.000Z",
  });
  assert.ok(config);
  assert.deepEqual(durableRpgStagingBootstrap(config), {
    campaignId: "monster-master-staging",
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
