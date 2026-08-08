---
title: RPG GameFrame Interface Contract
status: accepted
document_type: contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
depends_on:
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
related:
  - rpg-platform-delivery-plan.md
  - tactical-battler-rpg-foundation.md
  - monster-master-rpg-encounter-rules.md
  - fixtures/rpg/v1/shared-rpg-fixtures.json
  - fixtures/rpg/v1/campaign-revision-linkage.json
---

# RPG GameFrame Interface Contract

## Purpose

GameFrame provides the complete authenticated player interface and the reusable **GameFrame RPG Engine** for persistent embodied campaigns.

It exchanges versioned semantic commands, viewer-safe projections, materialization references, audience-scoped presentation events, ruleset capabilities, and structured deterministic outcomes with RPG GM Runtime.

The interface must make campaign state legible without turning Dungeon Master prose, browser coordinates, or generated pixels into the database.

## Product surfaces

GameFrame distinguishes:

- **GameFrame RPG** — future generic campaign creation/library/resume product;
- **Monster Master RPG** — bespoke Monster Master campaign title built on GameFrame RPG Engine + Monster Master Ruleset;
- **Monster Master Battle Arena** — standalone tactical simulator using Monster Master Ruleset + BattleScenario setup;
- **GameFrame RPG Engine** — reusable internal player/world/mechanics layer shared underneath RPG products.

Campaign tactical play never navigates into Monster Master Battle Arena.

## Required embodied client modes

The mature RPG shell should support:

- campaign join/seat/invitation/resume;
- **Explore** — persistent materialized scene, avatar movement, camera, collision/picking, interaction targeting, transitions;
- **Talk / Interact** — targeted in-fiction interaction with a present entity/object;
- **Do Something Else** — arbitrary plausible in-fiction/freeform intent outside dedicated controls;
- **Ask Game Master** — out-of-fiction rules/knowledge/clarification;
- **GM Intervention** — GM-origin advisory/narration/dramatic presentation;
- People/Characters and observer-authorized knowledge;
- character/party/controlled-entity state;
- inventory/equipment/abilities/conditions/objectives as active ruleset supports;
- maps/known locations/points of interest;
- deterministic checks/mechanics;
- **Tactical Mode** on the current materialized scene;
- history/GM log/recap/reconnect/recovery.

These are semantic modes/surfaces, not necessarily separate routes.

## GameFrame RPG Engine responsibility

GameFrame RPG Engine owns reusable player-side capabilities including:

- scene materialization identity/version;
- Pixi world rendering;
- deterministic collision/navigation geometry;
- camera/picking/interaction range;
- avatar/entity transforms required for play;
- scene transition zones;
- direct interaction targeting;
- ruleset capability integration;
- character/control authorization;
- deterministic mechanics;
- Tactical Activation/tactical mode;
- realtime scene session transport;
- player-safe projections/UI;
- standalone BattleScenario materialization for Battle Arena.

It does not own hidden CampaignPackage truth or Dungeon Master hidden context.

## RPG Ruleset interface

A campaign/game selects an explicit ruleset/profile/version.

GameFrame capability declarations should expose supported deterministic features such as:

- character/class schemas;
- resource/condition vocabulary;
- actions/abilities;
- control/deployment relationships;
- initiative/action economy;
- movement/range/line-of-sight semantics;
- objective/terminal-state vocabulary;
- world interaction primitives;
- inventory/equipment/progression where implemented.

Unsupported required ruleset capability fails validation rather than silently falling back to a different mechanic.

Monster Master RPG and Monster Master Battle Arena should converge on the same Monster Master Ruleset capability implementation.

## Player command families

### Talk / Interact

A targeted in-fiction command identifies one viewer-authorized present entity/object and the intended interaction.

Conceptually:

```ts
type InteractWithEntityV1 = {
  kind: "campaign.interact";
  expectedGameframeCoordinationRevision: number;
  targetEntityId: string;
  text?: string;
  interactionKind?: string;
};
```

Server/runtime validate that the authenticated player may target the entity and that semantic scene presence permits the interaction.

### Do Something Else

A freeform in-fiction command for plausible actions not represented by fixed controls.

```ts
type SubmitFreeformIntentV1 = {
  kind: "campaign.freeform_intent";
  expectedGameframeCoordinationRevision: number;
  text: string;
};
```

This is the tabletop-agency escape hatch and remains first-class even as embodied controls grow.

### Ask Game Master

```ts
type AskGameMasterV1 = {
  kind: "campaign.ask_gm";
  expectedGameframeCoordinationRevision: number;
  question: string;
};
```

