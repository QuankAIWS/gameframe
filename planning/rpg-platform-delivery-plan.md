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

```text
CampaignPackage + RPG Ruleset + reusable game-family content
                         ↓
             GameFrame RPG Engine ←→ RPG GM Runtime
                         ↓
              persistent embodied campaign
```

Player-facing hierarchy:

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

## Delivery posture

The active delivery objective is one bounded player journey:

```text
SEE → MOVE → TALK → CHANGE/TRAVEL → FIGHT → PROVE
```

Every implementation slice should make a visible or behaviorally testable advance in that journey, or remove a demonstrated blocker to it.

## Reuse-first rule

For the current RPG path:

- reuse the existing Pixi renderer;
- reuse terrain projection/material infrastructure;
- reuse realtime WebSocket/session infrastructure;
- reuse deterministic tactical primitives;
- reuse authenticated player/control infrastructure;
- reuse Runtime semantic authorities rather than creating GameFrame copies.

A new abstraction is justified when the vertical slice proves a missing capability, not merely because future campaigns may someday need one.

## Slice A — SEE: physical Crooked Checkpoint — bounded implementation complete

The real path now is:

```text
authenticated browser player
→ GameFrame /api/rpg/campaigns/:id/exploration/attach
→ GameFrame private bearer Runtime transport
→ Runtime S6 campaign.exploration_projection
→ GameFrame strict projection normalization
→ deterministic Crooked Checkpoint semantic-layout materializer
→ existing Monster Master Pixi terrain/world renderer
```

### Implemented

- the browser never supplies `authenticatedPlayerId` or an entity/viewer override;
- GameFrame derives the Runtime viewer from its authenticated principal;
- the private Runtime transport validates returned campaign/viewer identity;
- the materializer supports the current package-v5 `scene.crooked-checkpoint` + `mm.materialization.crooked-checkpoint.v1` intent only;
- the physical scene is a deterministic 18×14 layout with road, barrier, inspection edge, maintenance-shed mass, drainage edge, and westbound route mouth;
- safe player/Pell/object/route anchors are placed over the physical scene using stable semantic/interaction IDs;
- materialization identity uses the existing viewer-independent `rpg-scene:<campaignId>:<sceneId>` contract;
- safe label/knowledge/route changes do not change physical geometry identity;
- the existing Monster Master Pixi renderer/terrain assets draw the exploration world without a new renderer;
- exploration publishes no tactical legal actions;
- the narrative campaign console remains available beneath the world;
- refresh reattaches and derives the same physical materialization identity.

### SEE acceptance evidence

Focused tests prove:

- canonical S6 fixture → deterministic materialization;
- accepted-ref reuse behavior;
- private Runtime transport authentication and identity substitution rejection;
- authenticated browser-facing GameFrame attach with no client viewer override;
- existing Pixi terrain/world renders the Crooked Checkpoint map;
- safe Pell/cart/West Woods route overlays are present;
- refresh performs a second semantic attach while retaining the same materialization ID.

### Deliberately not claimed

SEE does not prove:

- WASD/facing;
- collision while moving;
- exploration camera-follow semantics;
- reconnect-safe x/y position;
- a newly derived GameFrame materialization ref has been journal-linked back into Runtime Scene Registry;
- direct interaction/Pell context custody;
- West Woods transfer;
- Tactical Activation;
- final art.

## Slice B — MOVE: realtime exploration — ACTIVE NEXT

Add only the physical/session state necessary for ordinary walking:

- player x/y/facing;
- WASD/keyboard movement;
- camera-follow/pan behavior appropriate to exploration;
- collision/navigation against the existing Crooked Checkpoint geometry;
- scene-scoped realtime state;
- valid position persistence/recovery;
- reconnect without duplicate semantic presence.

Frame-by-frame state stays in GameFrame. Runtime receives no movement stream.

### MOVE acceptance

