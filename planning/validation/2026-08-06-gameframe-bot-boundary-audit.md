# GameFrameBot boundary audit — 2026-08-06

## Status

Implementation and documentation cleanup is in progress on `agent/rpg-encounter-battle-loop`.

GitHub Actions and the local runner were unavailable during this audit. This record does **not** claim that the branch passed Node, Workers-runtime, Playwright, visual, or canonical validation.

## Corrected boundary

- Built-in deterministic opponents use `gameframe-bot`.
- Generic presentation uses **GameFrameBot**.
- Game-specific presentation may use **CPU Opponent**, **CheckersBot**, **ArenaBot**, or **Monster Master BattleBot**.
- Built-in bots are rules-based and are not presented as model-driven AI.
- `rpg-gm-runtime` owns the Dungeon Master and campaign authority.
- Scribbles Runtime is a separate future integration host for Theo.
- Theo may later join through an explicit connector as an ordinary player, but is not a built-in opponent, deterministic fallback, or Dungeon Master.
- No compatibility alias for the retired built-in seat is retained because GameFrame has not been deployed with persistent production data.

## Audit surface

The cleanup covers:

- authoritative match services;
- the RPG encounter-to-battle coordinator;
- browser controllers and visible opponent copy;
- browser selectors and journeys;
- Node HTTP tests;
- Durable Object and Workers-runtime tests;
- decision-provider fixtures;
- repository doctrine and integration contracts;
- the repository self-check.

## Required validation when infrastructure returns

1. Run browser JavaScript syntax checks.
2. Run the repository self-check and Node test suite.
3. Run Workers-runtime tests.
4. Run required Playwright journeys.
5. Run the full browser and visual suites if the required lane is green.
6. Record the exact tested commit and environment.
7. Merge only after the exact PR head is validated.
