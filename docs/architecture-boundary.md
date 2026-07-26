# Scribbles GameFrame Architecture Boundary

## Purpose

Scribbles GameFrame provides a reusable game environment that can be developed, simulated, and tested independently from the broader Scribbles agent runtime.

The repositories are peers:

- **Scribbles GameFrame** owns games and game sessions.
- **Scribbles Runtime** owns agents and runtime services.

Neither repository should require knowledge of the other repository's internal directory structure or implementation details.

## GameFrame responsibilities

GameFrame is responsible for:

- authoritative game state;
- rules validation and action resolution;
- session lifecycle and participant slots;
- turn, phase, timing, and outcome mechanics;
- deterministic simulation where practical;
- game-facing rendering or transport adapters;
- test fixtures and automated playtesting.

## Runtime responsibilities

Scribbles Runtime is responsible for:

- agent identity and persona;
- model and tool execution;
- long-term memory and context assembly;
- policy and safety enforcement;
- channel and platform integration;
- general orchestration outside a game session.

## Integration contract

The initial runtime integration should use an explicit adapter or protocol with versioned request and response schemas. The contract should expose only what a participant needs to observe a game state and submit a legal action.

GameFrame tests must be able to replace the runtime with deterministic mock participants. Runtime tests must be able to replace GameFrame with a contract fixture. This preserves independent development and makes failures attributable to the correct system.

## Dependency rules

1. Do not import Scribbles Runtime internals into GameFrame.
2. Do not make GameFrame depend on a runtime checkout, filesystem path, branch name, or deployment layout.
3. Place shared schemas behind an explicitly versioned boundary.
4. Keep game rules independent from Discord, web, or other presentation transports.
5. Introduce cross-repository automation only when the contract is stable enough to justify it.

## Naming policy

Use the **Scribbles** namespace for active product names, package names, configuration keys, documentation, test identifiers, and future deployment artifacts.

Use **Theo** only when documenting project history or when an explicit compatibility layer must preserve a legacy external identifier. Compatibility identifiers should be isolated and documented rather than allowed to become active architectural names.
