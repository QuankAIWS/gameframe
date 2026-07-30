# Browser Journey Matrix

## Purpose

This ledger defines the browser states, controls, transitions, viewports, and evidence expected from Scribbles GameFrame. It is the durable coverage map for Playwright acceptance and curated visual review.

The matrix is risk-based rather than combinatorial. Every meaningful player control and security-sensitive transition should have direct browser coverage. Equivalent cosmetic permutations do not require duplicate journeys when lower-level rules and service tests already prove the underlying state space.

## Evidence levels

- **Interaction** — Playwright operates the real control and verifies the resulting browser-visible state.
- **Service-backed** — the interaction crosses the ordinary HTTP application boundary.
- **Two-context** — independent browser contexts prove separate player identities or projections.
- **Mobile** — the journey uses a touch-sized viewport and checks usable controls, not only page width.
- **Visual review** — a deterministic screenshot is included in the manual curated artifact.
- **Visual baseline** — a deliberately accepted narrow screenshot comparison protects a stable composition.
- **External canary** — requires deployed Cloudflare or an actual Discord client and cannot be claimed by repository validation.

## Cross-surface shell and navigation

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Main lobby | Select Tic-Tac-Toe | Interaction; visual review | Covered interaction; visual review pending |
| Main lobby | Select American Checkers | Interaction; visual review | Covered interaction; visual review pending |
| Main lobby | Open Tactical Movement | Interaction | Pending direct navigation journey |
| Tactical Movement | Open other games | Interaction | Pending |
| Tactical Combat | Open movement canary | Interaction | Pending |
| Tactical Combat | Open other games | Interaction | Pending |
| Active match | Back to setup | Interaction | Pending |
| Diagnostics closed | Open diagnostics | Interaction; visual review | Pending |
| Diagnostics open | Close diagnostics | Interaction | Pending |
| Any supported page | No horizontal overflow on 390×844 | Mobile | Covered on game surfaces |
| Any supported page | Focus indicators remain visible | Keyboard; visual review | Pending |

## Authentication and session journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Anonymous hosted browser | Authentication gate is shown before game code | Interaction; visual review | Partial deterministic browser proof |
| Anonymous hosted browser | Sign in with Discord preserves same-origin return path | Interaction | Repository contract; live redirect external |
| Authenticated website | Session badge shows trusted profile | Interaction; visual review | Covered through browser doubles |
| Authenticated website | Logout clears session and returns to gate | Interaction | Pending direct browser journey |
| Expired or invalid session | Protected page returns to authentication gate | Interaction | Pending |
| Discord Activity host | SDK identity must equal signed GameFrame principal | Interaction | Covered through deterministic SDK doubles |
| Discord Activity host | Real ready/authorize/exchange/authenticate | External canary | Pending owner configuration |

## Secure invitation journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Authenticated lobby | Create signed invitation | Interaction | Covered |
| Pending invitation | Copy invitation link | Interaction with clipboard permission | Pending |
| Pending invitation | Cancel invitation | Interaction | Pending |
| Pending invitation | Poll until independently authenticated claimant succeeds | Interaction; two-context at deployed canary | Covered with browser/server doubles; external two-user canary pending |
| Recipient page | Claim invitation with authenticated session | Interaction; visual review | Covered happy path |
| Recipient page | Token removed from browser history | Interaction | Covered |
| Recipient page | Missing token | Interaction; visual review | Pending |
| Recipient page | Tampered or expired token | Interaction; visual review | Pending |
| Recipient page | Cancelled invitation | Interaction; visual review | Pending |
| Recipient page | Already claimed by another user | Interaction; visual review | Pending |
| Inviter | Self-claim rejected without match mutation | Service-backed | Covered below browser layer; browser presentation pending |

## Tic-Tac-Toe journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Challenge Theo | Interaction | Covered |
| Lobby | Play with friend in local development | Two-context | Covered |
| Initial board | Select legal cell | Interaction | Covered |
| Waiting for opponent | Board disabled and status clear | Interaction; visual review | Partial |
| Active board | Refresh and resume same state | Interaction | Covered |
| Completed board | Win/draw presentation and disabled board | Interaction; visual review | Covered interaction; visual review pending |
| Completed board | Back to setup and start a new match | Interaction | Pending |
| Invalid resume | Visible error and setup recovery | Interaction; visual review | Covered interaction; visual review pending |
| Mobile match | Tap legal cell and retain usable layout | Mobile interaction | Layout covered; explicit tap journey pending |

