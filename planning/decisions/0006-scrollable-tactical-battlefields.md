# 0006 — Scrollable Tactical Battlefields

- **Status:** Accepted
- **Date:** 2026-07-27
- **Scope:** `GF-0010` monster-master tactical battler and the shared tactical core
- **Supersedes:** The provisional 8x8-to-12x12 first-map target in `planning/tactical-battler-rpg-foundation.md`

## Context

The initial tactical-foundation design used a deliberately small arena as the simplest way to prove movement, initiative, combat, replay, and multiplayer authority. That remains useful as a test fixture and possible quick-match format, but it does not create the desired first-game experience.

The preferred battler should feel closer to a substantial tactical RPG battlefield than a compact board-game skirmish. Players should have room to deploy, advance, scout, contest terrain, establish formations, encounter the opposing force, reposition, and disengage. A larger battlefield also provides a better foundation for later RPG encounters and possible squad-scale strategy modules.

The map size, rendered viewport, and active unit count are separate concerns. A large authoritative map does not require every tile to be visible at once or a large number of units to be active. The Canvas client can render the current viewport while GameFrame retains the complete deterministic map state.

## Decision

The first production direction for the monster-master battler will use a **larger tactical map that extends beyond the visible viewport**.

The ordinary browser client will provide a pannable camera and modest zoom. A player sees a local section of the battlefield at normal play scale rather than the entire map as one tiny grid. Unit selection, turn-order controls, alerts, and an optional minimap or overview affordance may recenter the camera on relevant units and objectives.

The initial planning target is:

- A logical map in the approximate range of **20x20 to 32x32 cells**
- A likely first-map target near **24x24 cells**
- A normal visible viewport of approximately **10x8 to 14x10 cells**, depending on available screen space and zoom
- A likely desktop default near **12x9 visible cells**
- Small active forces, initially around **one master and three to six monsters per side**
- Starting positions separated enough to require meaningful approach and maneuver rather than immediate first-turn combat
- Objectives, routes, chokepoints, cover, hazards, summoning locations, or resource positions that draw players into contact and prevent empty walking

These measurements are product targets, not frozen protocol constants. Playtesting may justify larger or smaller maps, different tile scales, or different viewport dimensions without reversing the decision.

## First-map structure

The first complete map should provide readable strategic shape rather than a featureless open square. A representative structure is:

```text
player deployment
        |
side route -- central objective -- side route
        |
rival deployment
```

The map should include:

- Distinct deployment regions
- One primary conflict-driving objective
- At least two viable approaches or lanes
- Terrain that creates meaningful movement and positioning decisions
- Defensible or dangerous areas
- Limited shortcuts or alternate routes
- Enough separation for scouting and formation without creating several turns of empty travel

Movement allowances, deployment rules, objective pressure, and map geometry must be tuned together. A larger map is not permission to add dead space.

## Visibility and camera

Map size and information visibility remain independent.

The authoritative service owns the complete map, units, visibility state, and legal actions. Each player projection may expose only terrain and units that player is entitled to observe. The client camera determines what is currently drawn; it does not determine what exists or what is authoritative.

The initial implementation may expose the complete terrain layout while hiding enemy units outside line of sight. More restrictive unexplored-terrain fog can follow after movement, line of sight, projection, and reconnect behavior are stable.

The client should eventually support:

- Drag or edge panning
- Mouse-wheel or pinch zoom within bounded limits
- Center-on-selected-unit behavior
- Jump-to-current-activation behavior
- Objective and threat indicators outside the viewport
- A compact minimap or strategic overview when map size justifies it

## Retained compact-map uses

This decision does not remove small tactical maps or invalidate the earlier compact-arena work.

An 8x8-to-12x12 board remains appropriate for:

- Unit, pathfinding, combat, and replay tests
- Tutorial encounters
- Development fixtures
- Fast duel or quick-match modes
- Puzzle scenarios
- Small RPG rooms or boss phases
- Performance and mobile-input canaries

The shared tactical core must support both compact and larger maps without separate rules engines.

## Future scale variants

The large-map tactical foundation should not assume that every unit always represents one individual creature.

Later modules may reuse the same map, activation, movement, visibility, and objective concepts for:

- Larger battlefields
- More active monsters
- Squads represented as single tactical entities
- Formations or detachments
- Turn-based army maneuver at a scale closer to a compact Total War-style engagement
- Eventual real-time or hybrid strategy experiments

Those variants are not requirements for the first battler. The first implementation should preserve clean unit and occupancy abstractions rather than prematurely implementing formation simulation, hundreds of agents, or continuous-time movement.

## Consequences

### Positive

- Battles gain maneuver, scouting, approach, flanking, retreat, and objective-control phases.
- The battler feels like a substantial tactical game rather than a tiny board duel.
- The same combat foundation transfers more naturally to RPG encounters and later squad-scale modules.
- Canvas rendering remains practical because the client draws a bounded viewport and local effects.
- Small active forces can remain readable while the battlefield feels materially larger.

### Costs and risks

- Camera controls, off-screen indicators, and viewport-aware input become first-slice client concerns.
- Pathfinding and legal-move presentation must remain readable over longer distances.
- Larger maps can create dead turns unless movement, deployment, and objectives are tuned carefully.
- Fog of war and player-specific projections become more valuable and therefore more likely to expose design defects.
- Mobile layouts need explicit camera and panel behavior rather than merely shrinking the desktop view.

## Validation criteria

This direction should be reconsidered if playtesting shows that:

- Players spend multiple activations moving without meaningful choices
- Matches consistently exceed the intended duration because of map traversal
- Camera navigation obscures whose activation it is or where relevant action is occurring
- Objective pressure collapses every map into one mandatory route
- The larger field provides no meaningful decisions compared with a compact arena
- Mobile interaction becomes materially worse without a viable responsive solution

A successful prototype should demonstrate at least one match in which deployment, approach route, terrain position, and repositioning materially affect the outcome before direct combat is resolved.
