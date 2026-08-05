---
title: RPG Campaign Architect and Package Construction Contract
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - handcrafted and player-inspired RPG campaigns
shared_document_id: rpg-campaign-compiler-contract-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-campaign-compiler-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-campaign-compiler-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-platform-roadmap.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cross-repository-integration-testing.md
---

# RPG Campaign Architect and Package Construction Contract

## Decision

RPG GM Runtime will contain a specialized **Campaign Architect** agent that converts a campaign brief into a validated, persisted CampaignPackage before ordinary campaign play begins.

Older terms such as campaign compiler, plot agent, and campaign-generation agent refer to capabilities inside the Campaign Architect. They do not define separate agents.

The Campaign Architect is distinct from the Dungeon Master. It determines the campaign foundation, playable structure, hidden truth, event material, presentation requirements, and provenance. The Dungeon Master later conducts live play from the accepted package.

## Input modes

The Campaign Architect must eventually support:

- a one-line or short freeform concept;
- a detailed player or owner specification;
- a structured campaign sheet;
- a guided GameFrame creation flow;
- an interactive Discord interview;
- prepared campaign families;
- imported packages that pass validation and migration.

All input modes normalize into the same versioned `CampaignBriefV1` contract. Unknowns, assumptions, and required repairs remain explicit.

## Campaign Architect responsibilities

The Campaign Architect owns:

- interpreting and normalizing the brief;
- preserving the requested player fantasy while creating an original campaign identity;
- selecting compatible prepared mechanics, theme capabilities, and content packs;
- setting tone, genre, boundaries, and campaign length;
- producing the campaign bible and continuity invariants;
- defining important locations, factions, actors, motives, secrets, and relationships;
- producing the starter spine and at least one complete resolution;
- creating or selecting plot structure, clue graph, event pools, escalation, recovery paths, and consequences;
- declaring checks and tactical opportunities compatible with available GameFrame authority;
- declaring semantic presentation, asset, narration, and audio intents;
- validating that the package is playable with deterministic fallbacks;
- recording package version, seed where applicable, content hash, provenance, warnings, and migrations.

The Campaign Architect does not conduct ordinary player turns, perform NPC dialogue in live scenes, or rewrite an active campaign in response to unexpected player action.

## Campaign brief

`CampaignBriefV1` should represent:

- original concept text;
- desired genres and blend;
- tone and comedy or seriousness bounds;
- technology era and supernatural or scientific assumptions;
- player roles and group fantasy;
- campaign length and structure preference;
- combat, mystery, exploration, social, collection, survival, political, and other emphasis values;
- content boundaries and excluded material;
- required and avoided elements;
- player count and known character information;
- prepared campaign or theme identifiers when applicable;
- GameFrame mechanic and presentation capabilities;
- input source: freeform, form, interview, prepared, imported, or owner-authored;
- brief version;
- explicit unknowns and assumptions.

A short concept may leave most fields unknown. The Campaign Architect may apply conservative defaults, record assumptions, and request bounded clarification. It must not fabricate hidden player preferences and present them as confirmed.

## CampaignPackage output

The product-level artifact is `CampaignPackage`. The first implementation schema may be named `CompiledCampaignPackageV1`.

The same package contract is used for handcrafted and generated campaigns.

### Player-safe pitch

- original campaign title and identity;
- concise premise;
- expected player roles;
- tone and content summary;
- approximate session or campaign shape;
- character guidance;
- player-facing assumptions and boundary confirmations.

### Runtime-only campaign bible

- setting truths and operating assumptions;
- factions, important actors, motives, secrets, leverage, and limits;
- location roles and relationships;
- themes and thematic limits;
- hidden chronology and causality;
- originality transformations and prohibited direct-copy elements;
- Dungeon Master behavior rules specific to the campaign;
- visibility classifications;
- continuity invariants and forbidden retcons.

### Playable campaign structure

- opening situation and group-cohesion mechanism;
- functional beats without a mandatory scene order;
- credible alternative approaches;
- social, investigative, practical, exploration, care, check, choice, and tactical opportunities as appropriate;
- event and complication pools;
- clue and evidence graph when investigation exists;
- escalation and pressure rules;
- failure-forward and recovery paths;
- one complete starter or one-shot resolution;
- optional continuation seeds.

