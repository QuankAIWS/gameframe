# GameFrame Agent Decision Protocol

## Purpose

This document defines the versioned structured boundary used when Scribbles GameFrame asks a nonhuman player to choose one currently legal action. It is implemented first by deterministic and mock providers. Scribbles Runtime will later implement the same provider contract for Theo without becoming the authority for game state.

The protocol transports decisions. It does not transport state mutations. GameFrame remains responsible for identity, revision, legality, idempotency, persistence, event sequencing, visibility, and victory state.

## Version

The initial protocol version is the string `"1"`.

Unknown protocol versions fail closed. Version negotiation is not implicit: a future incompatible schema requires a new explicit version and compatibility fixtures.

## Decision request

```json
{
  "protocolVersion": "1",
  "requestId": "decision-01J...",
  "gameId": "tic-tac-toe",
  "matchId": "match-01J...",
  "playerId": "theo",
  "expectedRevision": 17,
  "observation": {},
  "legalActions": [],
  "deadlineAt": "2026-07-29T22:15:00.000Z"
}
```

Required fields:

- `protocolVersion`: exactly `"1"`
- `requestId`: unique correlation ID for this pending decision
- `gameId`: stable GameFrame game-module identifier
- `matchId`: authoritative match identifier
- `playerId`: stable assigned agent identity; Theo is `theo`
- `expectedRevision`: non-negative authoritative revision observed by the provider
- `observation`: player-specific structured observation
- `legalActions`: complete structured legal-action enumeration for that player and revision

Optional fields:

- `deadlineAt`: ISO-8601 timestamp after which GameFrame may ignore the response and apply documented timeout or fallback behavior

The provider must not infer or manufacture hidden game state. It chooses only from `legalActions` using `observation` and any permitted public context supplied inside that observation.

## Decision response

```json
{
  "protocolVersion": "1",
  "requestId": "decision-01J...",
  "playerId": "theo",
  "expectedRevision": 17,
  "actionId": "theo-action-01J...",
  "action": {},
  "commentary": "Optional non-authoritative explanation.",
  "metadata": {}
}
```

Required fields:

- `protocolVersion`: exactly `"1"`
- `requestId`: exact request correlation
- `playerId`: exact assigned player identity
- `expectedRevision`: exact request revision
- `actionId`: non-empty provider-generated idempotency key
- `action`: one structured action exactly equivalent to a member of `legalActions`

Optional fields:

- `commentary`: non-empty human-readable explanation; never parsed as authority
- `metadata`: structured diagnostic information; never used to infer the action

## GameFrame validation order

Before committing a provider response, GameFrame validates:

1. The response is an object with the required shape.
2. `protocolVersion` is supported.
3. `requestId` matches the pending request.
4. `playerId` matches the assigned agent seat.
5. `expectedRevision` still matches the request revision.
6. `actionId` is non-empty and has not already been accepted or reused by the provider adapter.
7. `action` is currently equivalent to one enumerated legal action.
8. The authoritative match session still accepts the action for that player and revision.

A provider response never bypasses the normal match command path.

## Failure behavior

The provider adapter classifies at least:

- `provider_unavailable`
- `provider_timeout`
- `malformed_response`
- `protocol_mismatch`
- `request_mismatch`
- `player_mismatch`
- `stale_revision`
- `invalid_action_id`
- `illegal_action`
- `duplicate_action_id`
- `missing_context`

Without a configured fallback, these failures fail closed and no provider action is committed.

With a configured deterministic fallback representing the same stable player identity, GameFrame may choose a fallback action through the ordinary `AgentPlayer` contract. Fallback action IDs are generated separately and remain subject to normal session validation.

## Mock-provider modes

The durable mock provider supports:

- Deterministic first-legal selection
- Scripted action sequence
- Seeded-random legal selection
- Delayed response
- Unavailable provider
- Malformed response
- Illegal action
- Duplicate action ID
- Stale revision
- Mismatched request ID
- Mismatched player identity

These modes are maintained QA infrastructure, not disposable test scaffolding.

## Transport

The TypeScript contract is transport-neutral. Initial tests invoke the provider in process. A later remote adapter may use HTTPS, a queue, a runtime-owned service, or another explicit transport provided that it preserves the exact request and response semantics.

Network authentication is separate from `playerId`. A remote provider credential must be bound server-side to the permitted stable player identity. The payload does not grant identity merely by claiming `"playerId": "theo"`.

## Scribbles Runtime compatibility

Scribbles Runtime should implement a provider endpoint or adapter that:

- Accepts protocol-version-1 requests
- Verifies the GameFrame service caller
- Routes the observation and legal actions to Theo's bounded game-decision capability
- Returns one structured action without requiring GameFrame to parse prose
- Preserves request, player, revision, and action IDs exactly
- Does not receive hidden opponent state or GameFrame storage credentials

The canonical fixtures are:

- `test/fixtures/agent-decision/request-v1.json`
- `test/fixtures/agent-decision/response-v1.json`

Both repositories should retain equivalent fixtures and compatibility tests before live integration is claimed.
