# Scribbles Runtime Integration Boundary

## Decision

Scribbles GameFrame integrates with `codename-scribbles-runtime` through a dedicated native adapter after the public match API is stable. Scribbles Runtime hosts the public-facing Theo agent and calls GameFrame on Theo's behalf. The adapter is an outbound client of GameFrame; it does not embed authoritative game state into the runtime, memory system, or conversation machinery.

## Initial adapter shape

The first version should expose a small, stable tool contract:

```text
gameframe_match_get
  Read Theo's player-specific observation and legal actions.

gameframe_action_submit
  Submit one Theo-selected legal action with match revision and action ID.

gameframe_match_create
  Create a match only when the current Discord interaction authorizes it.

gameframe_match_summary
  Read a compact public result or replay summary for Theo's narration.
```

Tool outputs must be structured JSON. Scribbles Runtime receives only Theo's player-specific observation, legal actions, relevant public history, and explicit game objectives. It does not receive hidden opponent information or storage credentials.

## Later asynchronous behavior

A pure tool adapter is sufficient when a Discord message or command already starts Theo's turn. Games that require Theo to act without a new user message may need a runtime-owned background service or scheduled session turn. That addition should be made only after the exact bespoke runtime contract is implemented and validated.

## Authentication

- The adapter uses a dedicated GameFrame service credential.
- The credential authorizes only the stable `theo` player identity.
- Administrative and deployment credentials remain separate.
- Requests include Theo's player identity, match ID, action ID, and expected revision.
- The GameFrame server validates every action; runtime or model output is never trusted directly.

## Repository boundary

The GameFrame-facing adapter may begin under `scribbles-gameframe/integrations/scribbles-runtime/` while contracts are changing. It should move elsewhere only when independent release, security ownership, or runtime compatibility validation makes that operationally useful.

GameFrame must not import runtime internals or depend on a runtime checkout, branch name, filesystem layout, or deployment process. Shared payloads should be versioned contracts with fixtures on both sides.

## Validation

- Unit-test the HTTP client against fixture responses.
- Validate adapter metadata and declared tool ownership.
- Install the adapter into the exact pinned Scribbles Runtime revision.
- Prove tool discovery, Theo-specific observations, accepted actions, stale-action handling, and unavailable-GameFrame behavior.
- Run one compact live Discord/model canary only after deterministic compatibility is green.
