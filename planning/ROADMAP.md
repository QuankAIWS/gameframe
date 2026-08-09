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
  - monster-master-rpg-encounter-rules.md
  - decisions/0005-gameframe-bot-and-external-agent-boundary.md
---

# Scribbles GameFrame Roadmap

## Canonical boundaries

- **Games** is the top-level player-facing GameFrame destination.
- **Role-Playing Games** is the player-facing campaign surface; **GameFrame RPG Engine** remains internal architecture terminology.
- **Battle Simulator** is the standalone tactical sandbox; Monster Master Arena Battles is its first Monster Master entry.
- GameFrame owns physical materialization, realtime transforms, collision/pathing/camera, direct interaction UI, deterministic RPG Ruleset execution, control authorization, and tactical state.
- `rpg-gm-runtime` owns CampaignPackages, semantic world truth, Dungeon Master orchestration, hidden campaign truth, journaled entity/scene/observer-knowledge state, and semantic consequences.
- HTTP owns GameFrame RPG commands/mutations; WebSockets remain projection-only and reconnectable from durable state.
- Campaign combat uses **Tactical Activation** on the current materialized map; it never launches Battle Simulator or a replacement campaign battlefield.
- MM-0001 remains standalone/regression substrate and the seed for Monster Master Arena Battles.

## Current development mode

```text
SEE → MOVE → TALK → CHANGE / TRAVEL → FIGHT → PROVE
```

**TALK is the active next player slice.** SEE and MOVE are bounded complete.

Every substantive RPG PR should advance that bounded Monster Master journey or remove a demonstrated blocker to it.

Reuse the existing Pixi world/tactical renderer and terrain foundations. Do not block the first playable scene on final art or generalized procedural generation.

## Completed foundations

Preserve the useful current GameFrame substrate:

- authenticated players/seats/invitations and server-derived identity;
- durable coordination/presentation revisions and idempotent command foundations;
- audience-scoped presentation;
- Worker/Cloudflare/VM/Tunnel deployment surfaces;
- authenticated RPG WebSocket/recovery substrate;
- PixiJS Monster Master renderer;
- reusable terrain projection/geometry/material pipeline;
- tactical movement/initiative/attack/health/effect machinery;
- standalone Monster Master BattleBot/regression surface;
- Role-Playing Games / Battle Simulator player navigation;
- strict `campaign.exploration_projection` contract;
- viewer-independent materialization identity and scene-bound accepted-ref validation;
- canonical Crooked Checkpoint exploration fixture aligned to CampaignPackage v5;
- GameFrame-owned exploration x/y/facing persistence and scene-scoped movement revision;
- WASD/collision/camera-follow exploration over the existing Pixi world.

Runtime foundations consumed by GameFrame include Entity Registry, Scene Registry, Observer Knowledge / People, WorldGraph/materialization intent, and the viewer-safe exploration projection.

## GF-RPG-01 — Generic semantic/physical boundary — bounded foundation complete

```text
Runtime semantic authority
→ viewer-safe campaign.exploration_projection
→ GameFrame physical materialization/session authority
```

The exploration contract carries campaign/package/ruleset identity, semantic scene/revision, authorized entities/objects/routes, materialization intent, and optional accepted materialization ref. It deliberately carries no x/y/facing/geometry/collision/pathfinding/camera authority.

## GF-RPG-02 — SEE: Crooked Checkpoint materialization — bounded implementation complete

The first physical campaign scene now has a production-shaped path:

```text
authenticated GameFrame player
→ GameFrame private Runtime client
→ bearer-authenticated Runtime S6 exploration projection
→ strict GameFrame projection normalization
→ deterministic Crooked Checkpoint semantic-layout materializer
→ existing Monster Master Pixi terrain/world renderer
```

Implemented bounded evidence:

- `scene.crooked-checkpoint` materialization from the real S6 contract;
- existing `rpg-scene:<campaignId>:scene.crooked-checkpoint` materialization identity/version/hash derivation;
- deterministic 18×14 physical layout containing the settled road, checkpoint barrier, inspection edge, maintenance-shed mass, drainage edge, and westbound route mouth;
- viewer-authorized player/Pell/object/route anchors with stable semantic/interaction IDs;
- existing Monster Master Pixi renderer and terrain assets reused rather than forked;
- RPG browser attaches the physical scene without supplying a viewer/player override;
- refresh reattaches and derives the same physical materialization identity;
- viewer-specific labels/entity disclosure/route visibility do not change physical geometry identity;
- no tactical legal actions are exposed through the exploration adapter.

Focused Node and browser acceptance prove the materializer, Runtime transport, authenticated GameFrame route, terrain/world rendering, safe Pell/cart/route overlays, and stable refresh identity.

## GF-RPG-03 — MOVE: embodied realtime session — bounded implementation complete

The movement authority is GameFrame-local and command traffic stays on HTTP:

```text
semantic/materialized scene attach
→ GameFrame exploration movement session
→ authenticated HTTP movement command
→ collision + position revision + SQLite checkpoint
→ exploration_position response
→ Pixi transform + camera follow
```

Implemented bounded evidence:

- physical player x/y/facing is stored outside Runtime semantic truth;
- the exact materialization ID/version/hash scopes persisted position recovery;
- WASD performs cardinal movement and Q/E reuses existing Pixi camera rotation;
- camera-quarter-relative key mapping keeps WASD screen-oriented after rotation;
- map bounds, wall terrain, visible actors, and visible objects block movement;
- blocked x/y is never committed, while a facing-only change may be checkpointed;
- accepted movement uses authenticated `POST /api/rpg/campaigns/:id/exploration/move` in local and hosted play;
- the existing campaign WebSocket remains projection-only and rejects movement commands;
- Cloudflare exposes the HTTP movement route through the same-origin authenticated HMAC edge proxy;
- accepted x/y/facing is checkpointed in GameFrame SQLite with optimistic position revisions;
- GameFrame restart and exploration reattach recover a valid exact-materialization position;
- if a saved tile becomes newly occupied, reattach durably resets the player to a traversable spawn with a new accepted position revision;
- stale client revisions/materializations fail closed;
- movement does not call Runtime exploration projection and does not advance campaign semantic/coordination/presentation revisions;
- the existing Pixi player unit is updated in place and the exploration camera follows accepted movement;
- browser backpressure allows one move command in flight and retains at most the newest queued direction.

### MOVE evidence boundary

MOVE does **not** yet prove direct interaction range/selection, Pell perspective-correct speech, Ask Game Master, semantic world mutation, West Woods transfer, same-map Tactical Activation, multiplayer avatar occupancy, or analog/sub-tile locomotion.

## GF-RPG-04 — TALK: Pell interaction + GM surfaces — ACTIVE NEXT

Drive Runtime context-mode work through the physical scene.

GameFrame surfaces:

- targetable Talk / Interact;
- Ask Game Master;
- Do Something Else;
- GM intervention/pause/freeze presentation;
- People/character/control views as required.

Pell is the first entity-performance target. GameFrame sends a stable interaction target; Runtime determines perspective-correct semantic context.

### Exit

The player walks to Pell, talks to Pell, separately asks the GM, and submits a freeform action without confusing entity speech, referee authority, or deterministic mechanic results.

## GF-RPG-05 — CHANGE / TRAVEL: persistent world and West Woods

Promote only concrete world interactions the Crooked Checkpoint chapter uses. GameFrame presents/executes deterministic mechanics requested by Runtime for concrete interactions such as checks and object actions; narration is never parsed to infer state.

Then add West Woods:

- current available route/exit interaction;
- authoritative semantic transfer;
- `scene.west-woods` materialization;
- destination scene session;
- stable revisit;
- return to the same Crooked Checkpoint materialization;
- meaningful object/entity/world continuity.

