# Clockwork Eclipse Checkers Visual Pipeline

## Status

- Selected theme: `Clockwork Eclipse`
- Target game: `american-checkers`
- Foundation: PR #39 head `7e079bdfc6d847661e18e147522a459d6998e5a4`
- Current phase: documentation and production-contract definition
- Runtime and rules impact: none

This document defines the repository-side production contract for replacing the current premium Checkers experiment with a reproducible, full-viewport, asset-assisted presentation. It does not change Checkers rules, legal actions, authoritative state, identity, invitations, HTTP commands, WebSocket projections, replay, or persistence.

## Visual direction

Clockwork Eclipse presents American Checkers as a celestial mechanical contest between solar and lunar factions.

### Solar faction

- Antique brass and warm gold
- Auburn or crimson enamel
- Sun-disc and radiant orbital motifs
- Bright but controlled highlight response

### Lunar faction

- Dark blued steel and obsidian enamel
- Silver crescent or eclipse motifs
- Restrained brass clockwork detail
- Cool material response distinct from the solar faction at small size

### Kings

Kings remain in the same piece family and use the same canonical visible diameter as ordinary pieces. Rank is communicated with an integrated crown, royal eclipse halo, or similarly compact overlay. A king may not become larger merely because its emblem extends farther.

### Board and frame

- Exact 8×8 board geometry remains the real interactive DOM grid.
- Light squares use pale brushed ivory or parchment-wood treatment.
- Dark squares use deep astronomical material with restrained brass astrolabe engraving.
- The board frame uses blued steel, antique brass, eclipse motifs, and orbital corner ornament.
- The frame center is a clean transparent aperture and may not cover playable cells.

### Interface furniture

Status cards, counters, captured-piece reservoirs, controls, and decorative instrument panels should be constructed primarily with semantic HTML and CSS. Generated art is reserved for elements whose material detail materially improves the result.

## Authority boundary

The visual implementation may observe and reorganize existing presentation data. It must not:

- import or duplicate Checkers rules;
- infer legal actions independently;
- create a second action endpoint;
- intercept or replace authoritative fetches;
- mutate match state outside the existing application boundary;
- replace semantic buttons with inaccessible image-only controls;
- treat animation state as authoritative state.

Existing stable IDs, legal-action data, revision behavior, resume behavior, invitation behavior, and diagnostics remain part of the compatibility surface.

## Full-viewport shell contract

The finished active-match presentation is a first-class full-viewport shell, not an indefinitely expanding decoration layer over a vertically flowing page.

### Declared viewport targets

- Desktop review: 1440×960
- Short desktop review: 1366×768
- Narrow or Discord-style review: 390×844
- Minimum implementation target: 320×568, with secondary information reduced to disclosures or drawers

### Active-match requirements

- The active shell occupies `100dvh`.
- Document-level horizontal and vertical gameplay scrolling are disabled.
- The board remains the dominant region.
- Desktop player and information rails remain inside the viewport.
- Only explicitly bounded subregions may scroll.
- Narrow layouts convert secondary information to dismissible overlays, drawers, or compact disclosures.
- Essential controls remain accessible with mobile browser chrome, safe-area insets, and ordinary browser zoom.
- Reduced-motion mode retains complete state legibility without relying on animation.

### Browser assertions

The focused browser suite must assert, at every declared active-match viewport:

- `document.documentElement.scrollWidth <= window.innerWidth + 1`;
- `document.documentElement.scrollHeight <= window.innerHeight + 1`;
- board bounds remain inside the viewport;
- essential action and setup controls remain inside the viewport;
- drawers and overlays expose correct accessible state;
- Escape closes dismissible narrow-layout panels where applicable.

Viewport screenshots are the primary composition evidence. Full-page screenshots remain a diagnostic tool for accidental overflow.

## Repository asset layout

The intended layout is:

```text
art-source/checkers/clockwork-eclipse/
  manifest.json
  masters/
    piece-lunar.png
    piece-solar.png
    piece-lunar-king.png
    piece-solar-king.png
    board-surface.png
    board-frame.png
    ...future approved masters

public/assets/checkers/clockwork-eclipse/
  piece-lunar.webp
  piece-solar.webp
  piece-lunar-king.webp
  piece-solar-king.webp
  board-surface.webp
  board-frame.webp
  asset-build.json
  ...future derivatives
```

Lossless masters are source material. Browser-delivery files are deterministic derivatives. Generated derivatives must not be edited by hand.

## Manifest contract

`art-source/checkers/clockwork-eclipse/manifest.json` is the source of truth for production transformation and integration mapping.

Each asset record must declare:

- stable semantic ID;
- source-master path;
- source hash;
- role and faction;
- approval state;
- source dimensions;
- normalized canvas dimensions;
- visible-content bounds;
- canonical visible diameter, board area, or frame aperture;
- crop and padding policy;
- alpha requirement;
- output path, format, dimensions, and encoder settings;
- optional atlas coordinates;
- CSS class, CSS variable, or renderer mapping;
- provenance notes.

Only assets with an explicit approved state may be emitted into the browser-delivery directory.

## Reproducible asset-build stage

Image generation is not part of the deterministic repository build. The build begins after creative sources have been approved and cleaned.

The required pipeline is:

```text
approved generated source
  -> cleaned lossless master
  -> manifest entry
  -> deterministic normalization
  -> optimized individual derivative
  -> optional atlas
  -> verification
```

