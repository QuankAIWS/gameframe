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
shared_document_version: 3
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-agent-architecture-and-campaign-package.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-agent-architecture-and-campaign-package.md
sync_policy: exact-byte-copy
related:
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-campaign-architect-contract.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-platform-roadmap.md
---

# RPG Agent Architecture and Campaign Package Contract

## Decision

The RPG platform uses two distinct specialized agents connected by one durable campaign-package boundary.

1. **Campaign Architect** — creates a complete, validated CampaignPackage before ordinary play.
2. **Dungeon Master** — conducts live play from that committed package and durable campaign state.

The platform also contains deterministic runtime substrate that is **not another agent**:

- CampaignPackage validator and immutable package commitment;
- campaign journal;
- Entity Registry;
- Character Factory for bounded incidental-character materialization;
- Scene Registry;
- player/party knowledge projection;
- Dungeon Master Context Compiler;
- Encounter Scene Compiler;
- GameFrame adapters and deterministic mechanic coordinators.

The agents do not share responsibility for inventing campaign truth during ordinary turns. The Campaign Architect determines what campaign exists. The Dungeon Master determines how that campaign unfolds through player action. Runtime substrate makes identity, presence, knowledge, mechanics, and durability explicit so those facts do not depend on model memory.

## Official terminology

- **Campaign Architect** is the product and architecture name for the campaign-authoring agent. Campaign compiler, plot agent, and campaign-generation agent are retired aliases for capabilities inside it, not separate agents or compatibility interfaces.
- **Dungeon Master** is the product and architecture name for the live campaign-running agent. Internal documents may use Live DM where brevity is useful.
- **CampaignPackage** is the durable handoff artifact. Handcrafted and generated packages use the same validator, persistence, projection, and Dungeon Master interface.
- **Character Factory** is deterministic/schema-first runtime substrate used to materialize bounded incidental characters requested during play. It is not a campaign-authoring agent.
- **Scene Registry** is the authoritative runtime projection of who and what is physically present in the current scene.
- **Player Knowledge Projection** is the viewer-specific read model of what a particular player character is entitled to know.
- **Encounter Scene Compiler** converts relevant current-scene truth into a validated tactical request without substituting unrelated duel identities.

There is no separate intro agent. A campaign opening is the first Dungeon Master turn after a CampaignPackage has been accepted and committed.

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
- important locations, factions, actors, motives, secrets, and relationships;
- campaign spine and playable starter chapter;
- clue and evidence relationships;
- event and complication pools;
- escalation, pressure, consequence, and resolution rules;
- tactical opportunities, thresholds, objectives, and outcome expectations;
- semantic presentation and asset requirements;
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

An owner may therefore heavily handcraft Monster Master or start from a Campaign Architect draft and massage it before commitment. Authoring mode is provenance, not a runtime execution switch.

An active committed package is immutable for ordinary play. Campaign-foundation changes require an explicit amendment/new-version/migration lifecycle.

## Dungeon Master responsibilities

The Dungeon Master receives the committed CampaignPackage plus current durable campaign state compiled for the current trigger. It owns:

- opening-scene realization;
- narration and scene framing;
- NPC dialogue, performance, and reactions;
- interpretation of arbitrary freeform player declarations;
- pacing and scene transitions;
- selection among currently eligible prepared events;
- application of campaign-compatible consequences;
- maintenance of relationships, quests, and world continuity through validated semantic operations;
- compatible local improvisation;
- requests for incidental people or local entities when players seek something not prepared;
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
- established entity identities;
- package visibility and secrecy rules.

### Incidental-character rule

The Dungeon Master may **request** a plausible incidental person but does not directly mint a durable NPC record through prose or an unconstrained generic fact write.

A request passes through the Character Factory, which creates one validated stable entity identity from prepared role vocabularies and bounded constraints. The Dungeon Master may then portray that entity.

An incidental entity may later become recurring without changing identity. It cannot retroactively become a committed culprit, decisive witness, clue owner, or secret authority unless the package explicitly left that function open.

## Campaign opening rule

The opening is not a separate service or agent. It is the first ordinary Dungeon Master turn after package commitment.

