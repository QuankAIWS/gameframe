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
- Deployed Cloudflare, live Discord Activity, and Scribbles Runtime canaries remain pending.

## Active platform-proof sequence

The accepted near-term order is recorded in [`planning/decisions/0007-platform-proof-sequence-and-mock-agents.md`](decisions/0007-platform-proof-sequence-and-mock-agents.md). The scheduling amendment in [`planning/decisions/0009-defer-external-canaries-without-blocking-development.md`](decisions/0009-defer-external-canaries-without-blocking-development.md) allowed repository development to continue while owner-controlled deployment access was unavailable. Tic-tac-toe proves the browser and repository stack, American Checkers proves that the game-module and agent contracts generalize, and the monster-master battler remains the first substantial original game.

### GF-0002 — Cloudflare match runtime

Repository implementation:

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

The repository-level runtime proof is complete. Live environment behavior remains separate and is exercised by `GF-0004` after owner-controlled Cloudflare and Discord configuration.

### GF-0003 — Complete tic-tac-toe browser proof — Complete

Tic-tac-toe has been promoted from a walking-skeleton interface into the complete delivery-stack browser proof.

Canonically validated implementation:

- Human-versus-human and human-versus-deterministic-opponent play
- Persistent development-browser identity
- Match create, share, complete, resume, reconnect, refresh, and invalid-resume flows
- Clear active, completed, error, and stale-state presentation
- Desktop and mobile-responsive behavior
- HTTP polling fallback when projection WebSockets are unavailable
- Real Playwright interaction included in `npm run validate`
- Failure-only screenshots and traces
- Basic visual polish sufficient to evaluate the ordinary browser client as the base GameFrame interface

The frozen candidate passed GitHub-hosted Canonical Validation run #36 (`30492977351`) and was squash-merged as `42d6cd3da2f4a1b110fa3debd9df9da016fb2351`. See [`planning/validation/2026-07-29-tic-tac-toe-browser-proof.md`](validation/2026-07-29-tic-tac-toe-browser-proof.md). No deployed Cloudflare behavior is claimed by this milestone.

### GF-0004 — Paused live canaries; secure repository ready

The production-shaped delivery boundaries are implemented and canonically validated:

- Stateless Discord website OAuth with signed browser-bound state
- Server-side authorization-code exchange and verified `/users/@me` lookup
- Stable `discord:<user-id>` GameFrame principals
- Fail-closed staging allowlist
- Secure signed website sessions and partitioned Discord Activity sessions
- Official Discord Embedded App SDK ready/authorize/exchange/authenticate browser handshake
- Strict equality between the SDK user and signed GameFrame principal
- Signed expiring human-match invitations with serialized second-seat claims
- Direct Discord human-seat spoofing rejection
- Authenticated inviter and claimant browser surfaces
- Real Workers-runtime persistence, eviction recovery, and invitation-to-match initialization
- Required Cloudflare secrets and Worker-first `/auth/*` routing

Durable evidence:

- [`planning/validation/2026-07-30-discord-authentication-boundary.md`](validation/2026-07-30-discord-authentication-boundary.md)
- [`planning/validation/2026-07-30-discord-activity-client.md`](validation/2026-07-30-discord-activity-client.md)
- [`planning/validation/2026-07-30-authenticated-match-invitations.md`](validation/2026-07-30-authenticated-match-invitations.md)

The remaining work is external validation, not a temporary authentication implementation:

- Configure the Discord application, exact website callback URI, and Activity URL mapping
- Configure the required Cloudflare bindings and deploy validated `main`
- Complete website OAuth with real allowlisted Discord users
- Launch the Activity through real Discord desktop and mobile clients
- Verify authenticated human invitations, commands, WebSockets, reconnect, refresh, and resume over the public network
- Verify Durable Object persistence across eviction and ordinary redeployment
- Review Cloudflare logs, quotas, and operational behavior

No deployed or live Discord behavior is claimed until those canaries run. Repository development may continue while owner-controlled setup is pending.

### GF-0005 — Versioned agent decision contract and mock connector — Complete

The durable version-1 decision-provider boundary is implemented for test agents and the future Scribbles Runtime adapter.

Canonically validated implementation:

