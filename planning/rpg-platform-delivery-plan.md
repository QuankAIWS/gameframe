---
title: RPG Platform Delivery Plan
status: active
document_type: repository-plan
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime-integration
depends_on:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-platform-roadmap.md
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
related:
  - shared/rpg-campaign-compiler-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-cross-repository-integration-testing.md
  - tactical-battler-rpg-foundation.md
---

# RPG Platform Delivery Plan

## Authority

`shared/rpg-platform-roadmap.md` is the controlling cross-repository roadmap. This document maps GameFrame responsibilities onto that roadmap and must not reorder its milestones.

The product architecture is:

```text
campaign brief or handcrafted campaign
        ↓
Campaign Architect or manual authoring
        ↓
validated CampaignPackage
        ↓
Dungeon Master
        ↓
GameFrame player experience and authoritative mechanics
```

Monster Master is the handcrafted gold-standard CampaignPackage. It is not a separate platform or a special Dungeon Master path.

## Current GameFrame foundation

GameFrame already contains substantial infrastructure:

- durable campaign membership and audience-scoped projections;
- durable command acceptance and runtime delivery custody;
- runtime event linkage and separate coordination, presentation, and narrative positions;
- authenticated HTTP boundaries and Cloudflare edge gateway;
- a text-first Monster Master RPG campaign shell with freeform input;
- durable encounter authority and Arena Battles integration contracts;
- VM process and deployment material.

This infrastructure is useful but does not constitute a complete CampaignPackage, Campaign Architect, Dungeon Master, or playable campaign.

## GameFrame work by roadmap milestone

### Milestone 1 — Executable CampaignPackage contract

GameFrame must provide:

- versioned mechanic and presentation capability declarations;
- player-safe package preview primitives;
- audience-safe campaign metadata projection;
- deterministic text, card, silhouette, terrain, and media fallbacks;
- contract fixtures shared with RPG GM Runtime.

GameFrame does not store or expose the runtime-only package bible.

### Milestone 2 — Monster Master gold-standard package

GameFrame must supply or validate:

- stable Monster Master semantic asset roles;
- prepared and fallback trainer, NPC, creature, location, prop, terrain, effect, and UI assets;
- player-facing package preview and campaign selection presentation;
- the Arena Battles capabilities required by the package.

GameFrame does not select hidden cause, actors, clue answers, or event eligibility.

### Milestone 3 — Package-aware Dungeon Master

GameFrame must:

- accept authenticated freeform player actions;
- deliver them to runtime with stable identity and revision provenance;
- project committed Dungeon Master events to correct audiences;
- preserve suggestions as editable, non-exhaustive inspiration;
- display structured checks and tactical readiness without parsing prose for authority.

### Milestone 4 — Machine-play harness

GameFrame must provide deterministic adapters or fixtures for:

- public, party, and player-private projections;
- check requests and outcomes;
- encounter launch and terminal outcome;
- reconnect, restart, and exact retry;
- text-first rendering of scripted campaign events.

The campaign-behavior harness is runtime-owned, while GameFrame conformance and browser projection tests remain GameFrame-owned.

### Milestone 5 — Checks, events, and tactical handoff

Promote only mechanics required by the first Monster Master package:

- deterministic noncombat check authority;
- player-visible clue, objective, condition, and consequence projections where required;
- encounter launch from a validated runtime request;
- Arena Battles terminal outcome custody;
- outcome return to runtime and resumed campaign presentation.

### Milestone 6 — Playable Monster Master

Complete the GameFrame player product needed for the bounded campaign:

- campaign creation or selection;
- invitations, membership, and resume;
- scene, dialogue, character, creature, clue, quest, condition, objective, and recap views required by the package;
- freeform action submission;
- audience-scoped presentation;
- desktop and mobile behavior;
- reconnect and later-session resume;
- text-only operation when media is absent.

### Milestone 7 — Campaign Architect

GameFrame must add only the player-facing and capability surfaces required by the Campaign Architect:

- concise concept submission;
- player-safe assumptions and repair questions;
- package preview and confirmation;
- prepared mechanic and presentation capability declarations;
- operator-authorized diagnostics that do not expose hidden package truth to ordinary players.

### Milestone 8 — Rich intake

Add:

- structured campaign sheets;
- guided GameFrame creation;
- optional Discord interview integration through authenticated boundaries;
- draft, review, amendment, and explicit recompilation flows.

### Milestone 9 — Media materialization

GameFrame owns:

- asset catalogs and deterministic composition;
- provider-neutral prompt compilation;
- Cloudflare-backed or other configured image generation;
- validation, moderation, provenance, budgets, caching, storage, and replacement;
- stable recurring asset identities;
- immediate placeholder and text fallbacks.

The Campaign Architect declares semantic requirements. The Dungeon Master consumes accepted identities.

### Milestone 10 — Multi-session and operations

Add only systems proven necessary by playable campaigns, including progression, inventory, recovery, recurring quests, campaign inspection, backup, restore, retention, observability, Theo player integration, and rollout controls.

## Deployment posture

The first production topology remains:

- GameFrame and RPG GM Runtime as separate services on one VM;
- Cloudflare exposes GameFrame only;
- RPG GM Runtime, databases, and administration remain private;
- no router application port forwarding;
- no player VPN requirement.

Deployment defects that block campaign development or testing should be fixed. Additional hardening and Cloudflare-native state migration do not outrank the executable package and agent milestones.

## Validation posture

Use the correct evidence layer:

- GameFrame unit and contract tests for authority and projections;
- shared fixtures for cross-repository schema stability;
- runtime machine-play for Dungeon Master behavior;
- actual GameFrame Node integration for real contract behavior;
- browser tests for player experience;
- VM canaries for public deployment claims;
- media-specific canaries for generation claims.

Do not describe infrastructure round trips or scripted presentation as a working campaign.

## Priority rule

GameFrame work should support this order:

1. CampaignPackage contract;
2. Monster Master gold-standard package;
3. package-aware Dungeon Master;
4. machine-play proof;
5. complete Monster Master campaign journey;
6. Campaign Architect generated campaign;
7. richer intake and media;
8. broader systems and operational polish.

## Governing rule

> Build the GameFrame surfaces and authority needed by the shared roadmap, but do not let infrastructure or presentation work obscure the two-agent campaign system it exists to serve.
