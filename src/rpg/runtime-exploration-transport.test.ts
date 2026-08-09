import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  explorationConnectionId,
  RuntimeExplorationHttpTransport,
  RuntimeExplorationTransportError,
} from "./runtime-exploration-transport.ts";

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);

function projection() {
  return JSON.parse(readFileSync(fixturePath, "utf8")).projection;
}

const token = "runtime-exploration-token-".padEnd(48, "x");

test("Runtime exploration transport derives connection custody and validates returned viewer identity", async () => {
  let requestBody: any;
  const transport = new RuntimeExplorationHttpTransport({
    baseUrl: "http://127.0.0.1:8791",
    serviceToken: token,
    fetchImpl: async (input, init) => {
      assert.equal(String(input), "http://127.0.0.1:8791/v1/gameframe/exploration/attach");
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${token}`);
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(projection()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await transport.attach({
    campaignId: "campaign-monster-master-reference",
    authenticatedPlayerId: "player:ada",
  });
  assert.equal(result.scene.sceneId, "scene.crooked-checkpoint");
  assert.deepEqual(requestBody, {
    protocolVersion: 1,
    kind: "campaign.exploration.attach",
    campaignId: "campaign-monster-master-reference",
    connectionId: explorationConnectionId("campaign-monster-master-reference", "player:ada"),
    authenticatedPlayerId: "player:ada",
  });
});

test("Runtime exploration transport rejects substituted viewer identity", async () => {
  const value = projection();
  value.viewer.playerId = "player:bryn";
  const transport = new RuntimeExplorationHttpTransport({
    baseUrl: "http://127.0.0.1:8791",
    serviceToken: token,
    fetchImpl: async () => new Response(JSON.stringify(value), { status: 200 }),
  });

  await assert.rejects(
    transport.attach({
      campaignId: "campaign-monster-master-reference",
      authenticatedPlayerId: "player:ada",
    }),
    (error: unknown) => error instanceof RuntimeExplorationTransportError
      && error.code === "invalid-runtime-response",
  );
});
