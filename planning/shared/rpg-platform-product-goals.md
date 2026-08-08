---
title: RPG Platform Product Goals
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
shared_document_id: rpg-platform-product-goals-v1
shared_document_version: 5
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

A specialized Campaign Architect creates validated CampaignPackages. Durable runtime substrate owns exact world identity, physical scene presence, observer/player knowledge, event/mechanic authority, and campaign-instance continuity. GameFrame materializes that semantic world into playable 2D locations with movement, direct interaction, characters, objects, exploration, cinematics, and deterministic mechanics. A specialized Dungeon Master conducts live play as referee, narrator, adjudicator, world-reactor, and character performer without becoming the database.

Ordinary supported actions should happen directly in the world. The Dungeon Master remains available whenever the game needs interpretation, rules/knowledge clarification, dramatic framing, an unusual action, or a consequence that fixed videogame controls cannot express.

The graphical world must increase legibility without reducing tabletop agency.

> GameFrame materializes the campaign world but does not define the limits of player intent. Any plausible action not represented by an existing interaction remains expressible as freeform intent and may be adjudicated by the Dungeon Master.

The first campaign proof is the handcrafted Monster Master gold-standard package. The next platform generality proof is a materially different second handcrafted package through the same package/entity/scene/knowledge/exploration/Dungeon-Master/GameFrame path. Campaign Architect generation follows only after those two handcrafted campaigns prove the common abstraction.

## Settled architecture

### Campaign Architect

The Campaign Architect converts a concise concept, detailed specification, structured sheet, later GameFrame or Discord interview, prepared campaign family, or imported package into one validated CampaignPackage draft.

It owns campaign construction, not ordinary live play. Generated output may be owner-refined before explicit commitment.

CampaignPackages should eventually describe not only actors/events and tactical opportunities but a semantic world graph, explorable location relationships, location materialization intent, recurring visual identities, and the world rules needed to make unexpected but plausible routes possible.

### Dungeon Master

The Dungeon Master consumes a committed CampaignPackage and durable campaign state. It owns:

- referee interpretation of arbitrary plausible player intent;
- rules/character-knowledge clarification through Ask-GM;
- narration and dramatic framing;
- eligible-event selection and campaign pacing;
- compatible improvisation and world consequences through validated semantic operations;
- requests for checks, mechanics, media, scene materialization, and tactical encounters;
- portrayal of NPCs/entities through **perspective-bounded character-performance context**;
- aftermath and reconciliation after authoritative mechanics.

The Dungeon Master remains one specialized campaign agent. Referee mode, Game-Master communication, entity-performance mode, and aftermath/intervention mode are distinct context/authority surfaces, not additional autonomous agents.

When portraying one entity, the model receives only the knowledge, beliefs, memories, observations, goals, relationships, and package constraints justified for that entity. It does not receive unrelated hidden campaign truth merely because the Dungeon Master can access that truth in referee mode.

The Dungeon Master may not replace package truth, directly mint unconstrained durable NPCs, infer physical presence from prose, expose hidden canonical identity, replace GameFrame-authoritative mechanics, or use a separate campaign-specific execution path.

### Durable runtime substrate

Entity Registry, Character Factory, Scene Registry, semantic observer/player knowledge, Dungeon Master Context Compiler, typed campaign-operation validators, Encounter Scene Compiler, and world/exploration semantic services are deterministic runtime substrate rather than additional campaign agents.

They make exact campaign facts explicit so model memory is not campaign authority.

### CampaignPackage

Handcrafted and generated campaigns use the same package schema, validation, persistence, commitment, visibility, entity/scene/knowledge initialization, semantic world model, and Dungeon Master interface.

Monster Master is manually authored to establish the expected package quality.

## Primary GameFrame experience

GameFrame is the primary and authoritative player-facing application for:

