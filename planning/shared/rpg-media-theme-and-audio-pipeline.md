---
title: RPG Media, Theme, World-Kit, and Audio Pipeline
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - campaign media generation
  - embodied exploration materialization
  - narration audio
shared_document_id: rpg-media-theme-and-audio-pipeline-v1
shared_document_version: 4
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-media-theme-and-audio-pipeline.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-media-theme-and-audio-pipeline.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-platform-roadmap.md
  - rpg-campaign-architect-contract.md
  - rpg-rendering-and-asset-contract.md
---

# RPG Media, Theme, World-Kit, and Audio Pipeline

## Decision

Media responsibilities follow the two-agent architecture and the embodied exploration contract.

- **Campaign Architect:** declares semantic themes, world-kit needs, characters, creatures, locations, structures, props, terrain, effects, handouts, interface elements, narration styles, and audio/cinematic roles required by a CampaignPackage.
- **GameFrame:** resolves, composes, generates, validates, stores, versions, caches, delivers, replaces, and moderates player-facing assets and uses them to materialize playable scenes.
- **Dungeon Master:** uses accepted semantic identities during play and may request compatible incidental presentation, special poses, scene assets, or cinematic presentation, but does not redesign the campaign asset pack every turn.

RPG GM Runtime does not manage image/speech provider credentials and does not handcraft provider-specific prompts. GameFrame owns provider adapters/prompt compilation.

Generated media is never campaign authority, collision authority, or a prerequisite for legal play.

## Goals

The media/materialization system should provide:

- coherent art direction for each campaign;
- recurring character/location/world-kit consistency;
- rapid preparation of bespoke campaigns;
- economical reuse and deterministic composition;
- stable materialization identities for revisited locations;
- nonblocking text/silhouette/world-kit fallbacks;
- provider portability;
- inspectable provenance;
- stable campaign asset identities;
- bounded cost/moderation/replacement behavior;
- reusable vocabulary that grows more capable/cheaper across campaigns.

## CampaignPackage media/world profile

A CampaignPackage may declare:

- campaign theme intent;
- palette/material/architecture/clothing/terrain/prop/interface vocabularies;
- semantic world-kit families for roads, woods, water, structures, interiors, industrial/settled spaces, etc.;
- recurring character/creature/location/faction/item/effect/handout roles;
- exploration sprite/avatar/interaction-state requirements;
- tactical terrain/unit presentation requirements;
- narration voice/audio mood intents;
- cinematic-script requirements;
- continuity references;
- audience scope;
- priority/urgency;
- required/optional/deferred assets;
- deterministic fallback rules;
- originality/recognizable-copy avoidance constraints.

These are semantic requirements, not provider prompts, storage keys, URLs, Pixi geometry, or executable provider instructions.

## Campaign Architect relationship

During campaign preparation, Campaign Architect:

1. identifies reusable and campaign-specific world/media roles;
2. records stable semantic IDs in the CampaignPackage;
3. declares WorldGraph/location materialization needs;
4. supplies continuity descriptions/avoid constraints;
5. marks required/optional/deferred assets;
6. provides text/deterministic fallback requirements;
7. submits player-safe media previews for review where appropriate;
8. records accepted asset identities in package/preparation state without changing hidden truth.

Cloudflare-backed image generation may later help materialize the campaign asset/world kit through GameFrame's media API. GameFrame remains generation/storage/materialization authority.

## Dungeon Master relationship

During play, Dungeon Master:

- references accepted campaign asset IDs/semantic roles;
- requests scene/entity/item/effect/narration/ambience presentation when needed;
- may request an incidental NPC sprite/card/portrait-family assignment;
- may request a special action pose or high-value reveal image;
- may request a cinematic script using supported semantic presentation commands;
- continues play through existing/fallback presentation while better media is unavailable.

Dungeon Master may not silently replace recurring asset identity, alter campaign truth through media, expose hidden entities to providers/players, or issue provider-specific prompts.

