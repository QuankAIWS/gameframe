# Scribbles GameFrame

Scribbles GameFrame is the deterministic multiplayer game platform for the Scribbles architecture. It owns game sessions, legal-action validation, event history, player observations, browser delivery, and the integration boundaries for Discord Activities and Scribbles Runtime. Individual games remain explicit modules rather than being forced into one generalized rules engine.

Theo is the public-facing Scribbles agent and the first registered nonhuman GameFrame player. The platform proof now includes complete Tic-Tac-Toe and American Checkers paths, a versioned decision-provider contract, a larger-field tactical map and movement client, a complete deterministic tactical combat stack, production-shaped Cloudflare/Discord identity and multiplayer boundaries, and the first playable Monster Master duel.

## Current status

Implemented in the validated platform proofs:

- Generic deterministic game-definition contract
- Authoritative revisioned match sessions
- Idempotent action submission and stale-write rejection
- Replayable event history and restorable snapshots
- Configured encounter initial-state persistence and replay
- Server-derived request principals and spoof-resistant seat authorization
- Real Discord website OAuth and verified user lookup
- Official Discord Embedded App SDK authorize/authenticate client handshake
- Signed, expiring website and partitioned Discord Activity sessions
- Fail-closed Discord staging allowlist
- Signed authenticated human-match invitations and serialized second-seat claims
- Storage-neutral asynchronous match services
- In-memory development storage and Durable Object storage adapters
- Shared multi-game HTTP create, view, action, invitation, and projection boundaries
- Explicit `gameId` dispatch with backward-compatible Tic-Tac-Toe defaults
- Cloudflare Worker and migration-stable Durable Object routing
- HTTP polling fallback and WebSocket projection reconnect behavior
- Responsive browser and tactical Canvas surfaces
- Real Playwright browser acceptance through the ordinary application boundary
- Risk-based browser journey ledger covering current controls and outstanding states
- Deliberate 23-file curated visual-review artifacts
- Four canonical Ubuntu/Chromium visual baselines for stable shell states
- Real Workers-runtime persistence, eviction, competing-write, hibernating-WebSocket, authentication, Activity, invitation, and Monster Master tests

Tic-Tac-Toe proof:

- Human-versus-human and human-versus-Theo match creation
- Perfect deterministic Theo fallback opponent
- Persistent development-browser seats and URL-based match resume
- Shareable synthetic second-player links restricted to trusted local development
- Authenticated hosted second-seat claims without URL player identity
- Responsive desktop and mobile interaction

American Checkers proof:

- American Checkers rules, mandatory captures, complete multi-jumps, promotion, kings, blockade wins, and deterministic draws
- Stable piece IDs and complete-turn action paths
- Deterministic Checkers opponent and completed self-play
- Authoritative human, deterministic Theo, and provider-backed Theo service flows
- Piece selection, legal-destination highlighting, forced-capture guidance, multi-jump path collection, king rendering, resume, and mobile browser behavior
- Two-browser human Checkers matches
- Checkers state and legal-action recovery after real Durable Object eviction

Tactical foundation proof:

- Semantic 24×24 map larger than the ordinary viewport
- Weighted deterministic pathfinding, occupancy, complete path actions, and replay
- Client-only pan, bounded zoom, centering, selection, and path previews
- Four-unit tactical combat with vanguards and rangers
- Deterministic initiative and multi-action activations
- Movement, row/column/diagonal line of sight, attacks, damage, defeat, structured effects, victory, and bounded draws
- Human, deterministic Theo, and provider-compatible combat service flows
- Dedicated movement and combat Canvas clients with health, initiative, legal targets, resume, invites, and mobile controls
- Tactical movement and combat recovery after real Durable Object eviction

Monster Master MM-0001 candidate:

- Separate `monster-master-duel` game definition over the shared tactical substrate
- Alternating left/right deployment zones for one Warden Master, one Stone Bulwark, and one Emberling per player
- Stable content IDs, health, movement, initiative, attack range, attack damage, and deterministic activation order
- Movement, line of sight, attacks, health, defeat, immediate Master-defeat victory, and bounded round-cap draws
- Visible command energy with bounded regeneration
- Warden Master `Mend`, proving friendly targeting, resource expenditure, healing, and non-generic primary actions
- Deterministic Theo deployment and combat decisions with complete bounded self-play
- Replay, configured encounter restoration, in-memory HTTP service, Durable Object persistence, and player-specific observations
- Dedicated `/monster-master.html` Canvas surface with deployment, movement, attacks, Mend, roster, effects, camera controls, resume, mobile deployment, and local or signed hosted invitations
- Browser journeys for attack, Mend, defeat, victory, draw, command regeneration, stale-revision recovery, unauthorized access, wrong-game resume, failed creation, navigation, diagnostics, and setup reset
- Curated desktop, mobile, deployment, combat activation, and movement-option review states

Agent-provider proof:

- Version-1 decision request and response protocol
- Provider-side correlation, identity, revision, legality, action-ID, duplicate, timeout, and malformed-response validation
- Deterministic, scripted, seeded-random, delayed, unavailable, malformed, illegal, duplicate, stale, and mismatched mock-provider modes
- Canonical JSON fixtures for independent Scribbles Runtime compatibility work

Secure delivery proof:

- HMAC-signed, browser-bound Discord OAuth transactions
- Stable `discord:<user-id>` GameFrame identities
- Host-only website sessions and partitioned Activity sessions
- Official SDK bundle pinned, committed, and rebuilt byte-for-byte during validation
- SDK user and signed GameFrame principal identity correlation
- Signed expiring invitations that authorize a claim but never establish identity
- Atomic Durable Object second-seat claims and idempotent match initialization recovery
- Discord direct human-seat spoofing rejection
- Authenticated inviter and recipient browser flows

Browser quality proof:

- A durable journey matrix inventories every current player-facing control and security-sensitive transition
- Forty-three Playwright interaction journeys cover game navigation, diagnostics, setup reset, camera controls, logout, clipboard, invitation cancellation, multiplayer, resume, mobile layout, authoritative Monster Master outcomes, and failure recovery
- A deliberate label-triggered visual-review lane captures 23 synthetic desktop, mobile, game, tactical, authentication, invitation, and Monster Master screenshots with seven-day retention
- Four stable shell compositions are protected by canonical screenshot comparison
- Dynamic Canvas and match states remain in curated review rather than brittle pixel baselines
- Screenshot review corrected tactical badge overlap, unbounded legal-action lists, Checkers capture timing, Monster Master phase guidance, asynchronous capture timing, and globally duplicated capture IDs

The active repository candidate is MM-0001: the first playable Monster Master duel in the monster-master tactical battler foundation. Repository validation and curated rendering are separate from owner-controlled Cloudflare deployment, live Discord website/Activity canaries, and subjective gameplay review. Those external and human results are not claimed here.

## Canonical checkpoints

- Initial repository baseline validated and merged on July 27, 2026
- Complete Tic-Tac-Toe browser proof validated and merged on July 29, 2026
- Versioned agent decision contract and durable mock provider validated and merged on July 29, 2026
- American Checkers rules module validated and merged on July 29, 2026
- American Checkers full-stack repository proof validated and merged on July 30, 2026
- TC-0001 tactical map, movement, Canvas, and Workers proof validated and merged on July 30, 2026
- TC-0002 deterministic tactical combat stack validated and merged on July 30, 2026
- Production Discord website identity and session boundary validated and merged on July 30, 2026
- Official Discord Activity SDK client handshake validated and merged on July 30, 2026
- Authenticated human-match invitation boundary validated and merged on July 30, 2026
- Browser journey, curated visual review, and stable visual baselines validated and merged on July 30, 2026
- MM-0001 first-playable repository candidate validated on its feature branch on July 30, 2026; merge and live canaries remain pending

Durable evidence:

- `planning/validation/2026-07-27-canonical-baseline.md`
- `planning/validation/2026-07-29-tic-tac-toe-browser-proof.md`
- `planning/validation/2026-07-29-agent-decision-contract.md`
- `planning/validation/2026-07-29-american-checkers-rules.md`
- `planning/validation/2026-07-30-american-checkers-full-stack.md`
- `planning/validation/2026-07-30-tactical-canvas-canary.md`
- `planning/validation/2026-07-30-tactical-combat-stack.md`
- `planning/validation/2026-07-30-discord-authentication-boundary.md`
- `planning/validation/2026-07-30-discord-activity-client.md`
- `planning/validation/2026-07-30-authenticated-match-invitations.md`
- `planning/validation/2026-07-30-browser-journey-visual-hardening.md`
- `planning/validation/2026-07-30-monster-master-first-playable.md`

