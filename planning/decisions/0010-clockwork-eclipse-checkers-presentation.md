# Decision 0010: Clockwork Eclipse Checkers Presentation

- Status: Accepted
- Date: 2026-08-01
- Scope: American Checkers presentation and visual-production workflow
- Rules impact: none

## Context

American Checkers is already proven through rules, authoritative services, browser interaction, real Workers-runtime persistence, resume, invitations, Theo participation, and visual-review tooling. The existing premium presentation demonstrates modular assets and a richer information hierarchy, but it still behaves as a decorated vertically flowing page and uses a prototype atlas and ad hoc source workflow.

The next visual pass needs to prove that GameFrame can ship a bespoke, polished, full-screen game surface using generated source assets without sacrificing authority, accessibility, deterministic testing, or reproducibility.

## Decision

The selected theme is **Clockwork Eclipse**.

The two factions are presented as solar and lunar celestial mechanisms:

- Solar: antique brass, warm gold, crimson or auburn enamel, sun-disc and radiant orbit motifs.
- Lunar: blued steel, obsidian enamel, silver crescent or eclipse motifs, restrained brass clockwork accents.

The implementation will use a Canvas/DOM-first, asset-assisted presentation:

- the exact 8×8 DOM grid remains authoritative for geometry and hit testing;
- legal destinations, route markers, selection states, text, controls, and most UI effects remain procedural;
- authored assets provide pieces, board material, frame ornament, and selected decorative furniture;
- generated sources become production assets only through cleanup, manifest entry, deterministic build, automated validation, and screenshot inspection.

The active Checkers match will become a full-viewport shell using `100dvh` with no document-level gameplay scrolling. Desktop rails remain within the viewport. Narrow layouts move secondary information into drawers, overlays, or compact disclosures.

A reusable visual asset build contract will be implemented with commands equivalent to:

```bash
npm run assets:check
npm run assets:build
npm run assets:verify
```

Image generation remains outside the deterministic build and outside canonical CI.

## Authority constraints

The presentation may observe, reorganize, and mirror current state. It may not:

- duplicate Checkers rules or legal-action generation;
- create another command path;
- intercept or replace authoritative fetches;
- mutate match state outside existing services;
- treat camera, animation, hover, selection glow, or visual timing as authoritative state;
- replace semantic controls with inaccessible image-only controls.

## Initial source set

The first creative source batch includes:

- lunar ordinary piece;
- solar ordinary piece;
- lunar king piece;
- solar king piece;
- board surface;
- board frame.

The batch is source material only until normalized and verified.

## Consequences

### Positive

- Establishes a distinctive visual identity for GameFrame Checkers.
- Proves a complete generated-source-to-production workflow.
- Creates reusable manifest, build, and validation infrastructure for later games.
- Prevents generated derivatives from becoming irreproducible hand-edited artifacts.
- Makes viewport fit and mobile composition explicit acceptance requirements.
- Preserves the existing authoritative game and delivery stack.

### Costs

- Requires a pinned image-processing dependency or equivalent deterministic toolchain.
- Requires source-master storage and an explicit manifest.
- Adds asset-specific tests and build time.
- Requires structural Checkers layout work rather than continued CSS-only decoration.
- Requires manual screenshot inspection after automated checks pass.

## Rejected alternatives

### Keep the current premium theme and atlas unchanged

Rejected because the current assets and layout were a useful experiment, not a reproducible production pipeline or full-viewport composition.

### Use one whole-screen generated image

Rejected because it would compromise real text, accessibility, interaction geometry, responsive behavior, and authoritative state presentation.

### Generate all highlights and controls as image assets

Rejected because selection rings, legal destinations, route dots, text, and controls are cleaner, more responsive, and more testable as procedural UI.

### Generate assets during CI

Rejected because image generation is nondeterministic, expensive, externally dependent, and unrelated to verifying a committed production build.

## Verification

Acceptance requires:

- source masters and complete manifest;
- automated image checks;
- reproducible derivative build with no diff;
- full-viewport assertions at declared desktop and narrow sizes;
- preserved authoritative browser journeys;
- deterministic curated screenshots for ordinary, selection, capture, king, terminal, desktop, and narrow states;
- direct inspection of the resulting artifact;
- exact-head canonical evidence after the final branch is frozen.

## References

- `planning/clockwork-eclipse-checkers-visual-pipeline.md`
- `planning/visual-asset-build-contract.md`
- `planning/checkers-rules.md`
- `planning/testing-strategy.md`
- `planning/development-workflow.md`
- `planning/browser-journey-matrix.md`
