---
title: RPG Signed Edge Authentication
status: implementation-ready
document_type: security_contract
owner: Scribbles GameFrame
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - authenticated-edge-gateway
  - rpg-gm-runtime
related:
  - rpg-single-vm-deployment.md
  - rpg-gameframe-interface-contract.md
---

# RPG Signed Edge Authentication

## Purpose

Authenticate internet-facing player requests at an edge gateway while keeping the durable GameFrame RPG service bound to loopback on the VM.

Cloudflare Tunnel is transport only. It does not make trusted identity headers safe. The edge gateway must authenticate the player, remove all client-supplied GameFrame identity headers, hash the exact forwarded request body, and sign the resulting claim.

RPG GM Runtime does not use player signatures. Its loopback service calls use a bearer token and explicit service identity.

## Modes

GameFrame selects exactly one mode through `GAMEFRAME_RPG_AUTH_MODE`.

### `development-header`

- requires `GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1`;
- accepts the existing development identity headers;
- remains loopback-only;
- must not be exposed through Cloudflare Tunnel.

### `hmac-proxy`

- requires `GAMEFRAME_RPG_PROXY_HMAC_SECRET` of at least 32 bytes;
- verifies signed player claims;
- verifies the exact body digest before parsing JSON;
- rejects stale timestamps, replayed nonces, mixed service/player identity, changed metadata, changed route, changed query, changed method, and changed body;
- accepts internal service calls only with the loopback bearer token and `x-gameframe-service-id`.

The durable service remains loopback-only in this mode. Cloudflared or another local edge component connects to loopback.

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

Player IDs use the existing GameFrame identifier grammar. Display name and avatar URL are optional but are included in the signature when present.

## Canonical payload

The signature is HMAC-SHA256 over the UTF-8 JSON encoding of this array:

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

The signature and body digest use unpadded base64url.

The edge must sign the exact bytes it forwards. Re-serializing JSON after signing invalidates the request.

## Replay window

GameFrame accepts a bounded clock window configured by `GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS`, defaulting to 60 seconds.

A verified `(player ID, nonce)` pair is accepted once during that window. Reuse is rejected. The replay cache is intentionally bounded; capacity exhaustion fails authentication closed.

All mutation endpoints also retain their existing durable idempotency and revision checks. Authentication replay protection does not replace command, runtime-commit, or encounter idempotency.

## Internal service authentication

RPG GM Runtime calls GameFrame over loopback with:

```text
Authorization: Bearer <RPG_GM_SERVICE_TOKEN>
x-gameframe-service-id: rpg-gm-runtime
```

The bearer token is compared in constant time. A request cannot combine service bearer identity with signed player headers.

The same initial service token is used for GameFrame-to-GM and GM-to-GameFrame loopback calls. It is independent of the player-proxy HMAC secret and the campaign-feed cursor secret.

## Edge gateway obligations

Before forwarding a player request, the edge gateway must:

1. authenticate the Discord/GameFrame user;
2. resolve one stable player ID;
3. remove every incoming `x-gameframe-*` identity or signature header;
4. remove incoming `Authorization` and `x-gameframe-service-id` headers from public traffic;
5. enforce the allowed RPG route and method set;
6. preserve the exact path and query;
7. read and bound the complete request body;
8. compute SHA-256 over the exact forwarded bytes;
9. generate a cryptographically random nonce;
10. use the current edge time in Unix epoch milliseconds;
11. sign the canonical payload;
12. forward only to the loopback GameFrame service;
13. never forward the HMAC secret to the browser;
14. never route public traffic to RPG GM Runtime.

## Cloudflare deployment boundary

Cloudflare Tunnel may be introduced only after an edge worker or equivalent gateway implements this contract and strips untrusted headers.

Allowed future route:

```text
browser or Discord Activity
→ Cloudflare edge authentication/signing gateway
→ Cloudflare Tunnel
→ loopback GameFrame RPG service
```

Forbidden route:

```text
browser
→ Cloudflare Tunnel
→ development-header GameFrame service
```

RPG GM Runtime port `8791` remains loopback-only permanently.

## Secret rotation

Rotate secrets independently:

- proxy HMAC secret: edge gateway and GameFrame;
- service bearer token: GameFrame and RPG GM Runtime;
- cursor HMAC secret: RPG GM Runtime only.

The current implementation accepts one proxy secret and one service token at a time. Rotation therefore requires a coordinated restart. A future key-ID/key-ring extension may support overlap without downtime.

## Failure behavior

Authentication failures return no durable mutation and do not reveal expected signatures or secrets.

- missing signed player headers: `401`;
- malformed, stale, replayed, or mismatched signed claims: `403`;
- invalid or incomplete service bearer identity: `401` or `403`;
- valid identity with insufficient campaign authority: existing RPG authorization response.
