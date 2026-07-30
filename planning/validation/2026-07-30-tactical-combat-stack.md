# TC-0002 Tactical Combat Stack Validation

Date: July 30, 2026

## Scope

This checkpoint records the completed repository-side tactical combat proof layered on the TC-0001 map, movement, viewport, service, Canvas, and Workers-runtime foundation.

The implementation was developed on `agent/tc-0002-combat-foundation`, frozen at commit `f7922d5be79fadc57e6cb52ef295bf0b707169c5`, canonically validated, and squash-merged through PR #28 as `14b0786d15ed70746cfee871c9956ccab45ad097`.

## Canonical evidence

GitHub-hosted Canonical Validation run #65 (`30509543527`) ran on Ubuntu 24.04 with read-only repository permissions and the committed dependency lock.

Results:

- 111 core repository tests passed
- 8 real Workers-runtime tests passed across two test files
- 14 Playwright browser tests passed across Tic-Tac-Toe, American Checkers, tactical movement, and tactical combat
- `public/app.js`, `public/tactical-app.js`, and `public/combat-app.js` passed syntax validation
- repository self-check passed
- failure diagnostics were skipped because the frozen run was green

## Proven authority behavior

- four combatants: one vanguard and one ranger for each player
- stable health, movement, initiative, attack range, and deterministic damage
- stable initiative order with defeated-unit skipping and round progression
- one movement opportunity and one primary attack opportunity per activation
- movement and attack usable in either order
- explicit activation completion
- row, column, and exact 45-degree diagonal line of sight
- walls and intervening living units block attacks
- fixed damage, defeat, occupancy removal, structured effects, team victory, and bounded draw
- deterministic tactical combat agent and completed self-play
- event replay and snapshot restoration

## Configured encounter support

`MatchSession` now retains the actual configured initial state as the replay origin. Revision-zero scenario snapshots can therefore seed a specific encounter instead of being reconstructed from the game definition's ordinary default setup.

This support is intentionally generic. Monster Master, RPG, and later D&D-style encounter definitions may use different units, actions, activation economies, and victory rules while retaining the same match identity, revision, idempotency, replay, storage, and projection infrastructure.

## Service and Workers proof

- authoritative combat create, view, action, snapshot, and replay service
- bounded multi-action Theo activations through the version-1 agent-decision contract
- shared authenticated HTTP dispatch under game ID `tactical-combat-canary`
- migration-stable Durable Object dispatch without renaming the existing binding or class
- real `workerd` combat persistence after Durable Object eviction
- player-specific legal-action projections preserved before and after recovery

## Browser proof

The dedicated `/combat.html` surface proves:

- move, attack, and end-activation controls
- 24×24 Canvas battlefield with pan, bounded zoom, and centering
- vanguard and ranger silhouettes, health bars, active state, and initiative roster
- legal movement destinations and canonical path previews
- legal attack targets and authoritative attack-line previews
- structured damage, defeat, round, and completion feedback
- deterministic Theo play
- two-browser human play
- refresh and URL-based resume
- polling and WebSocket projection behavior
- keyboard and mobile layouts

## Evidence boundary

This checkpoint does not claim:

- deployed Cloudflare behavior
- Discord Activity delivery or authentication
- remote decision-provider network transport
- live Scribbles Runtime control of Theo
- Monster Master deployment, summoning, resources, abilities, or final content
- open-world exploration, NPC interaction, or campaign state
- D&D rules or compatibility with any specific licensed ruleset
- production art or final visual identity

TC-0002 is complete. The active implementation lane advances to MM-0001: a first playable Monster Master duel built as its own game definition over the validated tactical and platform substrate.