- Transport-neutral versioned request and response schemas
- Game, match, request, player, revision, deadline, observation, and legal-action context
- Provider-generated structured action IDs
- Protocol, request-correlation, player-identity, revision, response-shape, action-ID, duplicate-ID, and current-legality validation
- Explicit unavailable, timeout, malformed, mismatched, stale, duplicate, illegal, and missing-context failure classes
- Deterministic fallback restricted to the same stable player identity
- Deterministic, scripted, seeded-random, delayed, unavailable, malformed, illegal, duplicate, stale, mismatched-request, and mismatched-player mock modes
- Tic-tac-toe integration through the existing authoritative match path
- Canonical version-1 request and response fixtures for independent Runtime implementation
- Normative protocol and Scribbles Runtime boundary documentation

The frozen candidate passed GitHub-hosted Canonical Validation run #39 (`30494321343`) and was squash-merged as `46c2a0d5edcd22dfe908211915efc442d7b2d912`. See [`planning/validation/2026-07-29-agent-decision-contract.md`](validation/2026-07-29-agent-decision-contract.md). No remote provider transport, live Runtime, or deployed authentication behavior is claimed by this milestone.

### GF-0006 — American Checkers rules module — Complete

The deterministic American Checkers module is complete as the first nontrivial reusable game definition.

Canonically validated implementation:

- Explicit 8x8 dark-square coordinate model and twelve-piece initial setup
- Mandatory captures and complete terminal multi-jump actions
- Forward men, short-range kings, promotion-stop behavior, elimination wins, and blockade wins
- Choice among legal capture sequences without a maximum-capture requirement
- Deterministic threefold-repetition and eighty-ply no-progress draws
- Stable piece IDs, serializable repetition state, replay equivalence, and snapshot restoration
- Deterministic Checkers opponent and representative completed self-play
- Shared `GameDefinition`, `MatchSession`, observation, legal-action, event-history, and agent compatibility
- Normative rules and complete-turn action representation in [`planning/checkers-rules.md`](checkers-rules.md)

The frozen candidate passed GitHub-hosted Canonical Validation run #41 (`30500405772`) and was squash-merged as `53730a0ddf9bdc1f56dc641c7a4f226ecf61011b`. See [`planning/validation/2026-07-29-american-checkers-rules.md`](validation/2026-07-29-american-checkers-rules.md).

### GF-0007 — Checkers full-stack repository proof — Complete

American Checkers now exercises the shared GameFrame delivery stack rather than existing as a rules-only module.

Repository proof:

- Authoritative Checkers service with human, deterministic Theo, and provider-backed Theo participation
- Shared in-memory game dispatch with explicit `gameId` and backward-compatible Tic-Tac-Toe defaults
- Shared authenticated HTTP create, view, and action routes for both games
- Provider request correlation, revision, identity, legality, action-ID, and fallback behavior through the existing versioned contract
- Responsive multi-game browser shell preserving the validated Tic-Tac-Toe path
- Checkers piece selection, legal-destination highlighting, complete multi-jump path collection, forced-capture guidance, king presentation, match resume, and mobile behavior
- Two-browser human Checkers play and deterministic Theo browser play
- Multi-game Cloudflare Worker routing through the migration-stable Durable Object binding
- Real Workers-runtime Checkers persistence and legal-action recovery after Durable Object eviction
- Existing Tic-Tac-Toe, authentication, WebSocket, and browser regressions retained

The repository-side milestone is complete after the frozen PR #23 candidate passes canonical validation and merges. Standalone Cloudflare deployment and live Discord Activity canaries remain separately pending under `GF-0004`; they are not implied by this repository proof.

### GF-0008 — Scribbles Runtime adapter for Theo — Available when Runtime is ready

When Scribbles Runtime is available, implement the accepted versioned decision-provider contract so it can choose actions for stable player ID `theo`. The adapter is not a prerequisite for the completed mock-agent and Checkers repository proofs or for tactical and Monster Master repository development.

Retain deterministic fallback behavior and fail closed on malformed, stale, illegal, mismatched, or unauthorized Runtime responses.

### GF-0010 — Monster-master tactical battler foundation — Repository candidate — Active

Build the first substantial original GameFrame game now that the platform has survived browser acceptance, the mock-agent boundary, American Checkers, larger-field tactical movement, and deterministic tactical combat.

The pending external canary does not block repository development, but deployed tactical behavior must not be claimed until the relevant external lane is run and proven.

