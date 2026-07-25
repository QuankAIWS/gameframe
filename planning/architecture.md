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
