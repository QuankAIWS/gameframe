---
title: Scribbles GameFrame Roadmap
status: active
document_type: roadmap
owner: Scribbles GameFrame
last_updated: 2026-08-08
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
- **Role-Playing Games** is the player-facing campaign surface. **GameFrame RPG Engine** remains internal campaign-agnostic architecture terminology.
- **Battle Simulator** is the player-facing standalone tactical sandbox. Monster Master Arena Battles is the first Battle Simulator entry.
- A reusable **Game Family** can appear in both Role-Playing Games and Battle Simulator through one shared RPG Ruleset/content/asset foundation.
- A future **Battle Pack** is simulator-safe tactical content/configuration for a Game Family; it must not duplicate rules or automatically expose campaign secrets.
- GameFrame is the authoritative player application, exploration/materialization authority, realtime session authority, and deterministic mechanic/tactical authority.
- `rpg-gm-runtime` owns CampaignPackages, semantic world truth, Dungeon Master orchestration, hidden campaign truth, campaign journal, entity/scene/observer-knowledge state, and narrative/world consequences.
- The mature RPG player loop is embodied exploration/direct interaction with GM/freeform escape hatches, not transcript-first movement.
- Campaign tactical combat uses **Tactical Activation** on the current materialized map. It never launches Battle Simulator or a replacement campaign battlefield.
- Built-in deterministic opponents use `gameframe-bot` and game-specific bot presentation.
- Scribbles Runtime is a separate future integration host for Theo.
- MM-0001 remains useful standalone Monster Master regression substrate and the seed for Monster Master Arena Battles, not the RPG campaign lifecycle.

## Player navigation baseline

The intended static information architecture is allowed to land before the underlying generic data-driven systems:

```text
Games
├── Role-Playing Games
│   ├── Monster Master RPG
│   ├── future handcrafted/generated RPGs
│   └── Create RPG / My Campaigns / Import Campaign
├── Battle Simulator
│   ├── Monster Master Arena Battles
│   ├── future Battle Packs
│   └── Custom Battle / generated battlefield / import
├── Clockwork Checkers
├── Othello
└── Tic-Tac-Toe
```

Dynamic campaign discovery, Battle Pack discovery, Campaign Architect output, generated map setup, unlock policy, and generic builders remain later milestones.

## Completed platform proofs

GameFrame already has useful proven substrate that should be preserved while the RPG architecture evolves:

- authenticated players/seats/invitations and server-derived control identity;
- durable coordination/presentation revisions and idempotent command foundations;
- audience-scoped presentation;
- Worker/Cloudflare/VM/Tunnel deployment surfaces;
- VM-backed RPG WebSocket projection/recovery work;
- PixiJS Monster Master tactical renderer and world interaction primitives;
- tactical movement/initiative/attack/health/effect machinery;
- standalone deterministic Monster Master BattleBot/regression surface;
- narrow exact campaign-creature → configured tactical unit → terminal participant result → roster consequence integration;
- Monster Master RPG shell/recovery/admin tooling.

These proofs do not yet establish the mature embodied RPG engine, same-map Tactical Activation, generic Game Family/Battle Pack loading, or generated campaigns.

## Transitional legacy tactical correctness

Current staging may still exercise the old separate-match campaign path while replacement work is built.

Repair it only as needed to preserve reliable development evidence:

```text
legacy terminal result
→ result consumed exactly once
→ semantic/roster consequence preserved
→ aftermath/resumable state published
→ reconnect/refresh does not duplicate or lose outcome
```

Do not add new product features by deepening the legacy Return-to-Campaign lifecycle.

## GF-RPG-01 — Generic engine / ruleset / game-family boundary

Establish explicit reusable contracts for:

- GameFrame RPG Engine;
- RPG Ruleset/profile/version/capabilities;
- Game Family identity and reusable content linkage;
- principal → player-character → controlled-entity authority;
- scene materialization identity/version;
- exploration/tactical resolution state;
- Tactical Activation;
- standalone Battle Pack/BattleScenario setup.

Monster Master-specific rules/content plug into these contracts rather than defining them.

### Exit

