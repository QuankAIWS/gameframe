---
title: RPG Embodied Exploration and Character Performance Contract
status: accepted
document_type: architecture-contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GameFrame RPG
  - Monster Master RPG
  - Monster Master Battle Arena
  - future bespoke campaigns
shared_document_id: rpg-embodied-exploration-and-character-performance-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-embodied-exploration-and-character-performance-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-embodied-exploration-and-character-performance-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-platform-roadmap.md
  - rpg-rendering-and-asset-contract.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cloudflare-deployment-architecture.md
  - ../rpg-gameframe-interface-contract.md
---

# RPG Embodied Exploration and Character Performance Contract

## Decision

The mature RPG player experience is an **embodied persistent 2D campaign world** presented through GameFrame rather than a transcript-first adventure with separate battle maps.

Players normally move through materialized locations, approach entities, inspect objects, use supported mechanics, talk directly to characters, and continue through the same world when initiative or other structured resolution begins.

The Dungeon Master remains a distinct live campaign authority and player-facing presence for adjudication, framing, dramatic intervention, rules/knowledge questions, unusual actions, and consequences that cannot or should not be reduced to fixed videogame affordances.

The graphical world must **increase legibility without reducing tabletop agency**.

> GameFrame materializes the campaign world but does not define the limits of player intent. Ordinary supported actions are performed directly through the embodied world. Any plausible action not represented by an existing interaction may be expressed as freeform intent and adjudicated by the Dungeon Master.

The existing text-first campaign surface remains useful as fallback, accessibility surface, testing harness, recovery/debug surface, GM communication history, and optional alternate presentation. It is not the mature primary loop.

## Product and engine hierarchy

The platform distinguishes reusable engine capability, rulesets, campaign content, and standalone games.

### GameFrame RPG Engine

**GameFrame RPG Engine** is the campaign-agnostic reusable RPG layer inside GameFrame. It owns or provides reusable contracts for:

- exploration/world rendering;
- scene materialization;
- entities and party presence;
- direct interaction;
- character/control authority;
- tactical mode over an existing world scene;
- deterministic mechanics integration;
- world/camera/collision/picking/pathing presentation;
- ruleset integration;
- campaign integration;
- realtime player/session transport;
- player-facing RPG UI primitives.

GameFrame RPG Engine is architecture/platform terminology. The player-facing library destination may simply be called **GameFrame RPG**.

### RPG Ruleset

An **RPG Ruleset** supplies the campaign-agnostic engine with game-specific deterministic rules and capabilities, including as applicable:

- character statistics/classes/archetypes;
- resources and conditions;
- ability/action vocabulary;
- initiative/action economy;
- control/deployment relationships;
- tactical movement/range/line-of-sight semantics;
- legal objectives/outcomes;
- progression/inventory/equipment semantics;
- ruleset-specific world interactions.

A ruleset must not depend on one specific CampaignPackage.

### Monster Master Ruleset

The **Monster Master Ruleset** is the first major rules/content family. It eventually defines one shared source of truth for Monster Master character and combat mechanics used by both Monster Master RPG and Monster Master Battle Arena.

### Monster Master RPG

**Monster Master RPG** is the bespoke Monster Master campaign product:

```text
GameFrame RPG Engine
+ Monster Master Ruleset
+ handcrafted/generated CampaignPackage
+ Monster Master theme/content/assets
```

Monster Master is the first proving family, not the generic engine.

### Monster Master Battle Arena

**Monster Master Battle Arena** is the standalone battle-simulator product:

```text
GameFrame RPG tactical/world subset
+ Monster Master Ruleset
+ standalone BattleScenario
```

It may let players build characters/loadouts, choose or generate a map, create teams/objectives, fight bots or humans, rematch, and inspect/replay battles.

It is deliberately separate from campaign play, but it should converge on the same Monster Master tactical rules and rendering/control semantics as Monster Master RPG.

### GameFrame RPG player surface

**GameFrame RPG** is the future generic player-facing campaign destination for:

- Create Campaign;
- My Campaigns;
- Import CampaignPackage;
- future Campaign Architect intake/refinement;
- generic campaign resume/management.

Monster Master RPG may remain a bespoke library title while using this engine underneath.

## Two-agent architecture remains

This contract does not create a third campaign agent.

The two specialized campaign agents remain:

1. **Campaign Architect** — constructs validated CampaignPackages before ordinary play.
2. **Dungeon Master** — conducts live play from committed package truth and durable campaign state.

