---
title: RPG Embodied Exploration and Character Performance Contract
status: accepted
document_type: architecture-contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
  - future bespoke campaigns
shared_document_id: rpg-embodied-exploration-and-character-performance-v1
shared_document_version: 1
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

The mature RPG player experience is an **embodied persistent 2D campaign world** presented through GameFrame rather than a transcript-first adventure with occasional tactical scenes.

Players normally move through materialized locations, approach entities, inspect objects, use supported mechanics, talk directly to characters, and enter tactical encounters from the same durable campaign world. The Dungeon Master remains a distinct live campaign authority and player-facing presence for adjudication, framing, dramatic intervention, rules/knowledge questions, unusual actions, and consequences that cannot or should not be reduced to fixed videogame affordances.

The graphical world must **increase legibility without reducing tabletop agency**.

> GameFrame materializes the campaign world but does not define the limits of player intent. Ordinary supported actions are performed directly through the embodied world. Any plausible action not represented by an existing interaction may be expressed as freeform intent and adjudicated by the Dungeon Master.

The existing text-first campaign surface remains useful as a fallback, accessibility surface, testing harness, recovery/debug surface, and optional presentation mode. It is not the mature primary loop.

## Two-agent architecture remains

This contract does not create a third campaign agent.

The two specialized campaign agents remain:

1. **Campaign Architect** — constructs validated CampaignPackages before ordinary play.
2. **Dungeon Master** — conducts live play from committed package truth and durable campaign state.

Entity Registry, Character Factory, Scene Registry, semantic knowledge, exploration materialization adapters, encounter compilation, deterministic mechanics, and GameFrame rendering remain runtime/platform substrate.

The Dungeon Master may execute in several **context modes** without becoming several agents:

- **referee / world adjudication** — broad hidden campaign context required to interpret unusual actions, consequences, checks, events, pacing, and world reactions;
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

When campaign circumstances justify it, the Dungeon Master may issue a narration/intervention presentation. When tactical authority is needed, the current exploration scene becomes tactically strict through the Encounter Scene Compiler and Arena Battles.

## Player-facing interaction modes

GameFrame should support the following semantic modes even if the first UI combines some of them:

### Explore

- walk or otherwise navigate the current materialized scene;
- camera movement/rotation/zoom where the renderer supports it;
- select or approach visible entities and interactables;
- inspect viewer-authorized world information;
- operate deterministic world mechanisms;
- use supported inventory/ability/mechanic actions.

### Interact / Talk

The player targets a specific present entity or object.

Talking to `npc.pell` is an in-fiction act directed at Pell. Pell may hear, remember, react, move, refuse, lie, cooperate, or form a relationship according to committed state and Pell-scoped performance context.

Nearby entities may perceive the interaction only according to explicit scene/audibility rules. The runtime must not assume all dialogue is global merely because presentation appears in one client.

### Do Something Else

A first-class freeform escape hatch for plausible actions not represented by a dedicated control.

Examples:

- climb a tree to scout the checkpoint;
- cut through the woods instead of using the road;
- ask Pell to wait while the player circles around;
- wedge a door with an improvised object;
- attempt a distraction the UI does not model directly.

The Dungeon Master interprets the intent. Deterministic validators/mechanics resolve supported aspects. New durable entities/scenes/objects use the appropriate runtime services. The absence of a dedicated button is not itself evidence that an action is impossible.

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

Arena Battles is a stricter deterministic resolution mode for the same campaign scene. Exact supported entities, roles, objects, exits, objectives, and source-scene provenance survive the handoff and aftermath returns to the surrounding campaign world.

## World graph

CampaignPackages should be able to declare a semantic **WorldGraph** rather than require one exhaustive authored videogame map.

A WorldGraph represents meaningful regions/locations and their relationships, for example:

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

The graph may encode or reference:

- location identity and role;
- parent region;
- known/hidden adjacency;
- route type and traversal conditions;
- biome/environment family;
- important landmarks;
- package-bearing objects/entities;
- authored or generated encounter/event hooks;
- danger/pressure characteristics;
- scene-materialization profile;
- theme/media requirements;
- whether an area is prebuilt, procedurally materializable, abstract travel, or unavailable.

