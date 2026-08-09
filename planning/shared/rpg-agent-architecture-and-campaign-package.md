---
title: RPG Agent Architecture and Campaign Package Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - handcrafted campaigns
  - generated campaigns
shared_document_id: rpg-agent-architecture-and-campaign-package-v1
shared_document_version: 6
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-agent-architecture-and-campaign-package.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-agent-architecture-and-campaign-package.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-campaign-architect-contract.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-platform-roadmap.md
---

# RPG Agent Architecture and Campaign Package Contract

## Decision

The RPG platform uses two specialized campaign agents connected by one durable CampaignPackage boundary.

1. **Campaign Architect** — creates a complete validated CampaignPackage before ordinary play and, later, may coordinate reusable game-family/Battle-Pack authoring for generated combat-capable RPGs.
2. **Dungeon Master** — conducts live play from that committed package and durable campaign state.

The platform also contains deterministic/runtime substrate that is **not another campaign agent**:

- CampaignPackage validator and immutable package commitment;
- campaign journal;
- Entity Registry;
- Character Factory;
- Scene Registry;
- semantic Observer Knowledge / player projections;
- Dungeon Master Context Compiler;
- semantic WorldGraph/location services;
- GameFrame RPG Engine materialization/exploration interfaces;
- RPG Ruleset and Game Family interfaces;
- Tactical Activation Coordinator;
- Battle Pack/BattleScenario contracts;
- deterministic mechanic coordinators/adapters.

The Campaign Architect determines what campaign/game-family definition exists before play. The Dungeon Master interprets/referees how a committed campaign unfolds. Runtime/GameFrame substrate owns facts that must not depend on model recollection.

## Engine/ruleset/game-family relationship

The agents do not constitute the whole RPG engine.

**GameFrame RPG Engine** is the campaign-agnostic embodied player/mechanics/world engine. **RPG Rulesets** plug deterministic game-specific behavior into it. A **Game Family** binds reusable rules/content/assets shared by related campaign and simulator experiences. CampaignPackages provide campaign-specific semantic content/world truth. Battle Packs provide simulator-safe tactical content for Battle Simulator.

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
GameFrame RPG Engine ←→ RPG GM Runtime durable semantic world
        ↑                        ↑
        └──── player actions ────┘
                 +
         Dungeon Master
```

For Monster Master:

```text
Monster Master RPG
= GameFrame RPG Engine
+ Monster Master Ruleset / game-family content
+ Monster Master CampaignPackage

