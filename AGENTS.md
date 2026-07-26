# AGENTS.md — Scribbles GameFrame

Scribbles GameFrame is a private, bespoke game platform for Codename Scribbles. It is not a generalized public game engine, plugin marketplace, or production SaaS platform. The immediate objective is to prove the complete multiplayer and integration architecture with tic-tac-toe before expanding into tactical, chess, RPG, or RTS modules.

## Startup

1. Read the AI Workspace Software Development Doctrine.
2. Read this file.
3. Read `planning/ROADMAP.md`, `planning/architecture.md`, and `planning/testing-strategy.md`.
4. Inspect the affected code and tests before editing.

## Canonical commands

```bash
npm test
npm run validate
npm run dev
```

The repository currently has no third-party runtime or development dependencies. Node 22.16.0 is pinned in `.nvmrc`; TypeScript files execute through Node's erasable-type support. Do not introduce dependencies without a concrete need and a lockfile update.

## Architectural boundaries

- `src/platform` owns transport-neutral game and match contracts.
- `src/games/*` owns game-specific state, rules, observations, and legal actions.
- `src/agents` owns nonhuman decision contracts. Scribbles Runtime is an adapter, not the authority for game mechanics.
- `src/server` owns the current authoritative process boundary. Browser clients never mutate state directly.
- Discord, Cloudflare, and Scribbles Runtime integrations must enter through explicit adapters. Do not scatter vendor SDK calls through game logic.
- Event history, revision checks, idempotency, and visibility are correctness requirements, not deployment polish.
- HTTP owns commands; WebSockets are projection-only. Do not introduce a second mutation path without preserving the same validation and idempotency contracts.

## Current active lane

`GF-0002`: Cloudflare-compatible authoritative match runtime and deployment boundary.

## Validation posture

Local or assistant-environment verification can prove deterministic rules, session contracts, replay, HTTP behavior, and browser behavior. It must be recorded accurately but does not replace canonical CI. Keep consequential work on branches and require the self-hosted GitHub runner before merge whenever that runner is available. Real Discord, Cloudflare, and Scribbles Runtime behavior require later compact canaries and must not be claimed from local tests.
