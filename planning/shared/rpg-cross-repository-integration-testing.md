---
title: RPG Cross-Repository Integration Testing
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GitHub Actions
  - VM staging validation
  - Cloudflare Tunnel validation
  - later Cloudflare-native migration validation
shared_document_id: rpg-cross-repository-integration-testing-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-cross-repository-integration-testing.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-cross-repository-integration-testing.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-cloudflare-deployment-architecture.md
  - rpg-monster-master-reference-campaign.md
  - ../rpg-gameframe-interface-contract.md
  - ../rpg-platform-delivery-plan.md
---

# RPG Cross-Repository Integration Testing

## Decision

RPG GM Runtime is tested at progressively stronger boundaries: against fast mock GameFrame ports, shared contract fixtures, an actual locally started GameFrame checkout, durable local VM adapters, a deployed VM staging environment reached through Cloudflare Tunnel, and later against optional Cloudflare-native components.

Mocks remain necessary, but they are not proof that the two repositories integrate. A local Node integration is not proof of durable restart behavior. A deployed Cloudflare Tunnel is not proof of Durable Objects. Each layer claims only the behavior it actually exercises.

The private RPG GM Runtime repository owns the workflow that checks out and executes both repositories because it may read the public GameFrame repository without exposing private runtime code or credentials to GameFrame's public CI.

## Testing ladder

### Layer 1 — Runtime mock port

Most RPG GM Runtime tests use a deterministic fake GameFrame connector.

This layer covers:

- campaign semantics and runtime event commits;
- freeform intent interpretation;
- public, party, player-private, and runtime-only audience handling;
- scene, dialogue, choice, check, media, narration, and encounter proposals;
- exact retry and conflicting command behavior;
- GameFrame timeout, malformed response, unavailable service, and unsupported-version handling;
- application of structured victory, defeat, injury, reward, escape, cancellation, and draw outcomes.

These tests should be fast, isolated, and suitable for ordinary development.

### Layer 2 — Shared contract fixtures

Both repositories consume versioned canonical fixtures for:

- campaign attachment and resume;
- player commands;
- scene and dialogue presentation;
- public and private projections;
- choices, checks, cards, maps, recaps, media, and narration intents;
- encounter requests, snapshots, terminal outcomes, cancellation, and acknowledgement;
- stable errors, limits, revisions, cursors, and retry receipts.

Fixture validation catches schema drift without booting either full application. Neither repository imports the other repository's private implementation.

### Layer 3 — Actual GameFrame Node integration

A compact runtime-owned job checks out the real GameFrame repository into a sibling directory, installs its repository-pinned dependencies, starts its ordinary local HTTP server, waits for `/api/health`, and runs the runtime integration journey against the real routes and service behavior.

Representative workspace:

```text
workspace/
  rpg-gm-runtime/
  scribbles-gameframe/
```

The lane uses:

- the real GameFrame server entry point;
- real request authentication behavior suitable for local testing;
- actual GameFrame serialization, validation, service, game-definition, and player-projection paths;
- the Monster Master RPG reference fixture;
- no Tailscale, private origin, or operator machine.

The first implementation may prove GameFrame startup, health, development authentication, and an existing Arena Battles match before every RPG-specific route exists. The lane expands with the versioned RPG interface.

### Layer 4 — Durable local service integration

Before public VM staging, both repositories must run together with the same persistence boundaries intended for the initial production profile.

This layer covers:

- GameFrame durable local adapters rather than in-memory stores;
- RPG GM Runtime durable campaign storage;
- separate databases and migration ownership;
- GameFrame-to-runtime authenticated private service calls;
- command idempotency and stale revision behavior;
- GameFrame coordination revision versus runtime narrative revision;
- process restart and lost-response retry;
- campaign-to-Arena-Battles-to-campaign outcome application;
- backup creation and restore into a clean environment;
- projection polling or WebSocket recovery after restart.

