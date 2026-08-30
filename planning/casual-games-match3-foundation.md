# Casual Games / Cascade Crush Foundation

Status: active family-playtest build  
Scope: GameFrame casual-games lane and the first match-3 title, **Cascade Crush**

## Product thesis

Cascade Crush should be a bright, friction-light match-3 game that is fun enough to play on its own merits, without purchases, fake purchases, or a monetization simulator. The family build should support friendly competition, short repeatable sessions, earned rewards, and occasional bonus modes that change the kind of attention and memory the player uses.

The cognitive goal is modest and practical: mix ordinary match-3 planning with short bursts of speed, recall, divided attention, and visuospatial memory. The game is not presented as a treatment or medical intervention.

Because Cascade Crush is a private family game rather than a commercial product, familiar match-3 mechanics may be borrowed and recombined aggressively when they make the game more fun or legible. Presentation, art, names, implementation, and authored level recipes should still remain GameFrame-owned so the codebase stays understandable and maintainable.

## Core principles

### 1. Fun first

The main loop has to work as a game before any cognitive variation matters. Levels should be readable quickly, inputs should feel immediate, cascades should be satisfying, and the next useful action should rarely require menu work.

### 2. Normal levels are mostly untimed

Normal Cascade Crush uses moves as the resource. Players can think as long as they want. Time pressure is reserved for explicit bonus events so it feels different instead of becoming background stress.

### 3. Difficulty comes in waves, not one endless ramp

The campaign uses repeating ten-level tension waves. A typical wave opens with a relief level, builds through ordinary pressure, reaches a hard beat around the middle, releases pressure again, then ends on a super-hard capstone. Difficulty still rises across the campaign because objectives become more demanding, but the immediate experience should breathe.

The wave is intentionally data-driven rather than pretending level number itself is difficulty.

### 4. Stable special toolkit, expanding board vocabulary

Cascade keeps its permanent offensive toolkit small: Stripe, Bomb, Color Clearer, and Butterfly. Novelty should come primarily from board elements, objectives, geometry, and combinations rather than continually inventing new special pieces.

Through roughly levels 600–1,500, a substantial new board/cognitive family can enter about every 75–100 levels, with smaller variants and combinations between introductions. Internal 30-level chapters organize teaching and map presentation; they do not impose a 30-level mechanic or generation cadence.

The goal is not novelty for its own sake. Each new family must change player decisions and then recur often enough to become mastered vocabulary.

### 5. Rewards are earned through play

The player earns 1–3 best stars on ordinary levels and bonus events. Every ten newly earned best stars attempts to award one hammer, subject to the six-hammer inventory cap. If the inventory is already full at that moment, that hammer is discarded; Cascade does not bank, queue, defer, or otherwise track overflow hammer rewards. Replaying something only helps if the player improves the stored best result.

Lives remain a pacing mechanic with automatic regeneration. There is no paid, fake-paid, or IOU bypass.

## Campaign scale

The campaign system is deliberately sized for **10,000 levels** without requiring another level-model rewrite.

The immediate production milestone is **3,000 shipped levels**. That milestone is only the first large content tranche, not the mature endgame. The longer design horizon is 10,000 levels, with the option to extend beyond that or reskin/reframe the experience later without rebuilding the core campaign model.

The currently shipped expansion target contains **600 levels**. Butterfly is part of the ordinary permanent special toolkit from the early campaign onward; levels 301–450 remain early-campaign fluency content, and levels 451–600 add the first new positional objective family: drop/exit objects. Levels 601–3000 remain the immediate expansion target, and levels 3001–10000 remain the long-horizon campaign.

The player-facing level map renders only the current 30-level chapter rather than every campaign level. This prevents the UI and DOM size from growing linearly as the campaign expands.

## Core board

- 8 × 8 board
- 6 visually distinct tile types
- adjacent swaps
- horizontal/vertical matches of 3+
- gravity and refill
- automatic cascades
- cascade multiplier scoring
- board regeneration when no playable move remains
- persistent special pieces

