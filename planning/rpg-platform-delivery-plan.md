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

Deliver one persistent Monster Master RPG campaign played entirely through GameFrame and publicly reachable through Cloudflare. Human players and Theo must be able to join authenticated GameFrame seats, experience several scenes, submit actions, complete an Arena Battles tactical encounter, receive its consequences, disconnect, and resume without continuity loss.

The first production profile runs GameFrame and RPG GM Runtime as separate services on one dedicated VM. Cloudflare Tunnel exposes only GameFrame without router port forwarding. Cloudflare-native stateful compute remains a later migration target.

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
- Use mocks for fast runtime behavior, shared fixtures for contract stability, the actual GameFrame checkout for integration truth, durable local adapters for first-production state truth, VM staging through Cloudflare Tunnel for public-system truth, and Cloudflare-native tests only for an active migration.
- During rapid co-development, test against current GameFrame `main` or a trusted coordinated `agent/*` branch and record the resolved SHA.
- Preserve separate GameFrame coordination and RPG GM Runtime narrative revisions.
- Every phase has an automated exit gate and a visible player journey.

## P0 — Direction, shared documents, and synchronization

- Maintain the all-GameFrame product decision in both repositories.
- Maintain shared product goals, deployment architecture, media pipeline, Monster Master reference campaign, and cross-repository testing documents.
- Maintain `planning/shared/shared-rpg-documents.json` as the canonical manifest.
- Mirror every listed document and the manifest into the private runtime through one sync command.
- Keep an exact-byte pull-request, `main`, manual, and scheduled drift check in the runtime.
- Standardize YAML front matter for canonical RPG Markdown.
- Freeze initial campaign session, command, presentation, projection, theme, asset, narration, and encounter fixture names.

**Done when:** manifest-driven runtime synchronization passes, no controlling document treats Discord-first versus GameFrame-primary as unresolved, the first deployment is consistently VM-first, and no player journey requires Tailscale or router port forwarding.

## P1 — Initial VM production spine

Build the real first deployment boundary before depending on a full campaign feature set.

Required GameFrame work:

- define a production Node entry point distinct from development-only identity behavior;
- replace in-memory authoritative stores with repository interfaces backed by durable local adapters;
- persist invitations, membership, command receipts, coordination revisions, projections, match state, encounter state, replay, and terminal outcomes;
- introduce explicit migrations and storage versioning;
- maintain server-derived Discord identity and secure session handling;
- expose health and readiness without exposing hidden state;
- serve prepared static assets with safe cache headers.

Required runtime work:

- expose an authenticated private service endpoint for GameFrame;
- persist runtime-owned campaign journal, narrative revision, semantic state, and accepted command receipts;
- recover after restart and lost response without duplicate events;
- keep provider credentials and runtime-only state outside GameFrame.

Required deployment work:

- run GameFrame, RPG GM Runtime, and `cloudflared` as separate containers or services on one dedicated VM;
- expose only GameFrame through Cloudflare Tunnel;
- open no application port on the home router;
- keep the GM service, databases, and administration private;
- provide separate volumes, secrets, health checks, restarts, and independently pinned releases;
- implement backup, restore, disk quotas, logs, and rollback;
- keep the production VM separate from general-purpose self-hosted CI execution.

**Done when:** two public-network users can authenticate, claim seats, exchange deterministic fixture commands, restart both services, and resume through the tunnel with no VPN, no direct origin route, no router forwarding, and no lost or duplicated authoritative state.

## P2 — Deterministic RPG shell in GameFrame

Build the complete campaign navigation and presentation shell against local durable fixtures before connecting a live model runtime.

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

**Done when:** two authenticated browser seats can run a scripted Monster Master multi-scene fixture, receive different private information, submit commands, resolve a check, restart GameFrame, and resume.

## P3 — Transport-neutral contracts and integration scaffolding

Implement versioned domain ports and validators independently of HTTP, VM storage, Workers, Durable Objects, queues, or WebSockets. Then add adapters using existing authority patterns.

Required contract families:

- attach or resume campaign player;
- fetch player projection and missed presentation events;
- submit freeform action, choice, inspection, and acknowledgement commands;
- publish scene, dialogue, card, check, reveal, map, recap, and media-reference events;
- request asset and narration intents;
- launch, fetch, cancel, complete, and acknowledge encounters;
- return stable errors, limits, revisions, cursors, and retry receipts;
- link GameFrame coordination revisions to runtime narrative commits without merging the revision domains.

Required test scaffolding:

- runtime mock GameFrame port;
- versioned shared fixtures consumed by both repositories;
- runtime-owned self-hosted workflow that checks out and starts the actual public GameFrame repository;
- default integration against current GameFrame `main` during active development;
- trusted canonical `agent/*` support for coordinated branch work;
- exact resolved GameFrame and runtime SHAs recorded with every integration result;
- a durable local service lane proving restart, retry, backup, and restore;
- a compatibility baseline only after stable contracts and the reference chapter justify release or rollback support.