- campaign concept submission, package preview, joining, invitations, and resume;
- **embodied exploration of materialized 2D campaign locations**;
- authenticated player avatars and party presence;
- movement, collision, camera, inspection, interaction, and scene transitions;
- direct interaction with NPCs/creatures/objects in the world;
- perspective-bounded NPC dialogue/performance;
- **Do Something Else** freeform actions for plausible intent not covered by a dedicated control;
- **Ask Game Master** for out-of-fiction rules, character-knowledge, and clarification questions;
- GM-initiated narration/intervention, including occasional dramatic world-freeze presentation;
- viewer-safe People/Characters and current-scene/world views;
- characters, creatures, abilities, conditions, inventory, equipment, progression, quests, clues, and objectives;
- maps, locations, world routes, points of interest, checks, handouts, and player-private information;
- tactical encounters and authoritative return to the surrounding embodied campaign;
- history, recap, reconnect, recovery, and later-session continuation;
- presentation of accepted campaign art, animation, cinematic scripts, sound, music, and narration.

The mature primary loop is not a transcript that describes every movement. Text remains first-class for GM communication, dialogue/history, accessibility, freeform intent, fallback, testing, and optional alternate presentation.

Discord may provide authentication, invitations, voice, social conversation, notifications, links, and a future campaign-intake interview. Discord does not own campaign truth or ordinary gameplay.

## Tabletop-agency goal

The product should preserve the defining tabletop property that the player can attempt plausible actions the software did not anticipate as buttons.

If a location visibly/semantically contains woods, a creek, a roof, a cart, a ridge, a door, or another meaningful feature, the system should not treat that feature as decorative merely because a fixed interaction menu omitted one conceivable use.

When an action is already supported, perform it deterministically/directly. When it is unusual but plausible, route it through the Dungeon Master and materialize validated consequences into durable world state.

Repeated valuable concepts may later become dedicated mechanics. One-off improvisation does not require permanent schema/UI expansion.

## Persistent campaign goal

Campaigns are durable products, not disposable model conversations or disposable generated maps.

The platform must support:

- authoritative CampaignPackages and campaign journals;
- campaigns continuing across multiple play sessions;
- bounded engineering/starter chapters without implying that the mature product is limited to one-shot length;
- stable player, character, NPC, creature, location, item, faction, quest, encounter, materialized-scene, and asset identities;
- semantic world graphs and meaningful location adjacency;
- explicit current scene membership and materially relevant local state;
- reproducible/accepted exploration-scene materialization;
- viewer/observer-specific knowledge and identity labels;
- durable NPC memories/relationships where continuity matters;
- deterministic retry and reconnect;
- operator inspection and explicit correction;
- backup, restore, recap, and resume;
- separate GameFrame coordination/materialization authority and runtime campaign/narrative authority.

Storage and rendering adapters may change without changing these product properties.

## World materialization goal

The CampaignPackage defines what the world means; GameFrame decides how supported semantics become playable geometry.

The platform should support a hierarchy such as:

```text
semantic world graph
→ location/environment semantics
→ accepted exploration-scene specification
→ GameFrame materialization
→ playable geometry + interactions
```

Important rules:

- generated images do not define collision or campaign truth;
- location materialization may use accepted assets, prefabs, deterministic composition, seeded procedural layout, and generated media;
- on-demand incidental explorable scenes are allowed when committed world semantics make them plausible;
- once a scene is accepted/materialized for a campaign, revisiting it returns to that scene identity rather than regenerating a replacement;
- meaningful world changes survive revisit/restart;
- unrestricted infinite world generation is not required.

## Single-scene-first multiplayer posture

The authority model supports zero or more active scenes, but the first embodied multiplayer product should keep the active party together in one exploration scene unless a campaign explicitly requires separation.

A first transition model may require the relevant active party members to gather in an exit/transition area before the party transfers to the connected location.

This reduces concurrency, knowledge divergence, AI-context, event-clock, recovery, and UI complexity while preserving an explicit path to later split-party play.

Split-party/multi-map operation is a later product layer, not an architectural rewrite.

## Ownership principle

> The Campaign Architect defines a semantic campaign world; runtime owns exact durable world truth and observer knowledge; GameFrame materializes that world into playable space and deterministic mechanics; the Dungeon Master interprets, referees, performs characters, and handles the parts that cannot be reduced to fixed controls.

