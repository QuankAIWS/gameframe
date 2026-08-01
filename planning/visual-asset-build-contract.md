# Visual Asset Build and Validation Contract

## Purpose

This document defines the reusable repository contract for converting approved visual source material into deterministic browser-delivery assets. It applies to Checkers, Monster Master, later tactical themes, and any other GameFrame surface that introduces authored images.

Image generation and artistic editing are creative source-production activities. They are not part of the canonical deterministic build. Repository automation begins from approved, cleaned, lossless masters.

## Pipeline boundary

The required boundary is:

```text
creative generation or acquisition
  -> review and approval
  -> cleanup and lossless master
  -> committed manifest
  -> deterministic build
  -> automated validation
  -> browser integration
  -> curated screenshot inspection
```

The deterministic build may resize, crop, pad, composite, encode, and atlas approved source masters. It may not call an image-generation service, rely on an uncommitted cache, or modify the source masters in place.

## Repository structure

Each visual theme should use a structure equivalent to:

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

- exact source and manifest revision;
- image-processing toolchain versions;
- clean asset-build result;
- automated check result;
- focused browser and viewport result;
- exact repository head;
- canonical run when required;
- curated screenshot artifact;
- inspection findings and remaining limitations.
