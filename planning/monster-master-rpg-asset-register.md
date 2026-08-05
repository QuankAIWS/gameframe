---
title: Monster Master RPG Starter Asset Register
status: active
document_type: asset-plan
owner: Scribbles GameFrame
last_updated: 2026-08-04
applies_to:
  - Monster Master RPG one-shot
  - Monster Master Arena Battles reuse
  - GameFrame RPG asset pipeline
related:
  - assets/monster-master-rpg-asset-register.json
  - shared/rpg-rendering-and-asset-contract.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - monster-master-rpg-lore-and-story.md
---

# Monster Master RPG Starter Asset Register

## Purpose

This register is the durable planning and production ledger for the Monster Master RPG starter experience.

It serves two related purposes:

1. define the concrete asset coverage required by the first one-shot and its approved plot pools;
2. track every authored, reused, composed, or generated source through review, derivative production, integration, rejection, and replacement.

The machine-readable authority is [`assets/monster-master-rpg-asset-register.json`](assets/monster-master-rpg-asset-register.json). This document explains how to use it and summarizes the initial production set.

## Governing principles

- Every durable asset receives a stable semantic `assetId` before generation or integration.
- Asset identity is independent of filename, storage path, provider, prompt, or current derivative format.
- Source masters and runtime derivatives are separate records.
- Rejected generation attempts remain recorded; they are evidence and may contain useful lessons.
- An accepted asset is never silently replaced. A replacement creates a new generation attempt and an explicit supersession relationship.
- Prepared assets are preferred for the Monster Master reference campaign. Live generation is optional enhancement, not a requirement for the one-shot.
- Existing Arena Battles assets must be audited for reuse before generating duplicates.
- Plot and event pools reference semantic asset roles. GameFrame resolves those roles to accepted assets or deterministic fallbacks.

## Status model

The register uses the following lifecycle:

```text
planned
  -> reuse-audit
  -> spec-ready
  -> queued
  -> generating
  -> source-ready
  -> review
  -> accepted
  -> derivative-ready
  -> integrated

terminal or replacement states:
  rejected
  failed
  superseded
```

### Status meaning

- **planned** — identity and purpose are known; production specification is incomplete.
- **reuse-audit** — an existing Arena Battles or catalog asset may satisfy the role and must be inspected first.
- **spec-ready** — semantic and technical production requirements are complete.
- **queued** — approved for an authoring, composition, or generation pass.
- **generating** — a source attempt is in progress.
- **source-ready** — a source master exists but has not passed review.
- **review** — visual, technical, rights, and continuity review is active.
- **accepted** — one source attempt is approved as the current master.
- **derivative-ready** — normalized runtime derivatives and manifest metadata exist.
- **integrated** — loaded by the relevant GameFrame fixture or product path and validated in context.
- **rejected** — source attempt failed quality, continuity, technical, or rights review.
- **failed** — production attempt did not produce a reviewable source.
- **superseded** — a previously accepted identity or attempt has been deliberately replaced.

## Priority model

### P0 — Intro-critical

Required to present the opening, first decision, evidence, and basic player-private hooks. P0 must have a readable accepted asset or deterministic fallback before the intro is considered complete.

### P1 — One-shot-critical

Required for the complete fixed one-shot, including investigation, confrontation, tactical handoff where used, and return assessment.

### P2 — Pool coverage

Supports alternate accepted plot families and event-pool variation. P2 does not block the first fixed one-shot.

### P3 — Polish and expansion

Improves presentation, continuity, or future chapters but is not required for the first one-shot acceptance gate.

## Production record split

### Asset identity

The asset entry records:

- stable `assetId`;
- semantic role and family;
- priority and current lifecycle status;
- continuity identity;
- plot, event, scene, and fixture dependencies;
- required technical profile;
- fallback behavior;
- accepted generation attempt, when one exists.

### Generation attempt

Every source attempt records:

- stable `attemptId` and target `assetId`;
- source mode: reused, authored, composed, generated, imported, or user-supplied;
- provider, model, workflow, prompt compiler, and recipe versions when applicable;
- prompt or production-spec reference;
- seed or reproducibility evidence when available;
- source-master location and content hash;
- creation time;
- review result, notes, and reviewer;
- rights and provenance notes;
- rejection, replacement, or supersession relationship.

The `generationAttempts` list begins empty. It must be appended to when production starts rather than overwriting the asset entry with informal notes.

## Initial one-shot visual coverage

### Campaign identity and UI

- Monster Master RPG identity mark or temporary wordmark.
- Incident scene card.
- Player-private clue card.
- Field assessment and return-summary card.
- Hazard Class 1 through 4 badges.
- Capture-cube, clue, route, care, license, and warning icons.

### Locations and scene backgrounds

- academy east gate or equivalent campaign launch view;
- Eastgate Field Station exterior;
- settled academy route;
- damaged supply-cart incident view;
- old culvert and roadside approach;
- creature-care delivery destination;
- academy or field-office return assessment.

These backgrounds may initially be composed scene cards rather than fully explorable maps.

### Characters

- veteran warden guide portrait and tactical/field presentation;
- nervous courier portrait;
- station worker portrait;
- contractor or responsible-party portrait;
- academy assessor portrait;
- optional rival trainee portrait.

