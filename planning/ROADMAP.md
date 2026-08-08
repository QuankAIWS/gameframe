---
title: Scribbles GameFrame Roadmap
status: active
document_type: roadmap
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - GameFrame RPG
  - Monster Master RPG
  - Monster Master Battle Arena
  - RPG GM Runtime integration
related:
  - README.md
  - rpg-documentation-index.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-gameframe-interface-contract.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-encounter-rules.md
  - decisions/0005-gameframe-bot-and-external-agent-boundary.md
---

# Scribbles GameFrame Roadmap

## Canonical boundaries

- **GameFrame** is the authoritative game platform and complete authenticated player interface.
- **GameFrame RPG Engine** is the reusable campaign-agnostic embodied world/mechanics layer inside GameFrame.
- **RPG Rulesets** define game-specific deterministic mechanics independently of one CampaignPackage.
- **Monster Master Ruleset** should eventually drive both Monster Master RPG and Monster Master Battle Arena combat.
- **Monster Master RPG** is the first bespoke campaign title: GameFrame RPG Engine + Monster Master Ruleset + Monster Master CampaignPackage/content.
- **Monster Master Battle Arena** is the standalone tactical simulator: GameFrame tactical/world subset + Monster Master Ruleset + BattleScenario.
- Campaign combat does **not** launch Monster Master Battle Arena. It activates Tactical Mode on the current materialized map.
- `rpg-gm-runtime` owns CampaignPackages, semantic world truth, Dungeon Master orchestration, hidden truth, campaign journal, Entity/Scene/Observer Knowledge, and narrative/world consequences.
- GameFrame owns scene materialization, realtime transforms/session state, authenticated control authority, deterministic mechanics, Tactical Activation/tactical state, and presentation.
- Scribbles Runtime/Theo remains separate; Theo may later occupy an ordinary player seat only.

## Existing foundation worth preserving

GameFrame already has substantial reusable substrate:

- server-authoritative authenticated game/match contracts;
- durable/replayable Tic-Tac-Toe and Checkers games;
- Durable Object/Worker deployment foundations;
- Discord identity/invitations/sessions;
- tactical-core/map/movement/occupancy/initiative/attack/health/effect primitives;
- standalone Monster Master/MM-0001 tactical proof;
- Pixi/Canvas Monster Master rendering;
- Monster Master BattleBot deterministic behavior;
- durable RPG campaign/encounter/match coordination and SQLite authority;
- exact bounded participant→creature mapping for the current narrow tactical prototype;
- VM/Cloudflare/Tunnel staging topology;
- authenticated RPG WebSocket projection/recovery substrate.

These are implementation assets, not the mature RPG product model.

## Transitional live blocker — old separate-match aftermath path

The current staging implementation can still enter the legacy separate Monster Master match path. Human staging previously exposed a defect where terminal tactical state returned to an RPG shell still fenced on the same encounter.

Repairing/proving that path remains useful while it exists because it blocks current playtesting and protects durable consequence semantics.

However, **do not deepen the legacy separate-match lifecycle as the destination**.

The mature migration target is:

```text
materialized campaign scene
→ Tactical Activation on that scene
→ deterministic tactical consequences
→ same scene returns to exploration control
```

No separate campaign battle route/materialization and no `Return to Campaign` navigation are part of the target product.

## Active — GF-RPG-01 GameFrame RPG Engine boundary

Define reusable engine contracts independent of Monster Master campaign content:

- ruleset/profile/version capability interface;
- materialized-scene identity/version;
- entity/control authorization;
- exploration/tactical resolution modes;
- direct interaction targeting;
- semantic scene/materialization linkage;
- standalone BattleScenario setup boundary;
- recovery/reconnect identities.

### Exit

Monster Master package/content can request Monster Master Ruleset capabilities without GameFrame RPG Engine requiring a Monster Master-specific campaign control branch.

## Active — GF-RPG-02 Crooked Checkpoint materialized world

Build the first persistent embodied campaign scene:

- Pixi exploration scene;
- player avatar;
- collision/pathing/picking;
- semantic anchors;
- Pell and required checkpoint entities;
- road/cart/barrier/woods/creek/exit geometry sufficient for current campaign semantics;
- stable materialization identity/revisit;
- deterministic placeholder/world-kit assets where final art is missing.

Runtime supplies semantic world/location truth; GameFrame owns playable geometry.

### Exit

Player can enter, move through, leave, reload, and revisit the same Crooked Checkpoint materialization.

## Active — GF-RPG-03 embodied realtime session

Extend current RPG WebSocket/session support for high-frequency GameFrame-owned realtime state:

- movement/facing;
- nearby player/entity transforms as needed;
- scene-scoped authorization;
- reconnect/recovery;
- tactical-mode transition notifications.

Do not journal frame-by-frame coordinates in RPG GM Runtime.

## Active — GF-RPG-04 direct interaction + GM surfaces

Implement player-facing modes:

- Explore;
- Talk/Interact;
- Do Something Else;
- Ask Game Master;
- GM Intervention;
- People/character/control views.

Pell is the first entity-performance target. A hidden fact Pell does not know must be unavailable to Pell's performance context.

## Active — GF-RPG-05 connected world/materialization

Add a second persistent scene such as West Woods and prove:

