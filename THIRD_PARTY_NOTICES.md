# Third-Party Notices

Scribbles GameFrame remains proprietary and all rights reserved. The following independently licensed packages are used by the browser integrations and remain subject to their own licenses.

## Discord Embedded App SDK

- Package: `@discord/embedded-app-sdk`
- Version: `2.5.0`
- Source: Discord's official Embedded App SDK package
- License: MIT
- Use: Discord Activity client transport, authorization, and authentication commands
- Repository boundary: bundled into `public/discord-activity-bootstrap.js` by `scripts/build-activity-bundle.mjs`

## PixiJS

- Package: `pixi.js`
- Version: `8.19.0`
- Source: official PixiJS package maintained by the PixiJS project
- License: MIT
- Use: WebGL battlefield rendering, scene composition, texture loading, and drawing primitives for Monster Master
- Repository boundary: bundled into `public/monster-master-pixi-bundle.js` by `scripts/build-monster-master-pixi.mjs`; no runtime CDN is used

The committed Pixi bundle can include transitive runtime code under independently permissive licenses. The exact dependency graph, package versions, integrity hashes, and declared license metadata—including entries such as `earcut`, `@xmldom/xmldom`, and `@webgpu/types` in the current lockfile—are retained in `package-lock.json`. Copyright and license terms remain with their respective authors.

## esbuild

- Package: `esbuild`
- Version: `0.28.1`
- Source: official esbuild package
- License: MIT
- Use: deterministic build-time bundling of the Discord Activity and Monster Master browser entries
- Repository boundary: development dependency only; not used as runtime game authority

Generated browser bundles are reproducibly checked during validation; they must not be edited manually or loaded from an unpinned runtime CDN.
