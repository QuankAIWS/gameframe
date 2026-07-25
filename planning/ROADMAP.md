# Theo GameFrame Roadmap

## Implemented locally; canonical CI pending

### GF-0001 — Infrastructure-complete tic-tac-toe walking skeleton

Acceptance target:

- A server-authoritative match can be created.
- Human and deterministic Theo seats are distinct.
- Every submitted action is authenticated by player identity at the service boundary.
- Illegal, duplicate, out-of-turn, and stale actions have deterministic behavior.
- State can be reconstructed from the event stream.
- A standalone browser client can complete a human-versus-Theo match.
- The same contracts can later support Discord Activity, Cloudflare, and OpenClaw adapters.

Current proof boundary:

- Local deterministic and HTTP integration validation is implemented.
- Browser smoke validation is available locally.
- Canonical CI, Discord canary, Cloudflare canary, and OpenClaw integration remain pending.

## Active

### GF-0002 — Cloudflare match runtime

Current implementation:

- Storage-neutral async match service
- Serializable and restorable authoritative snapshots
- Persistent accepted/rejected action idempotency
- Worker routing boundary
- Durable Object storage adapter and serialized object runtime
- Cloudflare static-asset and Durable Object configuration
- Local fake-runtime tests covering eviction recovery and competing writes
- Hibernation-WebSocket projection hub with player-specific fan-out
- Browser reconnect and refresh behavior
- Projection-failure isolation from authoritative command commits

Remaining acceptance work:

- Install and lock current Cloudflare development tooling
- Run the full Durable Object and WebSocket suite inside real `workerd`, including eviction and hibernation
- Perform a compact deployed Cloudflare canary

### GF-0003 — Discord Activity adapter

Add Discord identity exchange, Activity launch context, participant mapping, invite/resume behavior, and desktop/mobile canaries.

### GF-0004 — OpenClaw Theo player adapter

Expose structured observations and legal actions to Theo while retaining deterministic fallback behavior and server authority.

### GF-0010 — Compact tactical arena

Build the first replayable 2–4 player tactical game after the platform survives a real Discord tic-tac-toe canary.

### GF-0020 — Specialist chess module

Add chess rules, clocks, notation, Stockfish integration, strength profiles, explanation packets, and coaching workflows.

## Deferred

- RPG campaign platform
- Real-time command strategy simulation
- Public discovery, subscriptions, or monetization
- Native desktop or mobile clients
