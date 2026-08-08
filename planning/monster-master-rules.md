---
title: Monster Master Duel Rules — MM-0001
status: accepted
document_type: contract
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - Monster Master Arena Battles
  - MM-0001
related:
  - ROADMAP.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-encounter-rules.md
  - rpg-gameframe-interface-contract.md
  - tactical-battler-rpg-foundation.md
---

# Monster Master Duel Rules — MM-0001

## Purpose

MM-0001 is a **separate game definition** and the first small standalone Monster Master game built on GameFrame's tactical substrate. It is intentionally bounded enough to implement, simulate, and preserve as a regression target while the campaign-facing Monster Master RPG encounter model grows separately.

MM-0001 reuses platform/map/movement/line-of-sight/replay/storage/rendering infrastructure without defining the complete future RPG combat system.

## First duel roster

Each player owns three fixed units:

### Warden Master

- 14 health;
- 4 movement;
- 7 initiative;
- range 4;
- 3 damage;
- `Mend`.

### Stone Bulwark

- 12 health;
- 3 movement;
- 5 initiative;
- range 1;
- 4 damage.

### Emberling Skirmisher

- 8 health;
- 6 movement;
- 9 initiative;
- range 3;
- 3 damage.

Content/unit identities are stable. Artwork does not define rules.

## Deployment phase

- duel begins in `deployment`;
- players alternate one unit deployment at a time;
- players deploy only their own undeployed units;
- left/right deployment zones are fixed;
- blocked/occupied cells are illegal;
- after every unit is deployed, initiative begins round one.

The alternating two-side deployment transition currently requires equal roster counts.

That constraint belongs to MM-0001/current shared implementation. It must not silently reshape campaign scenes. Campaign RPG requests with asymmetric required forces fail closed until the RPG encounter rules implement an appropriate deployment/materialization path.

## Combat activations

Living units activate in descending initiative order with stable unit-ID tie breaks.

During one activation a unit may:

- move once;
- use one primary action once;
- perform them in either order;
- end activation early.

Using both opportunities ends the activation automatically.

## Movement and attacks

- weighted cardinal pathfinding;
- no crossing walls/occupied cells;
- row/column/exact-45-degree basic attacks;
- walls/living units block line of sight;
- deterministic damage;
- zero-health units are defeated and removed from occupancy.

MM-0001 does not define death semantics for RPG campaigns. A campaign rules profile must explicitly define whether tactical defeat means incapacitation, withdrawal, death, or another consequence.

## Command energy

Each player begins with two command energy and has a maximum of three. One restores at the start of each new round up to the cap.

## Mend ability

The Warden Master may use `Mend`:

- primary action;
- cost 1 command;
- living friendly damaged target;
- range 3;
- line of sight required;
- heals up to 3, capped by maximum health.

## Victory and draw

- a player **wins only after every opposing unit has been defeated** and removed from the battlefield;
- defeating the opposing **Warden Master does not end the duel** while that side still has a living Bulwark or Emberling;
- if neither force is eliminated, round 24 completion is a draw.

This **defeat-all-opposition** rule belongs to the standalone duel. It is not the universal Monster Master RPG objective model.

## Authoritative state

MM-0001 authority owns:

- phase;
- map/deployed units;
- rosters/undeployed IDs;
- active deployment player;
- initiative/active unit;
- movement/primary-action use;
- command energy;
- health/defeat history;
- winner/draw;
- legal actions;
- structured effects.

Browser owns camera/hover/selection/animation/local UI only.

## Current configured RPG reuse

**The implemented `monster-master-rpg` path is:**

```text
validated RPG encounter `rulesState.creatureIds`
→ supported creature/objective/difficulty/battlefield validation
→ configured revision-zero Monster Master state
→ ordinary MatchSession actions/replay/persistence
→ exact participant-to-creature terminal aftermath
```

Current supported semantics:

- **trainers remain RPG encounter participants/controllers** and are not Warden Master tactical creatures;
- exact campaign creature IDs become tactical unit IDs;
- Emberling IDs use Emberling rules;
- Bulwark IDs use Stone Bulwark rules;
- one through three supported creatures per side;
- **both sides must currently contain the same number of creatures** because the deployment phase alternates between two tactical seats;
- compact-duel geometry;
- normal difficulty;
- defeat-opposition objective;
- **`participantUnitIds` persists exact participant→creature assignment**;
- shared-team authorization is separate from exact participant assignment.

Unsupported combat-relevant configuration fails closed.

## Campaign-facing evolution is separate

The final Monster Master RPG encounter model is controlled by [`monster-master-rpg-encounter-rules.md`](monster-master-rpg-encounter-rules.md).

That contract may add, as actual campaigns require:

- scene-derived participant roles;
- trainer tactical profiles;
- neutral/noncombatant/protected/support entities;
- scene objects/exits;
- escape/withdrawal/surrender/recall;
- asymmetric forces;
- alternative objectives;
- structured scene reconciliation.

Those capabilities should reuse tactical-core and MatchSession when appropriate, but they do not have to pretend the fixed MM-0001 duel is the entire campaign combat system.

A **D&D-style system should use its own rules definition** or family of definitions. It may reuse GameFrame infrastructure while retaining different initiative, action, reaction, resource, condition, visibility, and character semantics.

## Explicitly outside MM-0001

- final campaign balance;
- collection/progression systems;
- campaign scene registry;
- current-scene entity projection;
- campaign trainer archetype implementations;
- escape/withdrawal/surrender;
- asymmetric campaign encounters;
- civilians/noncombatants/protection objectives;
- open-world exploration;
- NPC dialogue/campaign persistence;
- procedural encounters;
- final artwork/animation;
- deployment/cloud behavior;
- live Scribbles Runtime control of Theo.

## Governing rule

> Keep MM-0001 small and deterministic. Reuse what is useful, but evolve Monster Master RPG combat through a separate campaign encounter contract so a richer campaign never has to lie about who is present or what the objective is just to fit the old duel.
