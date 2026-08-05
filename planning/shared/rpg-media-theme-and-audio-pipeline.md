---
title: RPG Media, Theme, and Audio Pipeline
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - campaign media generation
  - narration audio
shared_document_id: rpg-media-theme-and-audio-pipeline-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-media-theme-and-audio-pipeline.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-media-theme-and-audio-pipeline.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-platform-roadmap.md
  - rpg-campaign-compiler-contract.md
  - rpg-platform-product-goals.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Media, Theme, and Audio Pipeline

## Decision

Media responsibilities follow the two-agent architecture.

- **Campaign Architect:** decides which semantic themes, characters, creatures, locations, props, terrain, effects, handouts, interface elements, narration styles, and audio roles a CampaignPackage requires.
- **GameFrame:** resolves, composes, generates, validates, stores, versions, caches, delivers, replaces, and moderates player-facing assets.
- **Dungeon Master:** uses accepted semantic identities during play and may request compatible incidental presentation, but does not redesign the campaign asset pack every turn.

RPG GM Runtime does not manage image or speech provider credentials and does not handcraft provider-specific prompts. GameFrame owns provider adapters and prompt compilation.

Generated media is never campaign authority and never a prerequisite for package validation or legal play.

## Goals

The media system should provide:

- coherent art direction for each campaign;
- recurring character and location consistency;
- rapid preparation of new bespoke campaigns;
- economical reuse and deterministic composition;
- nonblocking text and placeholder fallbacks;
- provider portability;
- inspectable provenance;
- stable campaign asset identities;
- bounded cost, moderation, and replacement behavior.

## CampaignPackage media profile

A CampaignPackage may declare:

- campaign theme intent;
- palette, materials, architecture, clothing, terrain, prop, and interface vocabularies;
- recurring character, creature, location, faction, item, effect, and handout roles;
- tactical terrain and unit presentation requirements;
- narration voice and audio mood intents;
- continuity references;
- audience scope;
- priority and urgency;
- required, optional, and deferred assets;
- deterministic fallback rules;
- originality and recognizable-copy avoidance constraints.

These are semantic requirements, not provider prompts, storage keys, URLs, or executable rendering instructions.

## Campaign Architect relationship

During campaign preparation, the Campaign Architect:

1. identifies reusable and campaign-specific presentation roles;
2. records stable semantic IDs in the CampaignPackage;
3. supplies continuity descriptions and avoid constraints;
4. marks required, optional, and deferred assets;
5. provides text and deterministic fallback requirements;
6. submits player-safe media previews for review where appropriate;
7. records accepted asset identities in package amendments or preparation state without changing hidden campaign truth.

When Cloudflare-backed image generation becomes available, the Campaign Architect may orchestrate a campaign preparation workflow through GameFrame's media API. GameFrame remains the generation and storage authority.

## Dungeon Master relationship

During play, the Dungeon Master:

- references accepted campaign asset IDs and semantic roles;
- requests scene, character, item, effect, narration, or ambience presentation when needed;
- may request an incidental NPC card, portrait-family assignment, or location fallback compatible with package rules;
- continues play through text or existing fallbacks while better media is unavailable.

The Dungeon Master may not silently replace recurring asset identity, alter campaign truth through media, expose hidden entities to providers or players, or issue provider-specific generation prompts.

## Inspiration-to-original transformation

Player shorthand may reference recognizable media. The Campaign Architect first converts that shorthand into an original campaign identity.

The process should:

1. extract broad genre, era, emotional, comedic, environmental, and gameplay qualities;
2. remove protected names, logos, characters, distinctive phrases, copied plots, and signature designs;
3. create original setting rules, factions, terminology, architecture, clothing, props, silhouettes, conflicts, and motifs;
4. record explicit avoid constraints;
5. produce a versioned theme profile and CampaignPackage;
6. keep player intent while avoiding claims of official affiliation.

This is a product quality and risk-control practice, not legal certification.

## Resolution hierarchy

Every media requirement follows this order.

### Level 1 — Accepted catalog reuse

Reuse an approved asset when it satisfies the semantic role and continuity requirement.

### Level 2 — Deterministic composition

Compose approved layers, templates, palettes, accessories, scene elements, terrain families, card frames, silhouettes, and effects through versioned reproducible recipes.

### Level 3 — Asynchronous generation

Use a configured provider when reuse and composition are inadequate or the asset has sufficient recurring or narrative value.

High-value candidates include principal NPCs, major locations, chapter art, unusual creatures, boss reveals, exceptional artifacts, and reusable campaign-specific terrain.

Routine actions, ordinary props, and minor incidental details should usually use catalog, composition, silhouette, card, or text fallback.

## Prompt compiler

