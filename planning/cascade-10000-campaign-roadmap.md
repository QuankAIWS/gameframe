# Cascade Crush 10,000-Level Campaign Roadmap

Status: canonical campaign expansion plan  
Immediate production milestone: 3,000 shipped levels  
Long-horizon capacity: 10,000 levels  
Current shipped slice: 1–450

## Core doctrine

Cascade is not designed as a 450-level game that gets progressively harder until it runs out of room.

The campaign is designed around a 10,000-level horizon. The first 3,000 levels are the immediate content milestone and should establish a broad reusable mechanic vocabulary without exhausting the design space.

Three progression axes remain separate:

1. **Complexity** — the number and interaction depth of mechanics can grow for thousands of levels.
2. **Local tension** — every ten-level wave continues to oscillate through relief, normal, hard, and super-hard beats.
3. **Global raw difficulty** — first-pass pressure rises slowly across thousands of levels and plateaus near the mature campaign rather than increasing forever.

Levels 301–450 remain early-campaign mastery content.

## Immediate milestone architecture: levels 451–3,000

New mechanics enter in teach/practice/mix/mastery arcs, then become ordinary parts of the global vocabulary.

A new mechanic should earn its place by changing player decisions. Cosmetic variants or additional hit points do not count as new mechanic families.

### 451–650 — Drop / exit objects

Primary new rule: some objective pieces must travel with gravity to designated exits.

Decision changes:

- board position matters independently of color;
- clearing below an object can be more valuable than matching the object itself;
- portals, conveyors, cages, and producers can later combine naturally with drop objectives.

Teaching structure:

- isolated drop object and obvious bottom exit;
- multiple drop objects;
- exits restricted to selected columns;
- ice plus drop;
- Fish/special interaction with drop-supporting cells;
- chapter-end mixed mastery.

### 651–850 — Locks / cages

Primary new rule: a piece can be usable or visible while still constrained by a removable lock.

Decision changes:

- access becomes an objective;
- the player may need to clear a lock before a useful piece can participate normally;
- cages combine well with collection, ice, drop objects, and specials.

The lock system should support layers and explicit damage rules rather than creating separate one-off cage types.

### 851–1,050 — Spreading terrain / jam

Primary new rule: matches spread or clear a board-state underlay across cells.

Decision changes:

- territory coverage matters;
- the player must sometimes match in a location rather than merely collect a color;
- existing specials become tools for rapid area control.

### 1,051–1,250 — Regrowing / spreading blockers

Primary new rule: an unresolved blocker can reproduce or reclaim cells at end of turn.

Decision changes:

- urgency enters the puzzle;
- allowing a threat to survive has an opportunity cost;
- local tactics compete with long-term containment.

Growth must be bounded and deterministic enough for the simulator to profile reliably.

### 1,251–1,450 — Color-conditional blockers

Primary new rule: blocker state responds to specific tile colors or color classes.

Decision changes:

- otherwise ordinary colors acquire situational value;
- color clearers and Fish gain new tactical roles;
- collection and blocker objectives can compete for the same colors.

### Player-data checkpoint A — approximately levels 1,000–1,500

Before generating the remainder of the 3,000-level milestone at scale:

- export new family telemetry;
- measure clean first-pass rate and attempts-per-success by wave, mechanic family, and chapter;
- compare observed outcomes with the human-skilled persona;
- update persona calibration only if the discrepancy is systematic;
- inspect stopping points, retry clusters, objective deficits, and booster-free outcomes;
- preserve device-independent level difficulty;
- use mobile segmentation only for UX/input diagnosis.

This checkpoint is deliberately before the campaign reaches 3,000 so the second half can benefit from real play.

### 1,451–1,700 — Generators / producers

Primary new rule: board elements create objective pieces or blockers when activated.

Decision changes:

- the player may need to manufacture the thing they later collect;
- activation order and producer access matter;
- producer + cage + drop combinations create dependency chains.

Producer output must be deterministic under the board RNG and fully understood by simulator/replay tooling.

### 1,701–1,950 — Reveal / access systems

Primary new rule: curtains, gates, covers, or similar elements hide or isolate regions until conditions are met.

Decision changes:

- the available board changes during the level;
- early moves can be about opening future space;
- objectives can be staged without requiring a separate game scene.

### 1,951–2,200 — Portals

Primary new rule: gravity can transfer pieces between linked entry/exit cells.

Decision changes:

- board topology becomes non-Euclidean;
- vertical planning no longer maps directly to screen position;
- drop objects and producers gain substantially more depth.

Portals must expose their routing graph to the simulator and level validator.

### 2,201–2,450 — Conveyors / moving board elements

Primary new rule: selected cells or occupants move automatically at turn boundaries.

Decision changes:

- board state changes even when the player does not directly touch an element;
- timing and prediction become important;
- moving objectives can create controlled dynamism without random hazards.

### 2,451–2,650 — Special-only armor / charged devices

Primary new rule: some elements require specials, combinations, or accumulated charge rather than ordinary matches.

Decision changes:

- special creation becomes mandatory rather than merely advantageous;
- players must preserve and position specials deliberately;
- Fish can remain useful without becoming a universal answer.

### 2,651–2,800 — Toggle / alternating elements

Primary new rule: elements change state on a deterministic turn cadence or after specific actions.

Decision changes:

- timing joins color and position as a planning axis;
- the same move can be good or bad depending on current state;
- later conveyors/portals can interact with timing without introducing more raw blocker health.

