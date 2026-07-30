# Discord Activity client validation

Date: July 30, 2026

## Scope

This checkpoint records the repository-side Discord Activity browser handshake built on the previously validated Discord OAuth and signed GameFrame session boundary.

The implementation was developed in PR #33 and squash-merged into `main` as:

```text
f2cb58d88f66dfdd6aec7e201a931073e6a02b9a
```

Frozen feature head:

```text
192ed6e2bcaec38830d533972913f769bbcf730a
```

Canonical Validation run:

```text
#76 — 30534507331
```

## Validated implementation

- numeric `<client-id>.discordsays.com` Activity-host recognition
- server configuration retrieval containing application ID, scopes, and signed OAuth transaction state
- official Discord Embedded App SDK initialization
- SDK readiness boundary
- `commands.authorize` authorization-code request
- code and state exchange through the GameFrame Worker
- partitioned signed GameFrame session establishment
- `commands.authenticate` completion with Discord's short-lived bearer token
- strict equality between the SDK user ID and the signed `discord:<user-id>` GameFrame principal
- fail-closed handling for invalid server configuration, invalid authorization response, failed exchange, and identity mismatch
- game-client startup only after the Activity authentication boundary completes

## Dependency and build boundary

- `@discord/embedded-app-sdk` pinned exactly to `2.5.0`
- esbuild pinned exactly to `0.28.1`
- exact dependency graph and integrity hashes committed in `package-lock.json`
- official SDK bundled locally into `public/discord-activity-bootstrap.js`
- no runtime CDN dependency
- generated bundle rebuilt and compared byte-for-byte during validation
- third-party licenses and provenance recorded in `THIRD_PARTY_NOTICES.md`
- temporary write-capable generation workflow removed before the final candidate

## Canonical evidence

GitHub-hosted Canonical Validation run #76 passed on Ubuntu 24.04 with read-only repository permissions and the committed dependency lock:

- 129 core repository tests passed
- 11 real Workers-runtime tests passed across three test files
- the committed Discord Activity SDK bundle rebuilt byte-for-byte
- six browser JavaScript entry points passed syntax validation
- 14 Playwright browser tests passed across the existing game surfaces
- repository self-check passed
- failure diagnostics were skipped because the final run was green

## Defect corrected during validation

The initial full run passed all functional tests but the repository self-check still expected the previous four-development-dependency set. The durable self-check was expanded to require the exact official SDK and bundler versions, Activity sources and tests, reproducible bundle scripts, third-party notice, generated browser entry, and absence of the temporary write-capable workflow.

## Evidence boundary

This checkpoint proves the repository client handshake against deterministic SDK and server doubles together with the existing real Workers-runtime server boundary. It does not claim:

- a deployed Cloudflare Worker
- a configured live Discord application or redirect URI
- a configured Activity URL mapping
- OAuth by a real Discord user
- launch through an actual Discord desktop or mobile client
- public-network WebSocket, persistence, quota, or recovery behavior
- authenticated human-to-human seat claims

Those remain live and repository follow-on canaries. Hosted synthetic URL identities remain disabled until the authenticated seat-claim boundary is implemented.