## Persistent special pieces

Specials are pieces the player creates and can deliberately save, move, activate, or combine. Creating one does not automatically consume its full effect.

### Striped piece

A four-tile match creates a striped piece.

- horizontal match → horizontal line clearer
- vertical match → vertical line clearer
- activating it clears its line

### Burst bomb

A T or L intersection creates a bomb. Activating it clears a 3 × 3 area.

### Color clearer

A five-or-more straight match creates a color clearer. Swapping it with a normal tile clears that tile's color from the board.

### Butterfly

Starting at level 6, a 2 × 2 square of one color creates a persistent Butterfly.

- when triggered, Butterfly randomly chooses among unfinished board-objective targets;
- ice cells and still-needed collection colors are useful targets;
- when several useful targets exist, Butterfly does not rank them by depth, position, or mathematical value;
- Butterfly + Butterfly sends multiple useful-target hits without replacement;
- Butterfly + stripe, Butterfly + bomb, and Butterfly + color clearer redirect stronger effects toward useful objective locations;
- Butterfly is a normal special piece, not a chapter theme or a special class of level.

### Combinations

Adjacent specials can be swapped together for stronger effects. Initial supported combinations include:

- stripe + stripe
- stripe + bomb
- bomb + bomb
- color clearer + another special
- color clearer + color clearer
- Butterfly + Butterfly
- Butterfly + stripe
- Butterfly + bomb
- Butterfly + color clearer

Specials hit by another special can trigger recursively.

## Opening teaching sequence

The opening six levels introduce the permanent rules rather than treating them as late-game gimmicks.

1. **Level 1 — Match 3:** ordinary matching and cascades.
2. **Level 2 — Stripes:** make four and keep the resulting striped piece.
3. **Level 3 — Bombs:** create a T/L bomb.
4. **Level 4 — Combos:** place two specials beside each other and combine them.
5. **Level 5 — Color:** create and use the color clearer.
6. **Level 6 — Butterfly:** make a 2 × 2 square and learn that Butterfly targets something useful.

After level 6, stripes, bombs, color clearers, and Butterfly are all ordinary tools throughout the campaign.

## 600-level campaign architecture

The first 600 levels share one permanent special vocabulary. Butterfly is backdated into the established campaign rather than defining a separate era. From level 451 onward, drop/exit objects join that permanent vocabulary. Chapters are organized around objectives, geometry, and difficulty—not around a single featured special.

| Levels | Chapter | Primary job |
|---|---|---|
| 1–5 | Onboarding | Teach match-3, stripes, bombs, combos, and the color clearer |
| 6–30 | Special mastery | Introduce Butterfly at level 6, then learn positioning, saving, targeting, triggering, and combining the full special toolkit |
| 31–60 | Ice | Learn single-layer blocker clearing across different board patterns |
| 61–90 | Collection | Learn single-color collection pressure |
| 91–120 | Mixed | Combine single-layer ice with collection |
| 121–150 | Dual collection | Track two collection goals at once |
| 151–180 | Layered ice | Revisit blocker play with two-hit cells |
| 181–210 | Layered mix | Combine layered ice with collection |
| 211–240 | Precision | Smaller awkward layered-ice patterns plus targeted collection |
| 241–270 | Heavy remix | Dual collection plus layered ice |
| 271–299 | Expert remix | Denser combinations of the full established objective vocabulary |
| 300 | Capstone | Super-hard combined milestone |
| 301–330 | Advanced mastery | Full-toolkit mixed goals with difficulty-aware geometry |
| 331–360 | Ice remix | Layered positional blockers with more demanding layouts |
| 361–390 | Collection remix | Stronger dual-collection planning using the full special toolkit |
| 391–420 | Advanced mix | Layered ice, dual collection, and special combinations |
| 421–449 | Veteran remix | Dense late-campaign combinations and objective pressure |
| 450 | Veteran capstone | Super-hard combined milestone |
| 451–480 | Drop intro | Learn to clear below drop objects and deliver them to exits |
| 481–510 | Drop + ice | Combine positional dropping with single-layer blockers |
| 511–540 | Drop + collection | Balance drop progress against color collection |
| 541–570 | Drop + layered ice | Use specials and Butterfly to create vertical progress through layered blockers |
| 571–600 | Drop mastery | Combine drop goals with the established collection/ice vocabulary |

