---
title: RPG Agent Architecture and Campaign Package Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-18
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - handcrafted campaigns
  - generated campaigns
shared_document_id: rpg-agent-architecture-and-campaign-package-v1
shared_document_version: 7
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-agent-architecture-and-campaign-package.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-agent-architecture-and-campaign-package.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-living-world-and-resolution-contract.md
  - rpg-campaign-architect-contract.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-platform-roadmap.md
---

# RPG Agent Architecture and Campaign Package Contract

## Decision

The RPG platform currently requires two distinct specialized generative responsibilities, but **does not freeze the architecture to exactly two agents forever**.

1. **Campaign Architect** — constructs/validates the initial CampaignPackage and later performs continuity-safe campaign-instance expansion when play requires substantial new campaign substrate.
2. **Dungeon Master** — conducts live play inside established reality: referee/world adjudication, narration, Ask-GM, perspective-bounded entity performance, unusual intent interpretation, immediate pacing/consequences, and aftermath/intervention.

Future specialized generative capabilities may be introduced only when a materially different job requires different context, authority, cadence, evaluation, or cost controls. Do not create an agent merely because a deterministic service can be anthropomorphized.

The platform also contains deterministic/runtime substrate that is **not another campaign agent**:

- CampaignPackage validator and protected package commitment;
- campaign journal;
- Entity Registry;
- Character Factory;
- Scene Registry;
- semantic Observer Knowledge / player projections;
- World State / actor intention projections as they are proven;
- Dungeon Master Context Compiler;
- semantic WorldGraph/location services;
- attempted-operation normalization/validation;
- bounded scene/world orchestration;
- world scheduling/event processing;
- GameFrame RPG Engine materialization/exploration interfaces;
- RPG Ruleset and Game Family interfaces;
- Tactical Activation Coordinator;
- Battle Pack/BattleScenario contracts;
- deterministic mechanic coordinators/adapters.

Runtime/GameFrame substrate owns facts and outcomes that must not depend on model recollection.

`rpg-living-world-and-resolution-contract.md` controls the shared execution model for attempted operations, rules resolution, actor intentions, bounded consequence propagation, and live campaign expansion.

## Engine/ruleset/game-family relationship

The agents do not constitute the whole RPG engine.

**GameFrame RPG Engine** is the campaign-agnostic embodied player/mechanics/world engine. **RPG Rulesets** plug deterministic game-specific behavior into it. A **Game Family** binds reusable rules/content/assets shared by related campaign and simulator experiences. CampaignPackages provide protected campaign foundation. Durable campaign-instance state records what grows and changes through play. Battle Packs provide simulator-safe tactical content for Battle Simulator.

Conceptually:

```text
                       Game Family
                 /          |          \
          RPG Ruleset   reusable      Battle Pack
                       content/assets      |
                 \          |          Battle Simulator
                  \         |
                  CampaignPackage
                        |
             campaign-instance world
                        |
GameFrame RPG Engine ←→ RPG GM Runtime semantic world
        ↑                        ↑
        └── attempted operations ┘
                 +
      Dungeon Master / Architect
       at different boundaries
```

For Monster Master:

```text
Monster Master RPG
= GameFrame RPG Engine
+ Monster Master Ruleset / game-family content
+ Monster Master CampaignPackage
+ durable campaign-instance world

Monster Master Arena Battles
= Battle Simulator
+ Monster Master Ruleset / game-family content
+ Monster Master Battle Pack
+ BattleScenario
```

The two surfaces share rules/content where compatible but do not share lifecycle. Campaign combat stays inside the current RPG world through Tactical Activation; it never launches Battle Simulator.

## Official terminology