### RPG GM Runtime owns

- Campaign Architect and Dungeon Master orchestration;
- CampaignBrief and CampaignPackage schemas;
- package validation, hashing, persistence, migration, and hidden truth;
- runtime campaign journal and narrative revision;
- Entity Registry, Character Factory, Scene Registry, semantic observer/player knowledge;
- NPC motives, memories, relationships, clues, events, and consequences;
- semantic world graph/location truth and scene-transition meaning;
- freeform player-intent interpretation;
- perspective-bounded character-performance context;
- audience classification and knowledge authorization;
- model context, provider routing, semantic validation, retry, and fallback;
- semantic media/materialization/mechanic intents;
- scene-to-encounter semantic projection;
- mapping GameFrame outcomes into campaign/world/scene consequences.

### GameFrame owns

- complete authenticated campaign creation and play interfaces;
- player commands, identity, seats, invitations, and viewer-safe projections;
- player-safe package preview and confirmation;
- exploration renderer, camera, local movement, collision, picking, pathing, and interaction presentation;
- accepted materialized-scene geometry/state required for replay/reconnect;
- ephemeral avatar transforms and realtime exploration session state;
- People/current-scene/world presentation and entity inspection authorization;
- Do Something Else and Ask-GM UI semantics;
- GM intervention/cinematic presentation;
- structured mechanics deliberately implemented in GameFrame;
- Arena Battles authority, replay, reconnect, and committed outcomes;
- semantic asset catalogs, composition, generation, validation, provenance, storage, delivery, and fallback;
- narration/audio/cinematic-script playback;
- desktop, mobile, browser, and Discord Activity presentation.

### Scribbles Runtime owns

- Theo's behavior and the narrow connector allowing Theo to occupy an ordinary GameFrame player seat.

Theo is never the Campaign Architect or Dungeon Master and receives no hidden campaign state.

## Media and audio goals

Generated or composed media is campaign preparation/presentation capability, not campaign authority.

The Campaign Architect declares semantic requirements and importance. GameFrame should:

1. reuse accepted catalog assets when suitable;
2. compose deterministic assets/world kits where practical;
3. generate new assets asynchronously when justified;
4. preserve recurring character/location/materialization identity and provenance;
5. validate and moderate outputs;
6. enforce budgets and provider limits;
7. display placeholders or deterministic fallbacks immediately;
8. replace presentation assets without altering campaign truth;
9. prefer semantic cinematic scripts over generated video for ordinary cutscenes.

Cloudflare-backed image generation should eventually help materialize campaign packs and unusual scene/character assets. It is not required to prove CampaignPackage logic, durable world state, Dungeon Master behavior, or legal movement.

## Deployment goals

The first production profile should:

1. run GameFrame and RPG GM Runtime as separate services on one dedicated VM;
2. expose only GameFrame through Cloudflare;
3. require no inbound router forwarding or player VPN;
4. keep runtime, databases, and administration private;
5. persist each authority domain separately;
6. allow independent deployment and rollback;
7. support backup, restore, observability, and recovery;
8. use WebSocket/session transport for bounded realtime exploration without making socket state campaign authority;
9. retain HTTP/service commands and durable recovery for semantic mutations;
10. retain an evidence-based path to later Cloudflare-native migration.

## Product quality goals

The system should be:

- coherent enough to feel authored rather than like disconnected AI demonstrations;
- free enough that graphical affordances do not become the limit of imagination;
- capable of multiple campaign genres without separate Dungeon Master code paths;
- durable across provider failure and long gaps;
- resistant to plot drift, identity drift, scene discontinuity, secret leakage, and NPC omniscience;
- visually consistent across recurring campaign identities;
- capable of reusing and accumulating a growing world/asset vocabulary;
- responsive on desktop and mobile;
- inspectable and recoverable;
- machine-testable through mock providers and scripted players;
- provider-flexible for language, image, audio, storage, and delivery;
- explicit about identity, scene, knowledge, audience, provenance, revision, materialization, and authority.

