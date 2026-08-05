---
title: Monster Master Product Asset Registry
status: active
document_type: asset-plan
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - Monster Master: Arena Battles
  - Monster Master RPG
  - GameFrame Monster Master asset production
related:
  - assets/monster-master-rpg-asset-register.json
  - assets/catalogs/monster-master/foundation.json
  - assets/catalogs/monster-master/terrain.json
  - assets/catalogs/monster-master/prop.json
  - assets/catalogs/monster-master/characters.json
  - assets/catalogs/monster-master/monster.json
  - assets/catalogs/monster-master/interface.json
  - assets/catalogs/monster-master/scene.json
  - assets/catalogs/monster-master/effect.json
  - assets/catalogs/monster-master/audio.json
  - shared/rpg-rendering-and-asset-contract.md
---

# Monster Master Product Asset Registry

## Decision

The Monster Master asset registry covers the entire product family, not only the latest starter plot, NPC pool, or campaign scene discussion.

The registry is shared by:

- **Monster Master: Arena Battles** — tactical battle terrain, trainers, monsters, props, effects, interface, and results;
- **Monster Master RPG** — exploration, campaign scenes, player and NPC presentation, party and creature management, items, abilities, quests, maps, evidence, encounter transitions, and aftermath;
- **shared product infrastructure** — visual identity, fallbacks, manifests, source-master rules, deterministic derivatives, provenance, and accessibility.

The machine-readable authority is [`assets/monster-master-rpg-asset-register.json`](assets/monster-master-rpg-asset-register.json). Detailed family coverage is split into catalogs under [`assets/catalogs/monster-master/`](assets/catalogs/monster-master/).

## Correction to the earlier production plan

The earlier register over-weighted Warden Pell, reusable NPC portraits, and a few campaign scenes because it was derived too closely from recent one-shot planning.

Those assets still matter, but they are one section of the product. They do not control the production sequence.

The corrected registry begins with a cross-family product slice containing:

- basic terrain beyond the existing grass and stone pilot;
- common environmental and gameplay props;
- the human player/trainer in portrait, battlefield, roster, and exploration forms;
- repaired existing monster art plus new original monsters;
- Arena Battles UI and effect states;
- reusable campaign scenes;
- deliberate silhouettes, icons, scene cards, and text fallbacks.

NPC families and selected plot extensions follow as part of the RPG expansion, not as the definition of Monster Master art.

## Code-derived baseline

The current implementation establishes the following facts:

- tactical geometry uses a 72×36 CSS-pixel projected cell and a 29 CSS-pixel raised-wall visual height;
- the current unit atlas has only three 96×96 frames;
- the current playable monster species are Stone Bulwark and Emberling Skirmisher;
- the current `master` combat content ID is a compatibility-era human trainer unit, not a monster species;
- tactical terrain currently exposes only `floor`, `difficult`, `wall`, and `objective` semantics;
- accepted bespoke terrain consists of grass ground, one stone raised cap, and one stone cliff face;
- current battle presentation exposes lobby, trainer cards, roster, active-unit HUD, health, command, phase, round, camera controls, action deck, legal options, invitation, and victory/defeat/draw states;
- current battlefield effects cover deployment, movement, damage, healing, and defeat;
- the RPG shell is text-first and does not yet render portraits, scene art, props, maps, inventory, or other media references.

The registry therefore includes both immediately consumable tactical assets and planned assets that require explicit renderer or campaign-interface work.

## Registry size

The product registry currently contains **216 asset clusters**:

| Catalog | Clusters | Coverage |
|---|---:|---|
| Foundation | 10 | product identity, visual system, silhouettes, scene and icon fallbacks |
| Terrain | 41 | grounds, difficult terrain, raised materials, faces, transitions, boundaries, objectives, decals |
| Props | 34 | vegetation, rocks, structures, storage, vehicles, interiors, cubes, equipment, evidence, objectives |
| Characters | 22 | player trainer, battle and exploration sprites, trainer archetypes, Pell, reusable NPC families |
| Monsters | 12 | existing roster repair, new battle roles, domestic and hazard roles, intelligent-monster presentation |
| Interface | 43 | Arena Battles and RPG controls, cards, resources, maps, inventories, quests, codex, outcomes |
| Scenes | 24 | academy, station, route, wilderness, settlement, event, civic, underworld, and cube locations |
| Effects | 20 | deploy, movement, attacks, healing, conditions, warnings, investigation, weather, transitions |
| Audio | 10 | later UI, battle, monster, trainer, ambience, music, and accessibility cues |

