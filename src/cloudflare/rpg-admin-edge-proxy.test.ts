import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { proxyPublicRpgAdminRequest } from "./rpg-admin-edge-proxy.ts";

const principal: AuthenticatedPrincipal = {
  playerId: "discord:admin",
  source: "discord",
  displayName: "Admin",
};

const env = {
  GAMEFRAME_RPG_ORIGIN_URL: "https://rpg-origin.example/",
  GAMEFRAME_RPG_PROXY_HMAC_SECRET: "diagnostics-proxy-secret-that-is-long-enough",
};

test("admin diagnostics proxy signs an authenticated GET without requiring a mutation Origin header", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;
  globalThis.fetch = (async (input, init) => {
    upstreamCalled = true;
    assert.equal(String(input), "https://rpg-origin.example/api/rpg/admin/staging-diagnostics");
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("accept"), "application/json");
    assert.ok(headers.get("x-gameframe-signature"));
    assert.equal(headers.get("x-gameframe-player-id"), principal.playerId);
    return new Response(JSON.stringify({
      schemaVersion: "gameframe.rpg.session-diagnostics.v1",
      commands: [],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const response = await proxyPublicRpgAdminRequest(
      new Request("https://gameframe.cc/api/rpg/admin/staging-diagnostics"),
      env,
      principal,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(upstreamCalled, true);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.schemaVersion, "gameframe.rpg.session-diagnostics.v1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin diagnostics proxy rejects mutation methods before contacting the origin", async () => {
  const response = await proxyPublicRpgAdminRequest(
    new Request("https://gameframe.cc/api/rpg/admin/staging-diagnostics", { method: "POST" }),
    env,
    principal,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});
