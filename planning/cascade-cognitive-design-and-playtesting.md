# Cascade Cognitive Design + Automated Playtesting

Status: design direction after first 20-level human playthrough  
Scope: Cascade presentation, cognitive variety, level design, automated difficulty profiling, and human calibration

## Product direction

Cascade should remain a fun, immediately legible match-3 game first. Cognitive challenge is a design input for making the game richer, more varied, and more mentally active without turning it into homework.

The target experience is:

- familiar enough that a Candy Crush player immediately understands the board;
- visually expressive enough that a good cascade is satisfying to watch;
- varied enough that players keep exercising visual search, planning, speed, memory, inhibition, and task switching instead of solving the same pattern forever;
- adaptive enough that levels remain challenging without becoming arbitrary or frustrating;
- instrumented enough that automated play and real players can tell us how difficult each mechanic and level actually is.

## Presentation: make cascades worth watching

The current first playable resolves matches too quickly. The engine may calculate rapidly, but the **presentation should serialize the important moments** so the player sees cause and effect.

Desired presentation sequence:

1. Player swap commits.
2. Matched tiles briefly signal that the match is valid.
3. Match brightens / swells / shakes before clearing.
4. Tiles burst with particles, score pops, and audio feedback.
5. Remaining pieces fall visibly rather than teleporting.
6. New pieces land with a short impact beat.
7. If the fall creates another match, pause just long enough for the player to recognize it.
8. The next match ignites with stronger feedback.
9. Each additional cascade escalates particles, sound, screen motion, score treatment, and combo labeling.

The simulation and animation clocks should be separate. Presentation timings should be tunable rather than embedded in board rules.

A x2 cascade should feel clearly better than one match. A x4 or x5 cascade should feel like a small event.

## Cognitive variety without turning the game into homework

### Visual search / processing speed

Potential mechanics:

- **Quick Match bonus:** making another valid move within a short window increases a combo meter or score multiplier.
- The bonus can ramp across several fast successful moves, then decay naturally if the player slows down.
- Some levels can explicitly use a timer or short timed phases.
- Timed play should be an occasional level family, not the permanent ruleset.

The goal is fast visual discrimination and decision-making while preserving the normal match-3 loop.

### Working memory

Potential mechanics:

- briefly show a target pattern, color order, or region and then hide it;
- temporary objectives that rotate after several moves;
- short sequences such as "clear blue, then green, then red" where only the current step is emphasized;
- bonus objectives that require remembering what was collected earlier in the level.

These should stay lightweight. The player should experience them as game objectives, not memory tests.

### Cognitive flexibility / task switching

Potential mechanics:

- alternate between two objectives;
- changing priority targets during the same level;
- a board state that flips which color or blocker matters after a threshold;
- bonus windows where the optimal strategy temporarily changes.

### Inhibition / restraint

Potential mechanics:

- pieces or cells that should not be cleared until another condition is met;
- fragile objectives that are damaged by indiscriminate area clears;
- bonuses for preserving a resource until a better setup appears;
- levels where the obvious immediate match is not always the best move.

### Spatial planning

Potential mechanics:

- blockers and constrained board shapes;
- pieces that must be dropped to specific exits;
- multi-stage setups for special pieces;
- regions that open only after adjacent clears;
- objectives that reward building a future cascade rather than taking the first available match.

### Novelty

Do not let the entire game collapse into one mastered routine. New mechanics should be introduced gradually and later recombined. The challenge should come from **new combinations and decisions**, not only from inflated target numbers or fewer moves.

## Timed / speed-chain concept

A promising mechanic is a move-to-move **tempo chain**:

- a valid move starts a short visible timer;
- another valid move before the timer expires increases the chain;
- higher chains increase score / bonus meter / visual flair;
- an especially fast move can grant a stronger increment;
- the chain can decay rather than instantly vanish, so it feels encouraging rather than punitive;
- cascading matches caused by the board should amplify the presentation but should not necessarily count as player-speed inputs;
- some levels can make tempo optional bonus scoring while dedicated timed levels can make it central.

This creates a video-game-combo feeling while exercising quick visual search and decision-making.

## Automated playtester: purpose

The bot is not primarily an opponent. It is a **level-analysis instrument**.

Its first job is to answer:

- Can this level be completed at all under its rules?
- How often does a competent automated player complete it?
- How many moves does completion usually require?
- How much does luck / refill variance affect the outcome?
- Which mechanics cause failure?
- How many meaningful choices does the board present?
- How often do cascades occur?
- How often does the board deadlock and require reshuffling?
- Is a new level genuinely harder, or merely noisier?

The initial acceptance target is simple: the automated player should be capable of completing the current first 20 levels. That establishes a baseline comparable with the completed human playthrough.

## Automated playtester architecture

### Slice 1 — extract a pure deterministic rules engine

Move the board rules out of `public/cascade.js` into a reusable module with no DOM, animation, localStorage, or timers.

The pure engine should expose operations such as:

- create board from seed;
- enumerate legal swaps;
- apply swap;
- find matches;
- resolve gravity and refill;
- resolve full cascade chain;
- apply booster action;
- compute score changes;
- evaluate win / loss;
- return a complete state transition record.

