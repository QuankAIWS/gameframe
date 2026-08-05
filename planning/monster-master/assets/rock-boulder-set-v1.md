# Monster Master Rock and Boulder Set v1

## Status

Three owner-approved members are accepted and usable:

- `prop:mm-rock-small-v1`
- `prop:mm-boulder-medium-v1`
- `prop:mm-rubble-pile-v1`

The large-boulder member remains pending, so the catalog set is intentionally marked partial. Root and branch candidates from the same production session were rejected and are not included.

## Source masters

Each accepted prop has an approved 1024×1024 transparent PNG master. The exact source bytes are retained in an immutable, chunked Git package under:

`public/assets/monster-master/props/rock-boulder-set-v1/source/package/`

The package wrapper and internal filenames are not treated as identity. The manifest records the provider, generation ID, review decision, file SHA-256, decoded-pixel SHA-256, alpha bounds, and canonical materialized path for every master. The build accepts only PNG entries matching the approved file hashes and then verifies their decoded RGBA pixel hashes.

## Runtime assets

A 128×128 lossless WebP is committed for each accepted member and is immediately available through the prop index. These sizes cover the current recommended display footprints of approximately 36, 72, and 84 CSS pixels.

The deterministic build also materializes the canonical 1024×1024 PNG masters and creates 512×512 PNG and 256×256 lossless WebP derivatives:

```bash
npm run assets:props:build
npm run assets:props:verify
```

No prop has a baked ground patch or cast shadow. Internal self-shading remains part of the illustration; optional contact shadows belong to the renderer.

## Runtime integration boundary

The current battle renderer does not yet have a general semantic prop-placement consumer. These assets are therefore `derivative-ready`, not falsely marked `integrated`. A later renderer slice should bind semantic prop IDs to authoritative map objects and validate four camera rotations, occlusion, zoom, desktop, and mobile screenshots.
