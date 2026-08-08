---
title: RPG Campaign Architect and Package Construction Contract
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - handcrafted and player-inspired RPG campaigns
shared_document_id: rpg-campaign-architect-contract-v1
shared_document_version: 3
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-campaign-architect-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-campaign-architect-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-platform-roadmap.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cross-repository-integration-testing.md
---

# RPG Campaign Architect and Package Construction Contract

## Decision

RPG GM Runtime will contain a specialized **Campaign Architect** that converts a campaign brief into a validated CampaignPackage before ordinary campaign play begins.

The CampaignPackage is not only a narrative/event package. For the embodied RPG product it also defines a **semantic campaign world**: stable locations/regions, meaningful routes/adjacency, traversal assumptions, package-bearing landmarks/entities, materialization requirements, alternate approaches, and world rules sufficient for GameFrame to realize persistent explorable scenes without embedding renderer-specific geometry in runtime truth.

Campaign compiler, plot agent, and campaign-generation agent are retired aliases for capabilities inside the Campaign Architect. They do not define separate agents or compatibility surfaces.

The Campaign Architect remains distinct from the Dungeon Master and deterministic substrate such as Character Factory, Entity Registry, Scene Registry, semantic observer knowledge, exploration materialization, and Encounter Scene Compiler.

## Input modes

The Campaign Architect must eventually support:

- one-line or short freeform concepts;
- detailed player/owner specifications;
- structured campaign sheets;
- guided GameFrame creation;
- interactive Discord interviews;
- prepared campaign families;
- imported packages that pass validation/migration.

All inputs normalize into the same versioned campaign brief contract. Unknowns, assumptions, and required repairs remain explicit.

## Draft, refinement, and commitment lifecycle

Campaign generation produces a **draft**, not automatically committed campaign truth.

```text
campaign brief / source material
→ Campaign Architect draft CampaignPackage
→ optional owner editing/refinement
→ deterministic validation
→ bounded repair when necessary
→ player-safe preview
→ explicit package commitment
```

This supports both a highly polished handcrafted Monster Master package and a generated bespoke campaign created from a short request. Both become the same kind of committed artifact.

Owner editing before commitment is first-class. The validation boundary—not authoring origin—determines whether a package is executable.

## Active-package amendment rule

Ordinary play never silently rewrites the committed campaign foundation.

If an owner wants to alter active foundational truth, use an explicit lifecycle:

```text
committed package version N
→ owner-authorized amendment/new draft
→ validation
→ migration/compatibility analysis
→ explicit acceptance
→ package version N+1 or explicit amendment record
```

The Dungeon Master may adapt campaign events/consequences through ordinary play; that is mutable campaign-instance state, not package recompilation.

## Campaign Architect responsibilities

The Campaign Architect owns:

- interpreting/normalizing the brief;
- preserving requested player fantasy while creating an original campaign identity;
- selecting compatible prepared mechanics, themes, world kits, and content packs;
- setting tone, genre, boundaries, and campaign length;
- producing campaign bible and continuity invariants;
- defining important factions, actors, motives, secrets, relationships, and package-bearing functions;
- producing a semantic WorldGraph and important location relationships;
- defining credible routes, alternate approaches, travel assumptions, and bounded exploration affordances;
- defining important landmarks/objects/exits and materialization requirements without prescribing Pixi geometry;
- producing starter spine and at least one complete resolution;
- creating/selecting plot structure, clue graph, event pools, escalation, recovery paths, and consequences;
- declaring checks/tactical opportunities compatible with GameFrame authority;
- declaring semantic presentation, world-kit, asset, narration, audio, and cinematic intents;
- validating that the package remains playable with deterministic/text fallbacks;
- recording package version, seed where applicable, hash, provenance, warnings, and migrations.

It does not conduct ordinary player turns, perform live NPC dialogue, or rewrite an active campaign because players behave unexpectedly.

## Campaign-bearing actors versus incidental characters

The Campaign Architect concretely binds actors that own package truth, including when applicable:

- responsible actors;
- important allies/rivals;
- decisive witnesses;
- required clue owners;
- secret authorities;
- mandatory access roles;
- invariant relationships/obligations;
- recurring characters needed by the package.

The CampaignPackage stores those actors as stable durable entities with explicit hidden/public facts and forbidden retcons.

