import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);
const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function projection() {
  return JSON.parse(readFileSync(fixturePath, "utf8")).projection;
}

async function start() {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-exploration-http-"));
  directories.push(directory);
  const calls: Array<{ campaignId: string; authenticatedPlayerId: string }> = [];
  const server = createDurableRpgHttpServer({
    filePath: join(directory, "gameframe.sqlite"),
    explorationTransport: {
      attach: async (input) => {
        calls.push({ ...input });
        const value = structuredClone(projection());
        value.campaignId = input.campaignId;
        value.viewer.playerId = input.authenticatedPlayerId;
        return value;
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return { server, calls, baseUrl: `http://127.0.0.1:${address.port}` };
}

function request(baseUrl: string, body: unknown, playerId?: string) {
  return fetch(`${baseUrl}/api/rpg/campaigns/campaign-monster-master-reference/exploration/attach`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(playerId ? { "x-gameframe-player-id": playerId } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function close(server: ReturnType<typeof createDurableRpgHttpServer>) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("authenticated browser attach derives viewer custody and returns a physical Crooked Checkpoint", async () => {
  const { server, calls, baseUrl } = await start();
  try {
    const body = {
      protocolVersion: 1,
      kind: "campaign.exploration.attach",
      campaignId: "campaign-monster-master-reference",
    };
    assert.equal((await request(baseUrl, body)).status, 401);

    const response = await request(baseUrl, body, "player:ada");
    assert.equal(response.status, 200);
    const value = await response.json() as any;
    assert.equal(value.protocolVersion, 1);
    assert.equal(value.kind, "campaign.exploration_materialized");
    assert.equal(value.projection.viewer.playerId, "player:ada");
    assert.equal(value.materialization.sceneId, "scene.crooked-checkpoint");
    assert.equal(value.materialization.materializationRef.materializationId,
      "rpg-scene:campaign-monster-master-reference:scene.crooked-checkpoint");
    assert.equal(value.materialization.map.cells.length, 18 * 14);
    assert.ok(value.materialization.anchors.some((anchor: any) => anchor.semanticId === "npc.warden-pell"));
    assert.deepEqual(calls, [{
      campaignId: "campaign-monster-master-reference",
      authenticatedPlayerId: "player:ada",
    }]);
  } finally {
    await close(server);
  }
});

test("browser exploration attach rejects client viewer overrides before Runtime custody", async () => {
  const { server, calls, baseUrl } = await start();
  try {
    const response = await request(baseUrl, {
      protocolVersion: 1,
      kind: "campaign.exploration.attach",
      campaignId: "campaign-monster-master-reference",
      authenticatedPlayerId: "player:bryn",
    }, "player:ada");
    assert.equal(response.status, 400);
    assert.equal((await response.json() as any).error, "invalid-exploration-request");
    assert.deepEqual(calls, []);
  } finally {
    await close(server);
  }
});
