---
title: RPG Rendering and Asset Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master Arena Battles
  - Monster Master RPG
  - generated campaign presentation
shared_document_id: rpg-rendering-and-asset-contract-v1
shared_document_version: 1
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-rendering-and-asset-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-rendering-and-asset-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-monster-master-reference-campaign.md
  - rpg-platform-product-goals.md
  - ../rpg-gameframe-interface-contract.md
  - ../tactical-battler-rpg-foundation.md
  - ../rpg-platform-delivery-plan.md
---

# RPG Rendering and Asset Contract

## Decision

Monster Master is the reference campaign and first production consumer of the reusable GameFrame RPG presentation engine.

The engine is not a separate speculative rewrite that must exist before Monster Master can improve. Reusable rendering, asset, interaction, and campaign-presentation capabilities are extracted from concrete Monster Master requirements as they become proven. Monster Master-specific names, balance, creatures, maps, and art remain content. Projection, scene composition, asset manifests, terrain geometry, entity presentation, effects, loading, fallback, and validation become engine capabilities.

This document is the canonical contract for:

- what the GameFrame RPG renderer must support;
- how bespoke Monster Master assets are authored and integrated;
- how future generative campaigns request and receive compatible assets;
- which geometry and metadata are authoritative;
- which responsibilities belong to GameFrame versus RPG GM Runtime;
- how generated source art becomes deterministic runtime-ready derivatives;
- what evidence is required before an asset family or rendering feature is accepted.

## Ownership boundary

### GameFrame owns

GameFrame owns all player-visible presentation implementation, including:

- renderer selection and initialization;
- camera, projection, picking, occlusion, depth order, and culling;
- world, entity, effect, overlay, and interface layers;
- runtime asset schemas and manifest validation;
- asset loading, caching, decoding, fallback, and disposal;
- deterministic derivative production;
- texture atlases, spritesheets, meshes, masks, anchors, pivots, and scale rules;
- theme-pack interpretation and presentation recipes;
- provider-neutral prompt compilation for art that must fit renderer contracts;
- artifact provenance and moderation status;
- screenshot journeys and geometry validation;
- browser, mobile, Discord Activity, and reduced-motion behavior.

### RPG GM Runtime owns

RPG GM Runtime owns campaign meaning and requests presentation semantically. It may describe:

- entity identity and continuity;
- scene meaning and narrative priority;
- terrain family and biome intent;
- required encounter roles;
- mood, weather, time, damage state, and story significance;
- urgency and whether play may proceed with a fallback;
- continuity references to previously accepted assets.

The runtime does not specify Pixi classes, UV coordinates, atlas positions, filesystem paths, provider credentials, canvas dimensions, or executable rendering instructions.

## Product model

The intended product relationship is:

```text
GameFrame RPG presentation engine
  reusable renderer, UI, asset contracts, effects, campaign scene shell

Monster Master content family
  Arena Battles rules and maps
  Monster Master RPG campaign content
  bespoke creatures, terrain, props, effects, portraits, UI identity

future campaign content families
  prepared theme packs
  deterministic compositions
  campaign-specific generated assets
```

Monster Master is therefore both:

1. a finished game and campaign family that must retain its own identity; and
2. the proving ground from which reusable RPG presentation infrastructure is extracted.

A reusable system is accepted only after it serves a concrete Monster Master or campaign requirement without weakening the current product.

## Renderer architecture

### Required renderer layers

The production presentation must distinguish at least these semantic layers:

1. continuous environment ground;
2. terrain surfaces, elevation faces, and world props;
3. legal-action and targeting indicators;
4. creatures, NPCs, player avatars, and interactive entities;
5. world-space effects and transient decals;
6. hover, selection, path, and inspection feedback;
7. geometry diagnostics available only in development;
8. HTML/CSS interface overlays, menus, cards, drawers, logs, and accessibility surfaces.