The chapter boundary is a design tool, not a promise that every level in a chapter looks alike. Each chapter contains three ten-level difficulty waves and varies target pressure, objective counts, patterns, colors, and move budgets.

## Ten-level difficulty wave

For generated campaign levels the default tension rhythm is:

1. relief
2. normal
3. normal
4. normal
5. hard
6. relief
7. normal
8. normal+
9. normal+
10. super-hard

Relief levels generally provide more moves and lighter targets/objectives. Hard and super-hard beats reduce move slack and increase target/objective pressure. The next wave deliberately drops back instead of continuing a monotonic climb.

Automated difficulty profiling remains authoritative for solvability, while human traces tune whether the nominal difficulty labels actually feel correct.

The first family pass through the 300-level campaign confirmed the wave direction but also exposed geometry as a major hidden multiplier. Edge-pattern ice was consistently harsher than center/checker layouts, with diagonal and cross patterns also producing more pressure. From level 301 onward, geometry selection is therefore difficulty-aware: relief beats favor center/checker/column layouts, while harder beats draw more often from cross/diagonal/edge layouts and edge counts receive an additional discount. This is intended to reduce accidental difficulty cliffs without flattening the ten-level wave.

## Objective variation

Ice uses several deterministic placement families so the same blocker creates different decisions:

- checker
- center
- edges
- diagonal
- cross
- columns

Later precision chapters favor awkward edge, column, center, and cross arrangements rather than simply adding more ice.

Collection goals rotate through the six tile identities. Dual-collection chapters choose separated colors so the player must balance two goals while still creating useful specials.

## Lives

- maximum 5 lives
- one life regenerates every 10 minutes
- failing a normal level consumes one life
- reaching zero blocks ordinary play until a life returns
- progress is retained
- no refill purchase or fake-purchase path exists

Bonus events do not consume lives.

## Hammer booster

- two are granted initially
- a hammer removes one selected tile without spending a move
- every ten newly earned best stars creates one immediate hammer award opportunity
- hammer inventory is capped at six
- if inventory is already six when a ten-star threshold is crossed, that hammer is discarded permanently
- no hidden, banked, pending, deferred, or queued hammer balance exists
- a single level or bonus result can grant at most one hammer
- zero inventory points the player back toward earning stars rather than a store

## Bonus-mode system

Bonus modes are short interruptions between ordinary levels. They are optional, non-failing, and use the same visual language as the base game.

### Blitz

Blitz is the processing-speed bonus mode.

- 30 seconds
- no move limit
- no life at risk
- hammer disabled
- faster presentation pacing
- score as much as possible
- result records score, match groups, specials created, and best rating
- replay is allowed, but only a new best star result advances the reward total

Progression Blitz slots continue through the campaign rather than disappearing after the opening run. Current milestone levels are:

`5, 12, 20, 30, 45, 60, 75, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290, 310, 330, 350, 370, 390, 410, 430, 450, 470, 490, 510, 530, 550, 570, 590`

### Quick Recall

Quick Recall is the optional concentrated sequence-memory intermission using Cascade's existing six tile identities.

Current implementation remains non-failing and skippable. Future refinement should make it gentler and adaptive for older players:

- begin around sequence lengths 2–3 for a new/struggling player;
- increase toward 4–5 after demonstrated success;
- provide an obvious re-show/clue affordance rather than punitive failure;
- record assisted and unassisted accuracy separately;
- keep feedback playful and non-diagnostic;
- best-star improvements continue to participate in the earned-star hammer progression.

Quick Recall offers also continue through the campaign. Current milestone levels are:

`8, 24, 48, 72, 96, 126, 156, 186, 216, 246, 276, 306, 336, 366, 396, 426, 456, 486, 516, 546, 576`