The catalogs are compact machine-readable coverage lists. A cluster may produce several source masters, states, derivatives, atlas frames, or responsive presentations.

## Product families

### Foundation and fallbacks

The shared foundation includes:

- Monster Master product, Arena Battles, and RPG identity marks;
- one core palette and material language;
- panel, frame, divider, ornament, and icon rules;
- intentional human, monster, scene, and icon fallbacks;
- light, dark, compact, monochrome, disabled, warning, private, success, and failure states.

A missing optional illustration must degrade to a coherent product state rather than an obvious development placeholder.

### Terrain

The terrain catalog expands the current three-material pilot into a usable world and battle vocabulary:

- grass, dirt, mud, roads, cobble, sand, snow, ash, cave, marsh, indoor wood, indoor stone, arena, water, and ice;
- difficult roots, rubble, brush, mud, and debris;
- stone, earth, masonry, timber, snow, and ice raised surfaces and faces;
- biome, road, shore, snow, and indoor-threshold transitions;
- grassland and settlement boundary aprons;
- objective surfaces, tracks, and damage decals.

Terrain source art remains material treatment. GameFrame geometry owns tile polygons, elevation faces, picking, movement rules, and occlusion.

### Props

The prop catalog covers ordinary world construction, not only plot evidence:

- trees, bushes, grass, rocks, logs, fences, gates, pens, crates, barrels, sacks, carts, and wagons;
- route markers, lamps, tents, furniture, doors, windows, stairs, bridges, and roadwork;
- academy training, classroom, inspection, cube, licensing, field-kit, and creature-care equipment;
- market, festival, roadblock, evidence, objective, escort, hazard, inn, office, and clinic sets.

Each prop family requires scale, alpha, ground-anchor, occlusion, and damaged/open/closed states where relevant.

### Players, trainers, and NPCs

The human Master is a trainer/player character and remains separate from monster species.

The character catalog includes:

- default player portrait;
- battlefield trainer cutout;
- four-direction exploration idle and walk sprites;
- roster avatar and silhouette fallback;
- trainer archetype kits for vanguard, commander, ranged magic, healing, and summoning roles;
- Warden Pell and reusable NPC portrait families for workers, rivals, care specialists, technicians, patrols, travelers, officials, organizers, underworld roles, and intelligent-monster citizens.

NPC portraits are important but no longer dominate the first wave.

### Monsters

The registry does not treat the current two-species roster as the final game.

P0 includes:

- audit, repair, or replacement of Stone Bulwark;
- audit, repair, or replacement of Emberling Skirmisher;
- a new support/healer monster role;
- a new tracker/scout monster role.

Later coverage adds ranged artillery, battlefield control, domestic worker, conventional and territorial hazards, public-event mascot, intelligent-monster citizen, and cube-occupant roles.

Every battle monster requires a battlefield source, portrait, roster icon, silhouette, movement, attack or ability, damage, defeat, shadow, anchor, scale, and mirror or direction metadata.

Working names in the catalog are production handles and may be changed through explicit lore review. They are not permission for implicit rules changes.

### Arena Battles interface

The Arena catalog covers the complete battle experience:

- hub tile, lobby modes, invitation, trainer and roster cards;
- active-unit HUD, health, command, initiative, phase, round, and turn order;
- action and ability icons, legal options, selection, targeting, path previews, and objectives;
- camera, inspection, conditions, hints, loading, reconnect, error, mobile rails, and battle results.

Existing CSS is audited rather than discarded automatically. Artwork supplements semantic HTML and must not replace interaction, focus, labels, text, or accessibility.

### RPG interface

The RPG catalog includes the surfaces required for a complete campaign product:

- scene and dialogue presentation;
- private observations and freeform input;
- party, trainer sheet, creature roster, inventory, equipment, abilities, quests, objectives, maps, relationships, and codex;
- evidence and handouts, checks and consequences, encounter transitions, aftermath, recap, and resume;
- item, quest, faction, ability, condition, hazard, location, and relationship icon families.

These assets can be authored before every consumer exists, but they are not `integrated` until real GameFrame surfaces consume them and screenshots pass.

### Scenes

Scene coverage includes:

- field-station exterior, common room, and cafeteria;
- academy grounds, training hall, classroom, lab, stable/clinic, and dorms;
- settled route, farm edge, woodland, cave, town, market, inn, festival, roadblock, work zone, arena, camp, licensing office, underworld room, and cube interior.

Scenes use neutral reusable bases and modular state layers. Named characters, decisive evidence, incident solutions, and interface elements must not be baked into the base image.

