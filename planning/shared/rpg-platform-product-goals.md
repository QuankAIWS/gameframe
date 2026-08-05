---
title: RPG Platform Product Goals
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
shared_document_id: rpg-platform-product-goals-v1
shared_document_version: 3
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-product-goals.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-product-goals.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-platform-roadmap.md
  - ../rpg-campaign-experience-directions.md
  - ../rpg-gm-runtime-boundary.md
  - rpg-cloudflare-deployment-architecture.md
  - rpg-media-theme-and-audio-pipeline.md
---

# RPG Platform Product Goals

## Product statement

The RPG platform is a persistent, publicly accessible role-playing system played through GameFrame.

A specialized Campaign Architect creates validated CampaignPackages. A specialized Dungeon Master runs committed packages through freeform play. GameFrame presents the complete player experience and owns deterministic mechanics and tactical authority.

The first campaign proof is the handcrafted Monster Master gold-standard package. The next platform proof is a materially different bespoke package created through the Campaign Architect boundary and run by the same Dungeon Master.

## Settled architecture

### Campaign Architect

The Campaign Architect converts a concise concept, detailed specification, structured sheet, later GameFrame or Discord interview, prepared campaign family, or imported package into one validated CampaignPackage.

It owns campaign construction, not live play.

### Dungeon Master

The Dungeon Master consumes a committed CampaignPackage and durable campaign state. It owns narration, NPC performance, freeform interpretation, pacing, eligible events, compatible improvisation, and campaign consequences.

It may not replace package truth or use a separate campaign-specific execution path.

### CampaignPackage

Handcrafted and generated campaigns use the same package schema, validation, persistence, commitment, visibility, and Dungeon Master interface.

Monster Master is manually authored to establish the expected package quality.

## One complete GameFrame experience

GameFrame is the primary and authoritative player-facing application for:

- campaign concept submission, package preview, joining, invitations, and resume;
- narration, scenes, dialogue, freeform actions, optional suggestions, and structured choices;
- characters, creatures, abilities, conditions, inventory, equipment, progression, quests, clues, and objectives;
- maps, exploration, locations, points of interest, checks, handouts, and player-private information;
- tactical encounters and return to the surrounding campaign;
- history, recap, reconnect, recovery, and later-session continuation;
- presentation of accepted campaign art, animation, sound, music, and narration.

Discord may provide authentication, invitations, voice, social conversation, notifications, links, and a future campaign-intake interview. Discord does not own campaign truth or ordinary gameplay.

## Persistent campaign goal

Campaigns are durable products, not disposable model conversations.

The platform must support:

- authoritative CampaignPackages and campaign journals;
- campaigns continuing across sessions;
- audience-scoped secrets;
- stable player, character, NPC, location, item, faction, quest, encounter, and asset identities;
- deterministic retry and reconnect;
- operator inspection and explicit correction;
- backup, restore, recap, and resume;
- separate GameFrame coordination and runtime narrative authority.

Storage adapters may change without changing these product properties.

## Creative flexibility

Bespoke campaign creation is a core platform goal, but not the first implementation prerequisite.

Players should eventually be able to request concepts such as:

- an original medieval supernatural-response campaign;
- an original 1920s steampunk paranormal-response campaign;
- western, gothic horror, undersea workplace comedy, science-fiction mystery, mythic adventure, or other broad themes.

The Campaign Architect turns the request into an original campaign identity, complete CampaignPackage, and semantic asset plan.

The system preserves desired high-level qualities while replacing protected names, characters, organizations, creatures, terminology, plots, logos, and signature designs. Transformation and review are product controls, not guarantees of legal clearance.

## Ownership principle

> The Campaign Architect defines the campaign package; the Dungeon Master conducts the campaign; GameFrame turns the campaign into a coherent player experience and authoritative mechanics.

### RPG GM Runtime owns

- Campaign Architect and Dungeon Master orchestration;
- CampaignBrief and CampaignPackage schemas;
- package validation, hashing, persistence, migration, and hidden truth;
- runtime campaign journal and narrative revision;
- NPC motives, memories, relationships, clues, events, and consequences;
- freeform player-intent interpretation;
- audience classification;
- model context, provider routing, proposal validation, retry, and fallback;
- semantic media and mechanic intents;
- mapping GameFrame outcomes into campaign consequences.

### GameFrame owns

