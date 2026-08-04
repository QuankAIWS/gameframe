---
title: RPG Platform Product Goals
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
shared_document_id: rpg-platform-product-goals-v1
shared_document_version: 1
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

The RPG platform is a persistent, Cloudflare-hosted, AI-directed role-playing game played entirely through GameFrame. Players may request nearly any genre, tone, or thematic inspiration, and the system should rapidly establish an original campaign presentation while preserving durable campaign continuity and authoritative mechanics.

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

### Public Cloudflare deployment

The production experience is hosted through Cloudflare-facing services. Ordinary players must not require Tailscale, a private network, an operator VPN, a developer machine, or access to an internal origin.

Tailscale is outside the product architecture. Private development access may use any operator-selected tooling, but no product workflow, invitation, recovery path, or player journey may depend on it.

### Persistent campaigns

Campaigns are durable products, not disposable model conversations. The platform must support:

- campaigns that continue across many sessions;
- authoritative event history and audience-scoped secrets;
- stable player, character, NPC, location, item, faction, quest, encounter, and asset identities;
- deterministic retries and reconnect after client, Worker, Durable Object, or provider interruption;
- operator inspection and correction without rewriting hidden history casually;
- recap and resume after long periods away.

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

- campaign truth and semantic continuity;
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
- structured mechanics deliberately implemented in GameFrame;
- tactical authority, replay, reconnect, and committed outcomes;
- asset catalogs, visual recipes, prompt compilation, generation jobs, storage, delivery, and fallbacks;
- narration audio synthesis orchestration and playback;
- responsive browser and Discord Activity delivery.

### Scribbles Runtime owns

- Theo's behavior and the narrow connector that lets Theo participate through an ordinary GameFrame player seat.

Theo is never the Game Master and receives no GM-only campaign state.

## Media and audio goals

Generated or composed media is a first-class presentation capability, but not a gameplay authority.

The platform should:

1. reuse a prepared catalog when suitable assets already exist;
2. compose deterministic assets from approved parts when possible;
3. generate new assets asynchronously when reuse and composition are insufficient or the moment warrants custom art;
4. cache accepted outputs against stable theme and campaign entities;
5. preserve recipes, provenance, provider, model, workflow, prompt compiler, and moderation metadata;
6. use placeholders or deterministic fallbacks immediately when generation is slow or unavailable;
7. permit economical text-to-speech initially and improve quality through replaceable providers later.

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
- explicit about identity, audience, authorization, provenance, and authority.

## Non-goals

The product direction does not require:

- every improvised narrative object to become a custom structured mechanic;
- a bespoke renderer or code path for every genre;
- direct model-authored JavaScript, Canvas, shader, or DOM execution;
- generation of a new image for every action or object;
- premium voice acting before the core campaign loop works;
- Tailscale or private-network access for players;
- copying recognizable franchise characters, settings, logos, dialogue, or art;
- merging RPG GM Runtime, GameFrame, and Scribbles Runtime into one service or database.

## First product proof

The first convincing product proof is complete when two authenticated players can:

1. accept a Discord invitation and enter the same Cloudflare-hosted campaign in GameFrame;
2. choose a requested campaign genre or inspiration and receive an original theme brief;
3. experience multiple scenes, dialogue, freeform actions, choices, a check, and correctly scoped private information;
4. see a mix of cached, composed, placeholder, and asynchronously generated presentation assets;
5. hear optional economical synthesized narration without audio becoming mandatory;
6. enter and complete a tactical encounter through the same GameFrame application;
7. return to the campaign with the committed encounter result applied;
8. disconnect and later resume without duplicated commands, missing campaign truth, or lost asset identity.

## Governing rule

> Build one persistent, theme-flexible RPG product: Cloudflare hosts it, Discord admits and connects players, RPG GM Runtime supplies campaign intelligence, and GameFrame delivers the entire playable experience.