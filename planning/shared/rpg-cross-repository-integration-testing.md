---
title: RPG Cross-Repository and Agent-System Testing
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GitHub Actions
  - campaign agent validation
  - VM staging validation
  - later Cloudflare and media validation
shared_document_id: rpg-cross-repository-integration-testing-v1
shared_document_version: 4
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-cross-repository-integration-testing.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-cross-repository-integration-testing.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-platform-roadmap.md
  - rpg-platform-product-goals.md
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Cross-Repository and Agent-System Testing

## Decision

The RPG platform uses separate evidence layers for:

1. CampaignPackage schema and validation;
2. Campaign Architect behavior;
3. Dungeon Master campaign behavior;
4. GameFrame contract conformance;
5. actual cross-repository integration;
6. persistence and restart;
7. browser player experience;
8. VM deployment;
9. media providers and optional Cloudflare-native migration.

Each layer claims only what it executes.

A catalog-shape test does not prove an executable CampaignPackage. A provider stub does not prove Dungeon Master quality. A transport round trip does not prove a campaign. A browser screenshot does not prove authoritative state. A VM tunnel does not prove generated media or Cloudflare-native persistence.

## Ownership

RPG GM Runtime owns:

- CampaignPackage tests;
- Campaign Architect tests;
- Dungeon Master machine-play tests;
- mock GameFrame ports;
- checkout and execution of public GameFrame for private cross-repository integration;
- durable runtime and two-service integration;
- shared-document drift verification.

GameFrame owns:

- GameFrame unit, service, contract, browser, visual, Worker, and encounter tests;
- shared fixture validation;
- player-safe package preview and projection tests;
- deterministic stub-runtime behavior;
- public repository runner and secret-safety policy.

## Testing ladder

### Layer 1 — CampaignPackage schema and persistence

Prove:

- `CampaignPackageV1` bounds and reference integrity;
- player-safe and runtime-only separation;
- package validation;
- package hash and provenance;
- handcrafted and generated origin metadata;
- commitment, reload, migration posture, and immutable identity;
- bounded Dungeon Master context without truncation;
- player-safe preview without hidden truth;
- exact retry and restart.

Required fixtures:

- one complete handcrafted Monster Master package;
- malformed and contradictory packages;
- partial and paraphrased secret-projection attacks;
- a deterministic Campaign Architect output after that agent exists.

### Layer 2 — Campaign Architect behavior

Use a deterministic or mock Campaign Architect provider before a live provider.

Prove:

- concise and structured briefs normalize correctly;
- assumptions and repair requests are explicit;
- originality transformation preserves desired experience without direct copying;
- actors, locations, clues, events, escalation, resolution, and asset intents form a playable package;
- unsupported mechanics are rejected or mapped to available capabilities;
- package validation failures produce bounded repair rather than silent acceptance;
- the same input and seed produce stable fixture output where determinism is required.

Later provider-backed tests add quality evaluation without replacing schema and deterministic evidence.

### Layer 3 — Dungeon Master machine-play

Use a mock Dungeon Master model provider and scripted player actors against committed CampaignPackages.

Required player behaviors include:

- expected investigation or cooperation;
- chaotic or unusual action;
- refusal of the obvious assignment;
- early correct guess;
- missed or ignored clue;
- social, practical, deceptive, and avoidant approaches;
- creation and later revisit of an incidental NPC.

Prove across multiple turns:

- opening occurs only after package commitment;
- package truth never changes;
- freeform action remains primary;
- only eligible events are selected;
- clues and recovery paths remain coherent;
- NPC identities, memories, promises, injuries, debts, and relationships persist;
- public, party, player-private, and runtime-only scopes remain correct;
- complete, partial, and paraphrased secrets do not leak;
- checks and tactical requests follow package state;
- exact retry does not call the provider twice or duplicate events;
- restart and resume preserve package and campaign continuity;
- the campaign reaches a valid resolution or tactical threshold.

The harness must run at least two materially different CampaignPackages before the Dungeon Master is considered campaign-independent.

### Layer 4 — Runtime mock GameFrame port

Use a deterministic fake GameFrame connector for fast runtime development.

Cover:

- authenticated campaign attachment and player identity;
- commands and audience-scoped presentation;
- checks, clues, cards, maps, media, narration, and encounter proposals;
- stable errors and bounds;
- exact retry, conflicting IDs, stale revisions, timeout, malformed response, unavailable service, and unsupported versions;
- structured tactical outcomes and campaign consequence application.

This layer proves runtime behavior against the contract, not actual GameFrame implementation.

### Layer 5 — Shared contract fixtures

Both repositories consume canonical fixtures for:

- CampaignPackage preview and capability declarations;
- campaign attachment and resume;
- player commands;
- public and private projections;
- scenes, dialogue, suggestions, choices, checks, clues, cards, maps, recaps, media, and narration;
- encounter request and terminal outcomes;
- stable errors, limits, revisions, cursors, and retry receipts.

Neither repository imports the other's private implementation.

### Layer 6 — Actual GameFrame Node integration

