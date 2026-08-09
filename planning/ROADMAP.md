---
title: Scribbles GameFrame Roadmap
status: active
document_type: roadmap
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - Games
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
related:
  - README.md
  - rpg-documentation-index.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-encounter-rules.md
  - decisions/0005-gameframe-bot-and-external-agent-boundary.md
---

# Scribbles GameFrame Roadmap

## Canonical boundaries

- **Games** is the top-level player-facing GameFrame destination.
- **Role-Playing Games** is the player-facing campaign surface; **GameFrame RPG Engine** remains internal architecture terminology.
- **Battle Simulator** is the standalone tactical sandbox; Monster Master Arena Battles is its first Monster Master entry.
- GameFrame owns physical materialization, realtime transforms, collision/pathing/camera, direct interaction UI, deterministic RPG Ruleset execution, control authorization, and tactical state.
- `rpg-gm-runtime` owns CampaignPackages, semantic world truth, Dungeon Master orchestration, hidden campaign truth, journaled entity/scene/observer-knowledge state, and semantic consequences.
- Campaign combat uses **Tactical Activation** on the current materialized map; it never launches Battle Simulator or a replacement campaign battlefield.
- MM-0001 remains standalone/regression substrate and the seed for Monster Master Arena Battles.

## Current development mode

The platform has enough semantic substrate. The active risk is no longer missing architecture; it is continuing to build invisible infrastructure without forcing it through a playable loop.

From this point, the primary GameFrame development target is:

```text
SEE
→ MOVE
→ TALK
→ CHANGE / TRAVEL
→ FIGHT
→ PROVE
```

Every substantive RPG PR should advance that bounded Monster Master journey or remove a demonstrated blocker to it.

Do not create a new RPG renderer. Reuse the existing Pixi world/tactical renderer and terrain foundations.

Do not block the first playable scene on final art or generalized procedural generation. Deterministic semantic-layout materialization and placeholder assets are acceptable.

## Completed foundations

Preserve the useful current GameFrame substrate:

- authenticated players/seats/invitations and server-derived identity;
- durable coordination/presentation revisions and idempotent command foundations;
- audience-scoped presentation;
- Worker/Cloudflare/VM/Tunnel deployment surfaces;
- authenticated RPG WebSocket/recovery substrate;
- PixiJS Monster Master renderer;
- reusable terrain projection/geometry/material pipeline;
- tactical movement/initiative/attack/health/effect machinery;
- standalone Monster Master BattleBot/regression surface;
- Role-Playing Games / Battle Simulator player navigation;
- strict `campaign.exploration_projection` contract;
- viewer-independent materialization identity and scene-bound accepted-ref validation;
- canonical Crooked Checkpoint exploration fixture aligned to CampaignPackage v5.

Runtime foundations consumed by GameFrame now include Entity Registry, Scene Registry, Observer Knowledge / People, WorldGraph/materialization intent, and the viewer-safe exploration projection.

## GF-RPG-01 — Generic semantic/physical boundary — bounded foundation complete

The current accepted boundary is:

```text
Runtime semantic authority
→ viewer-safe campaign.exploration_projection
→ GameFrame physical materialization/session authority
```

The exploration contract carries campaign/package/ruleset identity, semantic scene/revision, authorized entities/objects/routes, materialization intent, and optional accepted materialization ref.

It deliberately carries no x/y/facing/geometry/collision/pathfinding/camera authority.

## GF-RPG-02 — SEE: Crooked Checkpoint materialization — ACTIVE

Build the first real physical RPG campaign scene from the S6 projection.

Implement the minimum deterministic scene needed by the reference package:

- `scene.crooked-checkpoint` materialization;
- accepted `rpg-scene:<campaignId>:scene.crooked-checkpoint` identity/version/hash;
- settled road;
- timber checkpoint barrier;
- inspection shelter;
- Road Maintenance Shed;
- Confiscation Cart;
- drainage edge;
- westbound route/exit anchor;
- player avatar anchor;
- Pell and viewer-authorized entity anchors;
- known object anchors;
- collision/picking/navigation primitives required by the scene;
- placeholder/world-kit visuals where final assets are absent.

