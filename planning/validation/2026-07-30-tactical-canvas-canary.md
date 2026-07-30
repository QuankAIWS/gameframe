# TC-0001 Tactical Canvas Movement Validation — 2026-07-30

## Scope

This record covers the completed `TC-0001` tactical map, movement, service, Canvas camera, browser interaction, and real Workers-runtime canary.

It does not claim combat, attacks, line of sight, initiative attributes, monster-master content, standalone deployed Cloudflare behavior, Discord Activity delivery, remote decision-provider transport, or live Scribbles Runtime behavior.

## Validated candidates

### Tactical map and movement foundation

- Feature branch: `agent/tc-0001-tactical-map-foundation`
- Frozen feature head: `f87ba2120756c76064c4f7475be3db307ed09a2d`
- Pull request: #25
- Canonical Validation run: #48 (`30502780458`)
- Squash merge: `a40d88a332901f122ac89b0bc4233eaa72a336b4`

### Tactical Canvas and runtime canary

- Feature branch: `agent/tc-0001-tactical-canvas-canary`
- Frozen feature head: `8ec9b50fa00d7f2ffb4970b179df27e511979458`
- Pull request: #26
- Canonical Validation run: #52 (`30504067555`)
- Squash merge: `64937b76bcca5cd0ed515b2d801fd9a01bffe0bc`
- Runner: GitHub-hosted Ubuntu 24.04
- Repository permission: read-only contents
- Dependency installation: committed lockfile with `npm ci`

## Authoritative tactical proof

- 24x24 semantic square-grid map
- Floor, difficult terrain, walls, and a central objective
- Stable single-cell unit identity and ownership
- Unique occupancy and blocked-cell validation
- Deterministic weighted shortest-path search
- Stable equal-cost path tie breaking
- Complete canonical movement actions containing origin, full path, and movement cost
- Immutable state transitions
- Alternating activations and objective victory
- Deterministic tactical movement agent
- MatchSession event recording, replay, and snapshot restoration
- Provider-backed Theo compatibility through the existing version-1 decision contract

## Camera and Canvas proof

- Default approximately 12x9 visible region over the larger logical map
- Client-only camera center, pan, zoom, visible bounds, hover, and path-preview state
- Camera controls through buttons, keyboard, and pointer wheel
- Active-unit and objective centering
- Canvas rendering of semantic terrain, objective, units, selection, legal destinations, and canonical path previews
- Pointer and keyboard unit selection
- Keyboard-accessible legal-destination controls
- Submission of only currently enumerated canonical actions
- Human-versus-deterministic-Theo movement
- Two-browser human movement
- URL and browser-local resume
- Mobile layout without horizontal overflow

## Workers-runtime proof

- Tactical game dispatch inside the migration-stable Durable Object class and binding
- Tactical match creation through the shared Worker API
- Human and deterministic Theo movement persistence
- Complete 24x24 map and unit-position recovery after real Durable Object eviction
- Canonical legal-action and path recovery after eviction
- Tic-Tac-Toe and American Checkers eviction regressions retained
- Competing-write serialization retained
- Hibernating-WebSocket refresh recovery retained

## Defect found and corrected

The first Canvas browser integration run exposed an input-lifecycle defect in the accessible destination controls. Focus or pointer hover triggered a path-preview redraw that replaced the button before its click could commit. Preview events were isolated from button activation, and the original movement tests then passed unchanged.

The failed browser diagnostic bundle followed the repository artifact policy and used three-day retention.

## Final canonical result

Canonical Validation run #52 completed successfully:

- 92 core repository tests passed
- 6 real Workers-runtime tests passed
- 10 Playwright browser tests passed across Tic-Tac-Toe, American Checkers, and the tactical Canvas canary
- Browser JavaScript syntax validation passed
- Repository self-check passed
- Failure diagnostics were skipped because the final run was green

## Consequence

`TC-0001` is complete. `TC-0002` is the active tactical lane and may add initiative ordering, activation budgets, line of sight, attacks, damage, effects, and combat victory while retaining the proven map, movement, authority, camera, and projection boundaries.
