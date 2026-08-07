import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import {
  proxyPublicRpgMatchRequest,
  publicRpgMatchEdgeRoute,
} from "./rpg-match-edge-proxy.ts";

const secret = "rpg-match-edge-secret-0123456789abcdef";
const principal: AuthenticatedPrincipal = {
  playerId: "player:ada",
  source: "discord",
  displayName: "Ada",
};

const env = {
  GAMEFRAME_RPG_ORIGIN_URL: "https://rpg-origin.example/",
  GAMEFRAME_RPG_PROXY_HMAC_SECRET: secret,
};

test("recognizes only RPG-bound match view and action routes", () => {
  assert.deepEqual(publicRpgMatchEdgeRoute("/api/matches/rpg%3Aencounter-one"), {
    matchId: "rpg:encounter-one",
    operation: "view",
  });
  assert.deepEqual(publicRpgMatchEdgeRoute("/api/matches/rpg:encounter-one/actions"), {
    matchId: "rpg:encounter-one",
    operation: "actions",
  });
  assert.equal(publicRpgMatchEdgeRoute("/api/matches/ordinary-match"), null);
  assert.equal(publicRpgMatchEdgeRoute("/api/matches/rpg:encounter-one/events"), null);
});

test("forwards RPG match views with signed player identity and no mutation body", async () => {
  let upstream: Request | undefined;
  const response = await proxyPublicRpgMatchRequest(
    new Request("https://game.example/api/matches/rpg%3Aencounter-one"),
    env,
    principal,
    {
      now: () => 1_785_000_000_000,
      randomBytes: (length) => new Uint8Array(length).fill(7),
      fetcher: async (input, init) => {
        upstream = new Request(input, init);
        return new Response(JSON.stringify({ matchId: "rpg:encounter-one", revision: 4 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.ok(upstream);
  assert.equal(upstream!.url, "https://rpg-origin.example/api/matches/rpg%3Aencounter-one");
  assert.equal(upstream!.method, "GET");
  assert.equal(upstream!.headers.get("x-gameframe-principal-id"), "player:ada");
  assert.equal(upstream!.headers.get("x-gameframe-principal-kind"), "player");
  assert.equal(upstream!.headers.get("x-gameframe-signature")?.length, 43);
  assert.equal(upstream!.headers.has("content-type"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("requires same-origin JSON for RPG match mutations before forwarding", async () => {
  let upstream: Request | undefined;
  const body = JSON.stringify({
    actionId: "action-one",
    expectedRevision: 4,
    action: { type: "end-activation", unitId: "alpha-master" },
  });
  const response = await proxyPublicRpgMatchRequest(
    new Request("https://game.example/api/matches/rpg%3Aencounter-one/actions", {
      method: "POST",
      headers: {
        origin: "https://game.example",
        "content-type": "application/json",
      },
      body,
    }),
    env,
    principal,
    {
      now: () => 1_785_000_000_000,
      randomBytes: (length) => new Uint8Array(length).fill(9),
      fetcher: async (input, init) => {
        upstream = new Request(input, init);
        return new Response(JSON.stringify({ revision: 5 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.ok(upstream);
  assert.equal(upstream!.method, "POST");
  assert.equal(await upstream!.text(), body);
  assert.equal(upstream!.headers.get("content-type"), "application/json");

  const crossOrigin = await proxyPublicRpgMatchRequest(
    new Request("https://game.example/api/matches/rpg%3Aencounter-one/actions", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body,
    }),
    env,
    principal,
  );
  assert.equal(crossOrigin.status, 403);
});