Entity Registry, Character Factory, Scene Registry, semantic observer knowledge, world/location services, GameFrame scene materialization, rulesets, tactical activation, deterministic mechanics, and rendering remain substrate rather than additional campaign agents.

The Dungeon Master may execute in several **context modes** without becoming several agents:

- **referee / world adjudication** — broad hidden context required to interpret unusual actions, consequences, checks, events, pacing, and world reactions;
- **Game Master communication** — player-facing rules, character-knowledge, clarification, and table-management responses;
- **entity performance** — portrayal of one specific NPC/entity using only the knowledge, beliefs, memories, observations, goals, relationships, and permitted local context available to that entity;
- **aftermath / intervention** — framing and consequences after deterministic mechanics, scene transitions, or major campaign events.

Context custody must make these modes structurally different. An entity-performance call does not receive the complete hidden campaign bible merely because the same Dungeon Master capability can access it in referee mode.

## Primary player loop

The mature normal loop is:

```text
materialized exploration scene
→ player movement / camera / inspection / interaction
→ direct entity or object interaction
→ deterministic mechanic when available
→ bounded semantic commit when world truth changes
→ player-safe world projection updates
→ continue exploring
```

At any point, the player may use:

```text
Ask Game Master
Do Something Else / freeform action
```

When circumstances require initiative or another strict action economy, the **same materialized scene** enters tactical mode.

```text
exploration
→ Tactical Activation
→ same scene under turn-based authority
→ tactical resolution
→ same scene returns to exploration
```

There is no campaign battle-map loading step and no campaign-only Return-to-Campaign screen because the player never leaves the campaign world.

## Player-facing interaction modes

GameFrame should support the following semantic modes even if the first UI combines some of them.

### Explore

- walk/navigate the current materialized scene;
- camera movement/rotation/zoom where supported;
- select/approach visible entities and interactables;
- inspect viewer-authorized world information;
- operate deterministic world mechanisms;
- use supported inventory/ability/mechanic actions.

### Interact / Talk

The player targets a specific present entity or object.

Talking to `npc.pell` is an in-fiction act directed at Pell. Pell may hear, remember, react, move, refuse, lie, cooperate, or form a relationship according to committed state and Pell-scoped performance context.

Nearby entities perceive the interaction only according to explicit scene/audibility rules. The runtime must not assume all dialogue is global merely because presentation appears in one client.

### Do Something Else

A first-class freeform escape hatch for plausible actions not represented by a dedicated control.

Examples:

- climb a tree to scout;
- cut through woods instead of using the road;
- ask Pell to wait while the player circles around;
- wedge a door with an improvised object;
- attempt a distraction the UI does not model directly.

The Dungeon Master interprets intent. Deterministic validators/mechanics resolve supported aspects. Durable consequences use the appropriate runtime/GameFrame services. The absence of a dedicated button is not itself evidence that an action is impossible.

### Ask Game Master

Out-of-fiction communication with the real Dungeon Master.

Examples:

- "Would my character recognize that insignia?"
- "Would my license let me search that cart?"
- "Do I remember what Pell said about this road?"
- "How would this rule work?"

Ask-GM does not automatically become fictional speech, does not make NPCs hear the request, and does not advance fictional time merely because the player asked.

### GM intervention

The Dungeon Master may proactively address one player, the party, or the table.

Interventions may range from a small nonblocking message to a dramatic scene-freeze presentation. Presentation intensity is not campaign authority by itself; any world-state consequence still requires the appropriate semantic commit.

### Tactical

Tactical mode is a stricter deterministic control regime over the **current materialized world scene**.

It adds initiative, action economy, turn order, legal tactical movement, targeting, attacks/abilities, objective rules, and terminal conditions without replacing the world map.

## World graph

CampaignPackages should be able to declare a semantic **WorldGraph** rather than require one exhaustive authored videogame map.

A WorldGraph represents meaningful regions/locations and relationships, for example:

```text
academy
  -> academy-road

academy-road
  -> checkpoint-district
  -> north-woods

checkpoint-district
  -> west-woods
  -> quarry-road
  -> creek-bank

west-woods
  -> checkpoint-north-approach
  -> old-mill
```

The graph may encode/reference:

- location identity/role;
- parent region;
- known/hidden adjacency;
- route type/traversal conditions;
- biome/environment family;
- important landmarks;
- package-bearing objects/entities;
- event hooks;
- danger/pressure characteristics;
- scene-materialization profile;
- theme/media requirements;
- whether an area is prebuilt, procedurally materializable, abstract travel, or unavailable.

The WorldGraph is semantic campaign truth. It is not Pixi geometry.