- complete authenticated campaign creation and play interfaces;
- player commands, identity, seats, invitations, and projections;
- player-safe package preview and confirmation;
- structured mechanics deliberately implemented in GameFrame;
- Arena Battles authority, replay, reconnect, and committed outcomes;
- semantic asset catalogs, composition, generation, validation, provenance, storage, delivery, and fallback;
- narration synthesis and playback;
- desktop, mobile, browser, and Discord Activity presentation.

### Scribbles Runtime owns

- Theo's behavior and the narrow connector allowing Theo to occupy an ordinary GameFrame player seat.

Theo is never the Campaign Architect or Dungeon Master and receives no hidden campaign state.

## Media and audio goals

Generated or composed media is a campaign-preparation and presentation capability, not campaign authority.

The Campaign Architect declares semantic requirements and importance. GameFrame should:

1. reuse accepted catalog assets when suitable;
2. compose deterministic assets where practical;
3. generate new assets asynchronously when justified;
4. preserve recurring identity and provenance;
5. validate and moderate outputs;
6. enforce budgets and provider limits;
7. display placeholders or text immediately;
8. replace presentation assets without altering campaign truth.

Cloudflare-backed image generation should eventually help the Campaign Architect materialize complete campaign packs. It is not required to prove CampaignPackage logic or Dungeon Master behavior.

## Deployment goals

The first production profile should:

1. run GameFrame and RPG GM Runtime as separate services on one dedicated VM;
2. expose only GameFrame through Cloudflare;
3. require no inbound router forwarding or player VPN;
4. keep runtime, databases, and administration private;
5. persist each authority domain separately;
6. allow independent deployment and rollback;
7. support backup, restore, observability, and recovery;
8. retain an evidence-based path to later Cloudflare-native migration.

Deployment must remain runnable, but additional hardening does not outrank the executable package and agent loop unless a concrete defect blocks development or play.

## Product quality goals

The system should be:

- coherent enough to feel authored rather than like disconnected AI demonstrations;
- capable of multiple campaign genres without separate Dungeon Master code paths;
- durable across provider failure and long gaps;
- resistant to plot drift and secret leakage;
- visually consistent across recurring campaign identities;
- responsive on desktop and mobile;
- inspectable and recoverable;
- machine-testable through mock providers and scripted players;
- provider-flexible for language, image, audio, storage, and delivery;
- explicit about identity, audience, provenance, revision, and authority.

## First product proof — Monster Master

The first convincing proof is complete when players can:

1. enter one handcrafted and validated Monster Master CampaignPackage;
2. receive a Dungeon Master opening derived from the committed package;
3. submit arbitrary freeform actions across multiple scenes;
4. encounter coherent NPCs, clues, events, checks, and consequences;
5. receive correctly scoped public and private information;
6. enter and complete an Arena Battles encounter;
7. return with the tactical outcome applied;
8. disconnect, restart services, and resume without package drift or duplicated commands;
9. complete a bounded campaign resolution;
10. play through text and deterministic fallbacks when media is missing.

This proof must be machine-tested before being treated as human-ready.

## Second product proof — Campaign Architect

The next major proof is complete when:

1. a player or test supplies a materially different concept;
2. the Campaign Architect produces an original validated CampaignPackage;
3. the package passes the same validator used by Monster Master;
4. the same Dungeon Master runs it without campaign-specific code;
5. scripted players complete the package without plot drift or secret leakage;
6. GameFrame presents it through existing primitives and accepted fallbacks.

A medieval supernatural-response package and a 1920s steampunk paranormal-response package are suitable initial tests, provided they are original rather than direct franchise copies.

## Later product expansion

After both proofs:

- structured campaign sheets;
- guided GameFrame creation;
- Discord interviews;
- Campaign Architect repair and operator review;
- Cloudflare-backed campaign image generation;
- richer multi-session systems;
- additional prepared themes;
- Theo participation;
- optional Cloudflare-native state migration;
- production operational quality.

## Non-goals

The product direction does not require:

- sending raw premises directly to the Dungeon Master;
- a separate Monster Master Dungeon Master;
- a third intro agent;
- every improvised object becoming a custom mechanic;
- generated media before campaign logic works;
- a new image for every action;
- Tailscale or router forwarding for players;
- Cloudflare-native stateful compute before the VM profile works;
- direct copying of protected campaigns or media;
- merging all repositories, services, or databases.

## Governing rule

> Prove the two-agent system with one handcrafted Monster Master package, then prove the Campaign Architect can create a different package that the same Dungeon Master can run.
