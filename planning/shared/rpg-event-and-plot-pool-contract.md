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
  - future prepared RPG campaigns
shared_document_id: rpg-event-and-plot-pool-contract-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-event-and-plot-pool-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-event-and-plot-pool-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-campaign-compiler-contract.md
  - rpg-one-shot-intro-agent-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-rendering-and-asset-contract.md
  - rpg-media-theme-and-audio-pipeline.md
---

# RPG Event and Plot Pool Contract

## Decision

Prepared campaigns use authored campaign spines, curated plot-family catalogs, state-aware event pools, and committed clue graphs.

The system does not treat a campaign as a bag of unrelated random encounters, and it does not treat one deterministic fixture as the campaign's canonical story.

Before meaningful investigation begins, one approved plot family is selected and one hidden package is committed. Event pools then provide compatible complications, reactions, opportunities, and escalation while preserving that package's truth.

Monster Master is the first bespoke implementation and proving ground. Its private plot-family contents and selected packages belong in RPG GM Runtime. This public shared contract defines the reusable shape, ownership, asset references, validation rules, and multi-plot requirement.

## Terminology

### Campaign spine

The stable functional structure shared by multiple runs.

A spine defines required functions such as:

- group formation;
- initial assignment or public situation;
- early player agency;
- one committed hidden package;
- investigation, care, travel, social work, practical work, or avoidance;
- causal pressure;
- decisive intervention;
- aftermath and optional continuation.

A spine does not identify the cause, responsible actors, exact clues, or ending.

### Plot-family catalog

A plot-family catalog is the approved set of materially different causal patterns available to one prepared campaign.

A valid starter catalog should include several families with different mixtures of:

- creature care and ecological pressure;
- technical or equipment failure;
- social conflict, competition, or sabotage;
- public chaos and comedy;
- human crime, corruption, fraud, or rescue;
- horror or specialty hazards when their rules are authored.

No family is canonical merely because it is used by CI, documentation, or the first art pass.

### Plot family

A plot family is a reusable causal pattern capable of producing a complete one-shot or chapter.

It defines:

- public anomaly patterns;
- hidden-cause shape;
- responsible and affected role patterns;
- fair false interpretations;
- required conclusion and evidence roles;
- escalation logic;
- social, practical, care, investigative, avoidant, deceptive, and tactical resolution shapes;
- consequence families;
- compatible event pools and semantic asset roles;
- forbidden elements and realization limits.

A plot family is broader than one fixed scenario and narrower than unrestricted model improvisation.

### Committed plot package

A committed plot package is the selected hidden truth for one campaign run.

It fixes the selected family, cause, responsible actors or forces, affected roles, required clue graph, escalation, resolution constraints, tactical threshold, and continuation seed before meaningful investigation begins.

The package survives exact retry, reconnect, restart, model changes, and unexpected player action. The runtime may not switch families because players guessed correctly, missed a clue, or refused the apparent assignment.

### Event pool

An event pool is a versioned set of bounded state-aware events compatible with several plot families or with one explicit family.

Events may add pressure, reveal evidence, create a choice, change an NPC attitude, introduce a temporary hazard, reward preparation, complicate travel, create temptation, or expose the effects of delay.

Events cannot replace the committed cause, move decisive evidence merely to steer players, or force an event sequence because it was authored in a particular order.

### Realization

Realization is the live GM's wording, dialogue, sensory description, humor, NPC behavior, event timing, and adaptation to player action.

It remains subordinate to the campaign spine, selected package, established facts, and current state.

## Ownership

### GameFrame owns

- player-facing presentation of scenes, clues, choices, clocks, recaps, and tactical transitions;
- semantic asset-role and accepted asset-ID resolution;
- audience-scoped projections;
- deterministic placeholders and fallback presentation;
- tactical rules, encounter state, and committed terminal outcomes;
- development tools that display public catalog metadata without exposing runtime-only truth;
- the reusable starter asset foundation and family-extension mappings.

### RPG GM Runtime owns

