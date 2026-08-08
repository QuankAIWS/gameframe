---
title: Scribbles GameFrame Roadmap
status: active
document_type: roadmap
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - Monster Master Arena Battles
  - RPG GameFrame integration
related:
  - README.md
  - rpg-documentation-index.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-gameframe-interface-contract.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-encounter-rules.md
  - decisions/0005-gameframe-bot-and-external-agent-boundary.md
---

# Scribbles GameFrame Roadmap

## Canonical boundaries

- GameFrame is the authoritative game platform, complete authenticated player interface, exploration materialization authority, and deterministic mechanic/tactical authority.
- `rpg-gm-runtime` owns CampaignPackages, semantic world truth, Dungeon Master orchestration, hidden campaign truth, campaign journal, entity/scene/observer-knowledge state, and narrative/world consequences.
- The mature RPG player loop is embodied exploration/direct interaction with GM/freeform escape hatches, not transcript-first movement.
- Built-in deterministic opponents use `gameframe-bot` and game-specific bot presentation.
- Scribbles Runtime is a separate future integration host for Theo.
- MM-0001 remains the fixed standalone Monster Master duel. Monster Master RPG campaign encounters evolve through a separate scene-faithful encounter contract.

## Completed platform proofs

### GF-0001 — Tic-Tac-Toe walking skeleton

- server-authoritative two-seat matches;
- authenticated actions;
- revision/idempotency/replay/snapshot contracts;
- human/human and human/GameFrameBot flows.

### GF-0002 — Cloudflare-compatible match runtime

- storage-neutral async services;
- Durable Object storage/serialized authority;
- Worker routing/realtime projections;
- fail-closed identity behavior;
- persistence/eviction/competing-write coverage.

### GF-0003 — Browser delivery

- create/share/play/complete/resume/reconnect flows;
- responsive desktop/mobile paths;
- polling fallback;
- browser acceptance/visual review.

### GF-0004 — Discord identity/invitations

- website OAuth/Discord verification;
- signed sessions;
- stable principals;
- signed expiring invitations;
- hosted spoofing rejection.

### GF-0005 — Versioned decision-provider contract

Generic structured agent-player request/response validation exists. External agents remain ordinary players.

### GF-0006 / GF-0007 — American Checkers

Complete authoritative rules, deterministic CheckersBot, persistence, browser flow, and provider-compatible decision path.

### TC-0001 / TC-0002 — Tactical foundations

- semantic map/movement/occupancy;
- initiative/bounded activations;
- line of sight/attacks/health/effects/victory;
- human/human and human/ArenaBot;
- Node/browser/Workers paths.

### MM-0001 — Monster Master Arena Battles foundation

- fixed `monster-master-duel` rules;
- three-unit standalone trainer teams;
- deterministic deployment/initiative/movement/attacks/health;
- command energy/Warden Master Mend;
- human/human and human/Monster-Master-BattleBot;
- replay/persistence/invitations/browser play;
- Pixi/Canvas rendering/visual review.

MM-0001 remains deliberately small and separately testable.

### GF-0011A/B — Monster Master RPG encounter substrate

Current work proves substantial campaign→Arena infrastructure:

- durable campaign/encounter custody;
- durable RPG-bound MatchSession snapshots;
- encounter↔match binding across restart;
- exact participant→creature mapping through `participantUnitIds`;
- shared-team action authorization;
- process-death reconciliation;
- terminal outcome derivation from authoritative match state;
- private VM RPG routes behind authenticated/HMAC Worker proxying;
- VM-backed WebSocket projection delivery/recovery;
- bounded configured Monster Master creature materialization.

Current campaign tactical materializer remains intentionally narrow: Emberling/Stone Bulwark, one-to-three supported creatures each side, equal counts, compact duel, normal difficulty, defeat-opposition, trainers as controllers only.

### GF-0012 — RPG staging delivery/control substrate

- Cloudflare Worker + VM hybrid routing;
- private GM/runtime origin path;
- private-runtime deployment authority;
- staging administration/reset;
- package-first Monster Master bootstrap;
- durable opening publication;
- authenticated player shell;
- VM-backed realtime projection delivery with HTTP recovery.

Deployment evidence remains separate from complete campaign evidence.