A Monster Master rules/profile identity can be referenced by both a campaign tactical scene and a standalone scenario without separate combat-rule implementations.

## GF-RPG-02 — Crooked Checkpoint materialization

Build one persistent playable Monster Master campaign scene:

- Pixi exploration scene;
- authenticated player avatar;
- movement/facing/camera;
- collision/pathing/picking;
- Pell and important semantic object/entity anchors;
- road/barrier/cart/woods/creek/exits sufficient for the reference semantics;
- stable materialization identity/version;
- deterministic placeholder/world-kit presentation where final assets are missing;
- reconnect/revisit without replacing the location.

Runtime owns semantic meaning; GameFrame owns playable geometry.

## GF-RPG-03 — Embodied realtime session

Extend the authenticated GameFrame realtime path for:

- scene-scoped player movement/facing;
- nearby-player/entity transforms as needed;
- local animation/session state;
- bounded reconnect/backpressure;
- materialization/session recovery;
- no frame-by-frame RPG journal/provider calls.

## GF-RPG-04 — Direct interaction and GM surfaces

Implement player-facing:

- Talk / Interact;
- Do Something Else;
- Ask Game Master;
- GM Intervention/pause/freeze presentation;
- People/character/control views.

Pell is the first perspective-custody target. Entity-origin dialogue must not masquerade as omniscient GM speech.

## GF-RPG-05 — Connected world

Add a second connected persistent scene such as West Woods and prove:

- runtime WorldGraph route identity;
- GameFrame transition zone;
- authoritative semantic transfer;
- destination materialization;
- stable revisit;
- meaningful state continuity;
- alternate route chosen through play rather than a menu-only script.

The first multiplayer product keeps the party together while still supporting many persistent maps.

## GF-RPG-06 — Monster Master Ruleset extraction / control authority

Promote reusable Monster Master deterministic semantics out of standalone-only assumptions:

- Master/trainer participation;
- class/archetype/profile;
- class-defined deployed monster counts;
- principal/player-character/controlled-entity authorization;
- initiative/action economy;
- movement/range/targeting/actions;
- conditions/resources/objectives/outcomes;
- escape/withdrawal/surrender/recall/incapacitation as implemented.

Do not hardcode one player = one unit or one Master = one monster as generic engine rules.

## GF-RPG-07 — Same-map Tactical Activation

Prove a real campaign location can change control modes without changing world identity:

```text
exploration
→ tactical trigger
→ validate current semantic/materialized/ruleset/control state
→ Tactical Activation
→ current positions become tactical starting positions
→ turn-based actions on current geometry
→ deterministic consequences
→ semantic reconciliation where required
→ exploration resumes on same map
```

### Exit

No replacement campaign battlefield or Return-to-Campaign navigation occurs, and reconnect/restart preserves resulting state.

## GF-RPG-08 — Complete single-player embodied Monster Master

Require one bounded journey through:

- committed campaign package/world;
- Crooked Checkpoint exploration;
- direct Pell interaction;
- perspective-bounded entity performance;
- Ask-GM + Do Something Else;
- Observer Knowledge/People;
- connected second scene/revisit;
- event/check/world consequence;
- same-map Tactical Activation;
- Master + controlled-monster actions;
- tactical result → same-scene exploration;
- bounded resolution;
- restart/reconnect.

## GF-RPG-09 — Two-human one-scene campaign

Add/prove:

- separate authenticated avatars/principals;
- one shared active scene;
- realtime movement;
- viewer-divergent knowledge;
- direct interaction custody;
- public/party/private GM presentation;
- cohesive scene transitions;
- cooperative ruleset-defined tactical control;
- same-map Tactical Activation;
- reconnect/resume.

Split-party simultaneous scenes remain later.

## GF-RPG-10 — Second handcrafted Game Family

Run a materially different handcrafted campaign/game family through the same:

- GameFrame RPG Engine;
- package/entity/scene/observer architecture;
- materialization framework;
- interaction/GM surfaces;
- RPG Ruleset capability boundary;
- Tactical Activation where combat exists.

Repair generic abstractions rather than introducing family-specific engine branches.

