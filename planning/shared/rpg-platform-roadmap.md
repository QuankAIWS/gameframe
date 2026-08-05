---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-roadmap.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-roadmap.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cross-repository-integration-testing.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Roadmap

## Objective

Build a reusable RPG platform in which a Campaign Architect can create bespoke CampaignPackages and one Dungeon Master can run any validated package through GameFrame.

The first proof is a handcrafted Monster Master CampaignPackage. The next proof is a materially different bespoke package produced through the Campaign Architect boundary. Deployment, media generation, and richer mechanics support that product sequence; they do not replace it.

## Current foundation

Already present in partial form:

- durable GameFrame and runtime command transport;
- separate GameFrame coordination and runtime narrative authority;
- campaign journals and audience-scoped events;
- a model-call and structured Dungeon Master proposal mechanism;
- a text GameFrame RPG shell;
- Monster Master lore, plot-family sketches, event-pool sketches, NPC-role sketches, and deterministic fixtures;
- focused transport, persistence, restart, and cross-repository tests.

In active implementation:

- executable `CampaignPackageV1` schema and validator;
- one handcrafted Monster Master package with deterministic placeholder assets;
- package commitment and bounded projection into Dungeon Master context;
- package-first local Dungeon Master play.

Not yet complete:

- Campaign Architect port and implementation;
- campaign-aware multi-turn Dungeon Master behavior tests;
- event eligibility, clue state, incidental NPC instantiation, checks, and tactical return as one campaign loop;
- complete GameFrame placeholder rendering and player journey;
- generated bespoke campaign proof.

## Milestone 0 — Architecture and documentation baseline

- Keep the two-agent architecture and CampaignPackage boundary canonical in GameFrame and mirrored into runtime.
- Use Campaign Architect and Dungeon Master as the official role names.
- Retire campaign compiler, plot agent, and intro agent as file names and compatibility surfaces.
- Remove or supersede plans that send raw premises directly to the Dungeon Master.
- Keep Monster Master identified as the handcrafted gold standard.

**Exit gate:** documentation indexes, local architecture documents, shared contracts, and roadmaps agree on one architecture and implementation order.

## Milestone 1 — Executable CampaignPackage contract

Implement the smallest complete package substrate before building more agent behavior.

Required runtime work:

- versioned `CampaignPackageV1`;
- strict validation and bounded schemas;
- visibility scopes;
- package hash and provenance;
- persistence, reload, migration posture, and immutable commitment events;
- bounded package context supplied to the Dungeon Master without truncation;
- player-safe projection separated from runtime-only truth.

Required GameFrame work:

- capability declaration supplied to package validation;
- player-safe package preview primitives;
- deterministic placeholders for unresolved semantic assets.

**Exit gate:** the handcrafted Monster Master package validates, serializes, commits, reloads, and projects without semantic loss or secret leakage.

## Milestone 2 — Handcrafted Monster Master gold-standard package

Convert the current Monster Master source material into one complete executable CampaignPackage.

It must contain:

- campaign bible and operating rules;
- player roles and group-cohesion mechanism;
- actual opening situation;
- fixed hidden truth;
- actual major actors and locations;
- clue and evidence graph;
- event eligibility and pressure material;
- multiple credible approaches;
- check and tactical opportunities;
- complete resolution conditions;
- optional continuation seed;
- semantic asset manifest and deterministic fallbacks.

Keep additional plot families as future packages or package templates rather than pretending the entire catalog is already executable.

**Exit gate:** the package passes validation and can be committed without a model or media provider.

## Milestone 3 — Dungeon Master consumes committed packages

Specialize the existing model-backed turn mechanism into the actual Dungeon Master agent.

Required behavior:

- opening is generated only after package commitment;
- context includes relevant package truth, current scene, players, NPC state, discovered information, active pressure, eligible events, and previous consequences;
- freeform text remains primary;
- model output is structured and validated;
- local improvisation is allowed without changing package invariants;
- state changes are committed before player presentation;
- exact retry reuses committed turns;
- one Dungeon Master path serves Monster Master and future packages.

**Exit gate:** the handcrafted Monster Master package produces a coherent opening and multiple subsequent turns through the same Dungeon Master path.

## Milestone 4 — Machine-play Dungeon Master harness

Build campaign-behavior testing before relying on human playtest feedback.

Required fixtures:

- mock Dungeon Master provider;
- scripted players;
- at least two player behavior profiles;
- multi-turn transcript and state assertions;
- early correct guess;
- ignored or missed clue;
- refusal of the obvious assignment;
- unexpected social or practical action;
- incidental NPC creation and later revisit;
- partial and paraphrased secret-leak attempts;
- exact retry and restart.

Required assertions:

- package truth remains unchanged;
- audience scopes remain correct;
- NPC identities and relationships persist;
- recovery routes remain available;
- consequences accumulate coherently;
- the session reaches a valid resolution or tactical threshold.

