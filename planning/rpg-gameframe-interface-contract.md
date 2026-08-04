---
title: RPG GameFrame Interface Contract
status: accepted
document_type: contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
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

GameFrame owns layout, animation, responsive behavior, accessibility, and presentation-state transitions. The runtime owns semantic content, stable references, ordering, and audience.

### Structured projections

GameFrame should receive narrow player-visible projections for repeated campaign systems rather than the runtime's full hidden semantic state. Initial projections may cover character state, party composition, known inventory, equipment, abilities, conditions, quests, objectives, current location, and exposed points of interest.

### Encounter port

GameFrame provides launch, retrieval, cancellation, lifecycle, reconnect, and terminal-outcome operations for tactical encounters. Launch is durable and idempotent. Terminal outcomes are structured and include objective, participant, injury or condition, resource, item, ruleset, revision, and commit data supported by the selected game.

## Identity model

- Human players use stable GameFrame principals derived from authenticated sessions.
- Theo occupies an ordinary GameFrame player seat through Scribbles Runtime.
- RPG GM Runtime uses a dedicated service principal with narrowly scoped campaign and encounter permissions.
- Display names, avatars, client-supplied Discord IDs, and URLs are presentation or routing data, never proof of identity.

## Correctness requirements

- runtime validation at every boundary;
- explicit payload and collection limits;
- expected revision checks where ordering matters;
- durable idempotency and exact retry;
- stable machine-readable errors;
- event-time audience authorization;
- viewer-bound resumable cursors;
- polling recovery when projections are missed;
- no correctness dependency on a permanently connected browser or WebSocket;
- no direct cross-repository storage access.

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

## Shared fixture ownership and staged completion

GameFrame owns the canonical machine-readable fixtures under `planning/fixtures/rpg/v1/`. The manifest at `planning/fixtures/rpg/v1/shared-rpg-fixtures.json` is the only canonical fixture list for contract version 1. RPG GM Runtime mirrors those files exactly under `fixtures/rpg/v1/` and validates them against its deterministic in-process boundary.

The initial `campaign-port-a` fixture deliberately proves only the first stable boundary vocabulary:

- two authenticated player attachments;
- public and player-private projection filtering;
- a freeform command accepted at the expected revision;
- exact retry without duplicate event creation;
- conflicting command reuse with a stable rejection;
- stale revision rejection;
- a versioned Monster Master encounter request with idempotent launch.

It does not claim the complete eleven-step conformance journey. Structured choice, noncombat check, terminal encounter outcome, return-scene presentation, durable reconnect, and deployed GameFrame routes expand the same versioned fixture family in later slices.

Fixture changes are canonical-first: update and validate GameFrame, merge the canonical fixture, synchronize the private runtime mirror, run the runtime fixture conformance tests, and then merge runtime changes. Neither repository maintains a second hardcoded fixture list.

## Node-local HTTP slice

The first executable GameFrame RPG adapter is memory-backed and seeded from the canonical `campaign-port-a` fixture. It exposes these development routes:

| Method | Route | Principal | Behavior |
| --- | --- | --- | --- |
| `POST` | `/api/rpg/campaigns/{campaignId}/attach` | authenticated player | Returns the current event-time audience-filtered campaign projection. |
| `POST` | `/api/rpg/campaigns/{campaignId}/commands` | active player member | Accepts `campaign.submit_action`, enforces expected revision, and preserves exact command retry. |
| `POST` | `/api/rpg/encounters` | RPG runtime service | Validates campaign provenance and active player participant bindings, then creates one idempotent encounter handle. |
| `GET` | `/api/rpg/encounters/{encounterId}` | RPG runtime service | Retrieves the current memory-backed encounter handle. |

Development player requests use `x-gameframe-player-id`. Development service requests use `x-gameframe-service-id`. A request claiming both identities is rejected, and service principals cannot use ordinary player-match routes. Production authentication remains the responsibility of the injected `RequestAuthenticator`.

The current implementation has a 64 KiB HTTP request-body limit, campaign protocol version `1`, encounter protocol version `1`, a 2,000-character freeform action limit, at most 32 encounter participants, and at most 32 objectives. Command and encounter retries are process-memory idempotent only. The returned campaign cursor is a temporary projection marker, not yet a signed, viewer-bound durable resume cursor.

This slice does not claim Durable Object persistence, restart survival, structured choice/check behavior, tactical terminal outcomes, return-scene application, browser campaign UI, or deployed Cloudflare authentication. Those remain explicit later acceptance gates.

## Delivery evidence

A GameFrame implementation PR must identify final contract modules, schema versions, endpoint adapters, authentication expectations, bounds, retry and retention rules, fixture paths, validation commands, and the exact commit SHA validated against RPG GM Runtime fixtures.