- WorldGraph route/transition;
- party-cohesion edge-zone transfer;
- alternate route chosen through play rather than menu scripting;
- on-demand materialization;
- stable revisit;
- meaningful world state across scenes.

The first multiplayer product keeps the party in one active scene at a time.

## Active — GF-RPG-06 Monster Master Ruleset/control authority

Promote shared Monster Master deterministic rules out of MM-0001-specific assumptions.

Required direction:

- player-character/Master tactical entity;
- class/archetype tactical profile;
- principal controls own Master plus class/ruleset-permitted deployed monster(s);
- explicit actions/resources/conditions;
- initiative/action economy;
- escape/withdrawal/surrender/recall/incapacitation;
- asymmetric participant roles/objectives as campaign needs prove them;
- same ruleset profile usable by campaign and standalone Battle Arena.

The generic engine must not hardcode exactly one controlled monster.

## Active — GF-RPG-07 same-map Tactical Activation

Replace the old campaign scene→separate match destination with:

```text
current exploration scene
→ validate semantic scene/materialization/current positions/control/ruleset
→ resolutionMode = tactical
→ initiative / turn order / legal tactical actions
→ structured tactical consequences
→ required semantic reconciliation
→ resolutionMode = exploration
```

Invariants:

- no new battlefield;
- no repositioning to canned deployment unless an explicit rule says so;
- same people/monsters/objects/geometry;
- current positions are starting positions;
- real scene exits support escape where implemented;
- post-combat exploration resumes in place.

## Monster Master Battle Arena product track

The current standalone `monster-master` game becomes **Monster Master Battle Arena** in the Game Library.

Near-term: preserve MM-0001 regression behavior while campaign engine work proceeds.

Later convergence work may add:

- Master/character builder;
- class/loadout builder;
- monster/team setup;
- map selection/generation;
- BattleScenario presets;
- objectives/deployment options;
- humans/BattleBot;
- replay/rematch/analysis.

Critical invariant: equivalent Monster Master Ruleset versions/profiles produce equivalent legal actions/outcomes in RPG tactical mode and Battle Arena.

## GameFrame RPG generic player product

The Game Library now reserves a **GameFrame RPG — Coming Soon** destination.

Future player-facing surfaces:

- Create Campaign;
- My Campaigns;
- Import Campaign;
- Campaign Architect draft/refinement/preview;
- campaign resume/management.

This product is the generic campaign home. Bespoke titles such as Monster Master RPG remain first-class library entries while using the engine underneath.

## Single-player acceptance gate

Before calling the embodied Monster Master slice complete, prove:

1. committed package/world;
2. persistent Crooked Checkpoint materialization;
3. movement/direct interaction;
4. Pell perspective custody;
5. Ask-GM + Do Something Else;
6. People/Observer Knowledge;
7. second connected scene + revisit;
8. event/check/world consequence;
9. same-map Tactical Activation;
10. Master + controlled monster legal actions;
11. alternate tactical terminal state as supported;
12. same-scene exploration resume;
13. restart/reconnect without duplication/drift/leakage;
14. bounded campaign resolution.

## Multiplayer order

First prove two humans in one shared active scene:

- separate principals/avatars;
- realtime movement;
- viewer-divergent knowledge;
- shared/private GM communication;
- direct NPC interaction;
- party transitions;
- cooperative ruleset-defined tactical control;
- same-map Tactical Activation;
- reconnect.

Only then productize split-party simultaneous scenes.

## Second package before Campaign Architect

A materially different handcrafted campaign must run through the same GameFrame RPG Engine, runtime world/entity/scene/knowledge architecture, materialization framework, ruleset interface, and Dungeon Master context modes.

Repair abstractions before automating campaign generation.

## Future Campaign Architect

After two handcrafted campaigns prove the common engine:

```text
player idea
→ Campaign Architect draft
→ optional owner refinement
→ validation/repair
→ preview/commit
→ world materialization
→ play through the same GameFrame RPG Engine
```

Generated campaigns must not require campaign-specific engine/Dungeon Master branches.

## Split-party / simultaneous multi-scene later

The semantic model remains zero-or-more scenes, but simultaneous split-party play requires additional:

- scene-scoped realtime subscriptions;
- observer knowledge divergence;
- cross-scene communication;
- campaign/global time/event semantics;
- concurrency-safe Dungeon Master work;
- independent recovery/materialization;
- rules for one scene tactical while another explores.

This is deliberately later than one-scene multiplayer.

## Documentation posture

Use:

- `planning/rpg-documentation-index.md` for reading order;
- `planning/shared/rpg-platform-product-goals.md` for product hierarchy;
- `planning/shared/rpg-platform-roadmap.md` for cross-repository milestone order;
- `planning/shared/rpg-embodied-exploration-and-character-performance-contract.md` for embodied/world/GM/tactical rules;
- `planning/shared/rpg-scene-entity-and-knowledge-contract.md` for durable semantic continuity;
- `planning/monster-master-rpg-encounter-rules.md` for Monster Master same-map tactical/control direction;
- this file for GameFrame-local implementation status/direction.

## Governing rule

> Build the reusable RPG engine underneath Monster Master. The campaign and the standalone Battle Arena should share Monster Master rules, but campaign initiative happens on the map already under the player's feet.
