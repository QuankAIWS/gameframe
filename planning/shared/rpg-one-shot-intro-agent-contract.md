---
title: RPG One-Shot Intro Agent Contract
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG starter experience
shared_document_id: rpg-one-shot-intro-agent-contract-v1
shared_document_version: 2
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

The long-term campaign compiler and plot-agent direction remain accepted, but their general implementation is deferred.

The current bounded delivery uses:

1. one manually authored Monster Master scenario package representing the output a future plot agent should produce;
2. one DM realization capability that uses the language model to open that committed package around the participating players;
3. a structured handoff into the ordinary live GM loop.

The scenario package is causal material, not a numbered scene script. The DM agent should adapt strongly while preserving committed truth.

This slice does not build the general campaign compiler, final plot agent, interactive campaign interview, arbitrary-theme generator, general package persistence and migration, weighted plot selector, or generated-media pipeline.

## Durable ownership

- GameFrame owns this cross-repository contract, player-facing presentation, deterministic placeholders, Monster Master lore direction, semantic asset vocabulary, and asset resolution.
- RPG GM Runtime owns private scenario packages, hidden DM prompts, actor secrets, clue answers, event eligibility, private hooks, continuity state, and runtime-only validation.
- `rpg-campaign-compiler-contract.md` controls future conversion of player ideas, forms, and interviews into complete packages.
- `rpg-event-and-plot-pool-contract.md` controls reusable package, event, clue, consequence, and asset-role shapes.
- `rpg-monster-master-reference-campaign.md` controls the reference-campaign architecture.
- `monster-master-rpg-current-creative-direction.md` and `monster-master-rpg-lore-tone-and-agent-realization.md` control current Monster Master tone and player-agency posture.

Future implementation agents must extend these contracts rather than reconstructing the design from chat history.

## Prepared scenario projection

The DM intro receives a bounded projection of one already committed scenario package containing:

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

The full private package may additionally contain actor goals and secrets, clue relationships, event eligibility, pressure logic, tactical thresholds, resolution constraints, and consequence mappings. The bounded intro projection exposes only what the opening realization needs.

The cause and other committed hidden fields are campaign truth. The DM may frame and dramatize them but must not alter or expose them early.

## Required intro behavior

The DM agent must produce an opening that:

1. establishes where the party is and why its members can act together;
2. introduces the guide or field supervisor without making that NPC solve manageable problems;
3. presents an immediate concrete situation and reaches player agency quickly;
4. gives enough sensory, social, practical, and creature-related information to act;
5. offers two to four illustrative approaches while explicitly accepting plausible freeform action;
6. permits lawful help, investigation, practical work, rule-bending, opportunism, refusal, or unexpected action when supported by the scenario;
7. follows supplied tone boundaries rather than defaulting to dry humor or forbidding slapstick;
8. avoids corporate training-simulation dialogue, morality lectures, forced wholesomeness, forced criminality, constant joke density, and constant crime bait;
9. avoids forcing tactical play before player action and committed state justify a tactical threshold;
10. avoids revealing the cause, culprit, hidden motive, unrevealed clue relationships, raw prompts, or private reasoning;
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
- two to four illustrative approaches;
- prepared asset IDs or fallback labels;
- a clear invitation for freeform action.

### Player-private hooks

The DM may produce zero or one short private hook for each participating player when supported by the context.

A hook may reference:

- expertise;
- creature behavior;
- a noticed detail;
- an existing relationship;
- concern, suspicion, temptation, or personal leverage.

Private hooks must not reveal the committed cause merely to make a player feel special.

### Runtime handoff

The player-invisible handoff records:

- facts established by the intro;
- current pressure and timing state;
- eligible next-beat or event identifiers;
- clues made available but not necessarily discovered;
- secrets that remain withheld;
- continuity and realization constraints for the next GM turn.

GameFrame must never include this handoff in ordinary player projections, player exports, or recaps before discovery.

## DM realization boundary

The DM agent owns:

- narration, dialogue, sensory detail, and NPC performance;
- pacing and the timing of state-compatible events;
- interpretation of freeform player intent;
- adaptation to players, creatures, relationships, locations, and prior actions;
- compatible secondary detail;
- requests for checks, media roles, GameFrame presentation, or Arena Battles handoff.

The DM agent must not:

- replace the committed cause, culprit, or evidence logic;
- treat the package as a mandatory scene sequence;
- invent decisive evidence solely to rescue pacing;
- move decisive evidence merely because players guessed correctly or incorrectly;
- force heroism, criminality, procedural compliance, or combat;
- treat suggested approaches as the complete action space;
- expose runtime-only information;
- contradict established facts or committed tactical outcomes.

## Prompt boundary

The prompt bundle is runtime-owned, versioned, and not player-visible.

It must instruct the DM agent to:

- treat the prepared package projection as authoritative;
- understand that the package is causal material rather than final prose;
- adapt strongly without changing committed truth;
- produce only the defined structured output;
- distinguish public, player-private, and runtime-only information;
- avoid private reasoning or hidden instructions in output fields;
- avoid inventing unsupported mechanics or media dependencies;
- use prepared assets when supplied and deterministic fallbacks otherwise;
- maintain originality and avoid direct copying of protected settings or characters;
- return a structured error when required identities or package facts are contradictory.

Only the prompt version may appear in player-safe or general operational metadata. Raw instructions remain private.

## Deterministic fallback

A provider-free fallback must be available for tests and degraded operation.

It must:

- produce stable output for identical normalized context;
- preserve the same audience separation as the model-backed path;
- never include runtime-only causes or forbidden reveals in GameFrame events;
- require no image, audio, animation, or external model provider;
- provide at least two broad possibilities and explicit freeform action;
- avoid presenting the possibilities as an exhaustive menu;
- end at the same first-decision boundary expected from the DM agent.

The fallback is not the final authored story. It is a reliable bridge for GameFrame presentation and integration testing.

## Acceptance criteria

This bounded slice is complete when:

- a manually authored, private, committed scenario package exists;
- a versioned hidden realization prompt and structured output contract exist in RPG GM Runtime;
- a prepared Monster Master context can produce a public opening;
- optional player-private hooks remain correctly scoped;
- runtime handoff data remains absent from GameFrame player projections;
- deterministic fallback is stable across exact retry;
- the opening works with text and placeholders only;
- broad example approaches and freeform action support survive fallback;
- prompt tests reject secret leakage and stale blanket anti-slapstick behavior;
- the broader plot-agent, compiler, event-engine, and generated-media implementations remain explicitly deferred.

## Deferred work

Later slices may implement:

- full package-state orchestration across GM turns;
- actor and relationship mutation helpers;
- event eligibility and cooldown evaluation;
- tactical request and return application;
- one-line concept, form, and interview normalization;
- plot-agent generation and package validation;
- variable package selection and persistence;
- campaign preview and confirmation UI;
- arbitrary-theme translation;
- generated image, animation, music, narration, and voice materialization.

Those additions must preserve the committed-truth and realization boundaries.

## Governing rule

> Give the DM a committed causal package, use the language model to create the live opening around the players, and preserve truth, privacy, broad agency, natural consequences, and text-first operation.
