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
SEE      ✅
MOVE     ✅
MOBILE   ✅
TALK     ← ACTIVE
CHANGE / TRAVEL
FIGHT
PROVE
```

The active product goal is no longer a transcript-first RPG shell. The game world is the primary interaction surface. Text/history remains important, but feed UX polish is deliberately secondary until ordinary play can be performed through the world.

Every substantive RPG PR should advance the bounded Crooked Checkpoint journey or remove a demonstrated correctness blocker to it.

## Current deployed proof

The staging path now proves:

- authenticated Monster Master RPG launch through `gameframe.cc` staging;
- CampaignPackage v5 staging bootstrap;
- viewer-safe Crooked Checkpoint semantic scene bootstrap;
- deterministic Pixi materialization;
- desktop WASD movement and camera rotation;
- mobile D-pad/rotation controls using the same authenticated HTTP movement command path;
- GameFrame-owned durable x/y/facing recovery;
- collision with bounds, terrain, visible actors, and visible objects;
- refresh/restart recovery to the same materialization/valid position;
- player-safe initial identity disclosure: Pell is known; the checkpoint official is not named before the player learns that name.

The West Woods marker currently proves an authorized route/exit projection and physical route mouth only. It is **not yet a functioning scene transfer**.

## Immediate correctness/content cleanup before and during TALK

Keep this bounded; do not turn it into a feed redesign project.

1. **Opening pacing:** establish Crooked Checkpoint as a place, provide enough narration to orient the player, then hand control back. Avoid repeatedly ending narration with forced binary/multiple-choice funnels merely to propel text.
2. **Capture-cube scale:** ordinary capture cubes are handheld devices. They cannot plausibly make a confiscation cart jump or shake by themselves. If the cart needs physical disturbance, author a different cause: a contained creature in specialist equipment, a person/object inside, a shifting load, impact from outside, or another explicit physical source.
3. **Identity custody:** narration, dialogue, labels, history, and GM output must use the observer-authorized identity stage. Canonical package names are not presentation defaults.
4. **Feed correctness before feed polish:** keep audience/origin/state semantics correct now; defer elaborate journal UI until the game itself supports the intended actions.

## Interaction and history model

The intended mature relationship is:

```text
WORLD = primary play surface
  ├─ contextual actions: Talk / Inspect / Use / Travel / Deploy / Recall / etc.
  ├─ Do Something Else: freeform in-fiction intent
  └─ Ask Game Master: out-of-fiction referee communication

