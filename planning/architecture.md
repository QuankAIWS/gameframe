# Architecture

## System shape

Theo GameFrame is a modular monolith with explicit game modules and integration adapters. One authoritative service owns each match. Clients and agents submit intentions; deterministic code validates and commits state transitions.

```text
Discord Activity ─┐
Standalone web ───┼── authenticated application boundary
Discord text ─────┤                 │
Theo/OpenClaw ────┘                 ▼
                           authoritative match service
                         sessions · revisions · events
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
             game definition             decision adapter
          tic-tac-toe / tactics        Theo / solver / bot
```

## Game definition contract

Each game owns:

- Initial state
- Active-player determination
- Legal-action enumeration
- State transitions
- Player-specific observations
- Completion and winner semantics

The platform owns:

- Match identity
- Seats and player identity
- Action envelopes
- Revision checks
- Idempotency
- Event sequencing
- Replay
- Persistence and transport adapters

## Authority

The server is authoritative. Browser code, Discord clients, and Theo are untrusted callers. They may request only actions the current game definition exposes as legal. Theo never owns dice, clocks, turn order, health, movement, or victory state.

## First-slice persistence

GF-0001 uses an in-memory repository so the contracts can be tested without deployment credentials or third-party dependencies. This repository is an adapter, not a permanent state model. Durable Object and conventional persistent adapters must preserve the same revision, idempotency, event, and observation contracts.

## Integration direction

- The ordinary browser client remains the base client.
- Discord Activity is a host adapter around that client.
- Cloudflare is an intended public edge and match-runtime option, not a dependency of game rules.
- OpenClaw connects through a constrained player adapter and receives structured observations.

## Command and projection split

Game-changing actions use authenticated HTTP commands with action IDs and expected revisions. WebSockets are read-side projections only:

```text
HTTP command
  -> validate identity, revision, turn, and legal action
  -> persist authoritative snapshot and event
  -> return committed view
  -> broadcast player-specific projections

WebSocket
  -> initial authoritative view
  -> update notifications
  -> explicit refresh requests
  -> no direct game mutation
```

This prevents connection retries, duplicate socket messages, or projection failures from becoming game-state authority. Cloudflare's hibernation WebSocket API is the intended transport so idle connections can survive Durable Object eviction without keeping the object continuously active.

## Player seats

Tic-tac-toe matches are created with exactly two explicit, distinct player IDs. A player ID may represent a Discord-authenticated human or a registered agent identity such as `theo`. The game definition maps the ordered seats to X and O; transports do not infer or silently replace identities.

The service invokes an agent decision adapter only when that agent ID is actually present and currently owns the turn. Human-versus-human matches therefore use the same service and persistence path without model calls or deterministic bot actions. If Theo occupies the first seat, his opening action is committed during match creation so an agent-owned turn is not stranded.

## Authenticated player identity

External transports produce an authenticated principal before they reach match services. The public request body never determines the actor:

```text
Discord SDK authorize
  -> backend code exchange and Discord verification
  -> authenticated session
  -> canonical player principal
  -> seat authorization
  -> match command or projection
```

The local Node adapter uses `x-gameframe-player-id` only as an explicit development authenticator. The Cloudflare entry point rejects public game API requests until a production verifier is installed. OpenClaw will use a separate service principal bound to Theo's agent identity.

## Activity sessions

After Discord OAuth verification, GameFrame issues a short-lived HMAC-signed session cookie. The token is opaque to the game core and contains only the canonical principal and expiry metadata. The cookie is HttpOnly, Secure, `SameSite=None`, and `Partitioned`, and is scoped to the Activity's `{clientId}.discordsays.com` host.

HTTP commands and WebSocket upgrades therefore pass through the same `RequestAuthenticator`. The Worker imports `SESSION_SECRET` from the deployment environment; without it, all game APIs fail closed.