### Exit

The player can cause at least one persistent world change, travel Crooked Checkpoint ↔ West Woods through ordinary play, and revisit the same places without drift.

## GF-RPG-06 — FIGHT foundation: Monster Master rules/control authority

Promote existing tactical semantics into the reusable RPG boundary only as required by same-map campaign combat:

- Monster Master Ruleset/profile/version;
- principal → Master/player-character → controlled entity set;
- class/archetype/profile;
- class-defined monster deployment/control limits;
- Master tactical participation;
- initiative/action economy;
- movement/range/targeting/actions;
- conditions/resources/objectives/outcomes;
- escape/withdrawal/surrender/recall/incapacitation where implemented.

Do not hardcode one player = one unit or one Master = one monster into the generic engine.

## GF-RPG-07 — FIGHT: same-map Tactical Activation

```text
exploration
→ tactical trigger
→ validate current semantic/materialized/ruleset/control state
→ Tactical Activation
→ current positions become tactical starting positions
→ deterministic turn-based actions on current geometry
→ deterministic consequences
→ semantic reconciliation where required
→ exploration resumes on the same map
```

No replacement campaign battlefield and no Return-to-Campaign navigation.

### Exit

The player can enter and finish combat on the existing scene, then immediately continue exploration with exact resulting state after reconnect/restart.

## GF-RPG-08 — PROVE: complete single-player Monster Master

```text
Role-Playing Games
→ Monster Master RPG
→ Crooked Checkpoint materialization
→ movement
→ Pell interaction
→ Ask-GM
→ Do Something Else
→ persistent world change
→ West Woods travel/revisit
→ event/check consequence
→ same-map Tactical Activation
→ Master + controlled monster actions
→ deterministic tactical result
→ same-scene exploration resume
→ bounded campaign resolution
→ restart/resume
```

Validation order:

1. human playthroughs;
2. deterministic/machine-play regression;
3. live provider proof;
4. deployed staging proof.

## GF-RPG-09 — Two-human one-scene campaign

Only after single-player proof, add separate authenticated avatars/principals, one shared active scene, viewer-divergent knowledge, party/public/private presentation, cohesive transitions, cooperative control, same-map tactical mode, and reconnect.

Split-party simultaneous scenes remain later.

## GF-RPG-10 — Second handcrafted Game Family

Run a materially different handcrafted campaign/game family through the same GameFrame RPG Engine, Runtime semantic architecture, materialization framework, context modes, RPG Ruleset boundary, and Tactical Activation framework. Repair generic abstractions rather than adding family-specific engine branches.

## GF-RPG-11 — Campaign Architect / dynamic Role-Playing Games / Battle Pack authoring

Only after two handcrafted game families prove the architecture:

- data-driven Role-Playing Games discovery/resume;
- Create RPG / My Campaigns / Import Campaign;
- Campaign Architect draft/refinement/preview/commit;
- generated/selectable validated ruleset profiles and reusable game-family content;
- Battle Pack authoring/export for combat-capable families;
- spoiler-safe exposure/unlock policy.

## GF-RPG-12 — Dynamic Battle Simulator

After the shared rules/game-family boundary is proven:

- Battle Pack discovery/selection;
- Monster Master Arena Battles as the first pack/family;
- character/class/loadout builder;
- opponent/team setup;
- map selection/generation;
- BattleScenario setup;
- objectives/deployment;
- humans/BattleBot;
- replay/rematch/analysis;
- imported/generated Battle Packs;
- ruleset equivalence with campaign Tactical Mode.

## GF-RPG-13 — Split-party multi-scene

Only after one-scene multiplayer is trustworthy, add independent live scene subscriptions, scene-local knowledge/audibility, cross-scene communication, independent recovery/materialization, and explicit cross-scene tactical/global-clock rules.
