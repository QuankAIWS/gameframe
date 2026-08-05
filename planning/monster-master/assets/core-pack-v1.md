# Monster Master Core Asset Pack v1

## Status

Production infrastructure active. Source-master replacement work has not yet been accepted.

## Purpose

`monster-master-core-v1` is the first prepared, versioned Monster Master asset pack used by Monster Master: Arena Battles and the Monster Master RPG.

It extends the accepted grassland terrain pilot without replacing its geometry, manifests, source masters, or deterministic transforms.

The pack must remain playable without live image generation. Optional future generated campaign art may extend the pack, but it may not become a dependency for ordinary Arena Battles or the prepared RPG foundation.

## Identity model

The pack uses four distinct semantic families.

### Trainers

Human Masters, rivals, mentors, and other human characters.

A Master is the person commanding and calling monsters into battle. Trainer artwork must never be registered as a monster species.

### Monsters

Creatures controlled or called by a trainer.

The current rules roster contains Stone Bulwark and Emberling Skirmisher. Their existing 96-pixel atlas frames are low-resolution pilot material and must be replaced. They may remain available only as explicit legacy fallbacks until reviewed source masters and deterministic derivatives are integrated.

The existing rules content ID `warden-master-v1` is a compatibility artifact for the human trainer. It does not establish a creature called Warden Master. A later rules migration may replace that internal combat model; this asset slice does not silently change authority or balance.

### Summoning and combat effects

Call-in glyphs, arrival bursts, movement accents, attacks, impacts, healing, damage, defeat, and reduced-motion alternatives.

### Environment and interface

Accepted terrain materials, future props, objectives, trainer and monster cards, faction treatments, ability icons, and outcome presentation.

## Pack identifier

- Pack ID: `monster-master-core-v1`
- Theme pack ID: `monster-master-verdant-caldera-v1`
- Manifest: `public/assets/monster-master/packs/core-v1/manifest.json`
- Manifest schema: version 1
- Geometry profile: `monster-master-isometric-72x36-wall29-v1`
- Minimum renderer: current GameFrame PixiJS 8 presentation contract

## Implemented infrastructure

The pack now has a real production boundary:

- a versioned pack manifest;
- explicit `trainer` and `monster` family separation;
- stable continuity references and replacement targets;
- low-resolution atlas entries marked `legacy-fallback` rather than accepted art;
- a browser-side manifest validator and resolver;
- compatibility-role fallback for the current rules model;
- deterministic Sharp build and verification tooling;
- source and runtime dimension checks;
- source and runtime SHA-256 checks;
- byte-for-byte derivative reproducibility checks;
- unit tests for identity, replacement targets, fallbacks, and legacy frame geometry;
- integration into the repository's normal asset build, verification, and syntax gates.

This deliberately reuses the accepted terrain pipeline's retained-master, deterministic-derivative, manifest, hash, and verification model.

## Current legacy entries

### Human trainer compatibility frame

- Rules content ID: `warden-master-v1`
- Family: `trainer`
- Status: `legacy-fallback`
- Replacement target: `trainer-default-master-v1-battlefield`
- Current display height: 94 CSS pixels

### Stone Bulwark

- Rules content ID: `stone-bulwark-v1`
- Family: `monster`
- Status: `legacy-fallback`
- Replacement target: `monster-stone-bulwark-v2-battlefield`
- Current display height: 104 CSS pixels

### Emberling Skirmisher

- Rules content ID: `emberling-skirmisher-v1`
- Family: `monster`
- Status: `legacy-fallback`
- Replacement target: `monster-emberling-skirmisher-v2-battlefield`
- Current display height: 82 CSS pixels

No current unit frame is accepted as final core-pack art.

## Visual direction

The controlling character is late-1990s and early-2000s illustrated creature-battling PC art:

- expressive, readable silhouettes;
- painted, cel-inked, scanned, or gouache-like surface treatment;
- restrained but distinct palettes;
- deliberate shape language readable at battlefield scale;
- modest purposeful animation;
- no generic glossy toy rendering;
- no uncontrolled spikes, armor clutter, microdetail, or franchise imitation.

The current battlefield uses a rotatable 2:1 pseudo-isometric projection. Individual battlefield cutouts must use a consistent elevated three-quarter view, stable ground contact, and mirror-safe composition unless a directional family is explicitly commissioned.

## Required production families

### A. Human trainer base family

1. default human Master battlefield cutout;
2. default human Master dialogue portrait;
3. default human Master roster-card portrait;
4. trainer silhouette fallback;
5. trainer ground-shadow or procedural shadow profile.

