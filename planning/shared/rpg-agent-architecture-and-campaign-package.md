---
title: RPG Agent Architecture and Campaign Package Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - handcrafted campaigns
  - generated campaigns
shared_document_id: rpg-agent-architecture-and-campaign-package-v1
shared_document_version: 4
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

The RPG platform uses two distinct specialized agents connected by one durable CampaignPackage boundary.

1. **Campaign Architect** — creates a complete, validated CampaignPackage before ordinary play.
2. **Dungeon Master** — conducts live play from that committed package and durable campaign state.

The platform also contains deterministic/runtime substrate that is **not another campaign agent**:

- CampaignPackage validator and immutable package commitment;
- campaign journal;
- Entity Registry;
- Character Factory for bounded incidental-character materialization;
- Scene Registry;
- semantic observer/player/party knowledge;
- Dungeon Master Context Compiler;
- semantic world/location services;
- GameFrame exploration/materialization adapters;
- Encounter Scene Compiler;
- GameFrame adapters and deterministic mechanic coordinators.

The agents do not share responsibility for inventing campaign truth during ordinary turns. The Campaign Architect determines what campaign exists. The Dungeon Master determines how that campaign unfolds through player action and world events. Runtime/GameFrame substrate makes identity, presence, knowledge, world continuity, materialization, mechanics, and durability explicit so those facts do not depend on model memory.

The mature player experience is embodied exploration through GameFrame. Freeform intent remains first-class for actions the fixed interaction vocabulary does not express.

## Official terminology

- **Campaign Architect** is the campaign-authoring agent. Campaign compiler, plot agent, and campaign-generation agent are retired aliases for capabilities inside it, not separate agents or compatibility interfaces.
- **Dungeon Master** is the live campaign-running agent. Internal documents may use Live DM where brevity is useful.
- **CampaignPackage** is the durable handoff artifact. Handcrafted and generated packages use the same validator, persistence, projection, world initialization, and Dungeon Master interface.
- **Character Factory** is deterministic/schema-first runtime substrate used to materialize bounded incidental characters requested during play. It is not a campaign-authoring agent.
- **Scene Registry** is authoritative runtime semantic state for who/what is physically present in zero or more active scenes.
- **Semantic Observer Knowledge** is sparse authoritative knowledge/belief state for players and other relevant observers; Player Knowledge Projection is the viewer-safe read model over that state.
- **WorldGraph** is semantic campaign location/route truth. It is not renderer geometry.
- **Exploration Scene Materialization** is GameFrame's accepted/reproducible playable realization of semantic world/scene intent.
- **Encounter Scene Compiler** converts relevant current-scene truth into a validated tactical request without substituting unrelated duel identities.

There is no separate intro agent and no separate NPC agent. A campaign opening is the first Dungeon Master campaign framing after package/world initialization. NPC portrayal is a context mode of the Dungeon Master bounded to one performing entity's perspective.

## Campaign Architect responsibilities

The Campaign Architect receives a campaign brief and produces one playable package. Input may come from:

- a concise player concept;
- a detailed freeform description;
- an owner-authored campaign specification;
- a structured campaign sheet;
- a later interactive GameFrame or Discord interview;
- a prepared campaign family such as Monster Master;
- an imported package that passes validation and migration.

The Campaign Architect owns:

- brief normalization and recorded assumptions;
- originality transformation of franchise shorthand into an original campaign identity;
- setting rules, tone, themes, boundaries, and player fantasy;
- campaign bible and continuity invariants;
- semantic WorldGraph, important regions/locations, routes, traversal assumptions, and location relationships;
- important factions, actors, motives, secrets, and relationships;
- campaign spine and playable starter chapter;
- clue/evidence relationships;
- event and complication pools;
- escalation, pressure, consequence, and resolution rules;
- tactical opportunities, thresholds, objectives, and outcome expectations;
- semantic presentation, world-kit, materialization, and asset requirements;
- provenance, versions, content hashes, validation results, and migrations.

The Campaign Architect completes campaign construction before ordinary play. It may later support explicit owner-authorized recompilation or package migration, but it does not silently rewrite an active campaign because players behave unexpectedly.

### Draft and owner-refinement lifecycle

