import assert from "node:assert/strict";
import test from "node:test";

import {
  HmacProxyRequestAuthenticator,
  signGameFrameProxyRequest,
} from "../auth/hmac-proxy-request-authenticator.ts";
import type { AuthenticatedPrincipal, RequestAuthenticator } from "../auth/request-authenticator.ts";
import {
  createRpgEdgeProxyHeaders,
  proxyPublicRpgRequest,
  publicRpgEdgeRoute,
} from "./rpg-edge-proxy.ts";
import { createRpgEdgeGameFrameWorker } from "./rpg-edge-worker.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

const proxySecret = "edge-proxy-secret".padEnd(48, "x");
const serviceToken = "runtime-service-token".padEnd(48, "x");
const issuedAt = Date.parse("2026-08-05T02:30:00.000Z");
const nonce = "edge-test-nonce-0000000000000001";
const principal: AuthenticatedPrincipal = {
  playerId: "discord:123456789012345678",
  source: "discord",
  displayName: "Ada",
  avatarUrl: "https://cdn.discordapp.com/avatars/123/avatar.png",
};

function sortedHeaders(headers: Headers): Array<[string, string]> {
  return [...headers.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function environment(): GameFrameWorkerEnv {
  return {
    SESSION_SECRET: "session-secret".padEnd(48, "x"),
    GAMEFRAME_RPG_ORIGIN_URL: "https://rpg-origin.example.test/",
    GAMEFRAME_RPG_PROXY_HMAC_SECRET: proxySecret,
    MATCHES: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => new Response("unused", { status: 500 }) }),
    },
  };
}

test("Cloudflare signer is byte-for-byte compatible with the VM verifier contract", async () => {
  const body = new TextEncoder().encode(JSON.stringify({ campaignId: "campaign:edge" }));
  const url = "https://rpg-origin.example.test/api/rpg/campaigns/campaign%3Aedge/attach?resume=1";
  const edgeHeaders = await createRpgEdgeProxyHeaders({
    proxySecret,
    method: "POST",
    url,
    body,
    playerId: principal.playerId,
    issuedAt,
    nonce,
    displayName: principal.displayName,
    avatarUrl: principal.avatarUrl,
  });
  const vmHeaders = signGameFrameProxyRequest({
    proxySecret,
    method: "POST",
    url,
    body,
    playerId: principal.playerId,
    issuedAt,
    nonce,
    displayName: principal.displayName,
    avatarUrl: principal.avatarUrl,
  });
  assert.deepEqual(sortedHeaders(edgeHeaders), sortedHeaders(vmHeaders));
});

