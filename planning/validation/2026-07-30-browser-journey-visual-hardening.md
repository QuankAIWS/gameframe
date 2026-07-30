# Browser journey and visual hardening validation

Date: 2026-07-30

## Scope

This checkpoint records the browser journey inventory, direct control coverage, curated screenshot review, evidence-driven presentation fixes, and narrow deterministic visual regression merged through PR #37.

It does not claim deployed Cloudflare behavior, real Discord website OAuth, actual Discord Activity launch, public-network reconnect behavior, or final Monster Master interface quality.

## Validated candidate

- Feature branch: `agent/browser-journey-visual-hardening`
- Pull request: #37 — `Browser journey and visual hardening`
- Frozen head: `6d8e59bdab473ab9c04aeeabea4bb5f7b112a2be`
- Canonical Validation run: #86 (`30553862420`)
- GitHub-hosted runner: Ubuntu 24.04
- Repository permission during canonical validation: read-only
- Squash merge: `e3220ae18c38810bfec498c67b8ead01687c514e`

## Browser journey boundary

`planning/browser-journey-matrix.md` now records the player-facing states, controls, transitions, viewport/input expectations, and evidence status for:

- shell navigation and setup reset
- authentication and session behavior
- secure human-match invitations
- Tic-Tac-Toe
- American Checkers
- Tactical Movement
- Tactical Combat
- connectivity, stale-state, unauthorized, and failure presentation
- curated screenshot review
- narrow visual-regression candidates

The matrix is risk-based. Every meaningful control and security-sensitive transition should receive direct browser coverage, while equivalent cosmetic permutations remain covered by lower-level deterministic and service tests rather than combinatorial browser duplication.

## New direct journeys

The Playwright interaction suite gained direct coverage for:

- switching game modules and navigating between browser surfaces
- opening and closing diagnostics
- returning from an active match to setup
- all Tactical Movement pan, center, and zoom controls
- Tactical Combat camera, diagnostics, setup, and navigation controls
- Discord-backed logout returning to the authentication gate
- secure invitation clipboard copy and inviter cancellation
- missing and already-claimed invitation error presentation

The complete interaction suite now contains 22 passing journeys.

## Curated visual review

A deliberate `visual-review` pull-request label runs a separate Chromium job that captures 18 public-safe synthetic states:

1. main lobby desktop
2. main lobby mobile
3. Tic-Tac-Toe active
4. Tic-Tac-Toe complete
5. invalid resume
6. Checkers initial
7. Checkers selected piece
8. Tactical Movement initial
9. Tactical Movement path selection
10. Tactical Combat activation
11. Tactical Combat move options
12. Tactical Combat attack options
13. Tactical Combat damage
14. hosted authentication gate
15. authenticated session badge
16. secure invitation pending
17. invitation claim success
18. invitation claim error

The final curated run was #83 (`30552163212`). It uploaded one compressed artifact named `gameframe-visual-review-30552163212` with seven-day retention. Successful ordinary canonical runs still do not archive screenshots, traces, or videos.

## Presentation defects corrected from screenshots

Visual inspection found and corrected:

- the desktop session badge used fixed positioning and could overlay tactical content after scrolling;
- large movement and combat legal-action collections could grow indefinitely and dominate the lower page;
- screenshot capture could occur before Checkers completed its final document geometry.

The session badge now remains attached to the top document region, tactical action lists use bounded scrollable containers, and curated capture waits for fonts, layout frames, and Checkers document height.

## Stable visual regression

Four stable shell states are committed as canonical Ubuntu/Chromium PNG baselines:

- main lobby desktop
- main lobby mobile
- hosted authentication gate
- invitation error

Dynamic matches, tactical Canvas states, generated identifiers, and effect timing remain in curated visual review rather than brittle pixel comparison.

A one-time branch-restricted GitHub-hosted bootstrap generated only the four PNG files in the canonical environment. The write-capable bootstrap was removed before final validation. A repository contract requires the permanent workflow to remain read-only and rejects restoration of the bootstrap path.

## Canonical result

Run #86 passed with:

- 143 core repository tests
- 13 real Workers-runtime tests across four files
- reproducible Discord Activity browser bundle
- eight browser JavaScript syntax checks
- 22 Playwright interaction journeys
- four Playwright visual baselines
- repository self-check

The first canonical attempt found only a formatting mismatch in a new journey: the tactical zoom label is intentionally rendered as `1.00×`, while the test expected `1×`. The assertion was aligned with the stable product presentation and the complete frozen candidate was rerun.

## Continuing boundary

The journey matrix explicitly records remaining high-value browser work instead of implying exhaustive completion. Later game slices should add journeys and curated states for their own phases, controls, error states, completion states, mobile interactions, and stable visual compositions.

MM-0001 Monster Master remains the active gameplay lane and should inherit this testing and visual-review structure from its first browser surface.
