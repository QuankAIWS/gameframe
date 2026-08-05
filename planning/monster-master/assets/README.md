# Monster Master Asset Production Records

This directory contains Monster Master-specific production records created under:

- `planning/shared/rpg-rendering-and-asset-contract.md`;
- `planning/shared/rpg-media-theme-and-audio-pipeline.md`;
- `planning/shared/rpg-monster-master-reference-campaign.md`; and
- the Google Doc `ChatGPT Native Environment Visual Pipeline`.

The repository records are authoritative for concrete Monster Master identity, dimensions, naming, runtime paths, manifests, transforms, and acceptance evidence. The general visual-pipeline document governs production discipline where a repository record is not more specific.

## Product identity correction

A **Master is a human trainer or player character**. A Master is not a monster species.

The human Master commands and calls monsters into battle. Asset families must therefore distinguish:

- human trainer or Master presentation;
- summoned monster presentation;
- summoning and call-in effects;
- trainer and monster portraits, silhouettes, fallbacks, and interface treatments.

Existing internal identifiers such as `warden-master-v1` may remain temporarily for compatibility, but new visual assets must not depict that identifier as a creature or use it as a new player-facing monster name.

## Accepted assets

- `grass-ground-v1.md`
- `raised-barrier-cap-grassland-stone-v1.md`
- `cliff-face-grassland-stone-v1.md`

## Active pack work

- `core-pack-v1.md`
- `default-master-trainer-v1.md`

## Implemented production infrastructure

The active core-pack branch now contains:

- `public/assets/monster-master/packs/core-v1/manifest.json`
  - versioned runtime pack identity;
  - explicit trainer and monster families;
  - current 96-pixel atlas frames marked `legacy-fallback`;
  - stable replacement targets for the human trainer, Stone Bulwark, and Emberling Skirmisher;
- `src/browser/monster-master-asset-pack.js`
  - pack validation;
  - content-ID resolution with compatibility-role fallback;
  - legacy atlas-frame resolution;
  - accepted runtime-path discovery;
- `scripts/monster-master-core-assets.mjs`
  - deterministic Sharp derivative builds;
  - source and runtime dimension checks;
  - SHA-256 verification;
  - byte-for-byte reproducibility checks;
- `src/browser/monster-master-asset-pack.test.ts`
  - trainer/monster identity tests;
  - mandatory replacement-target tests;
  - fallback and atlas-frame tests;
  - rejection of untracked runtime replacements;
- normal `assets:build`, `assets:verify`, and browser syntax-check integration.

This extends the accepted terrain workflow instead of replacing it with a parallel asset system.

## Current replacement rule

All three current unit frames are low-resolution pilot assets. None is an accepted final source for the core pack.

- `warden-master-v1` remains a temporary human-trainer compatibility frame.
- `stone-bulwark-v1` remains a temporary monster fallback.
- `emberling-skirmisher-v1` remains a temporary monster fallback.

A replacement is not accepted by dropping an image into the repository. It must provide a retained source master, deterministic derivative metadata, hashes, anchor and scale data, provenance, in-render evidence, and an explicit manifest status change.

## Acceptance rule

Generated or authored images are source material only. An asset enters the runtime pack only after:

1. visual review;
2. provenance recording;
3. alpha, crop, edge, anchor, and scale normalization;
4. deterministic derivative production;
5. manifest registration;
6. focused asset checks;
7. live Pixi integration;
8. desktop and mobile screenshot inspection.