## First product proof — embodied Monster Master

The first convincing engineering proof is complete when a player can:

1. enter one handcrafted and validated Monster Master CampaignPackage;
2. load a materialized Crooked Checkpoint exploration scene derived from committed semantic world state;
3. move through GameFrame-owned playable geometry and interact with the scene;
4. approach and talk directly to Pell through Pell-scoped character-performance context;
5. prove Pell cannot access a hidden campaign fact Pell does not know;
6. use Ask-GM for an out-of-fiction rules/character-knowledge question;
7. use Do Something Else for a plausible action not represented by a fixed control;
8. take or attempt a credible alternate route such as the woods and transition/materialize a connected scene;
9. revisit a previously materialized location without world/layout/entity drift;
10. encounter coherent durable NPCs, clues, events, checks, and consequences;
11. enter an Arena Battles encounter derived from supported current-scene truth;
12. return with the tactical outcome applied to the same embodied world and resume movement/interactions;
13. disconnect/restart services and resume without package, scene, materialization, entity, NPC-memory, or command drift;
14. complete a bounded campaign-resolution proof;
15. remain playable through text/deterministic fallbacks when optional media or generation is missing.

The first proof may keep the party in one active exploration scene at a time. The mature product remains a multi-session campaign system rather than a one-shot-only product.

This proof must be machine-tested before being treated as human-ready.

## Second product proof — handcrafted generality

Before implementing Campaign Architect generation, a materially different second handcrafted CampaignPackage must:

1. pass the same validator used by Monster Master;
2. initialize through the same Entity/Scene/Knowledge/WorldGraph substrate;
3. materialize and explore through the same GameFrame exploration contracts;
4. run through the same Dungeon Master context-mode architecture without campaign-specific control-plane code;
5. prove perspective-bounded character performance where characters are used;
6. complete scripted multi-turn/multi-scene play without plot drift or secret leakage;
7. use existing GameFrame primitives/fallbacks or expose a genuinely reusable missing capability.

If this package requires a special Dungeon Master execution branch or breaks the common world/materialization model, repair the abstraction first.

## Third product proof — Campaign Architect

After the two handcrafted campaigns prove the runtime abstraction:

1. a player or test supplies a materially different concept;
2. the Campaign Architect produces an original validated draft CampaignPackage including semantic world/location/materialization requirements;
3. optional owner refinement preserves the same validator boundary;
4. the package passes the same validator/entity/scene/knowledge/world path;
5. the same Dungeon Master and GameFrame exploration system run it without campaign-specific code;
6. scripted players complete the package without plot drift, NPC omniscience, or secret leakage;
7. GameFrame presents it through existing primitives and accepted fallbacks.

## Later product expansion

After those proofs:

- structured campaign sheets;
- guided GameFrame creation;
- Discord interviews;
- Campaign Architect repair and operator review;
- Cloudflare-backed campaign image generation;
- larger reusable world/prop/structure/animation libraries;
- richer on-demand scene materialization;
- split-party/multi-map play;
- richer multi-session progression and world systems;
- additional prepared themes;
- Theo participation;
- optional Cloudflare-native state migration;
- production operational quality.

## Non-goals

The product direction does not require:

- sending raw premises directly to the Dungeon Master;
- a separate Monster Master Dungeon Master;
- a third NPC agent or intro agent;
- every improvised object becoming a custom mechanic;
- generated media before campaign logic works;
- a new image for every action;
- generated video for ordinary cutscenes;
- unrestricted infinite open-world generation;
- continuous autonomous LLM processes for every NPC;
- frame-by-frame movement journaling in RPG GM Runtime;
- split-party multiplayer before one-scene party exploration is proven;
- Tailscale or router forwarding for players;
- Cloudflare-native stateful compute before the VM profile works;
- direct copying of protected campaigns or media;
- merging all repositories, services, or databases.

## Governing rule

> Prove one durable handcrafted campaign as a real embodied world, prove the same architecture with a materially different handcrafted world, then automate campaign construction with the Campaign Architect.
