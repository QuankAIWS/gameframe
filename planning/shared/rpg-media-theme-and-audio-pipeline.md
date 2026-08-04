---
title: RPG Media, Theme, and Audio Pipeline
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - campaign media generation
  - narration audio
shared_document_id: rpg-media-theme-and-audio-pipeline-v1
shared_document_version: 1
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-media-theme-and-audio-pipeline.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-media-theme-and-audio-pipeline.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-cloudflare-deployment-architecture.md
  - ../rpg-gameframe-interface-contract.md
  - ../rpg-platform-delivery-plan.md
---

# RPG Media, Theme, and Audio Pipeline

## Decision

RPG GM Runtime requests media through semantic campaign descriptions. GameFrame owns the presentation recipes, catalogs, prompt compilation, composition, provider calls, caching, provenance, delivery, and fallbacks that turn those descriptions into player-facing art and audio.

The runtime does not handcraft provider-specific prompts and does not directly manage image or speech providers.

## Goals

The media system exists to make a campaign feel intentionally art-directed while preserving:

- rapid genre changes;
- recurring character and location consistency;
- economical reuse of existing work;
- deterministic fallbacks;
- provider portability;
- nonblocking play;
- inspectable provenance;
- clear separation between campaign meaning and presentation implementation.

## Semantic input contracts

### Campaign theme intent

The runtime may propose a bounded theme intent resembling:

```ts
type CampaignThemeIntentV1 = {
  protocolVersion: 1;
  themeIntentId: string;
  campaignId: string;
  requestedConcept: string;
  genreTags: string[];
  toneTags: string[];
  audienceRating: string;
  settingConstraints: string[];
  desiredMotifs: string[];
  avoid: string[];
};
```

The raw player request is input evidence, not the final theme pack. GameFrame and the runtime cooperate to produce an original, validated campaign theme brief with stable identity and versioning.

### Asset intent

The runtime requests meaning, not pixels:

```ts
type CampaignAssetIntentV1 = {
  protocolVersion: 1;
  assetIntentId: string;
  campaignId: string;
  entityRef?: string;
  assetKind:
    | "character-portrait"
    | "scene-background"
    | "terrain-family"
    | "unit-sprite"
    | "item-card"
    | "faction-mark"
    | "handout"
    | "effect"
    | "chapter-art";
  semanticDescription: string;
  presentationRole: string;
  continuityRefs: string[];
  urgency: "immediate" | "soon" | "background";
  audience: "public" | "party" | "player" | "runtime";
};
```

The exact schema may evolve, but these invariants remain:

- stable request and entity IDs;
- bounded text and collection sizes;
- explicit asset kind, urgency, and audience;
- references to established campaign continuity;
- no provider name, secret, raw storage key, or executable rendering code in runtime-authored input.

### Narration intent

The runtime supplies authoritative text and semantic delivery guidance:

```ts
type NarrationIntentV1 = {
  protocolVersion: 1;
  narrationIntentId: string;
  campaignId: string;
  text: string;
  speakerRef?: string;
  language: string;
  toneTags: string[];
  pace?: "slow" | "normal" | "fast";
  intensity?: "quiet" | "normal" | "strong";
  pronunciationHints?: Record<string, string>;
  audience: "public" | "party" | "player";
};
```

GameFrame owns provider selection, voice mapping, synthesis, captions, playback, and fallback.

## Inspiration-to-original theme translation

When a player supplies a franchise or brand as shorthand, the system creates an original theme brief before producing campaign content or media.

The transformation process should:

1. extract broad genre, emotional, comedic, environmental, and gameplay qualities;
2. remove protected names, logos, distinctive phrases, character identities, and copied story elements;
3. create original setting rules, factions, character archetypes, conflicts, terminology, architecture, clothing, props, palettes, and visual motifs;
4. record explicit avoid constraints for recognizable copying;
5. generate a theme pack with stable versioning;
6. preserve the player's desired feeling without presenting the campaign as official or affiliated.

Example transformation:

```text
player shorthand
  "a SpongeBob campaign"

extracted qualities
  bright undersea comedy, eccentric service workers,
  absurd neighborhood problems, nautical slapstick

originalized result
  an original reef-city workplace adventure with new species,
  businesses, neighborhoods, visual silhouettes, jokes, factions,
  terminology, and conflicts
```

