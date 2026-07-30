# Authenticated match invitation validation

Date: July 30, 2026

## Scope

This checkpoint records the repository-side human-versus-human hosting boundary that replaces synthetic URL identities with signed invitation claims tied to independently authenticated GameFrame principals.

The implementation was developed in PR #35 and squash-merged into `main` as:

```text
e80272c4e38a95fd7f595694c22ff78d056640d7
```

Frozen feature head:

```text
fbcd0144b64c885fbf16b16f60a7f791c10445fc
```

Canonical Validation run:

```text
#79 — 30536198841
```

## Validated implementation

### Signed invitation claims

- HMAC-signed, domain-separated tokens
- random invitation ID and 256-bit nonce
- supported game, inviter, issue time, and expiry claims
- optional restriction to one numeric Discord user ID
- default 24-hour expiry with bounded configurable lifetime
- no player identity in invitation or match resume URLs
- authenticated GameFrame session required for claim
- inviter cannot claim their own second seat

### Serialized Durable Object rendezvous

- invitation records stored through the migration-stable Durable Object class
- invitation-prefixed object names keep invitation and match storage isolated
- first valid claimant wins
- same-claimant retries return the original match idempotently
- later different claimants receive `invitation_claimed`
- only inviter and successful claimant may read participant status
- only inviter may cancel, and only before claim
- target mismatch, expiry, cancellation, and token tampering fail closed

### Match initialization and recovery

- the match does not exist before a successful claim
- match seats are exactly the verified inviter and claimant player IDs
- claim records a stable match ID before match initialization
- interrupted claim-to-match initialization is repaired by claimant retry or participant status read
- an existing match is accepted only when game, match ID, and ordered player IDs exactly match the invitation record
- ordinary GameFrame match authority, actions, replay, storage, and projections remain unchanged

### Direct creation policy

- a Discord-authenticated principal may directly create only a match containing that principal and stable agent player `theo`
- caller-supplied Discord human seats are rejected
- trusted local development retains synthetic two-browser seats for deterministic Playwright coverage

### Hosted browser surfaces

- authenticated friend buttons create and poll signed invitations
- invitation URLs carry only the signed token
- recipient claim page authenticates before executing claim code
- claim page uses `Referrer-Policy: no-referrer`
- the token is removed from browser history after successful claim
- both users receive only a server-generated match resume path
- inviter can cancel before claim

## Canonical evidence

GitHub-hosted Canonical Validation run #79 passed on Ubuntu 24.04 with read-only repository permissions and the committed dependency lock:

- 142 core repository tests passed
- 13 real Workers-runtime tests passed across four test files
- the committed Discord Activity SDK bundle rebuilt byte-for-byte
- eight browser JavaScript entry points passed syntax validation
- 16 Playwright browser tests passed across the existing games and both invitation surfaces
- repository self-check passed
- failure diagnostics were skipped because the final run was green

## Defect corrected during validation

The initial candidate stopped on the earlier Discord delivery contract, which still required hosted friend controls to remain disabled. The contract was updated to require the authenticated invitation routes and browser flow and to reject the retired disabled-placeholder behavior. No runtime or acceptance test was weakened.

## Evidence boundary

This checkpoint proves repository logic, browser behavior, and real Workers-runtime storage and recovery. It does not claim:

- a deployed Cloudflare Worker
- real Discord OAuth or Activity launch
- public-network human multiplayer
- live WebSocket reconnect and recovery
- production quotas, observability, or operational durability

Those are now external canaries against a repository-complete security boundary.
