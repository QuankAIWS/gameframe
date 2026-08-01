# Architecture

## System shape

Scribbles GameFrame is a modular monolith with explicit game modules and integration adapters. One authoritative service owns each match. Clients and agents submit intentions; deterministic code validates and commits state transitions.

```text
Discord Activity ─┐
Standalone web ───┼── authenticated application boundary
Discord text ─────┤                 │
Scribbles Runtime ┘                 ▼
                           authoritative match service
                         sessions · revisions · events
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
             game definition             decision adapter
          tic-tac-toe / tactics        Theo / solver / bot
```

Scribbles Runtime is the integration host for Theo. Theo is the public-facing agent and registered GameFrame player represented by that integration.

Scribbles Runtime is not the host of the future RPG Game Master. The RPG GM belongs to a separate project and runtime that will use its own constrained GameFrame adapter. See [RPG GM Runtime Boundary](./rpg-gm-runtime-boundary.md).

```text
Theo
  ↕ Scribbles Runtime
  ↕ constrained Theo player adapter
GameFrame authoritative services

RPG GM
  ↕ separate RPG GM runtime
  ↕ constrained campaign/GameFrame adapter
GameFrame authoritative services
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

The server is authoritative for mechanics and state represented through GameFrame contracts. Browser code, Discord clients, Scribbles Runtime, the separate RPG GM runtime, and model output are untrusted callers. They may request only actions or operations that the relevant GameFrame contract permits. Neither agent runtime owns GameFrame dice, clocks, turn order, health, movement, victory, or committed encounter state.

Narrative and campaign state that has not been promoted into a GameFrame contract remains owned by the separate RPG project. GameFrame authority does not silently expand to every fact described during an RPG campaign.

## First-slice persistence

GF-0001 uses an in-memory repository so the contracts can be tested without deployment credentials or third-party dependencies. This repository is an adapter, not a permanent state model. Durable Object and conventional persistent adapters must preserve the same revision, idempotency, event, and observation contracts.

## Integration direction

- The ordinary browser client remains the base client.
- Discord Activity is a host adapter around that client.
- Cloudflare is an intended public edge and match-runtime option, not a dependency of game rules.
- Scribbles Runtime connects through a constrained player adapter, receives Theo's structured observations, and submits actions on Theo's behalf.
- The future RPG GM runtime connects through a separate campaign adapter and remains outside Scribbles Runtime.
- No integration receives direct authority over GameFrame state or direct access to another runtime's private storage and prompt lifecycle.
- The default architecture does not require a private Theo-runtime-to-RPG-runtime connection. Theo and the GM ordinarily interact through campaign-visible Discord activity and GameFrame interfaces.

## RPG campaign experience direction

The separate runtime boundary does not decide how game-heavy the RPG product becomes.

Two directions remain under consideration:

1. **Discord-first illustrated campaign** — narration, dialogue, improvisation, and most noncombat play remain in Discord; GameFrame is invoked mainly for tactical encounters and selected structured mechanics. Modular portraits, cards, prepared asset libraries, local ComfyUI generation, and optional cloud generation enrich the campaign without requiring a graphical overworld.
2. **Game-heavy hybrid RPG platform** — GameFrame expands beyond tactical encounters into persistent exploration, characters, inventory, equipment, dialogue, quests, factions, campaign state, and broader graphical interaction.

Both directions use the same separate RPG GM runtime and the same authoritative GameFrame encounter foundation. The choice is unresolved and must be evaluated through bounded prototypes. See [RPG Campaign Experience Directions](./rpg-campaign-experience-directions.md).

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

The local Node adapter uses `x-gameframe-player-id` only as an explicit development authenticator. The Cloudflare entry point rejects public game API requests until a production verifier is installed. Scribbles Runtime uses a separate service principal bound only to Theo's stable `theo` player identity.

A future RPG GM runtime must use its own service principal and narrowly scoped authorization. It must not impersonate Theo or reuse Theo's principal.

## Activity sessions

After Discord OAuth verification, GameFrame issues a short-lived HMAC-signed session cookie. The token is opaque to the game core and contains only the canonical principal and expiry metadata. The cookie is HttpOnly, Secure, `SameSite=None`, and `Partitioned`, and is scoped to the Activity's `{clientId}.discordsays.com` host.

HTTP commands and WebSocket upgrades therefore pass through the same `RequestAuthenticator`. The Worker imports `SESSION_SECRET` from the deployment environment; without it, all game APIs fail closed.
