---
title: RPG Agent Architecture and Campaign Package Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - handcrafted campaigns
  - generated campaigns
shared_document_id: rpg-agent-architecture-and-campaign-package-v1
shared_document_version: 1
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-agent-architecture-and-campaign-package.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-agent-architecture-and-campaign-package.md
sync_policy: exact-byte-copy
related:
  - rpg-campaign-compiler-contract.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-one-shot-intro-agent-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-platform-roadmap.md
---

# RPG Agent Architecture and Campaign Package Contract

## Decision

The RPG platform uses two distinct specialized agents connected by one durable campaign-package boundary.

1. **Campaign Architect** — creates a complete, validated campaign package before ordinary play.
2. **Dungeon Master** — conducts live play from that committed package and the durable campaign journal.

The two agents do not share responsibility for inventing campaign truth during ordinary turns. The Campaign Architect determines what campaign exists. The Dungeon Master determines how that campaign unfolds through player action.

## Official terminology

- **Campaign Architect** is the product and architecture name for the campaign-authoring agent. Older documents may call it the campaign compiler, plot agent, or campaign-generation agent. Those terms describe parts of its work but do not define separate agents.
- **Dungeon Master** is the product and architecture name for the live campaign-running agent. Internal documents may use Live DM where brevity is useful.
- **CampaignPackage** is the durable handoff artifact. The first implementation schema may be named `CompiledCampaignPackageV1`, but handcrafted and generated packages use the same validator, persistence, projection, and Dungeon Master interface.

There is no separate intro agent. A campaign opening is the first Dungeon Master turn after a CampaignPackage has been accepted and committed.

## Campaign Architect responsibilities

The Campaign Architect receives a campaign brief and produces one playable package. Input may come from:

- a concise player concept such as an original medieval supernatural-response campaign;
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
- important locations, factions, actors, motives, secrets, and relationships;
- campaign spine and playable starter chapter;
- plot families or the selected committed plot structure;
- clue and evidence relationships;
- event and complication pools;
- escalation, pressure, consequence, and resolution rules;
- tactical opportunities, thresholds, objectives, and outcome expectations;
- semantic presentation and asset requirements;
- provenance, versions, content hashes, validation results, and migrations.

The Campaign Architect completes campaign construction before ordinary play. It may later support explicit owner-authorized recompilation or package migration, but it does not silently rewrite an active campaign because players behave unexpectedly.

## Dungeon Master responsibilities

The Dungeon Master receives the committed CampaignPackage plus current durable campaign state. It owns:

- opening-scene realization;
- narration and scene framing;
- NPC dialogue, performance, and reactions;
- interpretation of arbitrary freeform player declarations;
- pacing and scene transitions;
- selection of currently eligible prepared events;
- application of campaign-compatible consequences;
- maintenance of NPC, relationship, quest, and world continuity;
- compatible local improvisation;
- creation of plausible incidental people, places, and details when players seek something not prepared in advance;
- requests for checks, structured choices, media, and tactical encounters;
- narration of authoritative mechanical and tactical results.

The Dungeon Master may fill local gaps but may not replace:

- the campaign premise;
- committed setting rules;
- selected causes or responsible actors;
- established motives or relationships;
- committed clue and evidence logic;
- revealed facts;
- previous consequences;
- tactical outcomes;
- established NPC identities;
- package visibility and secrecy rules.

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

- setting rules and continuity invariants;
- hidden chronology and causality;
- factions, major actors, motives, secrets, leverage, and limits;
- important locations and relationships;
- prohibited retcons and originality constraints;
- audience classifications.

### Playable campaign structure

- group-cohesion mechanism;
- opening situation;
- functional beats without a mandatory scene order;
- credible alternative approaches;
- event pools and eligibility;
- clue and evidence graph where investigation exists;
- escalation and recovery paths;
- consequence and resolution conditions;
- one complete starter or one-shot resolution;
- optional continuation seeds.

