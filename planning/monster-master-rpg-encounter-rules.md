---
title: Monster Master RPG Tactical Activation Rules
status: accepted
document_type: contract
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - Monster Master RPG
  - Monster Master Battle Arena
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

Monster Master RPG combat does **not** launch a separate Arena map or replace the campaign scene with a tactical copy.

Exploration and turn-based combat are two control/rules modes over the **same materialized GameFrame world scene**.

```text
exploration mode
  realtime movement / direct interaction
        ↓ tactical trigger
same scene + same coordinates + same entities + same objects
        ↓
tactical activation
  initiative / turn order / action economy / legal tactical movement
        ↓ terminal tactical condition
same scene updated by authoritative tactical consequences
        ↓
exploration mode resumes
```

The existing standalone Monster Master tactical game evolves separately into **Monster Master Battle Arena**: a battle simulator that may load or generate a map, construct combatants/loadouts, and run the same Monster Master tactical rules without requiring a campaign.

The campaign and Battle Arena should converge on the same reusable Monster Master rules and GameFrame tactical-mode implementation. They differ in **how the scene and participants are established**, not in the meaning of combat rules.

## Product and engine hierarchy

The intended layering is:

```text
GameFrame RPG Engine
  ├─ exploration/world materialization
  ├─ entity/party/control authority
  ├─ direct interaction
  ├─ tactical mode
  ├─ map/materialization services
  └─ ruleset interface

Monster Master Ruleset
  ├─ trainer/player-character rules
  ├─ monster deployment/control rules
  ├─ actions/abilities/resources
  ├─ initiative/action economy
  ├─ conditions/outcomes
  └─ Monster Master tactical objectives

Monster Master RPG
  = GameFrame RPG Engine
  + Monster Master Ruleset
  + committed CampaignPackage/world

Monster Master Battle Arena
  = GameFrame tactical/world subset
  + Monster Master Ruleset
  + standalone BattleScenario
```

Monster Master is therefore a rules/content family and bespoke RPG title, not the generic engine itself.

## Tactical activation

A **Tactical Activation** is the atomic transition that places an already materialized world scene under turn-based tactical authority.

It does not create another physical scene.

Before activation, GameFrame/runtime must establish and validate a tactical activation snapshot containing the semantic and deterministic state needed to begin combat, including as applicable:

- source campaign/scene identity and semantic scene revision;
- current GameFrame materialization identity/version;
- exact persistent entities currently present;
- current GameFrame positions/facing of tactically relevant entities;
- factions/teams/dispositions;
- controlling principal or deterministic behavior authority;
- player-character and deployed-monster control relationships;
- current health/resources/conditions;
- initiative inputs and rules profile;
- tactically relevant collision/navigation geometry already present on the map;
- relevant objects, barriers, hazards, elevation, cover, exits, and objective zones;
- tactical objectives and alternate terminal conditions.

Activation fails closed if required state is contradictory or the selected Monster Master rules cannot execute a materially relevant requirement truthfully.

Once activation commits, tactical starting positions are the positions the entities actually occupied when initiative began unless an explicit supported rule says otherwise.

## Same-world invariant

During campaign tactical mode:

- the map does not change;
- the player's character does not teleport to a deployment zone;
- Pell does not disappear because he lacks a legacy duel slot;
- a cart, barrier, creek, doorway, tree line, ridge, or other mechanically relevant world feature remains the same object/geometry already in the scene;
- entities not participating as combatants remain represented truthfully if their presence matters;
- escape uses real supported exits/zones in the current world;
- tactical consequences update the same persistent entities and world objects.

There is no campaign-only `Return to Campaign` navigation step after combat. When tactical custody ends and consequences commit, GameFrame removes/changes the tactical UI/control regime and ordinary exploration resumes in place.

## Scene resolution modes

A GameFrame RPG scene may conceptually operate under a small bounded mode vocabulary such as:

- `exploration` — realtime movement and ordinary direct interaction;
- `tactical` — initiative/turn-based deterministic action authority;
- `cinematic-pause` — local input paused for explicit presentation/GM intervention;
- `transitioning` — bounded scene/materialization transfer state.

Conversation may be an interaction overlay/state within exploration rather than a mutually exclusive world mode.

The exact schema may differ. The important invariant is that changing resolution mode does not create a replacement world scene.

## Player and controlled-entity authority

