# RPG Campaign Experience Directions

## Status

This document records an unresolved product and architecture choice for the future RPG project.

The separate RPG Game Master runtime boundary is settled in [RPG GM Runtime Boundary](./rpg-gm-runtime-boundary.md). What remains undecided is how much of the noncombat campaign should become a structured GameFrame game surface.

Two directions remain under active consideration:

1. a Discord-first illustrated campaign that invokes GameFrame mainly for tactical encounters and selected structured mechanics;
2. a game-heavy hybrid RPG platform in which GameFrame also implements substantial exploration, inventory, dialogue, quest, and campaign interfaces.

Neither direction is selected by this document. Future implementation must preserve the ability to evaluate both without treating either as an already approved product commitment.

## Common architecture

Both directions retain these invariants:

- the RPG Game Master is a separate project and runtime, not a Scribbles Runtime agent or subagent;
- Scribbles Runtime owns Theo and only the connector needed for Theo to participate as a player;
- Theo receives only player-visible information and does not receive RPG-GM-only context or hidden campaign state;
- GameFrame is authoritative for mechanics and state explicitly represented and accepted through GameFrame contracts;
- the RPG runtime is authoritative for campaign and narrative state that remains outside GameFrame;
- the RPG GM proposes authorized operations and consumes committed GameFrame outcomes rather than directly mutating GameFrame storage;
- tactical encounters reuse the existing GameFrame map, action, replay, persistence, projection, identity, and rendering foundations;
- generated media is cached, versioned, and nonblocking; image-generation failure or latency cannot prevent legal play;
- no direct Theo-runtime-to-RPG-runtime dependency is assumed. Their ordinary interaction occurs through campaign-visible Discord messages and GameFrame player or campaign interfaces.

## Direction A — Discord-first illustrated campaign

### Player experience

The primary campaign takes place in Discord through narration, player dialogue, freeform declared actions, NPC conversations, and occasional structured prompts.

The experience should feel like a high-production tabletop or play-by-post campaign rather than a plain text bot. Discord presentation may include:

- concise scene narration and distinct NPC dialogue;
- modular or generated NPC portraits;
- establishing images for locations and major scene transitions;
- item, spell, weapon, faction, quest, and artifact cards;
- maps, letters, wanted posters, handouts, symbols, and evidence images;
- buttons, selections, or forms when a bounded choice benefits from explicit input;
- player-specific information through appropriate private or authenticated views;
- tactical GameFrame encounters when combat or another spatial rules problem begins.

The RPG GM can improvise arbitrary campaign concepts without requiring every described object, room, or social interaction to exist as a graphical game entity. A fruit kingdom fighting candy people, a conventional fantasy campaign, or a science-fiction mystery can share the same narrative and encounter infrastructure.

### Asset strategy

The presentation can combine several asset paths:

```text
instant deterministic composition
  modular portrait parts
  frames, icons, cards, backgrounds, palettes, overlays, and effects

prepared campaign library
  recurring NPCs
  common locations
  factions
  enemy families
  equipment families
  scene templates

selective generated assets
  major NPCs
  boss reveals
  exceptional locations
  important artifacts
  chapter and campaign art
```

A local ComfyUI or equivalent diffusion service may run on an operator-controlled GPU, including a GeForce RTX 3090. It can prepare likely assets before a session and generate unexpected high-value assets during play. Cloud providers may supplement or replace local generation when configured.

Generated assets should normally be requested asynchronously. The GM may immediately continue with text, use a temporary deterministic composition, or post a prepared placeholder while a final image renders. Every accepted asset should be cached against a stable campaign entity, prompt or recipe version, model or workflow version, and provenance record.

### GameFrame responsibility

GameFrame is invoked where structured mechanics provide clear value, primarily:

- tactical combat;
- encounter maps, participants, objectives, terrain, abilities, and effects;
- authoritative encounter results;
- optionally character sheets, equipment, inventory, checks, or item cards when repeated use justifies a structured implementation.

A normal flow is:

```text
Discord narrative and freeform play
  → RPG GM identifies a structured encounter
  → RPG runtime submits an authorized encounter configuration
  → players use the GameFrame tactical client
  → GameFrame commits the outcome
  → RPG GM resumes the campaign in Discord
```

### Advantages

- reaches a rich campaign experience with substantially less software than a generalized CRPG platform;
- preserves the GM's ability to improvise unusual concepts and actions;
- concentrates GameFrame development on mechanics where determinism and UI matter most;
- allows strong visual identity through generated and composed media without requiring a graphical world simulation;
- supports asynchronous and live campaign pacing;
- reduces the number of narrative possibilities that must be converted into schemas, interfaces, migrations, and browser journeys.

### Costs and risks