Use the existing Pixi/terrain renderer. Do not fork a new exploration renderer from the tactical renderer.

### Exit

Opening Monster Master RPG produces a physical Crooked Checkpoint derived from the semantic projection. Refresh/reconnect reuses the same accepted materialization rather than generating a different place.

## GF-RPG-03 — MOVE: embodied realtime session

Add GameFrame-owned:

- WASD/player movement;
- facing;
- camera;
- collision/navigation behavior;
- valid position persistence/recovery;
- scene-scoped realtime projection;
- bounded reconnect/backpressure.

No movement frame becomes RPG Runtime journal traffic.

### Exit

The player can move around Crooked Checkpoint responsively and reconnect into a valid position on the same materialization without duplicate semantic presence.

## GF-RPG-04 — TALK: Pell interaction + GM surfaces

Drive the next Runtime context-mode work through the physical scene.

GameFrame player surfaces:

- targetable Talk / Interact;
- Ask Game Master;
- Do Something Else;
- GM intervention/pause/freeze presentation;
- People/character/control views as required.

Pell is the first entity-performance target. GameFrame sends a stable interaction target; Runtime determines perspective-correct semantic context.

### Exit

The player walks to Pell, talks to Pell, separately asks the GM, and submits a freeform action without confusing entity speech, referee authority, or deterministic mechanic results.

## GF-RPG-05 — CHANGE / TRAVEL: persistent world and West Woods

Promote only concrete world interactions the Crooked Checkpoint chapter uses.

GameFrame should present/execute deterministic mechanics requested by Runtime for concrete interactions such as checks and object actions; narration is never parsed to infer state.

Then add West Woods:

- current available route/exit interaction;
- authoritative semantic transfer;
- `scene.west-woods` materialization;
- destination scene session;
- stable revisit;
- return to the same Crooked Checkpoint materialization;
- meaningful object/entity/world continuity.

### Exit

The player can cause at least one persistent world change, travel Crooked Checkpoint ↔ West Woods through ordinary play, and revisit the same places without drift.

## GF-RPG-06 — FIGHT foundation: Monster Master rules/control authority

Promote existing tactical semantics into the reusable RPG boundary only as required by same-map campaign combat:

- Monster Master Ruleset/profile/version;
- principal → Master/player-character → controlled entity set;
- class/archetype/profile;
- class-defined monster deployment/control limits;
- Master tactical participation;
- initiative/action economy;
- movement/range/targeting/actions;
- conditions/resources/objectives/outcomes;
- escape/withdrawal/surrender/recall/incapacitation where implemented.

Do not hardcode one player = one unit or one Master = one monster into the generic engine.

## GF-RPG-07 — FIGHT: same-map Tactical Activation

Use the existing physical campaign scene:

```text
exploration
→ tactical trigger
→ validate current semantic/materialized/ruleset/control state
→ Tactical Activation
→ current positions become tactical starting positions
→ deterministic turn-based actions on current geometry
→ deterministic consequences
→ semantic reconciliation where required
→ exploration resumes on the same map
```

No replacement campaign battlefield and no Return-to-Campaign navigation.

### Exit

The player can enter and finish combat on the existing scene, then immediately continue exploration with exact resulting state after reconnect/restart.

## GF-RPG-08 — PROVE: complete single-player Monster Master

Required player journey:

```text
Role-Playing Games
→ Monster Master RPG
→ Crooked Checkpoint materialization
→ movement
→ Pell interaction
→ Ask-GM
→ Do Something Else
→ persistent world change
→ West Woods travel/revisit
→ event/check consequence
→ same-map Tactical Activation
→ Master + controlled monster actions
→ deterministic tactical result
→ same-scene exploration resume
→ bounded campaign resolution
→ restart/resume
```

Validation order:

1. human playthroughs;
2. deterministic/machine-play regression;
3. live provider proof;
4. deployed staging proof.

## GF-RPG-09 — Two-human one-scene campaign

