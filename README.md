# Scribbles GameFrame

Scribbles GameFrame is a deterministic multiplayer game platform. It owns authoritative game sessions, legal-action validation, event history, player-specific observations, browser delivery, Discord delivery boundaries, and tactical match outcomes. Individual games remain explicit modules rather than being forced into one generalized rules engine.

GameFrame is independently usable and testable. It does not require Scribbles Runtime or Theo.

## Identities and external systems

### GameFrameBot

GameFrame's built-in deterministic opponent uses the stable player ID `gameframe-bot` and the generic name **GameFrameBot**.

Player-facing game-specific labels may include:

- **CPU Opponent** for Tic-Tac-Toe
- **CheckersBot** for American Checkers
- **ArenaBot** for the tactical combat canary
- **Monster Master BattleBot** for Monster Master

These are rules-based deterministic bots used for local play, testing, demonstrations, self-play, and fallback behavior. They are not presented as model-driven AI.

### Dungeon Master

The separate `rpg-gm-runtime` project owns the Dungeon Master, committed CampaignPackage truth, durable campaign journal, entity/scene/player-knowledge authority, encounter intent, campaign consequences, and post-encounter continuation. GameFrame owns authenticated player presentation, tactical legality, authoritative battle state, and structured outcomes.

### Theo and Scribbles Runtime

Theo is a separate agent hosted by the separate Scribbles Runtime project. A future connector may allow Scribbles Runtime to submit legal GameFrame actions for Theo after Theo is explicitly assigned an ordinary player seat.

Theo is not GameFrameBot, a deterministic fallback, the Dungeon Master, a default opponent, or a required GameFrame dependency.

## Implemented platform foundation

The repository contains:

- transport-neutral deterministic game definitions;
- revisioned authoritative match sessions;
- idempotent action submission and stale-write rejection;
- replayable event history and restorable snapshots;
- server-derived player identity and seat authorization;
- in-memory development storage and Durable Object storage adapters;
- shared multi-game HTTP create, view, action, invitation, and projection boundaries;
- Cloudflare Worker and migration-stable Durable Object routing;
- HTTP polling fallback and WebSocket projection reconnect behavior;
- signed Discord website and Activity session boundaries;
- signed authenticated human-match invitations;
- responsive browser and Canvas/Pixi game surfaces;
- Playwright interaction coverage, Workers-runtime coverage, and curated visual-review infrastructure.

## Game proofs

### Tic-Tac-Toe

- Human-versus-human and human-versus-CPU-Opponent matches
- Perfect deterministic GameFrameBot policy
- Persistent development-browser seats and resumable match URLs
- Shared authoritative service and browser path

### American Checkers

- Mandatory captures, complete multi-jumps, promotion, kings, blockade wins, and deterministic draws
- Stable piece IDs and complete-turn actions
- Human-versus-human and human-versus-CheckersBot matches
- Deterministic self-play and provider-compatible decision boundaries
- Durable Object recovery and browser interaction coverage

### Tactical foundation

- Semantic 24×24 map larger than the ordinary viewport
- Weighted movement, occupancy, replay, camera pan, zoom, centering, and path previews
- Deterministic four-unit combat with initiative, movement, line of sight, attacks, damage, defeat, effects, victory, and bounded draws
- Human-versus-ArenaBot and human-versus-human flows
- Durable Object recovery and Canvas browser coverage

### Monster Master Arena Battles

- Separate `monster-master-duel` game definition
- Alternating deployment for two three-unit teams
- Stable content IDs, deterministic initiative, movement, line of sight, attacks, health, defeat, Master victory, and bounded draws
- Command energy and the Warden Master `Mend` ability
- Human-versus-Monster-Master-BattleBot and human-versus-human flows
- Replay, configured encounter restoration, in-memory HTTP service, Durable Object persistence, and player-specific observations
- Dedicated `/monster-master.html` Pixi/Canvas surface with deployment, actions, camera controls, resume, invitations, and outcome states

### Monster Master RPG foundation

The current production-shaped RPG path is split across GameFrame and the private RPG GM Runtime service.

GameFrame currently provides, among other things:

- the Monster Master RPG browser shell;
- Discord-authenticated staging/player entry;
- campaign onboarding/profile/objective presentation;
- durable RPG command/projection transport with HTTP recovery and VM-backed WebSocket projection delivery;
- durable encounter↔match binding;
- exact participant→creature mapping for the current bounded configured Monster Master RPG profile;
- campaign-aware Arena return presentation;
- staging/admin/reset integration surfaces.