## Inspiration-to-original transformation

Player shorthand may reference recognizable media. Campaign Architect first converts shorthand into an original campaign identity.

The process should extract broad genre/era/emotional/comedic/environmental/gameplay qualities while replacing protected names/logos/characters/distinctive phrases/copied plots/signature designs and creating original setting/world-kit vocabulary.

This is a product quality/risk-control practice, not legal certification.

## Resolution hierarchy

Every media/world-kit requirement follows this order.

### Level 1 — Accepted catalog reuse

Reuse an approved asset/world-kit piece when it satisfies semantic role and continuity.

Examples:

- terrain materials;
- trees/foliage;
- roads/paths;
- doors/windows/fences;
- carts/crates/signs;
- generic structures;
- body/pose/equipment families;
- common effects/icons.

### Level 2 — Deterministic composition

Compose approved layers/templates/palettes/accessories/scene elements/terrain families/structure kits/character parts through versioned reproducible recipes.

For exploration, prefer deterministic world composition over generating entire final map screenshots.

### Level 3 — Asynchronous generation

Use a configured provider when reuse/composition is inadequate or the asset has sufficient recurring/narrative value.

High-value candidates include:

- principal NPCs;
- unusual monsters;
- major locations/unique facades;
- campaign-specific architecture/terrain family masters;
- chapter/reveal art;
- exceptional artifacts;
- special cinematic poses.

Routine movement/actions/minor props should normally use catalog/composition/state changes rather than fresh inference.

## World-kit model

A world kit is a versioned collection of presentation/materialization assets/recipes usable by exploration scene compilation.

It may include:

- ground/terrain material families;
- roads/paths/shorelines/creeks;
- vegetation families;
- rocks/cliffs/elevation faces;
- structure shells/facades/doors/windows/roofs;
- fences/barriers/signage;
- carts/crates/furniture/field props;
- interaction-state variants;
- lighting/weather overlays;
- scene ambience/music roles;
- deterministic composition rules/compatibility metadata.

World kits do not own semantic location truth or collision. GameFrame materialization binds kit output to authoritative gameplay geometry.

## Character presentation model

Recurring entities should use stable presentation identity.

Where practical, ordinary gameplay states should use prepared/deterministic variants such as:

- idle;
- walk/move;
- face/direction;
- talk/interact;
- combat-ready;
- weapon/equipment state;
- damage/condition;
- defeat/recovery;
- contextual gesture.

Generate new imagery only when the existing state vocabulary cannot adequately present a high-value moment.

Small inconsistencies in one-off generated source art must never fork durable entity identity.

## Prompt compiler

GameFrame owns provider-neutral prompt compiler combining:

- semantic asset/world-kit intent;
- CampaignPackage theme profile;
- established entity/location continuity;
- asset-kind recipe;
- dimensions/perspective/anchoring/transparency/crop/safe-region requirements;
- style/palette constraints;
- originality/avoid constraints;
- provider-specific formatting/limits.

Material prompt-compiler changes receive new versions and do not silently overwrite accepted recurring assets.

## Asset/materialization registry lifecycle

Each accepted asset receives stable identity/provenance.

Lifecycle may include:

```text
requested -> fallback-ready -> queued -> generating
          -> validating -> accepted -> delivered
          -> rejected | failed | superseded
```

Cache/identity should account for campaign/semantic role, recurring entity/location identity, theme/world-kit version, recipe/prompt compiler version, provider/model/workflow version, source hash, dimensions/derivatives, and audience scope.

Accepted recurring assets remain stable until deliberately superseded.

Materialized scenes separately retain stable materialization identity/version/recipe/seed/semantic-anchor relationships under GameFrame authority.

## Provenance and rights metadata

Record as applicable:

- source type: catalog/composed/generated/imported/user-supplied;
- source IDs/license/rights notes;
- provider/model/workflow/adapter/recipe/prompt-compiler versions;
- content hash/creation time/storage identity;
- moderation/review status;
- campaign/audience scope;
- originality/avoid constraints;
- replacement/deletion relationships.

