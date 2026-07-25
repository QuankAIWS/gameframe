# Decision 0004 — Signed partitioned Activity sessions

## Decision

Discord-authenticated human principals use short-lived, HMAC-signed GameFrame session tokens carried in an HttpOnly cookie. The cookie is scoped to the Activity's `{clientId}.discordsays.com` host and includes `Secure`, `SameSite=None`, and `Partitioned` attributes.

The same cookie authenticates ordinary HTTPS commands and same-origin WebSocket upgrades. The token contains only the canonical player ID, principal source, issue time, expiry, and format version.

## Rationale

Browser WebSocket constructors cannot attach arbitrary authorization headers. A same-origin Activity cookie gives HTTP and WebSocket requests one consistent identity mechanism while keeping the token unavailable to client JavaScript. HMAC signing detects modification without requiring a central session read on every request.

## Security properties

- Session secrets must be stored as Cloudflare secrets, never source or ordinary variables.
- Secrets must contain at least 32 characters.
- Tokens are size-bounded, versioned, signed, and time-limited.
- Invalid, modified, malformed, future-dated, and expired sessions fail closed.
- Cookies are HttpOnly and unavailable to Activity JavaScript.
- The `Partitioned` attribute confines the cookie to Discord's iframe partition.
- Token issuance remains contingent on server-side Discord OAuth verification.

## Limits

This is not the Discord OAuth exchange itself. No public session may be issued until the backend exchanges the Embedded App SDK authorization code and verifies the current Discord user through Discord's API.