A runtime-owned job checks out the real public GameFrame repository, records the exact resolved SHA, installs repository-pinned dependencies, starts the real local server, and runs focused integration against actual routes and service behavior.

Prove:

- real authentication adapters used for local integration;
- actual serialization and validation;
- command custody and runtime result linkage;
- player audience projections;
- actual Arena Battles launch and terminal outcome;
- campaign return presentation;
- current GameFrame `main` compatibility or reviewed coordinated branch compatibility.

This layer must eventually use the actual handcrafted Monster Master CampaignPackage and Dungeon Master output. Existing deterministic echo journeys remain infrastructure tests and must be labeled accordingly.

### Layer 7 — Durable local two-service integration

Run both services with production-shaped local persistence boundaries.

Cover:

- separate databases and migration ownership;
- authenticated private GameFrame-to-runtime calls;
- package, journal, command, and outcome persistence;
- separate GameFrame coordination and runtime narrative positions;
- process restart and lost-response recovery;
- backup and restore into a clean environment;
- encounter launch, completion, consequence application, and resumed campaign;
- no cross-service storage access.

### Layer 8 — Browser campaign acceptance

Use real browser journeys for:

- player-safe campaign preview and confirmation;
- membership and resume;
- freeform input and editable suggestions;
- public and private scenes;
- required character, creature, clue, objective, condition, and recap views;
- Arena Battles transition and return;
- desktop and mobile interaction;
- reconnect and text-first fallback.

A screenshot supports presentation evidence but does not replace state assertions.

### Layer 9 — VM, Cloudflare edge, and Discord canary

A staging VM proves:

- production service topology;
- Cloudflare DNS, TLS, edge, and Tunnel routing to GameFrame only;
- no public runtime route or direct origin application port;
- real Discord authentication or Activity identity;
- invitations and seat claim;
- two public-network players joining without VPN;
- browser, GameFrame, and runtime restart and resume;
- private projection enforcement;
- actual Monster Master campaign and Arena Battles return;
- backup and restore;
- stopping the tunnel removes public reachability.

Repository tests cannot claim this evidence.

### Layer 10 — Campaign media and optional Cloudflare-native validation

Media canaries prove:

- catalog reuse and deterministic composition;
- queued generation, validation, moderation, provenance, caching, and replacement;
- placeholders during generation;
- recurring identity continuity;
- budget and failure behavior.

Cloudflare-native state tests are required only for an active migration and may cover Workers, Durable Objects, Queues, R2, export, import, eviction, rollback, and measured plan usage.

These tests do not replace the VM profile until migration gates pass.

## First complete campaign journey

The first actual campaign journey is:

```text
validated handcrafted Monster Master CampaignPackage
  -> package commitment
  -> two authenticated test players attach
  -> Dungeon Master opening from package context
  -> public and player-private information
  -> several scripted freeform actions
  -> clue and event progression
  -> deterministic noncombat check
  -> Arena Battles request at a valid threshold
  -> actual tactical match
  -> structured terminal outcome
  -> Dungeon Master applies consequences and presents return
  -> campaign reaches bounded resolution
  -> both services restart
  -> players resume without duplication, leakage, or plot drift
```

This journey uses prepared assets and deterministic fallbacks. Live media generation is separate.

## Second complete campaign journey

The second major journey is:

```text
materially different player concept
  -> Campaign Architect
  -> validated original CampaignPackage
  -> same Dungeon Master
  -> scripted multi-turn play
  -> valid resolution or tactical handoff
```

The same package validator and Dungeon Master harness used by Monster Master must accept this journey without campaign-specific code.

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

Package, Campaign Architect, Dungeon Master, clue, event, NPC, or tactical changes must run the relevant machine-play journeys.

Persistence and deployment changes run durable integration. Browser changes run focused player journeys. VM and provider claims require explicit canaries.

Broad inherited baselines remain scheduled or manually dispatched unless directly affected.

## Diagnostics

Preserve bounded evidence including:

- exact GameFrame and runtime SHAs;
- package, schema, prompt, fixture, and contract versions;
- package hash and selected provenance;
- scripted player profile and turn at failure;
- stable error codes and revisions;
- bounded service and provider-stub logs;
- retry, restart, outcome, backup, and restore receipts;
- browser traces only for browser journeys;
- no runtime-only package truth or credentials in ordinary artifacts.

## Acceptance criteria

The testing system is established when:

1. one handcrafted and one generated package pass the same validator;
2. Dungeon Master machine-play proves multiple turns and multiple packages;
3. secret, plot-drift, NPC-continuity, missed-clue, retry, and restart cases pass;
4. both repositories validate the same shared fixtures;
5. actual GameFrame integration exercises real routes and Arena Battles;
6. durable integration survives restarts and backup restore;
7. browser tests prove the complete player surface;
8. VM canaries prove public routing and private origin posture;
9. media and Cloudflare-native claims are isolated to their own evidence layers;
10. no player journey depends on Tailscale or router forwarding.

## Governing rule

> Prove package structure, agent behavior, real integration, durable state, player experience, deployment, and media at separate evidence layers—and never describe a lower layer as proof of a higher one.
