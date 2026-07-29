# 0009 — Defer External Canaries Without Blocking Repository Development

- **Status:** Accepted
- **Date:** 2026-07-29
- **Scope:** Standalone Cloudflare and Discord canary scheduling relative to mock-agent, checkers, and tactical development
- **Amends:** `0007-platform-proof-sequence-and-mock-agents.md`

## Context

The Tic-Tac-Toe browser proof and real Workers-runtime validation are complete and canonically validated. The next external checkpoint was intended to be a compact standalone Cloudflare deployment canary.

That canary requires deployment-account access, secrets, environment configuration, and owner availability. Those prerequisites are temporarily unavailable. Treating the external canary as a hard prerequisite for all further repository development would idle work that can still be validated deterministically, through the local Workers runtime, through real browser acceptance, and through the GitHub-hosted canonical merge gate.

The deployment proof remains important. Deferring it must not be represented as completing it, replacing it with local tests, or weakening the evidence boundary.

## Decision

The standalone Cloudflare and Discord canaries are **paused until the repository owner is available for deployment setup**. They remain required external checkpoints, but they do not block continued repository development.

The active sequence becomes:

```text
completed Tic-Tac-Toe browser and Workers proof
        -> versioned agent decision contract and mock connector
        -> production-complete American checkers module
        -> checkers browser and repository proof
        -> tactical battler foundation

paused external lane, resumed when owner is available:
standalone Cloudflare canary
        -> Discord Activity delivery canary
        -> deployed mock-agent and checkers canaries where useful
```

The canaries may be resumed between any of the repository milestones. Their deferral does not change what they must prove.

## Development allowed while canaries are paused

Repository work may continue on:

- The versioned decision-provider request and response schemas
- Mock-provider implementations and failure modes
- GameFrame-side validation, correlation, revision, legality, and idempotency behavior
- American checkers rules, service integration, deterministic opponents, browser interaction, replay, and recovery
- Tactical renderer and rules-core development after the checkers generalization proof
- Local Workers-runtime, Playwright, deterministic, and GitHub-hosted canonical validation

No work may claim deployed Cloudflare, Discord Activity, networked mock-provider, production recovery, quota, or live Scribbles Runtime evidence unless the corresponding external canary actually runs.

## Return gate

When the repository owner is available, resume `GF-0004` with a deliberately bounded setup session. The minimum standalone canary must verify:

- Static asset delivery
- Worker API routing
- Durable Object persistence
- Signed or otherwise production-appropriate authentication configuration
- Player-specific WebSocket projections
- Refresh and reconnect
- Match resume after object reconstruction or deployment restart conditions that can be safely exercised
- Human and deterministic-agent completion

Discord and live Scribbles Runtime integration remain separate canaries.

## Consequences

### Positive

- Development does not stall on temporary deployment-account availability.
- The mock-agent contract can be designed on both repository sides before the live Runtime is ready.
- Checkers can expose game-module and interaction defects before the tactical battler.
- External evidence remains clearly distinguished from repository evidence.

### Costs and risks

- Deployment-specific defects may remain undiscovered longer.
- Later canary work may reveal assumptions made during checkers or tactical development.
- The roadmap must keep the paused canary visible so it is not silently forgotten.

The accepted judgment is that continuing well-tested repository work is preferable to idling, provided the external canary remains an explicit unresolved checkpoint.