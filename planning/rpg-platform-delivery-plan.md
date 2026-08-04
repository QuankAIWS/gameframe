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
  - shared/rpg-platform-product-goals.md
  - shared/rpg-cloudflare-deployment-architecture.md
  - shared/rpg-media-theme-and-audio-pipeline.md
related:
  - tactical-battler-rpg-foundation.md
---

# RPG Platform Delivery Plan

## Goal

Deliver one persistent campaign played entirely through GameFrame and hosted through Cloudflare. Human players and Theo must be able to join through authenticated GameFrame seats, select a broad campaign theme, experience several scenes, submit actions, complete a tactical encounter, receive its consequences, consume optional art and narration enrichment, disconnect, and resume without continuity loss.

No production player journey depends on Tailscale.

## Planning rules

- Build production boundaries against deterministic fixtures before adding live model or media providers.
- Keep campaign and encounter commits independent from slow inference and media work.
- Prefer catalog reuse and deterministic composition before generation.
- Treat theme flexibility as a core contract, not a late cosmetic feature.
- Promote repeated narrative concepts into structured GameFrame mechanics only when the product value justifies schema, persistence, UI, migration, and testing cost.
- Freeze cross-repository fixtures before implementing production adapters.
- Every phase has an automated exit gate and a visible player journey.

## P0 — Direction, documents, and shared-contract freeze

- Merge the all-GameFrame product decision in both repositories.
- Merge the shared product goals, Cloudflare deployment architecture, and media/theme/audio pipeline documents.
- Standardize YAML front matter for canonical RPG documentation.
- Establish GameFrame as the canonical owner of shared documents and the runtime as an exact-byte mirror.
- Add a scheduled and pull-request drift check in the runtime repository.
- Freeze version 1 names for campaign session, command, presentation, projection, theme, asset, narration, and encounter fixtures.
- Record ownership, bounds, errors, retry semantics, provider isolation, and acceptance tests.

**Done when:** no controlling document treats Discord-first versus GameFrame-primary as unresolved, no document requires Tailscale, and all shared copies are byte-identical.

## P1 — Cloudflare production spine

Build the public deployment path before the full campaign feature set.

Required work:

- deploy the existing GameFrame Worker and Durable Object foundation to a staging environment;
- preserve ordinary browser and Discord Activity entry through the same GameFrame application;
- validate real Discord OAuth or Activity identity and stable GameFrame principals;
- validate signed, expiring invitations and atomic campaign-seat claims;
- introduce a minimal campaign Durable Object with revision, membership, command receipt, projection cursor, and reconnect state;
- keep encounter Durable Objects separate from campaign coordination;
- prove hibernation-compatible WebSocket projection with authenticated polling fallback;
- establish staging secrets, logs, budgets, and public-network desktop and mobile canaries.

**Done when:** two real authenticated users can accept an invitation, attach to the same staging campaign object, exchange deterministic fixture commands, disconnect, and resume over the public Internet without Tailscale.

## P2 — Deterministic RPG shell in GameFrame

Build the complete campaign navigation and presentation shell against local and staged fixtures before connecting a model runtime.

Minimum shell:

- campaign creation, attachment, seat resume, and recap;
- scene background and layered presentation panels;
- narration and NPC dialogue;
- freeform input and bounded choices;
- checks and visible consequences;
- character, party, inventory, quest, and objective drawers using fixture data;
- map, location, point-of-interest, and handout presentation primitives;
- public, party-private, and player-private projections;
- responsive desktop and mobile behavior;
- polling and projection reconnect;
- text-first accessibility and media placeholders.

**Done when:** two authenticated browser seats can run a scripted multi-scene fixture, receive different private information, submit commands, resolve a check, disconnect, and resume.

## P3 — Transport-neutral RPG service contracts

Implement version 1 domain ports and validators independently of HTTP, Workers, Durable Objects, queues, or WebSockets. Then add production-shaped adapters using existing GameFrame authority patterns.

Required contract families:

- attach or resume campaign player;
- fetch player projection and missed presentation events;
- submit freeform action, choice, inspection, and acknowledgement commands;
- publish scene, dialogue, card, check, reveal, map, recap, and media-reference events;
- create and version campaign theme briefs;
- request asset and narration intents;
- launch, fetch, cancel, complete, and acknowledge encounters;
- return stable errors, limits, revisions, cursors, and retry receipts.

**Done when:** deterministic conformance tests cover identity, audience, bounds, stale revisions, exact retry, conflicting command reuse, reconnect, Durable Object eviction, and unsupported versions.

## P4 — Cross-repository fixtures and deterministic theme pipeline