## Location semantics and scene specifications

A location may define or derive an exploration-scene specification such as:

```text
location identity
scene/materialization identity
environment and biome
required landmarks/objects
optional landmarks/objects
entry/exit relationships
traversability rules
spawn/arrival zones
important entity placement constraints
interaction affordances
lighting/weather/time intent
asset/theme requirements
seed/materialization version
```

The Campaign Architect/manual authoring decides what the world means. GameFrame decides how supported semantics become playable geometry.

A semantic location must not prescribe Pixi classes, texture coordinates, exact atlas frames, or provider-specific prompts.

## Scene materialization

GameFrame owns deterministic or reproducible materialization of semantic exploration specifications into playable scenes.

Materialization may combine:

1. accepted catalog assets;
2. authored prefabs/world kits;
3. seeded procedural layout;
4. deterministic composition rules;
5. bounded generation of presentation assets;
6. approved fallbacks.

Generated imagery never defines collision or campaign truth by itself. Playable geometry, interactions, and semantic anchors are validated GameFrame structures.

A newly required scene may be materialized on demand when campaign truth establishes that the place plausibly exists. Once accepted for a campaign instance, stable materialization identity, semantic anchors, and durable meaningful changes are preserved so revisiting returns to **that location**, not a fresh random replacement.

This is bounded on-demand world realization, not unrestricted infinite world generation.

## Three levels of spatial state

Keep three concepts separate.

### Semantic world truth — RPG GM Runtime

Examples:

- checkpoint lies east of the woods;
- Pell is currently at the checkpoint;
- bridge is destroyed;
- west woods are traversable;
- monster fled toward quarry road.

This is durable campaign truth.

### Materialized world authority — GameFrame

Examples:

- accepted scene materialization ID/version;
- playable collision/navigation geometry;
- semantic anchor positions;
- spawn/transition zones;
- interactive-object bindings;
- stable scene layout required for revisit/reconnect;
- current deterministic tactical state when tactical mode is active.

### Ephemeral realtime transforms — GameFrame session transport

Examples:

- avatar x/y while walking;
- facing;
- current movement vector;
- transient animation state;
- camera-local presentation state.

These values must not be written into the campaign journal for every frame. Meaningful semantic transitions are committed separately.

## Semantic movement boundaries

High-frequency movement is not automatically a campaign event.

Durable semantic operations are appropriate when movement crosses a meaningful boundary, for example:

- entity enters/leaves/transfers between authoritative scenes;
- player crosses a locked/guarded narrative threshold;
- significant object is moved/destroyed/taken/activated;
- tactical activation changes a semantic state requiring campaign authority;
- entity reaches an exit that changes campaign location/presence.

Do not journal every coordinate update.

## Party cohesion and map transitions

The first embodied multiplayer implementation should preserve a **single active party exploration scene** unless a campaign explicitly requires otherwise.

A bounded first transition rule may require all active party members required for group travel to enter a transition/edge zone before the party transfers to the destination scene. The transfer is one authoritative scene operation and GameFrame loads/materializes the destination as needed.

This keeps party state, NPC context, event eligibility, and model calls tractable while preserving the existing zero-or-more Scene Registry architecture for later expansion.

## Multi-scene authority rule

When players occupy different scenes, each character's physical actions and ordinary observations are scoped to that character's authoritative scene.

The runtime must keep separate:

- physical presence;
- observation/knowledge acquisition;
- audibility/communication relationships;
- presentation audience;
- party membership;
- scene-local event/mechanic custody.

Party membership does not imply magically shared sensory knowledge.

Multiple active scenes are a capability, not the required default UX. Split-party productization remains later because it adds substantial causality, observer-knowledge, concurrency, recovery, and tactical-mode complexity.

## Character performance and perspective custody

A character-performance turn is bound to exactly one performing durable entity.

The context compiler should include only what that entity needs, such as:

- stable identity/role;
- personality/behavior constraints;
- current goals/pressures;
- relevant relationships;
- semantic knowledge/beliefs available to the entity;
- relevant memories/promises;
- current scene observations;
- conditions/injuries/resources where relevant;
- bounded recent conversation;
- package invariants required for portrayal without exposing unrelated hidden truth.

The model may propose speech, local reaction, bounded local action, relationship/memory intent, a mechanic request, or escalation to referee mode. Consequential output remains a proposal until validated/committed.

## Observer knowledge

The semantic knowledge model generalizes from player-only language to **observer knowledge** where implementation requires it.

Observers may include:

- player characters;
- NPCs;
- intelligent creatures;
- explicit party/table audiences;
- other bounded observers justified by a real mechanic.

The system remains sparse. Do not eagerly create every possible observer × fact edge.

Player-facing People/knowledge projections remain viewer-safe read models over this broader semantic model.

## NPC conversation persistence

Conversation transcript is not the sole authority for what an NPC remembers.

Durable promises, debts, insults, tasks, relationships, learned names, witnessed events, injuries, custody, suspicions, and important disclosures should promote into typed semantic knowledge/memory/relationship state when they matter.

Bounded recent dialogue may support conversational continuity, but transcript history must not become the only persistent character-memory mechanism.

## GM communication log

GameFrame should retain a dedicated Game Master communication/history surface separate from ordinary entity conversation.

It may contain:

- player Ask-GM requests/answers;
- GM-initiated narration/interventions for that audience;
- mechanical clarifications;
- player-private knowledge responses;
- important GM/system rulings where review is useful.

Talking to an NPC must not be represented as talking to the GM merely because the Dungeon Master capability performed the character.

## GM interventions

A GM intervention presentation should carry explicit semantics such as:

```text
origin: dungeon-master
audience: player | party | table
intensity: advisory | narration | dramatic
interaction: nonblocking | pause-local-control | freeze-scene
```

A dramatic intervention may temporarily pause local exploration/tactical input while narration/cinematic presentation runs. Pausing input is presentation/control state, not permission to mutate campaign truth without a semantic operation.

## Cinematic scripts

Ordinary cutscenes should normally be **semantic cinematic scripts**, not generated video.

A cinematic script may request supported operations such as:

```text
camera.focus
camera.pan
camera.shake
entity.move
entity.face
entity.pose
dialogue.present
gm.intervention
sound.play
music.transition
effect.play
resolution_mode.change
```

GameFrame validates/executes supported presentation commands. The script may reference stable semantic asset/entity IDs but does not become campaign authority.

## Tactical activation

### Same-world rule

Campaign combat does not spin up Monster Master Battle Arena or a separate tactical map.

A **Tactical Activation** changes the rules of control over the current GameFrame scene.

Before activation, GameFrame/runtime establish a validated tactical snapshot using:

- semantic scene ID/revision;
- materialization ID/version;
- current tactically relevant entity positions/facing;
- factions/teams/dispositions;
- control authority;
- health/resources/conditions;
- current deterministic map geometry;
- relevant objects/hazards/exits/objectives;
- ruleset/version/capability profile.

The player's current positions become tactical starting positions unless an explicit supported rule says otherwise.

During tactical mode:

- map identity is unchanged;
- important world objects are the same objects;
- entity identity is unchanged;
- deterministic movement/actions use the same GameFrame geometry;
- escape/withdrawal uses actual supported exits/zones;
- tactical UI/overlays may change substantially without creating a replacement world.

When terminal tactical conditions are satisfied, consequences commit and the scene returns to exploration control. There is no campaign `Return to Campaign` navigation step.

### Tactical Activation Coordinator

The campaign-side semantic coordinator formerly described as an Encounter Scene Compiler should evolve into a **Tactical Activation Coordinator** or equivalent.

Its job is to validate/coordinate entry into tactical authority, not compile a second scene.

## Control authority and rulesets

The engine must not hardcode "one player controls one character" or "one trainer controls exactly one monster."

A ruleset defines legal control relationships.

For Monster Master, one human principal may control:

- their Master/trainer character;
- one or more deployed monsters according to class/ruleset limits;
- additional bounded entities only when explicit mechanics authorize it.

The generic engine should be able to represent a principal, player-character entity, and controlled/commandable entity set without assuming Monster Master-specific counts.

## Standalone BattleScenario

Monster Master Battle Arena should use a standalone scenario contract rather than CampaignPackage authority.

A future `BattleScenario` may describe:

- map/materialization selection or generation request;
- ruleset/profile/version;
- players/trainers/monsters/loadouts;
- teams/controllers;
- deployment/starting-position rules;
- objectives;
- bot profiles;
- environment options.

After setup, the Battle Arena should use the same Monster Master tactical rules and GameFrame tactical-mode implementation as the RPG wherever capabilities match.

## Realtime transport posture

The existing hybrid Cloudflare + VM architecture remains valid.

### Durable HTTP/service commands

Appropriate for semantic mutations such as:

- campaign attachment/recovery;
- Ask-GM;
- freeform semantic actions;
- inventory/equipment changes;
- meaningful object interactions;
- authoritative scene transfers;
- mechanics/checks;
- tactical activation/termination coordination;
- recovery snapshots.