### Core cognitive mechanics

The current cognitive-health design is maintained in `planning/cascade-cognitive-health-and-engagement.md`.

Memory is no longer limited to optional side modes. The main campaign will introduce fixed, recoverable memory mechanics beginning after level 700:

- **Recall Locks** — remember a color + symbol condition tied to a fixed lock;
- **Memory Blooms** — reveal and remember fixed matching-symbol pairs;
- **Pattern Echo / Magic Melody** — later small sequence-memory pilot after the first two systems prove fun.

The old moving-tile Memory Fog concept is superseded as the primary memory direction because fixed anchors are easier to understand, replay, simulate, and recover from after forgetting.

## Competition and leaderboard direction

GameFrame has separate semantics for competitive board games and scored events.

Board games keep their existing win/loss/draw standings. Solo score runs are stored through a scored-event contract keyed by game, mode, event, and authenticated player. Only the player's best score for an event is retained.

### Weekly Blitz

Weekly Blitz is the first scored Cascade event.

- each event runs on a UTC Monday-to-Monday week
- the event ID includes a versioned ruleset and the UTC week start date
- the event ID deterministically produces the same starting board and refill RNG sequence for every player
- each player's highest submitted score is retained for that week
- the shared leaderboard ranks by score rather than manufacturing wins/losses
- useful run metrics such as match groups, specials, and maximum cascade depth travel with the best result
- the public score route binds the authenticated GameFrame player and does not accept a payload-supplied player identity as authority

This is a family-playtest competition system, not an anti-cheat tournament service. Score calculation still originates in the client game, while player identity and best-result storage are server-bound.

Useful ranking surfaces now or later:

- Weekly Blitz best score
- total best stars
- deepest level / run completion

## Automated difficulty profiling

The automated players use the same persistent-special engine as the browser game. Every shipped campaign level is exercised by the lookahead bot, and CI samples random, visible-only human personas, greedy, and lookahead strategies.

The human-casual and human-skilled personas are deliberately non-clairvoyant: they score only the board state visible before the move and never resolve candidate refills, Butterfly destinations, or cascades before choosing. Greedy and lookahead remain clairvoyant upper-bound/search agents. The detailed contract and calibration plan lives in `planning/cascade-testing-methodology.md`.

The profiler records:

- win rate by strategy
- skill sensitivity: lookahead minus random win rate
- planning sensitivity: lookahead minus greedy win rate
- moves to win
- score margin
- objective failure rate
- ice hits
- specials created and triggered
- special combinations
- cascade depth
- branching factor
- shuffle rate

A level is not considered shippable if the sampled lookahead strategy cannot produce a win. This is a coarse solvability gate, not a claim that bot difficulty perfectly predicts a human player.

As family playtest traces accumulate, the preferred difficulty measures become first-attempt pass rate, attempts-to-clear, moves remaining, abandonment, and star distribution. Hammer-assisted attempts are excluded from intrinsic difficulty estimates, and known hammer-system testing accounts must not be used to calibrate booster-usage behavior. Invalid swaps are not treated as a player-skill signal.

The first 300 levels may remain comparatively forgiving. From level 301 onward, human-skilled first-pass targets begin an advisory ramp toward a mature deep-campaign wave averaging roughly the mid-50% range by about level 900, while preserving easier relief beats and harder capstones.

## Local play telemetry

`window.cascadeResearch.exportEvents()` exposes the bounded local event stream for debugging and playtest analysis.

Useful events include:

- level start
- valid move
- invalid swap
- match clear and cascade depth
- special created
- special triggered
- special combination
- board shuffle
- level win/failure
- booster armed/used
- Blitz offered/started/completed
- Quick Recall offered/started/skipped/completed
- Weekly Blitz started/submitted/submission failed

Local telemetry must never interfere with gameplay.

## Family-playtest metrics

Track enough to tune the game, not to manufacture pressure:

