---
title: RPG One-Shot Intro Agent Contract
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG starter experience
shared_document_id: rpg-one-shot-intro-agent-contract-v1
shared_document_version: 3
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-one-shot-intro-agent-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-one-shot-intro-agent-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-campaign-compiler-contract.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-rendering-and-asset-contract.md
  - rpg-cross-repository-integration-testing.md
  - ../monster-master-rpg-current-creative-direction.md
  - ../monster-master-rpg-lore-tone-and-agent-realization.md
---

# RPG One-Shot Intro Agent Contract

## Decision

The long-term campaign compiler and final plot-agent implementation remain deferred.

The current bounded delivery uses:

1. a curated Monster Master starter catalog containing several approved plot families;
2. one selected package committed before meaningful investigation for each campaign run;
3. one DM realization capability that uses the language model to open that package around the participating players;
4. one explicitly non-canonical deterministic package for CI and integration testing.

No plot family or deterministic fixture is the canonical Monster Master starter story.

The selected package is causal material, not a numbered scene script. The DM agent should adapt strongly while preserving committed truth.

This slice does not build the general campaign compiler, final plot agent, interactive campaign interview, arbitrary-theme generator, general package migration, broad weighted selector, or generated-media pipeline.

## Durable ownership

- GameFrame owns this cross-repository contract, player-facing presentation, deterministic placeholders, Monster Master lore direction, semantic asset vocabulary, and asset resolution.
- RPG GM Runtime owns the private starter catalog, selected packages, hidden DM prompts, actor secrets, clue answers, event eligibility, private hooks, continuity state, and runtime-only validation.
- `rpg-campaign-compiler-contract.md` controls future conversion of player ideas, forms, and interviews into complete packages.
- `rpg-event-and-plot-pool-contract.md` controls reusable catalog, package, event, clue, consequence, and asset-role shapes.
- `rpg-monster-master-reference-campaign.md` controls the reference-campaign architecture.
- `monster-master-rpg-current-creative-direction.md` and `monster-master-rpg-lore-tone-and-agent-realization.md` control current Monster Master tone, multi-plot posture, and player agency.

Future implementation agents must extend these contracts rather than reconstructing the design from chat history.

## Starter catalog requirement

The Monster Master starter catalog must contain several materially different enabled families.

The current intended range includes:

- ecological displacement and creature-care crises;
- counterfeit or modified cube failures;
- rivalry and certification sabotage;
- public-event or mascot breakouts;
- false authority, human crime, corruption, and rescue;
- later specialty hazards only after their fixed rules and countermeasures are authored.

Each enabled family must define enough causal structure to produce a valid package, but the catalog itself is not player-visible and does not commit any one answer before selection.

## Package selection and commitment

Before meaningful investigation begins, RPG GM Runtime must select or receive one approved package.

Selection may initially be:

- explicit owner or test-harness choice;
- deterministic choice from a supplied seed;
- another small validated pre-session choice.

The selected package must commit at least:

- plot-family and package identity;
- hidden cause and causal history;
- responsible and affected actor roles;
- required conclusions and evidence relationships;
- pressure and escalation rules;
- resolution constraints;
- tactical threshold conditions;
- forbidden retcons;
- package version and seed or provenance.

Once committed, retries, reconnects, process restarts, model changes, and unexpected player action must not replace the selected family, cause, or required evidence logic.

## Prepared intro projection

The DM intro receives a bounded projection of the selected package containing:

- campaign, package, and intro identity;
- participating players and known role or starter-creature information;
- starting location and active guide role;
- public premise and immediate anomaly;
- immediate pressure;
- available clue identifiers or evidence roles;
- two or more illustrative initial approaches;
- committed runtime-only cause and forbidden reveals;
- available prepared semantic asset IDs and fallback labels;
- tone, content, and realization boundaries.

The full private package may additionally contain actor goals and secrets, clue relationships, event eligibility, pressure logic, tactical thresholds, resolution constraints, and consequence mappings. The bounded intro projection exposes only what opening realization requires.

## Required intro behavior

The DM agent must produce an opening that:

1. establishes where the party is and why its members can act together;
2. introduces the guide or field supervisor without making that NPC solve manageable problems;
3. presents an immediate concrete situation and reaches player agency quickly;
4. gives enough sensory, social, practical, and creature-related information to act;
5. offers two to four illustrative approaches while explicitly accepting plausible freeform action;
6. permits lawful help, investigation, practical work, rule-bending, opportunism, refusal, or unexpected action when supported by the selected package;
7. follows supplied tone boundaries rather than defaulting to dry humor or forbidding slapstick;
8. avoids corporate training-simulation dialogue, morality lectures, forced wholesomeness, forced criminality, constant joke density, and constant crime bait;
9. avoids forcing tactical play before player action and committed state justify a tactical threshold;
10. avoids revealing the selected cause, responsible actors, hidden motives, unrevealed clue relationships, raw prompts, or private reasoning;
11. remains fully presentable through text and deterministic placeholders;
12. ends at a clean player decision rather than choosing or acting for player characters.

