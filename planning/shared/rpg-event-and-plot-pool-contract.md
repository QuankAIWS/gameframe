---
title: RPG Event and Plot Pool Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
  - future handcrafted and generated campaigns
shared_document_id: rpg-event-and-plot-pool-contract-v1
shared_document_version: 3
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-event-and-plot-pool-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-event-and-plot-pool-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-platform-roadmap.md
  - rpg-campaign-compiler-contract.md
  - rpg-one-shot-intro-agent-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-rendering-and-asset-contract.md
  - rpg-media-theme-and-audio-pipeline.md
---

# RPG Event and Plot Pool Contract

## Decision

Campaign spines, plot-family catalogs, event pools, clue templates, NPC role pools, and asset-role catalogs are **campaign-authoring material**.

The Campaign Architect selects, completes, and binds compatible material into a validated CampaignPackage before ordinary play. For handcrafted Monster Master packages, the team performs this Campaign Architect work manually.

The Dungeon Master later realizes the committed package through narration, dialogue, pacing, eligible events, NPC behavior, and freeform player interaction. It does not treat catalogs as a random-content generator and does not replace package truth.

A catalog or deterministic fixture is not an executable campaign merely because its shape passes validation.

## Official roles

- **Campaign Architect:** creates the CampaignPackage, selects or authors plot structure, binds concrete actors and clues, and establishes causal truth.
- **Dungeon Master:** runs the committed package, selects currently eligible events, and adapts realization around players.
- **GameFrame:** presents player-safe material, owns deterministic mechanics and Arena Battles, and resolves semantic assets.

Older references to plot agent or campaign compiler refer to Campaign Architect responsibilities. Live GM refers to the Dungeon Master.

## Layered model

```text
campaign brief or handcrafted specification
        +
campaign spine
        +
plot-family and event source catalogs
        +
NPC and asset-role source catalogs
        ↓
Campaign Architect or manual authoring
        ↓
validated and committed CampaignPackage
        ↓
Dungeon Master realization and player decisions
        ↓
GameFrame presentation and authoritative mechanics
```

## Terminology

### Campaign spine

A stable functional structure that may be reused across packages.

It may define:

- group formation;
- initial public situation;
- early player agency;
- investigation, care, travel, social work, practical work, deception, or avoidance;
- pressure and escalation functions;
- decisive intervention;
- aftermath and continuation.

A spine does not by itself define concrete cause, responsible actors, actual clues, or ending.

### Plot-family catalog

A curated set of materially different causal patterns available to the Campaign Architect.

A catalog should span different kinds of play rather than cosmetic variants of one mystery. No family becomes canonical because it appears in CI, documentation, or asset production.

### Plot family

A reusable causal pattern broad enough to support multiple packages and narrow enough to define meaningful constraints.

It may define:

- public anomaly patterns;
- hidden-cause patterns;
- responsible and affected role patterns;
- false interpretations;
- conclusion and evidence roles;
- pressure and escalation logic;
- social, care, practical, investigative, avoidant, deceptive, containment, and tactical resolution shapes;
- consequence families;
- compatible event and asset roles;
- forbidden elements.

A plot family is not a completed package.

### CampaignPackage

The completed executable campaign artifact.

It binds:

- actual premise and operating rules;
- selected cause and causal history;
- actual responsible and affected actors;
- actual locations and relationships;
- concrete clue and evidence graph;
- event eligibility and pressure state;
- tactical thresholds and objectives;
- consequences and resolution conditions;
- semantic presentation requirements;
- visibility, provenance, and forbidden retcons.

The package survives retry, reconnect, restart, model changes, and unexpected player behavior.

### Event pool

A versioned set of bounded authored situations and state transitions.

Events may add pressure, reveal available evidence, create a choice, change an NPC attitude, introduce hazards, reward preparation, complicate travel, create temptation, or show the effects of delay.

An event cannot replace package truth, move decisive evidence merely to steer players, or force a sequence because it was authored in a particular order.

### Realization

The Dungeon Master’s wording, dialogue, sensory detail, humor, NPC performance, timing, and adaptation.

Realization remains subordinate to the CampaignPackage and current committed state.

## Ownership

### Campaign Architect in RPG GM Runtime

- selects and completes source material;
- binds concrete actors, causes, clues, events, pressure, and resolutions;
- validates and commits CampaignPackages;
- records provenance and compatibility;
- ensures the package is playable and recoverable.

### Dungeon Master in RPG GM Runtime

- interprets freeform actions;
- selects currently eligible package events;
- realizes scenes and NPCs;
- applies package-compatible consequences;
- preserves package truth and secrecy.

### GameFrame

- presents scenes, clues, choices, clocks, recaps, and tactical transitions;
- resolves semantic asset roles;
- enforces audience-scoped projections;
- supplies placeholders and fallbacks;
- owns deterministic mechanics, encounter state, and terminal outcomes.

### Shared contract

- stable concepts, identifiers, versioning, bounds, validation rules, and ownership boundaries.

## Plot-family source template

A source plot family should represent:

```ts
type PlotFamilyDefinitionV3 = {
  protocolVersion: number;
  plotFamilyId: string;
  plotFamilyVersion: number;
  campaignFamilyId: string;
  status: "draft" | "enabled" | "blocked" | "retired";
  blockedBy?: string;
  compatibleSpineIds: string[];
  toneTags: string[];
  contentTags: string[];
  publicAnomalyPatterns: string[];
  hiddenCausePatterns: string[];
  responsibleRolePatterns: string[];
  affectedRolePatterns: string[];
  falseInterpretationPatterns: string[];
  clueGraphTemplate: {
    requiredConclusionRoles: string[];
    requiredClueRoles: string[];
    corroboratingClueRoles: string[];
    optionalRedHerringRoles: string[];
    minimumIndependentPaths: number;
  };
  escalation: {
    pressureSources: string[];
    reductionSources: string[];
    maximumEscalationWithoutPlayerAgency: number;
  };
  resolutionShapes: Array<{
    kind: "social" | "care" | "investigation" | "practical" | "avoidance" | "containment" | "tactical" | "mixed";
    requirements: string[];
    consequenceFamilies: string[];
  }>;
  compatibleEventPoolIds: string[];
  requiredAssetRoleIds: string[];
  optionalAssetRoleIds: string[];
  forbiddenElements: string[];
};
```