## Live P0 — authoritative Arena return

Human staging exposed a lifecycle gap: a terminal Arena battle can navigate back while the campaign remains fenced because authoritative runtime aftermath/resumable state has not yet become visible.

Required proof remains:

```text
terminal GameFrame outcome
→ runtime observes exact outcome
→ world/scene/roster consequences reconcile once
→ aftermath links/publishes
→ later resumable semantic scene state arrives
→ exploration materialization updates
→ movement/interaction unlock
→ refresh/reconnect remains correct
```

Fix this whenever it blocks embodied playtesting. Do not weaken client fences to hide the gap.

## Accepted product pivot — embodied campaign world

The controlling product direction now treats the RPG as a persistent 2D world the player inhabits.

The old text-first shell remains fallback/testing/accessibility/GM-history infrastructure, but it no longer defines the mature ordinary loop.

Controlling contract: `shared/rpg-embodied-exploration-and-character-performance-contract.md`.

Key invariants:

- GameFrame materializes semantic world truth into playable scenes;
- runtime owns semantic world/entity/scene/observer knowledge;
- high-frequency avatar transforms are GameFrame realtime/session state, not RPG journal truth;
- direct targeted NPC interaction uses perspective-bounded character context;
- Ask-GM remains a separate real-GM channel;
- Do Something Else preserves plausible tabletop actions outside fixed controls;
- GM interventions may pause/freeze the world explicitly;
- Arena returns consequences to the same exploration world;
- architect for multiple active scenes, productize one shared party scene first.

## Active — GF-0013 durable Scene/People/Observer surfaces

GameFrame must consume viewer-safe runtime projections for:

- semantic current scene/location;
- known people;
- viewer-safe identity labels/facts/relationships;
- current presence;
- visible/known objects/hazards/exits/routes;
- materialization references;
- player-safe entity inspection.

Unknown entities remain omitted.

## Next — GF-0014 Crooked Checkpoint exploration foundation

Build the first embodied campaign scene by extracting reusable exploration infrastructure from Monster Master requirements.

Target:

- Pixi campaign exploration shell;
- authenticated player avatar;
- movement/facing;
- camera;
- collision/picking;
- interaction targeting/range;
- Pell semantic anchor;
- one important world-object anchor;
- at least one exit/transition zone;
- accepted materialization ID/version;
- reconnect/recovery;
- text fallback.

Do not build a generic infinite-world engine first. Prove the reusable primitives against Crooked Checkpoint.

## Next — GF-0015 exploration realtime/session protocol

Extend the existing VM WebSocket path for bounded scene-scoped exploration traffic:

- player movement input/vector;
- facing/avatar transform;
- nearby-player transforms later;
- transient animation/session state;
- scene heartbeat/reconnect;
- durable change notifications.

Hard rule: movement frames do not advance runtime narrative revision and cannot switch semantic scene/identity.

Semantic commands/transfers/recovery remain durable HTTP/service operations.

## Next — GF-0016 direct Pell interaction + GM surfaces

Add:

- targeted entity interaction/talk;
- entity-origin dialogue presentation;
- separate Ask-GM communication/history;
- Do Something Else freeform action;
- GM intervention presentation with advisory/narration/dramatic freeze behavior;
- correct origin/audience labeling.

Acceptance must prove Pell dialogue is not labeled as GM and Pell context lacks at least one hidden fact Pell does not know.

## Next — GF-0017 connected scene / alternate route

Add one connected Crooked Checkpoint-area scene, preferably the west woods/alternate approach.

Prove:

- semantic route from runtime;
- materialization/load;
- authoritative scene transfer;
- destination spawn/transition zone;
- stable revisit of previous scene;
- no random replacement materialization after restart;
- event/check behavior can depend on route/current scene.

This is the first proof of a campaign **world** rather than one walkable set-piece.

## First multiplayer posture — one shared map/scene

The first two-human embodied campaign should use:

- two authenticated avatars;
- realtime nearby-player movement;
- one shared semantic/materialized scene at a time;
- viewer-divergent knowledge where appropriate;
- party-cohesion transition: relevant players gather at an exit/edge zone, then one authoritative transfer loads destination;
- cooperative Arena control;
- reconnect without duplicate presence.