### Mechanics and presentation

- supported mechanic capabilities;
- check and tactical encounter intents;
- semantic asset and media requirements;
- required deterministic fallbacks;
- presentation profile and accessibility-safe text equivalents.

### Reproducibility

- schema and package versions;
- source brief and normalized brief;
- authoring mode: handcrafted, generated, imported, or migrated;
- compiler or authoring version;
- seed where applicable;
- package hash;
- validation evidence;
- accepted amendments and migrations.

## Handcrafted and generated equivalence

The Dungeon Master must not require different code paths for handcrafted and generated campaigns.

A handcrafted Monster Master package enters through the same CampaignPackage validator and commitment process as a future Campaign Architect output. The package may contain richer owner-authored material, but it does not receive privileged runtime semantics or a separate Monster Master-only Dungeon Master.

The origin of the package is provenance, not an execution-mode switch.

## Monster Master role

Monster Master is the first bespoke reference campaign and the gold standard for Campaign Architect output.

The team manually creates the setting, campaign bible, packages, actors, locations, clue structures, event pools, tactical opportunities, consequence rules, asset manifest, and test fixtures that a mature Campaign Architect should later produce.

Monster Master serves as:

- the first playable campaign;
- the reference CampaignPackage;
- the quality bar for generated campaigns;
- the principal Dungeon Master behavior and continuity fixture;
- the proving ground for GameFrame presentation and Arena Battles integration.

Monster Master is not the platform architecture, and its deterministic fixture is not its canonical story.

## Campaign intake evolution

Campaign creation should expand in this order:

1. owner-authored and deterministic briefs for implementation;
2. concise freeform player concepts;
3. structured campaign sheets;
4. guided GameFrame or Discord interviews;
5. reusable prepared theme and mechanic packs;
6. richer generation, repair, and operator review workflows.

All intake paths normalize into the same brief and CampaignPackage contracts.

## Media and asset relationship

The Campaign Architect decides which semantic assets and media roles the campaign requires. GameFrame's media pipeline resolves, composes, generates, validates, stores, versions, and delivers those assets.

The Dungeon Master uses accepted semantic identities during play and may request a compatible missing incidental presentation, but it does not redesign the campaign asset pack every turn.

Cloudflare-backed image generation is a later campaign-preparation capability. It should eventually allow the Campaign Architect to request complete campaign media coverage, but generated media is not required to prove CampaignPackage validity or Dungeon Master behavior.

## Testing requirements

The two-agent boundary must be machine-testable.

Required test doubles and fixtures include:

- deterministic Campaign Architect provider or handcrafted package fixture;
- package validator and persistence tests;
- mock Dungeon Master model provider returning structured proposals;
- scripted player actors using expected, chaotic, avoidant, and early-correct-guess behavior;
- multi-turn assertions that package truth never changes;
- partial and paraphrased secret-leak attempts;
- incidental NPC creation and later reappearance;
- missed-clue recovery;
- check and tactical handoff requests;
- restart, exact retry, reconnect, and resume;
- at least two materially different CampaignPackages.

Transport and restart tests do not substitute for campaign-behavior tests. Catalog-shape tests do not substitute for executable package tests.

## Prohibited designs

Do not:

- send a raw premise directly to the Dungeon Master and call that campaign creation;
- let the Dungeon Master invent the campaign foundation during ordinary play;
- create separate Monster Master and generic Dungeon Master implementations;
- create a third intro agent;
- treat authored catalogs as executable packages without validation and commitment;
- make generated media a prerequisite for campaign logic testing;
- allow a deterministic fixture to become product canon;
- expose runtime-only CampaignPackage fields to GameFrame players;
- let either repository read the other's database.

## Governing rule

> The Campaign Architect creates one validated CampaignPackage; the Dungeon Master runs that package through freeform play; Monster Master is the handcrafted gold standard; and every future bespoke campaign must cross the same durable boundary.