The production direction favors tactical-RPG-style maneuver over an immediately engaged tiny arena: small active forces move across a larger map with approach routes, objectives, terrain positions, camera panning, and room for scouting or repositioning. Compact boards remain supported for tests, tutorials, puzzles, quick matches, and RPG rooms.

Detailed sequencing, visual direction, generative-content boundaries, and acceptance criteria are recorded in [`planning/tactical-battler-rpg-foundation.md`](tactical-battler-rpg-foundation.md). The accepted larger-map direction is recorded in [`planning/decisions/0006-scrollable-tactical-battlefields.md`](decisions/0006-scrollable-tactical-battlefields.md).

Completed internal milestones:

- `TC-0001` — Complete: semantic map, weighted movement, viewport and camera, selection, legal paths, service, Canvas, replay, reconnect, and Workers recovery. See [`planning/validation/2026-07-30-tactical-canvas-canary.md`](validation/2026-07-30-tactical-canvas-canary.md).
- `TC-0002` — Complete: initiative, multi-action activations, line of sight, attacks, health, defeat, structured effects, victory, service, combat Canvas, player-specific projections, and Workers recovery. See [`planning/validation/2026-07-30-tactical-combat-stack.md`](validation/2026-07-30-tactical-combat-stack.md).

Current candidate:

- `MM-0001` — Repository-complete candidate: separate Monster Master rules, alternating deployment, stable three-unit rosters, deterministic initiative, movement, attacks, command energy, Warden `Mend`, defeat, Master victory, bounded draw, replay, deterministic Theo, shared HTTP dispatch, Durable Object persistence, authenticated invitations, dedicated Canvas client, mobile deployment, recovery journeys, and curated visual review.
- Normative rules: [`planning/monster-master-rules.md`](monster-master-rules.md).
- Repository evidence: [`planning/validation/2026-07-30-monster-master-first-playable.md`](validation/2026-07-30-monster-master-first-playable.md).

MM-0001 remains a candidate rather than a shipped game until:

- the final branch head passes exact-head Canonical Validation after all documentation and visual-review corrections;
- the owner completes a direct human gameplay and presentation review;
- the validated code is merged;
- relevant Cloudflare and Discord canaries prove hosted behavior; and
- balance, content quality, animation, sound, and final art receive later explicit decisions.

Later sequence:

- `MM-0002`: Theo and generic decision-provider tactical observation and legal-action integration beyond the deterministic fallback proof
- `MM-0003`: live Discord multiplayer canary using the validated GF-0004 identity and invitation boundary
- `MM-0004`: second-theme proof without tactical-rule changes

Monster Master, future RPG encounters, and D&D-style encounters may reuse map, encounter, replay, identity, storage, service, projection, and rendering infrastructure without sharing a single game definition, turn economy, action schema, or rules implementation.

Potential later scale variants may use larger battlefields, more units, squad entities, open-world maps, NPC interaction, or encounter transitions. Those possibilities should influence clean encounter and content boundaries but must not expand the first playable duel into a full campaign before the tactical loop is proven.

### GF-0011 — RPG encounter and campaign foundation

Wrap the tactical core with persistent party, exploration, inventory, quest, dialogue, and campaign state. Enter combat through a structured encounter configuration and return authoritative tactical outcomes to the campaign rather than reconstructing results from narration.

A future open-world layer may place NPCs, points of interest, dialogue, and encounter triggers on larger semantic maps. It should launch explicit encounter definitions rather than blending exploration narration and combat authority into one unbounded state machine.

After the encounter wrapper is proven, add a bounded Game Director hosted through Scribbles Runtime. The Director narrates, portrays nonplayer characters, and proposes permitted campaign operations; GameFrame remains the rules authority, and Theo remains a player without access to Director-only or hidden campaign information.

D&D-style encounters should be implemented as a separate rules definition or family of definitions. They may reuse the platform and tactical substrate while retaining their own initiative, actions, reactions, conditions, resources, character data, and licensing boundary.

### GF-0020 — Specialist chess module

Add chess rules, clocks, notation, Stockfish integration, strength profiles, explanation packets, and coaching workflows.

## Deferred

- Real-time command strategy simulation
- Public discovery, subscriptions, or monetization
- Native desktop or mobile clients