CAMPAIGN HISTORY = durable observer-authorized chronicle of what actually happened
```

One authoritative semantic event may have multiple presentations. For example, a spoken line may appear temporarily above an NPC for nearby observers and later appear in each authorized observer's campaign history. A whisper may be visible only to the intended/hearing audience. Ask-GM is player-private by default and is not fictional speech.

The campaign history should eventually contain meaningful narration, discoveries, dialogue, consequential actions, mechanical outcomes, and scene transitions. It must not degrade into a tiny combat log, but it also must not remain the primary control surface once world interaction is mature.

## Completed foundation — SEE

The physical Crooked Checkpoint path is production-shaped:

```text
authenticated GameFrame player
→ POST /api/rpg/campaigns/:campaignId/exploration/attach
→ private bearer Runtime S6 projection
→ strict GameFrame normalization/materialization
→ existing Monster Master Pixi world renderer
```

Bounded evidence includes stable `rpg-scene:<campaignId>:scene.crooked-checkpoint` materialization identity, deterministic semantic anchors, viewer-safe entities/objects/routes, no browser viewer override, and exact refresh/reconnect identity.

## Completed foundation — MOVE + mobile

The movement path is:

```text
WASD / touch D-pad
→ authenticated HTTP
POST /api/rpg/campaigns/:campaignId/exploration/move
→ GameFrame collision + optimistic position revision + SQLite checkpoint
→ exploration_position
→ Pixi transform + camera follow
```

WebSocket mutation attempts remain unsupported. Runtime receives no per-step movement traffic.

## GF-RPG-04 — TALK: generic interaction + Pell context custody — ACTIVE

### GameFrame work

- generic nearby/targetable interaction selection rather than a Pell-only special case;
- deterministic interaction range from GameFrame physical state;
- desktop and mobile Interact affordance;
- Talk targeted at one present viewer-authorized entity;
- clear separation of Talk, Do Something Else, and Ask Game Master;
- presentation hooks that can later support speech bubbles/subtitles/history without making UI presentation the authority.

### Runtime work pulled by TALK

- typed Dungeon Master context modes: referee/world, entity-performance, GM communication, aftermath/intervention;
- Pell entity-performance context composed from Pell-authorized identity/goals/beliefs/memories/relationships/Observer Knowledge/current observations;
- hidden referee facts structurally absent from Pell context until Pell legitimately learns them;
- semantic origin and audience attached to dialogue/narration/intervention output.

### TALK acceptance

The player can walk to Pell, target/interact with him, speak naturally, and receive Pell-performed dialogue that cannot use hidden facts Pell does not know. Ask Game Master remains a separate player-to-referee path. Normal speech has an explicit hearing/audience scope rather than being globally visible by default.

## GF-RPG-05 — CHANGE: world actions from controls and freeform intent

Promote only the concrete world operations the chapter needs.

Key acceptance case:

> With Cinder recalled, the player can use a dedicated control **or** type a natural-language intent such as “I pull out Cinder's cube and release her beside me.” The Dungeon Master interprets intent, deterministic rules validate ownership/deployment legality, semantic/physical state commits, Cinder appears in the current world, and refresh/restart preserves the deployed state.

Other early operations may include inspect/use/take/open/change important objects, knowledge reveal/correction, deterministic checks, objective/event consequences, and relationship/memory consequences.

**Prose is not the commit.** The world changes first through accepted authority; narration/history presents the accepted result.

## GF-RPG-06 — TRAVEL: Crooked Checkpoint ↔ West Woods

Turn the existing route projection/route mouth into an actual player journey:

- approach/target the route or enter its authorized transition zone;
- validate current semantic exit authority;
- commit source→destination semantic presence transfer;
- materialize `scene.west-woods`;
- establish valid physical arrival state;
- return to the same Crooked Checkpoint materialization;
- preserve meaningful object/entity/world continuity.

### Exit

West Woods is no longer decorative. The player can travel there and back through ordinary play without world/materialization drift.

## GF-RPG-07 — FIGHT foundation: Monster Master rules/control authority

Promote only what same-map campaign combat requires:

- Monster Master Ruleset/profile/version;
- principal → Master/player-character → controlled/deployed entity set;
- class/archetype/profile deployment limits;
- Master tactical participation;
- initiative/action economy;
- movement/range/targeting/actions;
- conditions/resources/objectives/outcomes;
- escape/withdrawal/surrender/recall/incapacitation where supported.

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

## GF-RPG-09 — PROVE: complete single-player Monster Master

```text
Role-Playing Games
→ Monster Master RPG
→ Crooked Checkpoint
→ SEE / MOVE
→ TALK
→ Ask-GM / Do Something Else
→ persistent CHANGE
→ West Woods TRAVEL + revisit
→ event/check consequence
→ same-map FIGHT
→ exploration resume
→ restart/reconnect
→ same persistent world
```

Validation order: human playthrough → deterministic/machine-play → live provider → deployed staging.

## Later

1. two-human one-scene campaign with explicit audibility/audience/observer divergence;
2. second materially different handcrafted Game Family;
3. Campaign Architect + dynamic Role-Playing Games + Battle Pack authoring;
4. dynamic Battle Simulator convergence;
5. split-party simultaneous scenes;
6. richer media/multi-session systems.

## Governing rule

> The graphics visualize the imagination; they do not define its boundaries. Build the world as the primary game, keep arbitrary intent legal through validated freeform adjudication, preserve observer-scoped truth/history, and let real play determine which abstractions deserve to exist.