The system must not claim automatic legal safety. Theme translation is a product control and quality practice, not legal certification.

## Theme packs

A theme pack is the stable presentation layer for a campaign or reusable genre family. It may contain:

- theme identity and version;
- original premise, tone, naming rules, and dialogue guidance;
- palettes, materials, lighting, weather, architecture, clothing, terrain, and prop vocabularies;
- UI ornamentation and typography guidance;
- character silhouette and portrait guidance;
- item, faction, quest, and handout card recipes;
- terrain and encounter dressing mappings;
- animation, particle, transition, and camera guidance;
- narration style and audio mood;
- catalog preferences and fallback mappings;
- provider-neutral generation recipes;
- negative constraints and recognizable-copy avoidance rules;
- provenance and moderation status.

A theme pack may reskin mechanics but cannot alter rules unless an explicit GameFrame game or campaign mechanic references a validated mechanical definition.

## Resolution hierarchy

Every asset request follows this order.

### Level 1 — Catalog reuse

Search global, genre, theme, and campaign catalogs for an approved asset that satisfies the semantic role.

Examples include:

- medieval fantasy terrain and props;
- western cacti, tumbleweeds, saloon elements, and clothing;
- common portraits, item silhouettes, effects, and card frames;
- previously accepted campaign characters and locations.

Catalog reuse is the preferred result when it preserves continuity and quality.

### Level 2 — Deterministic composition

Compose approved layers, templates, and variants without a generative provider.

Examples include:

- portrait body, clothing, hat, expression, palette, frame, and background layers;
- scene cards assembled from sky, terrain, architecture, weather, decals, and overlays;
- item cards assembled from silhouette, material, palette, rarity, ornament, and effect layers;
- terrain families assembled from semantic tiles, props, edge treatments, and elevation cues.

Composition recipes are versioned and reproducible. The same inputs should produce the same artifact or equivalent deterministic derivatives.

### Level 3 — Asynchronous generation

Invoke a configured image or media provider when reuse and composition are inadequate or when the asset has sufficient narrative value.

Good candidates include:

- principal NPC portraits;
- campaign and chapter art;
- major locations;
- boss reveals;
- exceptional artifacts;
- unusual genre-specific terrain families;
- a missing recurring asset that will be reused many times.

Ordinary movement, attacks, generic loot, and routine environmental details should usually use catalog or composed assets.

## Prompt compiler

GameFrame owns a provider-neutral prompt compiler. It combines:

- semantic asset intent;
- theme pack;
- established entity continuity;
- asset-kind recipe;
- dimensions, perspective, anchoring, transparency, and crop requirements;
- style and palette constraints;
- recognizable-copy avoidance constraints;
- provider-specific formatting and limits.

The compiler emits a versioned provider request. Provider-specific prompting remains inside adapters and recipes, not in campaign truth or model narration.

A prompt compiler change that materially affects consistency must receive a new version and must not silently overwrite accepted recurring assets.

## Asset registry and cache

Each accepted asset receives one stable identity. Cache keys should account for:

- semantic entity or presentation role;
- theme pack version;
- asset recipe version;
- continuity references;
- provider and model or workflow version when generated;
- prompt compiler version;
- source content hash;
- requested dimensions and derivative profile.

The registry tracks statuses such as:

```text
requested -> fallback-ready -> queued -> generating
          -> validating -> accepted -> delivered
          -> rejected | failed | superseded
```

An accepted recurring NPC portrait, location, faction mark, or item identity is reused until deliberately superseded. New generations do not silently replace campaign continuity.

## Provenance and rights metadata

Record at least:

- whether the artifact is catalog, composed, generated, imported, or user-supplied;
- source asset IDs and licenses or rights notes;
- provider, model, workflow, and adapter versions;
- prompt compiler and recipe versions;
- content hash, creation time, and storage identity;
- moderation result and reviewer when applicable;
- campaign and audience scope;
- franchise-distance or avoid constraints used;
- replacement and deletion relationships.

Assets without adequate provenance must not be promoted into the reusable global catalog.

## Validation before acceptance

Depending on asset kind, validation may check:

