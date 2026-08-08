import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WebSocket } from "ws";

import { HmacProxyRequestAuthenticator } from "../auth/hmac-proxy-request-authenticator.ts";
import { createRpgEdgeProxyHeaders } from "../cloudflare/rpg-edge-proxy.ts";
import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const proxySecret = "realtime-hmac-proxy-secret-0123456789abcdef";
const serviceToken = "realtime-service-token-0123456789abcdef";

function bootstrap(): DurableCampaignBootstrap {
  return {
    campaignId: "campaign-hmac",
    title: "HMAC realtime campaign",
    status: "active",
    state: {
      gameframeCoordinationRevision: 7,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [{
      playerId: "player:ada",
      role: "player",
      partyId: "party:keepers",
      joinedPresentationSequence: 0,
    }],
    events: [],
    initializedAt: "2026-08-08T12:00:00.000Z",
  };
}

function nextJson(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
}

test("VM realtime accepts the exact gameframe-hmac-v1 WebSocket handshake produced at the edge", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-realtime-hmac-"));
  const filePath = join(directory, "gameframe.sqlite");
  const now = Date.now();
  const authenticator = new HmacProxyRequestAuthenticator({
    proxySecret,
    serviceToken,
    now: () => now,
  });
  const server = createDurableRpgHttpServer({
    filePath,
    authenticator,
    bootstrapCampaigns: [bootstrap()],
  });
  let socket: WebSocket | undefined;
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const path = "/api/rpg/campaigns/campaign-hmac/realtime";
    const signed = await createRpgEdgeProxyHeaders({
      proxySecret,
      method: "GET",
      url: `https://rpg-origin.example${path}`,
      body: new Uint8Array(),
      playerId: "player:ada",
      issuedAt: now,
      nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      displayName: "Ada",
    });
    socket = new WebSocket(`ws://127.0.0.1:${address.port}${path}`, {
      headers: Object.fromEntries(signed.entries()),
    });
    const initial = await nextJson(socket);
    assert.deepEqual(initial, {
      type: "campaign_position",
      reason: "initial",
      protocolVersion: 2,
      campaignId: "campaign-hmac",
      gameframeCoordinationRevision: 7,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    });
  } finally {
    socket?.close();
    await server.closeRealtime();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
