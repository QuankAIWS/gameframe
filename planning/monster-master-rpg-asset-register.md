---
title: Monster Master RPG Starter Asset Register
status: active
document_type: asset-plan
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - Monster Master RPG starter catalog
  - Monster Master Arena Battles reuse
  - GameFrame RPG asset pipeline
related:
  - assets/monster-master-rpg-asset-register.json
  - monster-master-rpg-npc-pool.md
  - assets/monster-master-rpg-npc-role-catalog.json
  - shared/rpg-rendering-and-asset-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - monster-master-rpg-current-creative-direction.md
  - monster-master-rpg-lore-and-story.md
---

# Monster Master RPG Starter Asset Register

## Purpose

This register is the durable planning and production ledger for the reusable Monster Master RPG starter visual foundation.

It has two jobs:

1. define common visual vocabulary that supports several approved starter plot families;
2. track every authored, reused, composed, generated, rejected, accepted, and integrated source through stable asset identities and append-only attempts.

The machine-readable authority is [`assets/monster-master-rpg-asset-register.json`](assets/monster-master-rpg-asset-register.json).

The NPC role and portrait planning supplement is [`monster-master-rpg-npc-pool.md`](monster-master-rpg-npc-pool.md), with machine-readable mappings in [`assets/monster-master-rpg-npc-role-catalog.json`](assets/monster-master-rpg-npc-role-catalog.json). Those files define role coverage; this register remains lifecycle and provenance authority when NPC assets enter production.

## No single-plot ownership

No starter incident controls this register.

The asset plan must not be derived from one deterministic fixture or one favored plot. The base pack should support several materially different families, including ecological creature crises, cube failures, rivalry and sabotage, public-event chaos, and human crime or false authority.

A selected plot package may request additional semantic roles, but those become **family extensions** rather than the definition of the whole starter pack.

## Current production boundary

The current phase is manual production by the owner and assisting creative agent:

- generate or author source art interactively;
- edit, clean, crop, mask, and normalize it;
- produce deterministic derivatives;
- integrate assets into GameFrame;
- review them through actual screenshots and playable scenes;
- retain provenance and rejected attempts.

Cloudflare-managed generation, campaign-time media queues, automatic provider routing, and RPG GM Runtime asset creation are future capabilities. They are not dependencies for the starter.

## Resolution model

Plot and event definitions request semantic roles, not filenames or fixed illustrations.

GameFrame resolves a semantic role to:

1. an accepted campaign asset;
2. a compatible Arena Battles or catalog asset;
3. a deterministic composition;
4. a readable fallback.

Missing optional art must not force the DM to change the selected plot. Required tactical readability must exist before Arena Battles launches.

For NPCs, the fallback chain is exact role portrait, compatible portrait family with accessories, composable incidental portrait, named silhouette, then text-only character card. The selected visual identity remains stable when an NPC returns.

## Governing principles

- Every durable asset receives a stable semantic `assetId` before production.
- Asset identity is independent of filename, provider, prompt, or derivative format.
- Source masters and runtime derivatives remain separate.
- Rejected attempts remain recorded.
- Accepted assets are replaced only through explicit supersession.
- Existing Arena Battles assets are audited before duplicates are produced.
- One accepted asset may satisfy several compatible roles when the mapping is explicit.
- Assets support DM realization; they do not impose a scene sequence.
- No deterministic fixture may dictate the entire asset roadmap.
- An incidental NPC may become recurring without immediate unique art.
- Ordinary workers and social roles require planned coverage, not only suspects and combatants.

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

### P0 — Shared starter foundation

Required across several plot families:

- modular campaign locations;
- recurring guide and reusable NPC portrait-family presentation;
- incidental-NPC card and silhouette fallback;
- common route, cube, field, and cargo props;
- private observation, investigation, warning, objectives, and aftermath UI;
- domestic creature and conventional hazard readability.

### P1 — First family and NPC extensions