### Realtime WebSocket/session traffic

Appropriate for:

- bounded movement input/state;
- facing/transient avatar transforms;
- nearby-player transform projection;
- local realtime animation/projection;
- post-commit change notifications;
- scene-presence/session coordination where it does not replace durable authority.

WebSocket/session state is disposable transport/session state. Durable campaign truth remains reconstructible after disconnect/restart.

## Failure and recovery

If the realtime exploration connection drops:

- campaign truth remains intact;
- local movement input stops/degrades safely;
- reconnect restores authoritative materialized scene and valid participant position according to GameFrame policy;
- semantic scene membership is recovered from durable state;
- client does not replay arbitrary stale movement packets as campaign actions.

If optional generated media is unavailable, play uses catalog/composed/fallback representation.

If a Dungeon Master provider is unavailable, deterministic movement and already-supported scene interactions may remain usable where they do not require new semantic adjudication.

## First Monster Master embodied proof

A convincing first reference journey should prove:

1. load one materialized Crooked Checkpoint exploration scene;
2. move player avatar through authoritative GameFrame geometry;
3. approach/talk directly to Pell;
4. prove Pell-scoped context cannot access a campaign fact Pell does not know;
5. Ask the Game Master an out-of-fiction rules/knowledge question;
6. inspect/interact with one semantic world object;
7. choose a plausible alternate route such as the woods;
8. transfer/materialize a second connected exploration scene;
9. use Do Something Else for one unsupported plausible action;
10. adjudicate/commit resulting semantic consequence;
11. trigger/avoid an event/check based on resulting state;
12. revisit a previously materialized scene without identity/layout/world-state drift;
13. trigger Tactical Activation in the current scene;
14. roll/establish initiative without loading a replacement battlefield;
15. resolve tactical actions using current map geometry/positions;
16. commit exact tactical/world consequences;
17. remove tactical control UI and resume exploration on the same map;
18. restart services and recover world, scene, NPC, knowledge, materialization, and tactical aftermath without duplication.

The first proof may keep the party in one exploration scene at a time.

## First multiplayer posture

Initial two-human embodied play should prefer one shared active scene with explicit party-cohesion transitions.

Acceptance should prove:

- separate authenticated player avatars;
- realtime movement projection;
- one authoritative semantic scene membership;
- distinct player knowledge where applicable;
- shared/private GM communication audiences;
- direct NPC interaction custody;
- deterministic party transition to another scene;
- same-map cooperative tactical activation;
- reconnect without duplicate presence.

Split-party play is a later acceptance layer.

## Split-party / multi-map posture

Multiple simultaneous active scenes are supported by the authority model but carry materially higher implementation/operational weight.

They require at least:

- per-player authoritative scene assignment;
- independent realtime scene subscriptions;
- scene-scoped event/entity projections;
- observer-knowledge divergence;
- explicit cross-scene communication semantics;
- concurrency-safe Dungeon Master turns;
- independent scene materialization/recovery;
- rules for party-wide clocks/pressure/events/shared objectives;
- clear behavior when one scene enters tactical mode while another remains exploratory;
- player-facing UI making separation/communication legible.

Therefore architect for multiple scenes now but productize one shared party scene first.

## Non-goals of the first embodied implementation

- unrestricted infinite open-world generation;
- persistent frame-by-frame coordinate journaling in RPG GM Runtime;
- fully autonomous background LLM processes for every NPC;
- generating a new image for every movement/action;
- generated video as ordinary cutscene mechanism;
- split-party multiplayer before one-scene party exploration is proven;
- replacing Dungeon Master with NPC agents;
- making every decorative object a durable campaign entity;
- treating visual map geometry as hidden campaign truth;
- forcing every plausible freeform action into a permanent bespoke mechanic;
- separate campaign battlefields merely because tactical rules activate.

## Governing rules

> The campaign is a durable semantic world that GameFrame materializes into playable space; the materialized world makes ordinary action direct and legible without becoming the boundary of imagination.

> The Dungeon Master remains the referee and narrative authority, but a character portrayed by the Dungeon Master receives character-scoped knowledge rather than omniscient hidden truth.

> Tactical activation changes the rules of control, not the place. Standalone Monster Master Battle Arena is a separate product that begins from battle setup but should share the same Monster Master tactical rules.

> Architect for multiple active scenes; prove one shared party scene first; split the party only after scene-scoped realtime, knowledge, event, mechanic, and recovery semantics are trustworthy.