The exact scene graph may evolve, but world objects that can occlude one another must participate in one coherent depth model. A second DOM or Canvas layer must not approximate terrain faces above an unrelated Pixi world.

### Renderer roles

- **PixiJS/WebGL** is the enhanced tactical and campaign-world renderer for sprite-rich 2D scenes, camera movement, compositing, particles, masks, and custom geometry.
- **Canvas 2D** remains a compatibility path and a valid renderer for compact exact-geometry games. It is not a parallel hidden authority while Pixi is active.
- **HTML/CSS** owns semantic controls, text, menus, cards, drawers, logs, forms, accessibility, and responsive layout.
- **SVG** is appropriate for scalable icons, simple ornaments, masks, geometry prototypes, and low-complexity vector assets.
- **Raster textures** are appropriate for authored or generated creatures, portraits, environmental materials, props, backgrounds, effects, and tactile surface treatment.
- **Three.js or another 3D engine** is not introduced merely to improve 2D art. It requires a reviewed need for real 3D geometry, lighting, or camera behavior.

### Pixi implementation principles

The RPG renderer follows current PixiJS 8 practices:

- use one scene graph as the render authority;
- use child order, `zIndex`, sortable containers, or RenderLayers deliberately;
- use sprites and spritesheets for ordinary repeated image rendering;
- use Graphics for exact procedural geometry and diagnostics;
- use meshes when custom geometry or UV mapping is required;
- use asset manifests and bundles for scalable contextual loading;
- load through `Assets` so decoding and caching remain centralized;
- render on demand when the scene is otherwise static;
- reserve permanent tickers for actual ongoing animation;
- cap device resolution according to product evidence;
- keep logical world and picking coordinates independent of device-pixel resolution.

Reference documentation:

- https://pixijs.com/8.x/guides/concepts/scene-graph
- https://pixijs.com/8.x/guides/concepts/render-layers
- https://pixijs.com/8.x/guides/components/assets/manifest
- https://pixijs.com/8.x/guides/components/scene-objects/mesh
- https://pixijs.com/8.x/guides/components/scene-objects/tiling-sprite

## Authoritative tactical geometry

### Current Monster Master projection

The current tactical renderer uses a square logical grid projected into isometric diamonds:

```text
tile width: 72 CSS pixels
tile height: 36 CSS pixels
tile half-width: 36 CSS pixels
tile half-height: 18 CSS pixels
wall visual height: 29 CSS pixels
```

These dimensions are renderer contracts, not suggestions to be approximated independently by every asset or overlay.

### Single geometry source

Projection, inverse projection, rotation, screen-vector conversion, top-face polygons, elevation faces, map aprons, depth keys, hover geometry, legal indicators, and development diagnostics must derive from one shared geometry module.

Forbidden duplication includes:

- separate `TILE_WIDTH` or `TILE_HEIGHT` constants in the input bridge;
- independent camera projection in an effects script;
- separately tuned Canvas cliff polygons;
- terrain sprite scale multipliers that do not match the playable polygon;
- picking tolerances based on a different tile shape than the rendered top face.

### Terrain height

Visual height and gameplay elevation are separate concepts.

The current `wall` cell is impassable and receives a renderer-owned fixed visual height. Units do not stand on it, and this visual treatment does not silently add new movement, range, or line-of-sight rules.

A future mechanical elevation feature must add explicit authoritative state and tests. It must not infer gameplay elevation from pixels, filenames, generated art, or renderer-only metadata.

### Ground and boundaries

Ordinary ground is a continuous environmental surface rather than hundreds of individually stretched floor stamps.

The renderer must support:

- a continuous base ground plane;
- a visual apron beyond the playable map;
- an explicit playable boundary that does not look like the end of the world;
- exact-cell overlays for difficult ground, objectives, hazards, or biome transitions;
- terrain edge treatments and props without changing hit geometry;
- camera rotations without geometry drift.

### Occlusion and depth order