### B. Monster replacement family

Stone Bulwark and Emberling Skirmisher must each receive:

1. retained high-resolution battlefield source master;
2. normalized transparent battlefield derivative;
3. compact portrait;
4. roster icon;
5. silhouette fallback;
6. movement presentation;
7. basic attack or projectile presentation;
8. damage-state treatment;
9. defeat-state treatment;
10. summon/deployment treatment;
11. anchor, scale, shadow, and mirror or direction metadata.

Every later monster must enter through the same family contract. No new monster is added as a loose one-off picture.

### C. Summoning family

1. neutral call-in ground glyph;
2. trainer-team color treatment applied procedurally;
3. arrival column or burst;
4. monster reveal accent by family;
5. reduced-motion dissolve or flash alternative.

### D. Existing terrain family

The accepted v1 materials remain part of the pack:

- continuous grass ground;
- grassland-stone raised barrier cap;
- grassland-stone cliff face.

Future terrain work may add difficult-ground overlays, paths, objectives, props, transitions, and off-map dressing. It must not reintroduce baked tile geometry.

## Source and derivative strategy

Each important trainer or monster is authored or generated individually as a retained source master.

Recommended source masters:

- battlefield cutout: 2048 × 2048 transparent PNG minimum;
- dialogue portrait: 1536 × 1536 or larger transparent or controlled-background PNG;
- effect master: 1024 × 1024 transparent PNG or deterministic vector/procedural recipe;
- silhouettes and ownership rings: deterministic SVG or procedural rendering where practical.

Expected initial runtime derivatives:

- battlefield cutout: 512 × 512 lossless WebP or PNG after alpha review;
- compact battlefield fallback: 256 × 256;
- portrait: 512 × 512;
- roster portrait: 256 × 256;
- effects: 256 × 256 or spritesheet frames as renderer evidence requires.

Exact dimensions may change after the first live scale study. The committed source master remains retained.

## Repository structure

```text
public/assets/monster-master/packs/core-v1/manifest.json
public/assets/monster-master/trainers/<trainer-id>/source/
public/assets/monster-master/trainers/<trainer-id>/battlefield/
public/assets/monster-master/trainers/<trainer-id>/portraits/
public/assets/monster-master/monsters/<monster-id>/source/
public/assets/monster-master/monsters/<monster-id>/battlefield/
public/assets/monster-master/monsters/<monster-id>/portraits/
public/assets/monster-master/effects/summon/
public/assets/monster-master/fallbacks/
planning/monster-master/assets/<asset-record>.md
```

Runtime paths are created only when accepted derivatives exist. Planning records do not create empty runtime placeholders.

## Manifest requirements for an accepted replacement

Every accepted entry records:

- stable asset ID and semantic role;
- source-master and runtime paths;
- media type, dimensions, and SHA-256;
- deterministic transform tool and version;
- anchor, pivot, scale, and optional frame metadata;
- trainer, monster, effect, environment, or interface family;
- continuity reference;
- fallback asset ID or legacy frame;
- load policy;
- provenance record;
- mirror safety and facing metadata;
- replacement or supersession relationship.

Ownership tint, selection, health, legal targets, and team identity remain procedural unless a reviewed rendered treatment materially improves the product.

## Production order

1. keep the core-pack manifest, validator, tests, and deterministic build/verify tooling green;
2. audit the existing core visual system and accepted terrain before replacing anything that already works;
3. prepare and approve the default human Master battlefield source under `default-master-trainer-v1.md`;
4. integrate the pack resolver into the Pixi unit renderer while retaining legacy fallback behavior;
5. replace Stone Bulwark from retained source master through live screenshot approval;
6. replace Emberling Skirmisher through the same pipeline;
7. complete portrait, roster, movement, attack, damage, defeat, and summon coverage for both monsters;
8. add deterministic trainer and monster silhouettes and fallbacks;
9. add the shared summoning effect family;
10. inspect desktop, mobile, all camera rotations, selection, damage, defeat, and summon states;
11. only then begin additional monster species and expanded environment families.

## Validation boundary

This pack changes presentation only. It must not silently change:

- the current authoritative roster;
- health, movement, initiative, range, or damage;
- deployment or activation order;
- legal actions or command energy;
- victory, draw, replay, persistence, identity, or invitation behavior.

The mismatch between the human-Master product model and the current compatibility-era `master` combat unit must be handled through explicit later rules work, not hidden inside an asset manifest.
