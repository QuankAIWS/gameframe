# Default Human Master Trainer v1

## Status

Source-generation candidate. No runtime derivative is accepted yet.

## Semantic identity

- Asset family: trainer
- Continuity ID: `trainer-default-master-v1`
- Presentation role: initial human Master/player-character bootstrap
- Product meaning: the person who commands and calls monsters into battle
- Explicit exclusion: this is not a monster species and must not be registered in the creature atlas

This default is a prepared reference character for the first pack and deterministic campaign fixture. Later player customization may replace or layer clothing, complexion, hair, accessories, portraits, and other presentation traits through separate reviewed work.

## First source asset

The first generated source is a full-body battlefield cutout used to lock the trainer family’s camera, silhouette, lighting, and brushwork.

### Camera and pose

- elevated three-quarter/dimetric view compatible with the current 72 × 36 pseudo-isometric battlefield;
- full body visible from head to boots;
- feet share one clear horizontal ground-contact region;
- facing generally screen-right and into the arena;
- mirror-safe asymmetry: no text, one-way logos, or hand-specific object whose mirrored version becomes visibly incorrect;
- stable, calm command pose rather than an attack pose;
- one hand ready to signal or call a monster;
- silhouette readable at approximately 80–120 CSS pixels tall.

### Character direction

- clearly human adult trainer;
- capable field leader rather than armored front-line monster;
- practical boots, travel clothing, belt or satchel, gloves or bracers, and one restrained summoning/control focus;
- natural human anatomy and proportions;
- distinctive but not franchise-derived silhouette;
- no animal head, monster limbs, creature body, giant armor shell, or transformation state;
- no weapon that implies the trainer is the principal battlefield damage dealer.

### Visual treatment

- late-1990s / early-2000s illustrated creature-battling PC art;
- hand-painted cel-and-gouache surface with controlled ink edges;
- restrained verdant, earth, brass, cream, and ember accents compatible with the grassland terrain pilot;
- broad readable value groups and limited microdetail;
- soft shared light from upper-left/front-left;
- no glossy 3D toy rendering;
- no excessive spikes, buckles, armor plates, or particle clutter.

### Background and shadow

- real transparent background required;
- no environment, pedestal, UI frame, text, labels, border, fake checkerboard, or presentation mockup;
- no baked long cast shadow;
- a faint compact contact shadow may be retained only if it can be cleanly isolated or removed during normalization;
- production preference is a separate procedural Pixi shadow.

### Source target

- preferred generation canvas: 2048 × 2048 or largest practical square output;
- lossless retained PNG master after cleanup;
- centered visual mass with sufficient padding for head, coat, hand gesture, and boots;
- no cropped hair, hands, clothing, or feet.

## Review gates

Reject or regenerate if the source:

- reads as a monster, druid creature, armored summon, or magical beast;
- lacks a clear human face and anatomy;
- uses a low frontal portrait camera inconsistent with battlefield units;
- has hidden, floating, or mismatched feet;
- cannot be mirrored safely;
- contains fake transparency, scenery, text, watermarking, or a large baked shadow;
- becomes visually incoherent at intended battlefield scale;
- resembles a protected creature-battling franchise character or costume too closely.

## Planned derivatives after approval

The approved battlefield source will produce, subject to live scale review:

- `trainer-default-master-v1-battlefield-512.webp`;
- `trainer-default-master-v1-battlefield-256.webp`;
- a silhouette fallback generated from the cleaned alpha;
- anchor metadata centered near the ground contact;
- a procedural shadow profile.

A dialogue portrait is commissioned separately rather than cropped automatically from the battlefield cutout.

## Proposed runtime metadata

```json
{
  "assetId": "trainer-default-master-v1-battlefield",
  "semanticRole": "trainer-battlefield-cutout",
  "continuityRef": "trainer-default-master-v1",
  "anchor": { "x": 0.5, "y": 0.94 },
  "scaleProfile": "monster-master-trainer-medium-v1",
  "facing": "screen-right",
  "mirrorSafe": true,
  "fallbackAssetId": "trainer-silhouette-v1"
}
```

The exact anchor and scale are measured from the cleaned accepted source, not copied blindly from this planning estimate.