Generated and handcrafted authoring use the same draft lifecycle:

```text
brief or source material
→ draft CampaignPackage
→ optional owner editing / refinement
→ validation and bounded repair
→ player-safe preview
→ explicit commitment
```

An owner may therefore heavily handcraft Monster Master or start from a Campaign Architect draft and refine it before commitment. Authoring mode is provenance, not a runtime execution switch.

An active committed package is immutable for ordinary play. Campaign-foundation changes require an explicit amendment/new-version/migration lifecycle.

## Dungeon Master responsibilities

The Dungeon Master receives the committed CampaignPackage plus current durable campaign state compiled for the current trigger. It owns:

- opening/scene framing when narration is useful;
- interpretation of arbitrary plausible freeform player declarations;
- rules/knowledge clarification through Ask-GM;
- pacing and selection among currently eligible prepared events;
- campaign-compatible consequences;
- compatible local improvisation;
- requests for incidental people or bounded local entities when players seek something not prepared;
- requests for checks, structured choices, media/materialization, and tactical encounters;
- perspective-bounded NPC/entity dialogue, performance, and reactions;
- dramatic GM interventions where appropriate;
- narration/framing of authoritative mechanical and tactical results where useful.

The Dungeon Master does **not** own:

- durable entity IDs;
- physical scene presence;
- canonical-name revelation state;
- observer/player knowledge authority;
- semantic world/location invariants;
- GameFrame exploration geometry or frame-by-frame avatar transforms;
- package invariants;
- deterministic mechanic outcomes;
- tactical outcomes.

The Dungeon Master may fill local gaps but may not replace:

- the campaign premise;
- committed setting/world rules;
- selected causes or responsible actors;
- established motives or relationships;
- committed clue/evidence logic;
- revealed facts;
- previous consequences;
- tactical outcomes;
- established entity or materialized-scene identities;
- package visibility/secrecy rules.

## Dungeon Master context modes

One Dungeon Master capability may operate through several explicit context modes.

### Referee / world-adjudication mode

Receives the hidden campaign/world state needed to interpret unusual actions, event eligibility, consequences, checks, scene transitions, and world reactions.

### Game Master communication mode

Answers Ask-GM queries and may issue player/party/table GM interventions. It receives only the runtime truth required to answer the authorized audience safely.

### Entity-performance mode

Bound to exactly one performing durable entity. The context compiler includes only justified entity identity, personality, goals, relationships, memories, beliefs/knowledge, current observations, conditions, and bounded recent conversation plus package constraints required for correct portrayal.

It excludes unrelated hidden campaign truth. The fact that referee mode could know something does not authorize Pell, Mara, or another entity to know it.

### Aftermath/intervention mode

Frames committed deterministic outcomes or significant semantic events. Presentation remains separate from semantic authority.

These are context/authority modes, not separate autonomous agents.

## Incidental-character rule

The Dungeon Master may **request** a plausible incidental person but does not directly mint a durable NPC record through prose or an unconstrained generic fact write.

A request passes through Character Factory, which creates one validated stable entity identity from prepared role vocabularies and bounded constraints. The Dungeon Master may then portray that entity using entity-performance mode.

An incidental entity may later become recurring without changing identity. It cannot retroactively become a committed culprit, decisive witness, clue owner, or secret authority unless the package explicitly left that function open.

## Campaign opening rule

The opening is not a separate service or agent.

Before ordinary play, RPG GM Runtime must have committed:

- package identity, version, hash, and provenance;
- player-safe premise and tone;
- runtime-only campaign truth and forbidden retcons;
- participating players and characters;
- semantic WorldGraph and starting location;
- starting group-cohesion state;
- initial Scene Registry state;
- actors, motives, clue relationships, event eligibility, pressure, and tactical thresholds;
- semantic presentation/materialization roles and deterministic fallbacks.

GameFrame may materialize the starting exploration scene before or alongside the first Dungeon Master framing. The opening should establish the immediate situation without forcing the player to use text to describe ordinary movement.

## CampaignPackage boundary

A valid CampaignPackage is executable campaign material, not a prose pitch or loose collection of ideas.

It contains at least:

### Player-safe material

