# Scribbles Runtime Integration Boundary

## Decision

Scribbles GameFrame integrates with Scribbles Runtime through a dedicated native adapter after the public match and decision contracts are stable. Scribbles Runtime hosts the public-facing Theo agent and acts on Theo's behalf. It does not embed authoritative game state into the runtime, memory system, or conversation machinery.

GameFrame remains independently operable with human players, deterministic agents, and mock decision providers. A live Scribbles Runtime deployment is not required for repository development or ordinary game validation.

## Versioned turn-decision contract

The canonical Theo turn boundary is the versioned provider contract in [`planning/agent-decision-protocol.md`](agent-decision-protocol.md).

For an agent-owned turn, GameFrame produces one structured request containing:

- Protocol version
- Request ID
- Game and match IDs
- Stable player ID `theo`
- Expected match revision
- Theo's player-specific observation
- Complete enumerated legal actions
- Optional deadline

Scribbles Runtime returns one structured response containing:

- Matching protocol, request, player, and revision fields
- A unique action ID
- One structured action equivalent to a currently legal action
- Optional commentary and diagnostic metadata

GameFrame validates and commits the action through the normal authoritative match path. Runtime prose is never parsed to determine the action.

The initial GameFrame implementation is transport-neutral and uses in-process mock providers. The later Runtime adapter may expose an authenticated HTTPS endpoint, queue consumer, or another explicit transport without changing the payload semantics.

## User-triggered tool surface

A small Runtime tool surface may still be useful when a Discord message or command initiates game activity:

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

These tools do not replace the provider protocol. They are user- or conversation-triggered operations around matches. Autonomous or service-driven Theo turns should use the same versioned decision semantics, whether wrapped as a tool call or exposed as a direct provider endpoint.

Tool outputs must be structured JSON. Scribbles Runtime receives only Theo's player-specific observation, legal actions, relevant public history, and explicit game objectives. It does not receive hidden opponent information or storage credentials.

## Authentication

- GameFrame and Scribbles Runtime use dedicated service credentials.
- The Runtime provider credential authorizes only stable player identity `theo`.
- Network authentication is separate from the payload's `playerId`; claiming `theo` in JSON grants no authority.
- Administrative and deployment credentials remain separate.
- Requests preserve match, request, action, and revision IDs exactly.
- GameFrame validates every returned action; Runtime or model output is never trusted directly.

## Failure behavior

Without a configured deterministic fallback, unavailable, timed-out, malformed, mismatched, stale, duplicate, or illegal Runtime responses fail closed and commit no provider action.

When a deterministic fallback is configured, it must represent the same stable player identity and submit through the same authoritative match validation path.

## Repository boundary

The GameFrame-facing adapter may begin under `scribbles-gameframe/integrations/scribbles-runtime/` while transport code is changing. It should move elsewhere only when independent release, security ownership, or runtime compatibility validation makes that operationally useful.

GameFrame must not import Runtime internals or depend on a Runtime checkout, branch name, filesystem layout, repository identifier, or deployment process. Shared payloads are versioned contracts with fixtures on both sides.

Canonical version-1 fixtures:

- `test/fixtures/agent-decision/request-v1.json`
- `test/fixtures/agent-decision/response-v1.json`

## Validation

- Unit-test request construction and response validation.
- Test deterministic, scripted, seeded-random, delayed, unavailable, malformed, illegal, duplicate, stale, and mismatched providers.
- Prove provider-supplied action IDs reach authoritative event history.
- Retain equivalent request and response fixtures in both repositories.
- Unit-test any HTTP or queue transport against those fixtures.
- Install the adapter into the exact pinned Scribbles Runtime revision when available.
- Prove service authentication, Theo-specific observations, accepted actions, stale-action handling, timeouts, fallback, and unavailable-GameFrame behavior.
- Run one compact live Runtime and Discord canary only after deterministic compatibility is green.