- levels attempted and completed
- failure rate by level
- moves remaining on wins
- distance from objective on losses
- retry rate
- session return rate
- maximum level reached
- streak length
- special creation/use rate
- special-combination rate
- hammer use rate
- best stars by level
- Blitz attempts, scores, and improvement rate
- Quick Recall participation, accuracy, and improvement rate
- Weekly Blitz participation and best-score spread
- cognitive-accent participation, mismatch/hint use, and performance once core memory mechanics exist

## Expansion beyond level 450

The immediate target is **3,000 levels inside a 10,000-level campaign horizon**. Difficulty must not be compressed merely because the currently authored ceiling is lower. New content should increase decision-space complexity much faster than it increases raw failure pressure.

Mechanics should change the player's decision topology rather than simply adding hit points or larger collection counts. Once taught, a mechanic becomes part of the permanent global vocabulary and can combine with older systems.

The current production roadmap is maintained in `planning/cascade-10000-campaign-roadmap.md`, with older-player cognitive design in `planning/cascade-cognitive-health-and-engagement.md`.

The planned progression through the level-1,000 checkpoint is:

- 601–650 advanced Drop;
- 651–700 Locks/Cages;
- 701–750 Recall Locks and lock mastery;
- 751–800 Memory Blooms;
- 801–850 Enchanted Ground / spread coverage;
- 851–900 controlled cognitive/spatial recombination;
- 901–950 Generators/Producers;
- 951–1,000 color-conditional attention elements plus mature Recall-Lock combinations;
- 1,001–1,050 mastery and a small Pattern Echo pilot only if earlier memory systems are enjoyable.

Later foundational systems still include regrowing blockers, reveal/access systems, portals, conveyors, charged/special-only elements, toggles, and broader recombination.

New mechanics should be implemented as reusable stateful board elements with explicit hooks for direct hits, adjacent matches, special hits, gravity, end-of-turn changes, spawning, movement, targeting, and objective completion. New content should extend the shared engine and profiler rather than create browser-only rules.

The practical production loop uses **150-level expansion/tuning batches**. Internally, those batches can be organized into 30-level chapters for teaching arcs and map presentation, but chapter size does not define generation cadence. Generate the full batch, profile the new range across player personas and seeds, reject or tune impossible/trivial/brittle/luck-dominated outliers, validate the exact head, archive accepted evidence, then recalibrate against family play traces at campaign checkpoints. Desktop and mobile use the same authored difficulty; device-specific telemetry is reserved for diagnosing interaction and readability problems.

## Current development order

1. Persistent stripe/bomb/color special engine and combinations — implemented.
2. Original 300-level campaign, Blitz, Quick Recall, Weekly Blitz, telemetry, and automated profiling — implemented.
3. Family playtest pass through the original campaign — collected and used for difficulty/geometry calibration.
4. Butterfly added to the permanent toolkit and backdated into the established campaign; levels 301–450 extend the same vocabulary — implemented.
5. Human-like profiling, clean playtest analysis, paired-seed comparison, fragility scanning, and the 10,000-level difficulty horizon — current testing foundation.
6. Add drop/exit goals as the first new board-element family and verify full runtime/simulator/telemetry parity — implemented through level 600.
7. Finish the advanced drop slice through level 650 after profiling 451–600, then add locks/cages as the second new family.
8. Use level 1,000 as the first explicit cognitive-mechanic/player-data checkpoint; continue collecting through 1,500 before locking later cognitive density.
9. From 1,051–1,700, add regrowing blockers, reveal/access systems, and deeper producer/dependency combinations in separate testable slices.
10. Add portals, conveyors, charged/special-only systems, toggle mechanics, and cross-system mastery while completing levels 1,700–3,000.
11. Perform a full 3,000-level player-data and content review before committing the 3,001–10,000 recipe mix.
12. Cognitive-accent mechanics are part of the controlled main-campaign vocabulary; Quick Recall and Blitz remain optional concentrated memory/speed modes.
13. VFX/presentation gets its own dedicated pass; spectacle should be preserved or increased rather than solved by simply reducing effects.