Ordinary incidental people needed only during live play are not a reason to re-run Campaign Architect. The Dungeon Master requests them through Character Factory.

## Campaign brief

The durable brief should be able to represent:

- original concept text;
- desired genres/blend;
- tone/comedy/seriousness bounds;
- technology era and supernatural/scientific assumptions;
- player roles and group fantasy;
- campaign length/structure preference;
- combat, mystery, exploration, social, collection, survival, political, and other emphasis values;
- **embodied exploration emphasis and desired world openness**;
- content boundaries/excluded material;
- required/avoided elements;
- player count and known character information;
- prepared campaign/theme/world-kit identifiers when applicable;
- GameFrame mechanic/presentation/materialization capabilities;
- input source;
- brief version;
- explicit unknowns/assumptions.

A short concept may leave most fields unknown. The Campaign Architect may apply conservative defaults, record assumptions, and request bounded clarification. It must not fabricate hidden player preferences and present them as confirmed.

## CampaignPackage output

### Player-safe pitch

- original campaign title/identity;
- concise premise;
- expected player roles;
- tone/content summary;
- approximate session/campaign shape;
- character guidance;
- player-facing assumptions/boundaries.

### Runtime-only campaign bible

- setting truths/operating assumptions;
- factions, important actors, motives, secrets, leverage, limits;
- themes/thematic limits;
- hidden chronology/causality;
- originality transformations/avoid constraints;
- campaign-specific Dungeon Master behavior constraints;
- visibility classifications;
- continuity invariants/forbidden retcons.

### Semantic world model

The package should declare as needed:

- stable region/location IDs;
- parent/containment relationships;
- route/adjacency graph;
- known/hidden route status where applicable;
- traversal assumptions/requirements;
- biome/environment family;
- location purpose/role;
- required landmarks/objects/exits;
- optional world features;
- important entity placement constraints;
- exploration/materialization profile;
- materialization seed/recipe intent where applicable;
- prepared world-kit/theme references;
- on-demand incidental-area policy where allowed;
- semantic fallback when enhanced world rendering is unavailable.

The package must not include renderer-specific coordinates, Pixi classes, atlas positions, collision meshes, provider credentials, or provider-specific generation prompts.

### Playable campaign structure

- opening situation/group-cohesion mechanism;
- initial authoritative semantic scene intent;
- functional beats without mandatory scene order;
- credible alternative approaches, including routes that do not depend on menu choices;
- social, investigative, practical, exploration, care, check, choice, and tactical opportunities as appropriate;
- event/complication pools;
- clue/evidence graph where investigation exists;
- escalation/pressure rules;
- failure-forward/recovery paths;
- one complete starter/one-shot resolution;
- optional continuation seeds.

### Entities and observer knowledge

The package should declare as needed:

- stable package-bearing entity IDs;
- canonical runtime identity/player-safe descriptors;
- initial entity locations/presence;
- public versus hidden facts;
- initial player-known facts where appropriate;
- initial NPC/entity knowledge/beliefs when they materially constrain play;
- relationships/affiliations;
- semantic presentation identity;
- forbidden retcons;
- open role slots if a campaign intentionally leaves a bounded function for later materialization.

A canonical entity name does not imply that players or other NPCs know it at campaign start.

### Mechanics and presentation

- mechanic capabilities used by the package;
- check intents/tactical encounter envelopes;
- scene-to-encounter requirements;
- semantic character, creature, location, item, terrain, structure, prop, effect, handout, and interface roles;
- theme/presentation/world-kit profile;
- narration/audio/cinematic intents where useful;
- required/optional/deferred media;
- deterministic text/card/silhouette/terrain/world-kit/audio-label fallbacks.

### Provenance and reproducibility

- schema version;
- package identity/version;
- source/normalized brief;
- authoring mode;
- Campaign Architect/prompt-bundle/manual authoring version;
- selected packs/versions;
- seed where applicable;
- package hash;
- validation results/warnings;
- authoring timestamp;
- explicit amendments/migrations.

## World generation posture

The Campaign Architect generates/defines the **semantic world**, not final pixels.

Preferred relationship:

```text
campaign brief
→ semantic world graph + location requirements
→ committed package
→ GameFrame scene materialization
→ accepted persistent playable scene
```

