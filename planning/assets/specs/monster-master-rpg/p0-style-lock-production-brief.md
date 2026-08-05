---
title: Monster Master RPG P0 Style-Lock Production Brief
status: ready-for-interactive-production
document_type: asset-production-brief
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - Monster Master RPG starter asset production
  - Monster Master Arena Battles field-token compatibility
  - manual image generation and cleanup
related:
  - ../../monster-master-rpg-asset-register.json
  - ../../monster-master-rpg-npc-role-catalog.json
  - p0-style-lock-work-order.json
  - ../../../monster-master-rpg-asset-register.md
  - ../../../monster-master-rpg-npc-pool.md
  - ../../../shared/rpg-rendering-and-asset-contract.md
---

# Monster Master RPG P0 Style-Lock Production Brief

## Decision

Do not begin by generating the entire P0 asset list.

First produce a bounded style-lock batch containing enough characters, environments, props, and interface treatment to prove one coherent Monster Master RPG visual language. Review those sources at actual GameFrame display sizes, repair the pipeline, and only then expand the remaining portrait families and plot extensions.

The machine-readable work order is [`p0-style-lock-work-order.json`](p0-style-lock-work-order.json).

## Audit result

The repository is ready to begin source-master production, with two explicit boundaries.

### Already usable

- The grass ground, raised barrier cap, and cliff-face terrain pilot are accepted, retained as source masters, deterministically rebuilt, and integrated into the Pixi tactical renderer.
- Tactical geometry is authoritative at 72×36 CSS pixels per projected cell with a 29 CSS-pixel raised-wall height.
- The current unit renderer uses 96×96 atlas frames, displays ordinary units at roughly 82–104 CSS pixels, displays the current human Master role at 94 CSS pixels, and anchors sprites at `0.5, 0.86`.
- The starter asset register and NPC role catalog define reusable semantic roles and prevent one plot fixture from controlling the pack.

### Not yet a runtime consumer

The current Monster Master RPG shell renders a text event feed. It does not yet consume portrait, scene, prop, or media references from campaign events.

This does **not** block source-master production. It does block claiming that a portrait or scene is integrated. Until the media-presentation slice exists, new sources may progress through review and acceptance, but their final runtime atlas, bundle, and event-binding details remain provisional.

The terrain derivative script is terrain-specific. It must not be copied blindly for portraits, field tokens, props, or backgrounds.

## Style target

Monster Master should read as a late-1990s or early-2000s illustrated fantasy PC game that received careful modern cleanup, not as a glossy mobile collectible game and not as a fake retro pixel game.

Use:

- expressive, readable silhouettes;
- restrained but distinct palettes;
- inked, painted, cel, scanned, or gouache-like surfaces;
- practical clothing, tools, workspaces, and wear;
- enough stylization to support slapstick and absurd professional culture;
- enough material credibility to support sincere danger and bounded horror;
- modest, purposeful detail that survives reduction.

Avoid:

- generic glossy 3D toy rendering;
- excessive armor, spikes, straps, and meaningless microdetail;
- direct imitation of Pokémon, Digimon, or another protected creature-battling franchise;
- modern tactical-police visual language unless a later plot explicitly requires an original equivalent;
- permanent joke faces or costume caricatures for reusable role families;
- text, logos, watermarks, fake UI, or incident-specific clues baked into reusable art.

## First production batch

### P0A — Character style lock

Produce these first:

1. `ui:mm-incidental-npc-card-v1`
   - semantic HTML/CSS card with SVG frame or ornament;
   - named silhouette slot;
   - role label and manner cue;
   - deliberate text-only fallback.
2. `fallback:mm-incidental-npc-silhouette-v1`
   - one neutral human silhouette;
   - one neutral intelligent-nonhuman silhouette;
   - clean alpha and intentional presentation.
3. `portrait:mm-warden-pell-v3`
   - three materially different concept candidates before identity lock;
   - one accepted neutral master;
   - amused and concerned expression proof;
   - competent recurring guide, not generic wizard, soldier, or disposable gag.
4. `token:mm-warden-pell-field-v1`
   - continuity-matched full-body field source;
   - mirror-safe pose;
   - visible feet and contact point;
   - 94-pixel tactical simulation.
5. `portrait:mm-service-worker-quartermaster-01-v1`
   - first service-worker identity;
   - neutral master, ledger-and-keys variant, guarded expression.
6. `portrait:mm-service-worker-cook-02-v1`
   - second visibly distinct service-worker identity;
   - apron or food-service variant, amused expression;
   - credible station cook or lunch lady, not a broad caricature.

Do not expand every expression for every identity during style lock. Prove neutral identity, one role accessory state, and one contrasting expression. Expand only after the card presentation and continuity model are working.

### P0B — Environment style lock

Produce:

1. `scene:mm-eastgate-field-station-v3`
   - reusable exterior-day master;
   - public-service and field-work character;
   - no baked named characters, incident, evidence, or tactical objective.
2. `scene:mm-eastgate-station-common-v1`
   - common room and cafeteria interior;
   - clear foreground space for portraits and dialogue UI;
   - ordinary work-life details rather than a generic fantasy tavern.
3. `scene:mm-settled-route-v1`
   - clear road at a farm or work-zone edge;
   - modular space for checkpoint, roadwork, crowd, creature, or false-authority overlays;
   - no baked plot resolution.

These three images must feel like the same region without becoming palette-swapped copies. Preserve a central safe area so GameFrame can crop them for desktop, short desktop, mobile, and Discord Activity layouts.

### P0C — Prop and presentation style lock

Produce:

1. `prop:mm-route-marker-modular-v1`
   - clean marker, temporary-warning state, moved or conflicting state;
   - no readable raster text.
2. `prop:mm-cube-inspection-v1`
   - ordinary closed cube, opened inspection view, separated component study;
   - original Monster Master capture technology;
   - no protected ball or device design imitation.
3. `ui:mm-private-observation-v2`
   - private observation card;
   - instinct and warning variants;
   - readable text-only state.

Props must remain readable at 128 pixels. Interface assets must remain optional decoration around semantic HTML rather than flattened screenshots.

## Source profiles

### Portraits

- Preferred master: 1536×2048 PNG or the largest clean lossless source available.
- Framing: waist-up or bust, three-quarter view, complete head and shoulders, generous crop safety.
- Background: transparent preferred; otherwise use a flat neutral separation background for masking.
- Lighting: soft upper-left key with restrained fill.
- Review crops: 512×512 dialogue card and 256×384 cutout.
- Preserve the uncropped master and every accepted expression or accessory source.

### Field tokens

- Preferred master: 1536×1536 PNG; minimum 1024×1024.
- Full body, three-quarter downward view, complete feet, compact contact shadow.
- Transparent background after cleanup.
- Mirror-safe unless the renderer later adds directional variants.
- Normalized anchor: `0.5, 0.86`.
- Review derivatives: 256×256 inspection PNG and 128×128 candidate atlas WebP.
- Mandatory simulation: displayed at 94 CSS pixels against the 72×36 grid, beside a 29-pixel raised wall, both in front of and behind occluding terrain.

### Environments

- Preferred master: 2560×1440; minimum 2048×1152.
- Important information stays inside the central 70 percent.
- Review 16:9, 4:3, and center 9:16 crops.
- No named characters, incident-specific evidence, selection indicators, or UI.
- Retain composition notes for clean, busy, obstructed, damaged, or after-hours variants rather than regenerating the location from scratch.

### Props

- Preferred master: 1024×1024 PNG.
- One isolated object or deliberately separated modular set.
- Transparent background after cleanup.
- Review at 512, 256, and 128 pixels.
- Separate labels and written records from the raster object so GameFrame can render accessible text.

### Interface

- Prefer SVG for frames, geometry, icons, masks, and dividers.
- Use raster only for tactile material or ornament that benefits from it.
- Semantic HTML owns text, interaction, focus, labels, responsive behavior, and accessibility.
- Every treatment must have a readable undecorated fallback.

## Prompt construction

Every image-generation request should contain:

- stable target asset ID and semantic role;
- source profile and intended review size;
- continuity references, if any;
- camera and framing convention;
- practical role, location, and material details;
- palette and lighting relationship to previously accepted sources;
- alpha or masking requirement;
- permitted accessory or state variants;
- explicit exclusions;
- instruction to create source art, not a game screenshot, mock UI, or sprite atlas.

Do not ask the model to invent several unrelated deliverables in one image. Generate one identity, location, or modular object set at a time. Character concept sheets may compare controlled variants, but the accepted source should be isolated and retained separately.

## Character continuity rules

- Pell receives a unique identity and is the first cross-portrait/token continuity proof.
- The two service-worker sources must be visibly different people at 512-pixel card size, not one face with changed clothing.
- Role accessories communicate work without defining morality or one permanent personality.
- A reusable portrait family must support ordinary people, competent professionals, compromised people, and potential witnesses without making everyone look suspicious.
- An incidental NPC keeps the same selected identity, crop, and accessory assignment when returning.
- No service-worker source may be silently reused as Pell, a rival, or another named continuity anchor.

## Acceptance sequence

For every source:

1. retain the original generation or authored master;
2. record prompt, workflow, provider, model, date, and rights/provenance notes;
3. inspect silhouette, anatomy, crop, alpha, text, and franchise resemblance;
4. attempt repair before regeneration when the source is otherwise useful;
5. create the review derivatives;
6. inspect at intended GameFrame size rather than only zoomed source size;
7. compare with sibling sources for palette, lighting, line, and material consistency;
8. mark accepted, repair, rejected, or superseded;
9. add or update the main asset-register entry before the source is considered accepted;
10. delay `integrated` status until a real consuming surface renders it and screenshots pass.

## Expansion gate

Do not move into the full P0 portrait-family queue until:

- Pell’s portrait and field token read as the same person;
- both service-worker identities remain distinct at card size;
- the field station, common room, and settled route feel like one setting;
- the cube and route marker establish a compatible prop language;
- the incidental card works with portrait, silhouette, and text-only states;
- no source requires live generation for routine play;
- repair and derivative steps are repeatable enough to document.

After that gate, continue with two candidate/rival identities and tokens, two care-handler identities and tokens, two technical-specialist identities, two guard/patrol identities and tokens, and two trade/travel identities. Family-specific plot art remains P1 and should cover only the first two or three selected playable families.

## Required code follow-up

Source production can start now. Runtime completion later requires:

- a campaign-event media-reference contract;
- GameFrame semantic asset resolution for portraits, scenes, props, and fallbacks;
- RPG shell rendering hooks for portrait and scene presentation;
- a non-terrain derivative builder and manifest validator;
- screenshot journeys covering portrait continuity, scene crops, fallback states, and mobile/Discord layouts.

Those are consumer and integration tasks. They should not be smuggled into generated art or treated as a reason to postpone the style-lock sources.

## Governing rule

> Lock the visual language with a small reusable cross-section, inspect it at real GameFrame size, repair the production process, and only then scale into the full portrait, environment, prop, and plot-extension catalog.