Terrain, units, props, and world effects that can overlap must share one coherent depth order based on their projected ground anchors and explicit bias rules.

The renderer must correctly show:

- a unit behind a raised wall;
- a unit in front of a raised wall;
- joined walls without internal faces;
- exposed wall faces only where adjacent terrain is lower;
- health bars and UI that intentionally remain readable;
- hover and legal markers on the exact authoritative surface.

## Asset families

The RPG presentation engine must eventually support these versioned families:

### Environment

- seamless or repeatable ground materials;
- terrain top materials;
- cliff and elevation-face materials;
- difficult-ground overlays;
- roads, paths, water, shorelines, snow, mud, ash, and biome transitions;
- boundary skirts and off-map environmental continuation;
- props, foliage, rocks, structures, doors, cover, hazards, and objectives;
- scene backgrounds for non-tactical campaign presentation.

### Entities

- battlefield sprites or illustrated cutouts;
- portraits and dialogue portraits;
- silhouettes and fallback markers;
- directional or mirrored presentation metadata;
- idle, move, attack, ability, damage, defeat, and interaction states;
- shadow, foot-anchor, scale, and occlusion metadata;
- faction or ownership treatments that remain separate from source art.

### Effects

- movement trails;
- attacks, projectiles, impacts, healing, status, defeat, and environmental effects;
- decals and persistent encounter marks;
- particles and procedural overlays;
- reduced-motion alternatives;
- deterministic timing metadata tied to authoritative effects.

### Interface

- game and campaign identity marks;
- card frames, panels, tabs, buttons, dividers, ornaments, and icon families;
- item, quest, faction, ability, and handout presentation;
- theme-specific UI materials that preserve semantic HTML and accessibility;
- loading, unavailable, reconnect, fallback, victory, defeat, and draw states.

## Source-master and runtime-derivative model

Generated or manually authored art is source material. It is not automatically a runtime asset.

Every accepted asset family separates:

### Source masters

- high-resolution editable or lossless originals;
- generation prompt and provider metadata when applicable;
- seed or reproducibility metadata when available;
- continuity and reference inputs;
- review notes and rejection history;
- copyright, license, and provenance status;
- no requirement to match final atlas dimensions.

### Runtime derivatives

- normalized crop and transparent bounds;
- exact anchor and pivot;
- deterministic scale target;
- approved color-space and alpha treatment;
- PNG where losslessness or alpha-edge inspection is required;
- WebP or AVIF where browser delivery benefits justify it;
- spritesheet or atlas frames with bleed and gutters;
- optional low-resolution and fallback derivatives;
- stable hashes and manifest entries.

Source masters remain retained so future engines, resolutions, art corrections, and derivative formats do not require regeneration.

## Terrain generation blueprint

### Generate material masters, not fake final screenshots

For terrain intended for the tactical renderer, generation should normally produce orthographic square material masters rather than an already-isometric tile floating in a scene.

Initial Monster Master terrain pilot assets:

1. grassland ground material;
2. raised rock or earth top material;
3. rock or earth cliff-face material.

Recommended source-master dimensions:

- 1024×1024 or 1536×1536 for square material masters;
- 1024×512 or larger for directional cliff-face studies;
- lossless retained master plus normalized working derivative.

The renderer or deterministic asset build maps these materials into exact top and side geometry. The generated image does not define the tile polygon.

### Prompt invariants for terrain

A terrain request must specify:

- semantic role;
- material family;
- biome and weather state;
- lighting direction and softness;
- texture scale at intended display size;
- whether the source must tile seamlessly;
- allowed landmark density;
- palette relationship to the theme pack;
- alpha requirement;
- forbidden borders, fake grids, text, scenery, and baked selection indicators;
- intended relationship to top, side, transition, or decal geometry.

### Terrain rejection conditions

Reject or repair terrain that contains:

- a visible square boundary where continuity is required;
- baked isometric geometry that conflicts with renderer geometry;
- large centered landmarks that reveal repetition;
- perspective convergence in a material master;
- baked shadows inconsistent with the campaign light direction;
- tiny high-frequency AI noise that collapses at runtime size;
- arbitrary transparent padding;
- inconsistent top and cliff material identity;
- franchise-specific copied scenery or symbols;
- selection borders, health indicators, labels, or grid lines.

## Entity generation blueprint

Each generated creature, NPC, monster, or prop request must specify:

- semantic entity and continuity ID;
- presentation role and intended display size;
- view or camera convention;
- pose and silhouette requirement;
- foot or contact point;
- empty-space and crop constraints;
- lighting direction;
- palette relationship;
- required alpha background;
- mirror safety or required directional variants;
- allowed and forbidden accessories;
- relationship to previously accepted references;
- required state or animation role.

Generated battlefield entities should normally be created individually at high resolution, then cleaned and normalized. Do not generate a low-resolution production atlas as the only source.

Monster Master retains its specific visual profile:

- late-1990s hand-illustrated creature-battling PC character;
- expressive readable silhouettes;
- restrained palettes;
- painted, cel, inked, scanned, or gouache-like surface quality;
- modest purposeful animation;
- no generic glossy toy rendering;
- no uncontrolled AI spikes, armor clutter, or microdetail;
- no direct imitation of protected franchise creatures.

## Runtime asset manifest

A production RPG asset pack must be machine-readable and versioned. The exact schema may evolve, but it must represent these concepts:

```ts
type RpgAssetPackManifestV1 = {
  protocolVersion: 1;
  assetPackId: string;
  assetPackVersion: number;
  themePackId: string;
  compatibility: {
    minimumRendererVersion: string;
    geometryProfile: string;
  };
  bundles: Array<{
    bundleId: string;
    loadPolicy: "boot" | "scene" | "encounter" | "background";
    assets: Array<{
      assetId: string;
      semanticRole: string;
      source: string;
      mediaType: string;
      hash: string;
      width?: number;
      height?: number;
      frame?: { x: number; y: number; width: number; height: number };
      anchor?: { x: number; y: number };
      pivot?: { x: number; y: number };
      scaleProfile?: string;
      geometryRole?: string;
      continuityRef?: string;
      fallbackAssetId?: string;
      provenanceRef: string;
    }>;
  }>;
};
```

Required manifest properties:

- stable asset IDs independent of filenames;
- explicit pack and protocol versions;
- renderer compatibility;
- semantic roles;
- dimensions, frames, anchors, and pivots where applicable;
- load bundles and urgency;
- hashes for cache identity and integrity;
- fallbacks;
- provenance references;
- no secrets or provider credentials.

Pixi asset manifests may be generated from the canonical GameFrame asset-pack manifest. The canonical campaign manifest remains provider- and renderer-contract aware rather than being only an arbitrary file list.

## Loading and fallback

Campaign play must not block indefinitely on optional generated art.

The renderer must support:

- boot-critical bundles;
- encounter-critical bundles;
- background-preloaded bundles;
- deterministic placeholders;
- substitution with genre or theme catalog assets;
- retry without duplicating accepted assets;
- asset failure isolated from authoritative campaign state;
- transition from fallback to accepted generated art at a safe presentation boundary;
- caching keyed by stable asset identity and content hash;
- explicit unavailable state when a critical asset truly cannot be represented.

Narrative play may begin while later scene or encounter assets are being prepared. Tactical play may begin only when its required gameplay-readable bundle or an approved readable fallback is present.

## Generation and integration lifecycle

Every generated asset follows this lifecycle:

1. semantic request created;
2. catalog search;
3. deterministic composition attempt;
4. provider-neutral production specification compiled;
5. source generated or authored;
6. source retained with provenance;
7. visual and policy review;
8. crop, mask, edge cleanup, and normalization;
9. runtime derivatives built;
10. manifest updated;
11. renderer integration tested;
12. desktop, mobile, and Discord-safe screenshots inspected;
13. accepted version published to the asset catalog;
14. rejected or superseded versions retained or disposed according to provenance policy.

