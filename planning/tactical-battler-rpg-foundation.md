# Tactical Battler and RPG Foundation

## Status

This document records the intended product and architecture sequence for expanding Scribbles GameFrame beyond the initial tic-tac-toe walking skeleton.

It is a forward design constraint, not a claim that the described tactical, visual, RPG, Discord, Cloudflare, or model-backed capabilities are already implemented. Concrete mechanics may evolve through playtesting, but future work should preserve the boundaries and sequencing defined here unless a later decision record explicitly supersedes them.

The RPG Game Master runtime boundary is defined in [RPG GM Runtime Boundary](./rpg-gm-runtime-boundary.md).

The unresolved choice between a Discord-first illustrated campaign and a game-heavy hybrid RPG platform is defined in [RPG Campaign Experience Directions](./rpg-campaign-experience-directions.md).

## Decision summary

The first substantial game built on GameFrame should be a compact turn-based tactical battler rather than a real-time strategy game or a fully generative tabletop RPG.

The tactical battler establishes the deterministic combat substrate needed by both later RPG campaigns and eventual strategy modules:

- Board coordinates and occupancy
- Legal movement and pathfinding
- Initiative and activation sequencing
- Attacks, abilities, damage, healing, and status effects
- Terrain, line of sight, range, hazards, and objectives
- Unit ownership, teams, summons, and defeat
- Player-specific visibility and fog of war
- Deterministic events, replay, reconnect, and stale-action rejection
- Human and nonhuman players operating through the same authoritative boundary

The first concrete game should use a monster-master theme: each player controls a master and deploys monster cubes that become tactical units. This theme naturally exercises summoning, deployment, resources, rosters, unit ownership, and combat without requiring the exploration, dialogue, persistence, and open-ended adjudication of a full RPG.

Both candidate RPG directions should reuse this tactical system. Neither direction should invent a second combat engine.

## Why the tactical battler precedes real-time strategy

A real-time strategy module introduces continuous simulation, command scheduling, latency-sensitive reconciliation, simultaneous movement, large-unit pathfinding, AI tick budgets, and substantially more complicated networking. Those problems do not provide proportional value toward the near-term RPG objective.

A turn-based tactical game provides meaningful multiplayer gameplay while keeping authority discrete and inspectable. Each accepted command produces a committed event and a new revision. That is well aligned with GameFrame's existing HTTP-command and projection-only WebSocket architecture.

The intended development sequence is:

```text
GameFrame multiplayer infrastructure
        -> tactical board and combat core
        -> monster-master battler
        -> Theo and Discord multiplayer canaries
        -> theme and asset abstraction
        -> RPG encounter wrapper
        -> separate bounded RPG GM runtime
        -> evaluate Discord-first illustrated and game-heavy hybrid campaign proofs
        -> eventual real-time strategy experiments
```

## Architectural invariants

### One authoritative rules path

GameFrame remains authoritative for mechanics and state explicitly represented through GameFrame contracts. Browsers, Discord transports, Theo through Scribbles Runtime, deterministic bots, the separate RPG GM runtime, and other model-backed agents submit intentions. They do not directly mutate GameFrame state.

Narrative and campaign state that has not been promoted into a GameFrame contract remains owned by the separate RPG project.

Scribbles Runtime participates in this path only as Theo's runtime and connector. It is not the host or lifecycle owner of the RPG GM.

The authoritative tactical module owns:

- Dice and seeded randomness
- Initiative order
- Turn and activation ownership
- Movement legality and occupancy
- Range and line-of-sight calculations
- Damage and effect resolution
- Unit creation, summoning, defeat, and removal
- Inventory or loadout mechanics used during encounters
- Objectives, completion, and winner semantics
- Hidden information and player-specific observations

### Theo is a player, not the referee

Theo remains a registered nonhuman player. He receives only the observation available to his seat and submits one of the legal actions exposed by GameFrame.

Theo must not receive unrevealed terrain, hidden units, secret objectives, enemy plans, private RPG GM notes, or future encounter information. A deterministic fallback can act for Theo when Scribbles Runtime or a model provider is unavailable.

### The RPG GM is separate from Theo and Scribbles Runtime

The later RPG Game Master or Game Director is a dedicated, bounded system role hosted by its own RPG GM project and runtime.

