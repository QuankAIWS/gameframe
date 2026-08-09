---
title: RPG Platform Product Goals
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
  - scribbles-runtime-theo-connector
shared_document_id: rpg-platform-product-goals-v1
shared_document_version: 7
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-product-goals.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-product-goals.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-platform-roadmap.md
  - ../rpg-campaign-experience-directions.md
  - ../rpg-gm-runtime-boundary.md
  - rpg-cloudflare-deployment-architecture.md
  - rpg-media-theme-and-audio-pipeline.md
---

# RPG Platform Product Goals

## Product statement

The RPG platform is a persistent, publicly accessible **embodied generative role-playing system** played through GameFrame.

A specialized Campaign Architect creates validated CampaignPackages and, later, the reusable game-family material required to make generated combat-capable RPGs available through both campaign play and standalone Battle Simulator play. RPG GM Runtime owns durable semantic campaign truth, entity identity, scene membership, observer knowledge, events, consequences, and Dungeon Master intelligence. GameFrame materializes that truth into persistent playable 2D worlds and owns deterministic game mechanics, realtime player interaction, tactical authority, and presentation.

Ordinary supported actions happen directly in the world. The Dungeon Master remains a distinct real Game Master for rulings, player knowledge questions, dramatic narration/intervention, unusual freeform actions, character performance, and consequences that fixed controls cannot express.

> The graphics visualize and operationalize the imagination; they do not define the limits of the imagination.

## Player-facing Games hierarchy

The top-level GameFrame destination is **Games**.

It may contain broad play surfaces as well as direct standalone games. The initial hierarchy is:

```text
Games
├── Role-Playing Games
│   ├── Monster Master RPG
│   ├── future handcrafted/generated RPGs
│   └── Create RPG / My Campaigns / Import Campaign
├── Battle Simulator
│   ├── Monster Master Arena Battles
│   ├── future handcrafted/generated Battle Packs
│   └── Custom Battle / map generation / import
├── Clockwork Checkers
├── Othello
└── Tic-Tac-Toe
```

**GameFrame RPG Engine** is internal architecture terminology, not a player-facing top-level game card. The player-facing campaign surface is **Role-Playing Games**.

**Battle Simulator** is the player-facing standalone tactical sandbox. A game family such as Monster Master appears *inside* Battle Simulator rather than occupying a second top-level card beside its RPG.

## Product hierarchy

The platform distinguishes **engine**, **ruleset**, **game family/content**, **campaign content**, and **standalone battle content**.

### GameFrame RPG Engine

**GameFrame RPG Engine** is the reusable campaign-agnostic RPG layer inside GameFrame.

It provides reusable capability for:

- persistent world/scene materialization;
- realtime exploration;
- entity/party/player presence;
- direct interaction and inspection;
- character and controlled-entity authority;
- tactical mode over the current scene;
- deterministic mechanics;
- ruleset integration;
- camera/collision/pathing/picking/rendering;
- campaign integration;
- realtime transport/recovery;
- player-facing RPG UI primitives.

### RPG Ruleset

An **RPG Ruleset** defines game-specific deterministic mechanics independent of one CampaignPackage, including as applicable:

- character/class/archetype rules;
- resources/conditions;
- abilities/actions;
- initiative/action economy;
- tactical movement/range/line-of-sight;
- character-to-controlled-entity relationships;
- deployment limits;
- objectives/outcomes;
- progression/inventory/equipment;
- ruleset-specific world interactions.

The generic engine must not assume that every future generated RPG uses Monster Master rules. Long-term Campaign Architect work may select an existing ruleset, parameterize a validated ruleset profile, or produce a new bounded ruleset definition only after the reusable ruleset schema/capability system is itself proven.

### Game family

A **Game Family** is the reusable rules/content identity shared by related campaign and simulator experiences.

Conceptually it may bind:

- one compatible RPG Ruleset/version/profile family;
- character/archetype/creature definitions;
- equipment/abilities/conditions;
- factions/opponent families;
- world/materialization themes and kits;
- reusable asset catalog entries;
- tactical objectives and environment semantics;
- compatible CampaignPackages;
- one or more Battle Packs.

A Game Family is not required to expose every surface. A narrative-only RPG may have no Battle Pack. A tactical-only family may exist only in Battle Simulator.

### Monster Master Ruleset / Game Family