The test environment may use Docker Compose or equivalent process orchestration. It must not permit either service to read the other's data volume.

### Layer 5 — Deployed VM, Cloudflare Tunnel, and Discord canary

Repository-local execution cannot prove public routing, real Discord clients, Tunnel behavior, production-shaped cookies, router posture, or deployed authorization.

A VM staging canary proves:

- the same GameFrame and runtime service topology intended for first production;
- Cloudflare DNS, TLS, and Tunnel routing to GameFrame;
- no public GM route and no direct public origin port;
- Discord OAuth or Activity authentication;
- signed invitation creation and atomic campaign-seat acceptance;
- two public-network players joining the same campaign without a VPN;
- reconnect and later resume after browser and service restart;
- one reference campaign entering and returning from Arena Battles;
- player-private projection enforcement;
- prepared media fallback and optional narration behavior;
- no Tailscale dependency for players.

The canary must include an operator check that the home router has no application port forward and that stopping the tunnel removes public reachability without exposing a fallback origin.

### Layer 6 — Optional Cloudflare-native migration validation

Workers, Durable Objects, Queues, and R2 are later scale components. They receive their own tests only when a migration slice is active.

This layer may cover:

- Worker routing and bindings;
- Durable Object persistence and restoration;
- object eviction or restart;
- hibernation-compatible WebSocket projection;
- campaign and encounter coordination after migration;
- Queue duplicate delivery and idempotent work;
- object-storage persistence and stable asset retrieval;
- export from local persistence and import into the Cloudflare target;
- rollback or dual-read evidence where required;
- measured plan usage, storage, duration, and cost behavior.

Cloudflare-native tests do not replace the VM profile until migration acceptance criteria pass.

## Active-development GameFrame reference policy

GameFrame remains under rapid development and does not yet provide a stable RPG compatibility target. The integration strategy must not treat an early GameFrame commit as frozen or supported indefinitely.

During active co-development:

- ordinary runtime integration defaults to current GameFrame `main`;
- coordinated work may use a reviewed canonical `agent/*` branch through the controlled `gameframe_ref` input;
- every run resolves that ref to an exact GameFrame commit SHA and records it with the runtime SHA, fixture versions, and test evidence;
- a failure caused by a new GameFrame change is useful integration feedback and should normally be repaired rather than hidden by reverting to an obsolete default;
- recorded SHAs identify the exact source used by a run, but long-term reproduction requires that the commit remain reachable or that the tested source be preserved separately.

A compatibility baseline may be introduced later, after the first versioned RPG contracts and Monster Master reference chapter are complete enough to support release, rollback, or long-lived regression evidence.

## Coordinated branch testing

For coordinated work across both repositories, the runtime integration workflow accepts a trusted canonical GameFrame branch through controlled manual input.

The accepted order is:

1. define or update shared fixtures and contracts on the intended GameFrame branch;
2. run GameFrame's focused repository tests;
3. test the runtime branch against that trusted GameFrame branch;
4. merge the canonical GameFrame change;
5. synchronize shared documents and fixtures into the runtime;
6. run runtime integration against GameFrame `main` and record the resolved SHA;
7. merge the runtime change.

Production workflows must not execute arbitrary public pull-request code alongside private runtime source or secrets.

## Workflow placement and permissions

### GameFrame public repository

GameFrame CI owns:

- GameFrame unit, service, browser, visual, Worker, and Durable Object tests;
- shared fixture validation;
- deterministic stub-runtime behavior;
- public repository runner and secret-safety policy.

GameFrame CI does not check out the private runtime and receives no runtime token.

### RPG GM Runtime private repository

Runtime CI owns:

- runtime mock-port tests;
- canonical fixture compatibility;
- checkout of the public GameFrame repository;
- actual two-repository Node integration;
- durable local service integration;
- current-GameFrame integration during active development;
- shared-document synchronization and drift verification.

All RPG GM Runtime workflows use the designated self-hosted Debian runner under repository policy. No cross-repository secret is needed to check out public GameFrame. Real provider and Discord secrets remain excluded from ordinary pull-request integration.