It does not automatically become fictional speech, does not make NPCs hear it, and does not advance fictional time by default.

Ask-GM is player-private by default unless a future explicit command requests broader visibility.

### Structured/ruleset commands

GameFrame may expose dedicated deterministic commands for supported mechanics, including inventory, equipment, abilities, checks, object use, scene transitions, and tactical actions.

Client-authored entity/controller/player IDs never create authority by themselves.

Every mutation uses bounded payloads, stable command identity, expected revision, idempotency, and server-derived authenticated principal.

## Scene projection

Runtime provides viewer-safe semantic scene/world information while GameFrame owns materialized physical presentation.

A semantic projection may contain concepts equivalent to:

```ts
type PlayerSceneProjectionV2 = {
  sceneId: string;
  semanticSceneRevision: number;
  locationId: string;
  locationLabel: string;
  materializationRef?: {
    materializationId: string;
    materializationVersion: number;
  };
  presentEntities: SceneEntityProjectionV2[];
  visibleObjects: SceneObjectProjectionV2[];
  knownHazards: SceneHazardProjectionV2[];
  exits: SceneExitProjectionV2[];
  resolutionMode: "exploration" | "tactical" | "cinematic-pause" | "transitioning";
};
```

Runtime may track zero or more semantic scenes. A player's ordinary projection exposes the scene occupied by that player's character.

Only viewer-authorized semantic information appears.

## Materialized scene authority

GameFrame retains a validated materialization record for a semantic scene/location.

It may include:

- materialization ID/version/hash;
- semantic scene/location linkage;
- ruleset compatibility;
- collision/navigation geometry;
- semantic anchors;
- transition zones;
- interactive-object bindings;
- current recoverable entity transform state;
- deterministic tactical state if tactical mode is active;
- asset bundles/provenance/fallbacks.

Generated images do not define collision or object authority.

Revisiting a materialized campaign scene should return to the same accepted location/layout, subject to committed changes.

## Realtime exploration transport

High-frequency movement belongs to GameFrame realtime/session authority rather than RPG GM Runtime's semantic journal.

A scene-scoped WebSocket/session protocol may carry bounded:

- movement intent/state;
- x/y/facing transforms;
- nearby-player/entity transforms;
- animation/presence hints;
- scene/tactical position notifications;
- post-commit projection-change notifications.

The socket is not durable campaign truth.

Reconnect recovers:

1. semantic scene membership from durable campaign state;
2. accepted GameFrame materialization;
3. valid GameFrame transform/tactical state according to recovery policy.

A client cannot replay stale movement packets as semantic campaign actions.

## People / Observer Knowledge projection

GameFrame exposes viewer-safe People/knowledge data derived from semantic Observer Knowledge rather than the complete entity registry.

A stable entity may evolve visually from descriptor → role → proper name without changing entity ID.

Unknown entity existence is omitted when required.

GameFrame does not infer knowledge from canonical runtime names or from hidden materialization metadata.

## Character/control projection

The player-facing character/party projection must distinguish identity from **control authority**.

A generic ruleset-driven projection may expose concepts such as:

```text
authenticated principal
player-character entity
controlled/commandable entity IDs
control reason/profile
ruleset/class deployment limits
current active/deployed state
```

For Monster Master, one player may control their own Master/trainer plus one or more deployed monsters according to class/ruleset state.

The generic engine must not hardcode one-player-one-unit or exactly-one-monster assumptions.

## Dungeon Master/entity presentation origin

Presentation audience and semantic origin are separate.

Useful origins include:

- player;
- dungeon-master;
- entity;
- system;
- deterministic-mechanic;

Entity-origin presentation uses viewer-authorized labels.

The UI should distinguish a conversation with Pell from a message to the Game Master even though the Dungeon Master capability may have generated both through different context modes.

## GM communication log

GameFrame should provide a dedicated GM communication/history surface containing audience-authorized:

- Ask-GM requests/answers;
- GM interventions;
- rules/mechanical clarifications;
- private character-knowledge responses;
- important table rulings where useful.

NPC dialogue belongs to entity/world interaction history rather than automatically appearing as a GM conversation.

## GM intervention presentation

A GM intervention may include explicit controls such as:

```text
audience
intensity: advisory | narration | dramatic
interaction: nonblocking | pause-local-control | freeze-scene
```

World freeze/pause affects input/presentation; semantic world changes still require validated authority operations.

## Same-map Tactical Activation

### Core invariant

Campaign combat does not launch a new route, Arena product, or substitute battlefield.

