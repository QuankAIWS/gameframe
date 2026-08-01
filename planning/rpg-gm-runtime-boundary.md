# RPG GM Runtime Boundary

## Status

This document records the settled cross-project boundary between Scribbles GameFrame, Scribbles Runtime, and the future RPG Game Master project.

It supersedes any earlier wording that places the RPG Game Master, Game Director, campaign narrator, or equivalent RPG orchestration role inside Scribbles Runtime.

The unresolved choice between a Discord-first illustrated campaign and a game-heavy hybrid RPG platform is documented separately in [RPG Campaign Experience Directions](./rpg-campaign-experience-directions.md).

## Decision

The RPG Game Master is a separate project with its own runtime.

It may reuse technology, patterns, and interfaces from Scribbles Runtime and GameFrame, but it is not hosted, configured, spawned, supervised, or persisted by Scribbles Runtime.

## Ownership

### GameFrame

GameFrame owns authoritative mechanics and state that are explicitly represented, accepted, and persisted through GameFrame contracts:

- game and encounter sessions and participant seats;
- legal actions and state transitions;
- deterministic or seeded rules resolution;
- player-specific observations and hidden mechanical information;
- replay, revision, persistence, reconnect, and stale-action rejection;
- committed encounter outcomes and GameFrame-owned artifacts;
- browser and Discord Activity delivery boundaries.

GameFrame does not automatically own every narrative fact, NPC belief, scene description, quest idea, or campaign event merely because it occurs during an RPG. State outside a GameFrame contract remains owned by the RPG project unless it is deliberately promoted into a structured GameFrame mechanic.

### Scribbles Runtime

Scribbles Runtime owns Theo and the narrow integration required for Theo to act as a GameFrame player:

- receive Theo's authorized player observation;
- present the observation and legal actions to Theo;
- submit Theo's selected legal action;
- preserve connector correlation, authorization, failure, and delivery evidence;
- use a deterministic fallback when the live Theo path is unavailable.

Scribbles Runtime does not own campaign state, RPG narration, NPC memory, quest orchestration, Game Master context, or RPG-specific model lifecycle.

### RPG GM project and runtime

The separate RPG project owns:

- campaign and world continuity outside GameFrame-owned mechanics;
- player-character and NPC narrative state outside authoritative GameFrame representations;
- narration, scene framing, dialogue, factions, quests, and campaign progression;
- interpretation of freeform player intent;
- bounded campaign-operation and encounter requests;
- RPG-specific memory, context construction, provider routing, evaluation, recovery, and deployment;
- campaign media requests, asset continuity, and presentation orchestration unless a specific artifact is promoted into GameFrame ownership.

The RPG runtime submits authorized intentions to GameFrame and consumes committed GameFrame outcomes. It does not directly mutate authoritative GameFrame state.

## Integration shape

```text
Theo
  ↕
Scribbles Runtime
  ↕ Theo/GameFrame connector
GameFrame APIs

RPG GM
  ↕
separate RPG GM runtime
  ↕ RPG/GameFrame adapter
GameFrame APIs
```

The default design does not require a direct private connection between Scribbles Runtime and the RPG GM runtime. Theo and the GM ordinarily interact through campaign-visible Discord activity and GameFrame player or campaign interfaces.

A direct typed runtime-to-runtime contract may be added only after a concrete use case demonstrates that the ordinary shared surfaces are insufficient. Neither runtime receives direct access to the other's private databases, queues, prompt state, internal tools, or lifecycle controls.

## Development consequences

- Current GameFrame development should expose clean game and encounter contracts without building the RPG GM runtime.
- Current Scribbles Runtime development should preserve only the external seam needed for Theo to play GameFrame.
- RPG GM architecture, campaign storage, context, orchestration, evaluation, and deployment belong to the separate RPG project.
- GameFrame tests prove GameFrame mechanics and interfaces, not RPG GM reasoning or narration.
- Scribbles tests prove Theo connector behavior, not RPG GM behavior.
- RPG GM tests must run against the separate RPG runtime and controlled GameFrame interfaces.
- New noncombat mechanics should enter GameFrame only after a concrete product need justifies their schema, persistence, interface, migration, and testing cost.

## Non-goals

The boundary does not require:

- duplicating GameFrame's combat engine in the RPG project;
- duplicating Scribbles technology when a clean reusable component is appropriate;
- preventing Theo from participating in an RPG campaign;
- preventing future shared schemas or libraries where ownership remains explicit;
- choosing the Discord-first or game-heavy campaign direction before both are evaluated.

It does prevent shared technology from being used as a reason to collapse all three products into one runtime.