### Effects and audio

Effects cover deployment, movement, melee, projectiles, impacts, healing, buffs, debuffs, control, damage, defeat, command energy, objectives, investigation, creature behavior, hazards, containment, capture/release, weather, and scene transitions.

Every animated effect requires a reduced-motion alternative and maps to authoritative game or campaign events.

Audio remains P2 but is registered now so UI, battle, monster, trainer, ambience, music, and accessibility cue requirements are not forgotten.

## Required family state contracts

### Terrain

- retained source master;
- deterministic runtime derivative;
- repeat, transition, or decal behavior;
- explicit geometry role;
- four camera rotations and zoom matrix;
- boundary/apron and mobile evidence.

### Props

- clean alpha;
- ground anchor and occlusion class;
- scale review;
- relevant normal/damaged/open/closed states;
- tactical and campaign role mapping.

### Trainers and NPCs

- stable identity;
- required portrait and field or exploration presentation;
- neutral and consequential expressions;
- injury fallback;
- anchor and direction metadata.

### Monsters

- battle idle, portrait, roster icon, and silhouette;
- movement, attack or ability, damage, and defeat states;
- shadow, anchor, scale, and direction metadata.

### Scenes

- retained wide master;
- desktop, short-desktop, mobile, and Discord-safe crops;
- neutral base and reusable state layers;
- no baked plot-specific truth.

### Interface

- semantic HTML/CSS authority;
- keyboard, touch, hover, focus, selected, disabled, loading, and error states;
- responsive and Discord-safe layouts;
- readable undecorated fallback.

### Effects

- authoritative event mapping;
- timing and world anchor;
- tint policy;
- reduced-motion alternative;
- no gameplay state inferred from pixels.

## Production sequence

### Wave 0 — Audit and contracts

- audit current terrain, creature atlas, UI, effects, and fallbacks;
- reconcile the separate core-pack and campaign-register drafts;
- lock stable asset IDs, source profiles, derivative schemas, manifests, and provenance records;
- retain useful current work instead of generating duplicates.

### Wave 1 — Cross-family core slice

Produce a representative product slice across every major visual system:

- dirt, road, roots, earth cap, and earth face;
- trees, rocks, fences, storage props, and route markers;
- player portrait, battle cutout, exploration sprite, roster avatar, and fallback;
- repaired Stone Bulwark and Emberling;
- one new support/healer monster and one new tracker/scout monster;
- core action icons, active-unit HUD, targeting, objectives, and resource states;
- field-station and settled-route scenes;
- deployment, attack, healing, damage, and defeat effects.

This wave replaces the earlier NPC-first style-lock sequence.

### Wave 2 — Expanded battle pack

- additional terrain and prop vocabulary;
- at least six visually and mechanically distinct monster roles;
- complete monster action-state coverage;
- objectives, conditions, effects, cards, and results;
- several credible battle maps assembled from the common assets.

### Wave 3 — RPG presentation pack

- player exploration and character presentation;
- reusable locations and scene states;
- NPC families and incidental fallbacks;
- party, roster, inventory, equipment, abilities, quests, map, evidence, and aftermath presentation;
- campaign-to-battle and battle-to-campaign transitions.

### Wave 4 — Selected family extensions

Only after the shared pack works, add specific assets required by the first selected campaign families. No deterministic fixture or favored plot may redefine the common registry.

## Integration gaps that remain code work

Asset production alone does not solve these missing consumers:

- a general non-terrain derivative builder and manifest validator;
- a scalable monster and trainer atlas or bundle loader;
- explicit human-trainer battlefield and exploration rendering;
- additional authoritative monster content and abilities;
- RPG event media references and semantic asset resolution;
- scene, portrait, prop, map, inventory, quest, and encounter presentation in the RPG shell;
- screenshot journeys for all family states and responsive layouts.

Those are implementation requirements, not reasons to omit the assets from the registry.

## Relationship to open asset branches

PR #84 contains useful human-Master and core-pack corrections. PR #85 contains the campaign, lore, NPC, and product registry work.

They must not remain competing asset authorities. The human-trainer distinction, source-master rules, and useful core-pack definitions from PR #84 should be reconciled into the product-wide registry and implementation path. The product-wide registry controls sequencing and coverage.

## Governing rule

> Build Monster Master as a complete shared product system: terrain, props, player trainers, monsters, UI, scenes, effects, fallbacks, and later audio—then add selected campaign extensions without letting the latest plot discussion dictate the whole asset roadmap.
