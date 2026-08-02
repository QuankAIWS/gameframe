# Clockwork Eclipse Checkers Visual Pipeline

## Status

- Selected theme: `Clockwork Eclipse`
- Target game: `american-checkers`
- Foundation: PR #39 branch `agent/mm-0001-current-foundation`
- Implementation: complete on PR #41
- Runtime and rules impact: none

This document records the completed first production use of the GameFrame visual-asset pipeline. The reusable cross-game contract is defined in `planning/visual-asset-build-contract.md`.

## Result

Clockwork Eclipse presents American Checkers as a celestial mechanical contest between solar and lunar factions:

- solar pieces use brass, warm gold, auburn enamel, and sun-disc motifs;
- lunar pieces use blued steel, obsidian, silver crescents, and eclipse motifs;
- kings remain in the same piece family and preserve the ordinary-piece silhouette;
- the board uses pale ivory and astronomical dark squares inside an ornate mechanical frame;
- interface furniture remains semantic HTML and CSS except where authored art materially improves the presentation.

The running Checkers client retains the existing authoritative DOM grid, legal actions, match revisions, identity, invitations, recovery, replay, persistence, and command boundaries.

## Completed source pack

The committed lossless source masters are semantic SVG files under:

```text
art-source/checkers/clockwork-eclipse/
  manifest.json
  masters/
    board-frame.svg
    board-surface.svg
    captured-reservoir.svg
    emblem.svg
    piece-lunar.svg
    piece-lunar-king.svg
    piece-solar.svg
    piece-solar-king.svg
    rail-flourish.svg
    shell-background.svg
    turn-dial.svg
```

The browser-delivery derivatives are rebuilt under:

```text
public/assets/checkers/clockwork-eclipse/
  asset-build.json
  board-frame.svg
  board-surface.svg
  captured-reservoir.svg
  emblem.svg
  piece-lunar.svg
  piece-lunar-king.svg
  piece-solar.svg
  piece-solar-king.svg
  rail-flourish.svg
  shell-background.svg
  turn-dial.svg
```

The authored SVG pack is a compact, deterministic production interpretation of the approved raster concepts. Generated raster concepts remain design references rather than canonical build inputs.

## Manifest and build contract

`art-source/checkers/clockwork-eclipse/manifest.json` is authoritative for source hashes, dimensions, transparency policy, semantic roles, faction and rank metadata, output paths, and renderer mappings.

The implemented commands are:

```bash
npm run assets:check
npm run assets:build
npm run assets:verify
```

- `assets:check` performs read-only source and manifest validation.
- `assets:build` cleans and reconstructs the declared browser derivatives.
- `assets:verify` rebuilds in isolation and fails on missing, extra, or byte-different output.

`asset-build.json` records the build schema, input hashes, and output hashes.

## Implemented automated checks

The asset lane verifies:

- source existence and successful SVG decoding;
- exact semantic IDs and metadata;
- declared dimensions and view boxes;
- source hash integrity;
- transparency and opaque-background declarations;
- absence of scripts and external URLs;
- exact manifest membership with no orphaned masters or derivatives;
- complete lunar, solar, ordinary, and king piece families;
- exact 8×8 board-grid construction;
- clean deterministic derivative reproduction.

A green asset checker establishes objective integrity and reproducibility. It does not replace visual inspection.

## Authority boundary

The presentation does not:

- import or duplicate Checkers rules;
- infer legal actions independently;
- create a second action endpoint;
- intercept or replace authoritative fetches;
- mutate match state outside the existing application boundary;
- replace semantic buttons with inaccessible image-only controls;
- treat animation or visual-selection state as authoritative state.

Existing stable IDs, legal-action data, revision behavior, resume behavior, invitation behavior, and diagnostics remain compatibility surfaces.

## Full-viewport presentation

The completed active-match shell uses `100dvh` and disables document-level gameplay scrolling.

Validated viewports include:

- desktop: 1440×960;
- short desktop: 1366×768;
- narrow or Discord-style: 390×844.

The board remains dominant. Desktop player and information rails stay inside the viewport. Narrow layouts keep the board, state, and essential controls bounded while reducing secondary information. Reduced-motion presentation remains legible without animation.

Focused browser checks assert that document scroll dimensions remain within the viewport tolerance and that authoritative selection, legal destinations, committed movement, and revision advancement still function through the existing controls.

## Curated visual evidence

The completed visual lane covers:

- desktop opening match;
- short-desktop composition;
- narrow mobile composition;
- authoritative piece selection;
- legal destinations;
- post-resize mobile selection;
- viewport overflow assertions.

The final code-equivalent visual artifact was downloaded and inspected rather than accepted solely because screenshot creation succeeded.

## Reusable lessons

This slice established several rules for later GameFrame and RPG work:

1. Generated candidates and reusable campaign art belong in a durable runtime asset library before repository promotion.
2. Versioned product assets require approved masters, a committed manifest, and a deterministic build.
3. Source hashes must be computed from the exact committed bytes, not an intermediate transport representation.
4. Browser tests must reference semantic assets rather than obsolete atlas filenames.
5. Curated viewport captures need explicit post-resize interaction states because responsive regressions can appear only after state changes.
6. Presentation layers may reorganize and enrich state display but may not create parallel authority.

The runtime-library, generation-cache, semantic-reuse, storage, and repository-promotion rules are maintained in `planning/visual-asset-build-contract.md`.

## Completion gate

The Clockwork Eclipse slice is complete because:

- the selected theme is coherent in the running product;
- source masters are deliberately named and committed;
- the manifest and deterministic build are implemented;
- automated source and reproducibility checks pass;
- the full-viewport contract passes at declared sizes;
- authoritative Checkers interaction remains green;
- curated screenshots were produced and inspected;
- visible defects found during review were corrected;
- exact-head canonical evidence is recorded on PR #41.

Future changes to the theme are new visual revisions. They must repeat source approval, manifest updates, deterministic verification, browser acceptance, curated capture, inspection, and exact-head validation.