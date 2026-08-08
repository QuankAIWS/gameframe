import assert from "node:assert/strict";
import test from "node:test";

import type { RequestAuthenticator } from "../auth/request-authenticator.ts";
import { createRpgEdgeGameFrameWorker } from "./rpg-edge-worker.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

const authenticator: RequestAuthenticator = {
  async authenticate() {
    return {
      playerId: "player:ada",
      source: "discord",
      displayName: "Ada",
    };
  },
};

const env = {
  GAMEFRAME_RPG_ORIGIN_URL: "https://rpg-origin.example/",
  GAMEFRAME_RPG_PROXY_HMAC_SECRET: "rpg-match-worker-secret-0123456789abcdef",
} as GameFrameWorkerEnv;

test("RPG match page health selects origin WebSockets while ordinary pages keep Durable Object realtime", async () => {
  const worker = createRpgEdgeGameFrameWorker({ authenticator });
  const rpgHealth = await worker.fetch(new Request("https://game.example/api/health", {
    headers: {
      referer: "https://game.example/monster-master.html?match=rpg%3Aencounter-one&campaign=campaign-one",
    },
  }), env);
  assert.equal(rpgHealth.status, 200);
  const rpgValue = await rpgHealth.json() as any;
  assert.equal(rpgValue.realtime, "websocket-hibernation");
  assert.equal(rpgValue.realtimeTransport, "websocket-origin");
  assert.equal(rpgValue.rpgMatchAuthority, "vm-sqlite");

  const ordinaryHealth = await worker.fetch(new Request("https://game.example/api/health", {
    headers: { referer: "https://game.example/monster-master.html?match=ordinary-match" },
  }), env);
  assert.equal(ordinaryHealth.status, 200);
  const ordinaryValue = await ordinaryHealth.json() as any;
  assert.equal(ordinaryValue.realtime, "websocket-hibernation");
  assert.equal(ordinaryValue.realtimeTransport, undefined);
  assert.equal(ordinaryValue.rpgMatchAuthority, undefined);
});

test("RPG match HTTP view is signed to VM authority before the ordinary match router", async () => {
  let upstream: Request | undefined;
  const worker = createRpgEdgeGameFrameWorker({
    authenticator,
    proxyDependencies: {
      now: () => 1_785_000_000_000,
      randomBytes: (length) => new Uint8Array(length).fill(4),
      fetcher: async (input, init) => {
        upstream = new Request(input, init);
        return new Response(JSON.stringify({
          gameId: "monster-master-duel",
          matchId: "rpg:encounter-one",
          revision: 3,
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const response = await worker.fetch(
    new Request("https://game.example/api/matches/rpg%3Aencounter-one"),
    env,
  );
  assert.equal(response.status, 200);
  assert.ok(upstream);
  assert.equal(upstream!.url, "https://rpg-origin.example/api/matches/rpg%3Aencounter-one");
  assert.equal(upstream!.headers.get("x-gameframe-principal-id"), "player:ada");
  assert.equal((await response.json() as any).matchId, "rpg:encounter-one");
});

test("RPG match events are signed to the VM WebSocket origin before Durable Object routing", async () => {
  let upstream: Request | undefined;
  const upgradeResponse = {
    status: 101,
    webSocket: { accepted: true },
  } as unknown as Response;
  const worker = createRpgEdgeGameFrameWorker({
    authenticator,
    proxyDependencies: {
      now: () => 1_785_000_000_000,
      randomBytes: (length) => new Uint8Array(length).fill(5),
      fetcher: async (input, init) => {
        upstream = new Request(input, init);
        return upgradeResponse;
      },
    },
  });
  const response = await worker.fetch(
    new Request("https://game.example/api/matches/rpg%3Aencounter-one/events", {
      headers: {
        origin: "https://game.example",
        upgrade: "websocket",
      },
    }),
    env,
  );
  assert.equal(response, upgradeResponse);
  assert.ok(upstream);
  assert.equal(
    upstream!.url,
    "https://rpg-origin.example/api/matches/rpg%3Aencounter-one/events",
  );
  assert.equal(upstream!.headers.get("upgrade"), "websocket");
  assert.equal(upstream!.headers.get("x-gameframe-principal-id"), "player:ada");
});