**Monster Master** is the first major rules/content family. The **Monster Master Ruleset** should eventually be the shared deterministic source for Monster Master character and combat rules across campaign and standalone battle products.

### Monster Master RPG

**Monster Master RPG** is the first bespoke campaign product:

```text
GameFrame RPG Engine
+ Monster Master Ruleset / game-family content
+ committed Monster Master CampaignPackage
```

The handcrafted reference campaign proves the engine and package architecture without making Monster Master itself the generic platform.

### Battle Simulator

**Battle Simulator** is the standalone tactical product surface.

It can host multiple game families without creating separate tactical engines for each one.

A standalone battle conceptually uses:

```text
GameFrame tactical/world systems
+ selected RPG Ruleset / game-family content
+ selected Battle Pack
+ BattleScenario
```

Its setup may eventually include character/loadout construction, map selection/generation, teams, deployment, objectives, humans/bots, replay, and rematch.

Campaign combat never launches Battle Simulator. Campaign tactical play and standalone Battle Simulator play converge on shared ruleset/tactical implementation, but their setup and lifecycle are different.

### Monster Master Arena Battles

**Monster Master Arena Battles** is the Monster Master entry inside Battle Simulator.

It evolves from the existing standalone Monster Master tactical game and should converge on the same Monster Master Ruleset, control semantics, terrain semantics, legal actions, objectives, and terminal outcomes used by Monster Master RPG.

### Battle Pack

A **Battle Pack** is the simulator-safe reusable tactical content surface for one game family/ruleset profile. It is not a second ruleset and must not fork combat behavior from the corresponding RPG.

A Battle Pack may expose/reference:

- playable character/archetype templates;
- creatures/opponents/factions;
- equipment/loadouts/abilities available to standalone setup;
- map themes, world kits, terrain/hazard families, and map-generation constraints;
- deployment options;
- objective presets;
- bot behavior profiles;
- scenario presets/examples;
- compatible asset bundles;
- ruleset/profile/version requirements;
- visibility/unlock policy.

A Battle Pack deliberately excludes or masks campaign-only hidden truth unless an explicit exposure/unlock rule allows it.

For example, a secret campaign villain or unrevealed monster form must not automatically appear in Battle Simulator merely because the underlying campaign package knows it exists.

### Role-Playing Games

**Role-Playing Games** is the generic player-facing campaign destination for:

- available bespoke/generated RPGs;
- Create RPG from an idea;
- My Campaigns;
- Import CampaignPackage;
- Campaign Architect intake/refinement;
- campaign preview/commit/resume/management.

Monster Master RPG appears inside this surface while using GameFrame RPG Engine underneath.

## Two specialized agents

The platform retains exactly two campaign-agent responsibilities.

### Campaign Architect

Campaign Architect converts a concise concept, detailed specification, structured sheet, prepared campaign family, or imported source into one validated CampaignPackage draft before ordinary play.

Long-term, when a concept requires a new game family rather than only a new campaign under an existing family, Campaign Architect may also coordinate generation/selection of validated reusable ruleset-profile/content definitions and a simulator-safe Battle Pack. That broader generation capability remains deferred until the generic engine and ruleset interfaces survive multiple handcrafted families.

It owns campaign construction, not live turns. Drafts may be owner-refined before explicit commitment.

### Dungeon Master

Dungeon Master consumes a committed CampaignPackage and durable campaign state.

It owns or proposes, through validated operations:

- referee/world adjudication;
- narration/framing;
- arbitrary plausible freeform intent interpretation;
- character/NPC performance;
- Ask-GM rules/knowledge responses;
- eligible events and pacing;
- package-compatible improvisation;
- consequences;
- checks and deterministic-mechanic requests;
- tactical activation requests/reasons;
- aftermath/intervention.

Dungeon Master does not replace package truth, durable identity, semantic scene presence, viewer/observer authorization, or deterministic GameFrame outcomes.

Character performance is a Dungeon Master context mode, not a third agent. A Pell performance context receives Pell-authorized knowledge and observations, not the full hidden campaign bible.

## CampaignPackage

Handcrafted and generated campaigns use the same package schema, validation, persistence, commitment, visibility, world/entity/scene initialization, and Dungeon Master interface.

A package should be able to declare:

