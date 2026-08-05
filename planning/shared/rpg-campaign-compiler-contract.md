---
title: RPG Campaign Compiler Contract
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - curated and player-inspired RPG campaigns
shared_document_id: rpg-campaign-compiler-contract-v1
shared_document_version: 1
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-campaign-compiler-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-campaign-compiler-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-monster-master-reference-campaign.md
  - rpg-rendering-and-asset-contract.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cross-repository-integration-testing.md
---

# RPG Campaign Compiler Contract

## Decision

RPG GM Runtime will contain a campaign-compiler capability that converts a player concept into a validated, persisted campaign package before ordinary campaign play begins.

A concept may be as small as a one-line inspiration, such as an early-industrial supernatural investigation adventure, or as detailed as a structured campaign sheet. A later interactive interview may gather missing preferences. All input modes normalize into the same versioned `CampaignBrief` contract.

The compiler is distinct from the live Game Master. It establishes the campaign's foundational truth, playable spine, event pools, constraints, presentation semantics, and initial hidden state. The live Game Master consumes that package and adapts play within it rather than regenerating the campaign premise on every turn.

Asset generation is not required for the first implementation. The compiler emits semantic presentation and asset intents that GameFrame can render through deterministic placeholders, text, existing icons, silhouettes, cards, terrain families, and fallback audio labels. Image, animation, and sound providers may materialize those intents later without changing campaign truth.

## Product objective

The campaign compiler should let a player or group move from an idea to a playable, coherent starter experience without requiring them to write an adventure or expose GM-only information.

It must support:

- a concise freeform concept;
- a structured questionnaire or campaign sheet;
- an interactive guided creation process added later;
- prepared reference settings such as Monster Master;
- curated genre and mechanic packs;
- original transformations of recognizable inspirations rather than direct copying of protected characters, settings, terminology, visual identities, or plots;
- deterministic fixtures for testing;
- text-first GameFrame presentation before generated media is available.

## Compile-time and run-time separation

### Campaign compiler

The compiler runs during campaign creation or explicit recompilation. It owns:

- interpreting and normalizing the campaign brief;
- selecting compatible platform mechanics and prepared content capabilities;
- producing the campaign bible and starter spine;
- creating curated special-event and incident pools;
- committing hidden campaign truth required for the first playable chapter;
- defining tone, genre, themes, boundaries, and originality constraints;
- declaring presentation semantics and asset intents;
- validating that the result is playable with available GameFrame capabilities and deterministic fallbacks;
- assigning compiler version, package version, seed, and content hash.

### Live Game Master

The live Game Master owns:

- scene realization and narration;
- NPC dialogue and reactions;
- interpretation of freeform player intent;
- checks, choices, pacing, and consequences within the package;
- selecting eligible events from compiled pools;
- adding compatible secondary details;
- requesting tactical encounters and applying committed outcomes;
- maintaining campaign continuity after play begins.

The live Game Master must not silently replace the campaign's committed premise, central actors, established facts, event constraints, or required evidence merely because players act unexpectedly.

## Normalized campaign brief

Every input path produces a `CampaignBrief` containing known values and explicit unknowns.

The initial contract should support:

- `concept_text` — the player's original wording;
- `desired_genres` and `genre_blend`;
- `tone` and comedy or seriousness bounds;
- `technology_era` and supernatural or scientific assumptions;
- `player_roles` and desired group fantasy;
- `campaign_length` — one-shot, starter with open end, short arc, or longer campaign;
- `structure_preference` — guided, mixed, or open;
- `combat_frequency` and tactical expectations;
- `mystery`, exploration, social, collection, survival, political, and other emphasis values;
- `content_boundaries` and excluded material;
- `must_include` and `avoid` elements;
- `player_count` and available character information;
- `prepared_theme_id`, when compiling from a curated setting;
- `mechanic_capabilities` and `presentation_capabilities` supplied by GameFrame;
- `brief_source` — freeform, form, interview, prepared fixture, or imported package;
- `brief_version`.

A one-line prompt may leave most fields unknown. The compiler should make conservative defaults, record its assumptions, and expose player-safe assumptions for confirmation when confirmation is useful. It must not block creation merely because a detailed form was not completed.

## Compiled campaign package

A valid `CompiledCampaignPackage` contains several visibility-scoped sections.

### Player-safe campaign pitch

This section may be projected before play and contains:

- original campaign title;
- concise premise;
- expected player roles;
- tone and content summary;
- approximate session shape;
- relevant character-creation guidance;
- declared player-facing assumptions;
- any required consent or boundary confirmation.

### Runtime-only campaign bible

This section is never included in ordinary player projections. It contains:

- setting truths and operating assumptions;
- factions, important NPC roles, motives, and secrets;
- location roles and relationships;
- campaign themes and thematic limits;
- central tensions and likely long-term pressures;
- hidden chronology and causality;
- originality transformations and prohibited direct-copy elements;
- GM behavior rules specific to the campaign;
- information-visibility classifications;
- continuity invariants that later improvisation cannot contradict.

### Playable starter spine

The first compilation must produce a complete starter rather than only a world bible. It contains:

- opening situation and group-cohesion mechanism;
- required scenes or functional beats without prescribing one route;
- at least two reasonable approaches to meaningful problems;
- expected social, investigative, exploration, check, choice, and tactical opportunities as appropriate;
- one-shot resolution conditions;
- open-ended continuation seeds;
- pacing bounds and escalation rules;
- failure-forward alternatives that prevent one missed clue or failed check from ending play.

The default target is a campaign bible plus one playable starter chapter with open-ended arc seeds, not a fully scripted multi-year campaign.

### Special-event and incident pools

The compiler produces bounded pools compatible with the campaign's premise and mechanics. Pool entries may include:

- triggering conditions;
- eligibility and exclusion rules;
- foreshadowing requirements;
- involved roles, locations, and asset families;
- hidden cause categories;
- escalation behavior;
- possible nonviolent and tactical resolutions;
- consequences and persistent state changes;
- cooldown, uniqueness, and repetition limits;
- links to longer campaign seeds.

Pools are not collections of context-free random encounters. Selected events must fit current campaign state, established causality, pacing, and prior player choices.

### Presentation profile and asset intents

The package contains semantic presentation instructions rather than provider-specific media files.

Initial fields should cover:

- palette and interface mood tokens;
- typography and ornamentation families;
- location, character, creature, item, effect, and tactical-terrain intent IDs;
- portrait or silhouette requirements;
- scene-background descriptions;
- ambient audio and music mood labels;
- narration voice characteristics without requiring a synthesized voice;
- fallback text, icon, card, silhouette, and terrain mappings;
- asset priority and whether an intent is required, optional, or deferred.

GameFrame may initially present these through a developer theme, placeholder cards, text descriptions, existing terrain, and generic audio indicators. Later materialization replaces presentation resources, not campaign identities or state IDs.

### Reproducibility and provenance

The package records:

- `compiler_version`;
- `prompt_bundle_version`;
- `schema_version`;
- `campaign_seed`;
- `package_version`;
- `package_hash`;
- source brief and normalized brief;
- selected curated packs and their versions;
- validation results and warnings;
- compile timestamp;
- explicit amendments or migrations performed after initial compilation.

## Prompt and instruction boundary

The campaign compiler uses a versioned runtime-owned prompt bundle and structured output schema.

The prompt bundle may include:

- campaign architecture instructions;
- genre translation guidance;
- event-pool construction rules;
- originality and intellectual-property transformation rules;
- GameFrame mechanic and presentation capability summaries;
- hidden-state and audience-separation rules;
- package validation and self-review instructions;
- deterministic fallback behavior.

Raw system prompts, private compiler deliberation, hidden campaign secrets, provider credentials, and internal evaluation material must remain within RPG GM Runtime. They are not shared documents, campaign exports for players, or GameFrame player projections.

The shared contract defines required behavior and schemas. Runtime-specific prompt wording may evolve independently when it preserves the contract and remains versioned for reproducibility.

## Originality transformation

Player inspirations may refer to existing media, eras, genres, or recognizable combinations. The compiler should preserve the requested experience while producing an original campaign identity.

It may retain high-level elements such as:

- historical period;
- genre mixture;
- occupational fantasy;
- mood;
- broad technology or supernatural assumptions;
- desired pacing and activity types.

It must replace protected or overly derivative elements such as named characters, distinctive organizations, proprietary creatures, exact terminology, copied plots, signature visual designs, and setting-specific lore.

The compiler records the transformed premise in the player-safe pitch and records prohibited direct-copy elements in the runtime-only bible so later model realization does not drift back toward imitation.

## Visibility and security

Campaign compilation produces information in at least four scopes:

- `public` — safe for anyone with campaign access;
- `party` — safe for current players;
- `player_private` — scoped to one player or character;
- `runtime_only` — campaign secrets, event eligibility, hidden motives, unrevealed evidence, prompt instructions, and compiler metadata not intended for players.

GameFrame receives only the projections necessary for the current authenticated audience and operator-authorized development inspection.

A separate developer or administrator preview may show compiler diagnostics, hidden structure, asset intents, and validation failures when explicitly authorized. That view must never be reachable through ordinary player state or client-side hidden fields.

## Validation gates

Compilation fails or returns an explicit repair request when the package cannot satisfy required invariants.

A valid initial package must:

- preserve the core player idea after originality transformation;
- define a playable group role and opening reason to act together;
- provide a complete starter chapter with a valid one-shot resolution;
- contain at least one meaningful choice and more than one viable approach;
- distinguish hidden truth from player-safe information;
- provide coherent causal links between anomalies, evidence, actors, escalation, and consequences when mystery is present;
- avoid unsupported mechanics or map unsupported ideas onto available primitives;
- declare every required presentation resource through a resolvable prepared asset or deterministic fallback;
- fit configured session-length and content-boundary constraints;
- avoid mandatory dependence on live image, sound, or model providers after compilation;
- serialize, hash, persist, reload, and resume without semantic loss;
- remain stable under exact retry and process restart.

The first implementation should use a small number of well-tested schemas and event-pool archetypes rather than unrestricted campaign invention.

## Text-first GameFrame proving mode

Before media generation is operational, GameFrame should be able to preview and run compiled campaigns through a text-first development presentation.

The proving mode should display:

- player-safe title, pitch, roles, and campaign assumptions;
- scene text and NPC dialogue;
- location and character cards using deterministic placeholders;
- semantic asset-intent identifiers and fallback labels in operator-authorized views;
- choices, checks, objectives, relationships, inventories, and campaign state;
- tactical encounters using existing or generic compatible terrain and units;
- return scenes, recaps, reconnect, restart, and resume.

Generated media is an enhancement to this loop, not a prerequisite for proving campaign compilation, hidden-state integrity, or Game Master behavior.

## Ownership

### RPG GM Runtime owns

- compiler orchestration and model calls;
- normalized brief and compiled-package schemas;
- runtime-only prompt bundles and versions;
- hidden campaign bible, starter truth, event pools, and validation;
- package persistence, hashing, migrations, and deterministic fallback;
- live GM consumption of the committed package;
- non-player-visible compiler and campaign secrets.

### GameFrame owns

- player and operator campaign-creation interfaces;
- authenticated submission of freeform ideas, forms, and later interview responses;
- mechanic and presentation capability declarations supplied to the compiler;
- player-safe campaign preview and confirmation;
- audience-scoped campaign presentation;
- placeholder and prepared asset resolution;
- later media-intent materialization, storage, delivery, and replacement;
- tactical execution and committed encounter outcomes.

## Initial implementation slice

The first runtime slice should implement the contracts without requiring a live campaign-generation model.

It should include:

1. a versioned `CampaignBrief` schema accepting both concise concept text and structured fields;
2. a versioned `CompiledCampaignPackage` schema with player-safe, runtime-only, starter-spine, event-pool, presentation-intent, and provenance sections;
3. a deterministic compiler fixture that transforms a known brief into a valid package;
4. package validation, hashing, persistence, reload, and audience-projection tests;
5. a compiler port that permits a later hosted-model implementation;
6. a text-first GameFrame preview fixture using deterministic placeholders;
7. a Monster Master compilation fixture proving the prepared reference campaign through the generic contract;
8. one original transformed-theme fixture proving that a concise inspiration can become a distinct campaign without generated media.

A later slice may add the hosted compiler, structured repair loop, interactive brief interview, and provider-backed asset materialization.

## Non-goals

The initial compiler does not require:

- unrestricted open-world generation;
- a complete long campaign authored in advance;
- generated images, animation, music, or speech;
- exposing hidden packages or prompt instructions to players;
- allowing the model to invent new GameFrame mechanics dynamically;
- accepting every possible concept without repair or rejection;
- direct recreation of protected commercial settings;
- replacing authoritative campaign state with a text transcript.

## Governing rule

> Compile the player's idea into a validated, hidden, replay-safe campaign package; prove it through text and deterministic presentation first; materialize richer assets later without changing campaign truth.