Only after single-player proof, add separate authenticated avatars/principals, one shared active scene, viewer-divergent knowledge, party/public/private presentation, cohesive transitions, cooperative control, same-map tactical mode, and reconnect.

Split-party simultaneous scenes remain later.

## GF-RPG-10 — Second handcrafted Game Family

Run a materially different handcrafted campaign/game family through the same GameFrame RPG Engine, Runtime semantic architecture, materialization framework, context modes, RPG Ruleset boundary, and Tactical Activation framework.

Repair generic abstractions rather than adding family-specific engine branches.

## GF-RPG-11 — Campaign Architect / dynamic Role-Playing Games / Battle Pack authoring

Only after two handcrafted game families prove the architecture:

- data-driven Role-Playing Games discovery/resume;
- Create RPG / My Campaigns / Import Campaign;
- Campaign Architect draft/refinement/preview/commit;
- generated/selectable validated ruleset profiles and reusable game-family content;
- Battle Pack authoring/export for combat-capable families;
- spoiler-safe exposure/unlock policy.

## GF-RPG-12 — Dynamic Battle Simulator

After the shared rules/game-family boundary is proven:

- Battle Pack discovery/selection;
- Monster Master Arena Battles as the first pack/family;
- character/class/loadout builder;
- opponent/team setup;
- map selection/generation;
- BattleScenario setup;
- objectives/deployment;
- humans/BattleBot;
- replay/rematch/analysis;
- imported/generated Battle Packs;
- ruleset equivalence with campaign Tactical Mode.

## GF-RPG-13 — Split-party multi-scene

Only after one-scene multiplayer is trustworthy, add independent live scene subscriptions, scene-local knowledge/audibility, cross-scene communication, independent recovery/materialization, and explicit cross-scene tactical/global-clock rules.

## Explicitly deferred until GF-RPG-08

Do not prioritize:

- Campaign Architect implementation;
- generated RPG systems;
- dynamic Battle Pack generation;
- Battle Simulator expansion beyond blocker fixes;
- unrestricted procedural world generation;
- giant final-art production;
- generalized RPG DSLs;
- elaborate autonomous NPC systems;
- split-party work;
- deeper separate-match campaign features;
- unrelated hub polish.

## Development discipline

For RPG work before GF-RPG-08:

1. start from the next incomplete player-journey step;
2. write the narrow acceptance test/fixture for that step;
3. implement only the authority necessary to make it work;
4. reuse existing Pixi/tactical/realtime infrastructure first;
5. run focused GameFrame checks while iterating;
6. run current Runtime integration when the seam changes;
7. update local docs in the implementation PR when evidence changes;
8. reserve separate docs-only PRs for major architectural reconciliations, not every completed slice.

If a proposed PR cannot be located in SEE → MOVE → TALK → CHANGE/TRAVEL → FIGHT → PROVE, its priority is suspect.

## Immediate execution order

1. **GF-RPG-02 SEE — Crooked Checkpoint physical materialization.**
2. **GF-RPG-03 MOVE — movement/collision/camera/reconnect.**
3. **GF-RPG-04 TALK — Pell context custody + interaction + Ask-GM + Do Something Else.**
4. **GF-RPG-05 CHANGE/TRAVEL — concrete world operations + West Woods persistent transfer/revisit.**
5. **GF-RPG-06/07 FIGHT — rules/control authority + same-map Tactical Activation.**
6. **GF-RPG-08 PROVE — one complete single-player engineering campaign, live provider, staging.**
7. two-human one-scene campaign.
8. second handcrafted Game Family.
9. Campaign Architect + dynamic Role-Playing Games + Battle Pack authoring.
10. dynamic Battle Simulator convergence.
11. split-party multi-scene.

The static Games / Role-Playing Games / Battle Simulator navigation is intentionally ahead of dynamic productization and should not pull development away from the playable Monster Master loop.

## Governing rule

> Reuse the existing GameFrame Pixi/tactical world, make Crooked Checkpoint playable end to end, and derive new abstraction only from requirements that the real player journey exposes.
