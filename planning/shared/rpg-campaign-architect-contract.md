---
title: RPG Campaign Architect and Package Construction Contract
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-18
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - handcrafted and player-inspired RPG campaigns
shared_document_id: rpg-campaign-architect-contract-v1
shared_document_version: 4
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
  - rpg-living-world-and-resolution-contract.md
  - rpg-platform-roadmap.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cross-repository-integration-testing.md
---

# RPG Campaign Architect and Package Construction Contract

## Decision

RPG GM Runtime contains a specialized **Campaign Architect** with two related responsibilities:

1. construct and validate the protected CampaignPackage foundation before ordinary campaign play begins;
2. perform **continuity-safe live campaign expansion** when player/world behavior requires substantial durable campaign substrate that is not already established.

The Dungeon Master does not absorb this campaign-construction responsibility simply because expansion is needed during play.

The CampaignPackage defines a protected semantic campaign foundation: stable setting rules, important pre-established locations/regions/routes, package-bearing actors/functions, materialization requirements, important causal truth, and world rules sufficient for GameFrame to begin persistent embodied play without renderer-specific geometry in Runtime truth.

The active campaign instance may then grow durable semantic world/story material through validated ordinary play and Campaign Architect expansion while preserving the protected foundation and already committed history.

Campaign compiler, plot agent, and campaign-generation agent remain aliases for capabilities that belong to Campaign Architect unless a later materially different responsibility justifies a separate specialized agent.

The Campaign Architect remains distinct from the Dungeon Master and deterministic substrate such as Character Factory, Entity Registry, Scene Registry, Observer Knowledge, attempted-operation/rules resolution, living-world scheduling/orchestration, and GameFrame materialization.

## Input modes

Initial campaign construction must eventually support:

- one-line or short freeform concepts;
- detailed player/owner specifications;
- structured campaign sheets;
- guided GameFrame creation;
- interactive interviews;
- prepared campaign families;
- imported packages that pass validation/migration.

Live expansion receives a different bounded input: the protected campaign foundation, relevant current committed campaign-instance truth, the concrete expansion need, GameFrame/rules/materialization capabilities, and explicit continuity/visibility constraints.

Unknowns, assumptions, and required repairs remain explicit.

## Initial draft, refinement, and commitment lifecycle

Campaign generation produces a **draft**, not automatically committed campaign truth.

```text
campaign brief / source material
→ Campaign Architect draft CampaignPackage
→ optional owner editing/refinement
→ deterministic validation
→ bounded repair when necessary
→ player-safe preview
→ explicit foundation commitment
```

This supports both a handcrafted Monster Master package and a generated bespoke campaign. Both become the same kind of protected committed foundation.

Owner editing before commitment is first-class. The validation boundary—not authoring origin—determines whether a package is executable.

## Protected foundation amendment rule

Ordinary play and live expansion never silently rewrite protected foundational truth.

If an owner wants to alter active foundational truth, use an explicit lifecycle:

```text
committed package version N
→ owner-authorized amendment/new draft
→ validation
→ migration/compatibility analysis
→ explicit acceptance
→ package version N+1 or explicit amendment record
```

Player/world actions may still create consequences that materially change the **campaign instance**. Destroying a building, killing or recruiting an actor where rules permit, exposing a secret, abandoning an objective, or creating a new organization is mutable campaign history rather than silent package rewriting.

## Live campaign expansion lifecycle

A live expansion is not a new package compile and is not Dungeon Master prose becoming truth.

```text
protected foundation + current campaign-instance state
→ play establishes a durable expansion need
→ Campaign Architect expansion proposal
→ continuity + authority + visibility + ruleset + materialization validation
→ idempotent campaign-instance expansion commit
→ GameFrame resolves/materializes supported presentation
→ Dungeon Master conducts play in expanded world
```

The expansion request and result need stable provenance/retry identity so an uncertain retry cannot create two versions of the same district, organization, or important actor set.

## Campaign Architect responsibilities

### Initial foundation construction

The Campaign Architect owns:

- interpreting/normalizing the brief;
- preserving requested player fantasy while creating an original campaign identity;
- selecting compatible prepared mechanics, themes, world kits, and content packs;
- setting tone, genre, boundaries, and campaign shape;
- producing campaign bible and continuity invariants;
- defining important factions, actors, motives, secrets, relationships, and package-bearing functions;
- producing a semantic WorldGraph and important location relationships;
- defining credible routes, alternate approaches, travel assumptions, and exploration affordances;
- defining important landmarks/objects/exits and materialization requirements without prescribing Pixi geometry;
- producing a starter spine and at least one complete resolution;
- creating/selecting plot structure, clue graph, event pools, escalation, recovery paths, and consequences;
- declaring checks/tactical opportunities compatible with GameFrame authority;
- declaring semantic presentation, world-kit, asset, narration, audio, and cinematic intents;
- validating that the package remains playable with deterministic/text fallbacks;
- recording package version, seed where applicable, hash, provenance, warnings, and migrations.

### Live continuity-safe expansion

The Campaign Architect owns substantial new semantic substrate required by play, including when appropriate:

- new regions/districts/settlements or substantial destinations;
- durable businesses/venues/organizations/factions;
- important supporting casts or new recurring role groups;
- new side threads or consequence branches requiring coherent structure;
- new routes/geography that are compatible with established world facts;
- causal/supporting material required to make an emergent branch playable;
- materialization/media requirements for that expansion;
- expansion-specific protected facts/visibility/forbidden-retcon constraints where needed.

Expansion is triggered by **need**, not every improvisational detail. The Architect is not called merely because an NPC needs a name, the player looks inside an ordinary cupboard, or a generic street needs a passerby.

It does not conduct ordinary player turns, perform live NPC dialogue, choose routine actor actions, resolve mechanics, or become the live narrator.

## Campaign Architect versus Dungeon Master

Use this separation:

```text
Campaign Architect
What durable campaign/world/story substrate must exist or be added?

Dungeon Master
What is happening now, what does this unusual intent mean, and how is established reality conducted/presented?

Living-world/rules/GameFrame substrate
What actors attempt, what mechanically happens, what persists, and what is physically rendered?
```

The Dungeon Master may request Architect expansion. It may not silently replace Architect by inventing substantial campaign structure inside an ordinary live turn.

## Campaign-bearing actors versus incidental characters

The Campaign Architect concretely binds actors that own protected package truth, including when applicable responsible actors, important allies/rivals, decisive witnesses, required clue owners, secret authorities, mandatory access roles, invariant relationships/obligations, and recurring characters needed by the foundation.

Live expansion may similarly introduce new durable actors/functions required by a new branch, provided they do not retroactively seize an already protected function.

Ordinary incidental people needed only during local live play are not a reason to invoke Campaign Architect. Character Factory materializes bounded incidental NPCs; those NPCs may later become important through play without changing their stable identity.

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
- **live expansion policy and constraints**;
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

This structure is a coherent playable foundation, not an obligation that players complete every authored objective before the campaign is allowed to continue.

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

## Campaign-instance expansion output

A live expansion should be narrower than a complete CampaignPackage and represent only the durable additions necessary for the expansion need.

Depending on the case it may add:

- semantic regions/locations/routes and materialization intent;
- durable actors/organizations and bounded private/public facts;
- relationships/affiliations;
- event/situation/pressure seeds;
- goals/opportunities/objectives where useful;
- new presentation roles/fallbacks;
- continuity guards/provenance;
- links to the exact triggering campaign state/revision.

It must not restate or duplicate the full package merely to add one branch.

## World generation posture

The Campaign Architect generates/defines **semantic world**, not final pixels.

Initial relationship:

```text
campaign brief
→ semantic world graph + location requirements
→ committed foundation
→ GameFrame scene materialization
→ accepted persistent playable scene
```

Live relationship:

```text
player/world creates expansion need
→ Architect semantic expansion
→ validation/commit
→ GameFrame materialization/fallback
→ persistent revisitable campaign-instance world
```

GameFrame may use authored prefabs, reusable world kits, deterministic composition, seeded procedural generation, and bounded generated media to realize the world.

A location that was not pre-materialized may be realized on demand when existing semantics already make it sufficiently defined. When substantial semantic definition is missing, use the Architect expansion path rather than asking the Dungeon Master to improvise a disposable paragraph-world.

Once accepted for a campaign instance, revisiting should return to that materialization identity/state rather than silently generating a replacement.

## Handcrafted package rule