### Mechanics and presentation

- mechanic capabilities used by the package;
- check intents and tactical encounter envelopes;
- semantic character, creature, location, item, terrain, effect, handout, and interface asset roles;
- theme and presentation profile;
- narration and audio intents where useful;
- required, optional, and deferred media;
- deterministic text, card, silhouette, terrain, and audio-label fallbacks.

### Provenance and reproducibility

- schema version;
- package identity and version;
- source and normalized brief;
- authoring mode: handcrafted, generated, imported, or migrated;
- Campaign Architect, prompt-bundle, or manual authoring version;
- selected packs and versions;
- seed where applicable;
- package hash;
- validation results and warnings;
- compile or authoring timestamp;
- explicit amendments and migrations.

## Handcrafted package rule

A handcrafted package is not exempt from validation.

Monster Master is manually authored as the gold standard for Campaign Architect output. It must pass the same package schema, visibility, persistence, commitment, and Dungeon Master consumption contracts as generated campaigns.

The Dungeon Master must not select a separate execution path based on package origin.

## Originality transformation

Player inspiration may use recognizable media shorthand. The Campaign Architect preserves high-level experience—era, genre blend, occupational fantasy, mood, technology assumptions, pacing, and activity types—while replacing protected or overly derivative names, organizations, creatures, terminology, plots, signature designs, and setting lore.

The package records both the original player intent and the transformed original campaign identity. Runtime-only avoid constraints prevent the Dungeon Master and media pipeline from drifting back toward direct imitation.

The system does not claim automatic legal safety. Transformation, validation, and operator review are product controls.

## Visibility and security

Packages use at least:

- `public`;
- `party`;
- `player_private`;
- `runtime_only`.

GameFrame receives player-safe preview and the audience projections required for play. It must not receive the full hidden package in browser-accessible fields.

Raw Campaign Architect prompts, private deliberation, hidden campaign truth, provider credentials, and internal evaluation material remain in RPG GM Runtime.

## Package acceptance gates

A package is accepted only when it:

- preserves the player concept after originality transformation;
- defines a playable group role and reason to act together;
- contains a complete starter experience and resolution;
- supports meaningful choice and more than one viable approach;
- separates hidden truth from player-safe information;
- provides coherent causality and redundant or recoverable evidence when investigation exists;
- avoids unsupported mechanics or maps them to available primitives;
- declares every required presentation resource through an accepted asset or deterministic fallback;
- fits session-length and content boundaries;
- serializes, hashes, persists, reloads, and resumes without semantic loss;
- survives exact retry and process restart;
- remains playable without live media generation after package acceptance;
- can be consumed by the ordinary Dungeon Master path.

## Campaign media preparation

The Campaign Architect declares semantic media requirements and priorities. GameFrame owns media resolution, composition, generation, validation, provenance, storage, delivery, and replacement.

When Cloudflare-backed image generation is available, it may materialize Campaign Architect asset intents during campaign preparation. It does not own campaign truth and does not block text-first package validation.

## First implementation sequence

1. implement `CampaignBriefV1`;
2. implement `CompiledCampaignPackageV1`;
3. implement validation, hashing, persistence, commitment, reload, and player-safe projection;
4. encode one complete handcrafted Monster Master package;
5. make the Dungeon Master consume that committed package;
6. build machine-play campaign tests;
7. implement a deterministic Campaign Architect port and fixture;
8. add a hosted Campaign Architect provider;
9. prove a materially different generated bespoke campaign;
10. add sheets, interviews, repair loops, and media materialization.

## Non-goals of the first implementation

- unrestricted open-world generation;
- a complete multi-year campaign authored in advance;
- generated images, music, animation, or speech as a validation requirement;
- direct recreation of protected commercial settings;
- allowing the Campaign Architect to invent new GameFrame mechanics without contracts;
- allowing the Dungeon Master to complete missing package fundamentals during ordinary play;
- separate package formats for Monster Master and generated campaigns.

## Governing rule

> The Campaign Architect turns any supported brief into one validated CampaignPackage; handcrafted Monster Master proves the quality bar; and the Dungeon Master runs every accepted package through the same durable interface.
