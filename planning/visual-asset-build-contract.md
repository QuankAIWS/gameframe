# Visual Asset Build and Validation Contract

## Purpose

This document defines the reusable contract for creating, retaining, finding, promoting, and delivering visual assets across GameFrame. It applies to Checkers, Monster Master, RPG campaigns, later tactical themes, and any other GameFrame surface that introduces authored or generated images.

Image generation and artistic editing are creative source-production activities. They are not part of the canonical deterministic build. Repository automation begins from approved, cleaned, lossless masters.

The system has two related but distinct asset paths:

1. a durable generated-asset library used to retain candidates and reuse compatible art across campaigns; and
2. a deterministic repository build that promotes approved masters into reproducible browser-delivery assets.

## Pipeline boundary

The required boundary is:

```text
creative generation or acquisition
  -> durable candidate storage and cataloging
  -> review, reuse classification, and approval
  -> cleanup and lossless master
  -> committed manifest
  -> deterministic build
  -> automated validation
  -> browser integration
  -> curated screenshot inspection
```

The deterministic build may resize, crop, pad, composite, encode, and atlas approved source masters. It may not call an image-generation service, rely on an uncommitted cache, or modify the source masters in place.

## Generated-asset library

Every successful generation response should be retained before review. Generation is expensive and nondeterministic enough that a discarded candidate may later prove useful as a reference, variant, background element, or source for editing.

The runtime library should preserve three layers when applicable:

- the original model output exactly as returned;
- a normalized working master after approved cleanup;
- one or more small previews or thumbnails for search and review.

Objects are immutable and content-addressed. A new edit, cleanup pass, crop, or upscale creates a new object linked to its parent rather than overwriting the previous object. Exact duplicate bytes collapse to one stored object through the content hash.

Rejected candidates remain cataloged as rejected rather than silently disappearing. A future storage-retention policy may garbage-collect rejected raw candidates only through an explicit, auditable rule. Accepted library assets and promoted masters are durable by default.

### Catalog record

Each generated or acquired asset record should include:

- stable asset ID;
- immutable object key and content hash;
- parent asset IDs and derivation relationship;
- creation time and requesting campaign, encounter, or operator;
- generation provider, model identifier, model revision when exposed, and request ID when exposed;
- prompt-schema revision;
- complete prompt and negative prompt where supported;
- seed, dimensions, steps, guidance, quality, output format, and other material inference settings;
- hashes and roles of all reference images;
- declared subject, role, environment, material, style, era, biome, faction, and mood tags;
- intended camera, projection, direction, lighting, and transparency requirements;
- licensing, provider terms, provenance, and attribution notes;
- review state and review notes;
- reuse scope and compatibility notes;
- cleanup, crop, alpha, upscale, and compression history;
- aliases, superseded asset IDs, and promotion status.

### Generation recipe hash

A canonical generation recipe should be serialized and hashed from all inputs that can materially affect output, including:

- provider and model;
- prompt-schema revision;
- prompt and negative prompt;
- seed;
- dimensions and quality settings;
- steps, guidance, strength, and similar controls;
- ordered reference-image hashes and roles;
- output format;
- requested transparency or background policy.

An exact recipe-hash hit is a generation-cache hit: the system returns the retained result instead of paying to invoke the model again, unless regeneration is explicitly requested.

A content-hash hit is an exact duplicate-output hit: the catalog may create a new usage link, but it must not store the same bytes twice.

### Cache terminology

The system must distinguish three different mechanisms:

- **generation cache:** exact recipe-hash reuse that avoids another model invocation;
- **asset-library retrieval:** semantic or tagged discovery of an existing compatible asset, even when the prompt would not be identical;
- **delivery cache:** CDN or browser caching of already selected derivatives for fast client delivery.

Calling all three mechanisms “the cache” obscures cost, provenance, and invalidation behavior.

## Reuse policy

