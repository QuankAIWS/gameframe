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
shared_document_version: 1
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-one-shot-intro-agent-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-one-shot-intro-agent-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-campaign-compiler-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-rendering-and-asset-contract.md
  - rpg-cross-repository-integration-testing.md
  - ../monster-master-rpg-lore-and-story.md
---

# RPG One-Shot Intro Agent Contract

## Decision

The long-term campaign-compiler direction is accepted and preserved, but its implementation is deferred.

The current bounded delivery is a Monster Master one-shot intro capability for the RPG GM Runtime. It gives the DM agent enough hidden context and structured instructions to open the first playable session coherently, then hand control to the ordinary live GM loop.

This slice does not build the general campaign compiler, interactive campaign interview, arbitrary-theme generator, campaign-package persistence system, or generated-media pipeline.

## Durable ownership

The product idea must remain durable in the repositories even while implementation is deferred.

- GameFrame owns this cross-repository contract, the player-facing presentation boundary, deterministic placeholders, and the Monster Master presentation and asset vocabulary.
- RPG GM Runtime owns the hidden DM prompt bundle, intro context, incident truth, private hooks, continuity handoff, and runtime-only validation.
- `rpg-campaign-compiler-contract.md` remains the controlling future direction for converting one-line ideas, forms, and interviews into complete campaign packages.
- `rpg-monster-master-reference-campaign.md` remains the controlling reference-campaign architecture.
- `monster-master-rpg-lore-and-story.md` remains the canonical Monster Master setting and tone record.

Future implementation agents must extend these contracts rather than reconstructing the design from chat history.

## Current intro objective

The intro should move a player group from campaign launch to a clear first decision without requiring generated art, audio, or a completed campaign compiler.

The DM agent receives one prepared intro context containing:

- campaign and intro identity;
- participating players and any known role or starter-creature information;
- the starting location and veteran guide role;
- a public premise and immediate anomaly;
- a committed runtime-only incident cause;
- forbidden early reveals;
- required clue identifiers or evidence roles;
- two or more valid initial approaches;
- available prepared asset IDs and deterministic fallback labels;
- tone and content boundaries.

The incident cause and other hidden fields are campaign truth for the one-shot. The intro may frame them but must not alter or expose them.

## Required intro behavior

The DM agent must produce an opening that:

1. establishes where the party is and why its members are acting together;
2. introduces the veteran guide or field supervisor without making that NPC solve the problem;
3. presents an immediate, concrete anomaly or assignment;
4. gives the players enough sensory and social information to act;
5. offers at least two reasonable initial approaches while still accepting freeform actions;
6. preserves the funny fantasy-adventure tone through dry situational humor rather than parody or slapstick;
7. avoids forcing a tactical encounter before player action supports one;
8. avoids revealing the committed cause, culprit, hidden motive, or unrevealed clue relationships;
9. remains fully presentable through text and deterministic placeholders;
10. ends at a clean player decision point rather than narrating the players' decision for them.

## Runtime output contract

The runtime-only DM result contains three scopes.

### Public scene

GameFrame may project:

- original scene title;
- bounded narration;
- immediate situation;
- two to four suggested approaches;
- prepared asset IDs or fallback labels;
- a clear invitation for freeform action.

Suggested approaches are examples, not a closed menu unless GameFrame deliberately presents a bounded choice.

### Player-private hooks

The DM may produce zero or one short private hook for each participating player when the prepared context supports it. A hook may reference personal expertise, a noticed detail, an existing relationship, or a private concern.

Private hooks must not reveal the hidden incident cause merely to make a player feel special.

### Runtime handoff

The player-invisible handoff records:

- facts established by the intro;
- current pressure and timing state;
- eligible next beat identifiers;
- clues made available but not necessarily discovered;
- secrets that remain withheld;
- continuity constraints for the next live GM turn.

GameFrame must never include this handoff in ordinary player projections, exports, logs intended for players, or recaps before discovery.

## Prompt boundary

The prompt bundle is runtime-owned, versioned, and not player-visible.

It must instruct the DM agent to:

- treat the supplied context as authoritative;
- produce only the defined structured output;
- distinguish public, player-private, and runtime-only information;
- avoid private reasoning or hidden instructions in output fields;
- avoid inventing unsupported mechanics or generated-media dependencies;
- use prepared assets when supplied and deterministic fallbacks otherwise;
- maintain originality and avoid direct copying of protected settings or characters;
- return a structured error when the context is internally contradictory or missing required identities.

Only the prompt version may be recorded in player-safe or general operational metadata. Raw hidden instructions must not be projected.

## Deterministic fallback

A provider-free fallback must be available for tests and degraded operation.

The fallback may use prepared Monster Master text and the supplied public anomaly. It must:

- produce stable output for identical context;
- create the same audience separation as the model-backed path;
- never include runtime-only causes or forbidden reveals in GameFrame events;
- require no image, audio, animation, or external model provider;
- end at the same first-decision boundary expected from the DM agent.

The fallback is not the final authored story. It is a reliable bridge for GameFrame presentation and integration testing.

## Acceptance criteria

This bounded slice is complete when:

- a versioned hidden prompt and structured output contract exist in RPG GM Runtime;
- a prepared Monster Master intro context can produce a public opening scene;
- optional player-private hooks remain correctly scoped;
- runtime handoff data remains absent from GameFrame player projections;
- deterministic fallback output is stable across exact retry;
- the opening works with text and placeholder presentation only;
- the intro ends with at least two credible approaches plus freeform action support;
- the broader campaign-compiler implementation remains explicitly deferred.

## Deferred work

A later implementation agent may build:

- one-line concept, form, and interview normalization;
- full campaign spine and special-event-pool generation;
- compiled campaign package persistence and migration;
- campaign preview and confirmation UI;
- arbitrary-theme translation;
- generated image, animation, music, narration, and voice materialization.

Those items must follow `rpg-campaign-compiler-contract.md`. They are not prerequisites for the current one-shot intro.

## Governing rule

> Preserve the full campaign-compiler direction in durable contracts, but implement only the hidden Monster Master DM intro needed to reach the first meaningful player decision through GameFrame.
