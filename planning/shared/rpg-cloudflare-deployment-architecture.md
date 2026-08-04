---
title: RPG Cloudflare Deployment Architecture
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Cloudflare deployment
  - Discord entry and invitations
shared_document_id: rpg-cloudflare-deployment-architecture-v1
shared_document_version: 1
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-cloudflare-deployment-architecture.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-cloudflare-deployment-architecture.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-media-theme-and-audio-pipeline.md
  - ../rpg-gameframe-interface-contract.md
  - ../rpg-platform-delivery-plan.md
---

# RPG Cloudflare Deployment Architecture

## Decision

The production RPG is a public Cloudflare-hosted application. GameFrame is served through Cloudflare-facing routes, authoritative campaign and encounter coordination use Durable Objects, Discord supplies authenticated entry and invitations, and asynchronous media work is isolated from the campaign authority path.

No normal player or production campaign workflow depends on Tailscale.

## Architectural principles

1. One Durable Object exists for each logical coordination unit rather than one global object for the entire product.
2. Campaign commands are authoritative, revisioned, runtime-validated, and idempotent.
3. WebSockets deliver responsive projections but are not a second mutation path.
4. Durable state survives object eviction, deployment, reconnect, and browser loss.
5. Slow model, image, audio, and composition work does not execute inside the critical campaign commit path.
6. Binary media is stored separately from campaign journals and tactical state.
7. Every external provider sits behind a replaceable adapter with explicit limits, timeout, retry, cost, provenance, and failure behavior.
8. Public deployment does not imply public campaign data; authorization and audience projection remain server-side.

## Target topology

```text
Discord invitation, OAuth, or Activity launch
                    |
                    v
          GameFrame edge Worker
      authentication, sessions, routes
                    |
          +---------+----------+
          |                    |
          v                    v
 Campaign Durable Object   Encounter Durable Object
 campaign coordination     tactical authority
 revision and journal      legal actions and replay
 player projections        committed outcomes
          |
          +-------------------+
                    |
                    v
        RPG GM Runtime service adapter
   semantic campaign proposals and responses
                    |
                    v
        GameFrame media orchestration Worker
         catalog -> compose -> generate
                    |
                    v
             asynchronous Queue
                    |
        +-----------+------------+
        |                        |
        v                        v
 image/media Worker         narration/audio Worker
 provider adapters          provider adapters
        |                        |
        +-----------+------------+
                    |
                    v
             asset object storage
          artifacts and provenance
```

Exact Worker names, bindings, and package boundaries may follow repository conventions. The ownership and failure isolation described here are controlling.

## Public edge and session boundary

The GameFrame edge Worker owns the public HTTP boundary for:

- Discord OAuth callbacks and Discord Activity authentication;
- issuance and verification of GameFrame sessions;
- invitation creation, inspection, acceptance, cancellation, and expiry;
- campaign creation, join, resume, command, feed, and projection routes;
- encounter routes and browser asset delivery;
- routing requests to the correct campaign, encounter, or supporting service.

The edge Worker derives the GameFrame principal from verified authentication context. A request body, query parameter, display name, avatar, or Discord username is never proof of identity.

## Discord entry and invitation flow

The intended player journey is:

1. An authenticated campaign member creates a bounded, signed, expiring invitation.
2. The recipient opens the link through an ordinary browser or Discord Activity.
3. Discord authentication establishes the external user identity.
4. GameFrame issues or resumes its own signed session for the stable principal.
5. The invitation authorizes an atomic campaign-seat claim but does not itself establish identity.
6. The campaign Durable Object commits membership and returns the authorized player projection.
7. The same player can later resume through GameFrame without replaying the invitation.

Discord voice and social chat may accompany play. They do not substitute for GameFrame campaign commands, projections, or persistence.

## Campaign Durable Object

Use one campaign coordination object per campaign unless later evidence demonstrates a need to shard a single campaign.

The campaign object owns or coordinates:

- campaign revision and durable event ordering;
- authenticated membership, seats, parties, roles, and audience scopes;
- exact command retry receipts and conflict detection;
- attachment and resume positions;
- delivery of player-scoped campaign projections;
- references to runtime-owned campaign events and GameFrame-owned structured projections;
- encounter references and committed outcome application state;
- asset references, readiness state, and presentation replacement events;
- bounded presence and connection metadata;
- alarms required for campaign-owned deadlines, expiry, or cleanup.

The campaign object does not perform expensive inference, image generation, audio synthesis, large binary transformation, or unbounded prompt construction during a campaign commit.

## Encounter Durable Objects

Tactical encounters remain separate authority units. An encounter object owns:

- encounter identity and ruleset;
- participant controller bindings;
- legal actions, revisions, initiative, turns, effects, objectives, and hidden tactical information;
- deterministic or seeded mechanics;
- replay, reconnect, restoration, and terminal state;
- the structured committed encounter outcome.

Campaign state references encounters by stable IDs and consumes structured terminal outcomes. It never infers an outcome by parsing narration, screenshots, or animation.

## Runtime integration

RPG GM Runtime remains a separate service and repository. GameFrame communicates with it through versioned contracts.

The runtime receives authenticated player commands and authorized campaign context, then returns bounded semantic proposals or committed runtime events. The runtime may request:

- narration and dialogue presentation;
- freeform or structured player input;
- checks and consequences;
- changes to runtime-owned campaign truth;
- media intents;
- encounter launch, update, cancellation, or acknowledgement.

The runtime receives no direct Durable Object storage handle, GameFrame signing secret, Discord credential, browser session, or internal queue binding.

## Projection and reconnect

HTTP or an equivalent authoritative request boundary owns mutations. WebSockets are projection-only and should use hibernation-compatible behavior where practical.

Correctness cannot depend on receiving every WebSocket message. Each player must be able to recover by presenting a valid session and bounded resume cursor, then fetching the current projection or missed feed range.

Tests must cover:

- object eviction with connected and disconnected clients;
- missed projection recovery;
- duplicate and stale command rejection;
- reconnect after browser refresh and later-session resume;
- projection filtering for public, party, player-private, and runtime-only data;
- object restart during encounter and media processing.

## Asynchronous media architecture

GameFrame owns media orchestration, but campaign authority does not wait synchronously for custom media.

The media orchestration Worker performs this decision sequence:

1. validate the semantic media intent;
2. resolve the campaign theme and presentation policy;
3. search the approved catalog and campaign cache;
4. attempt deterministic composition when suitable;
5. return an immediate placeholder or fallback reference;
6. enqueue custom generation or synthesis when required;
7. validate and store accepted results;
8. publish a replacement-ready event to the campaign projection.

Queue delivery and provider retries must be idempotent. A duplicate job may verify or return the already committed artifact but must not create multiple campaign identities for the same requested asset.

## Asset storage

Large generated or composed binaries belong in object storage rather than Durable Object rows or the campaign journal.

Each accepted artifact has a stable asset record containing at least:

- asset ID and campaign or global scope;
- semantic entity reference;
- theme pack and recipe version;
- artifact kind and dimensions or duration;
- content hash and storage key;
- source catalog item or generation provider;
- model, workflow, prompt compiler, and adapter versions when generated;
- creation time, moderation status, provenance, and license or rights notes;
- replacement, deprecation, or supersession relationship;
- fallback asset reference.

The campaign journal stores the stable asset reference and presentation events, not repeated binary payloads.

## Audio delivery

Narration and NPC speech use a provider-neutral audio adapter. The runtime supplies text, speaker identity, language, and bounded performance tags such as tone, pace, intensity, and pronunciation hints. GameFrame selects the configured synthesis provider and controls caching, storage, delivery, playback, captions, and fallback.

The first production slice may use basic economical speech synthesis. Higher-quality narration and distinct recurring voices can be added without changing the campaign command or presentation contract.

Text is always retained as the authoritative accessible fallback. Audio failure never blocks progression.

## Secrets and trust boundaries

- Discord client secrets, session signing keys, provider API keys, and storage credentials live in deployment secret stores.
- Browser clients receive no provider credentials or internal service tokens.
- Media workers receive only the minimum provider and storage bindings required for their role.
- Campaign and encounter objects do not expose private storage or hidden state through logs, errors, projections, or asset metadata.
- Public asset delivery must respect campaign authorization when an artifact is private or unrevealed.
- Provider prompts and responses must be treated as potentially sensitive campaign data when they contain private characters, secrets, or unrevealed locations.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Browser disconnect | Preserve committed state and permit resume. |
| WebSocket loss | Recover by authenticated polling or feed cursor. |
| Durable Object eviction | Reconstruct required state from durable storage. |
| Runtime timeout | Preserve command ID and retry without duplicate events. |
| Image provider failure | Keep placeholder or catalog asset and continue play. |
| Audio provider failure | Display text and continue play. |
| Queue duplicate | Return the existing artifact or idempotent job result. |
| Object storage failure | Keep the asset unresolved and do not publish a broken reference. |
| Discord unavailable after login | Existing valid GameFrame sessions continue according to session policy. |
| Unsupported theme request | Produce a bounded original fallback brief or request narrower input. |

## Environments and deployment

Maintain separate local, test, staging, and production bindings. Tests may use deterministic providers and fixture assets. Staging may use restricted Discord allowlists and low-cost provider configurations. Production uses explicit budgets, rate limits, content controls, observability, and incident procedures.

No environment may silently fall back from authenticated production behavior to synthetic local identity.

## Validation gates

The Cloudflare architecture is not considered production-shaped until automated tests prove:

1. authenticated Discord invitation and atomic campaign-seat claim;
2. campaign command idempotency and revision conflict behavior;
3. Durable Object eviction and restart recovery;
4. hibernation-compatible projection reconnect;
5. one campaign entering and returning from an encounter;
6. catalog asset reuse without provider invocation;
7. queued generation with duplicate-delivery safety;
8. object-storage persistence and stable asset retrieval;
9. placeholder-first play while media remains pending;
10. provider failure without campaign failure;
11. player-private asset and presentation authorization;
12. basic synthesized narration with text fallback;
13. public-network desktop and mobile journeys that require no Tailscale.

## Governing rule

> Durable Objects coordinate campaigns and encounters; queues and media workers perform slow enrichment; object storage holds artifacts; Discord admits players; and GameFrame remains the only player-facing game authority.