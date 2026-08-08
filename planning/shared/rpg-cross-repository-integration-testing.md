---
title: RPG Cross-Repository and Agent-System Testing
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GitHub Actions
  - campaign agent validation
  - VM staging validation
  - later Cloudflare and media validation
shared_document_id: rpg-cross-repository-integration-testing-v1
shared_document_version: 6
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-cross-repository-integration-testing.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-cross-repository-integration-testing.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-platform-roadmap.md
  - rpg-platform-product-goals.md
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Cross-Repository and Agent-System Testing

## Decision

The RPG platform uses separate evidence layers for package structure, durable world state, Dungeon Master behavior, GameFrame conformance, actual integration, persistence/restart, complete campaign behavior, browser experience, deployment, Campaign Architect behavior, and optional media/cloud migration.

Each layer claims only what it executes.

A catalog-shape test does not prove an executable CampaignPackage. A model/provider stub does not prove Dungeon Master quality. A transport round trip does not prove a campaign. A browser return link does not prove that Arena aftermath was consumed and narrative input authoritatively resumed. A single-player campaign does not prove multiplayer audiences or cooperative control. A VM tunnel does not prove generated media or Cloudflare-native persistence.

The shared roadmap controls implementation order. In particular, **Campaign Architect generation is deliberately deferred until two materially different handcrafted packages prove the common runtime abstraction.**

## Ownership

RPG GM Runtime owns:

- CampaignPackage tests;
- entity/scene/knowledge tests;
- Character Factory tests;
- Dungeon Master machine-play tests;
- future Campaign Architect tests;
- mock GameFrame ports;
- checkout and execution of public GameFrame for private cross-repository integration;
- durable runtime and two-service integration;
- shared-document drift verification.

GameFrame owns:

- GameFrame unit, service, contract, browser, visual, Worker, and encounter tests;
- shared fixture validation;
- player-safe package preview and projection tests;
- People/current-scene/Act-Speak/Ask-GM browser behavior;
- deterministic stub-runtime behavior;
- public repository runner and secret-safety policy.

## Testing ladder

### Layer 1 — CampaignPackage schema and persistence

Prove:

- package bounds and reference integrity;
- player-safe/runtime-only separation;
- package validation, hash, provenance, commitment, reload, and migration posture;
- handcrafted origin metadata;
- initial entity/scene/knowledge bootstrap material where required;
- exact retry and restart.

Required fixtures include the handcrafted Monster Master package plus malformed/contradictory packages and secret-projection attacks.

### Layer 2 — Entity, Scene, Character Factory, and Knowledge behavior

Prove deterministically:

- package actors/roster entities normalize to stable entity identities;
- one incidental-character request materializes exactly one stable entity;
- materialization, scene admission, and initial authorized awareness commit atomically/idempotently for one semantic turn;
- conflicting request-ID reuse fails;
- current physical scene membership survives restart;
- absent entities cannot physically act without explicit remote-contact authority;
- viewer-specific descriptor/role/name progression updates the same entity;
- unknown entity existence remains omitted;
- semantic known-fact records retain provenance and can evolve/correct without accumulating contradictory display prose as authority.

### Layer 3 — Dungeon Master machine-play

Use a mock Dungeon Master provider and scripted players against committed CampaignPackages.

Required player behaviors include expected investigation/cooperation, chaotic action, refusal, early correct guess, missed clue, avoidant/deceptive approaches, Ask-GM queries, and incidental NPC creation/revisit.

Prove across multiple turns:

- package truth never changes;
- freeform action remains primary;
- Act/Speak and Ask-GM remain distinct causes;
- only eligible events are selected;
- NPC/entity identity, scene presence, promises, injuries, debts, and relationships persist;
- public/party/player-private/runtime-only scopes remain correct;
- complete, partial, paraphrased, and hidden-name secrets do not leak to safe renderer input;
- exact retry does not call the decision provider twice or duplicate semantic events;
- restart/resume preserves continuity;
- campaign reaches a valid resolution or tactical threshold.

