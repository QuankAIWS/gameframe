import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { WebSocket } from "ws";

import type { RpgExplorationProjectionV1 } from "../rpg/rpg-exploration-contract.ts";
import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const directories: string[] = [];
const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);

const semantic = JSON.parse(readFileSync(fixturePath, "utf8")).projection as RpgExplorationProjectionV1;

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-exploration-realtime-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(): DurableCampaignBootstrap {
  return {
    campaignId: semantic.campaignId,
    title: "Monster Master reference campaign",
    status: "active",
    state: {
      gameframeCoordinationRevision: 3,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [{
      playerId: semantic.viewer.playerId,
      role: "player",
      joinedPresentationSequence: 0,
    }],
    events: [],
    initializedAt: "2026-08-09T13:00:00.000Z",
  };
}

async function start(filePath: string, attachCounter: { value: number }) {
  const server = createDurableRpgHttpServer({
    filePath,
    bootstrapCampaigns: [bootstrap()],
    clock: () => "2026-08-09T13:01:00.000Z",
    explorationTransport: {
      async attach(input) {
        attachCounter.value += 1;
        assert.equal(input.campaignId, semantic.campaignId);
        assert.equal(input.authenticatedPlayerId, semantic.viewer.playerId);
        return structuredClone(semantic);
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    websocketBaseUrl: `ws://127.0.0.1:${address.port}`,
  };
}

function playerHeaders(): Record<string, string> {
  return { "x-gameframe-player-id": semantic.viewer.playerId };
}

function post(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { ...playerHeaders(), "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

function attachBody() {
  return {
    protocolVersion: 1,
    kind: "campaign.exploration.attach",
    campaignId: semantic.campaignId,
  };
}

function moveBody(materializationRef: any, expectedPositionRevision: number, direction: string) {
  return {
    type: "exploration_move",
    protocolVersion: 1,
    campaignId: semantic.campaignId,
    sceneId: semantic.scene.sceneId,
    materializationRef,
    expectedPositionRevision,
    direction,
  };
}

function nextJson(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off("message", onMessage);
      socket.off("close", onClose);
      socket.off("error", onError);
    };
    const onMessage = (data: WebSocket.RawData) => {
      cleanup();
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    };
    const onClose = (code: number, reason: Buffer) => {
      cleanup();
      reject(new Error(`WebSocket closed before message: ${code} ${reason.toString()}`));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    socket.once("message", onMessage);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}

async function closeServer(server: ReturnType<typeof createDurableRpgHttpServer>): Promise<void> {
  await server.closeRealtime();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}

test("HTTP movement stays in GameFrame, WebSockets stay projection-only, and restart recovers position", async () => {
  const filePath = databasePath();
  const firstAttachCounter = { value: 0 };
  const first = await start(filePath, firstAttachCounter);
  let socket: WebSocket | undefined;
  let firstMaterialized: any;
  try {
    const attach = await fetch(
      `${first.baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/attach`,
      post(attachBody()),
    );
    assert.equal(attach.status, 200);
    firstMaterialized = await attach.json();
    assert.equal(firstAttachCounter.value, 1);
    assert.deepEqual(firstMaterialized.playerPosition.transform, { x: 14, y: 7, facing: "west" });
    assert.equal(firstMaterialized.playerPosition.positionRevision, 0);

    socket = new WebSocket(
      `${first.websocketBaseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/realtime`,
      { headers: playerHeaders() },
    );
    const initial = await nextJson(socket);
    assert.equal(initial.type, "campaign_position");
    assert.equal(initial.gameframeCoordinationRevision, 3);

    const forbiddenSocketMove = nextJson(socket);
    socket.send(JSON.stringify(moveBody(
      firstMaterialized.materialization.materializationRef,
      0,
      "west",
    )));
    const rejected = await forbiddenSocketMove;
    assert.equal(rejected.type, "protocol_error");
    assert.equal(rejected.code, "unsupported_message");

    const movement = moveBody(
      firstMaterialized.materialization.materializationRef,
      0,
      "west",
    );
    const movedResponse = await fetch(
      `${first.baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/move`,
      post(movement),
    );
    assert.equal(movedResponse.status, 200);
    const moved = await movedResponse.json() as any;
    assert.equal(moved.type, "exploration_position");
    assert.equal(moved.moved, true);
    assert.deepEqual(moved.transform, { x: 13, y: 7, facing: "west" });
    assert.equal(moved.positionRevision, 1);
    assert.equal(firstAttachCounter.value, 1, "movement must not re-enter Runtime exploration projection");

    const staleResponse = await fetch(
      `${first.baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/move`,
      post({ ...movement, direction: "north" }),
    );
    assert.equal(staleResponse.status, 409);
    assert.equal((await staleResponse.json() as any).error, "position-revision-conflict");

    const campaign = await fetch(
      `${first.baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/attach`,
      post({ protocolVersion: 2, campaignId: semantic.campaignId }),
    );
    assert.equal(campaign.status, 200);
    const campaignProjection = await campaign.json() as any;
    assert.equal(campaignProjection.gameframeCoordinationRevision, 3);
    assert.equal(campaignProjection.presentationSequence, 0);
  } finally {
    socket?.close();
    await closeServer(first.server);
  }

  const secondAttachCounter = { value: 0 };
  const second = await start(filePath, secondAttachCounter);
  try {
    const attach = await fetch(
      `${second.baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/attach`,
      post(attachBody()),
    );
    assert.equal(attach.status, 200);
    const recovered = await attach.json() as any;
    assert.equal(secondAttachCounter.value, 1);
    assert.deepEqual(recovered.playerPosition.transform, { x: 13, y: 7, facing: "west" });
    assert.equal(recovered.playerPosition.positionRevision, 1);
    assert.deepEqual(
      recovered.materialization.materializationRef,
      firstMaterialized.materialization.materializationRef,
    );

    const secondMove = await fetch(
      `${second.baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/move`,
      post(moveBody(recovered.materialization.materializationRef, 1, "north")),
    );
    assert.equal(secondMove.status, 200);
    const moved = await secondMove.json() as any;
    assert.deepEqual(moved.transform, { x: 13, y: 6, facing: "north" });
    assert.equal(secondAttachCounter.value, 1, "HTTP movement must stay inside GameFrame");
  } finally {
    await closeServer(second.server);
  }
});
