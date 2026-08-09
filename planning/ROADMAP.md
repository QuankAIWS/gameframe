---
title: Scribbles GameFrame Roadmap
status: active
document_type: roadmap
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - Games
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
related:
  - README.md
  - rpg-documentation-index.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-current-creative-direction.md
---

# Scribbles GameFrame Roadmap

## Canonical boundaries

- **Games** is the top-level player-facing GameFrame destination.
- **Role-Playing Games** is the player-facing campaign surface; **GameFrame RPG Engine** remains internal architecture terminology.
- **Battle Simulator** is the standalone tactical sandbox; Monster Master Arena Battles is its first Monster Master entry.
- GameFrame owns physical materialization, x/y/facing, collision/pathing/camera, interaction targeting/range, deterministic RPG Ruleset execution, control authorization, tactical state, and player-facing rendering.
- `rpg-gm-runtime` owns CampaignPackages, semantic world truth, Entity/Scene/Observer Knowledge state, Dungeon Master context/orchestration, hidden campaign truth, and semantic consequences.
- **HTTP is the sole GameFrame RPG command/mutation authority. WebSockets are projection/notification-only and reconstructable from durable state.**
- Campaign combat uses **Tactical Activation on the current materialized map**. It never launches Battle Simulator or a replacement campaign battlefield.
- The Dungeon Master may interpret arbitrary intent, but prose never becomes world truth merely because the model narrated it. Consequential state must pass validated semantic/mechanical authority and commit before the world/history reflects it.

## Current development mode

```text
SEE      ✅ COMPLETE
MOVE     ✅ COMPLETE
MOBILE   ✅ COMPLETE
TALK     ✅ COMPLETE
CHANGE   ← ACTIVE
TRAVEL
FIGHT
PROVE
```

The world is the primary player surface. Text remains important for narration, dialogue, arbitrary intent, Ask Game Master, accessibility, and the eventual Campaign Chronicle, but transcript/feed polish is secondary to making ordinary play executable through the world.

Every substantive RPG PR should advance the bounded Crooked Checkpoint journey or remove a demonstrated correctness/deployment blocker to it.

## Current executable proof

The merged product path now proves:

- authenticated Monster Master RPG launch and CampaignPackage v5 staging bootstrap;
- viewer-safe Crooked Checkpoint semantic scene bootstrap and deterministic Pixi materialization;
- desktop + mobile movement over the same authenticated HTTP movement authority;
- GameFrame-owned durable x/y/facing recovery and collision;
- refresh/restart recovery to the same materialization/valid position;
- observer-safe initial identity disclosure;
- physically authorized nearby **Talk** for supported actor entities;
- viewer-safe target handles in the browser and canonical semantic target resolution only on the GameFrame server;
- explicit chooser when more than one supported actor is adjacent;
- Runtime entity-performance context for Pell with hidden referee truth structurally absent;
- durable, idempotent Talk retry that survives an uncertain/lost response without reauthorizing against a changed world;
- first-slice Talk publication scoped to the initiating player rather than falsely treating all nearby speech as globally public.

The West Woods marker still proves an authorized route/exit projection and physical route mouth only. It is **not yet a functioning scene transfer**.

## Bounded correctness/content cleanup

Keep this subordinate to the active player action rather than turning it into a feed redesign project.

1. **Opening pacing:** establish Crooked Checkpoint as a place, orient the player, then return control instead of repeatedly funneling play through forced choices.
2. **Capture-cube scale:** ordinary handheld capture cubes cannot plausibly make a confiscation cart jump or shake by themselves. Any physical disturbance needs an explicit credible source.
3. **Identity custody:** narration, dialogue, labels, history, and GM output use observer-authorized identity stages. Canonical package names are not presentation defaults.
4. **Feed correctness before feed polish:** preserve origin/audience/state semantics now; defer elaborate Chronicle UI until the game supports the intended world actions.

## Interaction and history model

```text
WORLD = primary play surface
  ├─ contextual actions: Talk / Inspect / Use / Travel / Deploy / Recall / etc.
  ├─ Do Something Else: freeform in-fiction intent
  └─ Ask Game Master: out-of-fiction referee communication

CAMPAIGN HISTORY = durable observer-authorized chronicle of what actually happened
```

One authoritative event may later have multiple authorized presentations. A spoken line may appear as in-world speech and later in Campaign Chronicle history. Audibility, audience, Observer Knowledge, and presentation are separate concerns.

The first TALK slice intentionally fails closed to **initiating-player-private** presentation until real local audibility/whisper fan-out exists. Do not reinterpret that temporary privacy posture as the final multiplayer speech model.

## Completed — SEE

Authenticated Runtime exploration attach produces a viewer-safe semantic projection, deterministic Crooked Checkpoint materialization, stable `rpg-scene:<campaignId>:scene.crooked-checkpoint` identity, viewer-safe entities/objects/routes, and exact refresh/reconnect recovery through the existing Pixi renderer.

## Completed — MOVE + mobile

```text
WASD / touch D-pad
→ authenticated HTTP
POST /api/rpg/campaigns/:campaignId/exploration/move
→ GameFrame collision + optimistic position revision + SQLite checkpoint
→ exploration_position
→ Pixi transform + camera follow
```