GameFrame owns the provider-neutral prompt compiler. It combines:

- semantic asset intent;
- CampaignPackage theme profile;
- established entity continuity;
- asset-kind recipe;
- dimensions, perspective, anchoring, transparency, crop, and safe-region requirements;
- style and palette constraints;
- originality and avoid constraints;
- provider-specific formatting and limits.

Material prompt-compiler changes receive new versions and do not silently overwrite accepted recurring assets.

## Asset registry and lifecycle

Each accepted asset receives stable identity and provenance.

Lifecycle may include:

```text
requested -> fallback-ready -> queued -> generating
          -> validating -> accepted -> delivered
          -> rejected | failed | superseded
```

Cache and identity should account for:

- campaign and semantic role;
- recurring entity identity;
- theme profile version;
- recipe and prompt-compiler version;
- provider and model or workflow version when generated;
- source content hash;
- dimensions and derivative profile;
- audience scope.

Accepted recurring assets remain stable until deliberately superseded.

## Provenance and rights metadata

Record:

- source type: catalog, composed, generated, imported, or user-supplied;
- source asset IDs and license or rights notes;
- provider, model, workflow, adapter, recipe, and prompt-compiler versions;
- content hash, creation time, and storage identity;
- moderation and review status;
- campaign and audience scope;
- originality and avoid constraints;
- replacement and deletion relationships.

Assets without adequate provenance do not enter the reusable global catalog.

## Validation before acceptance

Validation may check:

- file type, dimensions, duration, and size;
- transparency, crop, anchoring, and safe bounds;
- corruption, blank output, or unusable framing;
- visual continuity;
- prohibited text, logos, watermarks, or recognizable copying;
- content moderation;
- deterministic derivatives;
- manifest and provenance completeness;
- tactical readability where required.

Generated output remains source material until accepted.

## Nonblocking play

GameFrame immediately presents one of:

- an accepted campaign asset;
- a prepared theme fallback;
- a deterministic composition;
- a neutral placeholder;
- a silhouette or character card;
- text-only presentation.

A later replacement changes presentation only. It does not replay commands, reorder events, alter mechanics, or change campaign truth.

## Narration and audio

Authoritative narration remains text.

Initial optional audio should support:

- one narrator voice;
- captions identical to authoritative text;
- bounded tone and pace tags;
- caching by normalized text, speaker mapping, language, voice version, and settings;
- play, pause, replay, mute, and volume;
- immediate text fallback.

Later versions may add recurring voices, pronunciation dictionaries, higher-quality synthesis, music, ambience, streaming, and accessibility preferences without changing the narration intent contract.

## Budgets and provider selection

GameFrame enforces:

- concurrent job limits;
- campaign and account budgets;
- quality tiers;
- timeout and retry limits;
- dimensions and duration bounds;
- generation quotas;
- fallback after budget exhaustion;
- immediate, deferred, operator-approved, or disabled policy.

The Campaign Architect and Dungeon Master may express importance and urgency but do not override deployment budgets or safety controls.

## Security and privacy

- Runtime-only campaign truth and unrevealed entities are not sent to providers without explicit policy.
- Provider credentials never reach browsers or RPG GM Runtime prompts.
- Asset URLs and metadata follow campaign audience rules.
- Logs do not expose private prompts, provider responses, secrets, or unrevealed content by default.
- Retention and deletion cover prompts, binaries, audio, provenance, and derivatives.

## Delivery sequence

1. freeze semantic theme, asset, narration, registry, and adapter contracts;
2. prove catalog reuse and deterministic composition;
3. support Monster Master prepared assets and fallbacks;
4. add queued image generation and accepted result storage;
5. connect Campaign Architect media preparation;
6. add economical optional narration audio;
7. prove a generated bespoke campaign asset pack;
8. improve recurring continuity, quality tiers, voices, music, and metrics.

This sequence follows `rpg-platform-roadmap.md`; media work does not outrank the executable CampaignPackage and Dungeon Master proof.

## Acceptance criteria

The pipeline is established when a CampaignPackage can:

1. declare original theme and asset requirements;
2. reuse accepted assets;
3. compose deterministic portrait, card, scene, and terrain presentation;
4. queue and accept a high-value custom asset;
5. continue play with fallback during generation;
6. replace fallback without changing campaign truth;
7. reuse accepted recurring identities after reconnect;
8. synthesize optional narration and fall back to text;
9. retain provenance and bounded cost evidence;
10. reject invalid or recognizable-copy output without blocking the campaign.

## Governing rule

> The Campaign Architect declares what the campaign needs; GameFrame materializes and governs the media; the Dungeon Master uses accepted identities; and no provider becomes campaign authority or a gameplay dependency.
