---
title: RPG GameFrame Interface Contract
status: accepted
document_type: contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
depends_on:
  - rpg-gm-runtime-boundary.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
related:
  - ROADMAP.md
  - rpg-platform-delivery-plan.md
  - monster-master-rpg-current-creative-direction.md
  - fixtures/rpg/v1/shared-rpg-fixtures.json
---

# RPG GameFrame Interface Contract

## Purpose

GameFrame provides the complete authenticated player interface and the reusable internal **GameFrame RPG Engine** for persistent embodied campaigns.

It exchanges versioned semantic commands, viewer-safe projections, materialization references, observer/audience-scoped presentation events, ruleset capabilities, and structured deterministic outcomes with RPG GM Runtime.

The interface must make campaign state playable and legible without turning Dungeon Master prose, browser coordinates, or generated pixels into the database.

## Player-facing surfaces

- **Games** — top-level player destination.
- **Role-Playing Games** — campaign surface containing Monster Master RPG and later campaigns/create/resume/import tooling.
- **Battle Simulator** — standalone tactical sandbox containing Monster Master Arena Battles and later Battle Packs.
- **GameFrame RPG Engine** — internal architecture, not a player-facing card.

Campaign tactical play never navigates into Battle Simulator.

## Primary player modes

The mature RPG shell supports semantic modes that may share UI:

- **Explore** — movement/camera/current-world play;
- **Interact** — target a present entity/object/route and expose supported contextual actions;
- **Talk** — in-fiction speech directed at a present entity;
- **Do Something Else** — arbitrary plausible in-fiction intent outside dedicated controls;
- **Ask Game Master** — out-of-fiction rules/knowledge/clarification;
- **GM Intervention** — GM-origin narration/advisory/dramatic presentation;
- **Tactical Mode** — strict turn/action authority on the same materialized scene;
- **Campaign Chronicle** — observer-authorized history/recap of meaningful committed play.

The world is the primary play surface. The chronicle/history is supporting presentation, not the permanent main controller.

## GameFrame responsibilities

GameFrame owns:

- authenticated principal/session custody;
- materialization identity/version/hash and playable geometry;
- x/y/facing and scene-scoped physical position revision;
- collision/pathing/picking/camera;
- nearby interaction targeting/range;
- contextual interaction controls;
- ruleset capability integration;
- character/control authorization;
- deterministic mechanics;
- Tactical Activation/tactical state;
- player-safe rendering;
- physical recovery/reconnect;
- standalone Battle Simulator lifecycle.

GameFrame does not own hidden CampaignPackage truth or Dungeon Master hidden context.

## Runtime responsibilities at the interface

Runtime owns or supplies:

- committed semantic scene/entity/objective/world truth;
- Observer Knowledge and viewer-authorized identity disclosure;
- semantic route/exit authority;
- Dungeon Master context modes and decisions;
- semantic consequences and scene transfer;
- audience/origin semantics for narration/dialogue/interventions;
- semantic Tactical Activation reasons/objectives/requirements;
- semantic reconciliation after deterministic GameFrame outcomes.

## Command authority

**All GameFrame RPG commands/mutations use authenticated HTTP. WebSockets are projection/notification-only.**

This includes ordinary exploration movement.

Current movement command:

```text
POST /api/rpg/campaigns/:campaignId/exploration/move
```

The browser sends bounded movement intent plus expected physical position revision. GameFrame validates scene/materialization/player authority, collision, and revision; commits x/y/facing to GameFrame-owned durability; and returns the accepted physical position.

WebSocket frames cannot create movement/world/tactical mutations. They may notify clients that durable state changed or carry reconstructable projections where supported.

## Player command families

### Talk / Interact

Conceptually:

```ts
type InteractWithEntityV1 = {
  kind: "campaign.interact";
  expectedGameframeCoordinationRevision: number;
  targetEntityId: string;
  interactionKind: "talk" | "inspect" | "use" | string;
  text?: string;
};
```

GameFrame proves physical target/range. Runtime proves semantic presence/authorization and compiles the correct context mode when semantic/Dungeon-Master work is required.

The browser cannot make an arbitrary hidden entity targetable by naming its canonical ID.

### Do Something Else

```ts
type SubmitFreeformIntentV1 = {
  kind: "campaign.freeform_intent";
  expectedGameframeCoordinationRevision: number;
  text: string;
};
```

Freeform text expresses **attempted intent**, not authoritative result.

Example:

```text
"I throw Cinder's cube and release her beside me."
→ interpret deploy intent
→ validate ownership/rules/deployment state
→ commit accepted semantic + physical change
→ update projection/world
→ present narration/history
```