It is not a configured Scribbles agent, Scribbles subagent, or Scribbles-hosted lifecycle. It may reuse selected orchestration patterns, model-provider abstractions, testing concepts, or other technology from Scribbles, but shared technology does not imply shared runtime ownership.

The RPG GM runtime may narrate scenes, portray nonplayer characters, translate freeform intentions into structured proposals, maintain campaign-specific continuity, and request permitted campaign operations through explicit GameFrame interfaces.

It is not another path around the rules engine. The RPG GM may propose operations such as:

- Reveal a room that the campaign state permits the party to enter
- Instantiate an encounter from an approved template
- Request a skill check
- Speak as a nonplayer character
- Offer legal choices
- Advance a quest phase after its conditions are satisfied

It may not directly assign arbitrary GameFrame health, equipment, victory, movement, or map state.

The default design does not require a private Theo-runtime-to-RPG-runtime connection. Theo and the RPG GM ordinarily interact through campaign-visible Discord activity and GameFrame interfaces. A direct typed contract may be added only after a concrete use case demonstrates that those shared surfaces are insufficient.

Neither runtime receives direct access to the other's internal databases, private prompt state, queues, or lifecycle controls.

### Mechanics and presentation are independent

Game mechanics must refer to semantic concepts rather than concrete art assets. A cell is floor, difficult terrain, wall, hazard, cover, or an objective before it is crypt stone, pressed sugar, alien metal, or slime.

An item can retain one stable mechanical definition while campaigns supply different names, descriptions, materials, palettes, and visual recipes.

### The ordinary browser remains the base client

The tactical interface should be an ordinary responsive browser client. Discord Activity delivery wraps that client rather than creating a second user interface implementation.

This browser-first tactical rule does not decide whether the wider campaign is primarily played through Discord or through a broader GameFrame RPG client.

## Proposed module boundaries

The initial code organization should converge toward boundaries similar to the following. Exact filenames should follow the repository conventions established when implementation begins.

```text
src/games/tactical-core/
    board and coordinates
    occupancy and pathfinding
    initiative and activations
    range and line of sight
    effects and combat resolution
    visibility and observations
    tactical event definitions

src/games/monster-master/
    masters and monster cubes
    roster and deployment rules
    resources and summoning
    unit archetypes and abilities
    objectives and victory rules
    starter maps

src/agents/tactical/
    deterministic tactical opponent
    Theo observation translation
    Theo legal-action translation

public/ or a later client package
    tactical board renderer
    input and targeting
    animation projections
    semantic asset manifests
    theme packs
```

The tactical core must not depend on monster-specific terminology. The monster-master game depends on the tactical core and supplies its own content, setup, objectives, and special rules.

The RPG GM runtime is not placed under `src/agents/` in this repository. GameFrame should expose stable RPG-facing APIs and schemas without absorbing the separate runtime's orchestration, memory, or prompt system.

## First game: monster-master tactical duel

The first game should be deliberately compact.

Each player controls:

- One Monster Master
- A small roster of monster cubes
- A bounded resource used to deploy or empower monsters
- A compact set of master actions or abilities

A cube is deployed to an eligible cell and instantiates a monster unit. This exercises the same underlying operations later used for RPG summons, reinforcements, traps, companions, and enemy spawns.

### Initial match target

The first playable target should prefer:

- Two players
- One master and approximately three deployed monsters per side
- An 8x8 to 12x12 square board
- Four or five meaningful terrain categories
- Three initial monster archetypes
- One basic attack and one special ability per monster
- One simple resource economy
- One elimination or objective-based victory condition
- A match length of roughly ten to twenty minutes after players understand the rules

The architecture may preserve two-to-four-player identities and teams, but the first validated gameplay loop should remain a two-player duel. Four-player pacing, alliances, team visibility, disconnect handling, and simultaneous social interaction should not delay the core combat proof.

## Combat and activation model

### Unit-by-unit initiative

The first combat model should use unit activations ordered by initiative rather than alternating entire armies.

At the start of a round:

1. Every eligible unit receives or exposes an initiative value.
2. Units are ordered from highest to lowest.
3. Ties are resolved deterministically using a documented stable rule or seeded roll.
4. Each unit receives one activation.
5. The next round begins after all eligible activations are complete.

This model creates tactical interleaving, supports fast and slow monsters, and transfers naturally to RPG encounters.

### Initial activation budget

A first-version activation should support:

```text
move up to movement allowance
        +
one primary action
        +
an optional bounded contextual interaction
```

Representative turns include moving and attacking, attacking and then moving when an ability permits it, deploying a cube, using a special ability, interacting with an objective, or ending the activation.

### Intentionally deferred combat complexity

The first slice should not require:

- Reaction or interrupt stacks
- Opportunity attacks
- Overwatch
- Unit facing or rear arcs
- Variable vertical elevation
- Destructible terrain
- Large action-point economies
- Persistent physics simulation
- Dozens of stacking status effects
- Arbitrary model-authored abilities

These may be added later only after the base event and legality model can represent them without introducing a second authority path.

## Visual direction

### Projection choice

The recommended presentation is an orthographic square grid rendered with three-quarter-view digital miniatures and shallow vertical scenery.

The board remains a conventional square coordinate system. Rendering, pathfinding, hit testing, procedural map assembly, serialization, and touch input therefore remain simple.

Units are not restricted to pure overhead circles or symbols. A unit may be a small standing cutout or miniature whose feet are anchored near the lower center of its cell. Soft shadows, slight overlap, and shallow scenery create depth without requiring a true isometric coordinate system.

### Why not true isometric initially

A true isometric board creates additional costs:

- Coordinate transforms for rendering and selection
- Overlapping tiles and scenery
- Depth sorting and occlusion
- Directional art requirements
- Less precise mobile targeting
- More difficult generated-asset perspective constraints
- An implied elevation model that may not exist mechanically

Those costs do not improve the deterministic combat foundation. True isometric or 3D presentation can remain a later renderer experiment because the authoritative tactical state is projection-independent.

### Digital-miniature animation

The first art pipeline should not require large directional sprite sheets. Static or lightly layered miniatures can be made expressive through renderer-driven effects:

- Sliding, hopping, or stepping between cells
- Short attack lunges
- Horizontal flipping or small rotations
- Scale pulses and hit flashes
- Projectiles and particles
- Floating damage or status indicators
- Camera or board shake for major impacts
- Selection bases, range overlays, and target indicators

This allows prepared, assembled, or generated static assets to participate in the same game without requiring dozens of frames per unit.

### Rendering layers

The tactical renderer should use explicit layers similar to:

1. Background
2. Floor tiles
3. Floor decals
4. Hazards and objective indicators
5. Low props
6. Unit shadows and bases
7. Units
8. Tall props and wall fronts
9. Projectiles and combat effects
10. Fog of war
11. Selection, path, range, and targeting overlays
12. Interface panels

Canvas 2D is the preferred initial renderer unless implementation evidence establishes a concrete need for a heavier dependency.

## Semantic maps and theme packs

The authoritative map stores semantic and mechanical data, not concrete image filenames.

A representative cell may expose concepts such as:

```json
{
  "x": 4,
  "y": 7,
  "terrain": "floor",
  "material": "stone",
  "movementCost": 1,
  "cover": "none",
  "tags": ["indoors", "damp"],
  "propSlots": ["small"]
}
```

A theme pack maps those concepts to presentation assets:

```json
{
  "floor.stone": "crypt-floor-cracked-02",
  "wall.stone": "crypt-wall-bone-trim",
  "prop.small": ["skull-pile", "candle", "broken-urn"]
}
```

Another theme may map the same mechanics to pressed sugar, chocolate brick, gumdrop skulls, and candy candles. Movement, cover, occupancy, range, and victory behavior remain unchanged.

Theme packs should be data-driven, validated, and incapable of silently altering mechanics unless a game module explicitly references a mechanical content definition.

## Generative content strategy

The model should normally generate structured content manifests rather than arbitrary rendering code or fresh images for every action.

### Preferred generation hierarchy

#### Level 1: deterministic reusable assets

Used continuously without inference:

- Terrain and wall tiles
- Unit silhouettes and bases
- Equipment or creature layers
- Status icons
- Projectiles and effects
- UI frames, materials, palettes, and decals

#### Level 2: model-generated structured recipes

Generated when preparing a campaign, chapter, or theme and then cached:

- Theme manifests
- Item and enemy reskins
- Names and descriptions
- Palette and material assignments
- Prop selections
- Encounter configurations
- Portrait or key-art prompts

#### Level 3: selective generated key art

Reserved for high-value moments:

- Campaign splash art
- Major nonplayer-character portraits
- Boss reveals
- Important artifacts
- Chapter transitions
- Exceptional locations

Ordinary movement, attacks, doors, and generic loot should use deterministic presentation. Image generation latency or quota exhaustion must never block legal gameplay.

The wider RPG asset system may combine modular portrait composition, card and frame templates, prepared campaign libraries, local ComfyUI or equivalent generation on an operator-controlled GPU, and optional cloud providers. Accepted outputs should be cached against stable campaign entities and workflow or model versions.

Unexpected image generation should normally be asynchronous. Text, deterministic compositions, or prepared placeholders allow the campaign to continue while a final asset renders.

### Visual recipes

A reskinned item should retain a stable mechanical reference and attach presentation data, for example:

```json
{
  "rulesRef": "weapon.greatblade.tier2",
  "skin": {
    "name": "The Confectioner's Headsplitter",
    "description": "A spiral lollipop sharpened along one translucent edge."
  },
  "visualRecipe": {
    "silhouette": "greatsword-03",
    "material": "candy-glass",
    "palette": ["cherry-red", "cream-white"],
    "ornaments": ["spiral", "ribbon-wrap"],
    "effect": "sugar-sparkle"
  }
}
```

The renderer composes approved silhouettes, materials, overlays, palettes, and effects. It does not execute arbitrary model-written Canvas code.

## RPG extension directions

The tactical encounter engine is common to two unresolved campaign directions.

### Direction A — Discord-first illustrated campaign

Most narration, dialogue, exploration, improvisation, NPC interaction, and campaign continuity remain in Discord and the separate RPG runtime.

GameFrame is invoked primarily for:

- tactical combat and other spatial encounters;
- authoritative encounter maps, participants, actions, effects, objectives, and results;
- selected character, inventory, equipment, check, or item-card systems only when repeated use justifies structured implementation.

The Discord campaign can be enriched with modular portraits, scene art, location cards, maps, letters, item and spell cards, faction symbols, generated handouts, prepared asset libraries, local ComfyUI generation, and optional cloud generation.

This path does not require a simulated graphical overworld or a GameFrame entity for every improvised narrative object.

### Direction B — Game-heavy hybrid RPG platform

GameFrame expands beyond tactical encounters to implement substantial persistent and noncombat systems such as:

- world locations and transitions;
- persistent characters and progression;
- inventory and equipment;
- exploration and fog of war;
- dialogue and social actions;
- factions and reputation;
- quests and campaign events;
- rest, recovery, and injuries;
- campaign-specific hidden information;
- shops, objects, interaction state, and broader graphical campaign presentation.

Discord remains a supported social and narrative surface, but GameFrame becomes a larger part of ordinary campaign play.

### Shared encounter boundary

The RPG layer and Game Master belong to their own project and runtime. GameFrame provides authoritative game capabilities and stable interfaces; it does not host the RPG agent's memory, context compiler, long-horizon planning, or model lifecycle.

When a structured encounter begins, the RPG runtime produces an encounter configuration through an authorized GameFrame contract. When the encounter ends, GameFrame returns committed outcomes such as survivors, injuries, consumed resources, recovered items, objectives, and other supported events.

The RPG campaign state must not reconstruct GameFrame results by parsing narration. It consumes authoritative results.

Scribbles Runtime may allow Theo to join the campaign as a player through its own GameFrame connector. That does not make Scribbles Runtime the campaign or RPG GM owner.

The two campaign directions, their costs, and their prototype criteria are defined in [RPG Campaign Experience Directions](./rpg-campaign-experience-directions.md). Neither is selected by this foundation document.

## Milestone sequence

### TC-0001 - Board and movement

- Render a square tactical map.
- Select units and inspect cells.
- Enumerate and display legal movement.
- Commit deterministic movement through the authoritative service.
- Preserve revision, replay, reconnect, and player-specific observation behavior.

### TC-0002 - Initiative and combat

- Implement rounds and unit activations.
- Add range and line of sight.
- Resolve attacks, damage, defeat, and a small status-effect set.
- Detect objectives and match completion.

### MM-0001 - Monster Master duel

- Add masters, cubes, deployment, resources, and three monster archetypes.
- Deliver one complete two-player map and victory loop.
- Include a deterministic opponent so the game remains independently testable.

### MM-0002 - Theo tactical integration