Additional assets for the first two or three plot families chosen for playable coverage, plus civic, event, underworld, and intelligent-monster NPC portrait families. These should be selected after the shared foundation is reviewed in context.

### Deferred

Unique art for every family, event, incidental NPC, creature state, audio layer, or future generation system that is not required for the initial playable catalog.

## Reuse-first audit

Audit these current Arena Battles families before new production:

- grass ground material;
- raised terrain cap;
- cliff-face material;
- Monster Master shell and card treatment;
- turn-order presentation;
- generic selection, impact, status, capture, care, and defeat effects;
- readable starter support and tracking creatures;
- tactical objective or hazard markers that can be repaired rather than replaced.

Each audit result should be recorded as accepted unchanged, cleanup required, continuity reference only, fallback only, or rejected for RPG use.

The current Pixi geometry remains authoritative: 72×36 CSS-pixel tile projection and 29 CSS-pixel wall visual height.

## P0 shared starter foundation

### Modular environments

- `location.eastgate-field-station`
  - reusable launch, work-site, inspection, and public-service compositions;
  - clean, busy, obstructed, and after-hours states where practical;
  - no baked incident-specific characters or evidence.
- `location.settled-route`
  - roadside, farm-edge, work-zone, checkpoint, and public-event compositions;
  - modular lanes, barriers, signs, pens, and route dressing.

### Recurring and reusable people

The detailed role-to-portrait mapping is controlled by the NPC pool documents.

P0 begins with:

- `npc.veteran-warden-guide.portrait`
  - unique Warden Pell identity;
  - portrait and field token.
- `npc-family.service-worker`
  - quartermaster, station cook or lunch lady, cafeteria worker, farmhand, road worker, stable hand, and ordinary witness;
  - initial target of two visibly distinct source identities.
- `npc-family.candidate-rival`
  - rival trainee, candidate, peer, or apprentice;
  - initial target of two identities and field tokens.
- `npc-family.care-handler`
  - creature medic, handler, stable specialist, or field-care worker;
  - initial target of two identities and field tokens.
- `npc-family.technical-scholar`
  - cube technician, researcher, repair specialist, or inspection expert;
  - initial target of two identities.
- `npc-family.guard-patrol`
  - road patrol, town guard, junior warden, or checkpoint officer;
  - initial target of two identities and field tokens.
- `npc-family.trade-travel`
  - merchant, courier, innkeeper, caravan worker, or traveler;
  - initial target of two identities.
- `ui.incidental-npc-card`
  - stable name, role, assigned portrait family or silhouette, and manner cue;
  - text-only fallback permitted.

An NPC promoted through play keeps the assigned portrait-family identity until unique manual art is approved.

### Common props

- `prop.route-marker.modular`
  - clean, moved, conflicting, temporary, warning, and fake-authority states.
- `prop.supply-cart.modular`
  - clean, loaded, unloaded, damaged, confiscated, and public-event variants through composition.
- `prop.capture-cube.inspection`
  - ordinary, suspicious, opened, tagged, and component-inspection views.
- `prop.field-kit.modular`
  - lawful tools, unofficial bait, care supplies, restraint tools, and repair equipment.
- `prop.barrier.modular`
  - route closure, crowd lane, work zone, animal pen, and false-roadblock uses.
- `prop.license-and-cube-case`
  - permits, registration, inspection, confiscation, and forgery presentation.

### Creature coverage

- `creature.domestic-worker.field`
  - readable hauling, farm, route, or public-event worker role;
  - calm, warning, distressed, and moving states where practical.
- `creature.conventional-hazard.field`
  - reusable conventional Class 2 or Class 3 threat silhouette or field role;
  - not a fixed named species unless separately approved.
- existing starter support and tracker creatures retained through reuse when they read clearly.

### Interface and effects

- `ui.private-observation`
  - expertise, instinct, temptation, creature reaction, and private warning.
- `ui.tactical-objectives`
  - protect, hold, open, disable, stabilize, secure, recover, and escape.