### Layer 4 — Runtime mock GameFrame port

Use a deterministic fake GameFrame connector for fast runtime development.

Cover authenticated attachment, commands, audience-scoped presentation, People/current-scene projections, Ask-GM responses, checks, entity inspection, encounter proposals, exact retry/conflicts/stale revisions, malformed/unavailable responses, and structured tactical outcomes.

This layer proves runtime behavior against the contract, not actual GameFrame implementation.

### Layer 5 — Shared contract fixtures

Both repositories consume canonical versioned fixtures for the features they jointly implement.

The fixture set must expand as the durable-world slices land to cover at least:

- current-scene projection;
- Known People projection and descriptor→role→name upgrade;
- Act/Speak and Ask-GM command semantics;
- presentation origin separate from audience;
- entity inspection authorization;
- encounter source scene identity/revision/digest;
- encounter participant/role/objective projection;
- structured escape/withdrawal outcomes once supported.

Neither repository imports the other's private implementation.

### Layer 6 — Actual GameFrame Node integration

A runtime-owned job checks out the real public GameFrame repository, records the exact resolved SHA, installs repository-pinned dependencies, starts the real local server, and runs focused integration against actual routes and service behavior.

Prove actual serialization/validation, command custody, runtime result linkage, viewer projections, real Arena launch and outcome, campaign return presentation, and current GameFrame `main` compatibility or reviewed coordinated-branch compatibility.

### Layer 7 — Durable local two-service integration

Run both services with production-shaped separate persistence.

Cover separate databases/migrations, authenticated private service calls, package/journal/command/outcome persistence, restart/lost-response recovery, backup/restore, no cross-service storage access, and encounter lifecycle through authoritative aftermath.

### Layer 8 — Complete single-player Monster Master engineering proof

The first complete journey intentionally uses one authenticated human plus Monster Master BattleBot.

Required journey:

```text
validated handcrafted Monster Master CampaignPackage
  -> package commitment
  -> entity/scene/knowledge initialization
  -> one authenticated player attachment
  -> Dungeon Master opening from committed state
  -> several real Act/Speak turns
  -> at least one Ask-GM query with no fictional speech side effect
  -> People/name progression and incidental NPC revisit
  -> clue/event/check progression
  -> real scene-derived Arena request
  -> actual tactical match against Monster Master BattleBot
  -> exact structured terminal outcome
  -> runtime world/scene reconciliation
  -> Dungeon Master aftermath publication
  -> campaign composer/input authoritatively unlocks
  -> campaign reaches bounded engineering resolution
  -> both services restart
  -> player resumes without duplication, leakage, or package drift
```

The claimed journey must use configured production composition and actual GameFrame match authority. It must not fabricate terminal encounter events, use in-memory completion shortcuts, or accept navigation back to the RPG page as proof that aftermath completed.

### Layer 9 — Second handcrafted package generality proof

Before Campaign Architect implementation, a materially different second handcrafted package must run through the same validator, Entity Registry, Scene Registry, Knowledge projection, Dungeon Master path, GameFrame presentation, and tactical handoff where relevant.

If it requires a campaign-specific Dungeon Master control path or breaks the generic durable-world model, repair the abstraction before automating campaign generation.

### Layer 10 — Multiplayer integration and two-human acceptance

After the single-player and second-package architecture is stable enough, prove campaign join/party lifecycle, viewer-divergent knowledge, public/party/player-private presentation, cooperative tactical control, reconnect, and restart for two authenticated humans.

### Layer 11 — Browser campaign acceptance

Use real browser journeys for package preview/confirmation, campaign resume, Act/Speak and Ask-GM, People/current-scene/entity inspection, public/private scenes, character/creature/clue/objective views, Arena transition and authoritative return, desktop/mobile interaction, reconnect, and text-first fallback.

