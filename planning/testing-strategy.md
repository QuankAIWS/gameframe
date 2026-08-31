# Testing Strategy

Validation is layered so ordinary game development does not require a live Scribbles Runtime deployment or an exhaustive GitHub Actions run on every edit.

The target posture is that deployment canaries confirm environment integration. They should not be the first place ordinary game-rule, browser-flow, reconnect, or agent-contract defects are discovered.

## Execution model

Scribbles GameFrame uses three repository and environment verification tiers.

### Feature-branch verification

- All active implementation work occurs on a dedicated feature branch with a draft pull request.
- Development work uses targeted tests during iteration and the complete `npm run validate` suite before a branch head is represented as locally verified.
- Local verification must identify the exact tested commit SHA, execution environment, and commands used.
- Pull requests that touch routed UI/game surfaces may start the scoped `Feature UI Review` workflow automatically. That workflow is change-sensitive and is not the canonical full-repository validation marker.
- Local verification remains the normal iteration gate and may be repeated as often as needed without deliberately starting canonical full-repository validation.
- Browser screenshots, traces, and reports produced locally are development evidence, not canonical GitHub evidence.

### Canonical merge verification

- When a feature or major milestone is complete, bring the branch up to date with `main` and run the complete suite locally one final time.
- Push that exact final head and freeze the branch.
- Start `Canonical Validation` either by manually dispatching the workflow against the feature branch or by applying the `canonical-validation` label to its pull request.
- The label path is intentionally limited to the `pull_request:labeled` event; ordinary pushes, synchronization, opening, and review-state changes do not occupy the runner.
- The canonical workflow requires a committed `package-lock.json`, installs exclusively with `npm ci`, installs the pinned Playwright Chromium runtime, and runs the complete `npm run validate` suite.
- The canonical job runs on a GitHub-hosted runner; public GameFrame code must not execute on persistent self-hosted runners.
- The canonical `validate` job must pass before merge.
- Any commit added after the canonical pass invalidates that pass and requires another local and canonical run.
- The GitHub Actions result is the durable repository record; local reports remain supporting development evidence.
- Stable visual-regression baselines should be generated and accepted in the canonical environment when environment-dependent rendering makes cross-machine comparison noisy.

### Scheduled campaign regression exception

Cascade Crush has an explicit scaling exception to the no-routine-schedule posture: `.github/workflows/cascade-nightly.yml` may run a sharded full-campaign deterministic profile at 06:00 UTC after recent balance-relevant Cascade development. It is a regression safety net, not a pull-request merge gate and not a substitute for `Canonical Validation`. Manual dispatch remains available for major checkpoints.


### External canary verification

External canaries are deliberately separate from repository validation. They prove deployed environment behavior and may be run with human players, deterministic opponents, or the mock remote-agent connector before Scribbles Runtime is available.

Reports must distinguish local execution, canonical GitHub Actions validation, deployed Cloudflare proof, Discord Activity proof, mock-agent proof, and real Scribbles Runtime proof.

## Layer 1 — Deterministic rules and simulation

Required coverage includes:

- Game-rule unit tests
- Legal-action invariants
- Complete win, loss, and draw coverage
- Event replay equivalence
- Seeded deterministic simulation
- Bot-versus-bot completed games
- Property or fuzz tests when they provide useful state-space coverage

Tic-tac-toe should retain exhaustive perfect-player non-loss proof.

American checkers should cover at least:

- Dark-square movement
- Mandatory capture enforcement
- Multi-jump continuation and termination
- Promotion timing
- King movement and captures
- Win conditions
- Draw, repetition, or no-progress policy
- Complete deterministic games from representative positions

## Layer 2 — Match contracts

- Player identity and turn ownership
- Stale revision rejection
- Duplicate action idempotency
- Completed-match rejection
- Unauthorized and impersonation rejection
- Event replay equivalence
- Match restoration after process or object reconstruction
- Player-specific observations
- Hidden-information nonleakage where applicable
- Deterministic fallback behavior

## Layer 3 — Local service integration

- Match creation through HTTP
- Human-versus-human action flow
- Human action followed by deterministic opponent response
- Observation retrieval
- Health and error behavior
- Reconnect and refresh
- Competing commands
- Projection failure isolation
- Storage restoration

Service tests should exercise the same public application boundary used by browser and deployed clients rather than bypassing authority with direct state mutation.

## Layer 4 — Workers-runtime integration

Fake storage and process tests remain useful, but Cloudflare runtime behavior must also be tested inside real `workerd` or the currently supported Workers test runtime.

The repository pins Wrangler, Vitest, and `@cloudflare/vitest-pool-workers` exactly. The `test:workerd` command loads `wrangler.jsonc` and executes serially with shared test storage because hibernatable WebSocket tests are incompatible with per-file storage isolation.

Current real-runtime coverage includes:

- Production Worker entry-point loading with declared Durable Object and asset bindings
- Committed match recovery after Durable Object eviction
- Competing revision-zero write serialization
- Hibernatable WebSocket attachment recovery and refresh after eviction
- Signed session behavior shared by HTTP requests and WebSocket upgrades

Coverage should continue to include:

- Durable Object bindings
- Snapshot and event persistence
- Object reconstruction after eviction
- Competing writes
- Hibernating WebSocket attachment and restoration
- Player-specific projection fan-out
- Refresh after reconnect or uncertainty
- Runtime serialization compatibility
- Configuration and binding failures that should fail closed

A fake-runtime test must not be reported as proof of real Workers-runtime behavior.

## Layer 5 — Browser acceptance

The ordinary browser client is the base GameFrame interface. Browser acceptance uses real headless interaction through the ordinary HTTP application boundary.

Coverage should include:

