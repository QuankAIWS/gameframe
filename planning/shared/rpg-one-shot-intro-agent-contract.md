---
title: RPG Campaign Opening and Dungeon Master Contract
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - campaign openings
shared_document_id: rpg-one-shot-intro-agent-contract-v1
shared_document_version: 4
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-one-shot-intro-agent-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-one-shot-intro-agent-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-platform-roadmap.md
  - rpg-campaign-compiler-contract.md
  - rpg-event-and-plot-pool-contract.md
  - rpg-monster-master-reference-campaign.md
---

# RPG Campaign Opening and Dungeon Master Contract

## Compatibility note

The filename and shared document ID retain the older `intro-agent` wording for link compatibility. This document does **not** define a third agent.

A campaign opening is the first turn of the ordinary Dungeon Master after a validated CampaignPackage has been accepted and committed.

## Required preconditions

Before the opening, RPG GM Runtime must have:

- a valid CampaignPackage identity and version;
- a committed player-safe premise;
- committed runtime-only campaign truth;
- participating players and characters;
- starting location and group-cohesion state;
- relevant actors, motives, clues, event eligibility, pressure, and forbidden retcons;
- semantic asset roles and deterministic fallbacks;
- package provenance and hash.

The Dungeon Master must not receive only a raw premise and be expected to invent the missing campaign foundation.

## Dungeon Master opening responsibility

The Dungeon Master produces an opening that:

1. establishes where the party is and why it can act together;
2. presents an immediate concrete situation;
3. introduces relevant actors without making a guide solve the problem;
4. provides enough sensory, social, practical, and campaign-specific information to act;
5. reaches player agency quickly;
6. accepts arbitrary plausible freeform action;
7. may offer illustrative suggestions without closing the action space;
8. follows package tone and content boundaries;
9. avoids forcing tactical play before package state supports it;
10. keeps hidden causes, actors, clue relationships, prompts, and runtime notes private;
11. works through text and deterministic placeholders when media is unavailable;
12. ends at a clean player decision.

The same Dungeon Master output contract and publication path continue after the opening.

## Live-play authority

The Dungeon Master owns:

- narration and dialogue;
- scene framing and pacing;
- freeform intent interpretation;
- compatible local detail;
- eligible event selection;
- NPC reactions and continuity;
- consequences within the package;
- requests for checks and tactical encounters.

It may not:

- replace package truth;
- select a different plot because players guessed correctly;
- move or invent decisive evidence to force pacing;
- make an incidental NPC the hidden culprit unless the package left the role open;
- expose runtime-only information;
- treat suggestions as a dialogue tree;
- decide authoritative tactical outcomes.

## Audience scopes

Dungeon Master results may include:

### Public or party scene

- title;
- narration;
- dialogue;
- current situation;
- player-safe consequences;
- optional suggestions;
- semantic presentation references.

### Player-private material

- expertise-based observations;
- private memories or relationships;
- player-specific temptations or concerns;
- correctly scoped discovered information.

Private material must not reveal hidden truth merely to create artificial player importance.

### Runtime-only continuity

- facts established by the turn;
- current pressure and timing;
- eligible events;
- clue availability and discovery state;
- withheld secrets;
- NPC and relationship changes;
- continuity constraints for the next turn.

Runtime-only continuity must never appear in ordinary GameFrame projections, player exports, or recaps before discovery.

## Monster Master application

Monster Master openings use the same contract as every other package.

The handcrafted Monster Master gold-standard package supplies the opening situation, campaign truth, actors, clues, events, tactical thresholds, tone, and asset intents. The Dungeon Master realizes those materials around the players.

No Monster Master-specific intro service, provider orchestration path, result schema, idempotency system, or GameFrame publication path is permitted.

## Deterministic testing

Provider-free tests may use a deterministic package and mock Dungeon Master provider. The fixture must be explicitly noncanonical.

Tests must prove:

- package commitment precedes the opening;
- the Dungeon Master receives relevant package context;
- public and private scopes remain correct;
- hidden truth does not leak through complete, partial, or paraphrased forms;
- freeform actions are accepted;
- exact retry does not call the provider twice or duplicate events;
- restart reuses committed package and turn state;
- the campaign continues through the same Dungeon Master after the opening.

A canned opening alone does not prove a working Dungeon Master.

## Acceptance criteria

The opening path is complete when:

- a validated CampaignPackage is durably committed;
- the ordinary Dungeon Master generates the first scene;
- the ordinary Dungeon Master handles later turns;
- package invariants remain unchanged;
- audience scopes are enforced;
- freeform action remains primary;
- deterministic fallback and mock-provider tests use the same package and output boundaries;
- the multi-turn campaign harness proves continuity beyond the opening.

## Governing rule

> Commit the campaign first, then let the one Dungeon Master open and continue it without creating another agent or execution path.
