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
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
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

The mature architecture is:

```text
brief / handcrafted source
→ Campaign Architect or manual authoring
→ validated semantic CampaignPackage
→ runtime World + Entity + Scene + Observer Knowledge
→ GameFrame exploration materialization
→ direct embodied play
→ Dungeon Master referee / character-performance / GM intervention as needed
→ deterministic mechanics / Arena
→ reconciliation back into the embodied world
```

Monster Master is the handcrafted gold standard, not a special platform/GM/world-engine path.

## Current GameFrame foundation

GameFrame already contains substantial useful infrastructure:

- durable campaign membership/audience-scoped projections;
- durable command acceptance/runtime-delivery custody;
- separate coordination/presentation/narrative positions;
- authenticated HTTP/Cloudflare boundaries;
- Monster Master RPG shell with freeform input/realtime recovery/onboarding/objectives/admin support;
- durable encounter authority/configured Monster Master match binding;
- exact participant→creature mapping for the narrow supported tactical profile;
- shared-team cooperative tactical authorization substrate;
- PixiJS Monster Master renderer and tactical world interaction foundations;
- VM process/deployment/staging material;
- VM-backed WebSocket projection transport.

This is substrate, not proof of the embodied campaign product.

## Preserve live correctness while pivoting the player loop

Do not discard current staging/package/Arena work.

The live P0 remains authoritative tactical return:

```text
terminal tactical result
→ runtime observes exact outcome
→ world/scene/roster consequences reconcile once
→ aftermath links
→ later resumable campaign state appears
→ GameFrame updates surrounding exploration world
→ movement/interaction unlock
```

Fixing this remains valuable because embodied exploration must return correctly from Arena too.

## Entity, Scene, Observer Knowledge support

GameFrame must consume viewer-safe runtime projections for:

- current semantic scene/location;
- known people/identity labels/facts/relationships;
- current presence;
- visible/known objects/hazards/exits/routes;
- player-safe entity inspection;
- materialization reference/identity.

Unknown entities are omitted. Hidden canonical names never appear merely because runtime knows them.

## GF exploration materialization slice

The first new product slice should create one real **Crooked Checkpoint exploration scene** in GameFrame.

Required foundation:

- Pixi campaign exploration scene shell;
- authenticated player avatar;
- movement/facing;
- camera;
- collision and picking;
- interaction range/targeting;
- semantic anchor binding for Pell, important objects, and exits;
- accepted materialization ID/version;
- reconnect/recovery to the same materialization;
- realtime movement/session path that does not create RPG journal events per frame;
- text/fallback representation if enhanced rendering is unavailable.

This should reuse existing Pixi/tactical renderer expertise rather than create a disconnected engine.

## Direct character interaction

After one walkable scene:

- player approaches Pell;
- interaction identifies stable `npc.pell` through viewer-authorized semantic scene projection;
- runtime performs Pell-scoped character performance;
- GameFrame renders Pell as entity-origin dialogue, not `GAME MASTER`;
- Pell dialogue/memory remains tied to stable entity identity;
- consequential relationship/knowledge/action state commits through runtime semantics.

GameFrame should support a focused conversation panel/log or in-world dialogue presentation while maintaining a separate GM communication history.

## Ask-GM

Retain a dedicated player-to-GM surface.

Ask-GM is:

- out-of-fiction;
- player-private by default;
- not automatically heard by NPCs;
- not automatically time-advancing;
- separate from targeted NPC dialogue.

## Do Something Else

The old all-purpose freeform composer evolves into the **tabletop escape hatch**, not the default movement interface.

Do Something Else submits plausible fictional intent when direct controls do not cover the action.

Examples:

- climb a tree;
- cut through woods;
- improvise a distraction;
- manipulate a world object unusually.

GameFrame sends a dedicated semantic command so runtime does not have to guess whether the user is asking the GM or acting in fiction.

## GM intervention presentation

GameFrame should support explicit GM-origin presentation with intensity/control metadata.

Initial levels may be:

- advisory/nonblocking;
- narration/brief pause;
- dramatic/freeze-scene.

The dramatic version should support the desired large Game Master text frame/bubble with local world controls paused until the intervention completes/acknowledges.

Presentation is not semantic mutation authority.

## Connected scene materialization

After Crooked Checkpoint works, add one connected location—preferably a credible alternate route such as the west woods.

Required behavior:

- runtime exposes route/semantic destination;
- GameFrame loads/materializes destination;
- authoritative scene transfer commits once;
- player arrives through defined spawn/entry zone;
- previous materialization remains stable for revisit;
- materialized scene uses world-kit/catalog/procedural composition/fallbacks as appropriate.

This is the first proof that the system is a world rather than one fancy map.

## Single-map party posture

The first two-human embodied implementation should keep the active party in one exploration scene at a time.

GameFrame should support:

- separate authenticated avatars;
- nearby-player realtime transforms;
- one authoritative shared semantic scene;
- readiness/edge-zone indication;
- party-cohesion transition when required members are in the destination zone;
- one semantic transfer + destination scene session.

Do not make the browser the authority for whether everyone actually transferred.

## Multi-map/split-party posture

Architectural hooks should not assume one universal scene, but full split-party UI is deferred.

Later GameFrame requirements include:

- player-specific scene/session subscriptions;
- scene-scoped projections;
- remote/separated party UI;
- cross-scene communication mechanics;
- independent materialization/recovery;
- multiple simultaneous realtime scene rooms;
- one subgroup entering Arena without incorrectly moving/freezing another.

