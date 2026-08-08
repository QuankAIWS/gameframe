---
title: RPG Platform Delivery Plan
status: active
document_type: repository-plan
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime-integration
depends_on:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
related:
  - shared/rpg-campaign-architect-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-cross-repository-integration-testing.md
  - tactical-battler-rpg-foundation.md
  - monster-master-rpg-encounter-rules.md
---

# RPG Platform Delivery Plan

## Authority

`shared/rpg-platform-roadmap.md` controls cross-repository milestone order. This document maps GameFrame responsibilities onto that roadmap and must not reorder it.

The architecture is:

```text
brief / handcrafted source
→ Campaign Architect or manual authoring
→ validated CampaignPackage
→ runtime Entity + Scene + Knowledge substrate
→ Dungeon Master semantic decisions
→ GameFrame player experience and mechanics
```

Monster Master is the handcrafted gold standard, not a special platform or Dungeon Master path.

## Current GameFrame foundation

GameFrame already contains substantial infrastructure:

- durable campaign membership and audience-scoped projections;
- durable command acceptance and runtime-delivery custody;
- runtime event linkage with separate coordination/presentation/narrative positions;
- authenticated HTTP/Cloudflare boundaries;
- a Monster Master RPG shell with freeform input, realtime/polling recovery, onboarding, objective/profile presentation, and admin/reset support;
- durable encounter authority and configured Monster Master match binding;
- exact participant→creature mapping for the narrow supported RPG tactical profile;
- shared-team cooperative tactical authorization substrate;
- VM process/deployment/staging material.

This is useful substrate, not proof of a complete durable campaign-world experience. In particular, a campaign battle return link or terminal match alone does not prove authoritative runtime aftermath and composer unlock.

## Delivery work by shared milestone

### Package support

GameFrame must provide:

- versioned mechanic/presentation capability declarations;
- player-safe package preview;
- deterministic text/card/silhouette/media fallbacks;
- shared contract fixtures.

GameFrame never stores/exposes the runtime-only campaign bible to ordinary clients.

### Entity, Scene, and Knowledge support

GameFrame must implement player-facing surfaces for viewer-safe runtime projections:

- current scene;
- known people;
- known identity labels;
- known facts/relationships;
- entity inspection;
- current presence;
- character/companion state.

Unknown entities are omitted. A hidden canonical runtime name must not appear merely because the runtime model knows it.

The first People UI can remain simple and text-first. Correct viewer knowledge outranks elaborate presentation.

The runtime may track zero or more active scenes; GameFrame normally presents the scene occupied by the authenticated player's character.

### Secure Dungeon Master support

GameFrame accepts player commands and renders only runtime-approved player-safe presentation.

It must preserve explicit audience and semantic origin independently.

A runtime turn may produce multiple events for different audiences; GameFrame must not collapse those into one source-command visibility.

### Interaction semantics

The RPG composer must evolve from one ambiguous text box into two explicit semantic modes:

- **Act / Speak** — fictional-world action;
- **Ask Game Master** — out-of-fiction rules/knowledge/clarification query.

GameFrame sends different versioned commands so runtime does not guess intent from prose.

Ask-GM is player-private by default unless a future explicit action requests broader visibility. Fictional audibility and presentation audience remain separate.

Transcript/presentation should use clear origins such as PLAYER, GAME MASTER, viewer-safe NPC label, SYSTEM, and TACTICAL ENCOUNTER.

### Checks, events, and typed projections

GameFrame implements/presents only mechanics actually promoted into its authority, including as required:

- deterministic check requests/results;
- clue/objective/condition/consequence projections;
- structured choices;
- scene/location changes;
- encounter readiness.

GameFrame does not parse narration to infer state.

### Shared fixture evolution

As the durable-world slices land, the public shared fixture set must add versioned cases for:

- current-scene projection;
- Known People descriptor→role→name upgrade;
- Act/Speak versus Ask-GM;
- presentation origin separate from audience;
- safe entity inspection;
- encounter source scene/revision/digest;
- tactical role/objective projection;
- escape/withdrawal outcomes once supported.

This fixture surface is the primary coordination seam for parallel public GameFrame and private runtime work.

### Scene-faithful tactical handoff

The existing creature-only configured RPG materializer remains the implementation baseline, but the campaign path must evolve according to `monster-master-rpg-encounter-rules.md`.

GameFrame should add only capabilities demonstrated by actual campaigns:

1. validated encounter-scene role contract with source scene ID/revision/digest;
2. campaign-specific terminal UX and authoritative post-battle unlock validation;
3. withdrawal/escape and visible exit-zone mechanics;
4. asymmetric materialization;
5. trainer tactical profiles;
6. protected/noncombatant/support/neutral roles;
7. additional objectives;
8. structured scene-reconciliation outcome fields.

