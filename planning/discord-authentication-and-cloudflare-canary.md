# Discord authentication and Cloudflare canary

## Purpose

The first hosted Scribbles GameFrame deployment uses a real Discord identity boundary rather than a shared test password or development identity header. The deployment environment is a canary; authentication itself is production-shaped.

GameFrame remains the authority for sessions, seats, legal actions, revisions, storage, and match outcomes. Discord supplies a verified external user identity and, inside a Discord Activity, the short-lived bearer token required by the Embedded App SDK.

## Implemented identity paths

### Standalone website

1. The browser requests `GET /auth/discord/start` with a same-origin return path.
2. GameFrame creates a short-lived HMAC-signed OAuth transaction containing a random nonce and sanitized return path.
3. A host-only, secure, `SameSite=Lax`, HTTP-only transaction cookie binds the callback to the initiating browser.
4. Discord performs the authorization-code grant with the `identify` scope.
5. `GET /auth/discord/callback` verifies the query state against the cookie and verifies the signed transaction before contacting Discord.
6. GameFrame exchanges the code server-side, fetches `/users/@me`, rejects invalid or bot identities, and enforces the staging allowlist.
7. GameFrame discards the Discord token and issues its own 12-hour signed session cookie.
8. `GET /api/session` exposes only the trusted GameFrame principal and presentation profile.
9. `POST /auth/logout` clears the GameFrame session.

The browser never stores the website OAuth access token. Game commands and WebSocket upgrades continue to use the signed GameFrame session.

### Discord Activity server boundary

1. `GET /auth/discord/activity/config` returns the Discord application ID, requested scopes, and a signed transaction state.
2. The response sets a secure, HTTP-only, `SameSite=None`, `Partitioned` transaction cookie scoped to `<client-id>.discordsays.com`.
3. The Activity client uses the Embedded App SDK to authorize and sends the returned code and state to `POST /auth/discord/activity/session`.
4. GameFrame validates the transaction, performs the server-side code exchange, fetches `/users/@me`, enforces the allowlist, and issues a partitioned signed GameFrame session.
5. The response returns Discord's short-lived bearer token to the Activity client only so it can finish `commands.authenticate`; GameFrame does not persist that token.

The backend Activity exchange and session boundary are implemented and Workers-runtime tested. The actual Embedded App SDK browser handshake must be bundled into the Activity client and browser-tested before a complete Discord Activity launch is claimed.

## Stable player identity

Discord users become GameFrame players through:

```text
Discord user ID 111222333444555666
→ GameFrame player ID discord:111222333444555666
```

Discord display names and avatars are presentation metadata. They do not authorize seats and are not durable identity keys.

## Staging access policy

`DISCORD_ALLOWED_USER_IDS` fails closed and must be one of:

```text
111222333444555666
111222333444555666,777888999000111222
*
```

Use explicit numeric IDs for the first deployment. `*` deliberately opens the deployment to every valid non-bot Discord user and should not be used until public access is intended.

## Required Cloudflare bindings

The Worker declares these required secret bindings:

- `SESSION_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_ALLOWED_USER_IDS`

The client ID and allowlist are not intrinsically confidential, but keeping all four deployment identity values in Cloudflare bindings prevents accidental repository/environment drift. No value belongs in Git history, workflow output, screenshots, or committed `.dev.vars` files.

## Discord Developer Portal setup

Create or select the Scribbles GameFrame Discord application, then add the exact standalone redirect URI:

```text
https://scribbles-gameframe.<workers-subdomain>.workers.dev/auth/discord/callback
```

The URI must exactly match the origin that users open. A later custom domain requires adding its callback separately.

For a Discord Activity, configure the Activity URL mapping to the deployed GameFrame origin and use the same application ID. The Activity path must not be called complete until the Embedded App SDK client bootstrap has exchanged a real code against `/auth/discord/activity/session` and established the partitioned GameFrame cookie inside Discord.

## Windows deployment commands

From PowerShell in the repository:

```powershell
git checkout main
git pull --ff-only
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run validate
npx.cmd wrangler login
npx.cmd wrangler whoami
```

Set the bindings through prompts:

```powershell
npx.cmd wrangler secret put SESSION_SECRET
npx.cmd wrangler secret put DISCORD_CLIENT_ID
npx.cmd wrangler secret put DISCORD_CLIENT_SECRET
npx.cmd wrangler secret put DISCORD_ALLOWED_USER_IDS
```

Then deploy:

```powershell
npx.cmd wrangler deploy
```

Do not place the values directly on the command line.

## Acceptance boundary

Repository validation may prove:

- OAuth state signing, expiry, tamper detection, and browser binding
- same-origin return-path enforcement
- Discord code and user response validation through deterministic mocks
- allowlist denial
- website and Activity cookie attributes
- signed session inspection and logout
- local-development compatibility
- real Workers-runtime routing and cookie handling

Only a live canary can prove:

- Discord accepts the configured redirect URI and application credentials
- an actual user completes website OAuth
- the deployed cookie survives browser navigation and authorizes commands/WebSockets
- an actual Discord Activity SDK client completes authorize/authenticate inside Discord
- public-network reconnect, Durable Object persistence, and Cloudflare operational behavior

## Deferred secure multiplayer claim

Development-browser friend links still use synthetic identities for local Playwright coverage. Discord-authenticated hosting disables those controls. Production friend play requires a signed, match-scoped invitation or seat-claim flow tied to the invited user's authenticated Discord identity; it must not re-enable URL player impersonation.
