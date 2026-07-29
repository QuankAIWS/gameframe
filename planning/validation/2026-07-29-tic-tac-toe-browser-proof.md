# Tic-Tac-Toe Browser Proof Validation — 2026-07-29

## Scope

This record closes `GF-0003`, the complete Tic-Tac-Toe browser proof. It covers the ordinary responsive browser client, resumable human and deterministic-opponent play, real browser interaction through the authoritative HTTP boundary, and the repository-level Workers runtime suite.

It does not claim a deployed Cloudflare canary, Discord Activity delivery, mock remote-agent network behavior, or live Scribbles Runtime integration.

## Validated candidate

- Pull request: `#17` — `GF-0003: complete Tic-Tac-Toe browser proof`
- Frozen feature head: `9a83369379b7ac09ff51b06e61658f5dd98661a6`
- Base at validation: `fc979bbabc6f279d4c03edcbb636ab86969e5523`
- Squash merge on `main`: `42d6cd3da2f4a1b110fa3debd9df9da016fb2351`
- Canonical workflow: `Canonical Validation`
- Workflow run: `#36` (`30492977351`)
- Runner: GitHub-hosted Ubuntu 24.04
- Node.js: `22.16.0`
- Dependency installation: committed `package-lock.json` with `npm ci --no-audit --no-fund`
- Browser installation: pinned Playwright Chromium through `npx playwright install --with-deps chromium`

## Canonical result

The frozen candidate passed the complete `npm run validate` suite:

- 33 deterministic, invariant, service, HTTP, authentication, and projection tests passed
- 3 real Workers-runtime tests passed
- Browser JavaScript syntax check passed
- 4 Playwright browser acceptance tests passed
- Repository public-hygiene and durable-document self-check passed
- Failure diagnostics were skipped because the run was green

The Playwright acceptance suite proved:

- A deterministic human-versus-Theo match can progress to completion
- A match survives browser refresh and resumes through its URL identity and match reference
- Two independent browser contexts can share, refresh, and complete one human-versus-human match
- Invalid resume links fail visibly and return the user to match setup
- The mobile layout remains usable without horizontal overflow

## Integration defect found and corrected

The first hosted browser run found a real client defect: after asynchronous match creation or resume, authoritative legal actions existed but the rendered board could remain disabled. Busy-state reconciliation was corrected to restore each cell from the current legal-action set after the request completes.

The terminal-state browser assertion was retained. The corrected client then passed all four browser tests.

## Artifact result

The successful canonical run uploaded no diagnostic artifact. A failed development-integration run produced a short-retention screenshot and Playwright trace solely for diagnosing the disabled-board defect. Those diagnostics are not part of the durable merge record and expire under the repository artifact policy.

## Next proof boundary

The next active milestone is `GF-0004`: deploy the validated browser client, Worker routes, and Durable Object runtime as a compact standalone Cloudflare canary. That canary must separately prove live static-asset delivery, persistence, WebSocket projections, reconnect, refresh, object recovery, and configured authentication behavior.
