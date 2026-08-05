---
title: RPG Signed Edge Authentication
status: implemented
document_type: security_contract
owner: Scribbles GameFrame
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - cloudflare-worker
  - rpg-gm-runtime
related:
  - rpg-single-vm-deployment.md
  - rpg-gameframe-interface-contract.md
---

# RPG Signed Edge Authentication

## Purpose

Authenticate internet-facing player requests in the existing Scribbles GameFrame Cloudflare Worker while keeping the durable GameFrame RPG and RPG GM Runtime services bound to loopback on the VM.

Cloudflare Tunnel is transport only. The Worker authenticates the existing Discord OAuth session, discards client identity claims, signs the exact request bytes, and forwards only the public RPG route subset to a dedicated Tunnel origin.

## Implemented request path

```text
browser or Discord Activity
→ GameFrame Cloudflare Worker
→ Discord OAuth signed session
→ exact-body gameframe-hmac-v1 claim
→ dedicated HTTPS Tunnel origin
→ GameFrame RPG at 127.0.0.1:8790
```

RPG GM Runtime remains private at `127.0.0.1:8791`. It never receives public Worker or Tunnel traffic.

The Worker exposes only:

- `POST /api/rpg/campaigns/:campaignId/attach`;
- `POST /api/rpg/campaigns/:campaignId/commands`.

Runtime event publication, encounter launch, encounter lookup, and terminal-outcome routes are not public edge routes.

## GameFrame modes

GameFrame selects exactly one mode through `GAMEFRAME_RPG_AUTH_MODE`.

### `development-header`

- requires `GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1`;
- accepts development identity headers;
- remains loopback-only;
- must never be a Tunnel origin.

### `hmac-proxy`

- requires `GAMEFRAME_RPG_PROXY_HMAC_SECRET` of at least 32 bytes;
- verifies signed player claims and the exact body digest before parsing JSON;
- rejects stale timestamps, replayed nonces, mixed service/player identity, changed metadata, changed route, changed query, changed method, and changed body;
- accepts internal service calls only with the shared bearer token and `x-gameframe-service-id`.

Production uses `hmac-proxy`.

## Worker session authority

The Worker reuses the accepted Discord OAuth and signed-session implementation:

- website OAuth authorization-code flow;
- Discord Activity authorization-code exchange;
- signed `gameframe_session` cookie;
- staging allowlist or explicit `*` access policy;
- stable player identity `discord:<discord-user-id>`;
- signed display name and optional avatar URL.

The Worker never sends the Discord access token, session token, session cookie, Worker secret, or browser `Authorization` header to the VM origin.

## Signed player headers

```text
x-gameframe-auth-version: 1
x-gameframe-principal-kind: player
x-gameframe-principal-id: <stable authenticated player ID>
x-gameframe-issued-at: <13-digit Unix epoch milliseconds>
x-gameframe-nonce: <16-128 character base64url token>
x-gameframe-body-sha256: <base64url SHA-256 digest>
x-gameframe-signature: <base64url HMAC-SHA256>
x-gameframe-display-name: <optional signed display name>
x-gameframe-avatar-url: <optional signed HTTPS avatar URL>
```

The Worker generates these headers after removing all incoming `Authorization`, cookie, `x-gameframe-service-id`, and `x-gameframe-*` signature or identity claims.

## Canonical payload

The signature is HMAC-SHA256 over the UTF-8 JSON encoding of:

```json
[
  "gameframe-hmac-v1",
  "<UPPERCASE HTTP METHOD>",
  "<PATHNAME AND QUERY>",
  "<PLAYER ID>",
  "<ISSUED-AT>",
  "<NONCE>",
  "<BODY SHA-256>",
  "<DISPLAY NAME OR EMPTY STRING>",
  "<AVATAR URL OR EMPTY STRING>"
]
```

The signature and digest use unpadded base64url. The Worker signs the exact bytes it forwards; it does not parse and reserialize the JSON body.

Node contract tests compare the Worker signer byte-for-byte with the VM reference signer and then authenticate the forwarded request through the VM verifier.

## Browser request requirements

Public RPG mutations must:

- use `POST`;
- use `application/json`;
- carry an exact `Origin` matching the Worker request origin;
- remain within the bounded request-body limit;
- carry a valid Discord session.

Requests from development or service principals are rejected by the public Worker route. Cross-origin requests fail before origin fetch.

## Origin and response handling

Worker secrets:

- `GAMEFRAME_RPG_ORIGIN_URL`: distinct HTTPS root for the Tunnel origin;
- `GAMEFRAME_RPG_PROXY_HMAC_SECRET`: same proxy HMAC secret configured on the VM GameFrame service.

The origin URL must not equal the public Worker origin. This prevents recursive Worker fetches.

The Worker follows no origin redirects. It bounds response bytes and forwards only the status, sanitized JSON content type, bounded numeric `Retry-After`, and `Cache-Control: no-store`. Origin cookies and private headers are discarded.

## Replay window

GameFrame accepts a bounded clock window configured by `GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS`, defaulting to 60 seconds.

A verified `(player ID, nonce)` pair is accepted once during that window. Reuse is rejected. Replay-cache capacity exhaustion fails authentication closed.

Durable command IDs, runtime commit IDs, revisions, and encounter IDs remain the authoritative idempotency controls. Authentication replay protection is additional and does not replace them.

## Internal service authentication

RPG GM Runtime calls GameFrame with:

```text
Authorization: Bearer <RPG_GM_SERVICE_TOKEN>
x-gameframe-service-id: rpg-gm-runtime
```

The bearer token is compared in constant time. A request cannot combine service bearer identity with signed player headers.

The service bearer, Worker proxy HMAC secret, Worker session secret, Discord client secret, and runtime cursor secret are separate credentials.

## Cloudflare Tunnel boundary

The dedicated origin hostname maps to `http://127.0.0.1:8790` through cloudflared. The public GameFrame hostname remains attached to the Worker.

Forbidden paths:

```text
browser → Tunnel → development-header GameFrame
browser → Tunnel → RPG GM Runtime
Worker → RPG GM Runtime
```

Port `8791` remains loopback-only permanently.

## Failure behavior

Authentication and edge failures create no durable mutation and reveal no expected signature or secret.

- missing session or signed player headers: `401`;
- malformed, stale, replayed, cross-origin, or mismatched claims: `403`;
- unsupported public route: `404`;
- unsupported method: `405`;
- oversized request: `413`;
- unsupported content type: `415`;
- unavailable or invalid origin response: `502`;
- origin timeout: `504`;
- missing Worker or VM configuration: `503`.

## Secret rotation

The current implementation accepts one proxy HMAC secret and one service token at a time. Rotation requires coordinated Worker deployment and VM restart. A future key-ID/key-ring extension may support overlapping keys without downtime.
