---
title: RPG Platform Product Goals
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
shared_document_id: rpg-platform-product-goals-v1
shared_document_version: 2
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-product-goals.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-product-goals.md
sync_policy: exact-byte-copy
related:
  - ../rpg-campaign-experience-directions.md
  - ../rpg-gm-runtime-boundary.md
  - rpg-cloudflare-deployment-architecture.md
  - rpg-media-theme-and-audio-pipeline.md
---

# RPG Platform Product Goals

## Product statement

The RPG platform is a persistent, publicly accessible, AI-directed role-playing game played entirely through GameFrame. Players may request nearly any genre, tone, or thematic inspiration, and the system should rapidly establish an original campaign presentation while preserving durable campaign continuity and authoritative mechanics.

The first production profile runs GameFrame and RPG GM Runtime as separate services on one dedicated VM and reaches ordinary players through Cloudflare Tunnel and the Cloudflare public edge. A later Cloudflare-native scale profile may move selected GameFrame responsibilities to Workers, Durable Objects, Queues, and object storage without changing the product or authority model.

RPG GM Runtime is the campaign intelligence behind the experience. GameFrame is the experience presented to players.

## Settled product direction

### One complete GameFrame experience

GameFrame is the primary and authoritative player-facing application for:

- campaign creation, joining, invitations, and resume;
- narration, scenes, dialogue, choices, and freeform actions;
- character sheets, abilities, conditions, inventory, equipment, progression, quests, and objectives;
- maps, exploration, locations, points of interest, checks, dice, handouts, and player-private information;
- tactical encounters and return to the surrounding campaign;
- campaign history, reconnect, recovery, and later-session continuation;
- presentation of campaign art, animation, sound, music, and synthesized narration.

Discord may provide authentication, invitations, voice, social conversation, notifications, and links into an active campaign. Discord is not the primary gameplay surface and does not own authoritative campaign state.

### Public Cloudflare edge

The production experience is publicly reachable through Cloudflare-facing services. Ordinary players must not require Tailscale, a private network, an operator VPN, a developer machine, direct access to the origin VM, or an opened router port.

The initial deployment uses Cloudflare DNS, TLS, CDN behavior, protection, and Tunnel in front of a private GameFrame origin. Cloudflare stateful compute is a later scale option rather than a first-launch requirement.

Tailscale is outside the player product architecture. Private operator administration may use Tailscale or another management tool, but no product workflow, invitation, recovery path, or player journey may depend on it.

### Persistent campaigns

Campaigns are durable products, not disposable model conversations. The platform must support:

- campaigns that continue across many sessions;
- authoritative event history and audience-scoped secrets;
- stable player, character, NPC, location, item, faction, quest, encounter, and asset identities;
- deterministic retries and reconnect after client, tunnel, service, VM, Worker, Durable Object, or provider interruption;
- operator inspection and correction without rewriting hidden history casually;
- backup, restore, recap, and resume after long periods away.

Durability is a product property independent of the selected storage adapter. Local VM persistence and later Cloudflare-native persistence must satisfy the same contract.

## Creative flexibility

### Theme-on-demand is a core capability

A player may request a western, gothic horror, undersea workplace comedy, candy kingdom war, science-fiction mystery, mythic bronze-age adventure, or another broad theme. The platform should establish an appropriate campaign vocabulary, visual language, asset plan, narration style, and encounter dressing without requiring a separate hand-authored application for every genre.

The first response to a theme request should produce a structured campaign theme brief rather than unbounded prose or arbitrary rendering code. The brief should define:

- original setting premise and campaign hook;
- tone, pacing, humor, danger, and content boundaries;
- naming and dialogue conventions;
- visual palette, materials, architecture, clothing, props, terrain, and interface ornamentation;
- likely reusable asset families;
- narration and audio direction;
- forbidden or avoided elements;
- mechanical reskin guidance that does not silently alter rules.

### Inspiration must become original campaign content

Players may name a protected franchise, character, game, film, show, or brand as shorthand for a desired feeling. The system should treat that reference as inspiration and transform it into an original campaign theme.

For example, a request for a campaign resembling a famous undersea cartoon should become an original undersea workplace comedy with newly created characters, locations, factions, visual designs, jokes, conflicts, and terminology. It must not present itself as official, reproduce protected names or logos, imitate distinctive character likenesses, repeat signature catchphrases, or closely duplicate recognizable storylines and designs.

This transformation reduces copying risk but is not a guarantee of legal clearance. Product copy and internal documentation must not promise that generated material is automatically trademark-safe, copyright-safe, or approved for commercial use. Provenance, review, moderation, and removal mechanisms remain necessary.

## Ownership principle

> RPG GM Runtime defines what the campaign means. GameFrame determines how that meaning becomes a coherent player experience.

### RPG GM Runtime owns

