---
title: RPG GameFrame Interface Contract
status: accepted
document_type: contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-07
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
depends_on:
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
related:
  - rpg-platform-delivery-plan.md
  - tactical-battler-rpg-foundation.md
  - fixtures/rpg/v1/shared-rpg-fixtures.json
  - fixtures/rpg/v1/campaign-revision-linkage.json
---

# RPG GameFrame Interface Contract

## Purpose

GameFrame must provide the complete authenticated player interface for the RPG while exchanging versioned campaign commands and presentation events with RPG GM Runtime. The contract is broader than encounter launch and must remain independently testable with deterministic fixtures.

## Required client modes

The first GameFrame RPG shell should support:

- campaign join, seat claim, invitation, and resume;
- scene and narration presentation;
- NPC dialogue and speaker identity;
- freeform player input;
- bounded choices and confirmations;
- character and party views;
- inventory, equipment, abilities, conditions, quests, and objectives as structured projections;
- checks, dice, and consequence presentation;
- location, map, and point-of-interest views;
- player-private and party-private information;
- tactical encounter transition and return;
- campaign history, recap, reconnect, and recovery.

These may be separate routes or layered modes, but they remain one campaign application and one authenticated session.

## Contract families

### Campaign session

GameFrame must be able to attach an authenticated player to an authorized campaign seat, resume an existing attachment, fetch a player-scoped campaign projection, and acknowledge a durable presentation position.

### Player commands

Initial commands include:

- submit freeform action;
- submit structured choice;
- request inspection of an exposed entity or view;
- acknowledge presentation or recap position;
- submit GameFrame-owned mechanical actions when a structured mechanic is active.

Every mutation carries a stable command ID and bounded content. Identity is derived from authenticated GameFrame context. Exact retries are idempotent; conflicting command reuse fails with a stable code.

### Runtime presentation events

RPG GM Runtime may emit semantic, audience-scoped events such as:

- scene opened or changed;
- narration block;
- dialogue turn;
- entity, item, ability, quest, objective, or handout card;
- freeform input request;
- bounded choice;
- check requested, resolved, or followed by a consequence;
- public, party-private, or player-private reveal;
- location transition;
- encounter requested, started, updated, completed, cancelled, or failed;
- media reference with deterministic fallback;
- recap and resume marker.

GameFrame owns layout, animation, responsive behavior, accessibility, and presentation-state transitions. The runtime owns semantic content, stable references, ordering within its narrative commit, and audience intent.

One runtime narrative commit may contain multiple events with different explicit audiences. GameFrame must preserve each event audience independently; it must not infer output audience from the visibility of the player command that caused the runtime turn.

### Structured projections

GameFrame should receive narrow player-visible projections for repeated campaign systems rather than the runtime's full hidden semantic state. Initial projections may cover character state, party composition, known inventory, equipment, abilities, conditions, quests, objectives, current location, and exposed points of interest.

### Encounter port

GameFrame provides launch, retrieval, cancellation, lifecycle, reconnect, and terminal-outcome operations for tactical encounters. Launch is durable and idempotent. Terminal outcomes are structured and include objective, participant, injury or condition, resource, item, ruleset, revision, and commit data supported by the selected game.

#### Participant identity invariant

A runtime encounter participant is a durable campaign entity reference, not a display-only slot. The participant identity supplied at launch must remain correlatable through match materialization and terminal outcome.

Required chain:

```text
runtime campaign participant ID
→ GameFrame encounter participant record
→ authoritative tactical unit mapping
→ terminal participant result
→ runtime campaign aftermath
```

A GameFrame adapter may validate or enrich participant data for a selected ruleset. It must not silently replace the party roster with unrelated bootstrap or fixed-duel identities. If an encounter ruleset cannot materialize the supplied participant configuration truthfully, launch fails closed with an unsupported-configuration error.

## Identity model

- Human players use stable GameFrame principals derived from authenticated sessions.
- Theo occupies an ordinary GameFrame player seat through Scribbles Runtime.
- RPG GM Runtime uses a dedicated service principal with narrowly scoped campaign and encounter permissions.
- Display names, avatars, client-supplied Discord IDs, and URLs are presentation or routing data, never proof of identity.

## Correctness requirements

- runtime validation at every boundary;
- explicit payload and collection limits;
- expected revision checks in the authority domain being mutated;
- durable idempotency and exact retry;
- stable machine-readable errors;
- event-time audience authorization;
- viewer-bound resumable cursors;
- polling recovery when projections are missed;
- no correctness dependency on a permanently connected browser or WebSocket;
- no direct cross-repository storage access.

