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

GameFrame provides launch, retrieval, lifecycle, reconnect, tactical match access, and terminal-outcome operations for tactical encounters. Launch is durable and idempotent. Terminal outcomes are structured and include objective, participant, injury or condition, resource, item, ruleset, revision, and commit data supported by the selected game.

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

For the current `monster-master-rpg` ruleset, the durable adapter consumes the existing participant `rulesState.creatureIds` vocabulary and stores exact `participantUnitIds` alongside the durable encounter↔match binding. Each configured creature ID becomes the tactical unit ID using an explicitly supported Arena species profile. Campaign trainers remain encounter participants/controllers; they are not converted into the standalone MM-0001 Warden Master unit.

Mapping mode remains `shared-team-roster` because allied action authorization is shared among authenticated teammates. The mapping itself is exact: `participantUnitIds` records participant→creature assignment, `assignedUnitIds` exposes the requesting player's participant assignments, and `controlledUnitIds` identifies the full allied roster that shared-team authorization allows the player to operate. This is not exclusive per-player action ownership.

The first materialized rules surface is intentionally bounded to currently implemented Arena mechanics. Unsupported species, extra participant combat fields, unsupported objective/difficulty values, custom battlefield layouts, and asymmetric roster sizes fail closed before durable encounter custody. GameFrame does not accept unsupported package configuration as inert metadata.

## Identity model

- Human players use stable GameFrame principals derived from authenticated sessions.
- Theo occupies an ordinary GameFrame player seat through Scribbles Runtime only after an explicit future connector exists.
- RPG GM Runtime uses a dedicated service principal with narrowly scoped campaign and encounter permissions.
- Display names, avatars, client-supplied Discord IDs, and URLs are presentation or routing data, never proof of identity.

For cooperative Monster Master RPG encounters, each human remains a separate authenticated principal. GameFrame may translate those authorized principals to one persisted synthetic tactical team seat only inside the encounter-match authority adapter. The synthetic seat is never exposed as the human's canonical identity.

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

The term `campaignRevision` is insufficient for the production contract because it collapses coordination transactions, presentation-event ordering, and runtime narrative truth into one event-count-derived number. Contract version 2 separates three positions.

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

This fixture is the eventual multiplayer contract proof. The team-aware tactical substrate and bounded participant-faithful configured Monster Master roster exist, but the full two-human campaign lifecycle, party-private runtime behavior, cross-service CampaignPackage/Dungeon Master journey, and human multiplayer acceptance remain separate evidence requirements.

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

The repository intentionally contains multiple RPG implementation layers. They must not be conflated in status claims or future work.

### In-memory development adapter

`VersionedInMemoryRpgService` and the ordinary development HTTP server retain deterministic protocol and browser-regression behavior. They are useful fixtures and are not the production persistence authority.

PR #124 established the first campaign→Arena→campaign Node-local proof with one human plus Monster Master BattleBot. PR #152 extended the Node-local encounter coordinator to explicit cooperative shared-team control while retaining independent authenticated player identities, normal revision authority, outsider rejection, and team terminal outcomes. The Node-local encounter↔match binding is still memory-backed.

### Durable SQLite RPG and match authority

The VM-first implementation uses the existing GameFrame RPG SQLite database as one GameFrame-owned authority domain for:

- durable campaign membership/projection and command custody;
- durable command outbox and runtime linkage;
- `SqliteRpgEncounterStore` encounter launch, retrieval, completion, exact retry, and restart-safe terminal outcomes;
- durable RPG-bound Monster Master match snapshots;
- exact encounter↔match binding identity;
- persisted authenticated teammate IDs, team IDs, synthetic tactical team seat, exact participant→creature assignments, and team roster mappings;
- configured revision-zero Monster Master state for the supported `rulesState.creatureIds` surface;
- exact terminal participant health/defeat results derived from mapped authoritative creatures.

`createDurableRpgHttpServer()` exposes the durable campaign/encounter routes plus player-authenticated `rpg:*` match view/action routes. The Cloudflare RPG edge authenticates browser sessions and HMAC-proxies only those RPG-bound match requests to the VM service. Ordinary GameFrame matches remain on the existing Durable Object path.

RPG battle clients use HTTP polling in this deployment profile. They must not open the ordinary Durable Object `/events` transport for a VM-owned `rpg:*` match.

### Remaining production fidelity and operations

The participant-faithful path is implemented for the narrow rules surface GameFrame actually supports today:

```text
validated `rulesState.creatureIds`
+ supported Emberling/Bulwark materialization
+ authoritative configured revision-zero state
+ exact participant-specific unit mapping
+ durable match/restart authority
+ exact terminal participant aftermath
```

Remaining fidelity work is requirement-driven rather than a blanket new rules engine: add new species, abilities, resources, statuses, objectives, battlefield layouts, difficulty mechanics, or asymmetric deployment only when an actual CampaignPackage requires them and only with corresponding deterministic Arena implementation. Unsupported configuration continues to fail closed.

The next full-product proof is cross-repository: a real committed CampaignPackage and configured Dungeon Master must drive the durable GameFrame path through Arena and automatic aftermath. Deployed restart/backup/Cloudflare/Discord canaries remain separate operational evidence.

## Protocol-v2 routes

The development and durable adapters expose the same campaign/encounter protocol families with different backing stores. The VM-first durable service additionally owns `rpg:*` battle view/action routes.

| Method | Route | Principal | Protocol-v2 behavior |
| --- | --- | --- | --- |
| `POST` | `/api/rpg/campaigns/{campaignId}/attach` | authenticated player | Returns the audience-filtered projection with explicit GameFrame positions. |
| `POST` | `/api/rpg/campaigns/{campaignId}/commands` | active player member | Accepts player commands with `expectedGameframeCoordinationRevision`, commits one coordination transaction, and preserves exact command retry. |
| `POST` | `/api/rpg/campaigns/{campaignId}/events` | RPG runtime service | Links one runtime narrative receipt through a stable `coordinationMutationId`, validates its GameFrame source revision and next narrative revision, and appends submitted presentation events atomically. |
| `POST` | `/api/rpg/encounters` | RPG runtime service | Validates supported encounter configuration before custody, links a `runtime.encounter_launch` receipt, advances coordination without inventing a presentation event, and creates one idempotent encounter handle plus one durable configured bound match for `monster-master-rpg`. |
| `GET` | `/api/rpg/encounters/{encounterId}` | creating runtime service | Retrieves the current encounter handle, linked positions, and durable play binding when applicable. |
| `POST` | `/api/rpg/encounters/{encounterId}/complete` | GameFrame encounter-engine service | Commits one validated terminal outcome while preserving the launch linkage metadata. |
| `GET` | `/api/matches/{rpgMatchId}` | authenticated authorized encounter player | Returns the player-aliased authoritative RPG battle projection, shared-team control metadata, and exact player-assigned unit IDs. |
| `POST` | `/api/matches/{rpgMatchId}/actions` | authenticated authorized encounter player | Submits a legal action through the persisted allied tactical seat with normal expected-revision checks. |

Development player requests use `x-gameframe-player-id`. Development service requests use `x-gameframe-service-id`. A request claiming both identities is rejected, and service principals cannot use ordinary player-match routes. Production player identity is verified by the Cloudflare session boundary and signed into the private VM request; production service authentication remains narrowly scoped.

The live boundary advertises campaign protocol version `2` and encounter protocol version `2`. Protocol-v2 responses expose `gameframeCoordinationRevision`, `presentationSequence`, and `linkedNarrativeRevision`; they do not expose the old ambiguous `campaignRevision`. Player commands carry `expectedGameframeCoordinationRevision`. Runtime event and encounter-launch mutations carry:

- stable `coordinationMutationId`;
- `expectedGameframeCoordinationRevision`;
- a runtime-owned `runtime.narrative_committed` receipt;
- bounded operation-specific content.

Stable protocol-v2 conflicts distinguish coordination revision mismatch, runtime source-revision mismatch, narrative-link mismatch, repeated runtime-link attempts, command-ID conflict, and coordination-mutation-ID conflict. Exact retries return the original receipt or encounter handle without advancing any position again. Unsupported Monster Master encounter configuration returns the stable nonretryable `unsupported-encounter-configuration` validation error before encounter custody advances.

Legacy protocol-v1 reducer fixtures remain regression-only. New runtime integration must use protocol version 2 and must not depend on legacy `campaignRevision`, `expectedRevision`, or encounter `campaignRevision` fields.

## Delivery evidence

A GameFrame implementation PR must identify final contract modules, schema versions, endpoint adapters, authentication expectations, bounds, retry and retention rules, fixture paths, validation commands, and the exact commit SHA validated against RPG GM Runtime fixtures. Repository tests may prove code and restart behavior; VM, Cloudflare, Discord, and cross-repository deployment claims require their corresponding canaries.