# Casual Games / Cascade Crush Foundation

Status: active family-playtest build  
Scope: GameFrame casual-games lane and the first match-3 title, **Cascade Crush**

## Product thesis

Cascade Crush should be a bright, friction-light match-3 game that is fun enough to play on its own merits, without purchases, fake purchases, or a monetization simulator. The family build should support friendly competition, short repeatable sessions, earned rewards, and occasional bonus modes that change the kind of attention and memory the player uses.

The cognitive goal is modest and practical: mix ordinary match-3 planning with short bursts of speed, recall, divided attention, and visuospatial memory. The game is not presented as a treatment or medical intervention.

The game must remain original in presentation, content, level design, art, names, progression, and implementation. Familiar genre mechanics are useful because players can understand them immediately without learning a new hobby before the interesting parts begin.

## Core principles

### 1. Fun first

The main loop has to work as a game before any cognitive variation matters. Levels should be readable quickly, inputs should feel immediate, cascades should be satisfying, and the next useful action should rarely require menu work.

### 2. Normal levels are mostly untimed

Normal Cascade Crush uses moves as the resource. Players can think as long as they want. Time pressure is reserved for explicit bonus events so it feels different instead of becoming background stress.

### 3. Difficulty comes in waves, not one endless ramp

The campaign uses repeating ten-level tension waves. A typical wave opens with a relief level, builds through ordinary pressure, reaches a hard beat around the middle, releases pressure again, then ends on a super-hard capstone. Difficulty still rises across the campaign because objectives become more demanding, but the immediate experience should breathe.

The wave is intentionally data-driven rather than pretending level number itself is difficulty.

### 4. Get more mileage from mechanics before inventing new ones

A mechanic receives roughly thirty levels of focused runway before the next major objective family becomes central. Within those thirty levels the game varies geometry, objective counts, move pressure, special-piece interaction, and combinations with previously learned rules.

The goal is not filler. The goal is to let a good match-3 player actually master the decision space created by a mechanic before the campaign moves on.

### 5. Rewards are earned through play

The player earns 1–3 best stars on ordinary levels and bonus events. Every ten newly earned best stars attempts to award one hammer, subject to the six-hammer inventory cap. If the inventory is already full at that moment, that hammer is discarded; Cascade does not bank, queue, defer, or otherwise track overflow hammer rewards. Replaying something only helps if the player improves the stored best result.

Lives remain a pacing mechanic with automatic regeneration. There is no paid, fake-paid, or IOU bypass.

## Campaign scale

The campaign system is deliberately sized for **1,000 levels** without requiring another level-model rewrite.

The currently shipped and continuously validated campaign contains **300 levels**. Levels 301–1000 are future content, not a separate architecture.

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

### Combinations

Adjacent specials can be swapped together for stronger effects. Initial supported combinations include:

- stripe + stripe
- stripe + bomb
- bomb + bomb
- color clearer + another special
- color clearer + color clearer

Specials hit by another special can trigger recursively.

## Opening teaching sequence

The first five levels introduce the permanent rules rather than treating them as late-game gimmicks.

1. **Level 1 — Match 3:** ordinary matching and cascades.
2. **Level 2 — Stripes:** make four and keep the resulting striped piece.
3. **Level 3 — Bombs:** create a T/L bomb.
4. **Level 4 — Combos:** place two specials beside each other and combine them.
5. **Level 5 — Color:** create and use the color clearer.

After level 5, all three special families are part of normal play.

## 300-level campaign architecture

The first 300 levels deliberately reuse and recombine the existing mechanics instead of burning through a large pile of new blockers.

| Levels | Chapter | Primary job |
|---|---|---|
| 1–5 | Onboarding | Teach match-3 and the permanent special families |
| 6–30 | Special mastery | Learn positioning, saving, triggering, and combining specials |
| 31–60 | Ice | Learn single-layer blocker clearing across different board patterns |
| 61–90 | Collection | Learn single-color collection pressure |
| 91–120 | Mixed | Combine single-layer ice with collection |
| 121–150 | Dual collection | Track two collection goals at once |
| 151–180 | Layered ice | Revisit blocker play with two-hit cells |
| 181–210 | Layered mix | Combine layered ice with collection |
| 211–240 | Precision | Smaller awkward layered-ice patterns plus targeted collection |
| 241–270 | Heavy remix | Dual collection plus layered ice |
| 271–299 | Expert remix | Denser combinations of the full objective vocabulary |
| 300 | Capstone | Super-hard combined finale |

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

Automated difficulty profiling remains authoritative for solvability. Human playtest data should eventually tune the exact factors.

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

Progression Blitz slots continue through the 300-level campaign rather than disappearing after the opening run. Current milestone levels are:

`5, 12, 20, 30, 45, 60, 75, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290`

### Quick Recall

Quick Recall is a short sequence-memory intermission using Cascade's existing six tile identities.

- optional and non-failing
- three rounds per session
- sequence lengths 3, 4, and 5
- each tile is shown briefly, then hidden
- the player repeats the sequence from a six-tile palette
- result records total accuracy, perfect rounds, best result, and 0–3 stars
- Skip has no penalty
- best-star improvements participate in the same earned-star hammer progression as the other bonus modes

Quick Recall offers also continue through the campaign. Current milestone levels are:

`8, 24, 48, 72, 96, 126, 156, 186, 216, 246, 276`

### Memory Fog — planned

A future match-3 bonus mode in which selected tile identities are visible for a short interval, hidden while the player continues to manipulate the board, then periodically revealed again. Difficulty should be tuned carefully so board motion remains trackable rather than arbitrary.

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

The automated player uses the same persistent-special engine as the browser game. Every shipped campaign level is exercised by the lookahead bot, and CI samples multiple seeds per level for random, greedy, and lookahead strategies.

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

As family playtest traces accumulate, the preferred difficulty measures become first-attempt pass rate, attempts-to-clear, moves remaining, abandonment, booster usage, and star distribution.

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
- optional-memory-mode participation and performance once additional modes exist

## Expansion beyond level 300

Levels 301–1000 should extend the same model rather than introduce a second campaign system.

The intended direction is:

- **301–600 — mastery:** fewer new mechanics, more demanding geometry and combinations
- **601–1000 — veteran:** mostly expert remixes, occasional genuinely useful new mechanics, long spacing between introductions

A future expansion should add chapter recipes and validated generated candidates; it should not require changing save-state shape, navigation, level numbering, or the core engine.

## Current development order

1. Persistent special-piece engine and combinations — implemented.
2. Teach permanent special rules in levels 1–5 — implemented.
3. Remove the IOU/fake-economy code path completely — implemented.
4. Standalone 30-second Blitz bonus mode — implemented.
5. Quick Recall bonus mode — implemented.
6. Generic scored-game leaderboard contract + Weekly Blitz — implemented.
7. Expand the campaign architecture to 1,000-capable and ship 300 profiled levels — current slice.
8. Memory Fog and other memory/attention variations after real playtest feedback.
9. Use human traces to retune the 300-level curve before authoring the 301–1000 expansion.
10. Continue polishing effects, sound, authored level beats, competitive surfaces, and accessibility without making the UI busier than the board needs.