test("edge proxy strips hostile headers and forwards a verifiable exact-body claim", async () => {
  const bodyText = JSON.stringify({
    protocolVersion: 2,
    campaignId: "campaign:edge",
    commandId: "command:edge-1",
    command: { kind: "campaign.submit_action", text: "Open the gate." },
  });
  let forwarded: Request | undefined;
  const response = await proxyPublicRpgRequest(
    new Request("https://game.example.test/api/rpg/campaigns/campaign%3Aedge/commands", {
      method: "POST",
      headers: {
        origin: "https://game.example.test",
        "content-type": "application/json",
        authorization: "Bearer attacker-token",
        "x-gameframe-principal-id": "discord:attacker",
        "x-gameframe-service-id": "attacker-service",
        "x-gameframe-signature": "attacker-signature",
        cookie: "gameframe_session=browser-session",
      },
      body: bodyText,
    }),
    environment(),
    principal,
    {
      now: () => issuedAt,
      randomBytes: () => new Uint8Array(24).fill(7),
      fetcher: async (input, init) => {
        forwarded = new Request(input, init);
        return new Response(JSON.stringify({ status: "accepted" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": "origin_cookie=must-not-escape",
            "x-origin-secret": "must-not-escape",
          },
        });
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("x-origin-secret"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert(forwarded);
  assert.equal(forwarded.url, "https://rpg-origin.example.test/api/rpg/campaigns/campaign%3Aedge/commands");
  assert.equal(forwarded.headers.get("authorization"), null);
  assert.equal(forwarded.headers.get("x-gameframe-service-id"), null);
  assert.equal(forwarded.headers.get("cookie"), null);
  assert.equal(await forwarded.clone().text(), bodyText);

  const verified = await new HmacProxyRequestAuthenticator({
    proxySecret,
    serviceToken,
    now: () => issuedAt,
  }).authenticate(forwarded.clone());
  assert.deepEqual(verified, principal);
});

test("edge proxy rejects cross-origin and non-Discord mutation attempts before origin fetch", async () => {
  let fetchCount = 0;
  const dependencies = {
    fetcher: async () => {
      fetchCount += 1;
      return new Response("unexpected");
    },
  };
  const crossOrigin = await proxyPublicRpgRequest(
    new Request("https://game.example.test/api/rpg/campaigns/campaign/attach", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: "{}",
    }),
    environment(),
    principal,
    dependencies,
  );
  assert.equal(crossOrigin.status, 403);
  assert.equal((await crossOrigin.json() as { error: string }).error, "cross_origin_forbidden");

  const development = await proxyPublicRpgRequest(
    new Request("https://game.example.test/api/rpg/campaigns/campaign/attach", {
      method: "POST",
      headers: { origin: "https://game.example.test", "content-type": "application/json" },
      body: "{}",
    }),
    environment(),
    { playerId: "dev", source: "development" },
    dependencies,
  );
  assert.equal(development.status, 403);
  assert.equal(fetchCount, 0);
});

test("public route grammar exposes campaign and supported exploration mutations", () => {
  assert.deepEqual(publicRpgEdgeRoute("/api/rpg/campaigns/campaign%3Aedge/attach"), {
    campaignId: "campaign:edge",
    operation: "attach",
  });
  assert.deepEqual(publicRpgEdgeRoute("/api/rpg/campaigns/campaign/commands"), {
    campaignId: "campaign",
    operation: "commands",
  });
  assert.deepEqual(publicRpgEdgeRoute("/api/rpg/campaigns/campaign/exploration/attach"), {
    campaignId: "campaign",
    operation: "exploration/attach",
  });
  assert.deepEqual(publicRpgEdgeRoute("/api/rpg/campaigns/campaign/exploration/move"), {
    campaignId: "campaign",
    operation: "exploration/move",
  });
  assert.deepEqual(publicRpgEdgeRoute("/api/rpg/campaigns/campaign/exploration/interact"), {
    campaignId: "campaign",
    operation: "exploration/interact",
  });
  assert.deepEqual(publicRpgEdgeRoute("/api/rpg/campaigns/campaign/exploration/control"), {
    campaignId: "campaign",
    operation: "exploration/control",
  });
  assert.equal(publicRpgEdgeRoute("/api/rpg/campaigns/campaign/events"), null);
  assert.equal(publicRpgEdgeRoute("/api/rpg/campaigns/campaign/exploration/delete"), null);
  assert.equal(publicRpgEdgeRoute("/api/rpg/encounters/encounter"), null);
  assert.equal(publicRpgEdgeRoute("/api/rpg/encounters/encounter/complete"), null);
});

test("worker wrapper authenticates exploration attach, move, and control while blocking private runtime routes", async () => {
  let authenticated = 0;
  const forwardedPaths: string[] = [];
  const authenticator: RequestAuthenticator = {
    async authenticate() {
      authenticated += 1;
      return principal;
    },
  };
  const worker = createRpgEdgeGameFrameWorker({
    authenticator,
    proxyDependencies: {
      now: () => issuedAt,
      randomBytes: () => new Uint8Array(24).fill(3),
      fetcher: async (input) => {
        forwardedPaths.push(new URL(input instanceof Request ? input.url : String(input)).pathname);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const env = environment();
  const allowed = await worker.fetch(new Request(
    "https://game.example.test/api/rpg/campaigns/campaign/attach",
    {
      method: "POST",
      headers: { origin: "https://game.example.test", "content-type": "application/json" },
      body: JSON.stringify({ protocolVersion: 2, campaignId: "campaign" }),
    },
  ), env);
  assert.equal(allowed.status, 200);

  const exploration = await worker.fetch(new Request(
    "https://game.example.test/api/rpg/campaigns/campaign/exploration/attach",
    {
      method: "POST",
      headers: { origin: "https://game.example.test", "content-type": "application/json" },
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.exploration.attach",
        campaignId: "campaign",
      }),
    },
  ), env);
  assert.equal(exploration.status, 200);

  const movement = await worker.fetch(new Request(
    "https://game.example.test/api/rpg/campaigns/campaign/exploration/move",
    {
      method: "POST",
      headers: { origin: "https://game.example.test", "content-type": "application/json" },
      body: JSON.stringify({
        type: "exploration_move",
        protocolVersion: 1,
        campaignId: "campaign",
        sceneId: "scene.crooked-checkpoint",
        materializationRef: {
          materializationId: "rpg-scene:campaign:scene.crooked-checkpoint",
          version: "1",
          hash: "A".repeat(43),
        },
        expectedPositionRevision: 4,
        direction: "west",
      }),
    },
  ), env);
  assert.equal(movement.status, 200);

  const control = await worker.fetch(new Request(
    "https://game.example.test/api/rpg/campaigns/campaign/exploration/control",
    {
      method: "POST",
      headers: { origin: "https://game.example.test", "content-type": "application/json" },
      body: JSON.stringify({
        type: "exploration_monster_control",
        protocolVersion: 1,
        campaignId: "campaign",
        sceneId: "scene.crooked-checkpoint",
        materializationRef: {
          materializationId: "rpg-scene:campaign:scene.crooked-checkpoint",
          version: "1",
          hash: "A".repeat(43),
        },
        expectedPositionRevision: 4,
        expectedGameframeCoordinationRevision: 5,
        commandId: "command:deploy-cinder",
        issuedAt: "2026-08-09T23:00:00.000Z",
        operation: "deploy",
        controlTargetId: "roster:monster.cinder",
      }),
    },
  ), env);
  assert.equal(control.status, 200);
  assert.equal(authenticated, 4);
  assert.deepEqual(forwardedPaths, [
    "/api/rpg/campaigns/campaign/attach",
    "/api/rpg/campaigns/campaign/exploration/attach",
    "/api/rpg/campaigns/campaign/exploration/move",
    "/api/rpg/campaigns/campaign/exploration/control",
  ]);

  const privateRoute = await worker.fetch(new Request(
    "https://game.example.test/api/rpg/campaigns/campaign/events",
    { method: "POST" },
  ), env);
  assert.equal(privateRoute.status, 404);
  assert.equal(authenticated, 4);
  assert.equal(forwardedPaths.length, 4);

  const health = await worker.fetch(new Request(
    "https://game.example.test/api/rpg/edge/health",
  ), env);
  assert.equal(health.status, 200);
  assert.equal((await health.json() as { configured: boolean }).configured, true);
});