The WorldGraph is semantic campaign truth. It is not Pixi geometry.

## Location semantics and exploration scene specifications

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
encounter-capable areas
lighting/weather/time intent
asset/theme requirements
seed/materialization version
```

The Campaign Architect or manual authoring decides what the world means. GameFrame decides how supported semantics become playable geometry.

A semantic location must not prescribe Pixi classes, texture coordinates, exact atlas frames, or provider-specific prompts.

## Scene materialization

GameFrame owns deterministic or reproducible materialization of semantic exploration specifications into playable scenes.

Materialization may combine:

1. accepted catalog assets;
2. authored prefabs and location kits;
3. seeded procedural layout;
4. deterministic composition rules;
5. bounded generation of presentation assets;
6. approved fallbacks.

Generated imagery never defines collision or campaign truth by itself. Playable geometry, interactions, and semantic anchors are produced through validated GameFrame structures.

A newly required scene may be materialized on demand when campaign truth establishes that the place plausibly exists. Once accepted/materialized for a campaign instance, its stable materialization identity, semantic anchors, and durable meaningful changes must be preserved so revisiting the location returns to **that location**, not a fresh random replacement.

This is bounded on-demand world realization, not unrestricted infinite world generation.

## Three levels of spatial state

Keep three distinct concepts separate.

### Semantic world truth — RPG GM Runtime

Examples:

- the checkpoint lies east of the woods;
- Pell is currently at the checkpoint;
- the bridge is destroyed;
- the west woods are traversable;
- a monster fled toward the quarry road.

This state is durable campaign truth.

### Materialized exploration authority — GameFrame

Examples:

- accepted scene materialization ID/version;
- playable collision geometry;
- semantic anchor positions;
- spawn/transition zones;
- interactive-object bindings;
- deterministic navigation data;
- stable scene layout required for reconnect/revisit.

GameFrame owns the playable realization of the semantic scene.

### Ephemeral realtime transforms — GameFrame session transport

Examples:

- avatar x/y position while walking;
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
- a significant object is moved, destroyed, taken, or activated;
- an encounter acquires custody;
- a player establishes or breaks contact with a remote/isolated scene;
- an entity reaches a semantic exit that changes campaign location/presence.

Do not journal every coordinate update.

## Party cohesion and map transitions

The first embodied multiplayer implementation should preserve a **single active party exploration scene** unless a campaign explicitly requires otherwise.

A bounded first transition rule may require all active party members who are required for group travel to enter a transition/edge zone before the party transfers to the destination scene. The transfer is one authoritative scene operation and GameFrame loads/materializes the destination as needed.

This keeps party state, NPC context, event eligibility, and model calls tractable while preserving the existing zero-or-more Scene Registry architecture for later expansion.

The Scene Registry remains capable of multiple simultaneous active scenes so later versions may support:

- split parties;
- scouting groups;
- remote contacts;
- separated combat/exploration scenes;
- simultaneous conversations;
- asynchronous or temporarily isolated players.

Multiple active scenes are a capability, not the required default UX.

## Multi-scene authority rule

When players occupy different scenes, each character's physical actions and ordinary observations are scoped to that character's authoritative scene.

The runtime must keep separate:

- physical presence;
- observation/knowledge acquisition;
- audibility/communication relationships;
- presentation audience;
- party membership.

Party membership does not imply magical shared sensory knowledge. A future campaign may deliberately share information through radios, telepathy, party UI policy, or later conversation, but that must be explicit.

## Character performance and perspective custody

A character-performance turn is bound to exactly one performing durable entity.

The context compiler should include only what that entity needs, such as:

- stable entity identity and role;
- personality/behavioral constraints;
- current goals and pressures;
- relationships relevant to the interaction;
- semantic knowledge/beliefs available to that entity;
- memories and promises relevant to the interaction;
- current scene observations;
- current conditions/injuries/resources where relevant;
- bounded recent conversation with the interacting actor(s);
- package invariants that constrain portrayal without exposing unrelated hidden truth.

The context must exclude unrelated runtime-only campaign facts merely because they exist in the CampaignPackage.

The model may propose:

- speech;
- local emotional/reaction state;
- a bounded local action;
- relationship/memory intent;
- a request for a check or mechanic;
- an escalation or handoff request to referee mode when the interaction requires broader adjudication.

Consequential output remains a proposal until validated and committed.

## Observer knowledge

The existing semantic knowledge model should generalize from player-only language to **observer knowledge** where required by implementation.

Observers may include:

- player characters;
- NPCs;
- intelligent creatures;
- explicit party/table audiences;
- other bounded campaign observers when a real mechanic requires them.

The system remains sparse. Do not eagerly create every possible observer × fact edge.

Player-facing People/knowledge projections remain viewer-safe projections over this broader semantic model.

## NPC conversation persistence

Conversation history is not the sole authority for what an NPC remembers.

Durable facts such as promises, debts, insults, tasks, relationships, learned names, witnessed events, injuries, custody, suspicions, and important disclosures should promote into typed semantic knowledge/memory/relationship state when they matter.

Bounded recent dialogue may support conversational continuity, but model transcript history must not become the only source of persistent character memory.

## GM communication log

GameFrame should retain a dedicated Game Master communication/history surface separate from ordinary entity conversation.

It may contain:

- player Ask-GM requests and answers;
- GM-initiated narration/interventions appropriate to that audience;
- mechanical clarifications;
- player-private knowledge responses;
- important GM/system rulings where review is useful.

Talking to an NPC should not be represented as talking to the GM merely because the Dungeon Master capability performed the character.

## GM interventions

A GM intervention presentation should carry explicit semantics such as:

```text
origin: dungeon-master
audience: player | party | table
intensity: advisory | narration | dramatic
interaction: nonblocking | pause-local-control | freeze-scene
```

The exact schema may differ, but the client must not guess a dramatic world freeze from prose style.

A dramatic intervention may temporarily pause local exploration input while narration/cinematic presentation runs. Pausing input is presentation/control state, not permission to mutate campaign truth without a semantic operation.

## Cinematic scripts

Generated cutscenes should normally be **semantic cinematic scripts**, not generated video.

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
encounter.transition
```

