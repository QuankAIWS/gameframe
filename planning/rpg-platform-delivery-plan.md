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

The internal product layering is:

```text
CampaignPackage + RPG Ruleset + reusable game-family content
                         ↓
             GameFrame RPG Engine ←→ RPG GM Runtime
                         ↓
              persistent embodied campaign
```

The player-facing GameFrame hierarchy is different from the internal engine hierarchy:

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

**GameFrame RPG Engine** remains architecture terminology. **Role-Playing Games** is the player-facing RPG surface. **Battle Simulator** is the player-facing standalone tactical surface.

Monster Master RPG and Monster Master Arena Battles should share Monster Master Ruleset/tactical implementation, but campaign combat never launches Battle Simulator.

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

## Player navigation now

The Games information architecture should be correct before the dynamic package systems are complete.

Current/static player surfaces may therefore provide:

- **Role-Playing Games** hub with Monster Master RPG plus coming-soon Create RPG / My Campaigns / Import Campaign controls;
- **Battle Simulator** hub with Monster Master Arena Battles plus coming-soon Custom Battle / generated map / Battle Pack controls;
- direct standalone classics at the Games level.

Do not expose GameFrame RPG Engine itself as a top-level game card.

Do not expose every future generated RPG/battle family as a new top-level Games card. Generated campaign entries belong under Role-Playing Games; generated simulator content belongs under Battle Simulator.

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
- Game Family identity/capability linkage;
- scene materialization identity/version;
- exploration/tactical resolution mode;
- player-character/control authority;
- direct interaction targeting;
- semantic scene/materialization linkage;
- scene/session realtime transport;
- Tactical Activation/tactical state;
- standalone Battle Pack and BattleScenario setup.

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

This same Monster Master Ruleset should serve Monster Master RPG and Monster Master Arena Battles.

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

## Battle Simulator delivery

The generic **Battle Simulator** owns standalone tactical setup/lifecycle.

The existing Monster Master standalone tactical game evolves into the first entry, **Monster Master Arena Battles**.

Preserve MM-0001 as regression foundation while the shared Monster Master Ruleset is extracted.

Later Battle Simulator capabilities include:

- Battle Pack discovery/selection;
- character/class/loadout builder;
- creature/opponent/team setup;
- map selection;
- generated standalone maps through GameFrame materialization;
- BattleScenario presets;
- deployment/options/objectives;
- humans/BattleBot;
- replay/rematch/analysis;
- imported/generated Battle Packs;
- exposure/unlock enforcement.

Equivalent ruleset versions/profiles should produce equivalent combat semantics in RPG tactical mode and Battle Simulator.

## Battle Pack delivery

A **Battle Pack** is a simulator-safe content/configuration artifact for a Game Family, not a second combat-rules implementation.

GameFrame should eventually validate/consume Battle Packs containing/referencing:

- game-family identity;
- ruleset/profile/version requirement;
- playable character/archetype/creature templates;
- opponents/factions;
- equipment/loadouts/abilities permitted in standalone setup;
- map themes/world kits/materialization constraints;
- objectives/deployment options;
- bot profiles/presets;
- asset references;
- visibility/unlock policy.

Generated or handcrafted RPG families should reuse their existing assets/content wherever valid rather than require duplicate simulator assets.

Campaign secrets must not become Battle Simulator content automatically. The Battle Pack exposure policy controls what is selectable/visible.

## Role-Playing Games generic player product

The Games surface reserves **Role-Playing Games** as the generic campaign home.

Future data-driven surfaces:

- available RPG/game-family campaigns;
- Create RPG from an idea;
- My Campaigns;
- Import Campaign;
- Campaign Architect draft/refinement/preview;
- commit/resume/management.

Monster Master RPG appears inside Role-Playing Games. Future generated campaigns appear there as data-driven entries rather than new top-level Games cards.

## Campaign Architect → Battle Simulator relationship

After the generic ruleset/game-family interfaces are proven across at least two handcrafted campaign families, Campaign Architect may create/select the reusable content needed for a new generated RPG family.

For a combat-capable generated family, the output path should support:

```text
idea
→ ruleset/profile + reusable game-family content
→ CampaignPackage
→ simulator-safe Battle Pack
```

The CampaignPackage and Battle Pack may reference the same rules/content/assets but have different lifecycle/visibility rules.

GameFrame then surfaces the campaign under Role-Playing Games and the Battle Pack under Battle Simulator without bespoke UI code for that family.

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

The same validated asset/world-kit systems may serve persistent RPG scenes and standalone Battle Simulator map generation.

## Shared fixture evolution

Add fixtures for:

- semantic scene/materialization linkage;
- People/Observer Knowledge;
- targeted interaction;
- Ask-GM / Do Something Else / GM intervention;
- ruleset/profile/version;
- game-family identity;
- principal/player-character/controlled-entity authority;
- scene transfer/route identity;
- Tactical Activation snapshot/linkage;
- structured tactical consequences;
- same-scene tactical→exploration resume;
- Battle Pack validation/exposure;
- campaign-versus-simulator ruleset equivalence.

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

A materially different second handcrafted campaign/game family must use the same GameFrame RPG Engine, runtime semantic architecture, materialization framework, RPG Ruleset boundary, interaction surfaces, and Tactical Activation framework.

Repair abstractions before automating campaign creation.

## Deployment posture

Initial production remains GameFrame + RPG GM Runtime as separate services on one VM behind Cloudflare.

Realtime embodied movement may use the authenticated VM WebSocket path. Semantic commands/recovery remain durable authority paths. Socket state remains disposable.

## Validation posture

Use the evidence layer matching the claim:

- unit/contracts for ruleset/game-family/Battle-Pack/authority/projections;
- materialization/geometry tests;
- runtime machine-play for DM perspective/adjudication;
- actual integration for semantic/materialization linkage;
- tactical tests for shared rules;
- campaign-versus-simulator equivalence tests;
- browser tests for same-map exploration↔tactical transitions;
- browser tests for Role-Playing Games/Battle Simulator navigation and dynamic pack discovery later;
- VM canaries for deployed realtime/recovery;
- media canaries for generation/materialization.

## Immediate GameFrame execution order

1. keep staging usable; repair legacy separate-match consequence bugs only when blocking;
2. establish explicit GameFrame RPG Engine / RPG Ruleset / Game Family boundary;
3. consume Entity/Scene/Observer Knowledge as runtime work lands;
4. build Crooked Checkpoint materialization/movement;
5. extend scene realtime session state;
6. add targeted Pell interaction + Ask-GM + Do Something Else + GM intervention;
7. add second connected scene/stable revisit;
8. extract/promote Monster Master Ruleset + generic control authority;
9. implement same-map Tactical Activation;
10. run complete single-player embodied proof;
11. add two-human one-scene acceptance;
12. prove second handcrafted campaign/game family;
13. implement dynamic Role-Playing Games + Campaign Architect + Battle Pack authoring/consumption contract;
14. implement Battle Simulator dynamic Battle Packs and converge Monster Master Arena Battles on the shared ruleset;
15. productize split-party multi-scene later.

The static Games / Role-Playing Games / Battle Simulator navigation is allowed to land now; steps 13–14 replace static placeholders with data-driven behavior.

## Governing rule

> Deliver one reusable RPG engine and reusable game families underneath clear player surfaces: Role-Playing Games for durable campaigns, Battle Simulator for standalone tactical scenarios, and one shared rules/content foundation wherever the same family appears in both.