Monster Master must not hardcode tactical control as "one trainer plus exactly one monster."

The ruleset determines what a character may control and how many controlled entities may be deployed.

A generic control relationship should be capable of representing concepts such as:

```text
principal
  controls player-character entity
  controls or issues commands to deployed monster entity/entities
  may gain/lose/control different entities according to class/ruleset state
```

The concrete contract may use controller IDs, controlled-entity IDs, command authority records, or another validated representation.

For the current Monster Master reference direction:

- the human player controls their own Master/trainer character when the trainer has tactical actions;
- the same human issues the legal tactical commands for their deployed monster(s) according to class/loadout/ruleset limits;
- future classes may support different deployment counts, command styles, support actions, or direct fighting roles;
- allied human players retain separate authenticated principals even when tactical rules allow cooperative control of shared assets.

Client-authored entity IDs never grant control authority by themselves.

## Participants and noncombatants

Tactical mode must support truthful representation of the current scene.

Useful bounded roles include:

- allied combatant;
- hostile combatant;
- neutral;
- noncombatant;
- protected entity;
- escaping entity;
- support entity;
- objective/environmental entity.

Not every present person must receive a full combat action set. A civilian may remain a protected/noncombatant entity, Pell may have a support or full trainer profile, and a frightened monster may primarily have escape behavior.

A persistent present entity may be omitted from tactical processing only when its absence is semantically and mechanically irrelevant, or after an explicit pre-activation semantic transition establishes that it left the scene. Important named entities do not silently vanish to satisfy a legacy duel schema.

## Trainers and classes

Campaign trainers are player characters, not merely abstract controllers standing outside the battlefield.

The target Monster Master ruleset should support explicit trainer/class tactical profiles as they are implemented. Examples may include Caller, Field Medic, Field Fighter, Specialist Handler, Commander, Vanguard, Arcanist, or later finalized class names.

The exact class catalog is content/ruleset work. The engine contract only requires that:

- a player-character entity can have legal tactical actions;
- a class can alter control/deployment limits and available actions;
- monster commands and personal actions can share one deterministic turn/action-economy contract as defined by the Monster Master ruleset;
- unsupported class mechanics fail closed rather than being improvised by the Dungeon Master during tactical authority.

## Objectives and termination

Campaign combat is not limited to defeat-all-opposition.

The Monster Master tactical rules should support bounded objectives as actual campaign/Battle Arena needs prove them, including:

- defeat/incapacitate opposition;
- protect an entity;
- prevent removal of an object;
- reach/hold a location;
- escape/withdraw;
- prevent escape;
- survive for a bounded interval;
- force/accept surrender;
- recover/secure an objective entity.

Participant terminal states should distinguish as supported:

- active;
- incapacitated;
- withdrew;
- fled;
- surrendered;
- recalled;
- dead only when an explicit lethal rules profile supports it.

A tactical encounter ends when its validated objective/termination rules say it ends, not merely when one side reaches zero creatures.

## Escape and withdrawal

Escape is spatially grounded in the current world map.

A participant may withdraw/flee through a legal exit, route, edge zone, or other explicit supported objective already represented in the materialized scene.

A frightened intelligent monster whose established goal is escape should not be forced into attack-until-defeat behavior because the old standalone duel lacked exit semantics.

When an entity leaves the scene through tactical action, the resulting semantic destination/scene-presence consequence is committed before ordinary exploration fully resumes.

## Tactical world geometry

The campaign uses the exploration map's authoritative GameFrame geometry.

Tactical mode may add overlays and derived data such as:

- movement range;
- paths;
- line of sight;
- targeting;
- cover/elevation interpretation;
- objective/exit highlighting;
- threat/area effects;
- turn order and action UI.

Those overlays do not replace the underlying world geometry.

If a generated/materialized map cannot provide the deterministic tactical geometry required by the active ruleset, GameFrame must repair/fail the materialization before play reaches that state. It must not create a visually similar second battlefield as a workaround.

## Tactical state and persistence

Tactical activation creates/uses deterministic tactical state associated with the same scene/materialization.

It must preserve enough authority for:

- legal action validation;
- serialized revisions/idempotency;
- turn/initiative order;
- player/control authorization;
- replay/debug evidence where supported;
- reconnect/recovery during combat;
- terminal result commitment;
- transition back to exploration control.

The tactical subsystem may internally use MatchSession/tactical-core machinery. Internal reuse does not imply that the player entered a separate match location.