GameFrame validates and executes only supported presentation commands. The script may reference stable semantic asset/entity IDs but does not become campaign authority.

Special generated poses, splash art, or scene assets may be requested through the media pipeline when justified. Existing/fallback presentation must remain available when generation is unavailable.

## Exploration-to-Arena continuity

Exploration and tactical play are two resolution modes over one campaign world.

Target flow:

```text
authoritative semantic scene
+ accepted exploration materialization
+ current campaign entities/objects/objectives
→ Encounter Scene Compiler
→ GameFrame tactical materialization
→ authoritative tactical outcome
→ runtime world/scene reconciliation
→ GameFrame exploration scene update
→ control returns to embodied campaign
```

The post-encounter exploration scene must reflect supported durable consequences: defeated/fled/withdrawn entities, damaged/moved objects, changed exits, custody, injuries, conditions, or other committed outcomes.

Returning to the same route or renderer without reconciliation is not proof of continuity.

## Incidental explorable areas

A player may choose a plausible route that was not expected by the authored starter path.

If campaign/world semantics establish that the area exists and exploration is allowed, the system may materialize an incidental scene instead of rejecting the action merely because no handcrafted map exists.

The runtime may need the Dungeon Master to adjudicate semantic properties before materialization, for example:

- whether the terrain is traversable;
- what known hazards apply;
- which event/encounter pools are eligible;
- which exits connect back to known locations;
- which entities plausibly occupy the area.

GameFrame then materializes only validated semantics.

Incidental generation may not silently create package-bearing culprits, mandatory clues, decisive witnesses, or hidden campaign foundations that conflict with the committed package.

## Realtime transport posture

The existing hybrid Cloudflare + VM architecture remains valid.

For embodied exploration, distinguish:

### Durable HTTP/service commands

Appropriate for:

- campaign attachment/recovery;
- Ask-GM;
- freeform semantic actions;
- inventory/equipment mutations;
- accepted object interactions that change durable state;
- authoritative scene transfers;
- mechanics/checks;
- encounter lifecycle;
- recovery snapshots.

### Realtime WebSocket/session traffic

Appropriate for:

- bounded movement input/state;
- facing/transient avatar transforms;
- nearby-player transform projection;
- local realtime entity animation/projection;
- post-commit change notifications;
- scene-presence/session coordination where it does not replace durable authority.

