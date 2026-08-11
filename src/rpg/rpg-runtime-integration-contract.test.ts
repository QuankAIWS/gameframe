import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RPG_GAMEFRAME_RUNTIME_INTEGRATION_CONTRACT,
  RPG_GAMEFRAME_RUNTIME_INTEGRATION_GENERATION,
} from "./rpg-runtime-integration-contract.ts";
import {
  RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION,
  normalizeRuntimeCommandDelivery,
} from "./runtime-command-outbox.ts";

test("GameFrame declares an explicit RPG Runtime integration generation", () => {
  assert.equal(RPG_GAMEFRAME_RUNTIME_INTEGRATION_CONTRACT, "gameframe-rpg-runtime");
  assert.equal(RPG_GAMEFRAME_RUNTIME_INTEGRATION_GENERATION, 1);
});

test("GameFrame accepts the Travel routeId delivery used by the exact-pair deployment canary", () => {
  const delivery = {
    protocolVersion: RPG_RUNTIME_COMMAND_DELIVERY_PROTOCOL_VERSION,
    deliveryId: "delivery:contract-canary:travel",
    campaignId: "campaign-contract-canary",
    commandId: "command:contract-canary:travel",
    authenticatedPlayerId: "player:contract-canary",
    sourceGameframeCoordinationRevision: 11,
    acceptedGameframeCoordinationRevision: 12,
    sourcePresentationSequence: 13,
    acceptedPresentationSequence: 13,
    issuedAt: "2026-08-11T12:00:00.000Z",
    command: {
      kind: "campaign.submit_action",
      visibility: "private-to-runtime",
      text: "Travel the selected route.",
      interaction: {
        kind: "travel",
        routeId: "route.crooked-checkpoint-west-woods",
      },
    },
  };

  assert.deepEqual(normalizeRuntimeCommandDelivery(delivery), delivery);
});

test("Travel UI does not infer an old Runtime from a routeId rejection", () => {
  const source = readFileSync("public/monster-master-rpg-travel-control.js", "utf8");
  assert.match(source, /This error does not establish that either deployed service is older/);
  assert.doesNotMatch(source, /because it is older than the current GameFrame travel contract/);
});
