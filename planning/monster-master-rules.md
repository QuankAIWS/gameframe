---
title: Monster Master Duel Rules — MM-0001
status: accepted
document_type: contract
owner: Scribbles GameFrame
last_updated: 2026-08-07
applies_to:
  - scribbles-gameframe
  - Monster Master Arena Battles
  - MM-0001
related:
  - ROADMAP.md
  - monster-master-rpg-canonical-baseline.md
  - rpg-gameframe-interface-contract.md
  - tactical-battler-rpg-foundation.md
---

# Monster Master Duel Rules — MM-0001

## Purpose

MM-0001 is the first playable original game built on Scribbles GameFrame's validated tactical substrate. It is intentionally small enough to implement, simulate, and revise before finalizing the long-term combat feel.

Monster Master is a separate game definition. It reuses platform, map, movement, line-of-sight, replay, storage, projection, agent, and rendering infrastructure without inheriting the tactical combat canary's state or forcing later RPG and D&D-style encounters into this ruleset.

## First duel roster

Each player owns three stable units:

- **Master — Warden Master**
  - 14 health
  - 4 movement
  - 7 initiative
  - range 4
  - 3 damage
  - knows `Mend`
- **Monster — Stone Bulwark**
  - 12 health
  - 3 movement
  - 5 initiative
  - range 1
  - 4 damage
- **Monster — Emberling Skirmisher**
  - 8 health
  - 6 movement
  - 9 initiative
  - range 3
  - 3 damage

Content IDs and unit IDs are stable. Rules refer to semantic roles and content definitions rather than browser artwork.

## Deployment phase

- The duel begins in `deployment` rather than combat.
- Players alternate one unit deployment at a time.
- Each player may deploy only their own undeployed units.
- The first player uses the left deployment zone; the second uses the right deployment zone.
- Blocked or occupied cells are illegal.
- Deployment actions are authoritative commands containing the stable unit ID and destination coordinate.
- After every unit in both rosters is deployed, initiative is calculated and the duel enters combat at round one.

The first deployment system is intentionally deterministic and public. Its alternating-seat transition currently requires equal roster counts on the two tactical sides. Campaign-configured encounters with asymmetric counts therefore fail closed before match creation until asymmetric deployment is deliberately implemented. Hidden placement, simultaneous reveal, drafting, reserve units, and reinforcement waves are later possibilities.

## Combat activations

Living units activate in descending initiative order with stable unit-ID tie breaks.

During one activation a unit may:

- move once;
- use one primary action once;
- perform those opportunities in either order; and
- explicitly end its activation early.

Using both opportunities automatically ends the activation. There is no generalized action-point economy in MM-0001.

## Movement and attacks

- Movement uses the validated weighted cardinal pathfinding rules.
- Units cannot cross walls or occupied cells.
- Basic attacks require row, column, or exact 45-degree diagonal alignment.
- Walls and intervening living units block line of sight.
- Damage is deterministic.
- Units at zero health are defeated and removed from occupancy.

Random hit rolls, critical hits, reactions, facing, elevation, cover percentages, overwatch, opportunity attacks, destructible terrain, and complex status catalogs are deferred.

## Command energy

Each player begins with two command energy and has a maximum of three.

At the beginning of each new round:

- each player restores one command energy;
- energy cannot exceed the cap; and
- restoration is represented by structured authoritative effects.

This resource is deliberately small and visible. It proves resource-backed abilities without committing the project to a large mana, card, cooldown, or action-point system.

## Mend ability

The Warden Master may use `Mend` as its primary action:

- command cost: 1;
- target: a living friendly unit with missing health;
- range: 3;
- line of sight: required;
- healing: up to 3, capped by maximum health.

`Mend` proves that Monster Master actions can target allies, spend a player resource, and produce non-damage effects. Additional abilities should be added only after the first duel is playable enough to evaluate.

## Victory and draw

- A player wins only after every opposing unit has been defeated and removed from the battlefield.
- Defeating the opposing Warden Master does not end the standalone duel while that player still controls a living Bulwark or Emberling.
- If neither force is eliminated, the duel becomes a draw when the final activation of round 24 ends. The authoritative round remains 24; a phantom round 25 is not started.

Alternative objectives, capture points, escort rules, retreats, surrender, and multi-stage encounters remain future rules.

## Authoritative state

The game authority owns:

- phase;
- map and deployed unit state;
- complete rosters and undeployed IDs;
- active deployment player;
- initiative order and active unit;
- movement and primary-action usage;
- command energy;
- health, defeat history, winner, and draw state;
- legal actions; and
- structured effects.

The browser owns only presentation state such as camera, hover, selection, path animation, visual effects, and local UI mode.

## Campaign-configured encounter boundary

MM-0001 remains the fixed standalone duel definition. RPG campaigns reuse its tactical primitives and ordinary match authority without silently replacing supplied trainer/monster identities with the standalone three-unit roster.

The implemented `monster-master-rpg` path is:

```text
validated RPG encounter `rulesState.creatureIds`
→ validate supported creature/objective/difficulty/battlefield configuration
→ configured Monster Master initial state
→ authoritative revision-zero MatchSession snapshot
→ ordinary actions, replay, durable persistence, and terminal state
→ exact participant-to-creature aftermath
```

Current configured RPG semantics:

- trainers remain RPG encounter participants/controllers and are not materialized as Warden Master tactical creatures;
- exact campaign creature IDs are retained as tactical unit IDs;
- Emberling IDs use the existing Emberling Skirmisher rules profile;
- Bulwark IDs use the existing Stone Bulwark rules profile;
- each tactical side may contain one through three supported creatures;
- both sides must currently contain the same number of creatures because deployment alternates between two tactical seats;
- the current compact-duel map, normal difficulty semantics, and defeat-opposition objective are the only accepted combat configuration;
- `participantUnitIds` persists exact participant→creature assignment for terminal aftermath;
- shared-team player authorization remains distinct from assignment: an authorized teammate may operate the allied roster even though `assignedUnitIds` identifies the creatures mapped to that player's participant records.

A configured initial state does not broaden the rules implemented by this file. Unknown species, arbitrary trainer combat profiles, custom abilities/resources/status mechanics, custom maps, unsupported objectives/difficulty values, or asymmetric rosters are rejected before durable encounter custody. New package mechanics require corresponding deterministic Arena implementation and tests; they are never accepted as ignored metadata.

## Future compatibility

A later open-world or campaign layer may contain exploration maps, NPCs, dialogue, parties, and encounter triggers. It should launch explicit Monster Master or other encounter definitions and receive structured outcomes.

A D&D-style system should use its own rules definition or family of definitions. It may reuse GameFrame infrastructure and tactical primitives while retaining different initiative, turns, actions, reactions, resources, conditions, character data, visibility, and licensing boundaries.

## Explicitly outside MM-0001

- final balance;
- large rosters or collection progression;
- summoning during combat;
- randomized loot;
- deck construction;
- fog of war;
- open-world exploration;
- NPC dialogue;
- campaign persistence;
- procedural encounters;
- final artwork or animation;
- deployed Cloudflare behavior;
- Discord Activity delivery; and
- live Scribbles Runtime control of Theo.