## First end-to-end journey

The first actual integration journey is the deterministic Monster Master RPG reference chapter:

```text
two authenticated test players attach
  -> prepared Monster Master scene and assets
  -> NPC dialogue and freeform player command
  -> one player-private clue
  -> deterministic noncombat check
  -> Arena Battles encounter request
  -> actual GameFrame tactical match
  -> structured terminal outcome
  -> RPG GM Runtime commits consequences
  -> GameFrame presents the return scene
  -> both services restart
  -> players resume without duplication or continuity loss
```

The required journey uses prepared assets and fake or disabled external media and speech providers. Live generation is tested separately through deterministic provider adapters and staged canaries.

## Trigger policy

### Ordinary runtime pull requests

Run:

- focused runtime tests;
- shared fixture validation;
- shared-document drift check;
- actual GameFrame Node integration against current GameFrame `main` when affected runtime, contract, adapter, or reference-fixture paths change.

### Coordinated development

Run the same integration against the trusted GameFrame branch being developed alongside the runtime change, then rerun against GameFrame `main` after the GameFrame side merges.

### Merge-candidate milestones

Run:

- actual GameFrame Node integration;
- durable local service integration where persistence or deployment boundaries changed;
- recovery, retry, backup, restore, and reference-campaign journeys.

### Scheduled watches

Run:

- shared-document drift against GameFrame `main`;
- current GameFrame `main` integration against runtime `main`;
- no provider-backed or secret-bearing work unless specifically approved.

### External canaries

Run only through explicit staging workflows with owner-controlled secrets and environments. VM staging canaries precede Cloudflare-native migration canaries.

## Diagnostics

Cross-repository jobs preserve enough failure evidence to identify which boundary failed without uploading private campaign or secret-bearing data.

Useful evidence includes:

- exact GameFrame and runtime commit SHAs;
- requested GameFrame ref and resolved SHA;
- fixture and contract versions;
- service health responses;
- bounded process logs;
- failed request and stable error codes with sensitive values redacted;
- final GameFrame coordination and runtime narrative revisions;
- retry, reconnect, outcome, backup, and restore receipts;
- browser traces or screenshots only when the journey includes a real browser surface;
- deployment profile and storage adapter versions.

A passing process start is not proof of integration. A passing mock is not proof of the real service. A captured screenshot is not proof of authoritative state.

## Duration and runner policy

- GameFrame public workflows use GitHub-hosted runners unless GameFrame repository policy states otherwise.
- Every RPG GM Runtime workflow uses the designated self-hosted Debian runner.
- Broad inherited baselines and browser suites remain scheduled or manually dispatched rather than running for every focused integration change.
- Focused cross-repository jobs still require explicit timeouts, bounded logs, cleanup, and serialized use of the shared runner where necessary.

## Acceptance criteria

The integration strategy is established when:

1. both repositories validate the same versioned fixtures;
2. runtime mock tests cover failure and retry behavior;
3. a runtime job on the self-hosted runner checks out and starts current GameFrame `main` or a trusted coordinated branch and records the resolved SHA;
4. the Monster Master reference campaign enters and exits an actual GameFrame tactical match;
5. durable local adapters survive both service restarts and lost-response retries;
6. backup restoration preserves campaign continuity and identity;
7. GameFrame changes that break runtime integration are detected during active development;
8. a deployed VM staging canary proves Discord invitation, Cloudflare Tunnel routing, no origin port exposure, and public-network resume;
9. optional Cloudflare-native migration tests are required only when those components become active deployment dependencies;
10. no test or player journey depends on Tailscale.

## Governing rule

> Use mocks for speed, fixtures for contract stability, the current real GameFrame checkout for integration truth, durable local adapters for first-production state truth, VM staging through Cloudflare Tunnel for public-system truth, and Cloudflare-native tests only for an evidence-backed migration.