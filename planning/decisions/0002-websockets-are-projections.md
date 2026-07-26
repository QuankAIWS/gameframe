# Decision 0002 — WebSockets are projections, not commands

## Decision

Theo GameFrame uses authenticated HTTP requests for game-changing commands. WebSockets deliver initial state, authoritative updates, and explicit refresh responses only.

## Rationale

The command path already provides action IDs, expected revisions, deterministic validation, idempotency, and durable persistence. Reusing that path avoids creating a second mutation protocol with separate retry and concurrency semantics. WebSockets remain disposable delivery channels whose failure cannot invalidate or roll back game truth.

Cloudflare Durable Object WebSocket hibernation is the target public transport because it allows idle clients to remain connected while the object sleeps. Socket attachments store only match and player identity; authoritative match data remains in Durable Object storage.

## Consequences

- Browser and Discord clients submit moves over HTTPS.
- Connected clients receive personalized state projections after each commit.
- Reconnecting clients request a refresh and recover from the durable snapshot.
- A future high-frequency game may introduce a carefully specified command stream, but only after the existing revision and idempotency guarantees are preserved.
