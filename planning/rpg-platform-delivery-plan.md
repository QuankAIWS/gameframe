---
title: RPG Platform Delivery Plan
status: active
document_type: repository-plan
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime-integration
depends_on:
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
related:
  - shared/rpg-campaign-architect-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-cross-repository-integration-testing.md
  - tactical-battler-rpg-foundation.md
  - monster-master-rpg-encounter-rules.md
---

# RPG Platform Delivery Plan

## Authority

`shared/rpg-platform-roadmap.md` controls milestone order. This file defines how GameFrame should deliver that roadmap with the least process and architectural waste.

The product layering remains:

```text
CampaignPackage + RPG Ruleset + reusable game-family content
                         ↓
             GameFrame RPG Engine ←→ RPG GM Runtime
                         ↓
              persistent embodied campaign
```

The player-facing hierarchy remains:

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

Campaign combat never launches Battle Simulator.

## Delivery posture change

The semantic architecture is now strong enough to stop treating each lower-level subsystem as the main unit of progress.

Current completed foundations include:

- committed CampaignPackage v5 + WorldGraph/materialization intent;
- Entity Registry / Character Factory;
- Semantic Scene Registry;
- Observer Knowledge / People;
- viewer-authorized exploration projection;
- stable GameFrame materialization identity/reconnect contract;
- existing Pixi world/tactical renderer and terrain foundations;
- existing authenticated realtime and tactical primitives.

The active delivery objective is therefore one bounded player journey:

```text
SEE → MOVE → TALK → CHANGE/TRAVEL → FIGHT → PROVE
```

Every implementation slice should make a visible or behaviorally testable advance in that journey, or remove a demonstrated blocker to it.

## Reuse-first rule

Before creating a new engine/service/abstraction, inspect whether the existing GameFrame foundation already provides the required mechanism.

For the current RPG path:

- reuse the existing Pixi renderer;
- reuse terrain projection/material infrastructure;
- reuse realtime WebSocket/session infrastructure;
- reuse deterministic tactical primitives;
- reuse authenticated player/control infrastructure;
- reuse Runtime semantic authorities rather than creating GameFrame copies.

A new abstraction is justified when the vertical slice proves a missing capability, not merely because future campaigns may someday need one.

## Slice A — SEE: physical Crooked Checkpoint

Consume `campaign.exploration_projection` and materialize `scene.crooked-checkpoint`.

Minimum physical scene:

- road;
- checkpoint barrier;
- inspection shelter;
- maintenance shed;
- confiscation cart;
- drainage edge;
- westbound route anchor;
- player/Pell/object anchors;
- collision/picking/navigation sufficient for the scene;
- deterministic placeholder assets where needed.

Use the current semantic materialization intent and stable GameFrame materialization identity.

Do not solve unrestricted procedural generation here.

### Acceptance

The real Monster Master RPG route opens the materialized scene and refresh/reconnect returns the same accepted place.

## Slice B — MOVE: realtime exploration

Add only the physical/session state necessary for ordinary walking:

- player x/y/facing;
- camera;
- collision/navigation;
- scene-scoped realtime updates;
- position recovery/reconnect.

Frame-by-frame state stays in GameFrame. Runtime receives no movement stream.

### Acceptance

A browser player walks around Crooked Checkpoint, refreshes/reconnects, and resumes safely without semantic duplicate presence.

## Slice C — TALK: context custody through real interaction

Once the player can stand next to Pell, implement the Runtime Dungeon Master context modes against that actual interaction.

GameFrame provides:

- stable target selection;
- Talk/Interact UI;
- Ask Game Master UI/log;
- Do Something Else input;
- GM intervention/pause presentation.

Runtime provides perspective-correct context/decisions.

### Acceptance

Pell cannot use a hidden referee fact until Observer Knowledge legitimately grants it; Ask-GM remains a separate referee surface.

## Slice D — CHANGE/TRAVEL

Promote only concrete typed mechanics required by the chapter:

- object state/custody;
- knowledge reveal/correction;
- objective/event state;
- check request/result;
- relationship/memory consequence;
- semantic scene transfer.

Then connect West Woods with authoritative Runtime route/transfer semantics and GameFrame destination materialization.

### Acceptance

The player causes at least one persistent world change, travels to West Woods, returns, and sees the same persistent world state/materializations.

## Slice E — FIGHT

Reuse the existing tactical renderer and deterministic primitives on the current materialization.

Promote the Monster Master rules/control boundary needed for:

- Master/player-character participation;
- ruleset-authorized controlled monster set;
- initiative/action economy/legal actions;
- current positions as tactical starting positions;
- structured tactical outcomes;
- semantic consequence reconciliation;
- tactical → exploration return on the same physical scene.

### Acceptance

No replacement battlefield is loaded. Combat begins and ends on the current campaign scene and exploration continues immediately afterward.

## Slice F — PROVE

Stop adding architecture and complete the bounded chapter.

Required proof order:

