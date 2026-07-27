# Decision 0003 — Player identity is server-derived

## Decision

Public GameFrame transports must derive the acting player identity from an authenticated request principal. Match creation, state reads, actions, and WebSocket upgrades must not trust a `playerId` supplied by the browser, Discord participant payload, query string, or action body.

The local Node development server uses an explicitly named development-only header authenticator. The Cloudflare Worker fails closed until a Discord or service identity verifier is configured.

## Rationale

A client-controlled player ID would allow one participant to read another player's private observation, occupy an unassigned seat, or submit an action for an opponent. Discord's Activity flow authorizes in the embedded client but exchanges and verifies credentials through the backend. The backend-generated principal is therefore the only identity allowed to cross the authoritative match boundary.

## Request behavior

- Match creation requires the authenticated principal to occupy one requested seat.
- Reads use the authenticated principal's player ID.
- Actions use the authenticated principal's player ID.
- WebSocket attachments use the authenticated principal's player ID.
- A conflicting legacy `playerId` claim is rejected rather than silently ignored.
- Health and static-asset requests remain unauthenticated.

## Production direction

The Discord Activity adapter will exchange the SDK authorization code server-side, verify the resulting user identity with Discord, and establish a same-origin authenticated session. The Scribbles Runtime adapter will use a separate service principal restricted to Theo's registered `theo` agent identity.