## GF-RPG-11 — Dynamic Role-Playing Games / Campaign Architect / Battle Pack contract

After two handcrafted game families prove the architecture:

- data-driven Role-Playing Games discovery/resume;
- Create RPG / My Campaigns / Import Campaign;
- Campaign Architect draft/refinement/preview/commit;
- generated/selectable validated ruleset profile and reusable game-family content as needed;
- Battle Pack authoring/export for combat-capable families;
- spoiler-safe exposure/unlock policy;
- package/family/assets provenance and validation.

A generated combat-capable family should be able to produce both:

```text
CampaignPackage → Role-Playing Games
Battle Pack     → Battle Simulator
```

without creating two combat-rule implementations.

## GF-RPG-12 — Dynamic Battle Simulator

Turn the static Battle Simulator hub into a data-driven simulator product:

- Battle Pack discovery/selection;
- Monster Master Arena Battles as the first pack/family;
- character/class/loadout builder;
- creature/opponent/team setup;
- map selection/generation;
- BattleScenario setup;
- objectives/deployment;
- humans/BattleBot;
- replay/rematch/analysis;
- unlock/exposure enforcement;
- imported/generated Battle Packs.

### Generality gate

At least one non-Monster-Master Battle Pack should load through the same simulator control plane without bespoke code.

### Equivalence gate

Matching RPG Ruleset/profile versions must produce equivalent legal tactical semantics/outcomes in campaign Tactical Mode and Battle Simulator.

## GF-RPG-13 — Split-party multi-scene

Only after one-scene multiplayer is trustworthy, add:

- player-specific scene subscriptions;
- multiple simultaneous live scene sessions;
- separated-party UI;
- scene-local knowledge/audibility/events;
- cross-scene communication;
- independent recovery/materialization;
- rules for one scene tactical while another remains exploratory.

## GF-RPG-14 — Richer media/multi-session systems

Promote only capabilities proven useful through actual campaigns:

- richer world-kit/generated asset coverage;
- semantic cinematic scripts;
- progression/rest/equipment/injury/care;
- recurring objectives/factions/relationships;
- campaign inspection/correction;
- backups/restore/export/retention;
- provider/storage/deployment observability;
- cost/latency/continuity/failure metrics;
- Theo as an ordinary future player integration.

## Immediate execution order

1. Keep staging usable; repair legacy separate-match consequence defects only when blocking.
2. Generic RPG Engine / Ruleset / Game Family boundary.
3. Consume Entity/Scene/Observer Knowledge from runtime.
4. Crooked Checkpoint materialization/movement.
5. Embodied realtime scene session.
6. Pell interaction + Ask-GM + Do Something Else + GM intervention.
7. Second connected scene/stable revisit.
8. Monster Master Ruleset extraction + generic control authority.
9. Same-map Tactical Activation.
10. Complete single-player embodied Monster Master.
11. Two-human one-scene campaign.
12. Second handcrafted Game Family.
13. Dynamic Role-Playing Games + Campaign Architect + Battle Pack contract.
14. Dynamic Battle Simulator + Monster Master convergence.
15. Split-party multi-scene.
16. Richer media/multi-session systems.

The static Games / Role-Playing Games / Battle Simulator navigation is intentionally ahead of steps 13–14 so the product information architecture is already correct while backend capability catches up.

## Validation posture

Use the evidence layer matching the claim:

- schema/unit tests for ruleset/game-family/Battle-Pack/authority contracts;
- materialization/geometry tests;
- runtime machine-play for Dungeon Master behavior/perspective custody;
- cross-repository integration for semantic/materialized boundaries;
- deterministic tactical tests for shared rules;
- campaign-versus-simulator equivalence tests;
- browser acceptance for Games navigation and embodied/tactical transitions;
- VM/Cloudflare canaries for deployed realtime/recovery;
- separate generation/media canaries.

## Governing rule

> GameFrame should expose a clear Games hierarchy while sharing implementation underneath it: Role-Playing Games hosts durable campaigns, Battle Simulator hosts standalone scenarios, and a reusable Game Family must not fork its combat rules merely because the player entered through a different menu.