WebSocket mutation attempts remain unsupported. Runtime receives no per-step movement traffic.

## Completed — TALK

Merged Runtime #112 and GameFrame #200 establish the first production-shaped physical interaction → entity-performance seam.

### GameFrame proof

- only a current viewer-safe `interactionTargetId` is accepted from the browser;
- the player must be adjacent in the current materialization;
- first-slice Talk is offered only for actor targets Runtime can perform;
- multiple adjacent actors require explicit target choice;
- GameFrame maps the authorized physical anchor to canonical `targetEntityId` server-side;
- generic `/commands` cannot manufacture typed Talk metadata;
- exact retry identity includes command ID, issued timestamp, words, target handle, and source coordination revision;
- a committed retry resolves from durable ingress custody before another physical reauthorization;
- mobile controls and the shared composer participate in the same path.

### Runtime proof

- typed Talk becomes an `entity-interaction` GM trigger;
- Pell is performed by the Dungeon Master in **entity-performance** mode, not by a new NPC agent;
- Pell context contains Pell's authored interior state, explicit recent Observer Knowledge, public current-location material, and viewer-safe known people;
- global hidden plot truth, unrelated actors' secrets, hidden location facts, and arbitrary referee-only history are absent;
- a hidden referee sentinel remains visible to referee context but absent from Pell context;
- entity-performance is dialogue-only in this slice: no mechanic, state mutation, transition, or Tactical Activation may be authored by the response;
- explicit non-TALK triggers continue through the normal referee/aftermath planner path;
- bounded context prefers the most recently revised Observer Knowledge.

### Deliberately deferred from TALK

- true nearby audibility/overhearing fan-out;
- whispers and explicit speech-range rules;
- split-party speech propagation;
- talking to player-roster monsters or other non-actor entity classes;
- polished speech bubbles/subtitles/Chronicle presentation.

These are future expansions of observer/audience semantics, not reasons to hold the current player journey at TALK.

## GF-RPG-05 — CHANGE: persistent world actions from controls and freeform intent — ACTIVE

This milestone proves that the graphics do not restrict tabletop agency and that prose does not bypass authority.

### Primary acceptance

> With Cinder recalled, the player can use a dedicated **Deploy** control or type a natural-language intent such as “I pull out Cinder's cube and release her beside me.” Both paths converge on the same authoritative deploy operation. Deterministic ownership/deployment rules validate it, semantic and GameFrame physical state commit, Cinder appears in the current scene, narration/history describes the accepted result, and refresh/restart preserves deployment.

Required properties:

- direct UI and **Do Something Else** converge on the same semantic/mechanical authority;
- natural language represents an attempted action, never a direct state assignment;
- failed/illegal deployment does not become true because the model narrated it;
- committed deployment/recall is reconstructable and materializes consistently;
- current player control relationships come from ruleset/profile authority, not generic engine assumptions;
- GameFrame chooses a valid physical placement after semantic deployment is accepted.

Promote only concrete operations the chapter needs. After deploy/recall, likely candidates are inspect/use/open/take/change important objects, knowledge reveal/correction, checks, objectives/events, and relationship/memory consequences.

## GF-RPG-06 — TRAVEL: Crooked Checkpoint ↔ West Woods

Turn the existing route projection/route mouth into an actual player journey:

- approach/target the route or enter its authorized transition zone;
- validate current semantic exit authority;
- commit source→destination semantic presence transfer;
- materialize `scene.west-woods`;
- establish valid physical arrival state;
- return to the same Crooked Checkpoint materialization;
- preserve meaningful object/entity/world continuity.

**Exit:** West Woods is a real persistent place the player can visit and revisit without world/materialization drift.

## GF-RPG-07 — FIGHT foundation: Monster Master rules/control authority

Promote only what same-map campaign combat requires: Monster Master Ruleset/profile/version, principal → Master/player-character → controlled/deployed entity set, class/profile deployment limits, Master tactical participation, initiative/action economy, movement/range/targeting/actions, conditions/resources/objectives/outcomes, and non-elimination exits where supported.

Do not hardcode one player = one unit or exactly one monster into the generic engine.

## GF-RPG-08 — FIGHT: same-map Tactical Activation

```text
exploration
→ tactical trigger
→ validate current semantic/materialized/ruleset/control state
→ Tactical Activation
→ current positions become tactical starting positions
→ deterministic turn-based play on current geometry
→ deterministic result + semantic reconciliation
→ exploration resumes on the same map
```

No Arena handoff, substitute campaign battlefield, or Return-to-Campaign step.

## GF-RPG-09 — PROVE

Complete the bounded single-player journey and then validate human play → restart/reconnect → deterministic/machine play → live provider → deployed staging before broadening architecture.

## Later

1. true local speech audibility/whispers and two-human one-scene observer divergence;
2. second materially different handcrafted Game Family;
3. Campaign Architect + dynamic Role-Playing Games + Battle Pack authoring;
4. dynamic Battle Simulator convergence;
5. split-party simultaneous scenes;
6. richer media/multi-session systems.

## Governing rule

> The graphics visualize the imagination; they do not define its boundaries. Build the world as the primary game, keep arbitrary intent legal through validated adjudication, preserve observer-scoped truth/history, and let real play determine which abstractions deserve to exist.
