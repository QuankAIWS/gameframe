# Testing Strategy

Validation is layered so ordinary game development does not require a live Theo deployment.

## Layer 1 — Deterministic core

- Game-rule unit tests
- Legal-action invariants
- Complete win/draw coverage
- Exhaustive perfect-player non-loss proof for tic-tac-toe

## Layer 2 — Match contracts

- Player identity and turn ownership
- Stale revision rejection
- Duplicate action idempotency
- Completed-match rejection
- Event replay equivalence

## Layer 3 — Local service integration

- Match creation through HTTP
- Human action followed by deterministic Theo response
- Observation retrieval
- Health and error behavior

## Layer 4 — Browser acceptance

- Render a board
- Start a match
- Submit moves through the application boundary
- Reach a deterministic completed state
- Exercise desktop and mobile viewports

## Layer 5 — External canaries

These cannot be claimed from local validation:

- Discord Activity launch, identity, proxy, and mobile behavior
- Cloudflare deployed Worker/Durable Object behavior and quotas
- OpenClaw plugin compatibility and real Theo decisions
- Production or staging recovery

Reports must distinguish local execution from canonical CI and live-environment proof.

## WebSocket projection tests

Local contract tests prove:

- A socket is attached only after its player-specific view resolves.
- Each connection receives an initial authoritative view.
- Match updates fan out only to subscribers of that match.
- Every subscriber receives its own player-specific observation.
- Refresh messages recover current state after reconnect or uncertainty.
- Game-changing messages are rejected on the WebSocket channel.
- Projection delivery failure does not roll back an accepted command.

Real hibernation across `workerd` eviction remains an external runtime test until Cloudflare's development packages can be installed and locked.

## Authentication and authorization tests

- Anonymous game API calls fail closed.
- The creator must occupy one requested seat.
- Reads and actions derive identity from the authenticated request principal.
- Conflicting client-supplied identity claims are rejected.
- Rejected impersonation attempts do not mutate the match.
- WebSocket attachments receive only the authenticated principal's observation.
- Development authentication is explicitly separate from the production Discord and service verifiers.

## Signed session tests

- Valid signed sessions recover the original principal.
- Signature modification fails closed.
- Expired and malformed sessions fail closed.
- Cookie parsing does not expose or reinterpret client identity claims.
- Activity cookies include Discord's required iframe and partitioning attributes.
- Cloudflare uses the configured secret for both HTTP and WebSocket request authentication.