A browser player walks around Crooked Checkpoint, cannot walk through blocked geometry, refreshes/reconnects, and resumes a valid position on the same physical materialization without creating semantic duplicate presence.

## Slice C — TALK: context custody through real interaction

Once the player can stand next to Pell:

GameFrame provides:

- stable target selection;
- Talk/Interact UI;
- Ask Game Master UI/log;
- Do Something Else input;
- GM intervention/pause presentation.

Runtime provides perspective-correct context/decisions.

### TALK acceptance

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

Proof order:

1. human playthroughs with multiple plausible choices;
2. restart/reconnect testing;
3. deterministic/machine-play regression;
4. live provider proof;
5. deployed staging proof.

Only after this proof do two-human play, the second handcrafted Game Family, Campaign Architect, generated campaigns, dynamic Battle Packs, and split-party work become active product priorities.

## Development workflow

### Player acceptance first

Each RPG PR begins with a concrete behavior statement. Avoid “add framework X” unless X is a proven blocker.

### Inspect before designing

Search current GameFrame/Runtime renderer, terrain, realtime, tactical, authority, and fixture mechanisms before adding a subsystem. SEE validated this rule by reusing the existing Monster Master Pixi world rather than forking an exploration renderer.

### Narrow proof first

Prefer one deterministic contract test + one focused integration seam + one browser journey over speculative matrices.

### Vertical but bounded PRs

A PR may cross files/layers if required to complete one player-visible step. Do not split one coherent player feature into artificial layers unless authority/merge ordering requires it.

### Cross-repository ordering

Coordinate both repos only when a real seam is missing or changes. SEE required a small Runtime companion because the S6 projection existed only in-process and was not reachable by the production-shaped GameFrame service. The projection schema itself did not change.

When a shared canonical contract changes, preserve canonical GameFrame-first / exact Runtime mirror ordering.

### Documentation

Update local status/roadmap text in the implementation PR whenever the evidence boundary changes. Use separate docs-only PRs only for material architecture reconciliation, accumulated drift, or audits.

### CI by claim

During iteration run the smallest trustworthy lane. Before merge select broader gates by claim:

- GameFrame behavior → focused Node/browser gate and active-product/browser acceptance;
- Runtime behavior → Fast Check;
- shared contract change → shared drift;
- Runtime↔GameFrame seam → current integration;
- persistence/recovery semantics → durable two-service recovery.

Known unrelated broad-suite failures must be classified rather than silently treated as feature evidence or pulled into the slice.

### PR completion

A PR is complete when its acceptance statement is proven, authority boundaries remain explicit, focused tests are green, required integration gates are green, review findings are resolved, and affected local docs match the evidence.

Do not add adjacent “while we are here” architecture.

## Deferred while the first playable loop is incomplete

Do not prioritize Campaign Architect, dynamic generated RPG discovery, dynamic Battle Pack generation, Battle Simulator expansion beyond blockers/regressions, generalized procedural-world generation, generalized RPG DSLs, giant final-art production, elaborate NPC autonomy beyond chapter needs, split-party concurrency, Cloudflare-native semantic-state migration, Theo integration, or deeper legacy separate-match campaign UX.

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

1. **MOVE — walking/collision/camera/reconnect.**
2. **TALK — Pell interaction + Runtime context custody + Ask-GM + Do Something Else.**
3. **CHANGE/TRAVEL — concrete world operations + West Woods round trip.**
4. **FIGHT — Monster Master control/rules boundary + same-map Tactical Activation.**
5. **PROVE — complete single-player chapter, restart/resume, live provider, staging.**
6. two-human one-scene.
7. second handcrafted Game Family.
8. Campaign Architect + dynamic Role-Playing Games + Battle Pack authoring.
9. dynamic Battle Simulator convergence.
10. split-party later.

## Governing rule

> Deliver the game by completing the next player action, not by maximizing the number of generic systems. Reuse GameFrame's existing physical/tactical machinery, keep Runtime semantic, and let the first playable Monster Master chapter tell us which abstractions are actually necessary.