Do not implement split party by broadcasting every active scene to every client.

## Checks, events, and typed world interactions

GameFrame implements/presents only mechanics promoted into its authority, including as required:

- deterministic check requests/results;
- clue/objective/condition/consequence projections;
- supported world-object interactions;
- structured choices where genuinely useful;
- scene/location changes;
- encounter readiness.

GameFrame does not parse narration to infer durable state.

## Scene-faithful tactical handoff

The existing creature-only materializer remains baseline, but the campaign path evolves under `monster-master-rpg-encounter-rules.md`.

Order:

1. source scene ID/revision/digest + entity-role contract;
2. campaign-specific terminal UX + authoritative post-battle embodied unlock;
3. withdrawal/escape and exit-zone mechanics;
4. asymmetric materialization;
5. trainer tactical profiles;
6. protected/noncombatant/support/neutral roles;
7. additional objectives;
8. structured scene/object reconciliation fields.

Every materially relevant persistent entity/object at tactical start must be represented truthfully or explicitly leave the source scene before launch.

## Embodied campaign return

Campaign Arena Battles must not end in standalone-duel behavior.

Required:

- primary terminal action `Return to Campaign`;
- no generic `New Duel` for campaign-bound match;
- exploration remains fenced while runtime reconciliation is pending;
- updated semantic scene arrives;
- materialization reflects supported consequences;
- movement/interaction unlocks only after authoritative resume.

Browser acceptance tests state, not merely URL navigation.

## Media/materialization delivery

GameFrame owns:

- semantic asset/world-kit catalogs;
- provider-neutral prompt compilation;
- deterministic composition/prefabs;
- scene materialization recipe/seed/versioning;
- Cloudflare-backed or other configured generation;
- validation/moderation/provenance;
- caching/storage/replacement;
- stable recurring character/location identities;
- cinematic script execution;
- text/silhouette/placeholder fallbacks.

Media remains optional presentation. Generated images do not own collision or world truth.

## Shared fixture evolution

Add canonical fixtures for:

- semantic current scene;
- materialization ref;
- Known People descriptor→role→name;
- observer/entity knowledge;
- direct entity interaction;
- Do Something Else;
- Ask-GM;
- GM intervention origin/intensity/audience;
- scene transfer/route identity;
- encounter source scene/revision/digest;
- tactical roles/objectives;
- escape/withdrawal;
- authoritative embodied aftermath/unlock.

## Complete Monster Master player product

The first complete GameFrame campaign proof should provide:

- authenticated opening/resume;
- Crooked Checkpoint exploration;
- direct Pell conversation;
- Ask-GM;
- Do Something Else;
- People/Characters;
- relevant character/companion/objective information;
- second connected scene/alternate route;
- scene revisit;
- check/event progression;
- tactical transition/return;
- GM intervention/history;
- reconnect/restart recovery;
- text/fallback operation when optional media is missing.

The mature product is a durable multi-session campaign system.

## Multiplayer

After single-player:

- invitation/join lifecycle;
- two authenticated avatars;
- one-scene realtime party play;
- public/party/player-private presentation;
- viewer-divergent knowledge;
- cohesion transition;
- shared-team tactical control;
- reconnect/resume.

Split-party/multi-map acceptance is later and separate.

## Generality before Campaign Architect

Before Campaign Architect generation becomes active, GameFrame must prove a materially different second handcrafted world through the same world/materialization/entity/scene/knowledge/interaction/tactical primitives.

If it exposes a reusable missing primitive, add that primitive rather than a campaign-specific control plane.

## Deployment posture

Initial production remains GameFrame + RPG GM Runtime as separate services on one VM, with Cloudflare exposing player-facing GameFrame while runtime/data/admin surfaces remain private.

Exploration movement may extend the authenticated VM WebSocket path. Semantic commands/recovery remain durable authority paths. Realtime socket state remains disposable.

## Validation posture

Use the evidence layer matching the claim:

- unit/contract tests for GameFrame authority/projections;
- materialization/movement tests for exploration;
- shared fixtures for cross-repo schema stability;
- runtime machine-play for referee/entity-performance behavior;
- actual integration for world/scene/encounter truth;
- real Arena matches for tactical claims;
- browser tests for embodied player experience;
- VM canaries for public/realtime deployment claims;
- media canaries for generation claims.

## Immediate GameFrame execution order

1. keep staging operational and repair authoritative Arena aftermath/unlock whenever it blocks testing;
2. consume semantic current-scene/People projections as runtime work lands;
3. build one Crooked Checkpoint Pixi exploration scene with avatar movement/collision/Pell/object/exit anchors;
4. add exploration realtime/session state without per-frame RPG commits;
5. add targeted Pell interaction + separate Ask-GM + Do Something Else + GM intervention presentation;
6. add a second connected exploration scene/alternate-route transition and stable revisit;
7. extend shared fixtures for materialization/interaction/transition;
8. make events/checks/world interactions react to embodied scene state;
9. define/consume encounter-scene contract and prove authoritative Arena return to exploration;
10. run complete single-player embodied campaign/browser/deployment proof;
11. add two-human one-scene campaign;
12. prove second handcrafted world;
13. support Campaign Architect authoring surfaces;
14. productize split-party/multi-map later.

## Governing rule

> GameFrame delivery should make the durable campaign world literally playable while preserving the tabletop escape hatch: direct controls for the common case, a real GM for adjudication, perspective-bounded characters, and no loss of agency when a button does not exist.
