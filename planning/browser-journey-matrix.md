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
| Main lobby | Select Tic-Tac-Toe | Interaction; visual review | Covered and visually reviewed |
| Main lobby | Select American Checkers | Interaction; visual review | Covered and visually reviewed |
| Main lobby | Open Tactical Movement | Interaction | Covered |
| Tactical Movement | Open other games | Interaction | Covered |
| Tactical Combat | Open Monster Master | Interaction | Covered |
| Tactical Combat | Open movement canary | Interaction | Covered |
| Tactical Combat | Open other games | Interaction | Link present; direct navigation assertion pending |
| Monster Master | Open Tactical Combat | Interaction | Covered |
| Monster Master | Open other games | Interaction | Covered |
| Active match | Back to setup | Interaction | Covered on the ordinary lobby, Tactical Combat, and Monster Master surfaces |
| Diagnostics closed | Open diagnostics | Interaction; visual review | Covered on ordinary, tactical, combat, and Monster Master surfaces |
| Diagnostics open | Close diagnostics | Interaction | Covered on ordinary and Monster Master surfaces |
| Any supported page | No horizontal overflow on 390×844 | Mobile | Covered on current game surfaces |
| Any supported page | Focus indicators remain visible | Keyboard; visual review | Pending dedicated visual audit |

## Authentication and session journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Anonymous hosted browser | Authentication gate is shown before game code | Interaction; visual review | Covered through deterministic browser doubles and visually reviewed |
| Anonymous hosted browser | Sign in with Discord preserves same-origin return path | Interaction | Repository contract; live redirect external |
| Authenticated website | Session badge shows trusted profile | Interaction; visual review | Covered through browser doubles and visually reviewed |
| Authenticated website | Logout clears session and returns to gate | Interaction | Covered |
| Expired or invalid session | Protected page returns to authentication gate | Interaction | Pending direct expiry journey |
| Discord Activity host | SDK identity must equal signed GameFrame principal | Interaction | Covered through deterministic SDK doubles |
| Discord Activity host | Real ready/authorize/exchange/authenticate | External canary | Pending owner configuration |

## Secure invitation journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Authenticated lobby | Create signed invitation | Interaction | Covered |
| Pending invitation | Copy invitation link | Interaction with clipboard permission | Covered |
| Pending invitation | Cancel invitation | Interaction | Covered |
| Pending invitation | Poll until independently authenticated claimant succeeds | Interaction; two-context at deployed canary | Covered with browser/server doubles; external two-user canary pending |
| Recipient page | Claim invitation with authenticated session | Interaction; visual review | Covered and visually reviewed |
| Recipient page | Token removed from browser history | Interaction | Covered |
| Recipient page | Missing token | Interaction; visual review | Covered and visually reviewed |
| Recipient page | Tampered or expired token | Interaction; visual review | Rejected-token contract covered; dedicated terminal-state captures pending |
| Recipient page | Cancelled invitation | Interaction; visual review | Lower-level coverage; browser presentation pending |
| Recipient page | Already claimed by another user | Interaction; visual review | Covered interaction; shared error composition visually reviewed |
| Inviter | Self-claim rejected without match mutation | Service-backed | Covered below browser layer; browser presentation pending |
| Local Monster Master duel | Expand and collapse the synthetic second-seat invitation | Interaction | Covered; collapsed by default during gameplay |

## Tic-Tac-Toe journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Challenge Theo | Interaction | Covered |
| Lobby | Play with friend in local development | Two-context | Covered |
| Initial board | Select legal cell | Interaction | Covered |
| Waiting for opponent | Board disabled and status clear | Interaction; visual review | Partial |
| Active board | Refresh and resume same state | Interaction | Covered |
| Completed board | Win/draw presentation and disabled board | Interaction; visual review | Covered and visually reviewed |
| Completed board | Back to setup and start a new match | Interaction | Covered setup return; fresh second match not dedicated |
| Invalid resume | Visible error and setup recovery | Interaction; visual review | Covered and visually reviewed |
| Mobile match | Tap legal cell and retain usable layout | Mobile interaction | Layout covered; explicit tap journey pending |

## American Checkers journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Select Checkers and start Theo match | Interaction | Covered |
| Initial board | Piece count, board orientation, selectable piece | Interaction; visual review | Covered and visually reviewed |
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
| Camera | Pan north, south, east, and west | Interaction | Covered |
| Camera | Zoom in and out | Interaction | Covered |
| Camera | Center active unit | Interaction | Covered |
| Camera | Center objective | Interaction | Covered |
| Active map | Refresh and resume state and viewport-safe UI | Interaction | Match state covered |
| Completed race | Objective completion presentation | Interaction; visual review | Pending browser journey |
| Mobile map | Tap/select and move with usable controls | Mobile interaction | Keyboard equivalent covered; touch journey pending |

## Tactical Combat journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Skirmish with Theo | Interaction | Covered |
| Lobby | Skirmish with friend in local development | Two-context | Covered |
| Activation start | Active unit, initiative, budgets, and status | Interaction; visual review | Covered and visually reviewed |
| Move action | Show legal destinations and commit | Interaction; visual review | Covered and visually reviewed |
| Attack action | Show legal targets and commit damage | Interaction; visual review | Covered and visually reviewed |
| Attack action | No legal targets produces clear state | Interaction | Pending |
| Activation | Attack then move | Interaction | Rules covered; browser journey pending |
| Activation | Move then attack | Interaction | Rules covered; browser sequence partial |
| Activation | End activation | Interaction | Covered |
| Budget spent | Used controls are unavailable and explained | Interaction; visual review | Partial move-budget assertion |
| Defeat | Unit removed and effect presented | Interaction; visual review | Pending browser-seeded journey |
| Victory or draw | Finished state and disabled actions | Interaction; visual review | Pending browser journey |
| Camera | Every pan, center, zoom control | Interaction | Covered |
| Active match | Refresh and resume | Interaction | Covered |
| Mobile match | Tap action, target, and end activation | Mobile interaction | Layout covered; explicit touch journey pending |