GameFrame and RPG GM Runtime develop in parallel against frozen fixtures. Neither repository imports the other's private implementation.

GameFrame work:

- implement western, original undersea-comedy, and medieval-fantasy theme fixtures;
- establish reusable theme-pack and asset-registry schemas;
- prove catalog lookup and deterministic fallback selection;
- implement at least one deterministic card, portrait, scene, and terrain composition path;
- add content-hash, provenance, recipe-version, and supersession records.

Runtime work:

- emit bounded theme, asset, narration, scene, and campaign command fixtures;
- originalize a franchise-inspired player request into a distinct theme brief;
- preserve semantic continuity references without provider-specific prompts;
- consume GameFrame projection and outcome fixtures.

**Done when:** compact compatibility tests prove command, presentation, projection, theme, media, error, cursor, and encounter fixtures remain schema-compatible and deterministic assets require no live provider.

## P5 — Real campaign-to-encounter vertical slice

Connect the GameFrame shell to the runtime's first deterministic or scripted campaign implementation through the staging Cloudflare path.

Slice content:

- campaign creation from a requested theme;
- one party and two player characters;
- two or three linked scenes;
- one recurring NPC and one recurring location;
- public and private information;
- freeform action interpretation;
- one noncombat check and consequence;
- one bounded choice;
- cached or composed scene, portrait, item, and terrain presentation;
- one tactical encounter;
- structured outcome application;
- resumed narration and later-session recovery.

**Done when:** an automated end-to-end journey proves invitation → themed campaign → scenes → encounter → outcome → resumed campaign, including forced disconnect, Durable Object eviction, and exact retry.

## P6 — First playable campaign systems

Promote only systems required by the first real campaign:

- inventory and equipment;
- abilities and conditions;
- quests and objectives;
- progression, injuries, rest, and recovery;
- location and point-of-interest exploration;
- recurring asset and audio references;
- operator inspection, correction, moderation, and asset replacement tools;
- Theo's ordinary GameFrame player connector.

Every promoted mechanic requires an explicit owner, versioned schema, persistence rule, player projection, UI, migration posture, and tests.

**Done when:** a short multi-session campaign can be completed by human players and Theo without developer intervention for ordinary state changes.

## P7 — Queued custom art and basic narration audio

Add optional enrichment only after deterministic campaign play is reliable.

Required work:

- provider-neutral media and speech adapters;
- asynchronous queue producer and consumer paths;
- object storage for accepted binaries and derivatives;
- idempotent job receipts and duplicate-delivery handling;
- provider timeout, retry, rate, and cost budgets;
- prompt compiler and recipe versioning;
- validation, moderation, recognizable-copy rejection, and provenance;
- placeholder-first delivery and bounded replacement events;
- one economical default narrator voice with captions and text fallback;
- accepted asset reuse across reconnect and later sessions.

**Done when:** a provider can fail, time out, or exhaust budget while legal play continues; accepted art and audio remain stable and reusable.

## P8 — Production GM and operational quality

- production language-model routing and deterministic fallback;
- bounded context compilation and NPC continuity evaluation;
- pacing, narration, consequence, and difficulty tuning;
- higher-quality optional image and voice providers;
- campaign and provider observability;
- cost, latency, cache-hit, rejection, and continuity metrics;
- export, backup, recovery, deletion, retention, and incident procedures;
- staging-to-production deployment gates;
- real Discord desktop and mobile acceptance;
- operator-controlled rollout and rollback.

**Done when:** model, media, audio, Discord, browser, Worker, or Durable Object failure reduces quality or availability in a bounded way without corrupting campaign truth or silently exposing private information.

## Parallel work rule

GameFrame builds player-facing behavior, Cloudflare boundaries, and media orchestration against deterministic fixtures while RPG GM Runtime builds campaign semantics against mock GameFrame ports. Production integration begins only from frozen versioned fixtures.

## Scope-control rule

All-GameFrame does not mean implementing a generalized CRPG engine before the first campaign. Use reusable presentation primitives and runtime-owned semantic state until repeated player value justifies promotion into a structured mechanic.

## Validation posture

- Public GameFrame repository checks use GitHub-hosted runners.
- Routine RPG Runtime checks use GitHub-hosted runners.
- Jobs expected to exceed 30 minutes use the designated self-hosted runner only where repository policy permits.
- Cross-repository fixture and shared-document checks remain compact enough for ordinary pull requests.
- Cloudflare, Discord, provider, and public-network behavior require explicit staging canaries and are not claimed by repository-only tests.
- Full inherited baselines are scheduled or manually dispatched and do not block every documentation or focused feature slice.