1. human playthroughs with multiple plausible choices;
2. restart/reconnect testing;
3. deterministic/machine-play regression;
4. live provider proof;
5. deployed staging proof.

Only after this proof do two-human play, the second handcrafted Game Family, Campaign Architect, generated campaigns, dynamic Battle Packs, and split-party work become active product priorities.

## Development workflow

### 1. Start from a player acceptance statement

Each RPG PR begins with a concrete statement such as:

> Opening Monster Master RPG materializes Crooked Checkpoint from the authenticated S6 projection and reconnect reuses the same materialization.

Avoid opening a slice whose primary statement is only "add framework X" unless X is a proven blocker.

### 2. Inspect existing implementation before designing

Search the current GameFrame and Runtime implementations for reusable renderer, terrain, realtime, tactical, authority, and fixture mechanisms before adding a new subsystem.

### 3. Add the narrowest proof first

Prefer:

- one fixture;
- one deterministic contract test;
- one browser journey assertion;
- one focused integration seam;

over broad speculative test matrices.

### 4. Keep PRs vertical but bounded

A good PR may cross several files/layers if they are all required to complete one player-visible step.

Do not split one coherent player feature into artificial repository-layer PRs unless authority/merge ordering requires it.

### 5. Cross-repository ordering

When a shared contract must change:

```text
GameFrame canonical contract/fixture branch
→ focused GameFrame validation
→ Runtime branch tested against intended GameFrame branch
→ merge GameFrame canonical change
→ exact Runtime mirror sync
→ Runtime tests against GameFrame main
→ merge Runtime
```

When no shared contract changes, do not create coordinated cross-repo PRs merely for ceremony.

### 6. Documentation policy

Update local status/roadmap text in the implementation PR whenever the evidence boundary changes.

Use a separate docs-only reconciliation PR only when:

- canonical/shared architecture changes materially;
- several implementation slices have accumulated meaningful roadmap drift;
- an audit requires a deliberate documentation correction.

Do not automatically create a second docs PR after every implementation PR.

### 7. CI policy

During iteration, run the smallest trustworthy lane first:

- affected deterministic/unit/contract tests;
- browser syntax or focused Playwright journey when UI changes;
- materialization/geometry tests when physical scene logic changes;
- context custody tests when Runtime model context changes;
- tactical deterministic tests when combat rules change.

Before merge, run only the broader gates justified by the claim:

- GameFrame core/active-product gate for GameFrame behavior;
- Runtime Fast Check for Runtime behavior;
- shared fixture/document drift when shared contracts changed;
- current GameFrame integration when the Runtime↔GameFrame seam changed;
- durable two-service recovery when persistence/recovery semantics changed.

Do not spend CI on unrelated broad matrices for documentation-only or narrowly isolated changes.

### 8. PR completion rule

A PR is complete when:

- its player acceptance statement is proven;
- authority boundaries remain explicit;
- focused tests are green;
- required integration gates are green;
- review findings are resolved;
- affected local docs reflect the actual evidence.

Merge it. Do not add adjacent "while we're here" architecture unless it is required by the same acceptance statement.

## Deferred while the first playable loop is incomplete

Do not prioritize:

- Campaign Architect;
- dynamic generated RPG discovery;
- dynamic Battle Pack generation;
- Battle Simulator expansion beyond blocker/regression work;
- generalized procedural-world generation;
- generalized RPG DSLs;
- giant final-art production;
- elaborate NPC autonomy/memory beyond chapter needs;
- split-party concurrency;
- Cloudflare-native semantic-state migration;
- Theo integration;
- deeper legacy separate-match campaign UX.

## Validation posture

Use evidence matching the claim:

- semantic contracts: deterministic unit/fixture tests;
- physical scene: materialization/geometry tests + browser acceptance;
- movement: realtime/session/reconnect browser tests;
- NPC/GM correctness: deterministic context-custody/machine-play tests;
- world change/transfer: Runtime semantic tests + cross-repo integration + browser journey;
- tactical mode: deterministic rules tests + same-map browser transition;
- full chapter: human play + machine-play + live provider + staging.

A screenshot is supporting visual evidence, not state correctness.

## Immediate GameFrame execution order

1. SEE — Crooked Checkpoint materialization.
2. MOVE — walking/collision/camera/reconnect.
3. TALK — Pell interaction + Runtime context custody + Ask-GM + Do Something Else.
4. CHANGE/TRAVEL — concrete world operations + West Woods round trip.
5. FIGHT — Monster Master control/rules boundary + same-map Tactical Activation.
6. PROVE — complete single-player chapter, restart/resume, live provider, staging.
7. two-human one-scene.
8. second handcrafted Game Family.
9. Campaign Architect + dynamic Role-Playing Games + Battle Pack authoring.
10. dynamic Battle Simulator convergence.
11. split-party later.

## Governing rule

> Deliver the game by completing the next player action, not by maximizing the number of generic systems. Reuse GameFrame's existing physical/tactical machinery, keep Runtime semantic, and let the first playable Monster Master chapter tell us which abstractions are actually necessary.
