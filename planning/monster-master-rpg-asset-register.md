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
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - monster-master-rpg-current-creative-direction.md
  - monster-master-rpg-lore-and-story.md
---

# Monster Master RPG Starter Asset Register

## Purpose

This register is the durable planning and production ledger for the first Monster Master RPG scenario package.

It has two jobs:

1. define the reusable visual vocabulary required by the bespoke unauthorized-juvenile-transport package;
2. track every authored, reused, composed, generated, rejected, accepted, and integrated source through stable asset identities and append-only attempts.

The machine-readable authority is [`assets/monster-master-rpg-asset-register.json`](assets/monster-master-rpg-asset-register.json).

## Current production boundary

The current phase is manual production by the owner and assisting creative agent:

- generate or author source art interactively;
- edit, clean, crop, mask, and normalize it;
- produce deterministic derivatives;
- integrate assets into GameFrame;
- review them through actual screenshots and playable scenes;
- retain provenance and rejected attempts.

Cloudflare-managed generation, campaign-time media queues, automatic provider routing, and RPG GM Runtime asset creation are future capabilities. They are not dependencies for the first scenario.

## Scenario-package relationship

The asset cut is derived from the committed plot-agent-style package in RPG GM Runtime.

Events request **semantic roles**, not filenames or unique illustrations. The DM agent may realize the same event differently according to players and state, so the asset set should emphasize reusable locations, actors, props, effects, and UI treatments rather than one picture for every authored event.

GameFrame resolves a semantic role to:

1. an accepted campaign asset;
2. a compatible Arena Battles or catalog asset;
3. a deterministic composition;
4. a readable fallback.

Missing optional art must not force the DM to change the plot. Required tactical readability must exist before Arena Battles launches.

## Governing principles

- Every durable asset receives a stable semantic `assetId` before production.
- Asset identity is independent of filename, provider, prompt, or derivative format.
- Source masters and runtime derivatives remain separate.
- Rejected attempts remain recorded.
- Accepted assets are replaced only through explicit supersession.
- Existing Arena Battles assets are audited before duplicates are produced.
- One accepted asset may satisfy several compatible roles when the mapping is explicit.
- Assets support DM realization; they do not impose a scene sequence.

## Status model

