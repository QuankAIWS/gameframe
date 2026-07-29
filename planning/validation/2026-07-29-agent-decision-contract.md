# GF-0005 Agent Decision Contract Validation

- **Date:** 2026-07-29
- **Milestone:** GF-0005 — Versioned agent decision contract and mock connector
- **Validated feature head:** `627b129d4be8f9479fbbbcec65446675557835f7`
- **Canonical workflow:** Run #39 (`30494321343`)
- **Squash merge:** `46c2a0d5edcd22dfe908211915efc442d7b2d912`
- **Environment:** GitHub-hosted Ubuntu 24.04, Node.js 22.16.0, committed dependency lock

## Validated scope

The merged implementation establishes:

- Version-1 transport-neutral decision request and response schemas
- Game, match, request, player, revision, deadline, observation, and legal-action context
- Provider-generated action IDs
- Protocol, request, player, revision, action-ID, response-shape, duplicate-ID, and current-legality validation
- Explicit provider unavailable, timeout, malformed, mismatched, stale, duplicate, illegal, and missing-context failure classes
- Deterministic fallback constrained to the same stable player identity
- Durable deterministic, scripted, seeded-random, delayed, unavailable, malformed, illegal, duplicate, stale, mismatched-request, and mismatched-player mock modes
- Tic-Tac-Toe integration through the authoritative session path
- Canonical version-1 request and response fixtures for independent Scribbles Runtime implementation
- Normative protocol and Runtime-boundary documentation

## Canonical result

The complete repository validation passed:

- 46 core Node tests
- 3 real Workers-runtime tests
- 4 Playwright browser acceptance tests
- Browser JavaScript syntax validation
- Repository self-check

The canonical job retained read-only repository permissions. Failure diagnostics were skipped because the run was green.

## Evidence boundary

This checkpoint proves the in-process, transport-neutral contract and durable mock infrastructure. It does not prove:

- A remote HTTPS, queue, or other network transport
- Deployed provider authentication
- Live Scribbles Runtime compatibility
- Model-driven Theo decisions
- Deployed Cloudflare or Discord behavior

Those remain separate external canaries. GF-0004 remains paused until the repository owner is available for deployment setup. The next active repository milestone is GF-0006 American Checkers.
