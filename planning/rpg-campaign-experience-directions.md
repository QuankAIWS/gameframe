---
title: RPG Campaign Experience Direction
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GameFrame RPG
  - Monster Master RPG
  - scribbles-runtime-theo-connector
supersedes:
  - Discord-first illustrated campaign direction
  - unresolved Discord-first versus game-heavy evaluation
  - transcript-first ordinary RPG play as the mature primary experience
  - separate Arena-map campaign combat as the mature tactical experience
related:
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
---

# RPG Campaign Experience Direction

## Decision

The RPG is an **all-GameFrame embodied campaign experience** built on the reusable GameFrame RPG Engine.

GameFrame is the complete authenticated player application for campaign creation/resume, persistent world exploration, direct interaction, Game Master communication, deterministic mechanics, same-map tactical play, history, and recovery.

The mature primary loop is a playable persistent 2D world:

```text
explore
→ approach/interact/talk
→ supported deterministic action or freeform adjudication
→ world changes persist
→ continue exploring
```

When circumstances require initiative:

```text
current world scene
→ Tactical Activation
→ same map under turn-based rules
→ tactical consequences
→ same scene returns to exploration
```

No replacement campaign battlefield is loaded and no campaign `Return to Campaign` step exists.

## Product family relationship

- **GameFrame RPG Engine** is the reusable campaign-agnostic world/player/mechanics engine.
- **GameFrame RPG** is the future generic campaign creation/library/resume destination.
- **Monster Master RPG** is a bespoke title using GameFrame RPG Engine + Monster Master Ruleset + Monster Master CampaignPackage/content.
- **Monster Master Battle Arena** is a separate standalone battle simulator using Monster Master Ruleset + BattleScenario setup.

The RPG and Battle Arena should share Monster Master tactical rules where capabilities/versions match, but campaign combat never launches the standalone Arena product.

## Campaign creation experience

GameFrame should eventually let a player/group create a campaign through:

- a concise freeform idea;
- a detailed description;
- a structured campaign sheet;
- a guided GameFrame flow;
- an optional Discord interview;
- a prepared campaign such as Monster Master;
- imported compatible CampaignPackage material.

Those inputs become a Campaign Architect draft, optional owner refinement, validation/repair, player-safe preview, and explicit commitment.

Monster Master remains handcrafted first. A materially different second handcrafted campaign must prove the same engine/runtime/ruleset abstractions before Campaign Architect generation becomes an active dependency.

## Player interaction modes

### Explore

Move through persistent materialized maps with normal avatar/camera controls, collision/pathing, inspection, and supported object/world interaction.

### Talk / Interact

Approach and interact with a present entity/object directly.

NPC dialogue is in-fiction. A character performer receives perspective-bounded context for the selected entity rather than omniscient GM truth.

### Do Something Else

A first-class freeform tabletop escape hatch for plausible actions not represented by fixed controls.

This preserves the core RPG property that the map/interface visualizes possibilities without defining the complete action space.

### Ask Game Master

A dedicated out-of-fiction player→GM communication surface for:

- character knowledge;
- rules;
- clarification;
- reminders;
- adjudication questions.

Present NPCs do not automatically hear it. It does not advance fictional time by default.

### GM Intervention

The real Dungeon Master may proactively address one player, the party, or the table.

Presentation may be nonblocking or may pause/freeze local control for dramatic narration/cinematic framing. World-state changes still require the correct semantic/mechanic authority.

### Tactical Mode

Initiative/action economy/legal tactical movement/actions become active on the current materialized scene.

Current positions, entities, objects, terrain, exits, and relevant hazards remain the same world state.

## Persistent-world player expectation

Players should not reconstruct important truth solely from old narration.

GameFrame should make legible as implemented:

- current materialized location;
- who/what is present;
- whom the character knows;
- viewer-authorized identity labels/facts;
- player character/controlled entities;
- objectives/known information;
- inventory/equipment/conditions/resources;
- whether the scene is exploratory, tactical, paused, or transitioning;
- meaningful world changes and prior GM rulings/history.

Hidden canonical names/secrets never become visible merely because referee context knows them.

## Ruleset/control experience

GameFrame RPG Engine is not hardcoded to one control pattern.

An RPG Ruleset defines character/action/control relationships.

For Monster Master, the player's authenticated principal may control:

- their own Master/trainer character;
- one or more deployed monsters according to class/ruleset limits;
- other entities only through explicit mechanics.

This supports classes that fight personally, command one or multiple monsters, heal/support, or otherwise use different action/control profiles without making Monster Master campaign logic the generic engine.

## World/materialization experience

The campaign provides semantic WorldGraph/location meaning. GameFrame materializes supported locations into persistent playable scenes using authored/world-kit/procedural/generated assets as appropriate.

Players may take alternate routes such as entering woods instead of following a road when semantic world truth allows it.

A newly materialized campaign location becomes **that location** for the campaign and is revisited consistently rather than rerolled every entry.

Generated imagery enhances presentation but never owns collision or hidden campaign truth.

## Map transition posture

The world may contain many persistent maps/scenes while the first multiplayer product keeps the party in one active scene at a time.

A group transition may use edge/door/route zones and one authoritative semantic scene transfer.

The architecture retains zero-or-more semantic scenes so split-party play can later allow simultaneous locations without redesigning identity/presence/knowledge authority.

## Same-map tactical posture

Tactical Activation validates:

- semantic scene/revision;
- materialization/version;
- current relevant positions;
- ruleset/profile;
- factions/participants/roles;
- control authority;
- health/resources/conditions;
- existing map geometry/objects/hazards/exits;
- objectives/alternate terminal conditions.

Then the same scene enters turn-based tactical control.

A player standing twenty yards away when initiative begins remains twenty yards away unless a specific rule explicitly changes deployment.

When tactical mode terminates and consequences reconcile, ordinary exploration controls resume in place.

## Monster Master Battle Arena posture

Battle Arena is intentionally setup-first rather than campaign-first.

It may eventually offer:

- character/class/loadout creation;
- monster/team setup;
- selected/generated maps;
- starting positions/deployment rules;
- objectives;
- human/BattleBot opponents;
- replay/rematch/analysis.

Once battle starts, equivalent Monster Master Ruleset versions/profiles should behave equivalently to Monster Master RPG tactical mode.

## Presentation/media direction

The world renderer should accumulate reusable world kits, terrain, structures, props, characters, effects, and animation states.

Materialization preference remains:

1. reuse accepted assets;
2. deterministic composition/prefabs;
3. bounded async generation for high-value/unusual gaps;
4. readable fallback.

Ordinary cutscenes should use semantic cinematic scripts executed by GameFrame rather than generated video by default.

## Campaign-length posture

The engineering vertical slice may remain a bounded starter chapter. That is an evidence strategy, not the mature ceiling.

The platform targets durable multi-session campaigns with recurring locations/relationships, progression, inventory/care, and world changes promoted as campaigns prove their need.

## Governing rule

> GameFrame RPG should feel like one persistent world, not narration wrapped around separate minigames: players explore directly, the GM preserves tabletop freedom, rulesets define deterministic behavior, and combat begins exactly where initiative was rolled.