Every individually instantiated persistent person/creature present at tactical start must either be represented truthfully or have an explicit pre-launch scene transition out. Unsupported combat-relevant configuration fails closed before encounter custody.

MM-0001 remains fixed and separately testable.

### Campaign-bound terminal behavior

Campaign Arena Battles must not end in the standalone-duel loop.

Required behavior:

- primary terminal action is **Return to Campaign**;
- `New Duel` is suppressed for campaign-bound matches;
- generic `Return Home` is not the primary path;
- returning to the RPG route does not bypass runtime aftermath;
- campaign composer stays fenced while outcome reconciliation/aftermath is pending;
- once a later authoritative post-encounter campaign state arrives, the composer unlocks and the player can continue.

Browser acceptance must test the full state transition, not only URL navigation.

### Complete Monster Master player product

The first complete campaign UI should provide, at minimum:

- authenticated campaign opening/resume;
- current scene/narration/dialogue;
- Act/Speak and Ask-GM;
- People/Characters;
- companion/player state;
- objectives/clues/known information needed by the package;
- tactical transition/return;
- recap/history;
- reconnect/restart recovery;
- text-first operation with missing media.

Desktop/mobile quality follows the same authority contracts.

The first engineering proof may remain a bounded starter chapter; the mature product is a durable multi-session campaign system.

### Multiplayer

After the single-player architecture is proven, add/complete:

- invitation/join lifecycle;
- public/party/player-private presentation;
- viewer-divergent People/knowledge projections;
- shared-team tactical control;
- reconnect/resume for both players.

### Generality before Campaign Architect

Before Campaign Architect generation becomes active, GameFrame must prove a materially different second handcrafted package through the same package preview/projection/entity/scene/knowledge/tactical primitives.

If the second package exposes a missing reusable GameFrame primitive, add that primitive rather than create a campaign-specific client control plane.

### Campaign Architect

GameFrame later adds only player-facing authoring surfaces required by the proven package model:

- concept submission;
- safe assumptions/repair questions;
- draft package preview;
- optional owner editing/refinement;
- explicit commit;
- later explicit amendment/version/migration flows.

GameFrame must never expose the hidden campaign bible through owner/player preview surfaces unless the authenticated role is explicitly an authorized campaign author/admin.

### Media materialization

After campaign correctness, GameFrame owns:

- semantic asset catalogs;
- provider-neutral prompt compilation;
- Cloudflare-backed or other configured generation;
- validation/moderation/provenance;
- caching/storage/replacement;
- stable recurring character/location identities;
- deterministic fallbacks.

Media remains optional presentation.

## Monster Master capture-cube presentation

Ordinary capture cubes are handheld externally. GameFrame should maintain separate semantic assets for:

- ordinary handheld cube;
- cube case/rack;
- cart/storage carrying cube cases;
- specialist relocation/quarantine/industrial containment equipment.

Do not render an ordinary cube as a cage-sized container because its interior living space is large.

## Deployment posture

Initial production remains GameFrame and RPG GM Runtime as separate services on one VM, with Cloudflare exposing player-facing GameFrame routes while runtime/data/admin surfaces remain private.

Deployment blockers that prevent campaign development/play should be fixed promptly. Additional hardening or Cloudflare-native state migration does not outrank durable campaign-world correctness unless a concrete operational defect demands it.

## Validation posture

Use the evidence layer that matches the claim:

- unit/contract tests for GameFrame authority/projections;
- shared fixtures for cross-repo schema stability;
- runtime machine-play for Dungeon Master behavior;
- actual GameFrame integration for entity/scene/encounter truth;
- real Arena match tests for tactical claims;
- browser tests for player experience and authoritative return/unlock;
- VM canaries for public deployment claims;
- media-specific canaries for generation claims.

## Immediate GameFrame execution order

1. keep staging/player shell operational and treat broken campaign battle return/unlock as a P0 product blocker;
2. define/consume current-scene and Known People projections;
3. add Act/Speak versus Ask-GM command/UI distinction and typed presentation origin;
4. preserve viewer-safe entity labels through all campaign rendering;
5. extend shared machine-readable fixtures for those contracts;
6. define encounter-scene request capability with source scene/revision/digest;
7. fix campaign-specific terminal UX and prove authoritative post-battle unlock;
8. add escape/withdrawal semantics before expanding tactical roster breadth;
9. add asymmetric materialization and trainer profiles required by Crooked Checkpoint;
10. run complete single-player campaign/browser/deployment proof;
11. add multiplayer acceptance;
12. prove second handcrafted package;
13. support Campaign Architect authoring surfaces later.

## Governing rule

> GameFrame delivery should make the durable campaign world visible and playable. Presentation may evolve rapidly, but the player should never have to infer who is present, what their character knows, or whether clicking back from Arena actually completed the authoritative campaign transition.
