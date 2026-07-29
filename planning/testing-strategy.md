# Testing Strategy

Validation is layered so ordinary game development does not require a live Scribbles Runtime deployment or routine GitHub Actions execution.

## Execution model

Scribbles GameFrame uses two distinct verification tiers.

### Feature-branch verification

- All active implementation work occurs on a dedicated feature branch with a draft pull request.
- The assistant runs targeted tests during iteration and the complete `npm run validate` suite before pushing a branch head represented as locally verified.
- Local verification must identify the exact tested commit SHA, execution environment, and commands used.
- Pushing commits or updating an ordinary pull request does not start GitHub Actions.
- Local verification is the normal development gate and may be repeated as often as needed without consuming canonical GitHub-hosted validation runs.

### Canonical merge verification

- When a feature or major milestone is complete, bring the branch up to date with `main` and run the complete suite locally one final time.
- Push that exact final head and freeze the branch.
- Start `Canonical Validation` either by manually dispatching the workflow against the feature branch or by applying the `canonical-validation` label to its pull request.
- The label path is intentionally limited to the `pull_request:labeled` event; ordinary pushes, synchronization, opening, and review-state changes do not occupy the runner.
- The canonical job runs on a GitHub-hosted runner; public GameFrame code must not execute on the private self-hosted runner.
- The canonical `validate` job must pass before merge.
- Any commit added after the canonical pass invalidates that pass and requires another local and canonical run.
- The GitHub Actions result is the durable repository record; local reports remain supporting development evidence.

## Layer 1 — Deterministic core

- Game-rule unit tests
- Legal-action invariants
- Complete win/draw coverage
- Exhaustive perfect-player non-loss proof for tic-tac-toe

## Layer 2 — Match contracts

- Player identity and turn ownership
- Stale revision rejection
- Duplicate action idempotency
- Completed-match rejection
- Event replay equivalence

## Layer 3 — Local service integration

- Match creation through HTTP
- Human action followed by deterministic Theo response
- Observation retrieval
- Health and error behavior

## Layer 4 — Browser acceptance

- Render a board
- Start a match
- Submit moves through the application boundary
- Reach a deterministic completed state
- Exercise desktop and mobile viewports

The current `check:browser` command is a JavaScript syntax check. Full automated browser interaction remains an implementation task and must not be claimed until a headless acceptance test is included in `npm run validate`.

## Layer 5 — External canaries

These cannot be claimed from local or canonical repository validation:

- Discord Activity launch, identity, proxy, and mobile behavior
- Cloudflare deployed Worker/Durable Object behavior and quotas
- Scribbles Runtime adapter compatibility and real Theo model-driven decisions
- Production or staging recovery

Reports must distinguish assistant-local execution, canonical GitHub Actions validation, and live-environment proof.

## WebSocket projection tests

Local contract tests prove:

- A socket is attached only after its player-specific view resolves.
- Each connection receives an initial authoritative view.
- Match updates fan out only to subscribers of that match.
- Every subscriber receives its own player-specific observation.
- Refresh messages recover current state after reconnect or uncertainty.
- Game-changing messages are rejected on the WebSocket channel.
- Projection delivery failure does not roll back an accepted command.

Real hibernation across `workerd` eviction remains an external runtime test until Cloudflare's development packages can be installed and locked.

## Authentication and authorization tests

- Anonymous game API calls fail closed.
- The creator must occupy one requested seat.
- Reads and actions derive identity from the authenticated request principal.
- Conflicting client-supplied identity claims are rejected.
- Rejected impersonation attempts do not mutate the match.
- WebSocket attachments receive only the authenticated principal's observation.
- Development authentication is explicitly separate from the production Discord and service verifiers.
- Scribbles Runtime service credentials map only to Theo's stable `theo` player identity.

## Signed session tests

- Valid signed sessions recover the original principal.
- Signature modification fails closed.
- Expired and malformed sessions fail closed.
- Cookie parsing does not expose or reinterpret client identity claims.
- Activity cookies include Discord's required iframe and partitioning attributes.
- Cloudflare uses the configured secret for both HTTP and WebSocket request authentication.

## Public artifact safety

Workflow logs, screenshots, traces, and artifacts must be assumed public. Test fixtures must use synthetic credentials and synthetic users. Diagnostics must not capture production cookies, secrets, private campaign state, private user data, or privileged administration interfaces.
