# Discord authentication boundary validation

Date: July 30, 2026

## Scope

This checkpoint records the repository-side production identity boundary used by the standalone Cloudflare website and the future Discord Activity client.

The implementation was developed in PR #31 and squash-merged into `main` as:

```text
4f8c47b84c03185bf996243c3514f7d8d81b1ef5
```

Frozen feature head:

```text
3fbd8cbc789f5a2f924ac42945f21af62b96e544
```

Canonical Validation run:

```text
#72 — 30533016879
```

## Validated implementation

### Standalone website OAuth

- stateless HMAC-signed OAuth transactions
- random nonce and ten-minute transaction expiry
- same-origin return-path restriction
- HTTP-only secure OAuth state cookie bound to the initiating browser
- server-side Discord authorization-code exchange
- Discord `/users/@me` identity lookup
- stable `discord:<user-id>` GameFrame player identity
- fail-closed Discord user allowlist
- host-only secure `SameSite=Lax` signed GameFrame session
- session introspection and logout

### Discord Activity server boundary

- Activity configuration endpoint containing application ID, scopes, and signed state
- secure `SameSite=None`, `Partitioned` OAuth state cookie on the Discord proxy domain
- server-side Activity authorization-code exchange and user lookup
- allowlist enforcement before session issuance
- partitioned signed GameFrame session
- return of Discord's short-lived bearer token solely for the Embedded App SDK authenticate step

### Browser and platform boundary

- every browser surface resolves the server-authoritative identity before loading its game client
- local development retains the trusted development-header identity and existing Playwright synthetic seats
- Discord-authenticated hosting strips URL player claims
- synthetic friend links are disabled in Discord mode until an authenticated match-scoped seat-claim flow exists
- Discord remains an identity provider and never becomes game authority
- the migration-stable Durable Object class and binding remain unchanged
- OAuth access tokens are not persisted by GameFrame

## Canonical evidence

GitHub-hosted Canonical Validation run #72 passed on Ubuntu 24.04 with read-only repository permissions and the committed dependency lock:

- 123 core repository tests passed
- 11 real Workers-runtime tests passed across three test files
- 14 Playwright browser tests passed across all existing game surfaces
- all five browser JavaScript entry points passed syntax validation
- repository self-check passed
- failure diagnostics were skipped because the final run was green

## Defect corrected during validation

The initial real Workers-runtime OAuth-start test followed the external Discord authorization redirect and observed the downstream response rather than the Worker's 302. The test was corrected to use manual redirect handling and inspect the actual Worker response. No production routing behavior was weakened.

## Evidence boundary

This checkpoint proves the repository implementation and Workers-runtime behavior. It does not claim:

- a deployed Cloudflare Worker
- a configured live Discord application or redirect URI
- successful OAuth by a real Discord user
- the Embedded App SDK browser authorize/authenticate handshake
- a live Discord Activity launch
- authenticated production friend seat claims
- public-network WebSocket, persistence, quota, or recovery behavior

Those remain compact external canaries. The server-side boundary required to run them is now complete.
