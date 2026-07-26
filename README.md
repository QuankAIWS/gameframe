# Scribbles GameFrame

Scribbles GameFrame is the game-session and interaction framework for **Codename Scribbles**.

## Status

Early architecture scaffold. The repository is being developed in parallel with `codename-scribbles-runtime` and is intentionally able to evolve and test independently before the two systems are integrated.

## Responsibilities

Scribbles GameFrame will own:

- game rules and deterministic state transitions;
- sessions, players, turns, actions, and outcomes;
- presentation and interaction adapters;
- isolated game simulation and playtesting;
- the boundary through which Scribbles Runtime participants enter a game.

It will not own agent identity, long-term memory, policy enforcement, model execution, or general runtime orchestration. Those concerns belong to Scribbles Runtime.

## Integration principle

GameFrame should remain testable with local or mock participants. Integration with Scribbles Runtime should occur through an explicit, versioned contract rather than direct dependency on runtime internals.

See [`docs/architecture-boundary.md`](docs/architecture-boundary.md).

## Development baseline

- `main` remains the stable integration branch.
- Development should occur on focused branches and enter through pull requests.
- Tests should be added with each implemented game or framework capability.
- Scheduled or runner-intensive automation should not be introduced without an explicit need.

## Rename

This repository was renamed from **Theo GameFrame** (`theo-gameframe`) to **Scribbles GameFrame** (`scribbles-gameframe`) on July 26, 2026. Active code, configuration, packages, and documentation should use the Scribbles namespace. Historical references may remain where they are necessary to describe provenance or compatibility.
