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
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-campaign-architect-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-campaign-architect-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-platform-roadmap.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cross-repository-integration-testing.md
---

# RPG Campaign Architect and Package Construction Contract

## Decision

RPG GM Runtime will contain a specialized **Campaign Architect** that converts a campaign brief into a validated CampaignPackage before ordinary campaign play begins.

Campaign compiler, plot agent, and campaign-generation agent are retired aliases for capabilities inside the Campaign Architect. They do not define separate agents or compatibility surfaces.

The Campaign Architect is distinct from the Dungeon Master and from deterministic runtime substrate such as the Character Factory, Entity Registry, Scene Registry, player-knowledge projection, and Encounter Scene Compiler.

## Input modes

The Campaign Architect must eventually support:

- one-line or short freeform concepts;
- detailed player/owner specifications;
- structured campaign sheets;
- guided GameFrame creation;
- interactive Discord interviews;
- prepared campaign families;
- imported packages that pass validation and migration.

All inputs normalize into the same versioned campaign brief contract. Unknowns, assumptions, and required repairs remain explicit.

## Draft, refinement, and commitment lifecycle

Campaign generation produces a **draft**, not automatically committed campaign truth.

```text
campaign brief / source material
→ Campaign Architect draft CampaignPackage
→ optional owner editing and refinement
→ deterministic validation
→ bounded repair when necessary
→ player-safe preview
→ explicit package commitment
```

This supports both ends of the intended workflow:

- a highly polished handcrafted Monster Master package refined over months; and
- a generated bespoke campaign created from a short request and accepted with little or no manual editing.

Both become the same kind of committed artifact.

Owner editing before commitment is first-class, not an escape hatch. The validation boundary—not authoring origin—determines whether a package is executable.

## Active-package amendment rule

Ordinary play never silently rewrites the committed campaign foundation.

If an owner wants to alter an active package's foundational truth, the system must use an explicit lifecycle:

```text
committed package version N
→ owner-authorized amendment/new draft
→ validation
→ migration/compatibility analysis
→ explicit acceptance
→ package version N+1 or explicit campaign amendment record
```

The Dungeon Master may adapt campaign events and consequences through ordinary play, but that is mutable campaign-instance state and not package recompilation.

## Campaign Architect responsibilities

The Campaign Architect owns:

- interpreting and normalizing the brief;
- preserving requested player fantasy while creating an original campaign identity;
- selecting compatible prepared mechanics, themes, and content packs;
- setting tone, genre, boundaries, and campaign length;
- producing the campaign bible and continuity invariants;
- defining important locations, factions, actors, motives, secrets, and relationships;
- producing the starter spine and at least one complete resolution;
- creating/selecting plot structure, clue graph, event pools, escalation, recovery paths, and consequences;
- defining initial scenes and package-bearing entity relationships;
- declaring checks and tactical opportunities compatible with available GameFrame authority;
- declaring semantic presentation, asset, narration, and audio intents;
- validating that the package is playable with deterministic fallbacks;
- recording package version, seed where applicable, hash, provenance, warnings, and migrations.

It does not conduct ordinary player turns, perform live NPC dialogue, or rewrite an active campaign because players behave unexpectedly.

## Campaign-bearing actors versus incidental characters

The Campaign Architect must concretely bind actors that own package truth, including when applicable:

- responsible actors;
- important allies/rivals;
- decisive witnesses;
- required clue owners;
- secret authorities;
- mandatory access roles;
- invariant relationships or obligations;
- recurring characters needed by the package.

The CampaignPackage stores those actors as stable durable entities with explicit hidden/public facts and forbidden retcons.

Ordinary incidental people that become necessary only during live play are **not** a reason to re-run the Campaign Architect. The Dungeon Master requests them through the runtime Character Factory under the shared scene/entity/knowledge contract.

The Character Factory may not overwrite a package-bearing role unless the package explicitly declared that function open.

## Campaign brief

The first durable brief contract should be able to represent:

- original concept text;
- desired genres and blend;
- tone and comedy/seriousness bounds;
- technology era and supernatural/scientific assumptions;
- player roles and group fantasy;
- campaign length and structure preference;
- combat, mystery, exploration, social, collection, survival, political, and other emphasis values;
- content boundaries and excluded material;
- required and avoided elements;
- player count and known character information;
- prepared campaign/theme identifiers when applicable;
- GameFrame mechanic/presentation capabilities;
- input source;
- brief version;
- explicit unknowns and assumptions.

A short concept may leave most fields unknown. The Campaign Architect may apply conservative defaults, record assumptions, and request bounded clarification. It must not fabricate hidden player preferences and present them as confirmed.

## CampaignPackage output

### Player-safe pitch

- original campaign title and identity;
- concise premise;
- expected player roles;
- tone/content summary;
- approximate session/campaign shape;
- character guidance;
- player-facing assumptions and boundaries.

### Runtime-only campaign bible

- setting truths and operating assumptions;
- factions, important actors, motives, secrets, leverage, and limits;
- location roles and relationships;
- themes and thematic limits;
- hidden chronology and causality;
- originality transformations and avoid constraints;
- campaign-specific Dungeon Master behavior constraints;
- visibility classifications;
- continuity invariants and forbidden retcons.

### Playable campaign structure