The library should prefer reuse before generation. Search should combine exact tags, structured filters, text search, and optional embeddings.

Reuse classes are:

1. **universal:** ordinary terrain and props that can cross campaigns when projection, lighting, and style are compatible;
2. **style-pack compatible:** reusable inside a declared visual family, such as grounded medieval fantasy, painterly high fantasy, or Clockwork Eclipse;
3. **campaign-specific:** recognizable locations, factions, heraldry, or modified assets whose identity belongs to one campaign;
4. **identity-locked:** named characters, unique monsters, plot objects, maps, and other assets that must not be silently reassigned.

An ordinary deciduous tree may be universal. An elven tree may be reusable in a non-elven forest only when its visible design does not communicate elven architecture, magic, symbols, or campaign-specific identity. The decision belongs in the asset record rather than being inferred anew on every request.

Reuse ranking should consider:

- requested asset role and dimensions;
- camera and projection compatibility;
- visual style and palette compatibility;
- biome, season, era, material, and faction;
- transparency and silhouette requirements;
- intended display size;
- prior in-product approval;
- campaign and identity restrictions.

The generation service should return an existing approved asset when it clears the configured compatibility threshold. Otherwise it may use the closest approved assets as references for a new generation or editing request.

## Runtime storage boundary

The generated-asset library is operational data and does not need every candidate committed to Git.

A typical deployment should use:

- object storage for original outputs, normalized masters, previews, and runtime derivatives;
- a queryable metadata store for catalog records, tags, hashes, relationships, usage history, and review state;
- optional vector search for semantic retrieval;
- a CDN-backed immutable URL for approved runtime delivery.

Object keys should include content hashes or immutable version IDs. Approved public responses should use long-lived cache headers because changing content receives a new URL rather than replacing bytes at an old URL.

Secrets, private campaign material, and operator-only candidates must not be exposed through the public delivery domain merely because they share the same object store.

## Promotion into the repository

Runtime-library acceptance and repository promotion are separate decisions.

An asset should be promoted into `art-source` when it becomes part of a versioned product surface, shared base pack, deterministic test fixture, or otherwise needs to ship and rebuild with the repository.

Promotion records:

- the source library asset ID and content hash;
- the approved lossless master;
- the exact cleanup lineage;
- the repository semantic ID;
- the manifest entry and integration mapping;
- the decision that moved the asset from runtime content into a versioned product asset.

Campaign-specific runtime assets may remain in object storage indefinitely without entering Git.

## Repository structure

Each versioned visual theme should use a structure equivalent to:

```text
art-source/<game>/<theme>/
  manifest.json
  masters/
  previews/

public/assets/<game>/<theme>/
  asset-build.json
  individual derivatives
  optional atlases
```

`art-source` contains source masters and review material. `public/assets` contains only files intended for browser delivery.

## Manifest requirements

The committed manifest is authoritative for production transforms. Each record must include:

- stable semantic ID;
- source path and source hash;
- source-library asset ID when applicable;
- role, faction, rank, and variant where applicable;
- approval state;
- source dimensions;
- target canvas and output dimensions;
- content bounds or aperture requirements;
- crop, centering, padding, and alpha policy;
- output path, format, and fixed encoder settings;
- optional atlas mapping;
- CSS, HTML, or renderer mapping;
- provenance and review notes.

Only explicitly approved entries may generate browser derivatives.

## Command contract

The repository implementation should provide:

```bash
npm run assets:check
npm run assets:build
npm run assets:verify
```

### `assets:check`

Read-only validation of source masters and manifest declarations:

- files exist and decode;
- dimensions and formats match declarations;
- alpha and aperture requirements hold;
- source hashes match;
- content bounds and tolerances are satisfied;
- every source and output is declared exactly once.

### `assets:build`

Deterministically recreate browser derivatives:

