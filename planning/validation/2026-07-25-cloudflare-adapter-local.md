# Local validation — Cloudflare adapter slice — 2026-07-25

## Environment

- Execution environment: isolated assistant container
- Node.js: 22.16.0
- npm: 10.9.2
- TypeScript compiler available in environment: 5.8.3
- GitHub self-hosted runner: unavailable / workflow queued
- Cloudflare package registry access: unavailable during this slice
- Cloudflare credentials and deployed Worker: unavailable

## Executed and passed

```text
npm run validate
```

Results:

- 11 tests passed
- 0 failed
- Existing deterministic tic-tac-toe non-loss proof remained green
- Match snapshots restore accepted and rejected action idempotency
- Storage-neutral asynchronous match service passed existing Node HTTP integration
- Cloudflare Worker router created and advanced a match through a fake Durable Object namespace
- Durable snapshot survived simulated object eviction and reconstruction
- Duplicate accepted action remained idempotent after simulated eviction
- Two competing revision-zero writes were serialized; one succeeded and one received a stale-revision conflict
- Repository self-check passed

A strict `tsc --noEmit` pass also succeeded for the framework-independent platform, game, service, and testable Cloudflare adapter files. The deployment wrapper importing `cloudflare:workers` was excluded because Cloudflare development dependencies could not be installed from the environment registry.

## Implemented but not runtime-validated

- `wrangler.jsonc` Worker, static asset, and SQLite-backed Durable Object declarations
- `src/cloudflare/worker.ts` Cloudflare deployment wrapper
- Real Workers Static Assets behavior
- Real SQLite-backed Durable Object behavior
- Cloudflare's Vitest pool and `workerd` execution

## Remaining external proof

- Install and lock Wrangler, Vitest, and `@cloudflare/vitest-pool-workers`
- Run the Durable Object suite inside the Workers runtime
- Deploy a development Worker
- Verify static assets, API routing, persistence, eviction, and usage telemetry
- Add and verify WebSocket synchronization
- Run Discord Activity and Scribbles Runtime canaries