The model may interpret what the player is trying to do. It cannot create state by narrating success.

### Ask Game Master

```ts
type AskGameMasterV1 = {
  kind: "campaign.ask_gm";
  expectedGameframeCoordinationRevision: number;
  question: string;
};
```

Ask-GM is out-of-fiction and player-private by default. It does not automatically become character speech, make NPCs hear it, or advance fictional time.

### Structured ruleset commands

GameFrame may expose dedicated deterministic commands for supported mechanics such as deploy/recall, inventory, equipment, abilities, checks, object use, scene transition requests, and tactical actions.

Direct UI and freeform adjudication should converge on the same underlying mechanic/semantic authorities rather than implement separate worlds.

## Exploration projection

Runtime provides viewer-safe semantic scene/world information. GameFrame materializes it physically.

A projection carries semantic scene/revision/lifecycle, location/world identity, viewer-safe entities/objects/routes, interaction target IDs, materialization intent, and optional accepted materialization ref.

It deliberately excludes x/y/facing, collision geometry, pathfinding, camera, and tactical legal-action authority.

## Materialized scene authority

GameFrame materialization may retain:

- materialization ID/version/hash;
- semantic scene/location linkage;
- collision/navigation geometry;
- semantic anchor/interaction bindings;
- transition zones;
- recoverable player/entity physical state;
- tactical state when active;
- asset/fallback provenance.

Generated imagery never defines collision or campaign truth by itself.

## Interaction targeting

The generic interaction layer should determine, from current physical state and viewer-authorized semantic bindings:

- which targets are physically present/eligible;
- interaction range;
- preferred/selected target;
- supported contextual actions;
- whether a route/transition affordance is physically reachable.

Pell is the first TALK target, not a special architecture branch.

West Woods is currently a projected route + physical route mouth. It becomes a real transition only when a durable semantic transfer command is implemented.

## Origin, audience, audibility, and presentation

Keep these concepts separate:

- **origin** — player, entity, dungeon-master, deterministic-mechanic, system;
- **audience** — who is authorized to receive the semantic presentation/history;
- **audibility/observation** — who in the world actually heard/saw the in-fiction event;
- **presentation** — bubble, subtitle, world narration, journal entry, GM panel, etc.

A single committed event may produce multiple presentations without becoming multiple truths.

Example:

```text
Pell speaks normally
→ nearby authorized observers hear it
→ temporary speech bubble/subtitle may render in-world
→ authorized campaign chronicles may later show the same dialogue
```

A whisper may intentionally restrict hearing/audience. A private Ask-GM answer is not audible in-fiction.

Presentation UI must never broaden the underlying audience.

## Observer-safe identity

Canonical Runtime names are not presentation defaults.

A stable entity may appear to one observer as:

```text
"woman in inspector's gear"
→ "checkpoint official"
→ "Mara Venn"
```

while another observer remains at an earlier identity stage. Narration, dialogue attribution, labels, People views, and campaign chronicle entries use the observer-authorized identity.

## Campaign Chronicle

The campaign history/feed should evolve into a meaningful observer-authorized chronicle rather than a tiny combat log.

Appropriate durable presentation includes:

- opening/scene narration;
- dialogue the observer heard/participated in;
- important discoveries;
- consequential player actions;
- deterministic mechanic outcomes;
- persistent world changes;
- scene transitions;
- GM interventions/rulings appropriate to that audience.

It need not record every movement step, camera action, or transient animation.

Different players may legitimately have different chronicles because knowledge, audibility, private GM communication, and later split-party presence can diverge.

## Same-map Tactical Activation

Campaign combat uses the current materialized world:

```text
exploration
→ validate Tactical Activation
→ resolutionMode = tactical
→ current positions/geometry/entities/objects/exits remain
→ deterministic tactical resolution
→ semantic reconciliation
→ resolutionMode = exploration
```

No Arena product launch, replacement campaign battlefield, or Return-to-Campaign step.

## Transport recovery

Reconnect recovers from durable authorities:

1. semantic campaign scene/membership/observer state from Runtime;
2. accepted GameFrame materialization;
3. valid GameFrame x/y/facing/tactical state;
4. projection/history positions as applicable.

No correctness invariant depends on a permanently connected WebSocket.

## Governing rule

> The player acts through the world first. Dedicated controls and arbitrary freeform intent converge on authoritative game/semantic operations; speech and narration respect observer scope; and the campaign chronicle records meaningful accepted play without becoming the source of truth.
