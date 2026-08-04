---
title: RPG GM Runtime Boundary
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime
related:
  - rpg-campaign-experience-directions.md
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
---

# RPG GM Runtime Boundary

## Decision

The RPG Game Master is a separate project and runtime. It is not hosted, configured, spawned, supervised, or persisted by Scribbles Runtime.

GameFrame is the complete player-facing RPG interface. RPG GM Runtime is the campaign-intelligence backend. Scribbles Runtime owns Theo and only the connector required for Theo to participate as an ordinary GameFrame player.

## Ownership

### Scribbles GameFrame

GameFrame owns:

- the complete browser and Discord Activity RPG interface;
- campaign client sessions, player authentication, seats, invitations, and resume;
- authenticated player commands and server-derived principals;
- scene, dialogue, card, choice, check, character, inventory, quest, map, and encounter presentation;
- player-visible structured campaign projections;
- mechanics explicitly implemented through GameFrame contracts;
- tactical maps, legal actions, turns, effects, hidden tactical information, replay, persistence, reconnect, and committed outcomes;
- responsive layout, animation, accessibility, and presentation-state behavior.

GameFrame does not automatically own every narrative fact or semantic campaign concept. State remains runtime-owned unless it is deliberately promoted into a structured GameFrame mechanic.

### RPG GM Runtime

RPG GM Runtime owns:

- the authoritative campaign journal and runtime-owned campaign revision;
- semantic world and character continuity outside GameFrame-owned mechanics;
- narration, scene construction, NPC reasoning, dialogue intent, factions, quests, and narrative progression;
- interpretation of freeform player intent;
- audience classification for public, party, player-private, and runtime-only information;
- proposals for choices, checks, structured campaign changes, and tactical encounters;
- model context construction, provider routing, evaluation, retries, fallback, and recovery;
- mapping committed GameFrame outcomes into campaign consequences;
- campaign media requests and stable asset references unless a specific asset becomes GameFrame-owned.

Model prose is not campaign truth until validated and committed to the runtime journal.

### Scribbles Runtime

Scribbles Runtime owns:

- Theo's model behavior and runtime lifecycle;
- translation between Theo's authorized GameFrame observation and his model context;
- submission of Theo's selected legal GameFrame command;
- correlation, authorization, timeout, and deterministic fallback behavior for Theo's player connector.

Scribbles Runtime does not own campaign state, GM context, NPC memory, narration, quests, or RPG-specific orchestration.

## Integration shape

```text
Human players ─┐
Theo ──────────┼─> GameFrame player interface and command boundary
               │          ↕
               │   versioned RPG contracts
               │          ↕
               └─> RPG GM Runtime

Theo model behavior
        ↕
Scribbles Runtime
        ↕ ordinary player connector
GameFrame
```

The ordinary design does not require a private Scribbles Runtime-to-RPG GM Runtime connection. Theo and the GM interact through the same GameFrame campaign surfaces available to their respective authenticated roles.

## Contract rules

- No direct reads or writes across repository databases, queues, prompts, tools, secrets, or lifecycle controls.
- The RPG GM uses a dedicated service principal and never impersonates Theo or a human player.
- Player identity is derived from authenticated GameFrame context, never client payloads.
- HTTP or an equivalent authoritative service boundary owns mutations; WebSockets remain projections unless the same command contract is preserved.
- Contracts are versioned, runtime-validated, bounded, idempotent, audience-scoped, and recoverable after timeout or disconnect.
- GameFrame consumes semantic presentation events, not arbitrary runtime-authored browser code.
- RPG GM Runtime consumes structured mechanical outcomes, not combat prose.

## Development consequences

- GameFrame builds the complete RPG shell against deterministic fixtures before production model integration.
- RPG GM Runtime builds campaign semantics against a mock GameFrame port and frozen fixtures.
- Integration begins from versioned shared fixtures rather than assumptions about private implementations.
- New noncombat mechanics enter GameFrame only when a concrete campaign need justifies their schema, authority, persistence, UI, migrations, and tests.
- Tests remain repository-specific, with compact cross-repository compatibility checks for shared fixtures.

## Non-goals

This boundary does not require:

- duplicating GameFrame's tactical engine in the runtime;
- moving GM reasoning or campaign secrets into the browser client;
- making Discord the main campaign interface;
- converting every improvised narrative object into a dedicated mechanic;
- preventing reusable shared libraries where ownership and versioning remain explicit.
