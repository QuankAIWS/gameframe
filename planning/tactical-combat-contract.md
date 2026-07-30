# TC-0002 Tactical Combat Contract

## Purpose

`TC-0002` adds a bounded deterministic combat layer to the completed TC-0001 map, movement, camera, service, replay, and Workers-runtime foundation.

The first executable combat canary proves initiative, activation budgets, line of sight, attacks, health, defeat, structured effects, and team victory. It is intentionally smaller than the eventual monster-master ruleset and must not accumulate reactions, complex action-point systems, large ability catalogs, or content-production concerns before the basic combat authority is proven.

## Initial combatants

The canary starts with two units per player on the existing 24x24 tactical map:

- One vanguard per player
- One ranger per player

Each unit has stable authoritative fields:

```ts
interface TacticalCombatUnit {
  id: string;
  ownerId: string;
  role: "vanguard" | "ranger";
  position: { x: number; y: number };
  movement: number;
  initiative: number;
  maxHealth: number;
  health: number;
  attackRange: number;
  attackDamage: number;
  tags?: string[];
}
```

The vanguard is durable, short-ranged, and higher-damage. The ranger has lower health, longer attack range, and lower damage.

No unit has hidden random modifiers, critical hits, armor rolls, accuracy rolls, or status effects in the initial slice.

## Initiative and rounds

- Initiative is deterministic and fixed for the match.
- Units sort by descending initiative.
- Equal initiative sorts by stable unit ID.
- Each living unit receives one activation in initiative order.
- The round increments when initiative wraps from the final living unit to the first living unit.
- Defeated units remain in durable defeat history but are skipped in later initiative progression.
- The canary uses a deterministic maximum-round draw bound.

Later systems may add initiative modifiers, delay, ready actions, or dynamic turn-order effects through explicit contracts. They are not implied by this slice.

## Activation budget

Each activation begins with:

- One movement opportunity
- One primary-action opportunity

The unit may use them in either order:

```text
move -> attack -> end
attack -> move -> end
move -> end
attack -> end
end
```

Movement is one complete TC-0001 canonical path action. The initial primary action is one attack. Each opportunity may be used at most once.

Ending the activation is always explicit and advances initiative. After both opportunities are consumed, only `end-activation` remains legal.

This is not a general action-point economy. Repeated movement, repeated attacks, reactions, free-action catalogs, and resource-conversion rules remain deferred.

## Attack action

One authoritative attack is a complete structured action:

```ts
interface TacticalAttackAction {
  type: "attack";
  unitId: string;
  targetUnitId: string;
  from: { x: number; y: number };
  target: { x: number; y: number };
  range: number;
  damage: number;
}
```

GameFrame enumerates canonical attacks from current state. Browser and agent participants select one enumerated action. The authoritative game definition validates source position, target position, range, damage, line of sight, identity, activation ownership, revision, and current legality before commit.

Clients do not submit free-form damage values or choose a target outside the current legal-action list.

## Range and line of sight

The initial line-of-sight model is deliberately explicit:

- Attacks may travel along a shared row, shared column, or exact 45-degree diagonal.
- Distance is the number of grid steps, equivalent to Chebyshev distance for aligned cells.
- The attacker and target cells are excluded from obstruction checks.
- Wall terrain blocks line of sight.
- Any living intervening unit blocks line of sight.
- Difficult terrain and the objective cell do not block line of sight.
- Off-axis targets are not visible attack targets in the first slice.
- Targets beyond the attacking unit's authoritative `attackRange` are illegal.

This bounded eight-direction model avoids ambiguous corner-crossing rules while proving obstruction and ranged positioning. A later supercover or visibility-field algorithm may replace it only through an explicit decision and compatibility plan.

## Hit and damage resolution

The initial combat resolution is deterministic:

- Every legal attack hits.
- Damage equals the attacker's authoritative `attackDamage`.
- Actual damage is capped by the target's remaining health.
- Health cannot fall below zero.
- A unit at zero health is defeated and removed from map occupancy.
- The defeated unit ID remains in durable defeat history.

Random accuracy, evasion, armor, critical hits, damage ranges, resistances, and saving throws are deferred.

## Effects and event projection

Every accepted action produces a compact structured effect list for browser animation and diagnostics:

- `unit-moved`
- `unit-damaged`
- `unit-defeated`
- `activation-ended`
- `round-started`
- `combat-completed`

Effects are derived from authoritative state transitions. They are not a second command path and do not replace match events or snapshots.

The first slice retains only the latest action's effect list in current state. The durable event stream remains the complete history.

## Victory and draw

- A player wins when the opponent has no living units.
- If neither player has a living unit, the match is a draw.
- If the deterministic maximum-round bound is exceeded, the match is a draw.
- Completed combat rejects further actions through the existing `MatchSession` contract.

Objective capture does not determine the combat-canary result. The central objective remains semantic map terrain for later scenarios.

## Deterministic agent behavior

The first combat agent:

1. Selects a legal attack when available.
2. Prioritizes lethal attacks.
3. Otherwise prioritizes the lowest-health target, then shorter range and stable target ID.
4. If no attack is available, selects a legal movement minimizing distance to the nearest enemy.
5. Ends the activation when no movement or attack remains.

The policy is a deterministic QA participant, not a claim of strong tactical play.

## Authority and presentation boundary

Authoritative state owns:

- Map and terrain semantics
- Unit identity, ownership, stats, health, and position
- Initiative order and round
- Movement and primary-action availability
- Defeat history
- Legal movement and attack actions
- Structured effects
- Victory and draw state

Presentation state owns:

- Camera center and zoom
- Hover and selection
- Movement and projectile interpolation
- Hit flash, particles, shake, and sound
- HUD expansion state
- Local animation timing

The Canvas renderer must consume observations and legal actions. It must not import combat state-transition functions or calculate authoritative damage.

## Explicitly deferred

- Reactions, opportunity attacks, and overwatch
- Facing, flanking, back attacks, and directional cover
- Elevation, jumping, flight, and falling
- Destructible or transformable terrain
- Complex action points or initiative manipulation
- Accuracy, evasion, armor, critical hits, or random damage
- Status effects and duration systems
- Area attacks and templates
- Healing, resurrection, summoning, or reinforcement
- Monster masters, monster cubes, resources, and deployment
- Fog of war and hidden units
- Generated maps, art, dialogue, or campaigns
- Live Cloudflare, Discord, and Scribbles Runtime canaries

## Repository acceptance boundary

The first TC-0002 core slice should prove:

- Stable initiative ordering
- Round and activation progression with defeated-unit skipping
- One movement and one primary action in either order
- Strict current-action validation
- Eight-direction range and line-of-sight rules
- Wall and unit obstruction
- Fixed damage, health reduction, defeat, and occupancy removal
- Structured effects
- Victory and round-bound draw
- Deterministic self-play
- MatchSession replay and snapshot restoration
- No camera or Canvas state in combat authority

Service, Canvas, and real Workers-runtime combat proofs may follow as a second TC-0002 slice after the core contract is green.
