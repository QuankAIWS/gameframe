# Third-Party Notices

Scribbles GameFrame remains proprietary and all rights reserved. The following independently licensed development dependencies are used by the Discord Activity browser integration and remain subject to their own licenses.

## Discord Embedded App SDK

- Package: `@discord/embedded-app-sdk`
- Version: `2.5.0`
- Source: Discord's official Embedded App SDK package
- License: MIT
- Use: Discord Activity client transport, authorization, and authentication commands
- Repository boundary: bundled into `public/discord-activity-bootstrap.js` by `scripts/build-activity-bundle.mjs`

## esbuild

- Package: `esbuild`
- Version: `0.28.1`
- Source: official esbuild package
- License: MIT
- Use: deterministic build-time bundling of the Discord Activity browser entry
- Repository boundary: development dependency only; not used as runtime game authority

The exact dependency graph, integrity hashes, and transitive license metadata are retained in `package-lock.json`. The generated Activity bundle is reproducibly checked during `npm run validate`; it must not be edited manually or loaded from a runtime CDN.