## Monster Master journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| Lobby | Duel Theo | Interaction; visual review | Covered and visually reviewed |
| Lobby | Duel friend in local development | Two-context | Covered alternating deployment journey |
| Deployment | Select each roster unit | Interaction; visual review | Covered through full deployment and visually reviewed |
| Deployment | Commit highlighted Canvas coordinate | Pointer; service-backed | Covered for all three alpha deployments |
| Deployment | Opposing seat receives next legal deployment | Two-context | Covered |
| Combat start | Initiative roster, command energy, budgets, and active unit | Interaction; visual review | Covered and visually reviewed |
| Move action | Show legal destinations and commit | Interaction; visual review | Covered and visually reviewed |
| Attack action | Show legal targets and commit damage | Interaction; visual review | Covered and visually reviewed before and after submission |
| Mend ability | Spend command and heal a legal friendly target | Interaction; visual review | Covered and visually reviewed before and after submission |
| Activation | End activation and allow deterministic Theo response | Interaction | Covered |
| Command regeneration | New round updates both command displays | Interaction | Covered through the ordinary two-seat HTTP boundary |
| Defeat | Remove an ordinary defeated monster and present the effect while combat continues | Interaction; visual review | Covered and visually reviewed |
| Master defeat | Immediate victory, winner-relative presentation, and disabled controls | Interaction; visual review | Covered and visually reviewed |
| Round cap | Draw at the configured final round with disabled actions | Interaction; visual review | Covered and visually reviewed at round 24 |
| Camera | Pan, center active, center field, zoom in, and zoom out | Interaction | Core button and keyboard paths covered; curated draw framing uses the real pan controls |
| Active duel | Refresh and resume exact revision | Interaction | Covered |
| Active duel | Back to setup and create a different match | Interaction | Covered |
| Diagnostics | Open and close authoritative diagnostics | Interaction | Covered |
| Hosted human duel | Signed invitation creates and resumes both verified seats | Interaction; external canary | Signed boundary covered; live two-user canary pending |
| Mobile duel | Deployment and controls remain usable without overflow | Mobile | Explicit mobile Canvas deployment covered; lobby visually reviewed |

## Connectivity, stale state, and failure journeys

| State | Control or transition | Required evidence | Status |
|---|---|---|---|
| WebSocket unavailable | HTTP polling keeps view current | Interaction | Service/browser behavior exists; direct journey pending |
| Temporary disconnect | Reconnect and refresh authoritative state | Interaction | Lower-level coverage; direct browser journey pending |
| Stale revision | Visible recovery without duplicate mutation | Interaction | Covered directly for Monster Master deployment |
| Unauthorized match | Visible error and no leaked observation | Interaction | Covered directly for Monster Master |
| Unknown match | Visible error and safe setup recovery | Interaction | Covered on ordinary and Monster Master surfaces |
| Wrong-game resume | Refuse to render another game through the current client | Interaction | Covered for Monster Master |
| Match creation failure | Restore usable setup controls and error state | Interaction | Covered for Monster Master |
| Command failure | Button recovers from submitting state | Interaction | Partial |
| Projection failure | Accepted command remains committed | Service-backed | Covered below browser layer |

## Curated visual-review set

The manual visual workflow produces a small named set rather than screenshots of every test step. Capture numbers are globally unique across the complete artifact:

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
12. Tactical Combat — attack options
13. Tactical Combat — committed damage effect
14. Hosted authentication gate
15. Authenticated session badge
16. Secure invitation pending dialog
17. Invitation claim success
18. Invitation claim error
19. Monster Master — desktop lobby
20. Monster Master — mobile lobby
21. Monster Master — deployment and starting zone
22. Monster Master — combat activation
23. Monster Master — movement options
24. Monster Master — attack targeting
25. Monster Master — committed attack result
26. Monster Master — Mend targeting
27. Monster Master — committed Mend result
28. Monster Master — ordinary monster defeat with combat continuing
29. Monster Master — Master-defeat victory from the winning seat
30. Monster Master — bounded draw at round 24

## Narrow visual-baseline candidates

Only stable compositions should become pixel comparisons:

- Main lobby desktop and mobile
- Hosted authentication gate
- Invitation claim shell
- Initial Tic-Tac-Toe board
- Initial Checkers board
- Tactical Movement shell with deterministic initial camera
- Tactical Combat shell with deterministic initial activation

Monster Master has completed curated rendered review. Its lobby, deployment, action, effect, outcome, and Canvas compositions remain curated-only for MM-0001 because match identifiers, roster state, camera position, legal actions, and Canvas contents are deliberately dynamic. A narrow baseline may be accepted later only after a stable composition is selected and its dynamic fields are fixed or masked.

Dynamic identifiers, status timestamps, profile names, and Canvas animation frames must be masked or fixed before baseline acceptance.

## Completion rule

A browser-hardening checkpoint may be marked complete when:

- every current player-facing control appears in this ledger;
- critical security and recovery states have direct browser coverage;
- the manual visual-review workflow produces a curated artifact with public-safe synthetic data;
- the artifact has been visually inspected and resulting defects corrected;
- stable baseline candidates have either accepted snapshots or an explicit reason for deferral;
- the complete canonical suite remains green.