## Revision and ordering model

The term `campaignRevision` is insufficient for the production contract because it collapses coordination transactions, presentation-event ordering, and runtime narrative truth into one event-count-derived number. Contract version 2 separates three positions:

### GameFrame coordination revision

`gameframeCoordinationRevision` is owned exclusively by GameFrame. It advances once for each accepted GameFrame coordination transaction, including player command acceptance, membership or seat changes, runtime presentation linkage, encounter reference changes, and other GameFrame-owned coordination mutations.

A transaction that appends several presentation events advances this revision once, not once per event. Exact retry returns the original receipt without advancing it again.

### GameFrame presentation sequence

`presentationSequence` is owned exclusively by GameFrame. It advances once for each appended GameFrame presentation event and is the ordering basis for feed cursors, missed-event recovery, and player projections.

A coordination transaction may append zero, one, or several presentation events. Encounter launch may therefore advance coordination while leaving presentation sequence unchanged.

### Runtime narrative revision

`narrativeRevision` is owned exclusively by RPG GM Runtime. It advances once for each accepted runtime narrative commit. GameFrame never creates or increments it.

A runtime commit produces a `runtime.narrative_committed` receipt containing:

- `runtimeCommitId`;
- runtime commit kind;
- optional `sourceCommandId`;
- `sourceGameframeCoordinationRevision` from which the runtime work was derived;
- previous narrative revision;
- committed narrative revision.

GameFrame may link that receipt only while its current coordination revision exactly matches `sourceGameframeCoordinationRevision`. On acceptance, GameFrame may persist `linkedNarrativeRevision` as a checkpoint or projection pointer, but that value remains a reference to runtime-owned truth rather than a second narrative authority.

### Retry and conflict ownership

- GameFrame owns command-ID retry and conflict behavior.
- RPG GM Runtime owns runtime-commit-ID retry and conflict behavior.
- GameFrame owns coordination-mutation-ID retry and conflict behavior when linking a runtime receipt.
- A runtime commit may be linked only once for a campaign.
- Stale GameFrame coordination, stale runtime source revision, stale narrative revision, and conflicting identifier reuse use distinct stable errors.

The canonical executable cases live in `planning/fixtures/rpg/v1/campaign-revision-linkage.json`.

## First conformance fixture

A deterministic fixture must prove this sequence:

1. Two players attach to one campaign.
2. Both receive a public scene; one receives a private reveal.
3. Each submits a freeform command.
4. One player submits a bounded choice.
5. A noncombat check resolves and presents a consequence.
6. The runtime requests a tactical encounter.
7. GameFrame creates one encounter despite an exact retry.
8. Players complete the encounter.
9. GameFrame returns a structured terminal outcome.
10. The runtime resumes the scene and GameFrame renders it.
11. A disconnect and resume do not duplicate commands or presentation events.

This fixture is the eventual multiplayer contract proof. A narrower one-human-plus-BattleBot journey may be used earlier as the full-stack engineering gate, but it does not satisfy the two-player conformance claim.

## Shared fixture ownership and staged completion

GameFrame owns the canonical machine-readable fixtures under `planning/fixtures/rpg/v1/`. The manifest at `planning/fixtures/rpg/v1/shared-rpg-fixtures.json` is the only canonical fixture list for contract version 2. RPG GM Runtime mirrors those files exactly under `fixtures/rpg/v1/` and validates them against its deterministic boundary.

The `campaign-port-a` fixture proves the first stable boundary vocabulary:

- two authenticated player attachments;
- public and player-private projection filtering;
- a freeform command accepted at the expected prototype revision;
- exact retry without duplicate event creation;
- conflicting command reuse with a stable rejection;
- stale revision rejection;
- a versioned Monster Master encounter request with idempotent launch.

The `campaign-port-b` fixture adds bounded choices, a deterministic noncombat check, a terminal tactical outcome, and campaign return presentation.

The `campaign-revision-linkage` fixture defines the production revision domains that supersede the prototype's ambiguous use of `campaignRevision`. Port-A and port-B remain protocol-v1 regression fixtures for the internal deterministic reducer; they are not the active runtime transport contract.

Fixture changes are canonical-first: update and validate GameFrame, merge the canonical fixture, synchronize the private runtime mirror, run the runtime fixture conformance tests, and then merge runtime changes. Neither repository maintains a second hardcoded fixture list.

