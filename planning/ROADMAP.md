# Scribbles GameFrame Roadmap

## Canonically validated baseline

### GF-0001 — Infrastructure-complete tic-tac-toe walking skeleton

Acceptance target:

- A server-authoritative match can be created.
- Human and deterministic Theo seats are distinct.
- Every submitted action is authenticated by player identity at the service boundary.
- Illegal, duplicate, out-of-turn, and stale actions have deterministic behavior.
- State can be reconstructed from the event stream.
- A standalone browser client can complete a human-versus-Theo match.
- The same contracts can later support Discord Activity, Cloudflare, and Scribbles Runtime adapters.

Current proof boundary:

- Local deterministic, HTTP integration, browser syntax, and repository validation are implemented.
- Canonical Validation run `#8` (`30283559393`) passed on self-hosted runner `gh-runner-01` on July 27, 2026.
- The run validated GitHub PR merge ref `932a1f5e0a185399b0a992ac2807903618ba0661`, generated from frozen feature head `d2f404dfb76c03f5568ea3869eaccd6997423005` and base `f9d5d36c5ab569f7a39722bb4909c9804d256881`.
- The validated change was squash-merged to `main` as `01584a43777dc97a6439101ac4eff79aae1d876` without further feature-branch changes.
- Discord, deployed Cloudflare, real `workerd`, and Scribbles Runtime canaries remain pending.

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
- Explicit two-seat match creation for human and agent identities
- Human-versus-human turn flow through Node and Cloudflare adapters
- Automatic Theo opening action when Theo owns the first seat
- Server-derived player identity boundary for create, view, action, and WebSocket requests
- Fail-closed Cloudflare API behavior until a production identity verifier is configured
- HMAC-signed session cookies shared by HTTPS commands and WebSocket upgrades
- Discord Activity cookie attributes and expiry/tamper validation

Remaining acceptance work:

- Install and lock current Cloudflare development tooling
- Run the full Durable Object and WebSocket suite inside real `workerd`, including eviction and hibernation
- Perform a compact deployed Cloudflare canary

### GF-0003 — Discord Activity adapter

Add Discord authorization-code exchange and verified user lookup, issue the signed Activity session, then add launch context, participant mapping, invite/resume behavior, and desktop/mobile canaries.

### GF-0004 — Scribbles Runtime adapter for Theo

Expose structured observations and legal actions to Scribbles Runtime so it can choose actions on Theo's behalf while GameFrame retains server authority and deterministic fallback behavior.

### GF-0010 — Monster-master tactical battler foundation

Build the first replayable tactical game after the platform survives a real Discord tic-tac-toe canary. Begin with a compact two-player monster-master duel while preserving an eventual two-to-four-player architecture.

This milestone establishes the shared square-grid combat substrate for later RPG encounters: board occupancy, movement, initiative, activations, range, line of sight, terrain, effects, objectives, visibility, replay, and human or agent participation through the same authoritative command path.

Detailed sequencing, visual direction, generative-content boundaries, and acceptance criteria are recorded in [`planning/tactical-battler-rpg-foundation.md`](tactical-battler-rpg-foundation.md).

Planned internal sequence:

- `TC-0001`: board, selection, legal movement, replay, and reconnect
- `TC-0002`: initiative, activations, line of sight, combat, effects, and victory
- `MM-0001`: masters, monster cubes, deployment, resources, and a complete duel
- `MM-0002`: Theo tactical observation and legal-action integration
- `MM-0003`: Discord multiplayer canary
- `MM-0004`: second-theme proof without tactical-rule changes

### GF-0011 — RPG encounter and campaign foundation

Wrap the tactical core with persistent party, exploration, inventory, quest, and campaign state. Enter combat through a structured encounter configuration and return authoritative tactical outcomes to the campaign rather than reconstructing results from narration.

After the encounter wrapper is proven, add a bounded Game Director hosted through Scribbles Runtime. The Director narrates, portrays nonplayer characters, and proposes permitted campaign operations; GameFrame remains the rules authority, and Theo remains a player without access to Director-only or hidden campaign information.

### GF-0020 — Specialist chess module

Add chess rules, clocks, notation, Stockfish integration, strength profiles, explanation packets, and coaching workflows.

## Deferred

- Real-time command strategy simulation
- Public discovery, subscriptions, or monetization
- Native desktop or mobile clients