- campaign identity/premise/tone;
- runtime-only bible/secrets/causality;
- package-bearing actors/entities;
- WorldGraph/location semantics/routes;
- initial scenes/presence;
- observer/player knowledge bootstrap;
- events/clues/objectives/consequences;
- supported ruleset/capability requirements;
- semantic materialization/media intents;
- complete starter/resolution material;
- provenance/version/hash/migration data.

Generated pixels, client coordinates, and Pixi implementation details are not CampaignPackage truth.

CampaignPackage and Battle Pack are distinct artifacts with different visibility/lifecycle requirements. They may reference the same game-family rules/content/assets without duplicating them.

## One complete GameFrame experience

GameFrame is the primary authenticated player application for:

- Games navigation;
- Role-Playing Games selection/creation/preview/join/resume;
- Battle Simulator family/scenario selection;
- persistent materialized maps and exploration;
- direct NPC/entity/object interaction;
- character/party/controlled-entity views;
- People/knowledge/current-scene information;
- **Do Something Else** freeform intent;
- **Ask Game Master** communication;
- GM interventions/cinematics;
- inventory/equipment/abilities/conditions/progression as rulesets implement them;
- objectives/clues/factions/locations/handouts;
- deterministic checks/mechanics;
- same-map tactical mode;
- standalone tactical simulation through shared ruleset primitives;
- history/recap/reconnect/recovery;
- accepted art/animation/sound/music/narration.

Discord may provide authentication, invitations, voice, social conversation, notifications, links, and later campaign-intake interviews. Discord does not own campaign truth or ordinary gameplay.

## Persistent world goal

Campaigns are durable worlds, not disposable model conversations.

The platform must preserve:

- stable campaign/entity/location/item/asset identities;
- zero-or-more authoritative semantic scenes;
- explicit physical scene membership;
- persistent/reproducible GameFrame scene materializations;
- meaningful environmental changes;
- observer-specific knowledge/beliefs;
- deterministic retry/reconnect;
- semantic history and correction;
- backup/restore/recap/resume;
- separate runtime and GameFrame authority positions.

High-frequency movement coordinates remain GameFrame realtime/session state unless they cross a meaningful semantic boundary.

## Embodied freedom rule

The default mature loop is direct play through the world, but direct UI affordances are not the complete action space.

At any time a player may submit a plausible unsupported intent through **Do Something Else**. Dungeon Master interprets it, deterministic systems resolve supported mechanics, and validated semantic consequences return to world state.

This is a core product property, not a fallback for a broken UI.

## Same-map tactical rule

When circumstances require initiative or strict turn-based mechanics, the current materialized scene enters **Tactical Mode** through a validated **Tactical Activation**.

The map does not change.

- current positions become tactical starting positions;
- current people/monsters/objects remain the same entities;
- current collision/navigation geometry remains the same GameFrame world geometry;
- tactical overlays/action economy/turn order become active;
- escape/withdrawal uses real supported scene exits/zones;
- terminal tactical consequences update the same world;
- exploration resumes in place after safe semantic/mechanical reconciliation.

There is no campaign `Return to Campaign` screen because campaign combat never leaves the campaign world.

The old `Encounter Scene Compiler` destination should be replaced by **Tactical Activation Coordinator** semantics: validate and coordinate entry into tactical authority rather than compile another battlefield.

## Player/control authority goal

The engine must support ruleset-defined control relationships rather than hardcode one player → one unit.

For Monster Master, a human principal may control:

- their own Master/trainer character;
- one or more deployed monsters according to class/ruleset limits;
- other entities only when explicit rules grant authority.

This control model must support future classes and future game families with different deployment counts and action/control patterns without changing the generic engine contract.

## World/materialization goal

CampaignPackage semantic WorldGraph/location intent is materialized by GameFrame into playable scenes using:

1. accepted catalog reuse;
2. deterministic authored/procedural composition;
3. reusable world kits/prefabs;
4. bounded generated presentation assets when justified;
5. validated fallbacks.

Once accepted for a campaign instance, a scene materialization retains stable identity and meaningful state so revisiting returns to the same place.

Battle Simulator may use the same materialization/world-kit systems to create standalone battlefields from Battle Pack constraints without creating campaign semantic history.

The product does not require unrestricted infinite procedural generation. It does require bounded on-demand realization of plausible semantic locations/approaches and bounded standalone battlefield generation.

## Shared asset/content reuse goal

If a campaign/game family already has usable character art, creature art, terrain, props, effects, map kits, abilities, equipment, and tactical definitions, Battle Simulator should reuse them rather than require a second asset pipeline.