- private plot-family contents and catalog enablement;
- package selection, compatibility checks, seeding, and commitment;
- committed plot packages and clue graphs;
- hidden event eligibility and exclusions;
- selected event state, cooldowns, pressure, and consequences;
- live realization and freeform intent interpretation;
- prevention of retrospective plot rewriting;
- runtime-only continuity and secrecy.

### Shared contract owns

- stable identifiers and versioning requirements;
- reusable catalog, plot, event, clue, consequence, and asset-reference shapes;
- deterministic-fixture rules;
- validation and replay invariants;
- cross-repository ownership boundaries.

## Layered campaign model

```text
prepared campaign spine
        +
curated plot-family catalog
        +
state-aware event pools
        +
shared asset-role foundation
        ↓
selected and committed plot package
        ↓
live GM realization and player decisions
        ↓
GameFrame presentation and tactical outcomes
```

The catalog and event pools are reusable. The committed package is unique to one run. Realization may vary without changing causal truth.

## Plot-family template

The implementation schema may evolve, but a plot-family definition must represent these concepts:

```ts
type PlotFamilyDefinitionV2 = {
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

Private implementations may add hidden author notes, weighting, content-safety metadata, and runtime-specific validation, but must not remove causal and evidence requirements.

## Event-pool template

```ts
type EventPoolDefinitionV2 = {
  protocolVersion: number;
  eventPoolId: string;
  eventPoolVersion: number;
  campaignFamilyId: string;
  purpose: string;
  compatiblePlotFamilyIds: string[];
  entries: EventPoolEntryV2[];
};