- **Campaign Architect** — campaign construction and continuity-safe expansion generative capability.
- **Dungeon Master** — live campaign-running/referee/character-performance capability.
- **CampaignPackage** — protected durable semantic campaign foundation.
- **campaign-instance world** — durable mutable/expandable semantic state established through play and validated expansion.
- **GameFrame RPG Engine** — reusable campaign-agnostic embodied RPG engine; internal architecture terminology.
- **Games** — top-level player-facing GameFrame destination.
- **Role-Playing Games** — player-facing generic campaign library/creation/resume surface.
- **Battle Simulator** — player-facing standalone tactical sandbox surface.
- **RPG Ruleset** — deterministic game-specific mechanics/capabilities independent of one campaign package.
- **Game Family** — reusable rules/content identity shared by related campaign and simulator experiences.
- **Monster Master Ruleset / Game Family** — first major rules/content family shared by Monster Master RPG and Monster Master Arena Battles.
- **Battle Pack** — simulator-safe tactical content/configuration for one Game Family; never a second ruleset.
- **BattleScenario** — standalone battle setup instance selecting pack/ruleset/map/teams/objectives/deployment.
- **WorldGraph** — semantic location/route relationship model owned by campaign/runtime meaning, not Pixi geometry.
- **Character Factory** — deterministic/schema-first bounded incidental-character materialization substrate.
- **Scene Registry** — semantic authority for zero-or-more active scenes and membership.
- **Observer Knowledge** — sparse semantic knowledge/belief state for players/NPCs/other bounded observers.
- **Attempted Operation** — typed proposal that an actor/system is trying to perform something; never success by itself.
- **Tactical Activation** — transition of the current materialized GameFrame scene into turn-based tactical authority without changing maps.
- **Tactical Activation Coordinator** — semantic/runtime coordination replacing the old destination concept of an Encounter Scene Compiler.

Campaign compiler and plot agent remain retired aliases where Campaign Architect covers the job. This does not prohibit a future specialized agent whose responsibility is genuinely different from Campaign Architect or Dungeon Master.

## Campaign Architect responsibilities

Campaign Architect has two operating responsibilities using explicit context/lifecycle boundaries.

### Initial campaign construction

It owns:

- brief normalization/assumptions;
- originality transformation;
- setting rules/tone/boundaries/player fantasy;
- campaign bible/continuity invariants;
- semantic WorldGraph, important locations/routes/regions;
- important factions/actors/motives/secrets/relationships;
- opening situation and group-cohesion design;
- clue/evidence structure where relevant;
- event/complication/pressure/escalation material;
- multiple viable approaches;
- consequence/recovery/resolution conditions;
- RPG Ruleset/capability requirements;
- tactical opportunities/objective expectations without prescribing a separate battle map;
- semantic materialization/media requirements;
- provenance/version/hash/validation/migrations.

### Live continuity-safe expansion

When play materially outruns established campaign substrate, Campaign Architect may propose new durable campaign-instance material such as:

- a newly pursued destination/region/district;
- a substantial venue/business/organization;
- a new durable faction or cast required by player choices;
- a side thread or consequence branch requiring coherent structure;
- relationships, routes, locations, supporting actors, and causal material required to make that branch playable;
- materialization/media requirements for the new semantic world.

The Architect receives relevant protected foundation + current committed campaign-instance truth + the expansion need. It does **not** silently retcon existing truth. Its output remains a proposal until validation/commitment.

Small incidental details do not require Architect invocation. Character Factory, deterministic world systems, and bounded Dungeon Master local interpretation remain appropriate when a full campaign expansion would be wasteful.

After the generic ruleset/game-family schema is proven across multiple handcrafted families, Campaign Architect may also coordinate/select/create bounded reusable game-family material needed by a generated concept, including compatible validated ruleset/profile definition, reusable content, world/materialization themes, and simulator-safe Battle Packs.

## Campaign construction lifecycle

```text
brief/source
→ select/create compatible validated game-family/ruleset profile as needed
→ draft CampaignPackage
→ optional draft Battle Pack when appropriate
→ optional owner refinement
→ validation/bounded repair
→ player-safe preview
→ explicit foundation commitment
```

Handcrafted/generated/imported origin is provenance, not an execution-mode switch.