- clean the theme output directory;
- transform only approved source masters;
- use pinned tooling and fixed parameters;
- create individual optimized derivatives;
- create atlases only from normalized individual derivatives;
- emit `asset-build.json` with toolchain, input, and output hashes.

### `assets:verify`

Prove repository reproducibility:

- run source checks;
- build into a clean temporary output;
- compare generated files and build records with committed derivatives;
- fail on missing, extra, or byte-different output.

## Universal automated checks

Every asset must pass:

- successful decode;
- expected dimensions and format;
- stable semantic filename;
- nonempty meaningful content;
- manifest membership;
- recorded input and output hashes;
- no orphaned source or derivative;
- clean reproducible rebuild.

## Transparency checks

Transparent assets must pass:

- real alpha-channel presence;
- required transparent corner samples;
- no opaque generated background;
- no baked checkerboard-preview pattern;
- expected nontransparent bounds;
- declared padding tolerance;
- contamination detection outside intended bounds;
- halo and fringe analysis with explicit warning thresholds.

## Piece-family checks

Circular board-piece families must use:

- one canonical output canvas;
- one declared ordinary-piece visible diameter;
- a narrow tolerance across factions and ranks;
- a declared center tolerance;
- a declared circularity tolerance;
- transparent padding sufficient for procedural effects;
- king or status variants that do not materially enlarge the silhouette;
- generated review previews at intended display size and 2× display size.

## Board and frame checks

Board surfaces and frames must satisfy:

- exact aspect ratio and expected dimensions;
- exact grid divisibility for grid-based games;
- alignment with authoritative interaction geometry;
- centered and transparent frame aperture where required;
- no hallucinated labels, coordinates, or board squares in a frame;
- no frame overlap across playable cells;
- declared symmetry tolerance where applicable.

## Compression checks

Optimized derivatives must be compared against the lossless master at:

- native derivative size;
- intended display size;
- 2× intended display size.

Compression settings are fixed in the manifest. Material banding, alpha degradation, edge ringing, or loss of faction readability must trigger review even when the file decodes successfully.

## Browser and viewport checks

Asset validation precedes browser tests. Browser acceptance must then prove:

- assets load or fall back safely;
- semantic controls remain functional;
- hit areas remain aligned;
- board or Canvas geometry remains authoritative;
- desktop and narrow layouts do not overflow their declared viewport contract;
- reduced-motion mode remains legible;
- missing-asset behavior does not create a second action path or unusable interface.

## Visual-review boundary

Automated checks catch objective defects. They do not certify composition, taste, hierarchy, readability, or coherence.

A visual slice still requires deterministic screenshots and direct inspection for:

- scale and angle consistency;
- board/frame alignment;
- sprite-to-cell alignment;
- active-state contrast;
- text collisions;
- clipping and unused space;
- mobile hierarchy;
- theme coherence;
- color-blind distinguishability;
- downscaled asset quality.

## Toolchain policy

Any image-processing tool introduced into the repository must have:

- a concrete functional need;
- an exact pinned version;
- a committed lockfile update;
- compatible licensing and provenance review;
- a third-party notice when required;
- deterministic behavior in local and canonical environments.

Public GameFrame workflows remain GitHub-hosted. Expensive image generation must not run in canonical validation.

## Validation order

For visual branches, the expected order is:

1. source and manifest checks;
2. derivative build;
3. clean reproducibility verification;
4. browser syntax and presentation contracts;
5. focused interaction journeys;
6. viewport and accessibility assertions;
7. curated visual capture;
8. human or agent screenshot inspection;
9. full local validation;
10. frozen exact-head canonical validation and visual review.

## Completion evidence

A completed visual slice records:

- source-library IDs and generation provenance when applicable;
- exact source and manifest revision;
- image-processing toolchain versions;
- clean asset-build result;
- automated check result;
- focused browser and viewport result;
- exact repository head;
- canonical run when required;
- curated screenshot artifact;
- inspection findings and remaining limitations.
