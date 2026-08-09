# Scribbles GameFrame

Scribbles GameFrame is a deterministic multiplayer game platform and the player-facing host for the embodied RPG system. It owns authoritative game sessions, legal-action validation, player-specific observations, browser delivery, deterministic mechanics, physical RPG materialization/control state, and tactical outcomes.

GameFrame is independently usable and testable. It does not require Scribbles Runtime or Theo.

## Identities and external systems

### GameFrameBot

GameFrame's built-in deterministic opponents are rules-based bots, not model-driven AI. Player-facing labels include CPU Opponent, CheckersBot, ArenaBot, and Monster Master BattleBot where appropriate.

### Dungeon Master

The separate private `rpg-gm-runtime` service owns the Dungeon Master, committed CampaignPackage/WorldGraph truth, semantic campaign journal, Entity/Scene/Observer Knowledge authority, hidden truth, semantic consequences, and live context/orchestration.

GameFrame owns the playable world: materialization, x/y/facing, collision/pathing/camera/picking/interaction range, deterministic rules/control authorization, tactical state, and player-facing rendering/history presentation.

### Theo

Theo is a separate agent hosted by Scribbles Runtime. Theo is not GameFrameBot, the Dungeon Master, a default opponent, or a required GameFrame dependency.

## Player-facing Games hierarchy

```text
Games
├── Role-Playing Games
│   └── Monster Master RPG / future campaigns
├── Battle Simulator
│   └── Monster Master Arena Battles / future Battle Packs
├── Clockwork Checkers
├── Othello
└── Tic-Tac-Toe
```

**GameFrame RPG Engine** is internal architecture terminology. Campaign combat never launches Battle Simulator; it will use same-map Tactical Activation.

## Implemented platform foundation

The repository contains transport-neutral deterministic game definitions, revisioned authoritative sessions, idempotent action handling, replayable history/snapshots, server-derived identity/seat authorization, Cloudflare Worker/Durable Object adapters, Discord/session boundaries, authenticated invitations, responsive browser/Pixi surfaces, and automated browser/Workers/visual review coverage.

## Game proofs

### Tic-Tac-Toe / American Checkers / tactical foundation

GameFrame includes deterministic standalone proofs for ordinary board games and tactical movement/combat, including human/bot and human/human flows, persistence/recovery, browser controls, and player-specific observations.

### Monster Master Arena Battles

Monster Master Arena Battles remains standalone tactical/regression substrate inside Battle Simulator. It is not the campaign combat lifecycle.

### Monster Master RPG — current deployed proof

The production-shaped RPG path is split across public GameFrame and private RPG GM Runtime.

Current staging evidence proves:

- Discord-authenticated Monster Master RPG launch;
- CampaignPackage v5 staging campaign;
- viewer-safe Crooked Checkpoint semantic bootstrap;
- deterministic Crooked Checkpoint Pixi materialization;
- desktop WASD movement;
- mobile touch D-pad/rotation controls;
- collision, camera rotation/follow, and GameFrame-owned durable x/y/facing recovery;
- refresh/restart to the same materialization/valid position;
- viewer-safe initial identity where Pell is known and the checkpoint official is not named before the player learns that name;
- a visible/projected West Woods route mouth.

Current player-journey status:

```text
SEE      ✅
MOVE     ✅
MOBILE   ✅
TALK     ← ACTIVE
CHANGE
TRAVEL
FIGHT
PROVE
```

The West Woods route is not yet a functional scene transfer. Direct NPC/object interaction is not yet implemented. Same-map campaign tactical mode is not yet implemented.

## RPG interaction model

The world is the intended primary game surface.

- **Interact/Talk** targets a present entity/object/route.
- **Do Something Else** remains a first-class arbitrary plausible in-fiction action surface.
- **Ask Game Master** is separate out-of-fiction referee/knowledge communication.
- **Campaign Chronicle** is the intended evolution of the current campaign feed: meaningful observer-authorized narration, heard dialogue, discoveries, consequential actions, mechanic outcomes, world changes, travel, and relevant GM interventions/rulings.

The chronicle should not become a tiny combat log, but it also should not remain the primary controller once the world supports the player's ordinary actions.

One committed event may render in multiple ways—for example temporary in-world speech plus later history—without becoming multiple sources of truth.

## Freeform intent boundary

Player/model prose does not create authoritative state.

```text
"I release Cinder from her cube."
→ interpret deploy intent
→ validate ownership/rules/current state
→ commit accepted semantic + physical change
→ render Cinder
→ narrate/log the accepted result
```

The player has broad authority to **attempt** plausible actions, not authority to declare them successful.

## Transport invariant

**HTTP owns every GameFrame RPG command/mutation, including exploration movement. WebSockets are projection/notification-only and reconstructable from durable state.**

Per-step movement never enters RPG GM Runtime.

## Same-map tactical direction

When initiative is required:

```text
current materialized campaign scene
→ Tactical Activation
→ same positions/entities/objects/terrain/exits under turn-based authority
→ deterministic tactical result
→ semantic reconciliation
→ same scene resumes exploration
```

No campaign Arena handoff or Return-to-Campaign screen.

## RPG planning and authority

Canonical public/shared RPG contracts live under `planning/` and declared shared documents are mirrored byte-for-byte into the private RPG GM Runtime.

Start with:

- `planning/rpg-documentation-index.md`;
- `planning/shared/rpg-platform-product-goals.md`;
- `planning/shared/rpg-agent-architecture-and-campaign-package.md`;
- `planning/shared/rpg-scene-entity-and-knowledge-contract.md`;
- `planning/shared/rpg-embodied-exploration-and-character-performance-contract.md`;
- `planning/shared/rpg-platform-roadmap.md`;
- `planning/ROADMAP.md`;
- `planning/monster-master-rpg-canonical-baseline.md`;
- `planning/monster-master-rpg-current-creative-direction.md`.

## Run locally

Requires Node.js 22.16.0 or newer.

```bash
npm ci
npx playwright install chromium
npm test
npm run test:workerd
npm run test:browser
npm run validate
npm run dev
```

Useful local surfaces:

- `/` — Games hub;
- `/monster-master.html` — Monster Master Arena Battles;
- `/monster-master-rpg.html` — Monster Master RPG;
- `/gameframe-rpg.html` — Role-Playing Games launcher;
- `/battle-simulator.html` — Battle Simulator launcher.

## Repository map

```text
src/platform/     shared game/session contracts
src/games/        game-specific rules/state/bots
src/agents/       structured decision-provider boundary
src/auth/         principals/sessions/Discord/invitations
src/rpg/          GameFrame RPG materialization/movement/mechanics adapters
src/server/       authoritative Node services
src/cloudflare/   Worker/Durable Objects/edge proxy
src/browser/      browser integration contracts
public/           browser clients/presentation
test/             browser/workerd/fixtures
planning/         architecture/roadmap/contracts/decisions
```

## Deployment status

A working VM-first staging topology exists: Cloudflare exposes player-facing GameFrame while GameFrame RPG and RPG GM Runtime stay on loopback/private VM boundaries. Deployment/reset/recovery canaries remain separate evidence from repository tests.

The active product priority is TALK → CHANGE → TRAVEL → FIGHT → PROVE, not further infrastructure expansion unless a demonstrated blocker requires it.

## Ownership and licensing

This repository is publicly viewable proprietary software. Copyright remains with the applicable owner, and all rights are reserved. No open-source license is granted. See `NOTICE`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, and `SECURITY.md`.