## American Checkers journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Select Checkers and start Theo match | Interaction | Covered |
| Initial board | Piece count, board orientation, selectable piece | Interaction; visual review | Covered interaction; visual review pending |
| Ordinary turn | Select piece and destination | Interaction | Covered |
| Mandatory capture | Non-capturing pieces unavailable | Interaction; visual review | Pending browser-seeded journey |
| Multi-jump | Collect complete path before commit | Interaction; visual review | Partial generic path helper; dedicated state pending |
| Promotion | Man becomes king at terminal square | Interaction; visual review | Pending browser-seeded journey |
| King state | King styling and reverse movement | Interaction; visual review | Pending browser-seeded journey |
| Completed match | Winner/draw and disabled board | Interaction; visual review | Rules covered; browser journey pending |
| Active match | Refresh and resume | Interaction | Covered |
| Local two-player | Independent seats alternate and resume | Two-context | Covered |
| Mobile match | Tap piece and destination without overflow | Mobile interaction | Layout covered; explicit touch journey pending |

## Tactical Movement journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Race Theo | Interaction | Covered |
| Lobby | Race friend in local development | Two-context | Covered |
| Active map | Keyboard-select active unit | Keyboard | Covered |
| Active map | Pointer-select active unit | Pointer | Pending |
| Active map | Choose destination and commit full path | Interaction | Covered |
| Camera | Pan north, south, east, and west | Interaction | East covered; remaining direct controls pending |
| Camera | Zoom in and out | Interaction | Zoom in covered; zoom out pending |
| Camera | Center active unit | Interaction | Covered indirectly; direct assertion pending |
| Camera | Center objective | Interaction | Pending |
| Active map | Refresh and resume state and viewport-safe UI | Interaction | Match state covered |
| Completed race | Objective completion presentation | Interaction; visual review | Pending browser journey |
| Mobile map | Tap/select and move with usable controls | Mobile interaction | Keyboard equivalent covered; touch journey pending |

## Tactical Combat journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Skirmish with Theo | Interaction | Covered |
| Lobby | Skirmish with friend in local development | Two-context | Covered |
| Activation start | Active unit, initiative, budgets, and status | Interaction; visual review | Covered assertions; visual review pending |
| Move action | Show legal destinations and commit | Interaction | Covered |
| Attack action | Show legal targets and commit damage | Interaction; visual review | Covered |
| Attack action | No legal targets produces clear state | Interaction | Pending |
| Activation | Attack then move | Interaction | Rules covered; browser journey pending |
| Activation | Move then attack | Interaction | Rules covered; browser sequence partial |
| Activation | End activation | Interaction | Covered |
| Budget spent | Used controls are unavailable and explained | Interaction; visual review | Partial move-budget assertion |
| Defeat | Unit removed and effect presented | Interaction; visual review | Pending browser-seeded journey |
| Victory or draw | Finished state and disabled actions | Interaction; visual review | Pending browser journey |
| Camera | Every pan, center, zoom control | Interaction | Zoom in covered; full control audit pending |
| Active match | Refresh and resume | Interaction | Covered |
| Mobile match | Tap action, target, and end activation | Mobile interaction | Layout covered; explicit touch journey pending |

## Connectivity, stale state, and failure journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| WebSocket unavailable | HTTP polling keeps view current | Interaction | Service/browser behavior exists; direct journey pending |
| Temporary disconnect | Reconnect and refresh authoritative state | Interaction | Lower-level coverage; direct browser journey pending |
| Stale revision | Visible recovery without duplicate mutation | Interaction | Service coverage; browser presentation pending |
| Unauthorized match | Visible error and no leaked observation | Interaction | Lower-level coverage; browser presentation pending |
| Unknown match | Visible error and safe setup recovery | Interaction | Covered for board shell |
| Command failure | Button recovers from submitting state | Interaction | Partial |
| Projection failure | Accepted command remains committed | Service-backed | Covered below browser layer |

## Curated visual-review set

The manual visual workflow should produce a small named set rather than screenshots of every test step:

1. Main lobby — desktop
2. Main lobby — mobile
3. Tic-Tac-Toe — active match
4. Tic-Tac-Toe — completed match
5. Tic-Tac-Toe — invalid resume
6. Checkers — initial board
7. Checkers — selected piece and legal destination
8. Tactical Movement — initial battlefield
9. Tactical Movement — path selection after pan/zoom
10. Tactical Combat — activation start
11. Tactical Combat — move options
12. Tactical Combat — attack and damage effect
13. Hosted authentication gate
14. Authenticated session badge
15. Secure invitation dialog
16. Invitation claim success
17. Invitation claim error

## Narrow visual-baseline candidates

Only stable compositions should become pixel comparisons:

- Main lobby desktop and mobile
- Hosted authentication gate
- Invitation claim shell
- Initial Tic-Tac-Toe board
- Initial Checkers board
- Tactical Movement shell with deterministic initial camera
- Tactical Combat shell with deterministic initial activation

Dynamic identifiers, status timestamps, profile names, and Canvas animation frames must be masked or fixed before baseline acceptance.

## Completion rule

A browser-hardening checkpoint may be marked complete when:

- every current player-facing control appears in this ledger;
- critical security and recovery states have direct browser coverage;
- the manual visual-review workflow produces a curated artifact with public-safe synthetic data;
- the artifact has been visually inspected and resulting defects corrected;
- stable baseline candidates have either accepted snapshots or an explicit reason for deferral;
- the complete canonical suite remains green.
