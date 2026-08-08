---
title: RPG GM Runtime Boundary
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime
related:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-campaign-experience-directions.md
  - rpg-gameframe-interface-contract.md
---

# RPG GM Runtime Boundary

## Decision

RPG GM Runtime is a separate project and service. It is not hosted, configured, spawned, supervised, or persisted by Scribbles Runtime.

RPG GM Runtime contains two specialized agent capabilities:

- **Campaign Architect** — creates validated CampaignPackage drafts before ordinary play;
- **Dungeon Master** — runs committed CampaignPackages through live freeform play.

It also owns deterministic campaign substrate that is not a third agent: Entity Registry, Character Factory, Scene Registry, semantic knowledge/player projections, Dungeon Master Context Compiler, typed campaign-operation validators, and Encounter Scene Compiler.

GameFrame is the complete player-facing RPG application. Scribbles Runtime owns Theo and only the connector required for Theo to participate as an ordinary GameFrame player.

## System flow

```text
player concept, owner specification, sheet, or prepared campaign
        ↓
GameFrame authenticated intake
        ↓
Campaign Architect in RPG GM Runtime OR manual authoring
        ↓
validated CampaignPackage draft
        ↓ optional owner refinement
explicit package commitment
        ↓
Entity / Scene / Knowledge initialization
        ↓
Dungeon Master in RPG GM Runtime
        ↕
GameFrame player presentation and authoritative mechanics
```

A handcrafted package such as Monster Master bypasses Campaign Architect generation, not validation, commitment, durable-world initialization, Dungeon Master consumption, or GameFrame authority.

## GameFrame ownership

GameFrame owns:

- browser and Discord Activity interfaces;
- campaign creation, package preview, confirmation, joining, invitations, seats, and resume;
- authenticated player commands and server-derived principals;
- player-visible scene/narration/dialogue presentation;
- viewer-safe People/current-scene/entity inspection;
- distinct Act/Speak and Ask-GM interaction surfaces;
- audience-scoped player projections;
- mechanics deliberately implemented as GameFrame authority;
- Arena Battles rules, legal actions, turns, replay, persistence, reconnect, terminal outcomes, and campaign-bound terminal UX;
- semantic asset resolution, media generation, validation, provenance, storage, caching, delivery, and fallback;
- responsive layout, animation, accessibility, and client interaction.

GameFrame does not own the hidden CampaignPackage bible, Campaign Architect prompts, Dungeon Master hidden context, hidden motives, clue answers, event eligibility, canonical hidden entity names, or runtime scene/knowledge authority.

## RPG GM Runtime ownership

### Campaign Architect

RPG GM Runtime owns:

- campaign brief normalization;
- CampaignPackage schemas and validation;
- originality transformation;
- package generation, repair, hashing, provenance, persistence, migration, and commitment;
- hidden campaign bible, actors, motives, clues, events, escalation, resolutions, and semantic asset intents;
- package projection into player-safe preview and runtime initialization.

Campaign Architect remains deferred until two materially different handcrafted packages prove the common runtime abstraction.

### Durable runtime substrate

RPG GM Runtime owns:

- authoritative campaign journal and runtime narrative revision;
- stable campaign entity identity;
- Character Factory materialization of bounded incidental people;
- zero-or-more active scene projections and explicit physical membership;
- sparse semantic knowledge records and viewer-specific People/identity projections;
- deterministic event/mechanic/operation validation;
- scene-to-encounter semantic compilation;
- reconciliation of structured GameFrame outcomes into world/scene truth.

These are services/projections over package+journal authority, not autonomous campaign agents.

### Dungeon Master

RPG GM Runtime owns:

- interpretation of freeform player intent;
- hidden semantic decisions from typed current-state context;
- narration intent and NPC portrayal;
- pacing and eligible event selection;
- package-compatible consequences through validated operations;
- requests for incidental people, checks, media, and tactical encounters;
- mapping committed GameFrame outcomes into narrative aftermath;
- provider routing, validation, retries, fallback, and recovery.

The Dungeon Master does **not** directly mint durable incidental NPC IDs, infer physical scene presence from prose, reveal canonical identity without knowledge authorization, or replace authoritative mechanic/tactical outcomes.

Model output is not campaign truth until validated and committed.

## Scribbles Runtime ownership

Scribbles Runtime owns:

- Theo's model behavior and lifecycle;
- translation of Theo's authorized GameFrame observation into Theo context;
- submission of Theo's selected legal GameFrame command;
- connector correlation, authorization, timeout, and fallback.

Scribbles Runtime does not own CampaignPackages, campaign state, Campaign Architect prompts, Dungeon Master context, NPC memory, scenes, player knowledge, quests, or RPG orchestration.

## Contract rules

- No direct database, queue, prompt, secret, or lifecycle access across repositories.
- CampaignPackage origin does not select a different Dungeon Master path.
- RPG GM Runtime uses a dedicated service principal and never impersonates a player.
- Player identity comes from authenticated GameFrame context.
- Contracts are versioned, bounded, validated, idempotent, audience-scoped, and recoverable.
- GameFrame consumes semantic events/projections, not runtime-authored browser code.
- Runtime consumes structured mechanics and tactical outcomes, not combat prose.
- Runtime-only package/entity/scene/knowledge data never enters ordinary browser projections.
- Generated media does not become campaign authority.
- Ask-GM fictional audibility and presentation audience remain explicit and separate.
- Campaign encounter launch carries source-scene provenance and fails closed on stale/unsupported combat-relevant state.

## Development consequences

- Preserve the executable CampaignPackage and staging path.
- Implement Entity Registry → Character Factory → Scene Registry → semantic Knowledge/People projection before relying on model memory for continuity.
- Rebuild the hidden-decision/player-safe-render split over those safe projections.
- Add Act/Speak versus Ask-GM and explicit presentation origin.
- Make event/typed-domain authority deterministic where the reference campaign requires it.
- Evolve Monster Master tactical handoff from current creature-only fidelity toward scene fidelity, starting with escape/withdrawal and authoritative campaign return.
- Prove Monster Master, then a materially different second handcrafted package, before implementing Campaign Architect generation.
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

> Runtime authors and runs campaigns through two specialized agents, but durable world substrate owns identity, scene, knowledge, and semantic continuity; GameFrame presents that world and owns deterministic mechanics; Scribbles Runtime only lets Theo play.