GameFrame may use authored prefabs, reusable world kits, deterministic composition, seeded procedural generation, and bounded generated media to realize the world.

A location that was not pre-materialized may be realized on demand when committed world semantics make that route/place plausible. Once accepted for a campaign instance, revisiting it should return to that materialization identity rather than silently generating a replacement.

## Handcrafted package rule

A handcrafted package is not exempt from validation.

Monster Master is manually authored as the gold standard. It must pass the same package schema, visibility, persistence, commitment, entity/scene/knowledge/world/materialization, and Dungeon Master contracts as generated campaigns.

The Dungeon Master and GameFrame must not select separate execution paths based on package origin.

## Originality transformation

Player inspiration may use recognizable media shorthand. The Campaign Architect preserves high-level experience—era, genre blend, occupational fantasy, mood, technology assumptions, pacing, activity types, and broad world feel—while replacing protected/overly derivative names, organizations, creatures, terminology, plots, signature designs, and setting lore.

The system does not claim automatic legal safety. Transformation, validation, and operator review are product controls.

## Visibility and security

Packages use at least:

- `public`;
- `party`;
- `player_private`;
- `runtime_only`.

GameFrame receives player-safe previews and viewer-authorized semantic projections required for play. It never receives the full hidden package in browser-accessible fields.

Canonical runtime entity names, motives, hidden relationships, and secret location/event facts are not automatically observer knowledge.

Raw Campaign Architect prompts, private deliberation, hidden campaign truth, provider credentials, and internal evaluation material remain private to RPG GM Runtime.

## Package acceptance gates

A package is accepted only when it:

- preserves intended player concept after originality transformation;
- defines a playable group role/reason to act together;
- contains a complete starter experience/resolution;
- supports meaningful choice and more than one viable approach;
- separates hidden truth from player-safe information;
- concretely binds package-bearing entities;
- defines enough initial scene/world truth to begin play without model-invented continuity;
- defines semantic location relationships/materialization requirements without renderer-specific geometry;
- provides credible exploration routes/affordances consistent with the desired product scope;
- provides coherent causality and redundant/recoverable evidence where investigation exists;
- avoids unsupported mechanics or maps them to available primitives;
- declares required presentation/materialization resources through an asset/world-kit/fallback;
- fits session-length/content boundaries;
- serializes, hashes, persists, reloads, and resumes without semantic loss;
- survives exact retry/process restart;
- remains playable without live media generation after acceptance;
- can be consumed by the ordinary Dungeon Master/entity/scene/knowledge/exploration path.

## Campaign media preparation

The Campaign Architect declares semantic media/world-kit requirements and priorities. GameFrame owns media resolution, composition, generation, validation, provenance, storage, delivery, replacement, and scene materialization.

Generated media does not own collision, location truth, or campaign authority and does not block package validation.

## Implementation sequence

1. maintain executable CampaignPackage validation/commitment;
2. complete the handcrafted Monster Master semantic package/world;
3. implement durable entity/scene/observer-knowledge substrate;
4. prove GameFrame embodied materialization and one connected-world slice;
5. secure Dungeon Master referee/entity-performance context custody;
6. prove complete embodied Monster Master behavior and scene-faithful tactical return;
7. prove a materially different second handcrafted world;
8. implement versioned campaign brief and deterministic Campaign Architect port;
9. add hosted Campaign Architect generation;
10. add owner-facing draft editing/review;
11. add richer forms/interviews/media/world-kit workflows.

## Non-goals of the first implementation

- unrestricted infinite open-world generation;
- a multi-year campaign authored in full in advance;
- generated images/music/animation/speech as a validation requirement;
- generated final map screenshots as gameplay geometry authority;
- direct recreation of protected commercial settings;
- Campaign Architect creation of mechanics GameFrame cannot execute;
- Dungeon Master completion of missing package fundamentals during ordinary play;
- re-running Campaign Architect for every incidental NPC/scene decoration;
- separate package formats for Monster Master and generated campaigns;
- split-party world generation before one-scene embodied play is proven.

## Governing rule

> The Campaign Architect produces a draftable, owner-refinable semantic CampaignPackage and world; commitment makes the foundation immutable for ordinary play; GameFrame materializes supported world semantics into persistent playable scenes; and every handcrafted or generated campaign crosses the same validator, world, and Dungeon Master boundary.