**Done when:** conformance tests cover identity, audience, bounds, stale revisions, exact retry, conflicting command reuse, reconnect, unsupported versions, dual-revision linkage, and real two-repository integration.

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

**Done when:** the reference chapter uses prepared assets, enters an actual GameFrame tactical match, receives a structured outcome, and resumes the scripted campaign without a live model or media provider.

## P5 — Deterministic deployed reference campaign

Run the complete scripted Monster Master chapter through the VM staging profile.

Required journey:

- Discord invitation and authenticated seat claim;
- two or three campaign scenes;
- public and player-private information;
- freeform action, bounded choice, check, and consequence;
- one Arena Battles encounter;
- structured survivors, injuries, rewards, objectives, and relationship consequences;
- resumed narration;
- browser reconnect;
- GameFrame restart;
- RPG GM Runtime restart;
- backup and restore;
- no provider, VPN, or direct origin dependency.

**Done when:** an automated and operator-observed public journey proves invitation → campaign scenes → Arena Battles → outcome → resumed campaign through Cloudflare Tunnel with exact retry and recovery.

## P6 — Model-directed Monster Master vertical slice

Replace scripted runtime decisions incrementally with bounded model-backed proposals while retaining the same prepared campaign content and deployment profile.

Evaluate:

- scene pacing and continuity;
- NPC motives, memory, relationships, and dialogue;
- freeform intent interpretation;
- checks, choices, consequences, and encounter selection;
- context compilation and provider fallback;
- separation between generated prose and committed campaign events;
- restart recovery with in-flight or lost provider responses.

**Done when:** a model-directed Monster Master chapter completes the accepted deployed journey without changing authority boundaries or depending on generated media.

## P7 — First playable Monster Master RPG systems

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

## P8 — Optional Cloudflare-native scale migration and media expansion

Only after the VM profile is stable and measured requirements justify migration:

- move selected stateless routing or edge logic to a Worker;
- move large accepted artifacts to R2 or equivalent object storage;
- move slow idempotent jobs to Queues;
- prove Encounter Durable Object export, import, eviction, replay, and rollback before migrating tactical authority;
- prove Campaign Durable Object ownership, dual-revision linkage, projection recovery, export, import, and rollback before migrating GameFrame campaign coordination;
- record request, storage, duration, and cost behavior against the selected Cloudflare plan;
- prove a second materially different prepared theme pack;
- add inspiration-to-original theme translation;
- add provider-neutral image and speech adapters;
- deliver placeholders first and bounded replacements later;
- enforce idempotent jobs, budgets, validation, moderation, provenance, and recognizable-copy rejection.

**Done when:** selected Cloudflare-native components can replace their VM adapters without resetting campaigns, changing stable IDs, merging authority domains, exceeding approved budgets, or preventing rollback.

## P9 — Production GM and operational quality

- production language-model routing and deterministic fallback;
- bounded context compilation and NPC continuity evaluation;
- pacing, narration, consequence, and difficulty tuning;
- optional higher-quality image and voice providers;
- campaign, service, tunnel, provider, storage, and backup observability;
- cost, latency, cache-hit, rejection, continuity, and integration-watch metrics;
- export, backup, recovery, deletion, retention, and incident procedures;
- staging-to-production deployment gates;
- real Discord desktop and mobile acceptance;
- operator-controlled rollout and rollback.

**Done when:** model, media, audio, Discord, browser, tunnel, VM service, storage adapter, or cross-repository integration failure reduces quality or availability in a bounded way without corrupting campaign truth or exposing private information.

## Parallel work rule

GameFrame builds player-facing behavior, local persistence adapters, prepared assets, and public deployment boundaries against deterministic fixtures while RPG GM Runtime builds campaign semantics against mock GameFrame ports and its own durable journal. Integration proceeds through the versioned contract rather than shared storage.

## Scope-control rule

All-GameFrame does not mean implementing a generalized CRPG engine before the reference campaign works. Use reusable presentation primitives and runtime-owned semantic state until repeated player value justifies promotion into a structured mechanic.

Theme-on-demand and Cloudflare-native migration do not outrank the reference campaign. The bespoke Monster Master pack and VM profile are the stable substrate used to distinguish Game Master defects from media, migration, and provider defects.

## Validation posture

- Public GameFrame repository checks use GitHub-hosted runners under GameFrame policy.
- Every RPG GM Runtime workflow uses the designated self-hosted Debian runner.
- The private runtime owns actual two-repository checkout and integration because GameFrame is public and the runtime is private.
- During active development, integration tracks current GameFrame `main` or a trusted coordinated branch and records the exact resolved SHA.
- Cross-repository fixture, shared-document, and focused Node integration checks remain bounded and targeted.
- Durable local integration proves first-production persistence and restart behavior.
- Cloudflare Tunnel, Discord, router posture, and public-network behavior require explicit VM staging canaries.
- Workers, Durable Objects, Queues, and R2 claims require separate migration canaries and do not block the initial VM profile.
- Full inherited runtime baselines remain scheduled or manually dispatched rather than blocking every focused change.
