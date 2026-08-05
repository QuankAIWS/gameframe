---
title: RPG Event and Plot Pool Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
  - future prepared RPG campaigns
shared_document_id: rpg-event-and-plot-pool-contract-v1
shared_document_version: 1
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

Prepared campaigns use authored campaign spines, versioned plot-family pools, state-aware event pools, and committed clue graphs.

The system does not treat a campaign as a bag of unrelated random encounters. A selected plot family establishes one coherent hidden cause and evidence structure. Event pools then provide compatible complications, reactions, side opportunities, and escalation while preserving that committed truth.

Monster Master is the first bespoke implementation and proving ground. Its private plot-family contents belong in RPG GM Runtime, while this public shared contract defines the reusable shape, ownership, asset references, and validation rules.

## Terminology

### Campaign spine

The stable functional structure shared by multiple runs.

A spine defines required roles and pacing functions such as:

- group formation and opening briefing;
- initial assignment;
- anomaly or disruption;
- investigation, care, travel, or social work;
- mounting pressure;
- confrontation or decisive intervention;
- aftermath and continuation opportunity.

A spine does not identify the culprit, hidden cause, exact clues, or final resolution.

### Plot family

A plot family is a reusable causal pattern capable of producing a complete one-shot or chapter.

It defines:

- the kind of public anomaly players encounter;
- the shape of the hidden cause;
- possible responsible actors or forces;
- false interpretations that remain fair but optional;
- the required evidence relationships;
- escalation logic;
- nonviolent and tactical resolution shapes;
- consequence families;
- compatible event pools and asset roles.

A plot family is broader than one fixed scenario and narrower than unrestricted model improvisation.

### Committed plot package

A committed plot package is the selected hidden truth for one campaign run.

It fixes the cause, responsible actor or force, affected roles, required clue graph, escalation, resolution constraints, and continuation seed before meaningful investigation begins. It survives exact retry, reconnect, restart, and model changes.

### Event pool

An event pool is a versioned set of bounded state-aware events that can occur during a compatible plot.

Events may add pressure, reveal evidence, create a choice, change an NPC attitude, introduce a temporary hazard, reward preparation, complicate travel, or expose the effects of delay. They cannot replace the committed cause or move decisive evidence merely to steer players toward a preferred answer.

### Realization

Realization is the live GM's wording, dialogue, sensory description, humor, NPC behavior, and adaptation to player action. It remains subordinate to the spine, committed plot package, and selected event state.

## Ownership

### GameFrame owns

- player-facing presentation of scenes, clues, choices, clocks, recaps, and tactical transitions;
- semantic asset-role and accepted asset-ID resolution;
- audience-scoped projections;
- deterministic placeholders and fallback presentation;
- tactical rules, encounter state, and committed terminal outcomes;
- development tools that display public pool metadata without exposing runtime-only truth.

### RPG GM Runtime owns

- private plot-family contents;
- plot selection, compatibility checks, weighting, and seeding;
- committed plot packages and clue graphs;
- hidden event eligibility and exclusions;
- selected event state, cooldowns, and consequences;
- live realization and freeform intent interpretation;
- prevention of retrospective mystery rewriting;
- runtime-only continuity and secrecy.

### Shared contract owns

- stable identifiers and versioning requirements;
- reusable plot, event, clue, consequence, and asset-reference shapes;
- validation and replay invariants;
- cross-repository ownership boundaries.

## Layered campaign model

```text
prepared campaign spine
        +
compatible plot-family pool
        +
state-aware event pools
        +
asset-role catalog
        ↓
committed plot package and clue graph
        ↓
live GM realization and player decisions
        ↓
GameFrame presentation and tactical outcomes
```

The authored layers are reusable. The committed package is unique to one run. Realization may vary without changing causal truth.

## Plot-family template

The exact implementation schema may evolve, but a plot-family definition must represent these concepts:

```ts
type PlotFamilyDefinitionV1 = {
  protocolVersion: 1;
  plotFamilyId: string;
  plotFamilyVersion: number;
  campaignFamilyId: string;
  status: "draft" | "test-ready" | "accepted" | "retired";
  compatibleSpineIds: string[];
  toneTags: string[];
  contentTags: string[];
  publicAnomalyPatterns: string[];
  hiddenCausePatterns: string[];
  responsibleRolePatterns: string[];
  affectedRolePatterns: string[];
  falseInterpretationPatterns: string[];
  clueGraphTemplate: {
    requiredConclusionIds: string[];
    requiredClueRoles: string[];
    corroboratingClueRoles: string[];
    optionalRedHerringRoles: string[];
    minimumIndependentPaths: number;
  };
  escalation: {
    clockId: string;
    pressureSources: string[];
    escalationBeats: string[];
    maximumEscalationWithoutPlayerAgency: number;
  };
  resolutionShapes: Array<{
    resolutionId: string;
    kind: "social" | "care" | "investigation" | "containment" | "tactical" | "mixed";
    requirements: string[];
    consequenceFamilies: string[];
  }>;
  compatibleEventPoolIds: string[];
  requiredAssetRoleIds: string[];
  optionalAssetRoleIds: string[];
  forbiddenElements: string[];
};
```

Private implementations may add hidden author notes, weighting, content-safety metadata, and runtime-specific validation, but must not remove the causal and evidence requirements.

## Event-pool template

