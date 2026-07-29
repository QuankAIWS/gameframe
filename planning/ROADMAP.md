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
- Initial canonical validation completed successfully on July 27, 2026; see `planning/validation/2026-07-27-canonical-baseline.md`.
- Real browser interaction, deployed Cloudflare, Discord Activity, and Scribbles Runtime canaries remain pending.

## Active platform-proof sequence

The accepted near-term order is recorded in [`planning/decisions/0007-platform-proof-sequence-and-mock-agents.md`](decisions/0007-platform-proof-sequence-and-mock-agents.md). Tic-tac-toe proves the complete delivery stack, American checkers proves that the game-module and agent contracts generalize, and the monster-master battler remains the first substantial original game.

### GF-0002 — Cloudflare match runtime

Current implementation:

- Storage-neutral async match service
- Serializable and restorable authoritative snapshots
- Persistent accepted/rejected action idempotency
- Worker routing boundary
- Durable Object storage adapter and serialized object runtime
- Cloudflare static-asset and Durable Object configuration
- Local fake-runtime tests covering eviction recovery and competing writes
- Exactly pinned Wrangler, Vitest, and Workers Vitest development tooling
- Committed dependency lock validated with `npm ci`
- Real Workers-runtime tests covering object eviction, competing writes, and hibernatable WebSocket recovery
- Hibernation-WebSocket projection hub with player-specific fan-out
- Browser reconnect and refresh behavior
- Projection-failure isolation from authoritative command commits
- Explicit two-seat match creation for human and agent identities
- Human-versus-human turn flow through Node and Cloudflare adapters
- Automatic deterministic opening action when the agent seat owns the first turn
- Server-derived player identity boundary for create, view, action, and WebSocket requests
- Fail-closed Cloudflare API behavior until a production identity verifier is configured
- HMAC-signed session cookies shared by HTTPS commands and WebSocket upgrades
- Discord Activity cookie attributes and expiry/tamper validation

Remaining acceptance work:

- Perform a compact standalone deployed Cloudflare canary

### GF-0003 — Complete tic-tac-toe browser proof

Promote tic-tac-toe from a walking-skeleton interface into the complete delivery-stack proof:

- Human-versus-human and human-versus-deterministic-opponent play
- Match create, join, complete, resume, reconnect, and refresh flows
- Clear stale, duplicate, illegal, unauthorized, and completed-match presentation
- Desktop and mobile-responsive behavior
- Real headless browser interaction included in repository validation
- Deterministic screenshots or curated captures for stable screens
- Basic visual polish sufficient to evaluate the ordinary browser client as the base GameFrame interface

The existing JavaScript syntax check does not satisfy this milestone by itself.

### GF-0004 — Standalone deployment and Discord delivery canaries

Validate GameFrame without requiring a live Scribbles Runtime:

- Deploy the standalone browser client, Worker routes, and Durable Object runtime
- Verify persistence, reconnect, WebSocket projection, and recovery in the deployed environment
- Add Discord authorization-code exchange and verified user lookup
- Issue signed Activity sessions
- Validate launch context, participant mapping, invite or resume, and desktop/mobile Activity behavior

The first canaries may use human seats and deterministic in-process opponents.

### GF-0005 — Versioned agent decision contract and mock connector

Define the durable decision-provider boundary used by both test agents and the future Scribbles Runtime adapter. The contract must carry a protocol version, correlated request, game and match identity, stable player identity, expected revision, player-specific observation, enumerated legal actions, and a structured selected action.

Implement mock-provider modes for deterministic, scripted, seeded-random, delayed, unavailable, malformed, illegal, duplicate, and stale responses. GameFrame remains authoritative and validates every returned action before commit. Provider prose is optional and non-authoritative.

### GF-0006 — American checkers module

Build American checkers on an 8x8 board as the first nontrivial reusable game-module proof. Document and test dark-square movement, mandatory captures, multi-jumps, promotion, king behavior, wins, and draw handling.