The same principle applies in reverse: simulator-proven generic tactical primitives may become reusable GameFrame RPG Engine or ruleset capability when deliberately promoted.

Reuse does not override visibility. Campaign-only spoilers remain hidden unless the Battle Pack exposure policy permits them.

## Media goal

Generated/composed media is presentation, not campaign authority.

GameFrame should reuse first, compose second, generate when justified, preserve recurring identities/provenance, enforce budgets, and keep legal play possible through fallbacks.

Ordinary cutscenes should primarily use semantic cinematic scripts executed by GameFrame rather than generated video.

## Deployment goal

The first production profile remains hybrid Cloudflare + private VM:

- public GameFrame through Cloudflare;
- no inbound router forwarding/player VPN requirement;
- private loopback GameFrame RPG authority and RPG GM Runtime on the VM;
- separate durable stores/services/secrets;
- WebSocket/realtime transport for embodied session state;
- durable semantic commands/recovery preserved independently;
- evidence-based path to future migration rather than architecture churn for its own sake.

## First product proof — embodied Monster Master

The first convincing engineering proof should demonstrate:

1. committed handcrafted Monster Master package/world;
2. materialized Crooked Checkpoint exploration scene;
3. direct movement/interaction;
4. direct Pell conversation using Pell-scoped knowledge;
5. Ask-GM and Do Something Else;
6. observer-safe People/knowledge state;
7. meaningful world object interaction;
8. alternate-route/second-scene materialization and stable revisit;
9. event/check progression;
10. same-map Tactical Activation using current positions/geometry;
11. Monster Master character + controlled-monster authority;
12. structured non-elimination outcome where appropriate;
13. direct return from tactical to exploration control on the same scene;
14. restart/reconnect/resume without duplication, secret leakage, or world drift;
15. bounded campaign resolution.

The first multiplayer proof should use two humans in one shared active scene before split-party productization.

## Generality proof before Campaign Architect

A materially different second handcrafted CampaignPackage/game family must use the same:

- GameFrame RPG Engine;
- package validator;
- Entity/Scene/Observer Knowledge substrate;
- Dungeon Master context-mode architecture;
- world/materialization contracts;
- ruleset interface;
- campaign UI primitives;
- Tactical Activation framework where relevant.

If it requires a campaign-specific engine/control plane, repair the abstraction before automating campaign generation.

## Campaign Architect proof

Only after handcrafted generality is proven:

```text
player idea
→ Campaign Architect draft
→ select/create compatible ruleset profile + reusable game-family content as needed
→ CampaignPackage
→ Battle Pack when combat-capable and appropriate
→ optional owner refinement
→ validation/repair
→ player-safe preview
→ explicit commitment
→ materialized playable campaign through Role-Playing Games
→ standalone simulator content available through Battle Simulator under exposure policy
```

Generated campaigns must not require a special Dungeon Master or bespoke GameFrame engine branch. Generated Battle Packs must not create a second combat-rules implementation.

## Multi-scene posture

Architect the semantic Scene Registry for zero-or-more active scenes now, but productize one shared party scene first.

Simultaneous split-party scenes require additional scene-scoped realtime, observer-knowledge divergence, concurrency, event/time semantics, recovery, and rules for one scene entering tactical mode while another continues. That complexity is deferred until one-scene embodied multiplayer is proven.

## Non-goals

The product direction does not require:

- a separate Monster Master Dungeon Master;
- a third NPC agent;
- generated media before logic works;
- a new image for every action;
- unrestricted infinite open-world generation;
- per-frame movement journaling in RPG GM Runtime;
- separate campaign battle maps;
- using Battle Simulator as the campaign combat lifecycle;
- duplicating an RPG's combat rules inside its Battle Pack;
- automatically exposing campaign secrets in Battle Simulator;
- every improvised object becoming a permanent mechanic;
- split-party multiplayer in the first embodied slice;
- Tailscale/router forwarding for players;
- direct copying of protected campaigns/media;
- merging all repositories/services/databases.

## Governing rule

> Build one campaign-agnostic GameFrame RPG Engine and reusable rules/content families underneath the player-facing Games surfaces. Role-Playing Games hosts persistent campaigns; Battle Simulator hosts standalone scenarios through Battle Packs; when the same game family appears in both, it shares one ruleset and one reusable content/asset foundation rather than two drifting combat systems.