## Current implementation layers

The repository intentionally contains three different RPG implementation layers. They must not be conflated in status claims or future work.

### In-memory development adapter

`VersionedInMemoryRpgService` and the ordinary development HTTP server retain deterministic protocol and browser-regression behavior. They are useful fixtures and are not the production persistence authority.

The Node-local PR #124 encounter coordinator is also memory-backed. It proves one human campaign player can be handed to a deterministic Monster Master BattleBot match and returned to the RPG shell. It does not persist the encounter-to-match binding across process restart, and it does not materialize the RPG participant roster into authoritative tactical units.

### Durable SQLite RPG authority

GameFrame already has durable production-shaped RPG services:

- durable campaign membership/projection and command custody;
- durable command outbox and runtime linkage;
- `SqliteRpgEncounterStore` for encounter launch, retrieval, completion, exact retry, and restart-safe terminal outcomes;
- `createDurableRpgHttpServer()` exposing the durable campaign and encounter services through authenticated protocol-v2 routes.

This layer establishes durable RPG/encounter authority. It does not by itself create or run an Arena match.

### Missing production binding

The remaining production integration is:

```text
durable RPG encounter authority
+ validated participant-faithful Monster Master configuration
+ authoritative match creation/recovery
+ exact match-unit ↔ RPG participant mapping
+ exact terminal participant outcome
```

`MatchSession` already supports persistence of an explicit initial state and replay from that state. A campaign-configured Monster Master implementation should prefer a validated encounter configuration/state materializer feeding the ordinary match/replay authority rather than adding a second tactical event model.

## Protocol-v2 development routes

The development and durable adapters expose the same core route families with different backing stores:

| Method | Route | Principal | Protocol-v2 behavior |
| --- | --- | --- | --- |
| `POST` | `/api/rpg/campaigns/{campaignId}/attach` | authenticated player | Returns the audience-filtered projection with the explicit GameFrame positions. |
| `POST` | `/api/rpg/campaigns/{campaignId}/commands` | active player member | Accepts player commands with `expectedGameframeCoordinationRevision`, commits one coordination transaction, and preserves exact command retry. |
| `POST` | `/api/rpg/campaigns/{campaignId}/events` | RPG runtime service | Links one runtime narrative receipt through a stable `coordinationMutationId`, validates its GameFrame source revision and next narrative revision, and appends submitted presentation events atomically. |
| `POST` | `/api/rpg/encounters` | RPG runtime service | Links a `runtime.encounter_launch` receipt, validates campaign provenance and participant bindings, advances coordination without inventing a presentation event, and creates one idempotent encounter handle. |
| `GET` | `/api/rpg/encounters/{encounterId}` | creating runtime service | Retrieves the current encounter handle with its linked coordination and narrative positions. |
| `POST` | `/api/rpg/encounters/{encounterId}/complete` | GameFrame encounter-engine service | Commits one validated terminal outcome while preserving the launch linkage metadata. |

Development player requests use `x-gameframe-player-id`. Development service requests use `x-gameframe-service-id`. A request claiming both identities is rejected, and service principals cannot use ordinary player-match routes. Production authentication remains the responsibility of the injected `RequestAuthenticator`.

The live boundary advertises campaign protocol version `2` and encounter protocol version `2`. Protocol-v2 responses expose `gameframeCoordinationRevision`, `presentationSequence`, and `linkedNarrativeRevision`; they do not expose the old ambiguous `campaignRevision`. Player commands carry `expectedGameframeCoordinationRevision`. Runtime event and encounter-launch mutations carry:

- stable `coordinationMutationId`;
- `expectedGameframeCoordinationRevision`;
- a runtime-owned `runtime.narrative_committed` receipt;
- bounded operation-specific content.

Stable protocol-v2 conflicts distinguish coordination revision mismatch, runtime source-revision mismatch, narrative-link mismatch, repeated runtime-link attempts, command-ID conflict, and coordination-mutation-ID conflict. Exact retries return the original receipt or encounter handle without advancing any position again.

Legacy protocol-v1 reducer fixtures remain regression-only. New runtime integration must use protocol version 2 and must not depend on legacy `campaignRevision`, `expectedRevision`, or encounter `campaignRevision` fields.

## Delivery evidence

A GameFrame implementation PR must identify final contract modules, schema versions, endpoint adapters, authentication expectations, bounds, retry and retention rules, fixture paths, validation commands, and the exact commit SHA validated against RPG GM Runtime fixtures.