- more campaign state remains dependent on the RPG runtime's narrative and semantic records;
- some players may prefer a more unified graphical interface;
- inventory, progression, secrets, and long-running campaign mechanics still require deliberate ownership and inspection tools;
- Discord presentation can become noisy unless messages, threads, cards, images, and controls are carefully composed;
- generated visual consistency requires asset recipes, reference images, caching, and campaign style control.

## Direction B — Game-heavy hybrid RPG platform

### Player experience

GameFrame becomes a broader RPG client rather than mainly an encounter surface. Players may use a persistent browser or Discord Activity interface containing:

- world, region, location, room, or point-of-interest navigation;
- party and character sheets;
- inventory, equipment, abilities, conditions, and progression;
- clickable NPCs, objects, doors, shops, quests, and dialogue options;
- exploration state and fog of war;
- factions, reputation, objectives, rest, injuries, and recovery;
- transitions from exploration directly into tactical combat;
- generated campaign themes and assets applied to structured mechanical content.

Discord remains available for discussion, narration, notifications, asynchronous play, and social interaction, but it is no longer necessarily the primary campaign interface.

### Implementation shape

GameFrame would require a campaign layer beyond the tactical engine:

```text
campaign services
  world and location graph
  persistent characters and party state
  inventory and equipment
  quests and campaign flags
  factions and reputation
  exploration and visibility
  dialogue and interaction state
  rest, recovery, shops, and progression
  encounter configuration and result application

existing tactical services
  maps and terrain
  initiative and legal actions
  movement and combat
  objectives and outcomes
  replay and player-specific projections
```

The RPG GM could generate content and propose operations, but every mechanically meaningful concept would require a validated representation. An improvised locked candy-glass gate, for example, would need a supported object type, state, permitted interactions, difficulty or rules reference, destination, persistence behavior, and client presentation before it could function as a game object.

This direction also requires:

- campaign authoring and operator inspection tools;
- structured content and schema validation;
- procedural map or location assembly;
- save migration and reconstruction;
- broader hidden-information projections;
- generated theme, portrait, item, and environment asset pipelines;
- substantially expanded browser, simulation, recovery, and visual testing;
- explicit handling for model proposals that exceed currently implemented mechanics.

### Advantages

- provides a more unified and discoverable game experience;
- makes persistent mechanics visible and directly manipulable;
- can support richer spatial exploration and repeated noncombat systems;
- gives campaigns a stronger CRPG or virtual-tabletop identity;
- may provide better interfaces for inventories, maps, quests, shops, progression, and player-specific state.

### Costs and risks

- every supported narrative possibility becomes a software, schema, persistence, UI, and testing obligation;
- development scope expands from an agent-assisted campaign into a generalized RPG platform;
- improvised content is constrained by the mechanics and objects already implemented;
- generated campaigns require extensive validation to prevent unsupported or contradictory content;
- browser, mobile, Discord Activity, persistence, and migration complexity increase materially;
- the product may spend substantial effort recreating interactions that Discord narration handles adequately.

## Shared near-term work

The following work benefits both directions and should proceed without selecting one prematurely:

1. finish and validate the tactical encounter foundation;
2. define a transport-neutral RPG encounter request and committed result contract;
3. preserve separate RPG GM and Theo player identities and authorization;
4. prove one RPG-owned party can enter and return from a GameFrame encounter;
5. define stable campaign entity and asset references;
6. prototype modular portrait, card, and scene composition;
7. prove local and optional cloud image-generation queues with caching and deterministic fallbacks;
8. measure actual campaign use before promoting noncombat mechanics into GameFrame.

## Evaluation approach

The decision should be made through narrow campaign prototypes rather than architecture preference alone.

A Discord-first prototype should prove:

- a coherent multi-scene campaign session in Discord;
- recurring NPC and location continuity;
- useful generated or composed assets without disruptive delays;
- one tactical encounter and authoritative return to narration;
- manageable campaign-state inspection and correction.

A game-heavy prototype should prove one small location with:

- movement or point-of-interest navigation;
- one NPC interaction;
- one item or inventory interaction;
- one quest or campaign flag;
- one transition into and out of tactical combat;
- acceptable desktop and mobile usability.

Compare the prototypes on:

- player enjoyment and clarity;
- GM improvisational freedom;
- implementation and maintenance cost;
- latency and operational complexity;
- campaign continuity and recoverability;
- usefulness of structured interfaces;
- generated-asset consistency and cost;
- how often players prefer Discord versus the GameFrame client.

## Governing rule

> Preserve the separate RPG GM runtime and the authoritative GameFrame mechanics boundary while evaluating both campaign experiences. Do not silently turn the tactical encounter foundation into a full RPG platform, and do not limit future structured gameplay merely because the first campaign proof is Discord-first.