Before that turn, RPG GM Runtime must have committed:

- package identity, version, hash, and provenance;
- player-safe premise and tone;
- runtime-only campaign truth and forbidden retcons;
- participating players and characters;
- starting location and group-cohesion state;
- initial Scene Registry state;
- actors, motives, clue relationships, event eligibility, pressure, and tactical thresholds;
- semantic presentation roles and deterministic fallbacks.

The opening must establish the party, immediate situation, and room for arbitrary plausible action without exposing runtime-only truth or forcing tactical play before current state justifies it. The same Dungeon Master semantic-decision, validation, journal, and publication path continues afterward.

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
- initial scene membership and materially relevant scene entities;
- functional beats without a mandatory scene order;
- credible alternative approaches;
- event pools and deterministic eligibility vocabulary;
- clue and evidence graph where investigation exists;
- escalation and recovery paths;
- consequence and resolution conditions;
- one complete starter or one-shot resolution;
- optional continuation seeds.

### Mechanics and presentation

- supported mechanic capabilities;
- check and tactical encounter intents;
- semantic entity, location, item, terrain, effect, handout, and interface asset roles;
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

The Dungeon Master must not require different code paths for handcrafted and generated campaigns.

A handcrafted Monster Master package enters through the same CampaignPackage validator and commitment process as a future Campaign Architect output. The package may contain richer owner-authored material, but it does not receive privileged runtime semantics or a separate Monster Master-only Dungeon Master.

The origin of the package is provenance, not an execution-mode switch.

## Monster Master role

Monster Master is the first bespoke reference campaign and gold standard for Campaign Architect output.

The team manually creates everything a mature Campaign Architect should later produce: setting, package truth, actors, locations, clue structures, event pools, tactical opportunities, consequence rules, semantic assets, and test fixtures.

Monster Master serves as:

- the first playable campaign;
- the reference CampaignPackage;
- the quality bar for generated campaigns;
- the principal Dungeon Master behavior and continuity fixture;
- the proving ground for Scene Registry, player knowledge, GameFrame presentation, and Arena Battles integration.

Monster Master is not the platform architecture, and its deterministic fixture is not its canonical story.

## Durable entities and scenes

The campaign journal is authoritative history. Runtime projects durable entity and scene state from committed package truth plus journaled operations.

The Scene Registry answers exact questions that must not rely on the model's recollection of prose:

- who is physically present;
- which creatures and relevant objects are present;
- who entered or left;
- what location the scene occupies;
- which exits, hazards, and objective entities matter;
- which present entities are tactically eligible.

A known absent person may be discussed or contacted through an explicit remote channel, but cannot physically act as if present.

See `rpg-scene-entity-and-knowledge-contract.md` for the controlling contract.

## Player knowledge and identity labels

Canonical runtime entity identity and player-known identity are distinct.

A player may know someone first as:

- `the woman in inspector's gear`;
- later `the checkpoint inspector`;
- later `Mara Venn`.

The hidden Dungeon Master decision may use the canonical entity ID. Player-facing rendering and GameFrame People views use only the best viewer-authorized label and facts.

Unknown entity existence is omitted rather than represented through hidden IDs, null records, redacted slots, or leaked counts.

## Dungeon Master context and rendering

The production Dungeon Master path separates hidden semantic reasoning from player-facing prose.

```text
GmTurnTrigger
→ typed hidden context compiled from package + current scene/world state
→ hidden semantic decision with no player-facing prose
→ deterministic validation/materialization
→ committed consequences + authorized revelations
→ audience-specific player-safe scene/world/knowledge projection
→ presentation renderer
→ audience-scoped GameFrame events
```

The journal remains the audit trail and source of truth. Typed current-state projections are reconstructible read layers and should replace raw bounded journal history as the model's primary memory mechanism.

The renderer must not receive unrevealed entity names, hidden motives, clue meanings, event eligibility, runtime-only facts, or unauthorized entity existence merely because the hidden decision model received them.

## Player action versus Ask-GM

The player interface must distinguish:

- an in-fiction **Act / Speak** declaration; and
- an out-of-fiction **Ask Game Master** query for rules, character knowledge, or clarification.

These use distinct command/trigger semantics. An Ask-GM query does not automatically become speech heard by NPCs and should not advance fictional time merely because the player asked a question.

## Tactical encounter rule

A tactical encounter is a stricter resolution mode for the current scene, not an unrelated match that substitutes canned identities.

The Encounter Scene Compiler projects exact required campaign entities, roles, teams, controllers/behavior authorities, objective entities, battlefield intent, and alternate terminal conditions into GameFrame.

GameFrame owns deterministic tactical authority and fails closed when the selected tactical rules cannot truthfully execute a combat-relevant requirement.

Campaign encounters may require more than elimination, including protection, escape, withdrawal, surrender, holding or reaching a location, preventing escape, or securing an object. The current fixed Monster Master duel remains a small standalone rules contract; campaign-specific tactical capability evolves separately and reuses GameFrame tactical infrastructure.

## Campaign intake evolution

Campaign creation should expand in this order:

1. owner-authored and deterministic briefs for implementation;
2. concise freeform player concepts;
3. generated draft packages with optional owner refinement;
4. structured campaign sheets;
5. guided GameFrame or Discord interviews;
6. reusable prepared theme and mechanic packs;
7. richer generation, repair, and operator review workflows.

All intake paths normalize into the same brief and CampaignPackage contracts.

## Media and asset relationship

The Campaign Architect decides which semantic assets and media roles the campaign requires. GameFrame's media pipeline resolves, composes, generates, validates, stores, versions, and delivers those assets.

The Dungeon Master uses accepted semantic identities during play and may request a compatible missing incidental presentation, but it does not redesign the campaign asset pack every turn.

Cloudflare-backed image generation is a campaign-preparation capability. Generated media is not required to prove CampaignPackage validity, entity/scene semantics, or Dungeon Master behavior.

## Testing requirements

Required fixtures and tests include:

- deterministic Campaign Architect provider or handcrafted package fixture;
- package validator, hashing, persistence, commitment, and reload tests;
- stable entity creation and incidental promotion tests;
- Scene Registry enter/leave/restart tests;
- player-specific identity and knowledge tests;
- hidden-name/secret absence from renderer input;
- mock Dungeon Master provider returning structured semantic decisions;
- scripted player actors using expected, chaotic, avoidant, and early-correct-guess behavior;
- multi-turn assertions that package truth never changes;
- partial and paraphrased secret-leak attempts;
- incidental NPC creation and later reappearance;
- missed-clue recovery;
- Act/Speak versus Ask-GM behavior;
- check and tactical handoff requests;
- scene-faithful encounter participant projection;
- withdrawal/escape outcomes where supported;
- restart, exact retry, reconnect, and resume;
- at least two materially different CampaignPackages.

Transport and restart tests do not substitute for campaign-behavior tests. Catalog-shape tests do not substitute for executable package tests.

## Prohibited designs

Do not:

- send a raw premise directly to the Dungeon Master and call that campaign creation;
- let the Dungeon Master invent the campaign foundation during ordinary play;
- use the model's prose history as the sole source for entity identity, physical presence, or player knowledge;
- let the Dungeon Master directly mint unconstrained durable NPCs through generic fact writes;
- expose canonical runtime names merely because the hidden model knows them;
- create separate Monster Master and generic Dungeon Master implementations;
- create a third intro agent;
- treat authored catalogs as executable packages without validation and commitment;
- make generated media a prerequisite for campaign logic testing;
- allow a deterministic fixture to become product canon;
- expose runtime-only CampaignPackage fields to GameFrame players;
- drop trainers, civilians, allies, escapees, or objective entities silently when tactical mode starts;
- force every campaign encounter into defeat-all-opposition semantics;
- let either repository read the other's database.

## Governing rule

> The Campaign Architect creates one validated CampaignPackage; runtime makes entities, scenes, and player knowledge explicit; the Dungeon Master interprets and portrays that committed world through validated semantic decisions; and GameFrame presents and adjudicates it without losing identity when the campaign changes modes.
