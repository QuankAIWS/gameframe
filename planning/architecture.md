# Architecture

## System shape

Scribbles GameFrame is a modular authoritative game platform with explicit game modules and integration adapters. One authoritative service owns each match. Humans, built-in bots, and external agents submit intentions; deterministic GameFrame code validates and commits state transitions.

```text
Standalone browser ───────┐
Discord website/Activity ─┼── authenticated GameFrame boundary
rpg-gm-runtime ───────────┤
future external agents ───┘                 │
                                            ▼
                               authoritative match service
                             sessions · revisions · events
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
             game definition                     decision boundary
      rules · legal actions · outcomes       GameFrameBot / provider
```

GameFrame does not host the Dungeon Master or Theo.

- `rpg-gm-runtime` is the separate Dungeon Master and campaign authority.
- Scribbles Runtime is a separate future integration host for Theo.
- Theo may later use an explicit connector as an ordinary player.

## Game definition contract

Each game owns:

- initial state;
- active-player determination;
- legal-action enumeration;
- state transitions;
- player-specific observations;
- completion and winner semantics.

The platform owns:

- match identity;
- seats and player identity;
- action envelopes;
- revision checks;
- idempotency;
- event sequencing;
- replay;
- persistence and transport adapters.

## Authority

The server is authoritative. Browser code, Discord clients, `rpg-gm-runtime`, Scribbles Runtime, model output, and bot policies are untrusted callers. They may request only actions exposed as currently legal by the game definition.

No external caller owns dice, clocks, turn order, health, movement, resources, or victory state.

## GameFrameBot

The built-in deterministic participant uses stable player ID `gameframe-bot`.

Game-specific UI may present it as:

- CPU Opponent;
- CheckersBot;
- ArenaBot;
- Monster Master BattleBot.

These labels describe rules-based bots, not model-driven AI. Bot policies select from current legal actions and remain subject to the same authoritative submission path as human and external-agent actions.

The retired built-in `theo` seat has no compatibility guarantee and must not remain in active code, tests, fixtures, or browser copy.

## External agent connector

The versioned decision-provider boundary is generic. A future named agent connector must provide:

- authenticated service identity;
- an explicitly assigned player seat;
- player-specific observations;
- current legal actions;
- bounded deadlines;
- request correlation;
- revision and action identity.

GameFrame validates the returned action before commit. A future Scribbles Runtime connector may use this boundary for Theo, but Theo is not registered implicitly and cannot acquire hidden or Dungeon-Master-only information.

## RPG boundary

The RPG lifecycle crosses two separate authorities:

```text
rpg-gm-runtime
  campaign state · narration · encounter intent
          │
          │ structured launch
          ▼
GameFrame
  tactical rules · legal actions · match state · terminal outcome
          │
          │ structured completion
          ▼
rpg-gm-runtime
  campaign consequences · continued narration
```

The current first adapter uses Monster Master BattleBot as the deterministic opposing tactical participant. This does not make the bot the Dungeon Master and does not introduce a Scribbles Runtime dependency.

Campaign and battle identifiers must be durable and idempotent. Deployed production wiring must preserve the same encounter launch, match authority, terminal outcome, and retry contracts across process restart.

## Player seats and teams

Ordinary two-player games use two explicit distinct player IDs. A seat may be held by:

- an authenticated human;
- `gameframe-bot`;
- a future authenticated external agent identity.

Transports do not infer, replace, or impersonate identities.

RPG cooperative combat requires a separate team-aware ownership model. Multiple human campaign participants must not be forced into opposing duel seats. Future team control must map each human principal to explicit teams and controlled units while representing enemy control separately.

## Command and projection split

Game-changing actions use authenticated HTTP commands with action IDs and expected revisions. WebSockets are read-side projections only.

```text
HTTP command
  → authenticate principal
  → authorize seat
  → validate revision, turn, and legal action
  → persist snapshot and event
  → return committed player view
  → broadcast player-specific projections

WebSocket
  → initial authoritative view
  → update notification
  → explicit refresh
  → no direct mutation
```

Projection retries or failures must never become a second game-state authority.

## Persistence

The in-memory repository is a development adapter, not a permanent production state model. Durable Object, SQLite-backed, or conventional persistent adapters must preserve:

- revision ordering;
- accepted and rejected idempotency;
- event history;
- configured initial state;
- player observations;
- encounter-to-match bindings;
- terminal completion requests.

## Authentication

External transports must produce an authenticated principal before reaching match services. Public request bodies never determine the actor.

```text
external authentication
→ canonical GameFrame principal
→ seat authorization
→ command or projection
```

The Node-local `x-gameframe-player-id` header and development URL identities are explicit test mechanisms only. Hosted Discord delivery uses verified Discord identity and signed GameFrame sessions. External service connectors require separately scoped service credentials.

## Deployment direction

- The ordinary browser remains the base client.
- Discord website and Activity delivery wrap the same authoritative interfaces.
- Cloudflare Worker and Durable Objects are the intended public edge and match authority.
- `rpg-gm-runtime` integrates through an explicit service contract.
- Scribbles Runtime remains an optional future external-player integration.

GitHub Actions is currently unavailable for the active identity-cleanup branch. Repository edits do not constitute exact-head validation.
