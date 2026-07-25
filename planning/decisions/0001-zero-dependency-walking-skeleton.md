# Decision 0001 — Zero-dependency walking skeleton

## Decision

GF-0001 uses Node 22's erasable TypeScript support, built-in HTTP/fetch APIs, and an ordinary static browser shell without third-party packages.

## Rationale

The first uncertainty is the platform contract and deployment/integration path, not frontend framework choice. A dependency-free slice can be built and validated in constrained environments, runs quickly on the self-hosted runner, and avoids making package installation a prerequisite for proving deterministic behavior.

## Limits

This does not prohibit later dependencies. Discord's Embedded App SDK, Cloudflare tooling, browser test tooling, schema validation, or a UI framework may be adopted when their capability becomes active. New dependencies require deliberate selection, a lockfile, and validation.
