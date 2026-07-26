# Local validation — Signed Activity session slice — 2026-07-25

## Executed and passed

```text
npm run validate
tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext \
  --allowImportingTsExtensions --strict --skipLibCheck \
  <runtime-independent authentication, platform, service, and Cloudflare sources>
```

Results:

- 33 tests passed
- 0 tests failed
- HMAC-signed session round trip passed
- Modified tokens were rejected
- Expired tokens were rejected
- Cookie authentication recovered the same principal for HTTP and WebSocket upgrade requests
- Cookie generation included the Activity host, HttpOnly, Secure, SameSite=None, and Partitioned attributes
- Cloudflare accepted a valid signed session through `SESSION_SECRET`
- Cloudflare rejected a modified session cookie
- Previous identity, persistence, concurrency, two-seat, and projection tests remained green

## Remaining external proof

- Cloudflare secret provisioning and rotation
- Cookie persistence through the real Discord Activity proxy on desktop and mobile
- Discord authorization-code exchange and user verification
- Session revocation policy if longer-lived sessions are introduced
