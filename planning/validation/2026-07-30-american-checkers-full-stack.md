# American Checkers Full-Stack Repository Validation — 2026-07-30

## Scope

This record covers `GF-0007`, the repository-side American Checkers generalization proof across authoritative services, the versioned agent boundary, browser delivery, and the real Workers runtime.

It does not claim a standalone deployed Cloudflare environment, Discord Activity delivery, remote decision-provider network transport, production authentication, or live Scribbles Runtime behavior. Those external checkpoints remain paused under `GF-0004`.

## Validated candidate

- Feature branch: `agent/gf-0007-checkers-full-stack`
- Frozen feature head: `e8e399d49984dc16aeefe77b6932cabe08c2e4fc`
- Pull request: #23
- GitHub-hosted Canonical Validation run: #45 (`30501927311`)
- Squash merge: `d1c1ee7a685977dddf759fd5f396c045a4ef58f4`
- Runner: GitHub-hosted Ubuntu 24.04
- Repository permission: read-only contents
- Dependency installation: committed lockfile with `npm ci`

## Authoritative service proof

- Dedicated Checkers match service with create, view, action, snapshot, and replay operations
- Human-versus-human Checkers
- Human-versus-deterministic-Theo Checkers
- Provider-backed Theo through the version-1 decision-provider contract
- Request correlation, player identity, expected revision, legal-action validation, provider action IDs, and deterministic fallback
- Shared multi-game in-memory dispatch using explicit `gameId`
- Backward-compatible Tic-Tac-Toe defaults
- Shared authenticated HTTP create, view, and action routes
- Unknown-game rejection and stale-action nonmutation

## Browser proof

- Explicit Tic-Tac-Toe and American Checkers selection in one browser shell
- Existing Tic-Tac-Toe browser behavior and selectors retained
- Responsive 8x8 Checkers board
- Black and Red piece and king presentation
- Movable-piece selection and legal-destination highlighting
- Mandatory-capture guidance
- Incremental collection of a complete multi-jump path followed by one authoritative action submission
- Deterministic Theo play
- Two-browser human play
- Refresh and URL-based resume
- Mobile layout without horizontal overflow

## Workers-runtime proof

- Generic Durable Object snapshot storage while preserving the existing binding and class name
- Multi-game dispatch inside the migration-stable Durable Object
- `gameId` propagation through Worker initialization and health discovery
- Checkers state persistence after accepted human and Theo actions
- Checkers board, revision, and legal-action recovery after real Durable Object eviction
- Existing Tic-Tac-Toe eviction recovery retained
- Existing competing-write serialization retained
- Existing hibernating-WebSocket refresh recovery retained

## Canonical result

Canonical Validation run #45 completed successfully:

- 70 core repository tests passed
- 5 real Workers-runtime tests passed
- 7 Playwright browser tests passed across Tic-Tac-Toe and American Checkers
- Browser JavaScript syntax validation passed
- Repository self-check passed
- Failure diagnostics were skipped because the run was green

## Consequence

The repository has now proven that the game, service, browser, agent, and Workers-runtime contracts generalize beyond Tic-Tac-Toe. `GF-0010 / TC-0001`, the larger-field tactical battler foundation, is the active development lane.