Not yet claimed:

- Standalone deployed Cloudflare Worker validation
- OAuth by a real Discord user against the deployed callback
- Launch through a real Discord Activity desktop or mobile client
- Public-network authenticated human multiplayer and WebSocket recovery
- Remote decision-provider network transport and authentication
- Live Scribbles Runtime integration controlling Theo
- Production recovery, quota, observability, and durability behavior
- Final Monster Master rules, content, balance, animation, sound, or art
- Open-world campaign behavior or D&D rules

## Run locally

Requires Node.js 22.16.0 or newer.

```bash
npm ci
npx playwright install chromium
npm test
npm run test:workerd
npm run test:browser
npm run test:visual
npm run test:visual-baseline
npm run validate
npm run dev
```

Open these development surfaces after starting the server:

- `http://127.0.0.1:8787/` — Tic-Tac-Toe and American Checkers
- `http://127.0.0.1:8787/tactical.html` — larger-field movement canary
- `http://127.0.0.1:8787/combat.html` — deterministic tactical combat canary
- `http://127.0.0.1:8787/monster-master.html` — first playable Monster Master duel

## Repository map

```text
src/platform/                 shared game and match contracts
src/games/tic-tac-toe/       compact deterministic delivery proof
src/games/checkers/           American Checkers rules and deterministic opponent
src/games/tactical-core/      semantic map, movement, and viewport-neutral contracts
src/games/tactical-combat/    initiative, line of sight, combat, effects, and agents
src/games/monster-master/     deployment, rosters, command energy, Mend, duel rules, and agents
src/auth/                     principals, sessions, Discord OAuth/Activity, and invitations
src/browser/                  browser integration and durable journey/visual contracts
src/agents/                   versioned decision contracts, mocks, and agent implementations
src/server/                   authoritative multi-game services and local HTTP host
src/scripts/                  repository self-checks
public/                       responsive game, auth, invitation, and tactical Canvas clients
test/browser/                 real Playwright interaction journeys
test/visual/                  curated screenshot review states
test/visual-baseline/         narrow committed visual regression baselines
test/fixtures/                cross-repository compatibility fixtures
test/workerd/                 real multi-game Workers-runtime integration tests
planning/                     architecture, deployment, roadmap, rules, contracts, journeys, and validation doctrine
src/cloudflare/               Worker, Durable Objects, invitations, storage, and projection adapters
```

## Ownership and licensing

This repository is publicly viewable proprietary software. Copyright remains with the applicable copyright owner, and all rights are reserved.

No open-source license is granted. The absence of a `LICENSE` file is intentional. Viewing, cloning, or forking the repository through GitHub does not grant permission to reuse, modify, redistribute, sell, deploy, or create derivative works from the code except as required for GitHub's own repository functionality or with prior written authorization.

See `NOTICE` for the controlling repository notice, `THIRD_PARTY_NOTICES.md` for independently licensed dependencies, and `CONTRIBUTING.md` for the current external-contribution policy.

## Security and deployment data

The public repository must not contain production credentials, private keys, access tokens, cookies, private user or campaign data, incident records, or secret-bearing environment files. Deployment secrets belong in GitHub, Cloudflare, or equivalent secret stores and are supplied through environment bindings.

Security vulnerabilities should be reported through the private process in `SECURITY.md`, not through a public issue containing exploit details.

## Repository relationship

Scribbles GameFrame and Scribbles Runtime are peer systems. GameFrame remains independently testable with deterministic or mock participants. Scribbles Runtime integrates through the explicit versioned decision-provider contract and acts on behalf of Theo; it does not become the game authority or the player identity.

Monster Master, future RPG encounters, and D&D-style encounters may reuse map, encounter, replay, service, storage, projection, identity, invitation, browser-journey, visual-review, and rendering infrastructure while retaining separate game definitions, turn structures, action economies, content models, and rules.

See `AGENTS.md` before consequential development work.
