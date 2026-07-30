# American Checkers Rules Validation — 2026-07-29

## Scope

This record covers `GF-0006`, the deterministic American Checkers rules module and its compatibility with the shared GameFrame contracts.

It does not cover the later HTTP service, finished browser interface, Cloudflare game dispatch, Discord delivery, remote decision-provider transport, or live Scribbles Runtime integration.

## Validated candidate

- Feature branch: `agent/gf-0006-american-checkers`
- Frozen feature head: `663998443a84adf2fd920e32d95cd0ff3ffc58ee`
- Pull request: #22
- GitHub-hosted Canonical Validation run: #41 (`30500405772`)
- Squash merge: `53730a0ddf9bdc1f56dc641c7a4f226ecf61011b`
- Runner: GitHub-hosted Ubuntu 24.04
- Repository permission: read-only contents
- Dependency installation: committed lockfile with `npm ci`

## Implemented proof

- American Checkers initial position with twelve men per side
- Dark-square coordinate validation
- Forward movement and capture for men
- Short-range king movement and capture in both directions
- Mandatory captures across the full board
- Complete terminal multi-jump action enumeration
- Choice among legal capture sequences without a maximum-capture requirement
- Promotion with immediate turn termination
- Elimination and blockade wins
- Deterministic threefold-repetition draw
- Deterministic eighty-ply no-progress draw
- Capture and promotion reset of the no-progress counter
- Stable piece identity and serializable state
- One complete authoritative turn per `CheckersAction`
- Generic `MatchSession` event recording, replay, and snapshot restoration
- Deterministic Checkers agent and completed self-play
- Legal-action purity and deterministic enumeration
- Normative rules and action-model documentation

## Canonical result

Canonical Validation run #41 completed successfully:

- 62 core repository tests passed
- 3 real Workers-runtime regression tests passed
- 4 Playwright Tic-Tac-Toe regression tests passed
- Browser JavaScript syntax validation passed
- Repository self-check passed
- Failure diagnostics were skipped because the run was green

## Evidence boundary

This proves the deterministic Checkers game module against repository contracts and regressions. It does not claim a finished Checkers delivery stack. That broader proof belongs to `GF-0007`.