### Commands

The implementation should expose:

```bash
npm run assets:check
npm run assets:build
npm run assets:verify
```

- `assets:check` validates source masters and manifest declarations without changing files.
- `assets:build` recreates browser derivatives from approved masters and a committed manifest.
- `assets:verify` performs a clean rebuild and fails if committed derivatives or recorded hashes differ.

### Determinism requirements

The build must:

- clean and recreate its output directory;
- use fixed, pinned image-processing versions;
- use fixed crop, resize, alpha, and encoder parameters;
- avoid workstation-local caches;
- avoid calls to any image-generation service;
- avoid silently modifying source masters;
- emit `asset-build.json` with input, toolchain, and output hashes;
- produce byte-identical derivatives when the toolchain and inputs are unchanged.

Any new image dependency requires a concrete need, exact version pinning, lockfile update, provenance review, and third-party notice when applicable.

## Automated image checks

Objective image checks run before browser integration tests. They complement, but do not replace, screenshot inspection.

### Universal checks

- Every declared file decodes successfully.
- Format and dimensions match the manifest.
- Stable filenames and output paths match the manifest.
- Meaningful visible content exists.
- Every derivative has a recorded output hash.
- No undeclared or orphaned derivative remains in the output directory.
- A clean rebuild produces no unexpected file diff.

### Transparency checks

For pieces, frames, overlays, and decorative furniture:

- A real alpha channel exists.
- Required corner pixels are transparent.
- A baked checkerboard preview or opaque generated background is rejected.
- Nontransparent content bounds are calculated.
- Padding conforms to the manifest.
- Isolated semi-transparent contamination outside the intended silhouette is rejected or warned.
- Excessive edge halos and fringe pixels produce a review warning.

### Piece-family checks

- All pieces use one canonical output canvas.
- Solar, lunar, ordinary, and king visible diameters remain within the declared tolerance.
- Visual centers remain within the declared center tolerance.
- Circular silhouettes remain within the declared circularity tolerance.
- Kings do not materially exceed ordinary-piece diameter.
- Transparent padding remains available for procedural selection and legal-action effects.
- Downscaled previews are generated at intended board size for human comparison.

### Board and frame checks

- Board dimensions divide exactly into an 8×8 grid.
- Board square boundaries align with the DOM interaction grid.
- The frame aperture is centered, rectangular, and transparent.
- The frame contains no board squares, hallucinated coordinates, or text.
- The frame and board composite without covering any playable cell.
- Symmetry is measured where the manifest marks an asset as symmetric.

### Failure policy

Hard objective failures block derivative publication. Review warnings, such as slight haloing or compression degradation, require an explicit human or agent decision. A green asset checker is not artistic approval.

## Initial source batch

The first generated creative-source batch contains:

- lunar ordinary piece;
- solar ordinary piece;
- lunar king piece;
- solar king piece;
- board surface;
- board frame.

These files are not yet production assets. They require alpha inspection, background removal where necessary, crop normalization, diameter normalization, frame-aperture cleanup, manifest entry, deterministic derivative generation, in-product inspection, and screenshot review.

## Presentation architecture

The preferred implementation is a dedicated Checkers active-match shell that reuses the existing authoritative browser client and shared delivery boundary.

The shared multi-game page may continue to own game and match setup. Once a Checkers match is active or resumed, presentation should transition into the dedicated full-viewport shell while preserving:

- existing player identity and seat rules;
- existing match and revision state;
- existing legal-action controls;
- existing invitation behavior;
- existing resume behavior;
- existing diagnostics;
- existing accessibility and stable test selectors.

A staged implementation may first formalize a Checkers-specific structural container inside the shared page, then extract it to `/checkers.html` only after shared client code is factored without duplication. The final decision should minimize duplicate browser logic while achieving the full-viewport composition.

## Curated visual states

The visual-review lane must capture deterministic versions of:

- shared setup or game selection;
- opening match;
- selected lunar piece;
- selected solar piece where useful;
- legal destination display;
- forced capture;
- multi-jump route preview;
- committed capture;
- lunar king visible;
- solar king visible;
- captured-piece display;
- terminal win;
- terminal draw;
- 1440×960 desktop;
- 1366×768 short desktop;
- 390×844 narrow or Discord-style layout.

A successful capture job proves only that images were produced. The artifact must be downloaded and inspected before the visual slice is accepted.

## Completion gate

The Clockwork Eclipse slice is complete only when:

- the selected theme is represented coherently in the running product;
- all source masters are cleaned and deliberately named;
- the manifest is complete;
- automated image checks pass;
- a clean derivative rebuild produces no diff;
- the full-viewport contract passes at all declared sizes;
- authoritative Checkers interaction and recovery journeys remain green;
- curated screenshots are produced and personally inspected;
- visible defects are corrected or explicitly documented;
- exact-head canonical evidence is recorded after the final branch is frozen.

## Next implementation phases

1. Clean and normalize the six existing source assets.
2. Select and pin the image-processing implementation.
3. Add the manifest, build scripts, validation scripts, and package commands.
4. Generate and approve the remaining UI-art batch.
5. Build the structural full-viewport Checkers shell.
6. Integrate optimized assets without changing authority.
7. Add focused asset, browser, viewport, and visual tests.
8. Run local validation, freeze the head, trigger canonical validation and visual review, and inspect the artifact.