Monster Master Arena Battles
= Battle Simulator
+ Monster Master Ruleset / game-family content
+ Monster Master Battle Pack
+ BattleScenario
```

The two surfaces share rules/content where compatible but do not share lifecycle. Campaign combat stays inside the current RPG world through Tactical Activation; it never launches Battle Simulator.

## Official terminology

- **Campaign Architect** — campaign-authoring agent.
- **Dungeon Master** — live campaign-running/referee/character-performance agent capability.
- **CampaignPackage** — durable semantic campaign handoff artifact.
- **GameFrame RPG Engine** — reusable campaign-agnostic embodied RPG engine; internal architecture terminology.
- **Games** — top-level player-facing GameFrame destination.
- **Role-Playing Games** — player-facing generic campaign library/creation/resume surface.
- **Battle Simulator** — player-facing standalone tactical sandbox surface.
- **RPG Ruleset** — deterministic game-specific mechanics/capabilities independent of one campaign package.
- **Game Family** — reusable rules/content identity shared by related campaign and simulator experiences.
- **Monster Master Ruleset / Game Family** — first major rules/content family shared by Monster Master RPG and Monster Master Arena Battles.
- **Battle Pack** — simulator-safe tactical content/configuration for one Game Family; never a second ruleset.
- **BattleScenario** — standalone battle setup instance selecting pack/ruleset/map/teams/objectives/deployment.
- **WorldGraph** — semantic location/route relationship model owned by CampaignPackage/runtime meaning, not Pixi geometry.
- **Character Factory** — deterministic/schema-first bounded incidental-character materialization substrate.
- **Scene Registry** — semantic authority for zero-or-more active scenes and physical membership.
- **Observer Knowledge** — sparse semantic knowledge/belief state for players/NPCs/other bounded observers.
- **Tactical Activation** — transition of the current materialized GameFrame scene into turn-based tactical authority without changing maps.
- **Tactical Activation Coordinator** — semantic/runtime coordination replacing the old destination concept of an Encounter Scene Compiler.
- campaign compiler, plot agent, campaign-generation agent, and intro agent are retired as separate agents/interfaces.

## Campaign Architect responsibilities

Campaign Architect receives a campaign brief/source and produces one playable campaign package.

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

After the generic ruleset/game-family schema is proven across multiple handcrafted families, Campaign Architect may also coordinate/select/create bounded reusable game-family material needed by a generated concept, including:

- compatible validated ruleset/profile definition;
- reusable character/archetype/creature/equipment/ability content;
- world/materialization themes/kits/assets;
- simulator-safe Battle Pack for combat-capable families;
- Battle Pack visibility/unlock classification that prevents campaign-secret leakage.

Campaign Architect completes campaign foundation before ordinary play. It does not silently rewrite an active campaign because players behave unexpectedly.

### Draft lifecycle

```text
brief/source
→ select/create compatible validated game-family/ruleset profile as needed
→ draft CampaignPackage
→ optional draft Battle Pack when combat-capable/appropriate
→ optional owner refinement
→ validation/bounded repair
→ player-safe preview
→ explicit commitment
```

Handcrafted/generated/imported origin is provenance, not an execution-mode switch.

## Dungeon Master responsibilities

Dungeon Master receives committed package truth plus typed durable current state compiled for the current trigger/context mode.

It owns/proposes:

- referee/world adjudication;
- narration/framing;
- arbitrary plausible freeform intent interpretation;
- entity/NPC dialogue and performance;
- Ask-GM rules/character-knowledge responses;
- pacing and eligible event selection;
- package-compatible consequences;
- compatible local improvisation;
- incidental-person requests through Character Factory;
- checks/mechanic requests;
- reasons/objectives for Tactical Activation;
- aftermath/GM intervention.

Dungeon Master may not replace:

- committed campaign premise/setting rules;
- established causes/motives/relationships;
- committed clue logic;
- revealed facts/previous consequences;
- stable entity identity;
- semantic physical presence;
- observer/player knowledge authorization;
- deterministic GameFrame mechanic/tactical outcomes;
- accepted scene materialization identity/geometry as if it were prose-only fiction.

Model output becomes campaign truth only after validation/commitment in the appropriate authority domain.

## Dungeon Master context modes

The same Dungeon Master capability may operate under different structurally compiled contexts.

### Referee/world adjudication

Receives broad hidden context required to interpret unusual player intent, event eligibility, consequences, checks, hidden causality, and world reactions.

### Game Master communication

Answers player Ask-GM requests from committed rules and **player-authorized** character knowledge. It does not reveal hidden runtime truth merely because referee mode knows it.

### Entity performance

Portrays one bound durable entity using only that entity's authorized knowledge/beliefs/memories/goals/relationships/current observations plus bounded portrayal constraints.

A Pell performance call is not an omniscient referee call with “pretend to be Pell” instructions.

### Aftermath/intervention

Frames results of deterministic mechanics/world transitions or proactively presents GM narration/intervention after required semantic truth is committed/authorized.

These are context-custody modes, not new agents.

## CampaignPackage boundary

A CampaignPackage is executable semantic campaign material, not a prose pitch.

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

### Semantic world

- WorldGraph/regions/locations/routes;
- important location semantics;
- traversability/route constraints;
- initial scene/presence state;
- required landmarks/objects/entities;
- materialization intents/constraints;
- meaningful alternate approaches.

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

## Battle Pack boundary

Battle Pack is distinct from CampaignPackage.

It may reference the same Game Family, RPG Ruleset, assets, characters, creatures, equipment, map kits, and tactical definitions, but its purpose is standalone simulator setup rather than durable campaign truth.

A Battle Pack may expose/reference:

- playable character/archetype/creature templates;
- opponents/factions;
- equipment/loadouts/abilities available in standalone setup;
- map themes/world kits/materialization constraints;
- deployment/objective options;
- bot profiles;
- scenario presets;
- asset references/provenance;
- ruleset/profile/version requirements;
- visibility/unlock policy.

A Battle Pack must not duplicate combat rules or expose hidden campaign facts by default.

## WorldGraph versus materialized scene

CampaignPackage/runtime may say:

```text
checkpoint-district
- road
- west woods route
- creek-bank route
- inspection post
- confiscation cart
- barrier
```

GameFrame RPG Engine may materialize that into a validated playable Pixi scene with exact geometry/assets/anchors.

Once accepted for the campaign instance, GameFrame preserves materialization identity/version and meaningful world changes so revisiting returns to the same place.

If players choose an allowed/plausible route whose scene has not been materialized yet, runtime/DM may establish the semantic destination and GameFrame materializes it from the same package/theme/ruleset capabilities.

Battle Simulator may use the same materialization systems with Battle Pack constraints to create/select standalone battlefields without creating campaign semantic history.

## Character Factory

Dungeon Master may request a plausible incidental person but does not mint unconstrained durable entities through prose.

Character Factory creates one stable bounded identity consistent with package/world rules. If immediate presence is intended, entity creation + semantic scene admission + initial authorized awareness should commit atomically/idempotently.

Incidental entities may become recurring without changing identity. They cannot retroactively replace fixed culprits, decisive witnesses, clue owners, or other package-bearing functions unless the package explicitly left the role open.

## Observer knowledge

Canonical world truth and observer knowledge are separate.

A player/NPC may progress from descriptor → role → proper name while the durable entity ID stays constant.

Entity-performance context uses observer-authorized facts. Player-facing GameFrame projections use viewer-authorized facts. Unknown entity existence is omitted when required rather than leaked through redacted IDs/counts.

Battle Pack visibility is a separate public/simulator exposure surface and cannot be inferred merely from hidden CampaignPackage existence.

## Same-map Tactical Activation

Campaign tactical combat is a stricter deterministic control mode for the **current materialized scene**, not a separate match location.

The boundary must validate, as applicable:

- semantic scene/revision;
- GameFrame materialization/version;
- current tactically relevant entity transforms;
- participants/roles/factions;
- player/control authority;
- health/resources/conditions;
- ruleset/profile/version;
- existing map geometry/objects/hazards/exits;
- objectives/alternate terminal conditions.

Then:

```text
exploration scene
→ Tactical Activation
→ same map under initiative/turn/action authority
→ terminal tactical consequences
→ semantic reconciliation where required
→ exploration resumes in place
```

No replacement battlefield is compiled. No campaign `Return to Campaign` button is required.

**Battle Simulator** remains the standalone tactical product surface and may use Battle Pack + BattleScenario setup to create/select/generate a scene before tactical play.

## Ruleset-defined control authority

The generic engine must not assume one principal controls exactly one unit.

An RPG Ruleset defines legal command/control relationships.

Monster Master must be able to express one human principal controlling:

- their own Master/trainer character;
- deployed monster(s) according to class/ruleset limits;
- additional entities only when explicit mechanics grant authority.

This lets different Monster Master classes vary deployment counts/action patterns without creating campaign-specific engine branches.

## Handcrafted and generated equivalence

The Dungeon Master/GameFrame engine must not require separate code paths based on handcrafted versus generated origin.

Monster Master is the first handcrafted reference package/game family and quality bar. A materially different second handcrafted package/game family is required before Campaign Architect generation becomes an active dependency.

Generated CampaignPackages must later use the same validator, world/entity/scene/knowledge architecture, ruleset/game-family interface, materialization engine, and Dungeon Master context-mode path.

Combat-capable generated families should be able to produce validated simulator-safe Battle Packs using the same reusable rules/content/assets. The presence of a generated CampaignPackage must not itself expose hidden campaign material to Battle Simulator.

## Testing requirements

Required evidence eventually includes:

- package validation/hash/persistence/reload;
- stable Entity Registry/Character Factory;
- semantic Scene Registry/Observer Knowledge;
- descriptor→role→name knowledge progression;
- hidden secret/name absence from unauthorized renderer/entity-performance context;
- Pell perspective-custody proof;
- direct embodied interaction;
- WorldGraph route + second-scene materialization/revisit;
- Do Something Else and Ask-GM distinction;
- ruleset/game-family capability validation;
- principal/player-character/controlled-entity authority;
- same-map Tactical Activation using current positions/geometry;
- escape/withdrawal/alternate outcome where supported;
- tactical → exploration resume on the same scene;
- restart/reconnect;
- at least two materially different CampaignPackages/game families;
- Battle Pack schema/exposure validation;
- campaign-versus-Battle-Simulator equivalence tests for matching ruleset profiles;
- generated Battle Pack discovery without bespoke simulator code later.

## Prohibited designs

Do not:

- send a raw premise directly to Dungeon Master and call that campaign creation;
- let model prose be sole identity/presence/knowledge authority;
- create a third intro/NPC campaign agent;
- give NPC performance omniscient referee context;
- expose hidden canonical identity because referee mode knows it;
- make generated media campaign authority;
- encode Pixi geometry/per-frame movement into CampaignPackage truth;
- create a separate campaign battlefield merely because initiative begins;
- launch Battle Simulator as campaign combat;
- fork Monster Master RPG and Monster Master Arena Battles into incompatible combat rules;
- copy rules into Battle Packs;
- expose campaign secrets automatically through Battle Simulator;
- hardcode one-player-one-unit control into GameFrame RPG Engine;
- create separate Monster Master/generated-campaign Dungeon Masters;
- let either repository read the other's database.

## Governing rule

> Campaign Architect defines durable semantic worlds and, later, reusable generated game-family outputs; GameFrame RPG Engine materializes campaigns; RPG Rulesets define deterministic behavior; Dungeon Master referees through bounded contexts; Role-Playing Games hosts campaigns; Battle Simulator consumes simulator-safe Battle Packs; and tactical activation changes control rules on the current campaign scene instead of replacing it.
