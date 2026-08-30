# Cascade Cognitive Design Notes

Status: historical product-design notes; **not authoritative for current level generation, difficulty calibration, bot behavior, or production cadence**  
Scope: retained cognitive/presentation ideas from the first 20-level era

Current operational authority:
- `planning/cascade-10000-campaign-roadmap.md` — campaign progression and 150-level production-batch policy
- `planning/cascade-testing-methodology.md` — current simulator, personas, calibration, validation, and archive policy

Do not use this file to infer current level counts, bot architecture, generation batch size, or implementation order.

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

## Historical boundary

The original automated-playtester architecture, first-20-level acceptance criteria, batch-profiler implementation plan, and early level-authoring workflow have been removed from this document because they were superseded by the current Cascade roadmap and testing methodology.

The cognitive-design ideas above remain as historical/product inspiration only.