WebSocket/session state is disposable transport/session state. Durable campaign truth remains reconstructible from runtime/GameFrame authority after disconnect/restart.

## Failure and recovery

If the realtime exploration connection drops:

- campaign truth remains intact;
- local movement input stops/degrades safely;
- reconnect restores the authoritative materialized scene and valid participant spawn/position according to GameFrame policy;
- semantic scene membership is recovered from durable state;
- the client does not replay arbitrary stale movement packets as campaign actions.

If an optional generated asset is unavailable, play uses a catalog/composed/fallback representation.

If a Dungeon Master provider is unavailable, supported deterministic movement and existing scene interaction remain usable where they do not require new semantic adjudication; actions requiring the DM may fail/defer explicitly rather than corrupt world truth.

## First Monster Master embodied proof

A convincing first reference journey should prove:

1. load one materialized Crooked Checkpoint exploration scene;
2. move the player avatar through authoritative GameFrame geometry;
3. approach and talk directly to Pell;
4. prove Pell-scoped context cannot access a campaign fact Pell does not know;
5. Ask the Game Master an out-of-fiction character-knowledge/rules question;
6. inspect/interact with one semantic world object;
7. choose a plausible alternate route such as the woods;
8. transfer/materialize a second connected exploration scene;
9. use Do Something Else for one unsupported plausible action;
10. have the Dungeon Master adjudicate and commit the resulting semantic consequence;
11. trigger or avoid an event/check based on resulting state;
12. revisit a previously materialized scene without identity/layout/world-state drift;
13. enter Arena Battles from actual current-scene truth;
14. complete the encounter with exact supported participant/objective identity;
15. reconcile aftermath back into the embodied exploration world;
16. resume movement/interaction in the same campaign;
17. restart services and recover world, scene, NPC, knowledge, and materialization identity without duplication.

The first proof may keep the party in one exploration scene at a time.

## First multiplayer posture

Initial two-human embodied play should prefer one shared active scene with explicit party-cohesion transitions.

Acceptance should prove:

- separate authenticated player avatars;
- realtime movement projection;
- one authoritative semantic scene membership;
- distinct player knowledge where applicable;
- shared and private GM communication audiences;
- direct NPC interaction custody;
- deterministic party transition to another scene;
- tactical cooperative handoff/return;
- reconnect without duplicate presence.

Split-party play is a later acceptance layer.

## Split-party / multi-map posture

Multiple simultaneous active scenes are supported by the authority model but carry materially higher implementation and operational weight.

They require at least:

- per-player authoritative scene assignment;
- independent realtime scene subscriptions;
- scene-scoped event and entity projections;
- observer knowledge divergence from separate experiences;
- explicit cross-scene communication semantics;
- concurrency-safe Dungeon Master turns when events happen in different scenes;
- independent scene materialization/recovery;
- rules for party-wide clocks, pressure, events, and shared objectives;
- clear behavior when one scene enters tactical mode while another remains exploratory;
- player-facing UI that makes separation and communication legible.

Therefore the platform should **architect for multiple scenes now but productize one shared party scene first**.

## Non-goals of the first embodied implementation

- unrestricted infinite open-world generation;
- persistent frame-by-frame coordinate journaling in RPG GM Runtime;
- fully autonomous background LLM agents continuously running for every NPC;
- generating a new image for every movement/action;
- generated video as the ordinary cutscene mechanism;
- split-party multiplayer before one-scene party exploration is proven;
- replacing the Dungeon Master with NPC agents;
- making every decorative object a durable campaign entity;
- treating visual map geometry as hidden campaign truth;
- forcing every plausible freeform action into a permanent bespoke mechanic.

## Governing rules

> The campaign is a durable semantic world that GameFrame materializes into playable space; the materialized world makes ordinary action direct and legible without becoming the boundary of imagination.

> The Dungeon Master remains the referee and narrative authority, but a character portrayed by the Dungeon Master receives character-scoped knowledge rather than omniscient hidden truth.

> Architect for multiple active scenes; prove one shared party scene first; split the party only after scene-scoped realtime, knowledge, event, mechanic, and recovery semantics are trustworthy.