### 2,801–3,000 — First milestone mastery arc

The final 200 levels before the 3,000 milestone should introduce few or no foundational mechanics.

Their job is to prove that the permanent vocabulary supports rich combinations:

- drop + portals;
- cages + producers;
- spreading terrain + conveyors;
- color conditions + generators;
- special-only armor + Fish/stripe/bomb planning;
- reveal systems feeding multi-step objectives;
- controlled three-mechanic combinations where readability remains strong.

The milestone capstones should feel earned through mastery, not through arbitrary move starvation.

## Memory and attention mechanics

Cascade should retain distinctive memory-oriented content, but memory should not replace the main match-3 loop.

Candidate systems:

### Memory Fog

A small set of cells briefly reveals underlying identity/state, then hides it while the board remains interactive. The hidden state must remain trackable despite board movement.

### Pattern Echo

Several cells or colors flash in a short sequence. Later progress is improved or required by hitting remembered locations or colors in order.

### Recall Gates

A reveal/access element briefly displays the condition required to reopen it, then hides that condition until the player acts.

Memory mechanics should first appear as optional or low-stakes variants. Promote them into normal campaign vocabulary only if playtests show they remain fun rather than frustrating.

## 3,001–10,000 direction

The post-3,000 campaign should introduce mechanics more slowly.

The permanent vocabulary itself becomes the main content multiplier:

- old mechanics gain new pairings;
- multi-stage objectives become more common;
- geometry and routing matter more;
- occasional new mechanics refresh the decision space;
- raw first-pass difficulty continues its slow climb toward the mature plateau.

A rough pacing target is one genuinely new foundational family every several hundred levels at most, with large stretches devoted to recombination and mastery.

The 10,000-level horizon is not a promise that 10,000 is a hard stop. The difficulty curve plateaus there so additional levels can be added without turning the campaign into permanent punishment.

## Difficulty anchors

Human-skilled first-pass bands use the canonical anchors in the simulator:

| Anchor | Approx. wave-average midpoint |
|---|---:|
| 301 | ~86% |
| 1,000 | ~82% |
| 2,000 | ~78% |
| 3,000 | ~74% |
| 5,000 | ~68% |
| 7,500 | ~62% |
| 10,000+ | ~58% |

These are advisory authoring targets, not guarantees or CI gates.

The ten-level wave remains more important than the global average: relief must still feel like relief, and super-hard beats must remain exceptional rather than becoming the permanent baseline.

## Candidate-generation pipeline

Do not author one generated candidate and accept it automatically.

For each intended level slot:

1. generate multiple candidate recipes from the chapter vocabulary;
2. validate schema, objective reachability, and mechanic compatibility;
3. run random, human-casual, human-skilled, greedy, and lookahead personas;
4. reject impossible or solver-broken candidates;
5. reject trivially easy candidates when they do not occupy a relief slot;
6. reject fragile candidates with excessive +/- one-move sensitivity;
7. reject candidates with excessive seed variance or geometry dependence;
8. score novelty against recently selected levels;
9. retain candidates closest to the target tension band while preserving variety;
10. run paired-seed comparison whenever engine rules change.

Generation should happen in bounded batches, preferably 30-level chapters or a few chapters at a time, so mechanic quality can be reviewed before multiplying mistakes across thousands of levels.

## Testing and model roadmap

The current human-casual and human-skilled personas remain the primary interpretable simulation layer.

The richer telemetry path should eventually record enough information to reconstruct:

`board state + objectives + legal moves -> human-selected move`

Once the dataset is large enough, a local move-ranking model can be trained on the user's RTX 3090.

The first learned model does not need to be large. Suitable experiments include:

- compact convolutional board model;
- graph neural network over cells and board relations;
- small board transformer;
- pairwise/ranking model over legal move feature vectors.

The learned model should be compared against the interpretable personas rather than replacing them automatically.

Acceptance criteria for a useful learned model:

- improved top-1/top-3/top-5 agreement with held-out human moves;
- better prediction of first-pass and attempts-per-success by level family;
- stable behavior on mechanics not overrepresented in training;
- no use of hidden future RNG information.

## Production checkpoints

### Checkpoint 450

Current implementation slice. Validate Fish, early-campaign balance, testing infrastructure, and outlier handling.

### Checkpoint 850

Drop/exit and cages are stable and reusable.

### Checkpoint 1,500

Run player-data checkpoint A and decide whether simulator/persona calibration needs adjustment.

### Checkpoint 2,200

Validate producers, reveal systems, and portals before adding moving-board systems at scale.

### Checkpoint 3,000

Run a full campaign review:

- mechanic adoption and dislike signals;
- difficulty curve versus observed family outcomes;
- retries and stopping points;
- chapter/geometry outliers;
- mobile UX separately from level difficulty;
- whether memory variants deserve more prominence;
- whether the next 7,000 levels need a different mechanic cadence.

Only after this review should the 3,001–10,000 recipe mix be locked in.

## Implementation order from the current branch

1. Land the 450-level Fish and human-testing foundation with the 10,000-level horizon corrected.
2. Implement drop/exit objectives end-to-end: engine, runtime, rendering, simulator, telemetry, tests.
3. Implement locks/cages end-to-end on the same shared board-element contracts.
4. Generate and profile the first post-450 chapter batches.
5. Continue mechanics and content in bounded batches toward the 3,000 milestone.
