# Local validation — WebSocket projection slice — 2026-07-25

## Environment

- Execution environment: isolated assistant container
- Node.js: 22.16.0
- npm: 10.9.2
- TypeScript compiler: 5.8.3, environment-provided
- Cloudflare package registry: unavailable from this environment
- GitHub self-hosted runner: offline

## Executed and passed

```text
npm run validate
node --check public/app.js
tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext \
  --allowImportingTsExtensions --strict --skipLibCheck \
  <framework-independent platform, service, and Cloudflare adapter sources>
```

Results:

- 16 tests passed
- 0 tests failed
- Player-specific WebSocket attachment and initial-state delivery passed
- Match-scoped fan-out passed
- Refresh recovery and protocol-error behavior passed
- Worker WebSocket upgrade forwarding passed
- Projection delivery failure was proven not to roll back persisted actions
- Durable Object eviction, action idempotency, and competing-write coverage remained green
- Browser module syntax check passed
- Strict TypeScript check passed for the runtime-independent source boundary

## Not yet validated

- Real `WebSocketPair`, `acceptWebSocket`, and handler execution inside `workerd`
- WebSocket survival across real Durable Object hibernation and eviction
- Deployed Cloudflare Worker/Durable Object behavior
- Discord Activity proxy behavior
- Authentication of Discord identities at the match boundary
- Canonical self-hosted-runner CI
