# Local validation — Authentication boundary slice — 2026-07-25

## Executed and passed

```text
npm run validate
tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext \
  --allowImportingTsExtensions --strict --skipLibCheck \
  <runtime-independent authentication, platform, service, and Cloudflare sources>
```

Results:

- 28 tests passed
- 0 tests failed
- Anonymous Node API requests were rejected with HTTP 401
- Cloudflare public game APIs failed closed without a configured production verifier
- An authenticated principal outside the requested seats could not create a match
- Conflicting action identity claims were rejected with HTTP 403
- Rejected impersonation attempts left the authoritative revision unchanged
- WebSocket routing derived the player identity from the authenticated request boundary
- The local browser continued to use an explicitly labeled development-only identity header
- Existing rules, replay, persistence, concurrency, two-seat, and projection tests remained green

## Remaining external proof

- Discord SDK authorization and backend token exchange
- Discord user lookup and canonical player-ID mapping
- Same-origin authenticated session or cookie behavior through the Discord proxy
- Service authentication for the Scribbles Runtime adapter
- Real Cloudflare `workerd` and deployed identity verification
