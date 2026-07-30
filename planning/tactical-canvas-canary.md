# TC-0001 Tactical Canvas Movement Canary

## Purpose

The tactical Canvas movement canary is the first browser projection of the authoritative tactical map and movement contracts. It proves that a logical battlefield larger than the viewport can be inspected and controlled without moving camera state into the match snapshot or creating a second game-authority path.

The canary is intentionally a movement objective race. It is not the final monster-master battler and does not define combat, ability, initiative-stat, or content systems.

## Browser surface

The first tactical renderer uses a dedicated `/tactical.html` surface linked from the ordinary GameFrame game-selection screen.

This separation is deliberate for the initial canary:

- The already validated Tic-Tac-Toe and Checkers DOM client remains unchanged.
- Canvas layout and input can evolve without destabilizing board-game selectors or accessibility behavior.
- The tactical page still uses the same browser identity, match API, revision checks, invite semantics, refresh behavior, and deterministic Theo boundary.
- Once the renderer contract is stable, the tactical surface may be folded into a shared application shell without changing game authority.

## Camera and viewport

- The authoritative map is 24x24 cells.
- The default viewport is approximately 12x9 visible cells.
- Camera center, zoom, visible bounds, path hover, and animation state remain client-only.
- Camera pan is available through visible controls and keyboard arrow keys.
- Bounded zoom is available through controls, keyboard input, and the pointer wheel.
- The camera may center on the active unit or central objective.
- Camera changes never submit a command or increment the match revision.
- Refresh restores authoritative map and unit state; camera state may be recomputed locally.

## Canvas projection

The renderer maps semantic authoritative data to simple deterministic development visuals:

- Floor cells use alternating blue-gray values.
- Difficult terrain uses a distinct olive-gray fill and hatch marks.
- Walls use dark blocked cells and inset structures.
- The objective uses a gold beacon glow.
- Unit Alpha and Unit Beta use distinct circular tokens.
- The active unit has an emphasized glow.
- A selected unit has a gold selection ring.
- Legal destinations use cyan markers.
- The currently previewed canonical route uses a gold path line.

No image filenames, theme assets, animation frames, or renderer-specific objects are stored in authoritative state.

## Input and action boundary

A player may select only the currently active unit they own. After selection, the client exposes destinations from the authoritative `legalActions` list.

The client does not calculate or submit an arbitrary route. It selects one complete canonical move action already supplied by GameFrame:

```ts
{
  type: "move",
  unitId: "unit-alpha",
  from: { x: 2, y: 2 },
  path: [
    { x: 3, y: 2 },
    { x: 4, y: 2 }
  ],
  movementCost: 2
}
```

Canvas pointer input and keyboard-accessible destination buttons resolve to the same action object. The service and `GameDefinition` validate that action against current state before committing it.

## Match and participant behavior

The canary supports:

- Human versus deterministic Theo
- Human versus human through a resumable development invite
- Provider-backed Theo through the existing version-1 decision contract
- URL and local-browser match resume
- HTTP polling in the Node development host
- Hibernating WebSocket projections in the Cloudflare adapter
- Deterministic replay and snapshot restoration

Theo and mock providers receive the full player observation and enumerated legal actions. They do not control the camera or renderer.

## Workers-runtime behavior

The existing migration-stable Durable Object binding and class name are retained. Its internal runtime dispatches Tic-Tac-Toe, American Checkers, and the tactical movement canary by persisted `gameId`.

Real Workers-runtime tests prove:

- Tactical match creation
- Accepted human and deterministic Theo movement
- Full 24x24 map persistence
- Unit-position persistence
- Legal path recovery after Durable Object eviction
- Existing competing-write and hibernating-WebSocket regressions

This is repository/runtime evidence, not a deployed Cloudflare canary.

## Browser acceptance

Playwright coverage proves:

- Canvas rendering and match creation
- Default larger-map viewport
- Camera pan and bounded zoom
- Active-unit centering
- Keyboard unit selection
- Accessible legal-destination controls
- Complete movement submission against Theo
- Two-browser human movement
- Revision progression and match resume
- Mobile controls without horizontal overflow
- Continued Tic-Tac-Toe and Checkers regression coverage

Failure screenshots and traces remain failure-only with short retention.

## Explicitly deferred

- Attacks and damage
- Initiative attributes or speed sorting
- Move-plus-action activation budgets
- Line of sight, range, cover, or fog of war
- Reactions and overwatch
- Elevation, jumping, flight, or teleportation
- Monster masters, monster cubes, resources, or summoning
- Art atlases, animated sprites, particles, or sound
- Minimap and explored-terrain memory
- Deployed Cloudflare and Discord canaries
- Live Scribbles Runtime model decisions

## Acceptance boundary

The Canvas slice is complete when the exact frozen branch head passes:

- Tactical core, service, HTTP, replay, and provider tests
- Real Workers-runtime tactical eviction recovery
- Tactical browser movement, camera, resume, two-player, and mobile tests
- Existing Tic-Tac-Toe and Checkers regressions
- Repository contract checks
- GitHub-hosted canonical validation

TC-0002 combat work begins only after this movement and projection boundary is durably recorded.