- Translate tactical observations into a structured Scribbles Runtime contract.
- Expose legal actions without hidden-state leakage.
- Accept Theo's selected action through the same player command path.
- Retain deterministic fallback behavior.

### MM-0003 - Discord multiplayer canary

- Launch the ordinary client as a Discord Activity.
- Resolve authenticated participant identities and seats.
- Validate invite, reconnect, mobile input, and spectator projections.

### MM-0004 - Theme abstraction proof

- Run the same mechanics and map semantics through a second visual theme.
- Require no tactical-rule changes.
- Validate asset manifests and deterministic fallbacks.

### RPG-0001 - Encounter wrapper

- Establish the separate RPG project and runtime boundary.
- Persist a small party outside combat in the RPG-owned store.
- Enter a tactical encounter from campaign state through an authorized GameFrame contract.
- Resolve the battle through the tactical module.
- Return authoritative results to the campaign.

### RPG-0002 - Bounded RPG GM runtime

- Add the separate RPG GM runtime with narration and structured campaign operations.
- Keep rules, hidden-state access, and mutation capabilities explicitly constrained.
- Prove that Theo can participate through Scribbles Runtime without receiving RPG-GM-only information.
- Prove that neither runtime requires direct access to the other's private state.

### RPG-0003 - Campaign-direction prototypes

- Prove one short Discord-first illustrated campaign slice with recurring NPCs, generated or composed assets, and one tactical encounter.
- Prove one bounded game-heavy location slice with navigation, one NPC interaction, one item or inventory interaction, one campaign flag, and one tactical encounter transition.
- Compare player clarity, enjoyment, improvisational freedom, implementation cost, operational complexity, and actual use of Discord versus the GameFrame client.
- Record a product-direction decision only after both prototypes provide sufficient evidence.

### RPG-0004 - Generated theme and chapter proof

- Generate a bounded theme manifest and chapter configuration.
- Cache outputs and use deterministic fallbacks.
- Prove that one mechanical scenario can appear as two materially different campaigns.

## First tactical foundation acceptance criteria

The tactical foundation is not considered established until it can demonstrate:

- A replayable match with deterministic accepted actions
- Legal movement and attacks derived from authoritative state
- Initiative and activation ownership that survive reconnects
- At least one hidden or player-specific observation case
- Human-versus-human and human-versus-agent participation
- A deterministic fallback opponent
- One complete monster-master duel
- One browser client usable with mouse and touch
- A second theme applied without tactical-rule modification
- Test coverage for stale, duplicate, illegal, out-of-turn, and unauthorized commands

The tactical foundation does not need the RPG GM runtime or a selected campaign direction to satisfy these criteria.

## Open design decisions

The following remain provisional and should be settled through narrow prototypes or playtesting rather than assumption:

- Exact board size and match length
- Initiative formula and tie-breaking rule
- Whether movement occurs before or after a primary action by default
- Resource regeneration and cube deployment limits
- Master defeat versus objective-based victory
- Fog-of-war scope in the first monster game
- Exact Canvas asset dimensions and miniature anchoring convention
- Whether multi-cell units are required before the RPG layer
- The first two theme aesthetics
- Exact cross-project API between GameFrame and the separate RPG GM runtime
- Whether any direct Theo-runtime-to-RPG-runtime contract is actually necessary
- Discord-first illustrated versus game-heavy hybrid campaign direction
- Which noncombat mechanics provide enough repeated value to justify GameFrame ownership

These decisions may change without invalidating the larger architecture, provided the single-authority, semantic-presentation, shared-tactical-core, and separate-runtime invariants remain intact.

## Consequence

The compact tactical arena is no longer merely an isolated game planned before the RPG. It is the deliberate combat foundation for either future RPG campaign direction and a lower-risk stepping stone toward later real-time strategy work.

Implementation should optimize first for deterministic correctness, replayability, player-specific observations, and enjoyable small battles. Generative content is an enrichment layer added after the tactical loop is proven; it is not a prerequisite for the first playable battler.

The RPG GM remains a separate future project. GameFrame should be designed so that project can use its capabilities cleanly without forcing Scribbles Runtime to host it or forcing GameFrame to absorb agent-runtime responsibilities.

Future work must preserve both the Discord-first illustrated and game-heavy hybrid campaign directions until a deliberate prototype-backed decision selects one or defines a staged combination.