A handcrafted package is not exempt from validation.

Monster Master is manually authored as the gold standard. It must pass the same package schema, visibility, persistence, commitment, entity/scene/knowledge/world/materialization, and Dungeon Master contracts as generated campaigns.

The Dungeon Master and GameFrame must not select separate execution paths based on package origin.

## Originality transformation

Player inspiration may use recognizable media shorthand. The Campaign Architect preserves high-level experience—era, genre blend, occupational fantasy, mood, technology assumptions, pacing, activity types, and broad world feel—while replacing protected/overly derivative names, organizations, creatures, terminology, plots, signature designs, and setting lore.

The system does not claim automatic legal safety. Transformation, validation, and operator review are product controls.

## Visibility and security

Packages and expansions use explicit visibility such as `public`, `party`, `player_private`, and `runtime_only` as appropriate.

GameFrame receives player-safe previews and viewer-authorized semantic projections required for play. It never receives the full hidden package/expansion truth in browser-accessible fields.

Canonical runtime entity names, motives, hidden relationships, and secret location/event facts are not automatically Observer Knowledge.

Raw Campaign Architect prompts/deliberation, hidden campaign truth, provider credentials, and internal evaluation material remain private to RPG GM Runtime.

## Foundation acceptance gates

A package is accepted only when it:

- preserves intended player concept after originality transformation;
- defines a playable group role/reason to begin together;
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
- serializes, hashes, persists, reloads, and resumes without semantic loss;
- survives exact retry/process restart;
- remains playable without live media generation after acceptance;
- can be consumed by the ordinary world/DM/entity/scene/knowledge path.

## Live expansion acceptance gates

An expansion is accepted only when it:

- has a concrete expansion need and source campaign revision/trigger;
- is compatible with protected setting/rules/causal truth;
- does not retcon known history or steal protected actor functions;
- uses stable identities and explicit visibility;
- fits existing WorldGraph/geography or explicitly adds compatible relationships;
- declares materialization/fallback requirements where relevant;
- is bounded to the requested branch rather than rewriting the full campaign;
- commits idempotently and reconstructs after restart;
- can be consumed by the ordinary Dungeon Master/world systems after commitment.

## Campaign media preparation

The Campaign Architect declares semantic media/world-kit requirements and priorities. GameFrame owns media resolution, composition, generation, validation, provenance, storage, delivery, replacement, and scene materialization.

Generated media does not own collision, location truth, or campaign authority and does not block semantic commitment when an approved readable fallback is available.

## Implementation sequence

1. maintain executable CampaignPackage validation/commitment;
2. preserve the existing durable entity/scene/observer/world foundation;
3. implement the generalized attempted-operation and rules/resolution seams;
4. add durable actor intentions/decision policy and bounded scene/world orchestration;
5. prove Monster Master living-world behavior without permanent actor-specific pipelines;
6. implement a bounded live Campaign Architect expansion contract and one Monster Master expansion canary;
7. prove complete embodied Monster Master behavior and same-map tactical return;
8. prove a materially different second handcrafted world;
9. expand Campaign Architect initial-generation/product workflows;
10. add owner-facing draft editing/review and richer creation/media workflows.

Broad generated-campaign productization remains gated by generality evidence. The **architecture** for live expansion is not postponed until after every other campaign feature because it is required for the free-form product itself.

## Non-goals of the first implementation

- unrestricted high-frequency infinite-world generation;
- continuously running model agents for every NPC;
- a multi-year campaign authored in full in advance;
- generated images/music/animation/speech as a validation requirement;
- generated final map screenshots as gameplay geometry authority;
- direct recreation of protected commercial settings;
- Campaign Architect creation of mechanics GameFrame/RPG Rulesets cannot execute;
- Dungeon Master completion of substantial missing campaign substrate during an ordinary live turn;
- invoking Campaign Architect for every incidental NPC/scene decoration;
- separate package formats for Monster Master and generated campaigns;
- split-party world generation before one-scene living-world behavior is proven.

## Governing rule

> The Campaign Architect owns both protected campaign construction and continuity-safe expansion; the Dungeon Master conducts live established reality; commitment protects foundation truth without turning it into a closed world; and GameFrame materializes every accepted handcrafted or generated semantic world through the same durable engine boundary.