RPG GM Runtime owns the private package/journal/Dungeon Master side and automatic encounter continuation/aftermath.

The current configured tactical profile remains intentionally narrow: supported creature profiles, equal creature counts, compact-duel layout, defeat-opposition objective, and trainers as controllers rather than tactical units. This is **not** the final Monster Master RPG encounter contract.

Current architecture work is explicitly expanding toward:

- durable Entity Registry and Character Factory;
- authoritative scene membership;
- viewer-specific People/identity knowledge;
- Act/Speak versus Ask-GM;
- player-safe rendering separated from hidden Dungeon Master decisions;
- scene-derived tactical requests with exact source-scene provenance;
- withdrawal/escape and asymmetric campaign encounters;
- trainer/support/noncombatant roles only as deterministic GameFrame capabilities are implemented.

A browser return link or terminal Arena result does not by itself prove that campaign aftermath was consumed. Campaign narrative input must remain fenced until RPG GM Runtime has reconciled the outcome and GameFrame receives a later authoritative resumable campaign projection.

## Decision-provider boundary

GameFrame has a versioned structured decision-provider protocol containing game, match, player, revision, deadline, observation, and legal-action context. Provider output remains untrusted: GameFrame validates correlation, identity, revision, response shape, action IDs, duplication, and current legality before committing an action.

This protocol may later be used by named external agents, including Theo, without changing GameFrame authority. It does not make the built-in deterministic bots into those agents.

## RPG planning and authority

Canonical public/shared RPG contracts live under `planning/` and are mirrored byte-for-byte into the private RPG GM Runtime where declared by the shared manifest.

Start with:

- `planning/rpg-documentation-index.md`;
- `planning/shared/rpg-platform-product-goals.md`;
- `planning/shared/rpg-agent-architecture-and-campaign-package.md`;
- `planning/shared/rpg-scene-entity-and-knowledge-contract.md`;
- `planning/shared/rpg-platform-roadmap.md`;
- `planning/monster-master-rpg-canonical-baseline.md`;
- `planning/monster-master-rpg-encounter-rules.md`.

The fixed standalone MM-0001 duel and the evolving Monster Master RPG encounter contract are deliberately separate.

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

Development surfaces:

- `http://127.0.0.1:8787/` — Tic-Tac-Toe and American Checkers
- `http://127.0.0.1:8787/tactical.html` — movement canary
- `http://127.0.0.1:8787/combat.html` — tactical combat canary
- `http://127.0.0.1:8787/monster-master.html` — Monster Master Arena Battles
- `http://127.0.0.1:8787/monster-master-rpg.html` — Monster Master RPG campaign shell

## Repository map

```text
src/platform/                 shared game and match contracts
src/games/                    game-specific rules, state, observations, and bot policies
src/agents/                   decision protocol, providers, and GameFrameBot identity
src/auth/                     principals, sessions, Discord OAuth/Activity, and invitations
src/rpg/                      GameFrame-side RPG service and encounter adapters
src/server/                   authoritative Node services and HTTP host
src/cloudflare/               Worker, Durable Objects, storage, and projection adapters
src/browser/                  browser integration contracts
public/                       browser clients and tactical presentation
test/browser/                 Playwright interaction journeys
test/workerd/                 Workers-runtime integration tests
test/fixtures/                structured cross-repository fixtures
planning/                     architecture, roadmap, decisions, contracts, and validation records
```

## Deployment status

A working VM-first staging topology now exists for the RPG development path: Cloudflare exposes player-facing GameFrame routes while the private GameFrame RPG service and RPG GM Runtime remain on loopback/private VM boundaries. Deployment/restart/reset and authenticated staging canaries remain separate evidence from repository tests.

Do not infer a production-quality campaign from infrastructure alone. Current product evidence still requires separate proof for:

- durable entity/scene/player-knowledge continuity;
- hidden-name/player-safe rendering;
- complete Act/Speak versus Ask-GM interaction semantics;
- scene-faithful campaign Arena materialization;
- authoritative Arena aftermath and campaign unlock;
- complete single-player campaign resolution/restart;
- later multiplayer acceptance;
- backup/restore and incident posture;
- optional media-provider and Cloudflare-native migration behavior.

Validation claims are exact-head only. A later commit requires corresponding evidence before its behavior is described as proven.

## Ownership and licensing

This repository is publicly viewable proprietary software. Copyright remains with the applicable owner, and all rights are reserved. No open-source license is granted. See `NOTICE`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, and `SECURITY.md`.
