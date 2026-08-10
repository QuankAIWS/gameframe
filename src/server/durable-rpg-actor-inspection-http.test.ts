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

function projection(): any {
  const value = JSON.parse(readFileSync(fixturePath, "utf8")).projection;
  value.scene.entities.push({
    entityId: "npc.mara-venn",
    entityClass: "actor",
    displayLabel: "checkpoint official",
    identityStage: "role",
    interactionTargetId: "entity:npc.mara-venn",
  });
  return value;
}

function actorRequest(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 1,
    kind: "campaign.exploration_actor_inspect",
    operationId: "operation:pell-check-badge",
    campaignId: "campaign-monster-master-reference",
    sceneId: "scene.crooked-checkpoint",
    authenticatedPlayerId: "player:ada",
    actorEntityId: "npc.warden-pell",
    targetEntityId: "npc.mara-venn",
    issuedAt: "2026-08-10T17:00:00.000Z",
    ...overrides,
  };
}

async function start() {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-actor-inspection-http-"));
  const filePath = join(directory, "gameframe.sqlite");
  const server = createDurableRpgHttpServer({
    filePath,
    explorationTransport: {
      attach: async ({ campaignId, authenticatedPlayerId }) => {
        assert.equal(campaignId, "campaign-monster-master-reference");
        assert.equal(authenticatedPlayerId, "player:ada");
        return projection();
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return {
    server,
    directory,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function close(input: Awaited<ReturnType<typeof start>>) {
  await new Promise<void>((resolve, reject) =>
    input.server.close((error) => error ? reject(error) : resolve())
  );
  rmSync(input.directory, { recursive: true, force: true });
}

test("only Runtime can move Pell for inspection and the durable transform appears on later player attach", async () => {
  const running = await start();
  try {
    const path = `${running.baseUrl}/api/rpg/campaigns/campaign-monster-master-reference/exploration/actor-inspect`;
    const playerAttempt = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gameframe-player-id": "player:ada",
      },
      body: JSON.stringify(actorRequest()),
    });
    assert.equal(playerAttempt.status, 403);

    const serviceHeaders = {
      "content-type": "application/json",
      "x-gameframe-service-id": "rpg-gm-runtime",
    };
    const inspectedResponse = await fetch(path, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify(actorRequest()),
    });
    assert.equal(inspectedResponse.status, 200);
    const inspected = await inspectedResponse.json() as any;
    assert.equal(inspected.kind, "campaign.exploration_actor_inspected");
    assert.equal(inspected.replayed, false);
    assert.equal(inspected.actorEntityId, "npc.warden-pell");
    assert.equal(inspected.targetEntityId, "npc.mara-venn");

    const target = projection().scene.entities.find((entity: any) => entity.entityId === "npc.mara-venn");
    assert.ok(target);
    assert.ok(Array.isArray(inspected.path));

    const retry = await fetch(path, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify(actorRequest()),
    }).then((response) => response.json()) as any;
    assert.equal(retry.replayed, true);
    assert.equal(retry.actorPositionRevision, inspected.actorPositionRevision);
    assert.deepEqual(retry.transform, inspected.transform);

    const playerAttach = await fetch(
      `${running.baseUrl}/api/rpg/campaigns/campaign-monster-master-reference/exploration/attach`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gameframe-player-id": "player:ada",
        },
        body: JSON.stringify({
          protocolVersion: 1,
          kind: "campaign.exploration.attach",
          campaignId: "campaign-monster-master-reference",
        }),
      },
    );
    assert.equal(playerAttach.status, 200);
    const materialized = await playerAttach.json() as any;
    const pell = materialized.materialization.anchors.find(
      (anchor: any) => anchor.semanticId === "npc.warden-pell",
    );
    const mara = materialized.materialization.anchors.find(
      (anchor: any) => anchor.semanticId === "npc.mara-venn",
    );
    assert.deepEqual({ x: pell.x, y: pell.y }, {
      x: inspected.transform.x,
      y: inspected.transform.y,
    });
    assert.equal(Math.abs(pell.x - mara.x) + Math.abs(pell.y - mara.y), 1);
  } finally {
    await close(running);
  }
});

test("Runtime cannot reuse an actor operation id for a different target", async () => {
  const running = await start();
  try {
    const path = `${running.baseUrl}/api/rpg/campaigns/campaign-monster-master-reference/exploration/actor-inspect`;
    const headers = {
      "content-type": "application/json",
      "x-gameframe-service-id": "rpg-gm-runtime",
    };
    const first = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(actorRequest()),
    });
    assert.equal(first.status, 200);

    const conflicting = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(actorRequest({ targetEntityId: "npc.warden-pell" })),
    });
    assert.equal(conflicting.status, 409);
    const body = await conflicting.json() as any;
    assert.equal(body.error, "operation-conflict");
  } finally {
    await close(running);
  }
});