- opening situation and group-cohesion mechanism;
- initial authoritative scene intent;
- functional beats without mandatory scene order;
- credible alternative approaches;
- social, investigative, practical, exploration, care, check, choice, and tactical opportunities as appropriate;
- event/complication pools;
- clue/evidence graph when investigation exists;
- escalation and pressure rules;
- failure-forward and recovery paths;
- one complete starter/one-shot resolution;
- optional continuation seeds.

### Entities and knowledge

The package should declare as needed:

- stable package-bearing entity IDs;
- canonical runtime identity and player-safe descriptors;
- initial entity locations/presence;
- public versus hidden facts;
- initial player-known facts where appropriate;
- relationships/affiliations;
- semantic presentation identity;
- forbidden retcons;
- open role slots, if a campaign intentionally leaves a bounded function for later materialization.

A canonical entity name does not imply that players know it at campaign start.

### Mechanics and presentation

- mechanic capabilities used by the package;
- check intents and tactical encounter envelopes;
- scene-to-encounter requirements;
- semantic character, creature, location, item, terrain, effect, handout, and interface roles;
- theme/presentation profile;
- narration/audio intents where useful;
- required/optional/deferred media;
- deterministic text/card/silhouette/terrain/audio-label fallbacks.

### Provenance and reproducibility

- schema version;
- package identity/version;
- source and normalized brief;
- authoring mode;
- Campaign Architect/prompt-bundle/manual authoring version;
- selected packs/versions;
- seed where applicable;
- package hash;
- validation results/warnings;
- authoring timestamp;
- explicit amendments/migrations.

## Handcrafted package rule

A handcrafted package is not exempt from validation.

Monster Master is manually authored as the gold standard. It must pass the same package schema, visibility, persistence, commitment, entity/scene/knowledge, and Dungeon Master contracts as generated campaigns.

The Dungeon Master must not select a separate execution path based on package origin.

## Originality transformation

Player inspiration may use recognizable media shorthand. The Campaign Architect preserves high-level experience—era, genre blend, occupational fantasy, mood, technology assumptions, pacing, and activity types—while replacing protected or overly derivative names, organizations, creatures, terminology, plots, signature designs, and setting lore.

The package records original player intent and transformed campaign identity. Runtime-only avoid constraints prevent later drift toward direct imitation.

The system does not claim automatic legal safety. Transformation, validation, and operator review are product controls.

## Visibility and security

Packages use at least:

- `public`;
- `party`;
- `player_private`;
- `runtime_only`.

GameFrame receives player-safe previews and viewer-authorized projections required for play. It never receives the full hidden package in browser-accessible fields.

Canonical runtime entity names, IDs, motives, and hidden relationships are not automatically player knowledge. Player-safe entity labels are derived through the shared knowledge contract.

Raw Campaign Architect prompts, private deliberation, hidden campaign truth, provider credentials, and internal evaluation material remain private to RPG GM Runtime.

## Package acceptance gates

A package is accepted only when it:

- preserves the intended player concept after originality transformation;
- defines a playable group role and reason to act together;
- contains a complete starter experience and resolution;
- supports meaningful choice and more than one viable approach;
- separates hidden truth from player-safe information;
- concretely binds package-bearing entities;
- defines enough initial scene truth to begin play without model-invented continuity;
- provides coherent causality and redundant/recoverable evidence where investigation exists;
- avoids unsupported mechanics or maps them to available primitives;
- declares required presentation resources through an asset or fallback;
- fits session-length/content boundaries;
- serializes, hashes, persists, reloads, and resumes without semantic loss;
- survives exact retry and process restart;
- remains playable without live media generation after acceptance;
- can be consumed by the ordinary Dungeon Master/entity/scene/knowledge path.

## Campaign media preparation

The Campaign Architect declares semantic media requirements and priorities. GameFrame owns media resolution, composition, generation, validation, provenance, storage, delivery, and replacement.

When Cloudflare-backed image generation is available, it may materialize Campaign Architect asset intents during campaign preparation. It does not own campaign truth and does not block text-first package validation.

## Implementation sequence

1. maintain executable CampaignPackage validation/commitment;
2. complete the handcrafted Monster Master package;
3. implement durable entity/scene/player-knowledge substrate;
4. secure the Dungeon Master hidden-decision/player-safe-render split;
5. prove complete Monster Master campaign behavior and scene-faithful tactical handoff;
6. prove a materially different second handcrafted package;
7. implement the versioned campaign brief and deterministic Campaign Architect port;
8. add hosted Campaign Architect generation;
9. add owner-facing draft editing/review;
10. add richer forms/interviews/media workflows.

## Non-goals of the first implementation

- unrestricted open-world generation;
- a multi-year campaign authored in full in advance;
- generated images/music/animation/speech as a validation requirement;
- direct recreation of protected commercial settings;
- Campaign Architect creation of mechanics GameFrame cannot execute;
- Dungeon Master completion of missing package fundamentals during ordinary play;
- re-running Campaign Architect for every incidental NPC;
- separate package formats for Monster Master and generated campaigns.

## Governing rule

> The Campaign Architect produces a draftable, owner-refinable CampaignPackage and package-bearing cast; commitment makes the package immutable for ordinary play; runtime handles incidental entity continuity; and every handcrafted or generated campaign crosses the same validator and Dungeon Master boundary.