- runtime-authoritative campaign truth and semantic continuity;
- NPC motives, memories, relationships, and decisions;
- scene intent, narration, dialogue content, and consequences;
- interpretation of freeform player intent;
- runtime-owned hidden information and audience classification;
- campaign theme intent and semantic descriptions of requested media;
- model context, provider routing, proposal evaluation, and deterministic fallback;
- decisions to propose checks, choices, state changes, and encounters.

### GameFrame owns

- the complete authenticated interface and navigation model;
- player command transport and server-derived identity;
- audience-scoped projections and presentation ordering;
- GameFrame coordination state needed for seats, commands, reconnect, and client delivery;
- structured mechanics deliberately implemented in GameFrame;
- tactical authority, replay, reconnect, and committed outcomes;
- asset catalogs, visual recipes, prompt compilation, generation jobs, storage, delivery, and fallbacks;
- narration audio synthesis orchestration and playback;
- responsive browser and Discord Activity delivery.

### Scribbles Runtime owns

- Theo's behavior and the narrow connector that lets Theo participate through an ordinary GameFrame player seat.

Theo is never the Game Master and receives no GM-only campaign state.

## Deployment goals

The initial production system should:

1. run GameFrame and RPG GM Runtime as separately isolated services on one dedicated VM;
2. expose only GameFrame through Cloudflare Tunnel;
3. require no inbound router forwarding;
4. keep the GM, databases, and administration private;
5. persist GameFrame-owned and runtime-owned state in separate durable stores;
6. permit independent deployment and rollback of each repository;
7. remain within the selected Cloudflare plan by avoiding unnecessary dependency on metered stateful edge compute;
8. retain a documented migration path to Cloudflare-native components when measured scale or availability justifies them.

The VM profile is not a disposable prototype. It is the first production profile and must have authentication, backup, restore, migration, observability, and failure-recovery evidence.

## Media and audio goals

Generated or composed media is a first-class presentation capability, but not a gameplay authority.

The platform should:

1. reuse a prepared catalog when suitable assets already exist;
2. compose deterministic assets from approved parts when possible;
3. generate new assets asynchronously when reuse and composition are insufficient or the moment warrants custom art;
4. cache accepted outputs against stable theme and campaign entities;
5. preserve recipes, provenance, provider, model, workflow, prompt compiler, and moderation metadata;
6. use placeholders or deterministic fallbacks immediately when generation is slow or unavailable;
7. permit economical text-to-speech initially and improve quality through replaceable providers later;
8. allow accepted artifacts to begin on bounded VM storage and migrate to object storage without changing their stable asset identity.

Missing images, animation, music, or synthesized speech must never prevent legal campaign play.

## Product quality goals

The intended experience should be:

- coherent enough to feel like one designed game rather than disconnected AI demos;
- flexible enough to change genre without replacing the campaign engine;
- durable enough to survive provider failures and long gaps between sessions;
- visually consistent across recurring characters, locations, factions, items, and themes;
- responsive on desktop and mobile;
- inspectable and recoverable by operators;
- economical by preferring cached and deterministic work before paid generation;
- provider-flexible for language models, image generation, audio synthesis, storage, and delivery;
- deployment-flexible between the initial VM profile and later Cloudflare-native scale profile;
- explicit about identity, audience, authorization, provenance, revision, and authority.

## Non-goals

The product direction does not require:

- every improvised narrative object to become a custom structured mechanic;
- a bespoke renderer or code path for every genre;
- direct model-authored JavaScript, Canvas, shader, or DOM execution;
- generation of a new image for every action or object;
- premium voice acting before the core campaign loop works;
- Tailscale or private-network access for players;
- router port forwarding or direct origin exposure;
- Workers or Durable Objects as prerequisites for the first public campaign;
- copying recognizable franchise characters, settings, logos, dialogue, or art;
- merging RPG GM Runtime, GameFrame, and Scribbles Runtime into one process, service, or database merely because two services initially share one VM.

## First product proof

The first convincing product proof is complete when two authenticated players can:

1. accept a Discord invitation and enter the same public GameFrame campaign through Cloudflare Tunnel without a VPN;
2. do so without any router port forwarding or direct public origin route;
3. choose a requested campaign genre or inspiration and receive an original theme brief;
4. experience multiple scenes, dialogue, freeform actions, choices, a check, and correctly scoped private information;
5. see a mix of cached, composed, placeholder, and asynchronously generated presentation assets;
6. hear optional economical synthesized narration without audio becoming mandatory;
7. enter and complete a tactical encounter through the same GameFrame application;
8. return to the campaign with the committed encounter result applied;
9. survive GameFrame and runtime process restarts and later resume without duplicated commands, missing campaign truth, lost asset identity, or revision confusion;
10. restore the campaign from tested backups.

## Governing rule

> Build one persistent, theme-flexible RPG product: Cloudflare provides the public edge, the first authoritative services run separately on one private VM, Discord admits and connects players, RPG GM Runtime supplies campaign intelligence, and GameFrame delivers the entire playable experience.