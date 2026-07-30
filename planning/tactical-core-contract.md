# TC-0001 Tactical Map and Movement Contract

## Purpose

`TC-0001` establishes the projection-independent tactical substrate used by the monster-master battler and later RPG encounters. It deliberately proves map scale, coordinates, terrain, occupancy, weighted movement, complete path actions, replay, and a presentation-only viewport before adding attacks, initiative statistics, abilities, damage, visibility, or art content.

The first executable canary is a no-combat objective race. It exists to verify the tactical contracts, not to become the final monster-master ruleset.

## Map scale and visibility

- The first canary map is 24x24 cells.
- The normal desktop viewport targets approximately 12x9 visible cells at default zoom.
- The logical map is always larger than the normal viewport.
- Camera position, pan, zoom, interpolation, and animation are client presentation state.
- Authoritative match snapshots contain the full semantic map and unit positions, never a camera location.
- Viewport helpers clamp pan and bounded zoom to the map without mutating authoritative state.

This implements the accepted larger-field direction while retaining compact boards for tests, tutorials, puzzles, quick matches, or small RPG rooms.

## Coordinate and cell model

The tactical core uses zero-based square-grid coordinates:

```ts
interface TacticalCoordinate {
  x: number;
  y: number;
}
```

The initial topology is cardinal movement only: north, west, east, and south. Diagonal movement, elevation, flight, teleportation, and ability-specific movement may be introduced later through explicit rules rather than being implied by the base grid.

Cells contain semantic mechanics:

```ts
interface TacticalCell {
  terrain: "floor" | "difficult" | "wall" | "objective";
  movementCost: number;
  blocksMovement: boolean;
  objectiveId?: string;
  tags?: string[];
}
```

The map does not contain concrete image filenames. Theme and renderer layers later map semantic terrain to visual assets.

## Unit and occupancy model

Each initial unit has:

- A stable unit ID
- A stable owner player ID
- One authoritative cell position
- A positive integer movement allowance
- Optional semantic tags

The first slice permits one unit per cell. Other units and blocked cells prevent movement through or onto that cell. The moving unit's origin is ignored when calculating its own paths.

Larger formations, multi-cell creatures, flying layers, swaps, pushes, and forced movement remain later extensions.

## Weighted movement and pathfinding

Movement uses deterministic weighted shortest paths:

- Normal floor costs 1.
- Difficult terrain initially costs 2 unless the map supplies another positive cost.
- Walls are impassable.
- Occupied cells are impassable.
- A unit may spend no more than its movement allowance.
- Equal-cost routes use a stable coordinate and path tie break.
- Legal destinations and paths are enumerated deterministically.

The first implementation uses a bounded Dijkstra search because cell costs vary. Map and unit sizes are small enough that correctness and determinism are more important than premature pathfinding optimization.

## Complete movement actions

One authoritative action represents one complete movement:

```ts
interface TacticalMoveAction {
  type: "move";
  unitId: string;
  from: TacticalCoordinate;
  path: TacticalCoordinate[];
  movementCost: number;
}
```

GameFrame enumerates canonical paths. A browser or agent selects one of those actions. The authoritative module validates the full action against current state before commit.

Including the path in the action provides:

- Stable replay evidence
- Deterministic animation input
- Explicit movement cost
- No client-authored route ambiguity
- One revision and event per complete move

A future UI may let the player select only a destination, but it must resolve that destination to a currently enumerated canonical action before submission.

## Movement canary

The `tactical-movement-canary` game definition uses:

- Two players
- One unit per player
- A 24x24 map
- Alternating unit activations
- A central objective
- Six movement points per unit
- A maximum round bound
- First unit to occupy the objective wins

This canary exercises `GameDefinition`, legal actions, `MatchSession`, revisions, event replay, snapshot restoration, deterministic agents, and eventual browser camera work without treating temporary movement-only rules as final monster-master combat.

## Explicitly deferred from TC-0001

- Attacks and damage
- Initiative attributes and initiative sorting
- Move-plus-primary-action activation budgets
- Line of sight and range
- Cover
- Fog of war and hidden units
- Reactions, opportunity attacks, or overwatch
- Elevation and jumping
- Destructible terrain
- Multi-cell units
- Summoning and monster cubes
- Inventory, resources, abilities, and status effects
- Generated maps or generated art
- Networked deployment canaries

Those systems build on this map and movement contract rather than replacing it.

## Acceptance boundary

The initial TC-0001 repository slice should prove:

- 24x24 semantic map construction and validation
- Unique unit occupancy and blocked-terrain rejection
- Deterministic weighted shortest paths
- Stable reachable-cell and legal-move enumeration
- Complete path actions and immutable state transitions
- MatchSession event replay and snapshot restoration
- Deterministic objective-race self-play
- Default 12x9 viewport over the larger map
- Bounded pan, zoom, centering, and visibility calculations
- Camera state remaining outside authoritative snapshots

A later TC-0001 browser slice may add Canvas rendering and input on top of these contracts before TC-0002 begins combat implementation.
