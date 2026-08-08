import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import {
  proxyPublicRpgRealtimeRequest,
  publicRpgRealtimeEdgeRoute,
} from "./rpg-realtime-edge-proxy.ts";

const secret = "rpg-realtime-edge-secret-0123456789abcdef";
const principal: AuthenticatedPrincipal = {
  playerId: "player:ada",
  source: "discord",
  displayName: "Ada",
};
const env = {
  GAMEFRAME_RPG_ORIGIN_URL: "https://rpg-origin.example/",
  GAMEFRAME_RPG_PROXY_HMAC_SECRET: secret,
};

function websocketRequest(path: string, origin = "https://game.example") {
  return new Request(`https://game.example${path}`, {
    headers: {
      origin,
      upgrade: "websocket",
    },
  });
}

test("recognizes only player-facing RPG realtime routes", () => {
  assert.deepEqual(
    publicRpgRealtimeEdgeRoute("/api/rpg/campaigns/campaign-one/realtime"),
    { kind: "campaign", campaignId: "campaign-one" },
  );
  assert.deepEqual(
    publicRpgRealtimeEdgeRoute("/api/matches/rpg%3Aencounter-one/events"),
    { kind: "match", matchId: "rpg:encounter-one" },
  );
  assert.equal(publicRpgRealtimeEdgeRoute("/api/rpg/campaigns/campaign-one/events"), null);
  assert.equal(publicRpgRealtimeEdgeRoute("/api/matches/ordinary-match/events"), null);
});

test("passes a successful signed origin WebSocket upgrade through untouched", async () => {
  let upstreamRequest: Request | undefined;
  const upgradeResponse = {
    status: 101,
    webSocket: { accepted: true },
  } as unknown as Response;
  const response = await proxyPublicRpgRealtimeRequest(
    websocketRequest("/api/matches/rpg%3Aencounter-one/events"),
    env,
    principal,
    {
      now: () => 1_785_000_000_000,
      randomBytes: (length) => new Uint8Array(length).fill(6),
      fetcher: async (input, init) => {
        upstreamRequest = new Request(input, init);
        return upgradeResponse;
      },
    },
  );

  assert.equal(response, upgradeResponse);
  assert.ok(upstreamRequest);
  assert.equal(
    upstreamRequest!.url,
    "https://rpg-origin.example/api/matches/rpg%3Aencounter-one/events",
  );
  assert.equal(upstreamRequest!.method, "GET");
  assert.equal(upstreamRequest!.headers.get("upgrade"), "websocket");
  assert.equal(upstreamRequest!.headers.get("x-gameframe-principal-id"), "player:ada");
  assert.equal(upstreamRequest!.headers.get("x-gameframe-principal-kind"), "player");
  assert.equal(upstreamRequest!.headers.get("x-gameframe-body-sha256")?.length, 43);
  assert.equal(upstreamRequest!.headers.get("x-gameframe-signature")?.length, 43);
  assert.equal(upstreamRequest!.headers.has("cookie"), false);
});

test("requires a WebSocket upgrade, exact browser origin, and Discord principal", async () => {
  const ordinaryGet = await proxyPublicRpgRealtimeRequest(
    new Request("https://game.example/api/rpg/campaigns/campaign-one/realtime", {
      headers: { origin: "https://game.example" },
    }),
    env,
    principal,
  );
  assert.equal(ordinaryGet.status, 426);

  const crossOrigin = await proxyPublicRpgRealtimeRequest(
    websocketRequest("/api/rpg/campaigns/campaign-one/realtime", "https://evil.example"),
    env,
    principal,
  );
  assert.equal(crossOrigin.status, 403);

  const developmentPrincipal = await proxyPublicRpgRealtimeRequest(
    websocketRequest("/api/rpg/campaigns/campaign-one/realtime"),
    env,
    { playerId: "player:ada", source: "development" },
  );
  assert.equal(developmentPrincipal.status, 403);
});

test("fails closed when the origin refuses the WebSocket upgrade", async () => {
  const response = await proxyPublicRpgRealtimeRequest(
    websocketRequest("/api/rpg/campaigns/campaign-one/realtime"),
    env,
    principal,
    {
      fetcher: async () => new Response("not allowed", { status: 403 }),
    },
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json() as any).error, "forbidden");
});