Checkers must exercise the same match service, event history, player-specific observations, legal-action enumeration, browser input, reconnect, deterministic opponent, and mock-agent contract used by tic-tac-toe and intended for later games.

### GF-0007 — Checkers full-stack canary

Complete and validate:

- Human-versus-human checkers
- Human-versus-deterministic-opponent checkers
- Human-versus-mock-remote-agent checkers
- Browser selection, legal destinations, forced captures, multi-jump continuation, promotion, and completed-state presentation
- Standalone deployed GameFrame canary
- Discord Activity canary when the delivery adapter is available

This milestone is the gate proving that GameFrame is not structurally hard-coded around tic-tac-toe.

### GF-0008 — Scribbles Runtime adapter for Theo

When Scribbles Runtime is available, implement the accepted versioned decision-provider contract so it can choose actions for stable player ID `theo`. The adapter is not a prerequisite for the preceding standalone, Discord, mock-agent, or checkers proofs.

Retain deterministic fallback behavior and fail closed on malformed, stale, illegal, or unauthorized Runtime responses.

### GF-0010 — Monster-master tactical battler foundation

Build the first substantial original GameFrame game after the platform has survived tic-tac-toe deployment, browser acceptance, the mock-agent boundary, and the American-checkers generalization proof.

Begin with a two-player monster-master duel on a larger scrollable battlefield that extends beyond the normal viewport, while preserving an eventual two-to-four-player architecture.

The first production direction favors tactical-RPG-style maneuver over an immediately engaged tiny arena: small active forces move across a larger map with approach routes, objectives, terrain positions, camera panning, and room for scouting or repositioning. Compact boards remain supported for tests, tutorials, puzzles, quick matches, and small RPG encounters rather than being removed or developed as a separate engine.

This milestone establishes the shared square-grid combat substrate for later RPG encounters and possible squad-scale strategy modules: board occupancy, movement, camera-independent map state, initiative, activations, range, line of sight, terrain, effects, objectives, visibility, replay, and human or agent participation through the same authoritative command path.

Detailed sequencing, visual direction, generative-content boundaries, and acceptance criteria are recorded in [`planning/tactical-battler-rpg-foundation.md`](tactical-battler-rpg-foundation.md). The accepted larger-map direction and its relationship to retained compact arenas are recorded in [`planning/decisions/0006-scrollable-tactical-battlefields.md`](decisions/0006-scrollable-tactical-battlefields.md).

Planned internal sequence:

- `TC-0001`: map, viewport and camera, selection, legal movement, replay, and reconnect
- `TC-0002`: initiative, activations, line of sight, combat, effects, and victory
- `MM-0001`: masters, monster cubes, deployment, resources, and a complete larger-field duel
- `MM-0002`: Theo and generic decision-provider tactical observation and legal-action integration
- `MM-0003`: Discord multiplayer canary
- `MM-0004`: second-theme proof without tactical-rule changes

Potential later scale variants may use larger battlefields, more units, or squad and formation entities in a turn-based strategy mode. Those possibilities should influence clean abstractions but must not expand the first battler into a Total War-scale simulation before the small-force tactical loop is proven.

### GF-0011 — RPG encounter and campaign foundation

Wrap the tactical core with persistent party, exploration, inventory, quest, and campaign state. Enter combat through a structured encounter configuration and return authoritative tactical outcomes to the campaign rather than reconstructing results from narration.

After the encounter wrapper is proven, add a bounded Game Director hosted through Scribbles Runtime. The Director narrates, portrays nonplayer characters, and proposes permitted campaign operations; GameFrame remains the rules authority, and Theo remains a player without access to Director-only or hidden campaign information.

### GF-0020 — Specialist chess module

Add chess rules, clocks, notation, Stockfish integration, strength profiles, explanation packets, and coaching workflows.

## Deferred

- Real-time command strategy simulation
- Public discovery, subscriptions, or monetization
- Native desktop or mobile clients