Browser Cascade then becomes a presentation/controller layer over the same engine the bot uses.

This is the most important architectural step. We do not want a second approximation of Cascade rules living in the test bot.

### Slice 2 — build deterministic simulation harness

A headless simulator should accept:

- level definition;
- random seed;
- player strategy;
- maximum actions;
- optional booster policy.

It should return a structured run record containing:

- win / loss;
- final score;
- moves used / remaining;
- score deficit on failure;
- move history;
- cascade count and maximum cascade depth;
- special-piece usage later;
- board shuffles;
- branching factor per turn;
- elapsed simulated decisions;
- any rule or state anomaly.

### Slice 3 — establish bot skill tiers

Use multiple strategies instead of one supposedly perfect bot.

**Random-legal baseline**  
Chooses any legal move. Useful as a floor and sanity check.

**Greedy bot**  
Scores every immediately legal move and chooses the best immediate result. This approximates a player who recognizes obvious opportunities but does not plan far ahead.

**Lookahead bot**  
Searches several moves ahead with a heuristic that values objective progress, special-piece creation, board quality, and expected cascade potential.

**Strong search bot**  
Later use beam search, Monte Carlo Tree Search, or sampled rollouts where refill randomness makes exact search impractical.

Difficulty should be described against **several bot tiers**, not one solver. A level that destroys the greedy bot but is trivial for shallow lookahead is exercising planning in a useful way.

### Slice 4 — batch level profiler

Run each level across many seeds and each bot tier.

Produce metrics such as:

- win rate;
- median and percentile moves-to-win;
- average score margin on wins;
- average score deficit on losses;
- variance across seeds;
- average legal moves per state;
- frequency of forced / nearly forced choices;
- cascade frequency and depth distribution;
- shuffle frequency;
- booster dependency;
- estimated planning sensitivity: gap between greedy and lookahead performance.

The profiler should emit JSON first and a human-readable report second.

### Slice 5 — difficulty classification

From the profiler, assign each level a provisional difficulty signature rather than a single opaque number.

Example dimensions:

- pass probability;
- luck sensitivity;
- planning demand;
- speed demand;
- visual-search demand;
- objective complexity;
- cascade opportunity;
- booster pressure.

This will become more valuable as Cascade gains timed modes, blockers, collection goals, special pieces, and memory / switching mechanics.

### Slice 6 — calibrate bots against humans

Human telemetry should remain distinct from bot telemetry but use compatible level/result records.

Compare:

- bot win rates vs human win rates;
- bot and human moves-to-win;
- failure margins;
- retry behavior;
- booster use;
- time per move once timing telemetry exists;
- which levels produce long pauses;
- which mechanics produce repeated failures;
- cascade frequency and response to high-cascade boards.

The important calibration is not "make the bot human." It is learning what bot metrics predict the experience of actual players.

Initial reference points can be:

1. random baseline;
2. greedy bot;
3. lookahead bot;
4. completed first-20-level human baseline;
5. later family playtester traces.

### Slice 7 — use the profiler during level authoring

Every authored level should be batch-simulated before it is treated as a candidate level.

A level authoring loop becomes:

1. design mechanic / objective;
2. generate or author candidate level;
3. run bot profiler over many seeds;
4. reject impossible, trivial, or excessively luck-dependent variants;
5. human playtest survivors;
6. compare actual player traces to bot prediction;
7. update tuning heuristics;
8. ship / iterate.

## Bot limits

- Do not let the bot define "fun" by itself.
- Do not assume one automated strategy represents every player.
- Do not mix animation timing into deterministic game-state correctness.
- Do not duplicate browser rules in a separate simulator implementation.

The bot is a measurement tool. Human traces and human reactions remain the authority on whether Cascade actually feels good.

## Recommended implementation order

1. **Separate simulation from presentation** in the current Cascade implementation.
2. **Improve cascade presentation** using the new transition records so each clear / fall / secondary clear can animate distinctly.
3. **Build the pure rules engine and headless simulation harness.**
4. **Implement random + greedy bots.** Confirm they can exercise the current 20 levels without runtime errors.
5. **Implement lookahead / rollout bot** and establish a competent baseline capable of clearing the current run.
6. **Create the batch profiler and JSON difficulty report.**
7. **Add special pieces and new objective families** through the pure engine, with bot coverage from day one.
8. **Add tempo-chain and timed level prototypes**, recording reaction time / move timing separately from simulation rules.
9. **Collect family traces** and start fitting bot metrics to observed human difficulty.
10. **Author the first real tuned level set** using bot screening plus human playtests.

## Near-term success criteria

The next technical milestone is complete when:

- the browser game and bot share one authoritative rules engine;
- the current 20 levels can be simulated headlessly across many seeds;
- at least random, greedy, and lookahead strategies exist;
- the strongest initial bot can complete all 20 current levels on at least some seeds and has measurable per-level win rates;
- a batch command produces a difficulty report for all 20 levels;
- browser gameplay still behaves the same except for intentionally improved cascade presentation;
- the architecture is ready for blockers, collection objectives, special pieces, and timed / tempo-chain mechanics without rewriting the simulator.