The final names and designs remain individually authored continuity identities. Generic role art may serve as a fallback until those identities are approved.

### Creatures

- player starter-creature role coverage through existing Arena Battles candidates or approved new assets;
- domestic hauling or working Class 1 monster;
- injured or distressed Class 1 field monster;
- dangerous juvenile monster used by the fixed incident package;
- warden or patrol companion role;
- silhouettes for unknown or unrevealed creatures.

Creature combat power and hazard class remain separate metadata. The dangerous juvenile's final class and species should be chosen by the private plot package and creature design work, not inferred from the placeholder asset name.

### Tactical terrain and props

- grassland ground material;
- settled road or worn dirt material;
- raised earth or rock top material;
- matching cliff-face material;
- culvert, ditch, bridge, or drainage structure;
- damaged supply cart;
- supply crates;
- route markers and warning posts;
- fences, rocks, foliage, and roadside dressing;
- objective and hazard markers.

The current isometric geometry profile remains authoritative: 72×36 CSS-pixel tile projection and 29 CSS-pixel wall visual height. Source materials must not bake incompatible isometric polygons.

### Effects

- tracking or scent trail;
- clue discovery pulse;
- hazard warning;
- capture attempt and containment response;
- care or healing action;
- impact, damage, status, defeat, and encounter-return effects where existing Arena Battles effects are inadequate.

### Audio and narration placeholders

- academy ambience;
- settled route ambience;
- field-station tension bed;
- tactical escalation stinger;
- return-assessment cue;
- narrator voice identity label;
- veteran warden voice identity label.

Audio entries may remain `planned` with silent fallbacks until the text-first one-shot is proven.

## Reuse-first audit

Before generating a new source, inspect the current Monster Master: Arena Battles repository assets for:

- terrain materials and cliff-face sources;
- creature sprites and portraits;
- effects and status icons;
- card frames and interface ornamentation;
- victory, defeat, and encounter-transition presentation;
- current game identity marks;
- tactical props and objective markers.

An existing asset may be:

- accepted unchanged;
- accepted after derivative cleanup;
- used as a continuity reference for new source generation;
- retained only as a fallback;
- rejected for RPG use while remaining valid for Arena Battles.

The audit result must be recorded in the register rather than implied by filename reuse.

## Asset-role mapping

Event and plot definitions should use semantic roles such as:

```text
location.field-station.exterior
location.old-culvert
npc.veteran-warden-guide.portrait
npc.nervous-courier.portrait
creature.domestic-hauler.field
creature.dangerous-juvenile.field
prop.supply-cart.damaged
prop.route-marker.tampered
terrain.settled-road
ui.private-clue-card
fx.tracking-trail
```

The register maps those roles to stable GameFrame asset IDs. One accepted asset may satisfy several compatible roles, but the mapping must be explicit.

## Acceptance evidence

An asset does not reach `integrated` merely because a file exists.

Required evidence depends on family, but may include:

- source master retained and inspectable;
- provenance and rights notes complete;
- approved crop, alpha, dimensions, anchor, pivot, and scale profile;
- content hash and derivative paths recorded;
- no text, logo, watermark, or copied franchise design;
- in-context screenshot at intended display size;
- dark and light readability where applicable;
- tactical geometry alignment and occlusion checks;
- fallback verified;
- asset-manifest validation;
- mobile and reduced-motion behavior where relevant.

## File and naming guidance

The register does not force final storage paths, but the intended structure is:

```text
source masters
  assets/source/monster-master-rpg/<asset-id-safe-name>/

runtime derivatives
  public/assets/monster-master-rpg/<family>/

production specifications
  planning/assets/specs/monster-master-rpg/

provenance and generation attempts
  planning/assets/monster-master-rpg-asset-register.json
```

Actual implementation may refine these paths. Stable `assetId` values must remain independent of those changes.

## Update procedure

When beginning an asset:

1. confirm the asset entry and semantic role already exist;
2. move it to `spec-ready` after the production specification is complete;
3. append a generation attempt with a new `attemptId`;
4. move the asset through queued, generating, source-ready, and review states;
5. record rejection or acceptance without deleting the attempt;
6. set `currentAcceptedAttemptId` only after review;
7. record derivatives and manifest integration;
8. mark `integrated` only after in-context evidence passes.

When replacing an accepted asset:

1. create a new attempt;
2. preserve the previous accepted attempt;
3. identify the supersession reason;
4. validate continuity and derivative migration;
5. change `currentAcceptedAttemptId` explicitly.

## First production order

Recommended order:

1. reuse audit of current terrain, creatures, effects, and UI;
2. P0 scene cards and portraits needed for the intro;
3. P1 supply-cart, route-marker, culvert, and dangerous-juvenile coverage;
4. tactical terrain and field entities required by the fixed encounter;
5. clue, hazard, care, and tracking effects;
6. return-assessment presentation;
7. P2 alternate plot-family coverage;
8. audio and polish after text-first play is reliable.

## Governing rule

> Give every required presentation role a stable identity and fallback before production; retain every source attempt and provenance record; and promote only reviewed derivatives into the game.
