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
  - Cloudflare staging validation
shared_document_id: rpg-cross-repository-integration-testing-v1
shared_document_version: 1
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

RPG GM Runtime must be tested at several boundaries: against fast mock GameFrame ports, against shared contract fixtures, against an actual locally started GameFrame checkout, against local Workers and Durable Objects, and finally against a deployed Cloudflare staging environment.

Mocks remain necessary, but they are not accepted as proof that the two repositories actually integrate.

The private RPG GM Runtime repository owns the workflow that checks out and executes both repositories because it may read the public GameFrame repository without exposing private runtime code or credentials to GameFrame's public CI.

## Testing pyramid

### Layer 1 — Runtime mock port

Most RPG GM Runtime tests use a deterministic fake GameFrame connector.

This layer covers:

- campaign semantics and event commits;
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

A compact runtime-owned GitHub Actions job checks out the real GameFrame repository into a sibling directory, installs its repository-pinned dependencies, starts its ordinary local HTTP server, waits for `/api/health`, and runs the runtime integration journey against the real routes and service behavior.

Representative workspace:

```text
workspace/
  rpg-gm-runtime/
  scribbles-gameframe/
```

The lane must use:

- the real GameFrame server entry point;
- real request authentication behavior suitable for local testing;
- actual GameFrame serialization, validation, service, game-definition, and player-projection paths;
- the Monster Master RPG reference fixture;
- no Tailscale, private origin, or operator machine.

The first implementation may prove GameFrame startup, health, development authentication, and an existing Arena Battles match before RPG-specific routes exist. The lane expands as versioned RPG routes and adapters are implemented.

### Layer 4 — Local Workers and Durable Objects integration

A stronger merge-candidate or milestone lane uses GameFrame's local Wrangler or workerd path rather than only the in-memory Node server.

This layer covers:

- Worker routing and bindings;
- Durable Object persistence and restoration;
- object eviction or restart;
- campaign and encounter coordination;
- command idempotency and stale revision handling;
- WebSocket projection or polling recovery;
- campaign-to-encounter-to-campaign outcome application.

This lane may be slower than the Node integration and should remain focused enough for GitHub-hosted runners under repository duration policy.

### Layer 5 — Deployed Cloudflare and Discord canary

Repository-local execution cannot prove real Discord clients, public networking, deployment bindings, production-shaped Durable Object behavior, or deployed authorization.

A staging canary must eventually prove:

- Discord OAuth or Activity authentication;
- signed invitation creation and atomic campaign-seat acceptance;
- two public-network players joining the same campaign;
- reconnect and later resume;
- one reference campaign entering and returning from Arena Battles;
- player-private projection enforcement;
- media fallback and optional narration behavior;
- no Tailscale dependency.

## Active-development GameFrame reference policy

GameFrame is still under rapid development and does not yet provide a stable RPG compatibility target. The integration strategy must not treat an early GameFrame commit as frozen or supported indefinitely.

During active co-development:

- ordinary runtime integration defaults to current GameFrame `main`;
- coordinated work may supply an explicit `gameframe_ref` naming a branch, tag, or commit;
- every run resolves that ref to an exact GameFrame commit SHA and records it with the runtime SHA, fixture versions, and test evidence;
- a failure caused by a new GameFrame change is useful integration feedback and should normally be repaired rather than hidden by reverting to an old default;
- recorded SHAs identify the exact source used by a run, but long-term reproduction requires that the commit remain reachable or that the tested source be preserved separately.

A compatibility baseline may be introduced later, after the first versioned RPG contracts and Monster Master reference chapter are complete enough to support release, rollback, or long-lived regression evidence. That later baseline is a reproducibility and release-control tool; it does not replace continued testing against current GameFrame development.

For coordinated feature branches that may be squash-merged and deleted, preserve an immutable ref or archive the tested source when long-term reproduction matters. Without that preservation, the recorded SHA remains diagnostic evidence but is not by itself a guarantee that a fresh clone can retrieve the source indefinitely.

## Coordinated branch testing

For coordinated work across both repositories, the runtime integration workflow should accept an explicit `gameframe_ref` through manual dispatch or a controlled workflow input.

The accepted order is:

1. define or update shared fixtures and contracts on the intended GameFrame branch;
2. run GameFrame's focused repository tests;
3. test the runtime branch against that explicit GameFrame branch or commit;
4. merge the canonical GameFrame change;
5. synchronize shared documents and fixtures into the runtime as required;
6. run runtime integration against GameFrame `main` and record the resolved SHA;
7. merge the runtime change.

Production workflows must not automatically execute untrusted public pull-request code with private runtime secrets.

## Workflow placement and permissions

### GameFrame public repository

GameFrame CI owns:

- GameFrame unit, service, browser, Workers, Durable Object, and visual tests;
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
- selected local workerd integration;
- current-GameFrame integration during active development;
- shared-document synchronization and drift verification.

No cross-repository secret is needed to check out public GameFrame. Real provider and Discord secrets remain excluded from ordinary pull-request integration.

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
  -> both processes restart
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

Run the same integration against the explicit GameFrame branch or commit being developed alongside the runtime change, then rerun against GameFrame `main` after the GameFrame side merges.

### Merge-candidate milestones

Run:

- actual GameFrame Node integration against current `main` or the explicit coordinated ref;
- focused local Workers and Durable Objects integration;
- recovery, retry, and reference-campaign journeys.

### Scheduled watches

Run:

- shared-document drift against GameFrame `main`;
- current GameFrame `main` integration against runtime `main`;
- no provider-backed or secret-bearing work unless specifically approved.

### External canaries

Run only through explicit staging workflows with owner-controlled secrets and environments.

## Diagnostics

Cross-repository jobs should preserve enough failure evidence to identify which boundary failed without uploading private campaign or secret-bearing data.

Useful evidence includes:

- exact GameFrame and runtime commit SHAs;
- requested GameFrame ref and resolved SHA;
- fixture and contract versions;
- service health responses;
- bounded process logs;
- failed request and stable error codes with sensitive values redacted;
- final campaign and encounter revisions;
- retry, reconnect, and outcome receipts;
- browser traces or screenshots only when the journey includes a real browser surface.

A passing process start is not proof of integration. A passing mock is not proof of the real service. A captured screenshot is not proof of authoritative state.

## Duration and runner policy

- Keep ordinary cross-repository tests compact enough for GitHub-hosted runners.
- GameFrame public workflows use GitHub-hosted runners.
- Routine runtime integration uses GitHub-hosted runners.
- Only jobs expected to exceed 30 minutes may use the designated self-hosted runtime runner, consistent with runtime repository policy.
- Full inherited baselines and broad browser suites remain scheduled or manually dispatched rather than running for every focused integration change.

## Acceptance criteria

The integration strategy is established when:

1. both repositories validate the same versioned fixtures;
2. runtime mock tests cover failure and retry behavior;
3. a GitHub-hosted runtime job checks out and starts current GameFrame `main` or an explicit coordinated ref and records the resolved SHA;
4. the Monster Master reference campaign enters and exits an actual GameFrame tactical match;
5. a local Workers/Durable Object lane proves persistence and recovery;
6. GameFrame changes that break runtime integration are detected during active development rather than hidden behind an obsolete default;
7. a deployed staging canary proves real Discord invitation and public-network resume;
8. no test or player journey depends on Tailscale.

## Governing rule

> Use mocks for speed, fixtures for contract stability, the current real GameFrame checkout for integration truth, workerd for Cloudflare-state truth, and deployed staging for public-system truth. Record exact SHAs for evidence; preserve the tested source when long-term reproduction is required.