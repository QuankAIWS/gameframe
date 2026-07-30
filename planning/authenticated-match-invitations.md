# Authenticated match invitations

## Purpose

Discord-authenticated GameFrame users must not create a human opponent by naming an arbitrary player ID or by sharing a URL containing a synthetic identity. A human-versus-human match begins only after two independently authenticated principals participate in an explicit invitation claim.

Local development retains synthetic browser seats for deterministic Playwright coverage. The Cloudflare and Discord delivery paths use the authenticated invitation boundary described here.

## Authority sequence

```text
Authenticated inviter
→ signed expiring invitation
→ authenticated claimant
→ serialized second-seat claim
→ match initialized with both verified player IDs
→ ordinary GameFrame commands, replay, storage, and projections
```

An invitation is not a match and is not a player identity. The actual match does not exist until a valid second principal claims the invitation.

## Invitation token

The invitation URL carries an HMAC-signed token containing:

- protocol version
- random invitation ID
- random 256-bit nonce
- supported game ID
- inviter GameFrame player ID
- optional target GameFrame player ID
- issue time
- expiry time

The token is signed with a domain-separated key derived from `SESSION_SECRET`. It expires after 24 hours by default and may never exceed seven days.

The URL contains no `player` parameter. Possession of the token grants permission to request the open seat; it does not establish identity. The claimant must possess a valid signed GameFrame session.

## Optional recipient restriction

An inviter may restrict a token to a numeric Discord user ID. The server converts it to the stable GameFrame identity:

```text
Discord user ID 222333444555666777
→ target player ID discord:222333444555666777
```

A different authenticated user receives `invitation_target_mismatch` before a seat or match is created.

## Serialized rendezvous

Invitation state is stored in the existing migration-stable Durable Object class under an invitation-prefixed object name. The invitation runtime serializes:

- initialization
- claim
- cancellation
- participant status reads

The first valid claimant wins. A retry by the same claimant is idempotent and returns the original match ID. A different later claimant receives `invitation_claimed`.

Only the inviter and successful claimant may read the invitation status. Only the inviter may cancel, and only before claim.

## Match creation and recovery

The claim records a stable match ID before the public coordinator initializes the match. The coordinator then creates the ordinary GameFrame match with exactly:

```text
[inviterPlayerId, claimantPlayerId]
```

If a request is interrupted after the claim commits but before match initialization completes, a retry by the claimant or a status read by either participant re-runs initialization idempotently. An existing match is accepted only when its game, match ID, and ordered player IDs exactly match the invitation record.

This preserves the invitation claim without inventing a second mutation path for game state.

## Direct creation policy

A Discord-authenticated principal may directly create only a two-seat match containing:

- that principal exactly once
- stable agent player `theo` exactly once

Human-versus-human direct creation is rejected. It must use the authenticated invitation flow.

The trusted development-header authenticator retains synthetic two-human creation for local browser tests.

## Browser delivery

Hosted game pages intercept the ordinary friend-match controls only when the resolved principal source is `discord`.

The inviter UI:

- creates a signed invitation
- displays and copies the invitation URL
- polls only the authenticated participant status endpoint
- allows pre-claim cancellation
- navigates to the match when the second seat is claimed

The recipient page:

- authenticates before loading its claim code
- submits only the signed token
- removes the token from browser history after success
- displays the verified inviter and game
- exposes only the server-generated resume path

The claim page uses `Referrer-Policy: no-referrer` so the bearer-style invitation token is not sent as a referrer.

## Explicit non-goals

This slice does not implement:

- public matchmaking
- invitation discovery
- friend lists
- Discord direct messages
- party lobbies larger than two seats
- spectator access
- transferable claimed seats
- identity selection from URL parameters

Larger parties and two-to-four-player tactical matches should extend the same authenticated claim model rather than restore caller-supplied player identities.