- title and campaign identity;
- concise premise;
- player roles and expected activity;
- tone and content summary;
- character guidance;
- player-facing assumptions and boundaries.

### Runtime-only campaign bible

- setting/world rules and continuity invariants;
- hidden chronology and causality;
- factions, major actors, motives, secrets, leverage, and limits;
- important locations and relationships;
- prohibited retcons and originality constraints;
- audience classifications.

### Semantic world structure

- stable important location/region identities;
- WorldGraph adjacency/route relationships as needed;
- traversal assumptions and relevant hidden/known routes;
- starting location and initial semantic scene;
- location materialization roles/requirements without renderer-specific geometry;
- important landmarks/objects/scene anchors;
- world-kit/theme/asset requirements and fallbacks;
- open incidental-area rules where bounded on-demand materialization is allowed.

### Playable campaign structure

- group-cohesion mechanism;
- opening situation;
- initial scene membership and materially relevant scene entities;
- functional beats without mandatory scene order;
- credible alternative approaches;
- event pools and deterministic eligibility vocabulary;
- clue/evidence graph where investigation exists;
- escalation and recovery paths;
- consequence and resolution conditions;
- one complete starter/one-shot resolution;
- optional continuation seeds.

### Mechanics and presentation

- supported mechanic capabilities;
- check and tactical encounter intents;
- semantic entity, location, item, terrain, effect, handout, interface, and exploration-world asset roles;
- required deterministic fallbacks;
- presentation profile and accessibility-safe text equivalents.

### Reproducibility

- schema and package versions;
- source brief and normalized brief where applicable;
- authoring mode: handcrafted, generated, imported, or migrated;
- Campaign Architect or manual authoring version;
- seed where applicable;
- package hash;
- validation evidence;
- accepted amendments and migrations.

## Handcrafted and generated equivalence

The Dungeon Master and GameFrame exploration system must not require different control paths for handcrafted and generated campaigns.

A handcrafted Monster Master package enters through the same CampaignPackage validator and commitment process as a future Campaign Architect output. The package may contain richer owner-authored material, but it does not receive privileged runtime semantics, a separate Monster Master Dungeon Master, or a special world engine.

The origin of the package is provenance, not an execution-mode switch.

## Monster Master role

Monster Master is the first bespoke reference campaign and gold standard for Campaign Architect output.

The team manually creates everything a mature Campaign Architect should later produce: setting, semantic world, package truth, actors, locations/routes, clue structures, event pools, tactical opportunities, consequence rules, semantic assets/materialization requirements, and test fixtures.

Monster Master serves as:

- the first playable embodied campaign;
- the reference CampaignPackage;
- the quality bar for generated campaigns;
- the principal Dungeon Master behavior/character-performance fixture;
- the proving ground for Scene Registry, observer/player knowledge, GameFrame exploration/materialization, and Arena Battles integration.

Monster Master is not the platform architecture, and its deterministic fixture is not its canonical story.

## Durable entities, scenes, and world materialization

The campaign journal is authoritative history. Runtime projects durable entity and semantic scene state from committed package truth plus journaled operations.

The Scene Registry answers exact semantic questions that must not rely on the model's recollection of prose:

- who is physically present;
- which creatures and relevant objects are present;
- who entered or left;
- what semantic location the scene occupies;
- which exits, hazards, and objective entities matter;
- which present entities are tactically eligible.

GameFrame owns accepted playable materialization of the scene: collision geometry, semantic anchors, spawn/transition zones, interaction bindings, and ephemeral realtime transforms. GameFrame geometry does not become hidden package truth.

A known absent person may be discussed or contacted through an explicit remote channel, but cannot physically act as if present.

## Observer knowledge and identity labels

Canonical runtime entity identity and observer/player-known identity are distinct.

A player may know someone first as:

- `the woman in inspector's gear`;
- later `the checkpoint inspector`;
- later `Mara Venn`.

An NPC may know a different set of facts about the same entity. Sparse observer knowledge should exist only where campaign behavior requires it.

The hidden referee decision may use canonical entity IDs. Character-performance and player-facing rendering receive only the knowledge justified for their respective contexts.

Unknown entity existence is omitted rather than represented through hidden IDs, null records, redacted slots, or leaked counts.