## Crooked Checkpoint target

A correct reference implementation can begin initiative directly in the materialized Crooked Checkpoint scene.

Depending on prior play, the tactical state may include:

- the player's Master at their actual current position;
- Cinder or other deployed monster(s) at their actual positions;
- Pell if present;
- actual established hostiles;
- Emberglass if present, potentially with an escape goal;
- relevant pack lizard/noncombatant state;
- the same cart/barrier/road/woods/creek/exits already present in exploration;
- objectives derived from what is actually happening.

When tactical mode ends:

- people/monsters remain wherever the outcome left them, subject to explicit terminal/removal semantics;
- fled/withdrew entities have semantic destination/presence updates;
- injuries/resources/conditions persist;
- object custody/damage persists;
- the camera/UI may transition smoothly back to exploration;
- the player does not click a separate `Return to Campaign` button to re-enter the world they never left.

## Monster Master Battle Arena

The standalone simulator is intentionally different at the **setup boundary**.

A future `BattleScenario` may define or select:

- map/materialization recipe or generated map request;
- Monster Master ruleset version/profile;
- player characters/trainers;
- monsters/loadouts/classes;
- teams/controllers;
- starting positions or deployment rules;
- objectives;
- deterministic bot profiles;
- environment options.

After setup, it should use the same tactical-mode rules, legal actions, renderer, entity presentation, control-authority concepts, conditions, objectives, and outcome vocabulary as Monster Master RPG wherever the selected ruleset version/capabilities match.

The Battle Arena may provide standalone conveniences that a campaign does not need:

- character/loadout builder;
- map selection/generation;
- team setup;
- quick rematch;
- scenario presets;
- deterministic bot opponents;
- replay/analysis tools.

Those conveniences must not fork the actual Monster Master combat rules.

## Relationship to MM-0001

MM-0001 is the current narrow standalone tactical proof: fixed duel assumptions, bounded creatures, and existing MatchSession/tactical infrastructure.

Do not delete that regression surface prematurely. Evolve the standalone product toward Monster Master Battle Arena while extracting/promoting reusable Monster Master tactical rules and GameFrame tactical-mode primitives.

The convergence target is:

```text
current MM-0001 tactical proof
            ↓ extract/generalize
shared Monster Master tactical rules + GameFrame tactical mode
        ↙                              ↘
Monster Master RPG              Monster Master Battle Arena
same-map campaign combat        standalone scenario combat
```

## Runtime relationship

RPG GM Runtime owns semantic reasons and consequences for campaign combat, not the tactical engine.

Runtime may request/authorize tactical activation by expressing:

- why tactical resolution is required;
- relevant semantic factions/dispositions/objectives;
- hidden/known information required to validate the activation;
- expected semantic scene revision.

GameFrame validates the current materialized scene and activates deterministic tactical mode.

After terminal tactical state, GameFrame commits structured mechanic outcomes and runtime reconciles campaign-semantic consequences that are not already GameFrame-owned mechanics. Ordinary exploration resumes only after the two authority domains agree on the post-combat state required for safe continuation.

This boundary should be named **Tactical Activation**, not `Encounter Scene Compiler`, because no second scene is compiled.

A runtime-side coordinator/type may be named **Tactical Activation Coordinator** or equivalent.

## Implementation order

1. preserve current MM-0001/Monster Master tactical regression coverage;
2. define the campaign-agnostic GameFrame tactical-mode boundary over an existing materialized scene;
3. define Monster Master ruleset/control-authority contracts independent of campaign versus Battle Arena setup;
4. activate initiative in Crooked Checkpoint using actual current positions/geometry;
5. add trainer/player-character tactical participation required by the reference class;
6. add escape/withdrawal and real exit-zone semantics;
7. add asymmetric participants/objectives/noncombatants as campaign needs prove them;
8. prove tactical completion returns directly to exploration control on the same map;
9. evolve the standalone product into Monster Master Battle Arena using the same rules/tactical implementation;
10. broaden BattleScenario/map generation only after shared tactical semantics are proven.

## Governing rule

> In Monster Master RPG, combat is something that happens **in the world you are already standing in**. Tactical activation changes the rules of control, not the place. Monster Master Battle Arena is the separate standalone simulator that deliberately starts from battle setup, and both products converge on one Monster Master ruleset and one GameFrame tactical implementation.
