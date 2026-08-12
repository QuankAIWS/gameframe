# Feature-Scoped UI Test Lanes

Status: active CI policy for the GameFrame UI review workflow.

This note refines the feature-branch guidance in `planning/testing-strategy.md` for browser/UI work. Ordinary pull-request synchronization may run **small, feature-scoped UI jobs**. The expensive whole-product `Canonical Validation` workflow remains deliberate and is not replaced by these lanes.

## Principle

A pull request should pay for the behavior it can realistically break.

Changing a Casual Games landing page should not run the Cascade 300-level bot profile or the Monster Master browser suite. Changing Cascade mechanics should run Cascade's mechanics/profile coverage, but not Monster Master. Shared shell changes may run representative cross-game navigation/visual coverage because those files genuinely affect multiple products.

The workflow classifier is `scripts/ui-test-scope.mjs`. Its routing behavior is covered by `scripts/ui-test-scope.test.mjs`.

## Automatic lanes

| Lane | Typical changed files | Automatic evidence |
| --- | --- | --- |
| Shared shell | `game-hub.js`, `gameframe-nav.js`, shared `styles.css` | shared syntax, Games/navigation journey, representative cross-game shell visuals |
| Casual Games | `casual-games.html`, `casual-games.css`, Casual Games browser/visual specs | focused Casual Games → Cascade launch smoke, desktop/mobile destination capture |
| Cascade UI | Cascade page/runtime/presentation and Cascade browser/visual specs | Cascade syntax, Cascade browser journeys, Cascade visuals |
| Cascade profile | mechanics/profile-affecting Cascade engine/runtime files and `src/games/cascade/**` | deterministic engine/special contracts and the 300-level bot difficulty profile |
| Cascade telemetry | telemetry sync/admin files and `src/cloudflare/cascade-telemetry-*` | telemetry syntax and telemetry object/edge contracts |
| Monster Master | Monster Master runtime/UI/assets/contracts/browser/visual specs | Pixi bundle verification, Monster Master contracts, Monster Master browser journeys, Monster Master visuals |
| Player Platform | Home/Profile/Leaderboard/Matches, Gamer Level/progression, player-platform contracts | player-platform syntax/contracts, progression workerd test, player browser journeys, Home/Profile/Leaderboard visuals |

`public/cascade-progression-sync.js` belongs to the **Player Platform** lane rather than Cascade. A progression ownership/sync change therefore does not run the 300-level Cascade bot profile unless actual Cascade mechanics/profile code also changed.

Cascade telemetry is similarly separate from the 300-level profile. A telemetry/export change may exercise the Cascade page when it changes that page, but it does not run the bot difficulty profile unless mechanics/profile-affecting files changed too.

## Shared browser infrastructure

Changes to Playwright configuration fan out to all UI lanes because they can invalidate every lane's browser execution environment. Package manifest/lock changes are not treated as product changes by themselves; if they accompany a product change, that product's lane still runs, while whole-repository dependency validation remains the job of Canonical Validation when warranted.

## Canonical validation

`Canonical Validation` remains the explicit whole-product gate for release candidates, shared authority changes, risky cross-cutting work, or any pull request where full regression evidence is warranted. It is manually dispatched or requested through the existing canonical-validation mechanism; it should not be substituted for routine feature-scoped feedback.

A green scoped lane proves only the selected feature surface. It must not be described as proof that unrelated products were tested.

## Visual evidence

Visual jobs capture only the selected lane unless a genuine shared-shell product file changed. A successful screenshot capture proves that the browser reached the expected state; it does not by itself constitute human visual approval.

Artifacts remain short-lived review evidence and must contain only synthetic/public-safe data.