type EventPoolEntryV2 = {
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

An event entry describes a situation and state transition, not final prose. The live GM may realize it differently according to the selected package, location, NPCs, monsters, prior choices, and available assets.

## Clue-graph requirements

Every investigative package contains a committed evidence graph.

The graph distinguishes:

- **required conclusions** — facts players may need to establish;
- **primary clues** — evidence that directly supports a conclusion;
- **corroborating clues** — independent support or contradiction testing;
- **context clues** — information explaining motive, timing, or consequences;
- **red herrings** — plausible but nonmandatory alternatives that can be disproved;
- **recovery paths** — ways to continue after a missed clue or failed check.

Each required conclusion must have at least two reasonable paths unless the package is explicitly non-investigative. A failed roll may change cost, time, confidence, exposure, or consequence, but must not permanently remove the only route to completion.

The live GM may adapt wording and placement details only while remaining compatible with established facts and the committed graph. It may not create new decisive evidence solely because players chose an unexpected approach.

## Reusable event categories

Prepared campaigns should draw from several categories rather than relying on combat interruptions.

Recommended categories include:

- opening opportunity;
- assignment and briefing;
- route and infrastructure;
- environmental pressure;
- creature care and behavior;
- social and relationship pressure;
- bureaucracy and jurisdiction;
- investigation and evidence;
- criminal interference;
- rival or competing-party action;
- guide or mentor intervention;
- equipment, supply, cube, and accommodation complications;
- tactical escalation;
- aftermath, assessment, and continuation hooks.

Campaign-specific pools may add categories without changing the base contract.

## Eligibility and selection

Plot-family selection occurs before meaningful investigation. Event selection occurs continuously from current state.

At minimum, event eligibility may depend on:

- selected plot family and committed cause;
- current spine function;
- discovered clues and established facts;
- unresolved consequences;
- player location and route;
- present NPCs and monsters;
- hazard-class permissions and equipment;
- pressure state;
- event cooldowns and repetition limits;
- audience and privacy constraints;
- available prepared assets or approved fallbacks.

Weighted selection, when implemented, occurs only after incompatible entries are excluded. A broad weighted engine is not required for the initial Monster Master catalog.

## Asset-role references

Plot and event definitions reference semantic asset roles, not filenames, provider prompts, or one fixture's named actors.

Shared foundation examples:

```text
location.field-station
location.settled-route
npc.veteran-guide.portrait
npc.local-worker.portrait
npc.rival-trainee.portrait
creature.domestic-worker.field
creature.conventional-hazard.field
prop.route-marker.modular
prop.supply-cart.modular
prop.capture-cube.inspection
prop.field-kit.modular
prop.barrier.modular
ui.private-observation
ui.tactical-objectives
ui.aftermath-summary
fx.investigation-set
fx.behavior-warning
fx.hazard-warning
```

Family-specific extensions may add roles such as counterfeit components, festival dressing, a false roadblock, or a territorial creature.

GameFrame resolves each role to:

1. an accepted campaign asset;
2. a compatible theme or Arena Battles asset;
3. a deterministic composition;
4. a readable placeholder or text fallback.

Missing optional art must not invalidate an otherwise playable event. Required tactical readability must exist through an accepted asset or approved fallback before encounter launch.

No single plot family or deterministic fixture controls the complete asset register.

## Consequence model

Events and plot resolutions produce bounded state changes rather than merely ending a scene.

Consequence families may include:

- clue discovery or confidence;
- pressure advanced or reduced;
- NPC trust, suspicion, debt, leverage, or hostility;
- monster comfort, injury, fear, refusal, placement, or bond;
- route safety or access;
- license, legal, evidence, or reputation state;
- supplies, equipment, cube condition, or money;
- tactical advantage, hazard, objective, or reinforcement;
- future event eligibility;
- assessment and optional continuation hooks.

GameFrame receives player-visible consequences through structured events where supported. Runtime-only eligibility and secret-state mutations remain in the runtime.

## Validation rules

A catalog is accepted only when:

- it contains several materially different enabled plot families;
- no enabled family is labeled canonical solely because it is used by CI or assets;
- blocked families state their missing prerequisite;
- the shared asset foundation supports more than one family;
- a deterministic fixture is explicitly non-canonical.

A plot family or package is accepted only when:

- one clear causal chain explains the public anomaly;
- every required conclusion has redundant or recoverable evidence paths;
- no single failed check can dead-end the one-shot;
- escalation follows from cause, time, or player choice;
- noncombat resolution exists when credible;
- tactical conflict has an authored objective and consequence rather than existing to fill time;
- guide NPCs provide context and safety boundaries without solving the plot;
- required asset roles have accepted assets or readable fallbacks;
- runtime-only fields cannot enter player projections;
- the immediate plot can conclude as a satisfying one-shot;
- continuation hooks are optional.

## Deterministic fixtures and live variation

Each prepared campaign should maintain at least one deterministic package for integration and regression testing.

The deterministic fixture must:

- select a family also present in the enabled catalog;
- be marked `fixtureOnly` and `canonicalStarter: false` or equivalent;
- preserve package, catalog, and seed metadata;
- produce stable outputs for exact retry;
- remain replaceable through a versioned fixture change;
- avoid controlling default campaign copy, creative priority, or the entire asset roadmap.

Variable or explicitly selected runs prove that the same chassis and event material can produce materially different coherent play.

## Privacy and public repositories

This contract and public asset-role vocabulary may live in GameFrame.

Specific private family contents, culprit or cause lists, clue answers, package selection, and active campaign truth remain in RPG GM Runtime or runtime persistence. Public documentation may describe representative shapes without publishing every intended surprise.

## Current Monster Master boundary

The initial Monster Master starter uses:

- the joint academy and warden certification chassis;
- route, creature-care, capture, delivery, licensing, and public-service functions;
- at least five materially different enabled plot families;
- reusable opening, route, care, social, escalation, and aftermath event pools;
- one selected package committed per run;
- one explicitly non-canonical deterministic package for CI;
- official monster hazard Classes 1 through 4;
- no confirmed or official Class Five event;
- blocked Class 4 families until their fixed rule and countermeasure exist;
- a shared starter asset foundation plus selected family extensions;
- one complete one-shot resolution plus optional continuation seeds.

The shared template does not require immediate procedural generation or production art for every family.

## Governing rule

> Maintain several distinct approved plot families, commit one coherent package per run, select only state-compatible events, use shared semantic assets, and never let a deterministic fixture become the campaign's canonical story.