This deliberately avoids split-party concurrency while retaining zero-or-more Scene Registry architecture.

## Future — split-party / multi-map

Full simultaneous multiple maps/scenes is deferred until one-scene multiplayer is proven.

It requires:

- player-specific scene/session subscriptions;
- scene-scoped projections/event delivery;
- independent materialization/recovery;
- divergent knowledge acquisition;
- explicit cross-scene communication;
- concurrent GM/event/mechanic custody;
- correct world clocks/pressure/objective behavior;
- one subgroup entering Arena while another continues exploring;
- reunion without duplicate presence or chronology errors.

Do not broadcast all scenes to all clients and rely on browser filtering.

## Active/future — scene-faithful tactical rules

The campaign tactical path evolves under `monster-master-rpg-encounter-rules.md`.

Target order:

1. source scene ID/revision/digest + roles;
2. campaign-specific terminal UX + authoritative embodied return;
3. withdrawal/escape/exit zones;
4. asymmetric materialization;
5. trainer tactical profiles;
6. noncombatant/protected/support/neutral roles;
7. alternative objectives;
8. structured scene/object reconciliation.

Every materially relevant persistent entity/object at tactical start must be represented truthfully or explicitly leave the source scene.

## Single-player embodied acceptance gate

Required journey:

```text
committed handcrafted CampaignPackage
→ semantic world/entity/scene/observer knowledge
→ Crooked Checkpoint materialization
→ movement/direct interaction
→ Pell perspective-bounded conversation
→ Ask-GM
→ Do Something Else
→ second connected scene/alternate route
→ revisit persistence
→ event/check progression
→ scene-faithful Arena launch
→ exact tactical outcome
→ world/scene/materialization reconciliation
→ exploration resume
→ bounded campaign resolution
→ runtime + GameFrame restart/resume
```

No fabricated tactical completion or developer mutation in ordinary execution.

## Two-human one-scene acceptance

After single-player:

- two authenticated humans join;
- separate avatars/realtime transforms;
- explicit party membership;
- correct player-private/party knowledge;
- shared active scene;
- cohesion transitions;
- direct NPC/GM interaction;
- cooperative Arena;
- reconnect/restart.

## Future — second handcrafted world then Campaign Architect

Before Campaign Architect implementation, prove a materially different second handcrafted package/world through the same validator, WorldGraph, materialization, entity/scene/knowledge, Dungeon Master context modes, and GameFrame interaction/tactical path.

Then implement generated-draft authoring:

```text
brief
→ Campaign Architect semantic world/package draft
→ optional owner refinement
→ validation/repair
→ preview
→ commitment
```

## Future — media/world materialization

Build a growing reusable library and generation pipeline for:

- terrain/biome families;
- structures/architecture kits;
- roads/water/fences/doors/props;
- NPC/avatar/creature presentation families;
- equipment/poses/effects;
- location-specific assets;
- semantic cinematic scripts;
- persistent character/location visual identities;
- replacement/version/provenance workflows.

Media never becomes campaign or collision authority.

## Future — specialist games

- Chess and other board games;
- additional tactical modules;
- alternative Monster Master encounter themes/rules without weakening authority boundaries.

## Deferred

- public discovery/subscriptions/monetization;
- native desktop/mobile clients;
- production-readiness claims before canaries;
- generalized mechanics not demanded by real campaigns;
- Cloudflare-native migration of private campaign state without evidence;
- split-party/multi-map before one-scene embodied multiplayer works.

## Documentation posture

Use:

- `planning/rpg-documentation-index.md` for reading order;
- `planning/shared/rpg-platform-product-goals.md` for durable product destination;
- `planning/shared/rpg-embodied-exploration-and-character-performance-contract.md` for world/materialization/NPC/GM/multi-scene semantics;
- `planning/shared/rpg-platform-roadmap.md` for cross-repository milestone order;
- this file for GameFrame-local status/direction;
- `planning/monster-master-rpg-encounter-rules.md` for tactical evolution.

## Governing rule

> GameFrame should make the RPG world literally playable without making the UI the boundary of imagination: walk and interact for ordinary play, ask the real GM when needed, use freeform intent for the unanticipated, and bring every tactical consequence back to the same durable world.