Suggested approaches are examples, not a closed action menu unless GameFrame deliberately presents a mechanically bounded choice.

## Adult-world and tone posture

The intro should treat players as adults in a socially varied world.

Heroic and lawful choices may be satisfying and effective. Practical, selfish, opportunistic, illegal, reckless, avoidant, or unexpected choices may also be credible. The DM should represent likely consequences through the world rather than correcting players toward a preferred moral alignment.

Supported Monster Master modes include:

- dry or broad situational comedy;
- bounded slapstick and physical comedy;
- absurd professional culture and selective borderline-meme energy;
- sincere relationships and adventure;
- funny horror and bounded genuine horror;
- tactical danger and relief afterward.

The setting takes continuity and consequences seriously without protecting its dignity.

## Runtime output contract

The runtime-only DM result contains three scopes.

### Public scene

GameFrame may project:

- scene title;
- bounded narration;
- immediate situation;
- two to four suggested approaches;
- prepared asset IDs or fallback labels;
- a clear invitation for freeform action.

### Player-private hooks

The DM may produce zero or one short private hook for each participating player when the prepared context supports it. A hook may reference expertise, a noticed detail, an existing relationship, a temptation, or a private concern.

Private hooks must not reveal selected hidden truth merely to make a player feel special.

### Runtime handoff

The player-invisible handoff records:

- facts established by the intro;
- current pressure and timing state;
- eligible next event or beat identifiers;
- clues made available but not necessarily discovered;
- secrets that remain withheld;
- continuity constraints for the next live GM turn.

GameFrame must never include this handoff in ordinary player projections, exports, player logs, or recaps before discovery.

## Prompt boundary

The prompt bundle is runtime-owned, versioned, and not player-visible.

It must instruct the DM agent to:

- treat the selected package projection as authoritative causal material;
- produce only the defined structured output;
- distinguish public, player-private, and runtime-only information;
- avoid private reasoning or hidden instructions in output fields;
- avoid inventing unsupported mechanics or media dependencies;
- use prepared assets when supplied and deterministic fallbacks otherwise;
- interpret plausible freeform action rather than enforce examples as a menu;
- preserve originality and avoid direct copying of protected settings or characters;
- return a structured error when context is contradictory or missing required identities.

Only prompt and package versions may enter player-safe operational metadata. Raw hidden instructions and package truth must not be projected.

## Deterministic fixture rule

A provider-free deterministic package and intro fixture must be available for tests and degraded operation.

The deterministic fixture must:

- be explicitly marked `fixtureOnly` and `canonicalStarter: false`;
- select one family that also exists in the enabled catalog;
- produce stable output for identical context;
- create the same audience separation as the model-backed path;
- never expose runtime-only cause or forbidden reveals;
- require no image, audio, animation, or external model provider;
- remain replaceable through a versioned fixture change;
- avoid controlling default campaign copy or the complete asset roadmap.

The fixture proves contracts. It is not the final authored story or the default campaign.

## Asset boundary

The intro should rely first on a shared starter foundation:

- modular field-station and settled-route presentation;
- recurring guide and reusable local-role portraits;
- route, cube, field-kit, barrier, cargo, and inspection props;
- domestic and conventional hazard creature coverage;
- private observation, investigation, warning, objectives, and aftermath UI;
- readable fallbacks.

Family-specific extensions may be requested by the selected package. No one fixture may define the whole asset pack.

## Acceptance criteria

This bounded slice is complete when:

- a private catalog contains several enabled plot families and no canonical starter family;
- one selected package can be committed before investigation;
- a versioned hidden prompt and structured output contract exist in RPG GM Runtime;
- a prepared intro projection can produce a public opening scene;
- optional player-private hooks remain correctly scoped;
- runtime handoff data remains absent from GameFrame player projections;
- deterministic fallback output is stable across exact retry;
- the deterministic fixture is explicitly non-canonical;
- the opening works with text and placeholder presentation only;
- the intro ends with credible approaches plus freeform action support;
- the broader campaign-compiler implementation remains deferred.

## Deferred work

Later implementation may add:

- one-line concept, form, and interview normalization;
- plot-agent package generation and validation;
- richer catalog selection and weighting;
- package persistence migrations;
- campaign preview and confirmation UI;
- arbitrary-theme translation;
- generated image, animation, music, narration, and voice materialization.

Those items must follow `rpg-campaign-compiler-contract.md`. They are not prerequisites for the current starter catalog and intro.

## Governing rule

> Maintain several approved starter possibilities, commit one package per run, let the DM adapt around the players, and never mistake a deterministic fixture for the Monster Master story.