Assets without adequate provenance do not enter reusable global catalog.

## Validation before acceptance

Validation may check:

- file type/dimensions/duration/size;
- transparency/crop/anchoring/safe bounds;
- corruption/blank output/unusable framing;
- visual continuity;
- prohibited text/logos/watermarks/recognizable copying;
- moderation;
- deterministic derivatives;
- manifest/provenance completeness;
- exploration/tactical readability.

Generated output remains source material until accepted.

## Nonblocking play

GameFrame immediately presents one of:

- accepted campaign asset/world kit;
- deterministic composition;
- prepared theme fallback;
- neutral placeholder/silhouette/card;
- text-only fallback.

Later replacement changes presentation only. It does not replay commands/reorder events/alter mechanics/campaign truth.

A scene may be legally playable with approved fallback assets when required semantic/gameplay geometry exists.

## Cinematic scripts

Ordinary cutscenes should be semantic scripts executed by GameFrame, not generated video.

Supported script vocabulary may include:

- camera focus/pan/shake;
- entity move/face/pose;
- dialogue;
- GM intervention;
- effect playback;
- sound/music transition;
- encounter transition.

A script references accepted semantic identities and supported presentation commands. It does not own campaign truth.

Generated special poses/splash art may be requested when a high-value scene benefits.

## Narration and audio

Authoritative narration remains text.

Optional audio should support captions identical to authoritative text, bounded tone/pace tags, caching by normalized text/speaker mapping/language/voice version/settings, and immediate text fallback.

Later versions may add recurring voices/pronunciation/music/ambience/streaming/accessibility without changing semantic narration intent.

## Budgets/provider selection

GameFrame enforces:

- concurrent job limits;
- campaign/account budgets;
- quality tiers;
- timeout/retry limits;
- dimension/duration bounds;
- generation quotas;
- fallback after exhaustion;
- immediate/deferred/operator-approved/disabled policy.

Campaign Architect/Dungeon Master may express importance/urgency but do not override budgets/safety controls.

## Security/privacy

- runtime-only campaign truth/unrevealed entities are not sent to providers without explicit policy;
- provider credentials never reach browsers/RPG GM prompts;
- asset URLs/metadata follow audience rules;
- logs do not expose private prompts/provider responses/secrets/unrevealed content by default;
- retention/deletion covers prompts/binaries/audio/provenance/derivatives.

## Delivery sequence

1. preserve semantic theme/asset/fallback contracts;
2. prove catalog reuse/deterministic composition;
3. build Monster Master exploration world-kit foundations;
4. support stable exploration materialization/revisit using those assets;
5. add queued image generation/accepted-result storage;
6. connect Campaign Architect media/world preparation;
7. add economical narration/audio;
8. prove a generated bespoke campaign world/asset pack;
9. improve recurring continuity/quality tiers/voices/music/metrics.

Media work does not outrank executable world/entity/scene/knowledge/exploration correctness.

## Acceptance criteria

The pipeline is established when a CampaignPackage can:

1. declare original theme/world-kit/asset requirements;
2. reuse accepted assets;
3. compose deterministic terrain/structure/character/scene presentation;
4. materialize a playable exploration scene without generated pixels owning collision;
5. queue/accept a high-value custom asset;
6. continue play with fallback during generation;
7. replace fallback without changing campaign truth;
8. reuse accepted recurring entities/locations after reconnect/revisit;
9. execute a semantic cinematic script;
10. retain provenance/bounded cost evidence;
11. reject invalid/recognizable-copy output without blocking campaign.

## Governing rule

> The Campaign Architect declares what the campaign world needs; GameFrame builds and governs the reusable visual vocabulary/materialization; the Dungeon Master uses accepted identities; and no media provider becomes campaign, geometry, or gameplay authority.