**Exit gate:** deterministic machine-play completes the Monster Master package without plot drift, secret leakage, or dead-end state.

## Milestone 5 — Checks, event progression, and tactical handoff

Implement only mechanics required by the gold-standard campaign.

- deterministic noncombat check authority;
- clue discovery and confidence state;
- event eligibility and pressure progression;
- consequence application;
- durable tactical encounter request;
- Arena Battles launch through GameFrame authority;
- structured terminal outcome retrieval;
- campaign consequence application and resumed narration.

**Exit gate:** the Monster Master campaign enters and returns from the actual Arena Battles path and can still reach a complete resolution.

## Milestone 6 — Playable Monster Master through GameFrame

Connect the proven package and Dungeon Master loop to the player product.

- campaign creation or selection;
- authenticated membership and invitations;
- freeform action submission;
- public, party, and player-private presentation;
- package preview and placeholder asset resolution;
- character, creature, quest, clue, condition, and objective views needed by the package;
- reconnect, recap, restart, and resume;
- desktop and mobile acceptance;
- text-first operation when media is missing.

**Exit gate:** human players can complete the bounded Monster Master campaign without developer intervention for ordinary play.

## Milestone 7 — Campaign Architect implementation

Implement the campaign-authoring agent only after the package contract and Dungeon Master requirements are proven by Monster Master.

Initial inputs:

- concise freeform concept;
- structured owner or test brief;
- prepared mechanic and theme capabilities.

Initial outputs:

- one validated CampaignPackage;
- explicit assumptions and repair requests;
- originality transformation record;
- semantic asset and media intents;
- deterministic provenance and package hash.

Initial tests should create at least two materially different original campaigns, including an original medieval supernatural-response concept and an original 1920s steampunk paranormal-response concept.

**Exit gate:** Campaign Architect output passes the same validator and Dungeon Master machine-play harness as Monster Master without a campaign-specific Dungeon Master code path.

## Milestone 8 — Rich campaign intake

- versioned `CampaignBriefV1`;
- player-facing campaign sheet;
- guided clarification and repair;
- interactive GameFrame creation flow;
- optional Discord interview flow;
- preview and confirmation of player-safe assumptions;
- operator review and amendment tools;
- package versioning and explicit recompilation policy.

**Exit gate:** a player can move from a short idea or guided interview to an accepted CampaignPackage without seeing hidden campaign truth.

## Milestone 9 — Campaign media materialization

Integrate the Campaign Architect with the GameFrame-owned media pipeline.

- semantic campaign theme and asset intents;
- prepared catalog reuse;
- deterministic composition;
- Cloudflare-backed or provider-neutral image generation when available;
- recurring character and location continuity;
- validation, provenance, moderation, budgets, caching, and replacement;
- text and placeholder fallbacks at every step.

The Campaign Architect declares what the campaign needs. GameFrame resolves and stores it. The Dungeon Master uses accepted identities during play.

**Exit gate:** a generated bespoke campaign receives a coherent accepted asset pack without making media generation a gameplay dependency.

## Milestone 10 — Multi-session systems and operational quality

Promote only systems proven necessary by playable campaigns:

- progression, rest, inventory, equipment, injuries, and recovery;
- recurring quests, factions, relationships, and locations;
- campaign inspection and correction;
- exports, backups, restore, retention, and deletion;
- provider, storage, tunnel, and service observability;
- cost, latency, continuity, and failure metrics;
- Theo as an ordinary GameFrame player;
- staged rollout and rollback.

**Exit gate:** multiple handcrafted and generated campaigns run across sessions without authority drift or routine operator repair.

## Deployment sequencing

The first production topology remains separate GameFrame and RPG GM Runtime services on one VM. Cloudflare exposes GameFrame only. Runtime, databases, and administration remain private.

Deployment work should maintain a runnable environment, but additional hardening must not outrank Milestones 1 through 7 unless a concrete deployment defect blocks campaign development or testing.

Cloudflare-native state migration remains optional and evidence-driven. Cloudflare image generation belongs to campaign preparation and media materialization, not campaign authority.

## Validation policy

Every milestone requires focused machine evidence. Use:

- schema and unit tests for package invariants;
- mock providers and scripted players for agent behavior;
- actual cross-repository Node integration for contract truth;
- durable local services for restart and persistence truth;
- browser tests for player experience;
- VM canaries for public deployment claims;
- separate media and Cloudflare canaries for provider-specific claims.

Do not claim RPG functionality from transport tests, catalog-shape tests, or a single canned opening.

## Priority rule

The order of importance is:

1. executable CampaignPackage;
2. handcrafted Monster Master package;
3. package-aware Dungeon Master;
4. machine-play campaign proof;
5. complete Monster Master player journey;
6. Campaign Architect generated-campaign proof;
7. richer intake and generated media;
8. broader mechanics, scale, and operational polish.

## Governing rule

> Prove the package boundary with Monster Master, prove the Dungeon Master with machine-play, then build the Campaign Architect to create new packages of the same quality.