## Live expansion lifecycle

```text
committed foundation + current campaign-instance world
→ expansion need caused by player/world behavior
→ Campaign Architect expansion proposal
→ continuity/authority/visibility/materialization validation
→ idempotent campaign-instance expansion commit
→ GameFrame materialization/fallback
→ Dungeon Master conducts ordinary live play in expanded world
```

The expansion commit is not package recompilation. Protected foundational truth remains protected.

## Dungeon Master responsibilities

Dungeon Master receives protected package truth plus typed durable current state compiled for the current trigger/context mode.

It owns/proposes:

- referee/world adjudication;
- narration/framing;
- arbitrary plausible freeform intent interpretation;
- entity/NPC dialogue and performance;
- Ask-GM rules/character-knowledge responses;
- immediate pacing and eligible event realization;
- bounded immediate consequences;
- local interpretation compatible with current world truth;
- Character Factory requests for bounded incidentals;
- supported mechanic/rules requests;
- reasons/objectives for Tactical Activation;
- aftermath/GM intervention;
- requests for Campaign Architect expansion when live play requires durable substrate beyond ordinary local improvisation.

Dungeon Master is **not** the campaign-expansion authority. It should not silently create an entire district, faction, campaign branch, or other substantial world structure simply because the player left the expected route.

Dungeon Master may not replace:

- protected campaign premise/setting rules;
- established causes/motives/relationships;
- committed clue logic;
- revealed facts/previous consequences;
- stable entity identity;
- semantic physical presence;
- observer/player knowledge authorization;
- deterministic GameFrame/RPG Ruleset mechanic outcomes;
- accepted scene materialization identity/geometry as if it were prose-only fiction.

Model output becomes campaign truth only after validation/commitment in the appropriate authority domain.

## Dungeon Master context modes

The same Dungeon Master capability may operate under different structurally compiled contexts. These are context-custody modes, not a claim that no future separate agent may ever exist.

### Referee/world adjudication

Receives broad hidden context required to interpret unusual immediate intent, event eligibility, consequences, supported check/rules requests, hidden causality, and world reactions.

### Game Master communication

Answers player Ask-GM requests from committed rules and **player-authorized** character knowledge. It does not reveal hidden runtime truth merely because referee mode knows it.

### Entity performance/cognition

Portrays or reasons for one bound durable entity using only that entity's authorized knowledge/beliefs/memories/goals/relationships/current observations plus bounded portrayal/cognition constraints.

A Pell call is not an omniscient referee call with “pretend to be Pell” instructions. A durable NPC also does not require a permanently running LLM session.

### Bounded scene/ensemble adjudication

When multiple actors must react within one local consequence chain, the Runtime may coordinate a bounded scene-resolution cycle. Referee truth may adjudicate the scene, but individual actor claims/actions must remain consistent with each actor's authorized knowledge and actual capabilities.

### Aftermath/intervention

Frames results of deterministic mechanics/world transitions or proactively presents GM narration/intervention after required semantic truth is committed/authorized.

## CampaignPackage boundary

A CampaignPackage is executable semantic campaign foundation, not a prose pitch and not a complete enumeration of everything that may ever exist during play.

It contains at least, as campaign needs require:

### Player-safe material

- title/premise;
- player role/fantasy;
- tone/content summary;
- character guidance;
- player-facing assumptions/boundaries;
- ruleset/game-family identification/capability expectations safe to reveal.

### Runtime-only bible

- setting truths/invariants;
- hidden chronology/causality;
- factions/actors/motives/secrets/limits;
- hidden relationships;
- prohibited retcons;
- audience/knowledge classifications.

### Semantic world foundation

- WorldGraph/regions/locations/routes that must exist initially;
- important location semantics;
- traversability/route constraints;
- initial scene/presence state;
- required landmarks/objects/entities;
- materialization intents/constraints;
- meaningful alternate approaches;
- rules/constraints governing compatible on-demand expansion.

