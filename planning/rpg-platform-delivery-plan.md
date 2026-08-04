---
title: RPG Platform Delivery Plan
status: active
document_type: plan
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
depends_on:
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
related:
  - tactical-battler-rpg-foundation.md
---

# RPG Platform Delivery Plan

## Goal

Deliver one persistent campaign played entirely through GameFrame. Human players and Theo must be able to join, experience several scenes, submit actions, complete a tactical encounter, receive its consequences, disconnect, and resume without continuity loss.

## P0 — Direction and contract freeze

- Merge the all-GameFrame product decision in both repositories.
- Standardize YAML front matter for canonical RPG documentation.
- Freeze version 1 names for campaign session, command, presentation, projection, and encounter fixtures.
- Record ownership, bounds, errors, retry semantics, and acceptance tests.

**Done when:** no controlling RPG document treats Discord-first versus GameFrame-primary as unresolved.

## P1 — Deterministic RPG shell in GameFrame

Build a new campaign surface against local fixtures before connecting a model runtime.

Minimum shell:

- campaign creation or attachment and seat resume;
- scene background and layered presentation panels;
- narration and dialogue;
- freeform input and bounded choices;
- character and party drawer;
- campaign feed and recap;
- public, party-private, and player-private projections;
- responsive desktop and mobile behavior;
- polling and projection reconnect.

**Done when:** two authenticated browser seats can run a scripted multi-scene fixture, receive different private information, submit commands, disconnect, and resume.

## P2 — Transport-neutral RPG service contract

Implement the version 1 domain port and validators independently of HTTP, Workers, or WebSockets. Then add production-shaped adapters using the existing GameFrame authority and persistence patterns.

Required surfaces:

- attach or resume campaign player;
- fetch player projection;
- submit freeform action;
- submit choice;
- acknowledge presentation position;
- launch, fetch, cancel, and complete encounter operations.

**Done when:** deterministic conformance tests cover identity, audience, limits, stale revisions, exact retry, conflicting command reuse, reconnect, and eviction.

## P3 — Cross-repository fixture compatibility

RPG GM Runtime consumes the frozen GameFrame fixtures and GameFrame consumes the frozen runtime fixtures. Neither repository imports the other's private implementation.

**Done when:** compact compatibility tests prove that command, presentation, projection, error, cursor, and encounter fixtures remain schema-compatible.

## P4 — Real campaign vertical slice

Connect the shell to the runtime's first deterministic or scripted campaign implementation.

Slice content:

- one party and two player characters;
- two or three linked scenes;
- one recurring NPC;
- public and private information;
- freeform action interpretation;
- one noncombat check and consequence;
- one bounded choice;
- one tactical encounter;
- structured outcome application;
- resumed narration and later-session recovery.

**Done when:** an automated end-to-end journey proves campaign → encounter → outcome → resumed campaign, including a forced disconnect and exact retry.

## P5 — First playable campaign systems

Promote only systems used by the first real campaign:

- inventory and equipment;
- abilities and conditions;
- quests and objectives;
- progression, injuries, rest, and recovery;
- location and point-of-interest exploration;
- media and asset references;
- operator inspection and correction tools.

Every promoted mechanic requires an explicit owner, versioned schema, persistence rule, player projection, UI, migration posture, and tests.

**Done when:** a short multi-session campaign can be completed without developer intervention for ordinary state changes.

## P6 — Model, media, and operational quality

- production GM provider routing and deterministic fallback;
- bounded context compilation and NPC continuity evaluation;
- pacing, narration, and consequence tuning;
- deterministic portrait, card, scene, and theme composition;
- asynchronous generated media with caching and provenance;
- observability, cost budgets, export, backup, and recovery;
- moderation and operator controls.

**Done when:** model or media failure reduces quality without corrupting state or blocking legal play.

## Parallel work rule

GameFrame builds player-facing behavior against deterministic fixtures while RPG GM Runtime builds campaign semantics against a mock GameFrame port. Production integration starts only from frozen versioned fixtures.

## Validation posture

- Public GameFrame repository checks use GitHub-hosted runners.
- Routine RPG Runtime checks use GitHub-hosted runners.
- Jobs expected to exceed 30 minutes use the designated self-hosted runner only where repository policy permits.
- Cross-repository fixture checks remain compact enough for ordinary pull requests.
- Full inherited baselines are scheduled or manually dispatched and do not block every documentation or feature slice.
