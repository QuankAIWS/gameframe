---
title: Monster Master RPG Tactical Activation Rules
status: accepted
document_type: contract
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - Monster Master RPG
  - Monster Master Arena Battles
  - RPG GM Runtime integration
related:
  - monster-master-rules.md
  - rpg-gameframe-interface-contract.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - ROADMAP.md
---

# Monster Master RPG Tactical Activation Rules

## Decision

Monster Master RPG combat does **not** launch Monster Master Arena Battles, a separate match route, or a replacement campaign map.

Exploration and turn-based combat are two control/rules modes over the **same materialized GameFrame scene**.

```text
exploration
→ tactical trigger
→ validate current semantic + materialized + control state
→ Tactical Activation
→ same map / same positions / same entities / same important objects
→ deterministic initiative/actions/outcomes
→ semantic reconciliation where required
→ exploration resumes in place
```

Monster Master Arena Battles remains standalone Battle Simulator play. Matching Monster Master Ruleset versions should converge on equivalent tactical rules without sharing campaign lifecycle/setup.

## Tactical Activation

A Tactical Activation is an atomic transition that places an already materialized campaign scene under strict turn-based deterministic authority.

Activation validates, as applicable:

- campaign/scene identity and semantic revision;
- materialization ID/version/hash;
- current tactically relevant x/y/facing;
- present entity identities/roles/factions/dispositions;
- authenticated principal → Master/player-character → controlled/deployed entity relationships;
- ruleset/profile/version;
- health/resources/conditions;
- initiative inputs/action economy;
- existing collision/navigation geometry;
- relevant objects/barriers/hazards/elevation/cover/exits;
- objectives and alternative terminal conditions.

Activation fails closed when materially relevant requirements cannot be represented truthfully.

## Same-world invariant

During tactical mode:

- the map does not change;
- characters do not teleport into a legacy deployment layout unless an explicit supported rule requires repositioning;
- Pell or other present entities do not disappear merely because standalone Arena lacks a slot for them;
- important cart/barrier/road/woods/creek/door/exits remain the same world objects/geometry;
- noncombatants/support/protected/escaping entities remain represented when their presence matters;
- escape/withdrawal uses real supported exits/zones;
- tactical consequences update the same persistent entities/world.

There is no campaign Return-to-Campaign navigation step.

## Scene modes

A campaign scene may conceptually use bounded modes such as:

- `exploration`;
- `tactical`;
- `cinematic-pause`;
- `transitioning`.

Conversation may be an overlay/state within exploration. Changing mode does not create a second world scene.

## Player/control authority

The generic engine must not hardcode one player = one unit or one Master = exactly one monster.

Monster Master Ruleset determines:

- whether/how the Master acts tactically;
- which monsters are deployed;
- how many may be controlled/deployed;
- command/action economy relationships;
- class/archetype/profile-specific abilities/limits.

Client-authored IDs never create control authority.

## Participants and noncombatants

Supported tactical roles may include allied combatant, hostile combatant, neutral, noncombatant, protected, escaping, support, and objective/environmental entity.

Not every present entity needs a full turn. Materially relevant present entities must not silently vanish to satisfy legacy fixed-duel assumptions.

## Objectives and terminal states

Campaign tactical play is not limited to defeat-all-opposition.

Promote objective/terminal vocabulary as the campaign proves the need, including:

- defeat/incapacitate;
- protect;
- prevent escape/removal;
- reach/hold location;
- escape/withdraw;
- survive bounded interval;
- force/accept surrender;
- secure/recover an entity/object.

Participant results may distinguish active, incapacitated, withdrew, fled, surrendered, recalled, and death only under an explicit lethal rules profile.

## Escape/withdrawal

Escape is spatially grounded in the actual current world. A participant may leave through a legal exit/route/edge/objective zone supported by the scene/rules.

If tactical action causes a semantic scene/location change, the resulting semantic presence consequence must reconcile before ordinary exploration fully resumes.

## Geometry

Tactical mode reuses the exploration scene's authoritative GameFrame geometry and may add derived overlays such as movement range, paths, line of sight, targeting, cover/elevation interpretation, objective/exit highlighting, threat areas, turn order, and action UI.

If the materialized scene cannot support required deterministic tactical geometry, repair/fail that state rather than generating a visually similar replacement battlefield.

## Persistence/recovery

Tactical state associated with the same scene/materialization must support legal-action validation, revisions/idempotency, turn/initiative order, control authorization, reconnect/recovery, deterministic terminal commit, and transition back to exploration.

Internal reuse of MatchSession/tactical-core machinery does not mean the player entered a separate campaign location.

## Crooked Checkpoint target

A correct reference activation can begin directly from Crooked Checkpoint using the player's actual state at trigger time, including as applicable:

- Master/trainer at current position;
- currently deployed monster(s) such as Cinder;
- Pell if still present;
- actual established hostiles;
- Emberglass if present, potentially with an escape goal;
- relevant noncombatants/animals;
- current cart/barrier/road/woods/exits;
- objectives derived from what actually happened in play.

When tactical mode ends, entities remain wherever the committed result leaves them; fleeing/withdrawal, injury/resources/conditions, custody, and object state persist.

## Runtime relationship

Runtime owns semantic reason/objective/faction/scene requirements and semantic reconciliation, not the tactical engine.

GameFrame owns current materialization/positions/control/geometry/initiative/legal actions/terminal deterministic result.

The runtime-side coordinator is **Tactical Activation Coordinator** or equivalent. `Encounter Scene Compiler` is superseded terminology because no second scene is compiled.

## Monster Master Arena Battles relationship

Standalone Monster Master Arena Battles may offer character/loadout/team/map/objective/deployment setup, BattleBot/human opponents, presets, replay/rematch/analysis, and later generated/imported Battle Packs.

Those conveniences must not fork compatible Monster Master combat rules from the campaign implementation.

MM-0001 remains useful regression substrate while shared rules/control/tactical primitives are deliberately promoted.

## Current implementation order

Campaign development order remains:

```text
TALK
→ CHANGE
→ TRAVEL
→ FIGHT foundation
→ same-map Tactical Activation proof
→ PROVE complete single-player
```

Do not pull tactical expansion ahead of TALK/CHANGE/TRAVEL unless it removes a demonstrated blocker.

## Governing rule

> In Monster Master RPG, combat is something that happens in the world the player is already standing in. Tactical Activation changes control rules, not place; standalone Arena Battles is a separate setup/lifecycle using shared rules.