The package does **not** own Pixi coordinates, texture paths, generated map pixels, per-frame movement transforms, or collision meshes.

### Playable campaign structure

- opening situation/group cohesion;
- functional beats without mandatory scene order;
- alternative approaches;
- events/pressure/recovery;
- clue/evidence graph where applicable;
- checks/choices/tactical triggers;
- consequence/resolution conditions;
- complete starter/engineering resolution;
- continuation seeds where relevant.

A starter resolution proves package quality; it does not mean continued campaign play becomes illegal when players abandon or transform that intended spine.

### Entities/knowledge

- stable package-bearing entity IDs;
- canonical identity and player-safe descriptors;
- roles/relationships/affiliations;
- initial semantic locations/presence;
- public/hidden facts;
- initial player/observer knowledge where required;
- semantic presentation identity;
- open role slots where deliberately allowed.

### Rules/mechanics/presentation

- Game Family / RPG Ruleset/profile/version/capability requirements;
- check/mechanic intents;
- tactical objective/activation requirements;
- semantic terrain/entity/item/effect/handout/UI roles;
- deterministic fallback expectations;
- accessibility-safe text equivalents.

### Reproducibility

- schema/package versions;
- source/normalized brief;
- authoring mode;
- authoring/prompt/manual version;
- seed where applicable;
- package hash;
- validation evidence;
- amendments/migrations.

## Campaign foundation versus campaign-instance world

Protected CampaignPackage foundation and mutable campaign-instance world are separate concepts.

The campaign-instance world may durably add/change, through validated ordinary play or Architect expansion:

- incidental and recurring people;
- local locations/businesses/organizations;
- compatible routes and materializations;
- relationships/commitments;
- world/object state;
- current goals/intentions;
- side situations and emergent threads;
- consequences and new opportunities.

Once committed, these are real campaign truth and survive restart/revisit. They cannot be discarded merely because they were not present in the initial package.

## Battle Pack boundary

Battle Pack is distinct from CampaignPackage.

It may reference the same Game Family, RPG Ruleset, assets, characters, creatures, equipment, map kits, and tactical definitions, but its purpose is standalone simulator setup rather than durable campaign truth.

A Battle Pack may expose/reference playable templates, opponents/factions, equipment/loadouts/abilities, map themes/world kits, deployment/objective options, bot profiles, scenario presets, asset references/provenance, ruleset/profile/version requirements, and visibility/unlock policy.

A Battle Pack must not duplicate combat rules or expose hidden campaign facts by default.

## WorldGraph versus materialized scene

Campaign semantics may establish a checkpoint district, road, woods route, venue, organization, or newly Architect-expanded destination without prescribing Pixi geometry.

GameFrame RPG Engine materializes accepted semantic truth into validated playable scenes with exact geometry/assets/anchors.

Once accepted for the campaign instance, GameFrame preserves materialization identity/version and meaningful world changes so revisiting returns to the same place.

If players choose a plausible route whose world is not sufficiently established, the Campaign Architect may expand the semantic campaign-instance world before GameFrame materializes it. Small already-permitted incidental spaces may use bounded existing world/materialization policy without an Architect call.

Battle Simulator may use the same materialization systems with Battle Pack constraints without creating campaign semantic history.

## Character Factory

Character Factory creates bounded incidental people when a full Campaign Architect expansion is unnecessary.

It creates one stable identity consistent with package/current-world rules. If immediate presence is intended, entity creation + semantic scene admission + initial authorized awareness should commit atomically/idempotently.

Incidental entities may become recurring without changing identity. They cannot retroactively replace protected culprits, decisive witnesses, clue owners, or other package-bearing functions unless the foundation explicitly left the role open or an explicit valid amendment changes that foundation.

## Observer knowledge

Canonical world truth and observer knowledge are separate.

A player/NPC may progress from descriptor → role → proper name while the durable entity ID stays constant.