```ts
type EventPoolDefinitionV1 = {
  protocolVersion: 1;
  eventPoolId: string;
  eventPoolVersion: number;
  campaignFamilyId: string;
  purpose: string;
  compatiblePlotFamilyIds: string[];
  entries: EventPoolEntryV1[];
};

type EventPoolEntryV1 = {
  eventId: string;
  phaseTags: string[];
  eventTags: string[];
  weight: number;
  trigger: string;
  eligibility: string[];
  exclusions: string[];
  audience: "public" | "party" | "player" | "runtime";
  publicSignal: string;
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

An event entry describes a situation and state transition, not final prose. The live GM may realize it differently according to location, NPCs, monsters, prior choices, and available assets.

## Clue-graph requirements

Every investigative plot package contains a committed evidence graph.

The graph distinguishes:

- **required conclusions** — facts players may need to establish;
- **primary clues** — evidence that directly supports a conclusion;
- **corroborating clues** — independent support or contradiction testing;
- **context clues** — information that explains motive, timing, or consequences;
- **red herrings** — plausible but nonmandatory alternatives that can be disproved;
- **recovery paths** — ways to continue after a missed clue or failed check.

A valid graph must provide at least two reasonable paths toward each required conclusion. A failed roll may change cost, time, confidence, or consequence, but must not permanently remove the only route to completion.

The live GM may alter wording and placement details only while remaining compatible with already established facts and the committed graph. It may not create a new decisive clue after the fact solely because players chose an unexpected approach.

## Event categories

Prepared campaigns should draw from several categories rather than relying on combat interruptions.

Recommended reusable categories include:

- assignment and briefing;
- travel and route conditions;
- environmental pressure;
- creature care and behavior;
- social and relationship scenes;
- bureaucracy and jurisdiction;
- investigation and evidence;
- criminal interference;
- rival or competing-party action;
- guide or mentor intervention;
- companion observation or refusal;
- equipment, supply, and accommodation complications;
- tactical escalation;
- aftermath, assessment, and continuing hooks.

Campaign-specific pools may add categories without changing the base contract.

## Eligibility and selection

Event selection must consider current state rather than weight alone.

At minimum, eligibility may depend on:

- current spine phase;
- selected plot family and committed cause;
- discovered clues and established facts;
- unresolved consequences;
- player location and route;
- present NPCs and monsters;
- hazard-class permissions and equipment;
- elapsed pressure-clock state;
- event cooldowns and repetition limits;
- audience and privacy constraints;
- available prepared assets or approved fallbacks.

Weighted selection occurs only after incompatible entries are excluded.

## Asset-role references

Plot and event definitions reference semantic asset roles, not filenames or provider prompts.

Examples:

```text
location.field-station.exterior
location.old-culvert
npc.veteran-warden-guide.portrait
npc.nervous-courier.portrait
creature.domestic-hauler.field
creature.dangerous-juvenile.field
prop.supply-cart.damaged
prop.route-marker.tampered
terrain.settled-road
ui.private-clue-card
fx.tracking-trail
```

GameFrame resolves an asset role to:

1. an accepted campaign asset;
2. a compatible theme or catalog asset;
3. a deterministic composition;
4. a readable placeholder or text fallback.

Missing optional art must not invalidate an otherwise playable event. Required tactical readability must be available through an accepted asset or explicit approved fallback before encounter launch.

## Consequence model

Events and plot resolutions produce bounded state changes rather than merely ending a scene.

Consequence families may include:

- clue discovered or confidence changed;
- pressure clock advanced or reduced;
- NPC trust, suspicion, debt, or hostility;
- monster comfort, injury, fear, refusal, or bond change;
- route safety or access change;
- license, legal, evidence, or reputation state;
- supplies, equipment, cube condition, or money;
- tactical advantage, hazard, objective, or reinforcement;
- future event eligibility;
- one-shot assessment and continuation hooks.

GameFrame should receive player-visible consequences through structured events where supported. Runtime-only eligibility and secret-state mutations remain in the runtime.

## Validation rules

A plot family or event pool is accepted only when:

- one clear causal chain explains the public anomaly;
- every required conclusion has at least two reasonable evidence paths;
- no single failed check can dead-end the one-shot;
- escalation follows from cause, time, or player choice;
- noncombat resolution exists when the situation credibly allows it;
- tactical conflict has an authored objective and consequence rather than existing only to fill time;
- guide NPCs provide context and safety boundaries without solving the plot;
- event entries declare eligibility, exclusions, repetition, and consequences;
- required asset roles have accepted assets or readable fallbacks;
- runtime-only fields cannot enter public or player-private projections;
- the complete immediate plot can conclude as a satisfying one-shot;
- continuation hooks are optional rather than withholding the real ending.

## Deterministic fixtures and live variation

Each accepted campaign family should maintain:

- one fixed plot package and event sequence for integration and regression testing;
- variable-seed packages for diversity testing;
- authored pool versions that are never silently rewritten after evidence is accepted;
- package, pool, and seed metadata in runtime persistence;
- a replay log identifying selected event IDs and resulting state mutations.

The deterministic fixture proves contracts. Variable runs prove that the same authored materials can produce materially different coherent play.

## Privacy and public repositories

This contract and public asset-role vocabulary may live in GameFrame.

Specific private plot contents, weighted culprit lists, unrevealed causes, clue answers, and active campaign packages should remain in RPG GM Runtime or runtime persistence. Public documentation may describe representative shapes without publishing every answer intended to surprise players.

## Current Monster Master boundary

The initial Monster Master one-shot uses:

- the joint academy and warden certification spine;
- route inspection, creature care, supervised capture, and delivery functions;
- a small accepted plot-family pool;
- state-aware road, care, investigation, social, criminal, and escalation events;
- official monster hazard Classes 1 through 4;
- no confirmed or official Class Five event;
- one complete one-shot resolution plus optional continuation seeds;
- the prepared Monster Master asset register and deterministic fallbacks.

The first runtime implementation may use one fixed plot family while the rest remain design-ready. The shared template should not force immediate procedural generation.

## Governing rule

> Commit one coherent cause and clue graph, select only state-compatible events, reference presentation through semantic asset roles, and let the model improvise expression without rewriting campaign truth.
