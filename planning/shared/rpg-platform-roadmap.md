---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-07
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 3
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

## Status rule

This shared roadmap defines destination, milestone order, and exit gates. It intentionally does **not** maintain volatile repository implementation status.

Current implementation/evidence belongs in repository-local status and roadmap documents:

- GameFrame: `planning/ROADMAP.md` and the RPG documentation index;
- RPG GM Runtime: `docs/project-status.md` and `docs/implementation-plan.md`.

When code advances, update those local ledgers. Change this shared roadmap only when the cross-repository destination, ordering, or acceptance criteria change.

The platform already contains meaningful package, journal, command, persistence, GameFrame, Arena, and Dungeon Master substrate. Possessing a lower-level substrate does not satisfy a later milestone until that milestone's exit gate is actually exercised.

## Milestone 0 — Architecture and documentation baseline

- Keep the two-agent architecture and CampaignPackage boundary canonical in GameFrame and mirrored into runtime.
- Use Campaign Architect and Dungeon Master as the official role names.
- Retire campaign compiler, plot agent, and intro agent as file names and compatibility surfaces.
- Remove or supersede plans that send raw premises directly to the Dungeon Master.
- Keep Monster Master identified as the handcrafted gold standard.
- Keep shared documents stable and push volatile evidence/status into repository-local ledgers.

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

Convert the Monster Master source material into one complete executable CampaignPackage.

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

Specialize the model-backed turn mechanism into the actual Dungeon Master agent.

Required behavior:

- opening is generated only after package commitment;
- context includes relevant package truth, current scene, players, NPC state, discovered information, active pressure, eligible events, and previous consequences;
- freeform text remains primary;
- model output is structured and validated;
- local improvisation is allowed without changing package invariants;
- state changes are committed before player presentation;
- exact retry reuses committed turns;
- one Dungeon Master path serves Monster Master and future packages.

Security/correctness boundary:

- hidden campaign truth may inform a semantic decision;
- player-facing prose must be rendered from player-safe/authorized knowledge rather than from unrestricted hidden context;
- one turn may produce multiple explicitly audience-scoped presentation events.

**Exit gate:** the handcrafted Monster Master package produces a coherent opening and multiple subsequent turns through the same Dungeon Master path without unauthorized knowledge flow.

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
- unknown entities are not exposed merely by redacted placeholders or IDs;
- NPC identities and relationships persist;
- recovery routes remain available;
- consequences accumulate coherently;
- the session reaches a valid resolution or tactical threshold.

**Exit gate:** deterministic machine-play completes the Monster Master package without plot drift, secret leakage, or dead-end state.

## Milestone 5 — Checks, event progression, and tactical handoff

Implement only mechanics required by the gold-standard campaign.

- deterministic noncombat check authority;
- clue discovery and confidence state;
- small executable event-eligibility predicates plus authoring guidance;
- consequence application;
- durable tactical encounter request;
- exact campaign participant identity through GameFrame encounter authority;
- Arena Battles launch through GameFrame authority;
- structured terminal participant outcome retrieval;
- campaign consequence application and resumed narration.

Do not build a generalized RPG rule DSL merely to express the first package. Add only executable primitives demonstrated by actual package needs.

**Exit gate:** the Monster Master campaign enters and returns from the actual Arena Battles path with participant-faithful outcomes and can still reach a complete resolution.

## Milestone 6A — Complete single-player Monster Master engineering proof

Before multiplayer broadens the authority model, prove the entire product architecture with one authenticated human plus Monster Master BattleBot.

Required:

- real handcrafted package;
- configured Dungeon Master provider;
- multiple freeform turns;
- public/player-safe information handling;
- executable event progression;
- deterministic check;
- participant-faithful actual Arena match;
- exact terminal consequences;
- automatic aftermath;
- bounded campaign resolution;
- restart/resume of both services.

**Exit gate:** the complete one-human-plus-BattleBot campaign passes without fabricated tactical outcomes or developer intervention in ordinary execution. This proves the full-stack architecture but not multiplayer behavior.

## Milestone 6B — Playable two-human Monster Master through GameFrame

Add the multiplayer lifecycle only after the single-player architecture is proven.

Required runtime work:

- campaign join distinct from campaign startup;
- explicit party assignment and party-scoped knowledge;
- per-player roster/knowledge initialization;
- resume/recap behavior for joined players.

Required GameFrame/Arena work:

- authenticated invitations and membership;
- public, party, and player-private presentation;
- team-aware cooperative encounter control without mapping allied humans onto opposing duel seats;
- exact participant/unit authorization and terminal outcomes;
- reconnect, recap, restart, and resume;
- desktop and mobile acceptance;
- text-first operation when media is missing.

**Exit gate:** two authenticated human players can complete the bounded Monster Master campaign, including a real cooperative Arena encounter, without developer intervention for ordinary play.

## Milestone 7 — Campaign Architect implementation

Implement the campaign-authoring agent only after the package contract and Dungeon Master requirements are proven by Monster Master.

Before starting the Campaign Architect, run at least one materially different second handcrafted package through the same package validator and Dungeon Master path. If the second package requires a Monster-Master-specific Dungeon Master execution branch, repair the abstraction first.

Initial Campaign Architect inputs:

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

Deployment work should maintain a runnable environment, but additional hardening must not outrank the package, Dungeon Master, tactical fidelity, and complete campaign gates unless a concrete deployment defect blocks campaign development or testing.

Cloudflare-native state migration remains optional and evidence-driven. Cloudflare image generation belongs to campaign preparation and media materialization, not campaign authority.

## Validation policy

Every milestone requires focused machine evidence. Use:

- schema and unit tests for package invariants;
- mock providers and scripted players for agent behavior;
- actual cross-repository Node integration for contract truth;
- durable local services for restart and persistence truth;
- complete single-player campaign proof before multiplayer claims;
- two-human integration for party/team claims;
- browser tests for player experience;
- VM canaries for public deployment claims;
- separate media and Cloudflare canaries for provider-specific claims.

Do not claim RPG functionality from transport tests, catalog-shape tests, a single canned opening, or a lower evidence layer.

## Priority rule

The order of importance is:

1. executable CampaignPackage;
2. handcrafted Monster Master package;
3. package-aware Dungeon Master;
4. machine-play campaign proof;
5. truthful Arena participant/configuration handoff;
6. complete single-player Monster Master journey;
7. two-human join/party/cooperative journey;
8. second handcrafted package proving generality;
9. Campaign Architect generated-campaign proof;
10. richer intake and generated media;
11. broader mechanics, scale, and operational polish.

## Governing rule

> Prove the package boundary with Monster Master, secure and prove the Dungeon Master with machine-play, prove the complete single-player architecture, then add multiplayer and only afterward automate campaign creation.