## Player action, direct interaction, and Ask-GM

The mature interface distinguishes:

- direct GameFrame exploration/mechanic input;
- targeted in-fiction interaction/dialogue;
- **Do Something Else** freeform fictional intent;
- **Ask Game Master** out-of-fiction rules/knowledge/clarification.

Do Something Else preserves tabletop flexibility when no dedicated interaction exists.

Ask-GM does not automatically become speech heard by NPCs and should not advance fictional time merely because the player asked a question.

## Tactical encounter rule

A tactical encounter is a stricter resolution mode for the current embodied scene, not an unrelated match that substitutes canned identities.

The Encounter Scene Compiler projects exact required campaign entities, roles, teams, controllers/behavior authorities, objective entities, battlefield intent, scene provenance, and alternate terminal conditions into GameFrame.

GameFrame owns deterministic tactical authority and fails closed when the selected tactical rules cannot truthfully execute a combat-relevant requirement.

Campaign encounters may require more than elimination, including protection, escape, withdrawal, surrender, holding or reaching a location, preventing escape, or securing an object.

After terminal outcome, runtime reconciles consequences and GameFrame updates the surrounding exploration materialization before ordinary embodied control resumes.

## Media and asset relationship

The Campaign Architect decides which semantic assets, world kits, location identities, recurring entities, and media roles the campaign requires. GameFrame resolves, composes, generates, validates, stores, versions, and delivers those assets.

The Dungeon Master uses accepted semantic identities during play and may request compatible missing incidental presentation, but it does not redesign the campaign asset pack every turn.

Cloudflare-backed image generation is a campaign-preparation/on-demand presentation capability. Generated media is not required to prove CampaignPackage validity, semantic world state, legal movement, entity/scene semantics, or Dungeon Master behavior.

## Testing requirements

Required fixtures/tests include:

- deterministic Campaign Architect provider or handcrafted package fixture;
- package validator, hashing, persistence, commitment, and reload tests;
- stable entity creation and incidental promotion tests;
- Scene Registry enter/leave/restart tests;
- observer/player identity and knowledge tests;
- hidden-name/secret absence from player-safe and entity-performance input;
- GameFrame materialized-scene identity/reconnect tests;
- direct NPC interaction with perspective-bounded context;
- Ask-GM behavior;
- Do Something Else unsupported-action adjudication;
- alternate-route/second-scene materialization and revisit;
- check and tactical handoff requests;
- scene-faithful encounter participant projection;
- withdrawal/escape outcomes where supported;
- authoritative return to the embodied exploration scene;
- restart, exact retry, reconnect, and resume;
- at least two materially different CampaignPackages/worlds.

Transport and restart tests do not substitute for campaign-behavior tests. Catalog-shape tests do not substitute for executable package tests.

## Prohibited designs

Do not:

- send a raw premise directly to the Dungeon Master and call that campaign creation;
- let the Dungeon Master invent the campaign foundation during ordinary play;
- use model prose history as the sole source for entity identity, physical presence, observer/player knowledge, or world layout identity;
- let the Dungeon Master directly mint unconstrained durable NPCs through generic fact writes;
- expose canonical runtime names merely because referee context knows them;
- give an NPC performance call unrelated hidden campaign truth;
- create separate Monster Master and generic Dungeon Master implementations;
- create a third intro or NPC agent;
- make graphical affordances the complete set of possible player actions;
- treat authored catalogs as executable packages without validation and commitment;
- make generated media a prerequisite for campaign logic testing;
- let generated pixels define collision or semantic world truth;
- journal every avatar coordinate as RPG campaign state;
- allow a deterministic fixture to become product canon;
- expose runtime-only CampaignPackage fields to GameFrame players;
- drop trainers, civilians, allies, escapees, or objective entities silently when tactical mode starts;
- force every campaign encounter into defeat-all-opposition semantics;
- let either repository read the other's database.

## Governing rule

> The Campaign Architect creates one validated semantic CampaignPackage; runtime makes world/entity/scene/observer knowledge explicit; GameFrame materializes that world into playable space; the Dungeon Master referees it and performs bounded character perspectives; and the player can always fall back to plausible freeform intent when fixed controls are insufficient.