Entity-performance/cognition context uses observer-authorized facts. Player-facing GameFrame projections use viewer-authorized facts. Multi-actor orchestration does not permit one actor to inherit another actor's secrets merely because the referee knows both.

## Same-map Tactical Activation

Campaign tactical combat is a stricter deterministic control mode for the **current materialized scene**, not a separate match location.

The boundary must validate, as applicable, semantic scene/revision, GameFrame materialization/version, current transforms, participants/roles/factions, player/control authority, resources/conditions, ruleset/profile/version, existing geometry/objects/hazards/exits, and objectives/alternate terminal conditions.

```text
exploration scene
→ Tactical Activation
→ same map under initiative/turn/action authority
→ terminal tactical consequences
→ semantic reconciliation where required
→ exploration resumes in place
```

No replacement battlefield is compiled. No campaign `Return to Campaign` button is required.

## Ruleset-defined control authority

The generic engine must not assume one principal controls exactly one unit.

An RPG Ruleset defines legal command/control relationships. Monster Master must be able to express one human principal controlling their own Master/trainer, deployed monster(s) according to ruleset limits, and additional entities only when explicit mechanics grant authority.

## Handcrafted and generated equivalence

Dungeon Master/GameFrame execution must not require separate code paths based on handcrafted versus generated origin.

Monster Master remains the first handcrafted reference package/game family and quality bar. A materially different second handcrafted family remains important evidence that generic engine/rules boundaries are not Monster Master accidents.

Campaign Architect development no longer needs to be artificially absent from all live-expansion architecture until that second family exists. Initial live expansion may be proved narrowly in Monster Master as an architecture canary while broad generated-campaign productization remains gated by stronger generality evidence.

## Testing requirements

Required evidence eventually includes:

- package validation/hash/persistence/reload;
- stable Entity Registry/Character Factory;
- semantic Scene Registry/Observer Knowledge;
- generalized attempted-operation identity/provenance/retry;
- deterministic/ruleset resolution without model-owned final outcomes;
- actor goals/intentions and bounded non-player action;
- bounded multi-actor consequence chains with perspective custody;
- background/scheduled intent recovery;
- Campaign Architect live expansion validation/commit/revisit;
- descriptor→role→name knowledge progression;
- hidden secret/name absence from unauthorized renderer/entity context;
- direct embodied interaction and freeform parity;
- WorldGraph route + second-scene materialization/revisit;
- principal/player-character/controlled-entity authority;
- same-map Tactical Activation using current positions/geometry;
- restart/reconnect and exact retry without duplicate operations/rerolls;
- at least two materially different CampaignPackages/game families;
- Battle Pack schema/exposure validation.

## Prohibited designs

Do not:

- send a raw premise directly to Dungeon Master and call that campaign creation;
- make the Dungeon Master silently perform substantial campaign-expansion work that belongs to Campaign Architect;
- treat the initial CampaignPackage as a closed list of every place/person/thread players may ever reach;
- let model prose be sole identity/presence/knowledge/mechanical authority;
- require one permanent language-model session per NPC;
- give NPC performance/cognition omniscient referee context;
- expose hidden canonical identity because referee mode knows it;
- make generated media campaign authority;
- encode Pixi geometry/per-frame movement into CampaignPackage truth;
- create a separate campaign battlefield merely because initiative begins;
- launch Battle Simulator as campaign combat;
- fork Monster Master RPG and Monster Master Arena Battles into incompatible combat rules;
- copy rules into Battle Packs;
- expose campaign secrets automatically through Battle Simulator;
- hardcode one-player-one-unit control into GameFrame RPG Engine;
- freeze the architecture to an exact agent count regardless of future responsibility boundaries;
- let either repository read the other's database.

## Governing rule

> Campaign Architect builds and expands durable campaign possibility; Dungeon Master conducts live play inside established reality; durable software owns world truth, attempted operations, rules resolution, actor state, and recovery; GameFrame materializes the videogame; and new generative responsibilities are added only when a real distinct job demands them.