For campaign-bound Arena battles, browser acceptance must assert that generic standalone actions such as `New Duel`/`Return Home` are not offered as the primary terminal path and that `Return to Campaign` resumes only after authoritative aftermath state permits it.

A screenshot supports presentation evidence but does not replace state assertions.

### Layer 12 — VM, Cloudflare edge, and Discord canary

A staging VM proves production topology, Cloudflare routing to GameFrame only, real authentication, public-network play without VPN, service/browser restart/resume, private projection enforcement, actual Monster Master campaign/Arena return, backup/restore, and that stopping the tunnel removes public reachability.

Repository tests cannot claim this evidence.

### Layer 13 — Campaign Architect behavior

Only after Layers 8 and 9 prove the common runtime abstraction, add deterministic/mock Campaign Architect behavior tests for brief normalization, assumptions/repair, originality transformation, package completeness, capability compatibility, validation repair, reproducibility where required, and owner-refinable draft lifecycle.

Then add a generated-package full journey through the same validator/entity/scene/knowledge/Dungeon Master/GameFrame harness.

### Layer 14 — Media and optional Cloudflare-native validation

Media canaries prove catalog reuse, deterministic composition, queued generation, validation/moderation/provenance, placeholders, recurring identity continuity, budgets, caching, and failure behavior.

Cloudflare-native state tests are required only for an active migration.

## Coordinated branch policy

During active co-development:

1. update canonical GameFrame shared documents or fixtures;
2. run focused GameFrame checks;
3. test the runtime branch against the trusted GameFrame branch;
4. merge GameFrame canonical changes;
5. synchronize exact-byte runtime mirrors;
6. rerun runtime checks against GameFrame `main`;
7. merge runtime changes.

Private runtime workflows must not execute arbitrary fork or public pull-request code alongside private source or secrets.

## Trigger policy

Ordinary runtime PRs run focused runtime tests, shared fixture validation, shared-document drift, and affected current-GameFrame integration.

Package, entity, scene, knowledge, Character Factory, Dungeon Master, clue, event, NPC, or tactical changes must run the relevant machine-play journeys. Persistence/deployment changes run durable integration. Browser changes run focused player journeys. VM/provider claims require explicit canaries.

## Diagnostics

Preserve bounded evidence including exact GameFrame/runtime SHAs, package/schema/contract versions, package hash/provenance, scripted player profile/turn at failure, stable error codes/revisions, source scene/revision for encounter compilation, retry/restart/outcome/backup receipts, and browser traces only for browser journeys.

Do not place runtime-only package truth or credentials in ordinary artifacts.

## Acceptance criteria

The testing system is established when:

1. Monster Master and a materially different second handcrafted package pass the same validator and durable-world substrate;
2. Dungeon Master machine-play proves multiple turns, entity/scene/knowledge continuity, and two handcrafted packages;
3. secret/name, plot-drift, NPC-continuity, missed-clue, Ask-GM, retry, and restart cases pass;
4. both repositories validate the same versioned shared fixtures;
5. actual GameFrame integration exercises real routes and Arena Battles;
6. durable integration survives restarts and backup/restore;
7. the one-human-plus-BattleBot full-stack campaign proves authoritative aftermath and campaign unlock without fabricated tactical outcomes;
8. browser tests prove People/current-scene/interaction semantics and campaign-specific tactical terminal UX;
9. multiplayer evidence is added separately;
10. Campaign Architect is implemented and tested only after the two handcrafted campaigns prove the common abstraction;
11. VM canaries prove public routing/private-origin posture;
12. media/cloud-native claims remain isolated to their own evidence layers;
13. no player journey depends on Tailscale or router forwarding.

## Governing rule

> Prove package truth, durable entities/scenes/knowledge, Dungeon Master behavior, real GameFrame integration, authoritative Arena return, generality across two handcrafted campaigns, browser/deployment behavior, and only then automated campaign construction—never describe a lower evidence layer as proof of a higher one.