Regeneration is not the default response to every defect. Crop, mask, recolor, edge cleanup, scale correction, deterministic overlays, or separation into layers should be attempted when the source is otherwise useful.

## Validation requirements

### Geometry validation

The repository must be able to expose a development-only geometry view that shows:

- authoritative cell polygons;
- terrain top polygons;
- exposed elevation faces;
- unit ground anchors;
- picked coordinates;
- playable boundary and visual apron;
- depth keys or equivalent ordering evidence.

Tests must verify exact geometry numerically. A screenshot existing is not proof of alignment.

### Visual matrix

For each terrain or world-asset change, inspect:

- all four camera rotations;
- minimum, normal, and maximum zoom;
- isolated raised terrain;
- joined wall or elevation lines;
- corners and enclosed cells;
- unit behind terrain;
- unit in front of terrain;
- legal marker beside terrain;
- playable boundary and visual apron;
- desktop;
- short desktop;
- mobile;
- Discord Activity-safe layout;
- reduced-motion behavior when animation changes.

### Asset acceptance

An asset is not accepted merely because it is attractive at source resolution. It must:

- preserve the intended silhouette or material at runtime size;
- align with authoritative geometry;
- have clean alpha and crop behavior;
- remain consistent with sibling assets;
- avoid obvious repetition or seams;
- support game-state readability;
- avoid copied franchise identity;
- have provenance and manifest metadata;
- survive actual screenshot inspection.

## Anti-demo-itis rule

The RPG engine is a product surface, not a renderer showcase.

Do not expose:

- debug geometry outside development mode;
- renderer names or technical validation copy to players;
- test labels, demo controls, or workflow language;
- placeholder panels that consume permanent space;
- generic AI-dashboard styling unrelated to the campaign;
- duplicate state explanations in multiple overlays;
- asset-generation progress as a blocking technical modal when a readable fallback exists.

Engine capability should be experienced through a coherent campaign, not announced through implementation residue.

## Slice sequence

### Slice 1 — Terrain geometry foundation

- create one shared projection and terrain-geometry module;
- make the Pixi renderer and input bridge consume that authority;
- remove the separate Canvas terrain-depth layer;
- render raised wall tops and exposed faces inside Pixi;
- interleave terrain and units through one depth-sorted world container;
- replace repeated floor stamps with a continuous ground plane;
- extend a visual apron beyond playable cells;
- add development geometry diagnostics and numerical tests.

### Slice 2 — Monster Master three-asset terrain pilot

- create grassland ground, wall-top, and wall-face source masters;
- clean and normalize them;
- build exact runtime derivatives;
- add asset-pack manifest metadata;
- integrate them without changing tactical geometry;
- inspect the full visual matrix.

### Slice 3 — Reusable environment pack

- add controlled ground variation;
- add difficult-ground treatment;
- add wall-top and cliff-face variants;
- add decals, props, and objective presentation;
- establish biome and transition recipes;
- extract the reusable asset-pack build contract.

### Slice 4 — Campaign generation path

- connect semantic campaign requests to catalogs and production specifications;
- produce prepared alternate-theme packs;
- prove fallback-to-generated replacement;
- validate continuity across scenes and encounters;
- only then permit routine theme-on-demand generation.

## Change-control rule

A renderer or asset-pipeline change that alters any of the following must update this document or explicitly supersede the relevant contract:

- tile geometry or projection;
- visual-height rules;
- depth or occlusion model;
- required asset-family metadata;
- source-master conventions;
- runtime manifest compatibility;
- ownership between GameFrame and RPG GM Runtime;
- fallback and blocking behavior;
- acceptance evidence.

Temporary branch notes and prompts do not override this contract.