A CampaignPackage must replace patterns and roles with concrete validated campaign state where required.

## Event-pool source template

```ts
type EventPoolDefinitionV3 = {
  protocolVersion: number;
  eventPoolId: string;
  eventPoolVersion: number;
  campaignFamilyId: string;
  purpose: string;
  compatiblePlotFamilyIds: string[];
  entries: EventPoolEntryV3[];
};

type EventPoolEntryV3 = {
  eventId: string;
  eventTags: string[];
  trigger: string;
  eligibility: string[];
  exclusions: string[];
  audience: "public" | "party" | "player" | "runtime";
  publicSignals: string[];
  hiddenFunction: string;
  supportedApproaches: string[];
  checkRoles: string[];
  consequenceOnResolve: string[];
  consequenceOnIgnore: string[];
  stateMutations: string[];
  requiredAssetRoleIds: string[];
  optionalAssetRoleIds: string[];
  repetitionLimit: number;
  cooldownBeats: number;
};
```

An event entry is authored situation material, not final prose or an automatically eligible scene.

## Clue-graph requirements

Every investigative CampaignPackage contains a committed evidence graph distinguishing:

- required conclusions;
- primary clues;
- corroborating clues;
- context clues;
- optional red herrings;
- recovery paths.

Each required conclusion must have at least two reasonable paths unless the package is explicitly non-investigative.

A failed roll may change cost, time, confidence, exposure, danger, or consequence. It must not permanently remove the only route to completion.

The Dungeon Master may adapt clue wording and local framing while preserving committed facts and relationships. It may not invent decisive evidence solely because players chose an unexpected approach.

## Event eligibility

Eligibility may depend on:

- CampaignPackage identity and truth;
- current spine function;
- discovered clues and established facts;
- unresolved consequences;
- player location and route;
- present NPCs and creatures;
- permissions, equipment, and resources;
- pressure state;
- cooldown and repetition limits;
- audience and privacy;
- available assets or fallbacks.

Weighted selection, if added, occurs only after incompatible entries are excluded. A broad weighted engine is not required before the first complete package works.

## Consequence model

Events and resolutions produce bounded state changes, including:

- clue discovery or confidence;
- pressure advanced or reduced;
- NPC trust, suspicion, debt, leverage, or hostility;
- creature comfort, injury, fear, refusal, placement, or bond;
- route access or safety;
- legal, license, evidence, or reputation state;
- supplies, equipment, cube condition, or money;
- tactical advantage, hazard, objective, or reinforcement;
- later event eligibility;
- assessment and continuation hooks.

GameFrame receives structured player-visible consequences where supported. Runtime-only eligibility and secrets remain in RPG GM Runtime.

## Asset-role references

Source catalogs and packages reference semantic roles, not filenames or provider prompts.

GameFrame resolves each role through:

1. accepted campaign asset;
2. compatible prepared or Arena Battles asset;
3. deterministic composition;
4. readable placeholder, silhouette, card, or text fallback.

Missing optional art does not invalidate an otherwise playable event. Tactical readability must exist before encounter launch.

## Validation levels

### Source catalog validation

A catalog is valid when:

- it contains materially different enabled families;
- blocked families identify prerequisites;
- shared assets support more than one family;
- deterministic fixtures are explicitly noncanonical;
- source entries have causal and playable structure.

This proves authoring material only.

### CampaignPackage validation

A package is valid when:

- one clear causal chain explains the public anomaly;
- concrete actors, locations, clues, and event state are bound;
- conclusions have redundant or recoverable paths;
- escalation follows from cause, time, or player action;
- noncombat resolution exists when credible;
- tactical conflict has an authored objective and consequence;
- guide NPCs do not solve the campaign;
- required asset roles have accepted assets or fallbacks;
- runtime-only fields cannot enter player projections;
- the campaign has a complete bounded resolution;
- package state serializes, persists, reloads, and resumes.

### Dungeon Master behavior validation

Machine-play must prove that the Dungeon Master:

- preserves package truth;
- handles expected and unexpected freeform actions;
- does not leak secrets;
- preserves NPC identity and relationships;
- supports missed-clue recovery;
- selects only eligible events;
- reaches a valid resolution or tactical threshold.

## Monster Master boundary

The current Monster Master catalog includes several source families and reusable event pools. The immediate implementation goal is not to execute the entire catalog as a procedural system.

The immediate goal is to convert selected material into **one complete handcrafted gold-standard CampaignPackage**, prove it through the Dungeon Master and GameFrame loop, and then author or generate additional packages.

The deterministic package remains CI-only and noncanonical. Class 4 specialty material remains blocked until its fixed rule and countermeasure exist. No confirmed Class Five material belongs in the starter.

## Privacy

Public shared contracts may describe reusable shapes and representative examples.

Private family contents, actual causes, clue answers, package selection, actor bindings, event eligibility, and active campaign truth remain in RPG GM Runtime or runtime persistence.

## Governing rule

> Catalogs provide campaign-authoring material; the Campaign Architect turns that material into a complete CampaignPackage; the Dungeon Master realizes only committed and eligible content; and no fixture or source catalog is mistaken for the finished campaign.