- `ui.aftermath-summary`
  - injuries, creature condition, evidence, legal exposure, relationships, resources, certification, and optional hooks.
- `fx.investigation-set`
  - tracks, residue, tampering, forgery, component mismatch, environmental signs, and attention indicators.
- `fx.behavior-warning`
  - creature refusal, agitation, attention, fear, territorial signaling, or recognition.
- `fx.hazard-warning`
  - public danger, equipment failure, crowd risk, route collapse, and tactical threshold.
- `fx.containment-warning`
  - cube mismatch, failed safeguard, unstable exit, or containment concern.

## P1 family extensions

P1 is deliberately divided by plot family and additional NPC coverage. Production should select the first two or three plot families rather than automatically building all of them.

### NPC portrait extensions

- `npc-family.civic-official`;
- `npc-family.civic-event`;
- `npc-family.underworld`;
- `npc-family.intelligent-monster-citizen`;
- second and later identities for common P0 families.

### Displaced domestic migration

Potential extensions:

- `creature.territorial-hazard.field`;
- `prop.roadwork-set`;
- `prop.farm-set`;
- herd grouping and route-blockage compositions.

### Counterfeit cube recall

Potential extensions:

- `prop.counterfeit-components`;
- `location.inspection-bench`;
- `fx.cube-failure`;
- occupant-safe recovery and registration mismatch presentation.

### Rival certification sabotage

Potential extensions:

- `prop.assessment-marker.modular`;
- `fx.tamper-indicator`;
- rival sponsor or instructor portrait only when the role becomes recurring.

### Festival mascot breakout

Potential extensions:

- `location.public-event`;
- `creature.mascot.field`;
- `prop.festival-dressing`;
- `fx.crowd-hazard`.

### False warden roadblock

Potential extensions:

- `prop.roadblock.modular`;
- `npc.false-inspector.portrait` through the underworld family;
- `fx.forgery-indicator`;
- confiscation, rescue, and extraction compositions.

## Deferred

Defer until the shared foundation is playable and at least two families are visually proven:

- unique art for every event realization;
- unique art for every incidental NPC;
- a unique named NPC for every family role;
- a unique creature for every anomaly;
- full interiors for every cube problem;
- every hazard-class badge and broad icon family;
- separate return-assessment environments;
- bespoke audio, ambience, narration, and voice identities;
- blocked Class 4 specialty-hazard assets;
- Hyperbolic Time Cube assets;
- campaign-time generation infrastructure.

## Production record split

### Asset identity

Each entry records:

- stable `assetId`;
- semantic role and family;
- priority and lifecycle status;
- continuity identity when applicable;
- supported plot families;
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
- manifest validation;
- proof that the asset supports more than one composition or family where claimed;
- proof that recurring incidental NPCs retain stable visual assignments.

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
2. produce the field-station and settled-route environment masters;
3. produce the incidental-NPC card and named-silhouette fallback;
4. produce Pell’s unique portrait and field token;
5. produce two service-worker identities, including quartermaster and cook/lunch-lady variants;
6. produce two candidate/rival identities and field tokens;
7. produce two care-handler identities and field tokens;
8. produce two technical-specialist identities;
9. produce two guard/patrol identities and field tokens;
10. produce two trade/travel identities;
11. produce modular route markers, cart, cube-inspection, field-kit, barrier, and license-case props;
12. produce private observation, investigation, behavior-warning, hazard, objective, and aftermath treatments;
13. integrate and review planned and improvised NPC scenes in several neutral compositions;
14. select the first two or three plot families for playable coverage;
15. produce only those family extensions and necessary P1 NPC families;
16. validate that the deterministic CI fixture works without becoming the default campaign presentation;
17. reconsider deferred assets only after multiple families and emergent NPC continuity are playable.

## Governing rule

> Build a reusable starter and NPC vocabulary first, add selected family extensions second, preserve every production attempt, and never let one plot fixture or one closed cast become the whole Monster Master asset pack.
