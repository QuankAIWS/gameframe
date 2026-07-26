# OpenClaw Integration Boundary

## Decision

Theo GameFrame will integrate with OpenClaw through a dedicated native plugin package after the public match API is stable. The plugin is an outbound client of GameFrame; it does not embed game state into OpenClaw or ThreadLens.

## Initial plugin shape

The first version should be a tool plugin exposing a small, stable contract:

```text
gameframe_match_get
  Read Theo's player-specific observation and legal actions.

gameframe_action_submit
  Submit one selected legal action with match revision and action ID.

gameframe_match_create
  Create a match only when the current Discord interaction authorizes it.

gameframe_match_summary
  Read a compact public result or replay summary for narration.
```

Tool outputs must be structured JSON. Theo receives only his observation, legal actions, relevant public history, and explicit game objectives. He does not receive hidden opponent information or storage credentials.

## Later asynchronous behavior

A pure tool plugin is sufficient when a Discord message or command already starts a Theo turn. Games that need Theo to act without a new user message may require a mixed plugin with a plugin-owned background service or scheduled session turn. That addition should be made only after the exact OpenClaw runtime contract is inspected and validated against the pinned Theo runtime.

## Authentication

- The plugin uses a dedicated GameFrame service credential.
- The credential authorizes only Theo-player operations.
- Administrative and deployment credentials remain separate.
- Requests include a stable Theo player identity, match ID, action ID, and expected revision.
- The GameFrame server validates every action; plugin or model output is never trusted directly.

## Repository boundary

The GameFrame-facing plugin may begin under `theo-gameframe/integrations/openclaw/` while contracts are changing. It should move to a separate package or repository only when independent release, security ownership, or OpenClaw compatibility validation makes that operationally useful.

## Validation

- Unit-test the HTTP client against fixture responses.
- Validate plugin metadata and declared tool ownership.
- Pack and install the plugin into the exact pinned OpenClaw runtime.
- Prove tool discovery, player-specific observations, accepted actions, stale-action handling, and unavailable-GameFrame behavior.
- Run one compact live Discord/model canary only after deterministic compatibility is green.