- Render the game board or Canvas viewport
- Start, create, and join a match
- Select cells, pieces, units, or actions
- Display legal actions and reject illegal input
- Complete deterministic game flows
- Resume and reconnect
- Refresh projections
- Display finished, stale, unauthorized, and error states
- Exercise desktop and mobile viewport dimensions
- Exercise keyboard and pointer input where supported
- Exercise touch-oriented layouts or equivalent mobile interactions

The repository uses Playwright through `npm run test:browser`, and `npm run validate` includes that browser suite. Current tic-tac-toe coverage proves deterministic Theo completion with refresh and resume, two independent browser seats sharing and completing one match, visible invalid-resume handling, and a mobile layout without horizontal overflow. `check:browser` remains the fast JavaScript syntax check; it does not replace the Playwright suite.

## Layer 6 — Visual QA

Visual QA has two purposes: regression detection and design review.

### Deterministic visual regression

Use screenshot comparison for stable screens and deterministic game states, including representative desktop and mobile layouts. Keep the test surface narrow enough that harmless animation or timing variance does not make the suite unreliable.

The canonical GitHub-hosted environment is the authority for accepted environment-sensitive baselines. Baseline updates require explicit review and must not be automatically regenerated merely because a comparison failed.

### Curated design evidence

Development work may produce screenshots or short captures for human evaluation of:

- Layout and hierarchy
- Canvas readability
- Responsive behavior
- Legal-action highlighting
- Error states
- Match completion
- Tactical camera and viewport behavior

Curated concept or review images are not substitutes for automated interaction tests.

## Layer 7 — External canaries

These cannot be claimed from local or canonical repository validation:

- Deployed Cloudflare Worker and Durable Object behavior
- Deployed persistence, eviction, reconnect, and recovery
- Discord Activity launch, identity, proxy, invite or resume, and mobile behavior
- Mock remote-agent network behavior
- Scribbles Runtime adapter compatibility
- Real Theo model-driven decisions
- Production or staging recovery
- Quota and platform-limit behavior

The initial deployed GameFrame and Discord canaries do not require a live Scribbles Runtime. Human seats, deterministic opponents, and the mock remote-agent connector are valid canary participants.

## Agent decision-provider tests

The decision-provider contract is versioned and structured. Tests must prove that GameFrame validates the returned action rather than trusting the provider.

Required mock-provider modes:

- Deterministic legal choice
- Scripted action sequence
- Seeded random legal choice
- Delayed response
- Timeout or unavailable service
- Malformed schema
- Illegal action
- Duplicate response
- Stale expected revision
- Mismatched request or player identity

Required assertions:

- A response is correlated to the pending request.
- The expected revision still matches.
- The selected action is currently legal for the assigned player.
- Duplicate or late responses do not create duplicate commits.
- Provider commentary is never parsed as the authoritative action.
- Provider failure invokes documented fallback or failure behavior.
- The real Scribbles Runtime adapter can replace the mock provider without changing GameFrame authority.

## WebSocket projection tests

Local contract and Workers-runtime tests should prove:

- A socket is attached only after its player-specific view resolves.
- Each connection receives an initial authoritative view.
- Match updates fan out only to subscribers of that match.
- Every subscriber receives its own player-specific observation.
- Refresh messages recover current state after reconnect or uncertainty.
- Game-changing messages are rejected on the WebSocket channel.
- Projection delivery failure does not roll back an accepted command.
- Hibernation and object reconstruction preserve the ability to recover authoritative state.

## Authentication and authorization tests

- Anonymous game API calls fail closed.
- The creator must occupy one requested seat.
- Reads and actions derive identity from the authenticated request principal.
- Conflicting client-supplied identity claims are rejected.
- Rejected impersonation attempts do not mutate the match.
- WebSocket attachments receive only the authenticated principal's observation.
- Development authentication is explicitly separate from production Discord and service verifiers.
- Scribbles Runtime service credentials map only to Theo's stable `theo` player identity.
- Mock-provider credentials receive only the capabilities and player identity configured for that provider.

## Signed session tests

- Valid signed sessions recover the original principal.
- Signature modification fails closed.
- Expired and malformed sessions fail closed.
- Cookie parsing does not expose or reinterpret client identity claims.
- Activity cookies include Discord's required iframe and partitioning attributes.
- Cloudflare uses the configured secret for both HTTP and WebSocket request authentication.

## Artifact policy

GitHub Actions artifact storage is a constrained diagnostic channel, not the permanent record of every successful run.

### Passing runs

- Do not upload full browser reports, videos, screenshots, and traces by default.
- The job log and GitHub result are the durable canonical record.
- Approved small visual baselines may remain committed in the repository.

### Failed runs

A failed browser, Workers-runtime, or visual run may upload one compressed diagnostic bundle containing only relevant material:

- Failed screenshot
- Expected screenshot
- Difference image
- Playwright or equivalent trace
- Focused logs
- Test and commit metadata

Failure diagnostics should use a provisional retention of three days.

### Manual visual milestones

A deliberately requested visual-review run may upload one curated bundle with a provisional maximum retention of seven days unless it is copied into a deliberate durable location.

### Storage escalation

Before creating a local artifact archive:

1. Upload artifacts only on failure or explicit visual-review runs.
2. Disable routine videos and traces.
3. Compress diagnostics.
4. Keep retention short.
5. Delete obsolete workflow runs and artifacts.

If this remains insufficient, a local archive may be added outside any ephemeral Actions workspace. It must enforce age, count, and total-size limits, remain isolated from public workflow execution, and must not silently consume disk without rotation and monitoring.

## Public artifact safety

Workflow logs, screenshots, traces, and artifacts must be assumed public. Test fixtures must use synthetic credentials and synthetic users. Diagnostics must not capture production cookies, secrets, private campaign state, private user data, privileged administration interfaces, or incident records.