```text
planned
  -> reuse-audit
  -> spec-ready
  -> queued
  -> generating or authoring
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

An asset is not `integrated` merely because a file exists. Integration requires in-context evidence at intended display size.

## Priority model

### Reuse

Existing Arena Battles terrain, interface, effects, and creatures that can satisfy a semantic role after inspection or cleanup.

### P0 — Opening and investigation vocabulary

Required to launch the scenario, reach early agency, support the damaged-cart incident, and present basic public and player-private information.

### P1 — Culvert and complete one-shot vocabulary

Required for the juvenile encounter, contractor involvement, possible tactical handoff, and consequence-focused aftermath.

### Deferred

Useful for alternate plots, recurring campaigns, audio, or presentation polish but not required for the first complete package.

## Reuse-first audit

Audit these current Arena Battles families before new production:

- grass ground material;
- raised terrain cap;
- cliff-face material;
- Monster Master shell and card treatment;
- turn-order presentation;
- generic selection, impact, status, and defeat effects;
- readable starter support and tracking creatures;
- tactical objective or hazard markers that can be repaired rather than replaced.

Each audit result should be recorded as accepted unchanged, cleanup required, continuity reference only, fallback only, or rejected for RPG use.

The current Pixi geometry remains authoritative: 72×36 CSS-pixel tile projection and 29 CSS-pixel wall visual height.

## P0 manual production

### Location and composition

- `location.eastgate-field-station`
  - wide reusable environment master;
  - versions capable of clean station, abandoned-cart incident, and route-facing composition;
  - should not bake a single fixed sequence of character placements.

### Essential actors

- `npc.veteran-warden-guide.portrait`
  - Warden Pell;
  - neutral, suspicious, and alarmed crops or expressions.
- `npc.nervous-courier.portrait`
  - Mara Vell;
  - guarded, strained, and panicked crops or expressions.

### Modular incident props

- `prop.supply-cart.damaged`
  - clean and damaged-latch states;
  - removable cargo presentation.
- `prop.supply-crates`
  - sealed, open, shifted, scuffed, and empty variants.
- `prop.route-marker.tampered`
  - clean and recently moved states;
  - directional variants.
- `prop.delivery-manifest`
  - environmental prop and readable inspection view.

### Investigation and private presentation

- `ui.private-observation`
  - player-private expertise, instinct, temptation, or creature-reaction presentation;
  - should not imply a mandatory clue card flow.
- `fx.investigation-set`
  - tracks, residue, scuffs, scent, drag marks, and attention indicators.

## P1 manual production

### Culvert environment

- `location.old-culvert`
  - reusable environment master;
  - exploration and tactical compositions;
  - readable route blockage, retreat lane, cover, and restraint debris.

### Juvenile monster

- `creature.dangerous-juvenile.field`
  - Ruckmaw juvenile source master;
  - tactical derivative;
  - silhouette or unrevealed state;
  - portrait crop;
  - injured, guarded, panicked, and stabilized readability where practical.

The design should communicate a frightening, physically dangerous juvenile that is defensive rather than malicious. It must not look like a harmless mascot or a generic slasher creature.

### Contractor

- `npc.contractor.portrait`
  - Jory Vale;
  - composed, defensive, desperate, and bargaining crops or expressions.
- `npc.contractor.field`
  - readable token or small field derivative.

### Evidence and intervention props

- `prop.hidden-restraint-fitting`
  - adapted cube or restraint evidence;
  - readable enough for close inspection.
- `prop.restraint-rig`
  - bad-recapture equipment and tactical obstacle.
- `prop.bait-kit.unofficial`
  - small reusable legal-gray bait kit.
- `prop.culvert-restraint-debris`
  - evidence and environmental dressing.

### Tactical and aftermath UI

- `ui.tactical-objectives`
  - protect, stabilize, disable, secure, and escape-lane objective markers.
- `ui.assessment-summary`
  - consequences, injuries, evidence, relationships, certification, and legal exposure;
  - not a morality score or corporate performance review.

## Deferred

Defer until the first complete package is playable and visually coherent:

- unique art for every event realization;
- station-worker portrait unless the role becomes recurring;
- recurring rival art;
- dedicated domestic-hauler art when an existing creature reads clearly;
- separate academy launch, care destination, and return-assessment environments;
- every hazard-class badge and broad icon family;
- bespoke audio, ambience, narration, and voice identities;
- alternate plot-family assets;
- Hyperbolic Time Cube assets;
- campaign-time generation infrastructure.

## Production record split

### Asset identity

Each entry records:

- stable `assetId`;
- semantic role and family;
- priority and lifecycle status;
- continuity identity;
- scenario, event, and tactical dependencies;
- technical profile;
- fallback behavior;
- accepted attempt, when one exists.

### Production attempt

Every source attempt records:

- stable `attemptId` and target `assetId`;
- source mode: reused, authored, composed, generated, imported, or user-supplied;
- provider, model, workflow, prompt, or recipe versions where applicable;
- source-master location and content hash;
- creation time;
- review result and notes;
- rights and provenance notes;
- rejection, replacement, or supersession relationship.

The attempts list is append-only.

## Acceptance evidence

Depending on family, evidence may include:

- retained source master;
- provenance and rights notes;
- approved crop, alpha, dimensions, anchor, pivot, and scale;
- content hash and derivative paths;
- no unwanted text, watermark, copied franchise design, or opaque background;
- screenshot at intended display size;
- scene-composition and mobile checks;
- tactical geometry, occlusion, and readability checks;
- fallback validation;
- manifest validation.

## Intended paths

```text
source masters
  assets/source/monster-master-rpg/<asset-id-safe-name>/

runtime derivatives
  public/assets/monster-master-rpg/<family>/

production specifications
  planning/assets/specs/monster-master-rpg/

provenance and attempts
  planning/assets/monster-master-rpg-asset-register.json
```

Stable asset IDs remain independent of storage changes.

## First production order

1. audit terrain, shell, effects, objective markers, and starter creatures;
2. produce Eastgate Field Station as the first environment master;
3. produce Pell and Mara portraits;
4. produce the cart, crates, markers, manifest, and investigation indicators;
5. integrate and review the opening in context;
6. produce the old culvert and Ruckmaw juvenile;
7. produce Jory and the restraint, bait, and tactical props;
8. integrate a noncombat culvert realization and an objective-driven tactical realization;
9. produce the assessment summary and review complete-session visual continuity;
10. reconsider deferred assets only after the package works.

## Governing rule

> Build a reusable visual vocabulary from the committed scenario package, preserve every production attempt, and let GameFrame compose accepted assets around the DM's player-driven realization rather than illustrating a fixed scene script.