- file type, dimensions, duration, and size;
- transparency and edge quality;
- sprite anchoring and safe bounds;
- card crop and text-free safe regions;
- obvious corruption or blank output;
- visual continuity with reference assets;
- prohibited logos, text, watermarks, or recognizable copied elements;
- content moderation policy;
- deterministic derivative generation;
- manifest completeness and provenance.

A generated output is source material until it passes the acceptance path.

## Nonblocking presentation

GameFrame publishes an immediate presentation using one of:

- an existing campaign asset;
- a theme fallback;
- a deterministic composed placeholder;
- a neutral system placeholder;
- text-only presentation.

When a better artifact becomes ready, GameFrame publishes a bounded replacement event. Replacement must not reorder campaign truth, replay a player command, or alter mechanics.

Players should see controlled progressive enhancement rather than a frozen interface waiting for generation.

## Narration and speech synthesis

### Initial posture

Begin with text as the authoritative output and basic economical text-to-speech as optional enrichment.

The first version should support:

- one default narrator voice;
- captions identical to authoritative narration text;
- bounded tone and pacing tags;
- caching by normalized text, speaker mapping, voice version, language, and synthesis settings;
- play, pause, replay, mute, and volume controls;
- immediate text fallback when synthesis is unavailable.

### Later quality layers

Later versions may add:

- recurring narrator and NPC voice identities;
- higher-quality synthesis for major scenes;
- pronunciation dictionaries;
- streaming playback;
- emotion and performance controls;
- music and ambience beds;
- user accessibility preferences;
- provider selection based on quality, latency, and budget.

The provider may change without changing the narration intent contract.

## Budgets and provider selection

GameFrame enforces campaign and deployment policy for:

- maximum concurrent jobs;
- per-campaign and per-account spend;
- asset-kind quality tiers;
- provider timeout and retry limits;
- maximum output dimensions and duration;
- daily or monthly generation quotas;
- fallback behavior after budget exhaustion;
- whether a request is immediate, deferred, operator-approved, or disabled.

The runtime may express narrative importance and urgency but does not override deployment budgets or provider safety limits.

## Security and privacy

- Private campaign descriptions and unrevealed entities must not be sent to providers without the configured privacy policy allowing it.
- Provider credentials never reach browsers or RPG GM Runtime prompts.
- Asset URLs and metadata honor the same public, party, player, and runtime audience rules as campaign presentation.
- Logs must not expose private prompts, provider responses, secrets, or unrevealed campaign data by default.
- Deletion and retention policy must cover generated binaries, prompts, audio, provenance, and derivatives.

## Delivery phases

### M0 — Contracts and deterministic fixtures

- freeze theme, asset, narration, registry, and provider adapter contracts;
- create deterministic western, undersea-comedy, and medieval-fantasy fixtures;
- prove catalog reuse, composition, placeholder, and failure behavior.

### M1 — Catalog and composition

- establish reusable asset manifests and theme packs;
- implement deterministic card, portrait, scene, and terrain composition where practical;
- add validation and reproducibility checks.

### M2 — Queued image generation

- add provider-neutral image generation jobs;
- store accepted results and provenance;
- prove duplicate delivery, retries, rejection, and replacement events.

### M3 — Basic narration audio

- add economical text-to-speech behind the narration adapter;
- store and cache audio;
- prove captions and text fallback.

### M4 — Campaign consistency and quality

- add recurring entity reference workflows;
- add higher-value generation tiers and optional improved voices;
- measure cost, latency, cache hit rate, rejection rate, continuity, and player preference.

## Acceptance criteria

The media pipeline is established when one campaign can:

1. originalize a franchise-inspired theme request into a documented theme pack;
2. use an existing medieval or western catalog without unnecessary provider calls;
3. compose at least one deterministic portrait, card, scene, and terrain presentation;
4. queue and accept a custom major NPC or location asset;
5. continue play with a placeholder during generation;
6. replace the placeholder without changing campaign truth;
7. reuse the accepted asset consistently after reconnect and later sessions;
8. synthesize optional narration and fall back to text on failure;
9. retain complete provenance and bounded cost evidence;
10. reject or quarantine an invalid or recognizable-copy output without blocking the campaign.

## Governing rule

> The runtime requests meaning; GameFrame reuses, composes, or generates the presentation; accepted assets become durable campaign identities; and no media provider is allowed to become a gameplay dependency.