When initiative is required, GameFrame validates and commits a **Tactical Activation** over the current materialized scene.

The activation uses:

- semantic scene ID/revision;
- materialization ID/version;
- current tactically relevant positions/facing;
- participants/roles/factions;
- authenticated control authority;
- current health/resources/conditions;
- ruleset/profile/version;
- existing map geometry/objects/hazards/exits;
- objectives/alternate terminal conditions.

After activation:

```text
resolutionMode = tactical
```

The player remains on the same map.

### Tactical UI/state

GameFrame may enable:

- initiative/turn order;
- action economy;
- legal movement/path overlays;
- range/targeting/line of sight;
- abilities/attacks;
- objective/exit-zone indicators;
- conditions/health/resources;
- deterministic bot behavior;
- tactical revision/reconnect/replay evidence.

These controls derive from current world geometry rather than a newly materialized battle map.

### Terminal tactical state

Supported outcome vocabulary may include:

- active;
- incapacitated;
- withdrew;
- fled;
- surrendered;
- recalled;
- dead only under explicit lethal rules;
- resource/condition/objective/object/exit consequences.

After required deterministic and runtime-semantic consequences reconcile safely:

```text
resolutionMode = exploration
```

Tactical UI disappears/changes and ordinary movement resumes from resulting positions/state.

There is no campaign `Return to Campaign` button because the player never left.

## Monster Master Battle Arena interface

The standalone Arena product starts from a BattleScenario/setup flow rather than campaign semantic world state.

A future setup may provide:

- character/class/loadout builder;
- monster/team selection;
- map selection/generation;
- deployment/starting positions;
- objectives;
- human/bot players;
- replay/rematch.

Once tactical play begins, shared Monster Master Ruleset behavior should match Monster Master RPG for equivalent ruleset versions/profiles.

Arena-specific setup convenience must not create divergent combat rules.

## Revision/identity domains

Keep distinct:

- authenticated principal identity;
- campaign/entity identity;
- semantic scene ID/revision;
- GameFrame materialization ID/version;
- GameFrame coordination revision;
- presentation sequence;
- runtime narrative/semantic revision;
- realtime session/transform revision as needed;
- tactical activation/tactical revision;
- ruleset/profile/version;
- standalone BattleScenario/match identity.

Lost network responses do not roll back committed truth.

## One-scene multiplayer first

Initial two-human campaign acceptance should use one shared active party scene at a time.

GameFrame must prove:

- separate authenticated principals/avatars;
- scene-scoped realtime movement;
- viewer-divergent knowledge;
- direct NPC interaction custody;
- party-cohesion scene transitions;
- shared/private GM communication;
- ruleset-defined cooperative tactical control;
- same-map Tactical Activation;
- reconnect/recovery.

Split-party/multiple-simultaneous-scene UI/transport remains a later layer over the zero-or-more semantic scene model.

## Correctness requirements

- server-derived player identity;
- explicit ruleset/version capability validation;
- stable materialization identity;
- no hidden semantic truth inferred from pixels;
- no per-frame RPG journal traffic;
- idempotent durable semantic commands;
- scene-scoped realtime authorization;
- observer-safe entity labels/knowledge;
- player/NPC perspective separation;
- Ask-GM distinct from in-fiction actions;
- generic control-authority model;
- Tactical Activation on existing map;
- no campaign launch into Monster Master Battle Arena;
- no campaign Return-to-Campaign lifecycle;
- tactical/exploration recovery across reconnect/restart;
- no direct cross-repository storage access.

## First upgraded conformance journey

1. Attach to committed Monster Master campaign.
2. Load accepted Crooked Checkpoint materialization.
3. Move avatar through GameFrame geometry.
4. Inspect/talk to a present entity.
5. Prove Pell receives Pell-scoped knowledge only.
6. Ask GM a private out-of-fiction question.
7. Use Do Something Else for one plausible unsupported action.
8. Interact with a world object.
9. Transfer to/materialize a connected scene and revisit stably.
10. Trigger Tactical Activation in current scene.
11. Use current positions as tactical starting positions.
12. Control Master/trainer and permitted deployed monster(s) under Monster Master Ruleset.
13. Resolve one alternate terminal outcome where supported.
14. Reconcile consequences and switch same scene back to exploration.
15. Restart/reconnect without duplicated entities, world drift, secret leakage, or tactical reset.

## Governing rule

> GameFrame RPG Engine is one continuous player/world/mechanics surface: rulesets define deterministic game behavior, the Dungeon Master handles interpretation and character perspective, and initiative changes the control rules of the world already on screen rather than sending the campaign somewhere else.
