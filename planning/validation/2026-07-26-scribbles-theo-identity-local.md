# Local validation — Scribbles and Theo identity migration — 2026-07-26

## Validated branch state

- Repository: `QuankAIWS/scribbles-gameframe`
- Branch: `agent/scribbles-namespace-cleanup`
- Implementation head before this report: `8244132051963e866cb8113cd104c6800d9ddced`
- Execution environment: isolated assistant container
- Node.js: 22.16.0
- npm: 10.9.2
- GitHub-hosted runner minutes: unavailable
- Self-hosted GitHub runner: offline

The checkout was reconstructed from the connected private repository at the branch state above. No GitHub Actions result is claimed.

## Commands executed

```text
npm test
npm run check:browser
node --experimental-strip-types src/scripts/self-check.ts
npm run validate
```

## Results

- 33 tests passed
- 0 tests failed
- Browser JavaScript syntax check passed
- Repository self-check passed
- Aggregate `npm run validate` passed
- Exhaustive legal human move-tree proof confirmed the deterministic Theo player cannot lose as O
- Node and Cloudflare adapter tests preserved Theo's stable `theo` player identity
- Human-versus-human matches did not invoke Theo
- Server-derived identity, spoofing rejection, stale revisions, idempotency, replay, Durable Object reconstruction, competing writes, signed sessions, and WebSocket projections remained green
- The namespace guard rejects the previous platform package and service identifiers without rejecting legitimate Theo references

## Not claimed

- GitHub Actions or canonical self-hosted-runner validation
- Real Cloudflare `workerd`, deployment, hibernation, quota, or recovery behavior
- Discord Activity OAuth, launch, proxy, desktop, or mobile behavior
- Installed Scribbles Runtime adapter compatibility
- Live Theo model-driven decisions

The pull request remains draft for a later manually dispatched self-hosted-runner confirmation before final merge.
