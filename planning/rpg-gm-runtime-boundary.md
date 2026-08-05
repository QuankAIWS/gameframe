---
title: RPG GM Runtime Boundary
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime
related:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-platform-roadmap.md
  - rpg-campaign-experience-directions.md
  - rpg-gameframe-interface-contract.md
---

# RPG GM Runtime Boundary

## Decision

RPG GM Runtime is a separate project and service. It is not hosted, configured, spawned, supervised, or persisted by Scribbles Runtime.

RPG GM Runtime contains two specialized agent capabilities:

- **Campaign Architect** — creates validated CampaignPackages before ordinary play;
- **Dungeon Master** — runs committed CampaignPackages through live freeform play.

GameFrame is the complete player-facing RPG application. Scribbles Runtime owns Theo and only the connector required for Theo to participate as an ordinary GameFrame player.

## System flow

```text
player concept, owner specification, sheet, or interview
        ↓
GameFrame authenticated intake
        ↓
Campaign Architect in RPG GM Runtime
        ↓
validated CampaignPackage
        ↓
Dungeon Master in RPG GM Runtime
        ↕
GameFrame player presentation and authoritative mechanics
```

A handcrafted package such as Monster Master enters at the CampaignPackage boundary and bypasses Campaign Architect generation, not validation or commitment.

## GameFrame ownership

GameFrame owns:

- browser and Discord Activity interfaces;
- campaign creation, package preview, confirmation, joining, invitations, seats, and resume;
- authenticated player commands and server-derived principals;
- player-visible scenes, dialogue, cards, suggestions, checks, characters, inventory, quests, clues, maps, recaps, and encounters;
- audience-scoped player projections;
- mechanics deliberately implemented as GameFrame authority;
- Arena Battles rules, legal actions, turns, replay, persistence, reconnect, and terminal outcomes;
- semantic asset resolution, media generation, validation, provenance, storage, caching, delivery, and fallback;
- responsive layout, animation, accessibility, and client interaction.

GameFrame does not own the hidden CampaignPackage bible, Campaign Architect prompts, Dungeon Master prompts, hidden motives, clue answers, or event eligibility.

## RPG GM Runtime ownership

### Campaign Architect

RPG GM Runtime owns:

- campaign brief normalization;
- CampaignPackage schemas and validation;
- originality transformation;
- package generation, repair, hashing, provenance, persistence, migration, and commitment;
- hidden campaign bible, actors, motives, clues, events, escalation, resolutions, and semantic asset intents;
- package projection into player-safe preview and Dungeon Master context.

### Dungeon Master

RPG GM Runtime owns:

- authoritative campaign journal and runtime narrative revision;
- scene construction, narration, NPC reasoning, and dialogue;
- interpretation of freeform player intent;
- eligible event selection and package-compatible consequences;
- semantic world, relationship, quest, clue, and incidental NPC continuity;
- audience classification;
- requests for checks, media, and tactical encounters;
- mapping committed GameFrame outcomes into campaign consequences;
- context construction, model routing, validation, retries, fallback, and recovery.

Model output is not campaign truth until validated and committed.

## Scribbles Runtime ownership

Scribbles Runtime owns:

- Theo's model behavior and lifecycle;
- translation of Theo's authorized GameFrame observation into Theo context;
- submission of Theo's selected legal GameFrame command;
- connector correlation, authorization, timeout, and fallback.

Scribbles Runtime does not own CampaignPackages, campaign state, Campaign Architect prompts, Dungeon Master context, NPC memory, quests, or RPG orchestration.

## Contract rules

- No direct database, queue, prompt, secret, or lifecycle access across repositories.
- CampaignPackage origin does not select a different Dungeon Master path.
- RPG GM Runtime uses a dedicated service principal and never impersonates a player.
- Player identity comes from authenticated GameFrame context.
- Contracts are versioned, bounded, validated, idempotent, audience-scoped, and recoverable.
- GameFrame consumes semantic events, not runtime-authored browser code.
- Runtime consumes structured mechanics and tactical outcomes, not combat prose.
- Runtime-only package data never enters ordinary browser projections.
- Generated media does not become campaign authority.

## Development consequences

- Define and implement the CampaignPackage boundary before broadening agent behavior.
- Handcraft Monster Master as the gold-standard package.
- Prove the Dungeon Master against committed packages with mock providers and scripted players.
- Build the Campaign Architect after the package and Dungeon Master quality bar is known.
- GameFrame builds intake, preview, presentation, mechanics, and assets against versioned contracts and deterministic fixtures.
- Integration occurs through contracts, never shared storage.

## Non-goals

This boundary does not require:

- duplicating Arena Battles in runtime;
- moving hidden campaign truth into GameFrame;
- making Discord the primary campaign interface;
- converting every improvised narrative concept into a dedicated mechanic;
- separate Monster Master and generated-campaign Dungeon Masters;
- a third intro agent;
- live media generation for package logic tests.

## Governing rule

> Runtime authors and runs campaigns through two specialized agents; GameFrame presents them and owns deterministic mechanics; Scribbles Runtime only lets Theo play.
