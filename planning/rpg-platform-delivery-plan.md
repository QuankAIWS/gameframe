---
title: RPG Platform Delivery Plan
status: active
document_type: plan
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
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
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-cross-repository-integration-testing.md
related:
  - tactical-battler-rpg-foundation.md
  - shared/shared-rpg-documents.json
---

# RPG Platform Delivery Plan

## Goal

Deliver one persistent Monster Master RPG campaign played entirely through GameFrame and hosted through Cloudflare. Human players and Theo must be able to join through authenticated GameFrame seats, experience several scenes, submit actions, complete an Arena Battles tactical encounter, receive its consequences, disconnect, and resume without continuity loss.

The first complete proof uses a bespoke Monster Master asset pack and deterministic fallbacks. Arbitrary theme-on-demand generation expands the proven platform later; it is not required to prove that the Game Master can run a campaign.

No production player journey depends on Tailscale.

## Planning rules

- Use Monster Master RPG as the canonical reference campaign.
- Treat the existing tactical game as the future **Monster Master: Arena Battles** product; preserve current identifiers until a separate migration is approved and implemented.
- Build production boundaries against deterministic fixtures before adding live model or media providers.
- Keep campaign and encounter commits independent from slow inference and media work.
- Prefer prepared catalogs and deterministic composition before generation.
- Promote repeated narrative concepts into structured GameFrame mechanics only when product value justifies schema, persistence, UI, migration, and testing cost.
- Freeze cross-repository fixtures before production adapters.
- Use mocks for fast runtime behavior, shared fixtures for contract stability, the actual GameFrame checkout for integration truth, local workerd for Cloudflare-state truth, and deployed staging for public-system truth.
- Every phase has an automated exit gate and a visible player journey.

## P0 — Direction, shared documents, and synchronization

- Merge the all-GameFrame product decision in both repositories.
- Merge the shared product goals, Cloudflare architecture, media pipeline, Monster Master reference campaign, and cross-repository testing documents.
- Maintain `planning/shared/shared-rpg-documents.json` as the canonical manifest.
- Mirror every listed document and the manifest into the private runtime through one sync command.
- Keep an exact-byte pull-request, `main`, manual, and scheduled drift check in the runtime.
- Standardize YAML front matter for canonical RPG Markdown.
- Freeze initial names for campaign session, command, presentation, projection, theme, asset, narration, and encounter fixtures.

**Done when:** the manifest-driven runtime sync and drift check pass, no controlling document treats Discord-first versus GameFrame-primary as unresolved, and no product journey requires Tailscale.

## P1 — Cloudflare production spine

Build the public deployment path before the full campaign feature set.

Required work:

- deploy the existing GameFrame Worker and Durable Object foundation to staging;
- preserve ordinary browser and Discord Activity entry through the same application;
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
- character, party, creature roster, inventory, quest, and objective drawers using fixture data;
- location, route, point-of-interest, map, and handout presentation primitives;
- public, party-private, and player-private projections;
- responsive desktop and mobile behavior;
- polling and projection reconnect;
- text-first accessibility and media placeholders.

**Done when:** two authenticated browser seats can run a scripted Monster Master multi-scene fixture, receive different private information, submit commands, resolve a check, disconnect, and resume.

## P3 — Transport-neutral contracts and test scaffolding

Implement version 1 domain ports and validators independently of HTTP, Workers, Durable Objects, queues, or WebSockets. Then add production-shaped adapters using existing GameFrame authority patterns.

Required contract families:

- attach or resume campaign player;
- fetch player projection and missed presentation events;
- submit freeform action, choice, inspection, and acknowledgement commands;
- publish scene, dialogue, card, check, reveal, map, recap, and media-reference events;
- request asset and narration intents;
- launch, fetch, cancel, complete, and acknowledge encounters;
- return stable errors, limits, revisions, cursors, and retry receipts.

Required test scaffolding:

- runtime mock GameFrame port;
- versioned shared fixtures consumed by both repositories;
- machine-readable runtime compatibility lock for the accepted GameFrame commit;
- runtime-owned GitHub-hosted lane that checks out and starts the actual public GameFrame repository;
- separate scheduled watch against current GameFrame `main`.

**Done when:** conformance tests cover identity, audience, bounds, stale revisions, exact retry, conflicting command reuse, reconnect, unsupported versions, and the runtime can start and interrogate the pinned actual GameFrame server on a GitHub-hosted runner.

## P4 — Prepared Monster Master pack and Arena Battles integration

GameFrame work:

- establish the bespoke Monster Master theme and asset manifest;
- provide prepared trainer, NPC, creature, location, terrain, item, quest, faction, effect, and UI assets or deterministic fallbacks;
- preserve stable asset IDs, provenance, rights notes, derivative recipes, and supersession;
- expose the existing tactical game as the Arena Battles foundation without prematurely changing internal identifiers;
- add deterministic reference campaign fixtures and browser states.

Runtime work:

- emit bounded Monster Master scene, character, creature, quest, check, media, narration, and encounter fixtures;
- preserve semantic continuity without provider-specific prompts;
- consume GameFrame projections and actual tactical outcomes;
- run the reference fixture through mock and actual GameFrame connectors.

**Done when:** the reference chapter can use prepared assets, enter an actual GameFrame tactical match in the Node integration lane, receive a structured outcome, and resume the scripted campaign without a live model or media provider.

## P5 — Model-directed Monster Master vertical slice

Connect the shell to RPG GM Runtime through the staging Cloudflare path while retaining the prepared Monster Master content and asset pack.

Slice content:

- one starting settlement or academy and one nearby route;
- one party, two player characters, and a bounded starter creature roster;
- one mentor, one recurring rival, and one antagonist or faction;
- two or three linked scenes;
- public and player-private information;
- freeform social or investigative action;
- one noncombat check and consequence;
- one bounded persistent choice;
- one Arena Battles tactical encounter;
- structured survivors, injuries, rewards, objectives, and relationship consequences;
- resumed narration, process restart, Durable Object eviction, and later-session recovery.

Testing:

- ordinary runtime behavior remains covered by mock ports;
- required integration uses the pinned real GameFrame checkout;
- a focused local workerd lane proves Worker and Durable Object persistence;
- deployed staging proves Discord invitation and public-network resume.

**Done when:** an automated journey proves invitation → Monster Master scenes → Arena Battles → outcome → resumed campaign, including exact retry, restart, eviction, and correctly scoped private information.

## P6 — First playable Monster Master RPG systems

Promote only systems required by the first real campaign:

- creature roster, collection, training, relationships, injuries, and recovery;
- inventory and equipment;
- abilities and conditions;
- quests and objectives;
- progression and rest;
- location and point-of-interest exploration;
- recurring asset and audio references;
- operator inspection, correction, moderation, and asset replacement tools;
- Theo's ordinary GameFrame player connector.

Every promoted mechanic requires an explicit owner, versioned schema, persistence rule, player projection, UI, migration posture, and tests.

**Done when:** a short multi-session Monster Master campaign can be completed by human players and Theo without developer intervention for ordinary state changes.

## P7 — Platform expansion and optional generated media

After Monster Master RPG is stable:

- prove a second materially different prepared theme pack;
- implement inspiration-to-original theme translation against bounded fixtures;
- add provider-neutral image and speech adapters;
- add asynchronous queue producer and consumer paths;
- store accepted binaries and derivatives in object storage;
- enforce idempotent jobs, budgets, validation, moderation, provenance, and recognizable-copy rejection;
- deliver placeholders first and bounded replacements later;
- add one economical narrator voice with captions and text fallback;
- reuse accepted art and audio after reconnect and across sessions.

**Done when:** the same campaign platform can run a non-Monster-Master prepared theme and can optionally enrich a campaign through generated assets or synthesized narration without making either provider a gameplay dependency.

## P8 — Production GM and operational quality

- production language-model routing and deterministic fallback;
- bounded context compilation and NPC continuity evaluation;
- pacing, narration, consequence, and difficulty tuning;
- higher-quality optional image and voice providers;
- campaign and provider observability;
- cost, latency, cache-hit, rejection, continuity, and integration-watch metrics;
- export, backup, recovery, deletion, retention, and incident procedures;
- staging-to-production deployment gates;
- real Discord desktop and mobile acceptance;
- operator-controlled rollout and rollback.

**Done when:** model, media, audio, Discord, browser, Worker, Durable Object, or cross-repository integration failure reduces quality or availability in a bounded way without corrupting campaign truth or exposing private information.

## Parallel work rule

GameFrame builds player-facing behavior, Cloudflare boundaries, prepared assets, and media orchestration against deterministic fixtures while RPG GM Runtime builds campaign semantics against mock GameFrame ports. Production integration begins only from frozen versioned fixtures.

## Scope-control rule

All-GameFrame does not mean implementing a generalized CRPG engine before the reference campaign works. Use reusable presentation primitives and runtime-owned semantic state until repeated player value justifies promotion into a structured mechanic.

Theme-on-demand does not outrank the reference campaign. The bespoke Monster Master pack is the stable test substrate used to distinguish Game Master defects from media-generation defects.

## Validation posture

- Public GameFrame repository checks use GitHub-hosted runners.
- Routine RPG Runtime checks use GitHub-hosted runners.
- The private runtime owns actual two-repository checkout and integration because GameFrame is public and the runtime is private.
- Required integration uses a pinned accepted GameFrame commit; a separate scheduled watch tests current GameFrame `main`.
- Jobs expected to exceed 30 minutes use the designated self-hosted runner only where runtime policy permits.
- Cross-repository fixture, shared-document, and focused Node integration checks remain compact enough for ordinary pull requests.
- Cloudflare, Discord, provider, and public-network behavior require explicit staging canaries and are not claimed by repository-only tests.
- Full inherited baselines remain scheduled or manually dispatched rather than blocking every focused change.
