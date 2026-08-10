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

### 3. Difficulty should come from decisions, not artificial frustration

The game should create pressure through board state, objectives, move budgets, special-piece planning, and later objective combinations. It should not rely on purchase prompts, impossible gates, or intentionally miserable opening levels.

### 4. Rewards are earned through play

The player earns 1–3 best stars on ordinary levels and bonus events. Every ten newly earned best stars awards another hammer, subject to the inventory cap. Replaying something only helps if the player improves the stored best result.

Lives remain a pacing mechanic with automatic regeneration. There is no paid, fake-paid, or IOU bypass.

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

## Progression and objectives

The current run contains 100 levels. Later chapters add objective pressure without changing the basic controls:

- score targets;
- ice/blocker clearing;
- color collection;
- mixed objectives;
- layered ice;
- tighter move budgets and harder combinations.

The existing automated player remains useful for solvability and curve calibration, but special-piece strategy should eventually be included in the profiler so late-game tuning reflects the real player rules.

## Lives

- maximum 5 lives;
- one life regenerates every 10 minutes;
- failing a normal level consumes one life;
- reaching zero blocks ordinary play until a life returns;
- progress is retained;
- no refill purchase or fake-purchase path exists.

Bonus events do not consume lives.

## Hammer booster

- two are granted initially;
- a hammer removes one selected tile without spending a move;
- every ten newly earned best stars awards another hammer;
- hammer inventory is capped and overflow rewards can remain banked until there is room;
- zero inventory points the player back toward earning stars rather than a store.

## Bonus-mode system

Bonus modes are short interruptions between ordinary levels. They are optional, non-failing, and use the same visual language as the base game.

### Blitz

The first implemented bonus mode is **Blitz**.

- 30 seconds
- no move limit
- no life at risk
- hammer disabled
- faster presentation pacing
- score as much as possible
- result records score, match groups, specials created, and best rating
- replay is allowed, but only a new best star result advances the reward total

Initial Blitz slots occur after selected progression milestones instead of attaching a small timer to ordinary levels.

### Quick Recall — planned

A short visual-memory intermission using the game's existing tile vocabulary. Example structure:

1. briefly show a small sequence or set of tiles;
2. hide them;
3. present distractors;
4. ask the player to reproduce the set, order, or positions;
5. award an optional bonus result;
6. allow Skip with no penalty.

### Memory Fog — planned

A future match-3 bonus mode in which selected tile identities are visible for a short interval, hidden while the player continues to manipulate the board, then periodically revealed again. Difficulty should be tuned carefully so board motion remains trackable rather than arbitrary.

## Competition and leaderboard direction

Cascade Crush should use scored-game leaderboard semantics rather than pretending a solo score run is a win/loss board-game match.

Useful ranking surfaces:

- Weekly Blitz best score
- total best stars
- deepest level / run completion

The preferred competitive Blitz format uses a shared deterministic seed for the same event so family members receive the same starting board and refill sequence. That makes the comparison more meaningful than unrelated random boards.

## Local play telemetry

`window.cascadeResearch.exportEvents()` exposes the bounded local event stream for debugging and playtest analysis.

Useful events include:

- level start;
- valid move;
- invalid swap;
- match clear and cascade depth;
- special created;
- special triggered;
- special combination;
- board shuffle;
- level win/failure;
- booster armed/used;
- Blitz offered/started/completed.

Local telemetry must never interfere with gameplay.

## Family-playtest metrics

Track enough to tune the game, not to manufacture pressure:

- levels attempted and completed;
- failure rate by level;
- moves remaining on wins;
- distance from objective on losses;
- retry rate;
- session return rate;
- maximum level reached;
- streak length;
- special creation/use rate;
- special-combination rate;
- hammer use rate;
- best stars by level;
- Blitz attempts, scores, and improvement rate;
- optional-memory-mode participation and performance once those modes exist.

## Current development order

1. Persistent special-piece engine and combinations.
2. Teach permanent special rules in levels 1–5.
3. Remove the IOU/fake-economy code path completely.
4. Standalone 30-second Blitz bonus mode.
5. Rerun automated and browser/visual acceptance and retune difficulty where special pieces change the curve.
6. Quick Recall bonus mode.
7. Scored-game leaderboard contract, with Weekly Blitz as the first Cascade leaderboard.
8. Memory Fog and other memory/attention variations after real playtest feedback.
9. Continue polishing effects, sound, authored level beats, and accessibility without making the UI busier than the board needs.
