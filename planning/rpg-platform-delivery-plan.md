---
title: RPG Platform Delivery Plan
status: active
document_type: repository-plan
owner: Scribbles GameFrame
last_updated: 2026-08-08
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
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-cross-repository-integration-testing.md
  - tactical-battler-rpg-foundation.md
  - monster-master-rpg-encounter-rules.md
---

# RPG Platform Delivery Plan

## Authority

`shared/rpg-platform-roadmap.md` controls milestone order. This file maps GameFrame delivery onto it.

The product layering is:

```text
CampaignPackage + RPG Ruleset
            ↓
GameFrame RPG Engine ←→ RPG GM Runtime
            ↓
persistent embodied campaign
```

Monster Master RPG is the first bespoke campaign product. Monster Master Battle Arena is the standalone tactical simulator. They should share Monster Master Ruleset/tactical implementation, but campaign combat never launches the Arena product.

## Existing GameFrame foundation

Preserve useful current infrastructure:

- authenticated player/campaign/session authority;
- durable command/revision/idempotency foundations;
- audience-scoped presentation;
- Worker/Cloudflare/VM/Tunnel deployment;
- current RPG shell/recovery/admin tooling;
- Pixi Monster Master rendering/tactical primitives;
- tactical-core movement/initiative/attack/health/effect foundations;
- standalone MM-0001/Monster Master BattleBot regression surface;
- current narrow durable RPG→separate-match binding and exact creature mapping;
- authenticated RPG WebSocket projection/recovery substrate.

The current separate-match campaign path is migration substrate, not the mature architecture.

## Transitional legacy correctness

While the current staging path still launches a separate Monster Master match, fix only the correctness necessary to preserve development/testing:

```text
legacy terminal result
→ consequence consumed exactly once
→ runtime semantic aftermath/resumable state
→ refresh/reconnect remains correct
```

Do not add new campaign features by deepening the separate-match/Return-to-Campaign lifecycle.

The target is same-map Tactical Activation.

## GameFrame RPG Engine boundary

Create explicit reusable contracts for:

- RPG Ruleset/profile/version capability;
- scene materialization identity/version;
- exploration/tactical resolution mode;
- player-character/control authority;
- direct interaction targeting;
- semantic scene/materialization linkage;
- scene/session realtime transport;
- Tactical Activation/tactical state;
- standalone BattleScenario setup.

Monster Master-specific content/rules should plug into these contracts rather than become the engine itself.

## Crooked Checkpoint world slice

Build the first persistent campaign scene with:

- Pixi exploration renderer;
- authenticated player avatar;
- movement/facing;
- camera;
- collision/pathing/picking;
- Pell and required entity anchors;
- cart/barrier/road/woods/creek/exits sufficient for current semantics;
- materialization ID/version;
- stable revisit/reconnect;
- deterministic placeholder/world-kit assets where final art is missing.

Runtime supplies semantic location/world truth. GameFrame owns playable geometry.

## Realtime embodied session

Extend the existing authenticated VM WebSocket/session path for bounded GameFrame-owned:

- movement/facing;
- nearby-player/entity transforms;
- scene-presence/session updates;
- tactical-mode transition notifications;
- post-commit projection notifications.

Do not send every movement frame to RPG GM Runtime.

## Direct interaction / GM surfaces

Add:

- **Talk / Interact** — targeted present entity/object;
- **Do Something Else** — freeform plausible unsupported action;
- **Ask Game Master** — out-of-fiction rules/knowledge/clarification;
- **GM Intervention** — explicit GM-origin presentation/pause/freeze semantics;
- People/character/control views.

Pell is the first perspective-custody target.

## Connected world materialization

After Crooked Checkpoint, add one connected scene such as West Woods.

Prove:

- runtime WorldGraph route identity;
- party-cohesion transition zone;
- one semantic scene transfer;
- on-demand destination materialization;
- stable revisit;
- meaningful world state across both locations;
- alternate route selected through play, not a scripted menu-only branch.

## One-scene party first

The world may contain many persistent maps while the first multiplayer product keeps the active party in one scene at a time.

GameFrame should support:

- separate authenticated avatars;
- shared scene session;
- nearby-player transforms;
- transition readiness/edge zones;
- one authoritative party transfer;
- destination scene session/materialization.

Split-party simultaneous scenes remain later.

## Ruleset-defined character/control authority

GameFrame RPG Engine must not assume one principal controls exactly one unit.

A ruleset defines legal control relationships.

Monster Master should support:

- player principal;
- own Master/trainer entity;
- class/archetype/profile;
- one or more deployed monster entities according to class/ruleset limits;
- tactical actions for both Master and monsters as the ruleset defines them.

This same Monster Master Ruleset should serve Monster Master RPG and Monster Master Battle Arena.

## Same-map Tactical Activation

The campaign tactical target is:

```text
current exploration scene
→ validate semantic scene + materialization + current positions + control + ruleset
→ resolutionMode = tactical
→ initiative / turn order / legal tactical actions on existing geometry
→ deterministic consequences
→ runtime semantic reconciliation where needed
→ resolutionMode = exploration
```

Required invariants:

- no replacement battlefield;
- current positions become tactical starting positions unless an explicit rule says otherwise;
- same people/monsters/objects/terrain/exits;
- real scene exits support escape/withdrawal where implemented;
- important noncombatants/support/escaping entities do not silently disappear;
- no campaign Return-to-Campaign button/navigation.

GameFrame may internally reuse MatchSession/tactical-core machinery. Internal reuse does not imply the player enters another location/product.

## Monster Master Battle Arena delivery

The existing standalone Monster Master card/product becomes **Monster Master Battle Arena**.

Preserve MM-0001 as regression foundation while the shared Monster Master Ruleset is extracted.

Later Arena features may include:

- Master/character builder;
- class/loadout builder;
- monster/team setup;
- map selection/generation;
- BattleScenario presets;
- deployment/options/objectives;
- humans/BattleBot;
- replay/rematch/analysis.

Equivalent ruleset versions/profiles should produce equivalent combat semantics in RPG tactical mode and Battle Arena.

## GameFrame RPG generic player product

The Game Library reserves a **GameFrame RPG — Coming Soon** destination.

Future surfaces:

- Create Campaign from an idea;
- My Campaigns;
- Import Campaign;
- Campaign Architect draft/refinement/preview;
- commit/resume/management.

Bespoke titles such as Monster Master RPG remain visible library products powered by the generic engine underneath.

## Checks/events/world interactions

GameFrame implements/presents mechanics deliberately promoted into authority, including as needed:

- deterministic checks;
- world-object interactions;
- objective/clue/condition projections;
- scene/location transitions;
- tactical activation/readiness.

Do not parse narration to infer state.

## Media/materialization delivery

GameFrame owns:

- asset/world-kit catalogs;
- deterministic prefabs/composition;
- materialization recipe/seed/versioning;
- provider-neutral prompt compilation;
- configured generation;
- validation/moderation/provenance;
- caching/storage/replacement;
- stable recurring character/location identities;
- semantic cinematic-script execution;
- readable fallbacks.

Generated pixels never own collision or hidden campaign truth.

## Shared fixture evolution

Add fixtures for:

- semantic scene/materialization linkage;
- People/Observer Knowledge;
- targeted interaction;
- Ask-GM / Do Something Else / GM intervention;
- ruleset/profile/version;
- principal/player-character/controlled-entity authority;
- scene transfer/route identity;
- Tactical Activation snapshot/linkage;
- structured tactical consequences;
- same-scene tactical→exploration resume.

## Single-player acceptance

Require:

1. committed Monster Master package/ruleset/world;
2. Crooked Checkpoint materialization;
3. movement/direct interaction;
4. Pell perspective custody;
5. Ask-GM + Do Something Else;
6. People/Observer Knowledge;
7. second connected scene + revisit;
8. event/check/world consequence;
9. same-map Tactical Activation;
10. Master + ruleset-authorized monster control;
11. alternate terminal state as implemented;
12. same-scene exploration resume;
13. restart/reconnect without drift/duplication/leakage;
14. bounded campaign resolution.

## Multiplayer order

After single-player, prove two humans in one shared active scene:

- separate principals/avatars;
- realtime movement;
- viewer-divergent knowledge;
- direct NPC interaction;
- public/party/private GM presentation;
- group scene transfer;
- cooperative ruleset-defined tactical control;
- same-map Tactical Activation;
- reconnect.

Split-party multi-scene is later.

## Generality before Campaign Architect

A materially different second handcrafted campaign must use the same GameFrame RPG Engine, runtime semantic architecture, materialization framework, RPG Ruleset boundary, interaction surfaces, and Tactical Activation framework.

Repair abstractions before automating campaign creation.

## Deployment posture

Initial production remains GameFrame + RPG GM Runtime as separate services on one VM behind Cloudflare.

Realtime embodied movement may use the authenticated VM WebSocket path. Semantic commands/recovery remain durable authority paths. Socket state remains disposable.

## Validation posture

Use the evidence layer matching the claim:

- unit/contracts for ruleset/authority/projections;
- materialization/geometry tests;
- runtime machine-play for DM perspective/adjudication;
- actual integration for semantic/materialization linkage;
- tactical tests for Monster Master Ruleset;
- browser tests for same-map exploration↔tactical transitions;
- VM canaries for deployed realtime/recovery;
- media canaries for generation/materialization.

## Immediate GameFrame execution order

1. keep staging usable; repair legacy separate-match consequence bugs only when blocking;
2. establish explicit GameFrame RPG Engine/RPG Ruleset boundary;
3. consume Entity/Scene/Observer Knowledge as runtime work lands;
4. build Crooked Checkpoint materialization/movement;
5. extend scene realtime session state;
6. add targeted Pell interaction + Ask-GM + Do Something Else + GM intervention;
7. add second connected scene/stable revisit;
8. extract/promote Monster Master Ruleset + generic control authority;
9. implement same-map Tactical Activation;
10. run complete single-player embodied proof;
11. add two-human one-scene acceptance;
12. prove second handcrafted campaign;
13. build Campaign Architect/GameFrame RPG generic product;
14. converge richer Battle Arena tooling on the same Monster Master Ruleset;
15. productize split-party multi-scene later.

## Governing rule

> Deliver one reusable RPG engine underneath Monster Master: campaign content defines semantic worlds, rulesets define deterministic game behavior, GameFrame makes the world playable, and initiative turns on where the player is already standing.
