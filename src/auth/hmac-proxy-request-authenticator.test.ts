import assert from "node:assert/strict";
import test from "node:test";

import { AuthenticationError } from "./request-authenticator.ts";
import {
  GAMEFRAME_PROXY_AUTH_HEADERS,
  HmacProxyRequestAuthenticator,
  signGameFrameProxyRequest,
} from "./hmac-proxy-request-authenticator.ts";

const proxySecret = "p".repeat(48);
const serviceToken = "s".repeat(48);
const now = 1_786_000_000_000;
const url = "https://game.example/api/rpg/campaigns/campaign-one/commands?view=active";
const body = JSON.stringify({ campaignId: "campaign-one", text: "Inspect the gate." });

function signedRequest(overrides: {
  body?: string;
  issuedAt?: number;
  nonce?: string;
  headers?: HeadersInit;
} = {}): Request {
  const requestBody = overrides.body ?? body;
  const headers = signGameFrameProxyRequest({
    proxySecret,
    method: "POST",
    url,
    body: requestBody,
    playerId: "discord:1234",
    issuedAt: overrides.issuedAt ?? now,
    nonce: overrides.nonce ?? "nonce-0000000001",
    displayName: "Ada",
    avatarUrl: "https://cdn.example/ada.png",
  });
  for (const [name, value] of new Headers(overrides.headers)) headers.set(name, value);
  return new Request(url, { method: "POST", headers, body: requestBody });
}

function authenticator() {
  return new HmacProxyRequestAuthenticator({
    proxySecret,
    serviceToken,
    now: () => now,
    maxClockSkewMs: 60_000,
  });
}

test("authenticates a signed player request including exact body and metadata", async () => {
  await assert.doesNotReject(async () => {
    const principal = await authenticator().authenticate(signedRequest());
    assert.deepEqual(principal, {
      playerId: "discord:1234",
      source: "discord",
      displayName: "Ada",
      avatarUrl: "https://cdn.example/ada.png",
    });
  });
});

test("rejects body tampering even when the route and identity are unchanged", async () => {
  const headers = signGameFrameProxyRequest({
    proxySecret,
    method: "POST",
    url,
    body,
    playerId: "discord:1234",
    issuedAt: now,
    nonce: "nonce-0000000002",
  });
  const request = new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: "campaign-one", text: "Open the gate." }),
  });

  await assert.rejects(
    authenticator().authenticate(request),
    (error: unknown) =>
      error instanceof AuthenticationError
      && error.code === "identity_mismatch"
      && /body digest/.test(error.message),
  );
});

test("rejects stale timestamps and nonce replay", async () => {
  await assert.rejects(
    authenticator().authenticate(signedRequest({ issuedAt: now - 60_001 })),
    /clock window/,
  );

  const verifier = authenticator();
  await verifier.authenticate(signedRequest({ nonce: "nonce-0000000003" }));
  await assert.rejects(
    verifier.authenticate(signedRequest({ nonce: "nonce-0000000003" })),
    /nonce was already used/,
  );
});

test("rejects signed metadata tampering", async () => {
  await assert.rejects(
    authenticator().authenticate(signedRequest({
      nonce: "nonce-0000000004",
      headers: {
        [GAMEFRAME_PROXY_AUTH_HEADERS.displayName]: "Mallory",
      },
    })),
    /signature verification failed/,
  );
});

test("authenticates loopback service calls only with bearer and service ID", async () => {
  const verifier = authenticator();
  const request = new Request("http://127.0.0.1:8790/api/rpg/campaigns/campaign-one/events", {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceToken}`,
      [GAMEFRAME_PROXY_AUTH_HEADERS.serviceId]: "rpg-gm-runtime",
    },
    body: "{}",
  });

  assert.deepEqual(await verifier.authenticate(request), {
    playerId: "rpg-gm-runtime",
    source: "service",
    displayName: "Authenticated RPG service",
  });

  await assert.rejects(
    verifier.authenticate(new Request(request.url, {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token",
        [GAMEFRAME_PROXY_AUTH_HEADERS.serviceId]: "rpg-gm-runtime",
      },
      body: "{}",
    })),
    /bearer authorization is invalid/,
  );
  await assert.rejects(
    verifier.authenticate(new Request(request.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceToken}`,
      },
      body: "{}",
    })),
    /require bearer authorization and a service identity/,
  );
});

test("rejects mixed service and signed-player claims", async () => {
  const request = signedRequest({ nonce: "nonce-0000000005" });
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${serviceToken}`);
  headers.set(GAMEFRAME_PROXY_AUTH_HEADERS.serviceId, "rpg-gm-runtime");

  await assert.rejects(
    authenticator().authenticate(new Request(request.url, {
      method: request.method,
      headers,
      body,
    })),
    /cannot combine service and signed player identities/,
  );
});

test("requires minimum proxy and service secret sizes", () => {
  assert.throws(
    () => new HmacProxyRequestAuthenticator({
      proxySecret: "short",
      serviceToken,
    }),
    /proxySecret must contain at least 32 bytes/,
  );
  assert.throws(
    () => new HmacProxyRequestAuthenticator({
      proxySecret,
      serviceToken: "short",
    }),
    /serviceToken must contain at least 32 bytes/,
  );
});
