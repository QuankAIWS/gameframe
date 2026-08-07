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

The separate `rpg-gm-runtime` project owns the Dungeon Master, campaign narration, encounter intent, campaign state, and post-encounter continuation. GameFrame owns tactical legality, authoritative battle state, and structured outcomes.

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
- responsive browser and Canvas game surfaces;
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

### Monster Master RPG encounter loop

The current feature branch proves this Node-local lifecycle:

```text
Dungeon Master encounter scene
→ GameFrame creates one bound Arena battle
→ player resolves the tactical encounter
→ GameFrame commits a structured terminal outcome
→ rpg-gm-runtime publishes the aftermath
→ player returns to the campaign shell
```

The temporary enemy seat uses Monster Master BattleBot. It is not Theo and it is not the Dungeon Master.

The first adapter supports one human campaign player and fails closed for cooperative rosters until Arena Battles gains a team-aware multiplayer control model. Durable deployed wiring through Cloudflare, Durable Objects, and the SQLite-backed RPG service is a separate productionization slice.

## Decision-provider boundary

GameFrame has a versioned structured decision-provider protocol containing game, match, player, revision, deadline, observation, and legal-action context. Provider output remains untrusted: GameFrame validates correlation, identity, revision, response shape, action IDs, duplication, and current legality before committing an action.

This protocol may later be used by named external agents, including Theo, without changing GameFrame authority. It does not make the built-in deterministic bots into those agents.

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

Repository proofs do not by themselves establish production deployment. The following remain separate until actually exercised:

- deployed Cloudflare Worker and Durable Object behavior;
- real Discord website OAuth and Activity launch;
- public-network authenticated multiplayer and reconnect behavior;
- remote decision-provider transport and authentication;
- live Scribbles Runtime connector behavior for Theo;
- durable production RPG service integration and restart recovery;
- production observability, quota, backup, and incident behavior.

Validation claims are exact-head only. The active pull request and durable validation records identify completed GitHub Actions runs; any later commit invalidates an earlier pass.

## Ownership and licensing

This repository is publicly viewable proprietary software. Copyright remains with the applicable owner, and all rights are reserved. No open-source license is granted. See `NOTICE`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, and `SECURITY.md`.