# Cascade Crush 10,000-Level Campaign Roadmap

Status: canonical campaign expansion plan  
Immediate production milestone: 3,000 shipped levels  
Long-horizon capacity: 10,000 levels  
Current shipped slice: 1–600

## Core doctrine

Cascade is not designed as a short campaign that gets progressively harder until it runs out of room.

The campaign is designed around a 10,000-level horizon. The first 3,000 levels are the immediate content milestone and should establish a broad reusable mechanic vocabulary without exhausting the design space.

Three progression axes remain separate:

1. **Complexity** — the number and interaction depth of mechanics can grow for thousands of levels.
2. **Local tension** — every ten-level wave continues to oscillate through relief, normal, hard, and super-hard beats.
3. **Global raw difficulty** — first-pass pressure rises slowly across thousands of levels and plateaus near the mature campaign rather than increasing forever.

Levels 301–600 remain early-campaign fluency and mechanic-growth content.

## Production batch contract

The current production expansion unit is **150 shipped levels per generation/tuning pass**. The accepted 451–600 expansion is the reference implementation of that workflow.

A 30-level chapter is an internal content-organization and player-map unit, not the production generation cadence. A normal 150-level pass may span five 30-level chapters and may cross mechanic-family boundaries when the roadmap requires it.

Unless explicitly changed by a later decision, agents should plan, generate, profile, tune, review, and accept Cascade expansion work in 150-level batches. Do not infer a 30-level generation limit from `CHAPTER_SIZE`, the player-facing map window, or chapter recipe boundaries.

## Immediate milestone architecture: levels 451–3,000

New mechanics enter in teach/practice/mix/mastery arcs, then become ordinary parts of the global vocabulary.

A new mechanic should earn its place by changing player decisions. Cosmetic variants or additional hit points do not count as new mechanic families.

The cognitive-health and engagement contract is maintained in `planning/cascade-cognitive-health-and-engagement.md`. It is a canonical companion to this roadmap for older-player cognitive load, memory-mechanic design, engagement cadence, hidden-information simulation, and the 601–1,050 content mix.

### 451–650 — Drop / exit objects

Primary rule: objective pieces travel with gravity to designated exits.

Levels 451–600 established the mechanic. Levels 601–650 finish advanced Drop mastery and combinations before the next family becomes central.

Decision changes:

- board position matters independently of color;
- clearing below an object can be more valuable than matching the object itself;
- Butterfly and other specials can help with useful support cells without solving future board states.

### 651–700 — Locks / cages

Primary rule: a piece can remain visible while access or use is constrained by a removable lock.

Decision changes:

- access becomes an objective;
- freeing a useful piece can matter more than taking an immediate match;
- locks combine naturally with collection, ice, Drop, and specials.

The lock system supports layers and explicit damage rules rather than one-off blocker copies.

### 701–750 — Recall Locks and lock mastery

Recall Locks are a memory-bearing variant within the locks/cages family.

A Recall Lock briefly reveals a redundant color + symbol condition, hides the cue, and is later opened by satisfying the remembered condition near its fixed board location.

Design constraints:

- debut only on relief/normal beats;
- wrong-color actions do not erase unrelated progress;
- early versions remain actionable immediately after reveal;
- later versions may introduce a short prospective-memory delay;
- cues are large, fixed, high-contrast, and never rely on subtle color alone.

### 751–800 — Memory Blooms

Primary new cognitive family: fixed magical Blooms contain hidden matching symbol pairs.

Implemented production contract:

- adjacent/direct clears advance one Bloom interaction per cascade step;
- an opened Bloom remains visibly open with a large color + symbol cue;
- the matching partner remains hidden elsewhere in a fixed Bloom;
- finding the remembered pair collects both;
- a mismatch briefly reveals both symbols, then closes them again without wiping unrelated board progress;
- board-wide specials may help reveal Blooms but cannot automatically resolve several pairs in one clear.

Start with two pairs. Mature levels may use three; do not exceed four without family evidence supporting it.

### 801–850 — Enchanted Ground / spread coverage

Primary rule: a persistent sparkling underlay spreads through a clear only when that clear already touches covered magic.

Decision changes:

- territory coverage matters;
- the player sometimes needs the right match in the right location;
- line/bomb/color clears become area-control tools when they intersect existing Ground;
- single-target helpers do not automatically solve the coverage objective.

Presentation is magical/fantasy ground rather than generic “jam,” and must remain readable beneath the candy.

### 851–900 — Cognitive + spatial recombination

No foundational mechanic is required in this slice.

Use controlled combinations of:

- Memory Blooms;
- Recall Locks;
- Enchanted Ground;
- Locks;
- Drop;
- Ice / collection;
- established specials.

Do not stack two unfamiliar cognitive systems with high raw move pressure.

### 901–950 — Crystal Producers / generators

Primary rule: fixed Crystal Producers manufacture objective crystals when clears activate them.

Decision changes:

- the player may need to manufacture the thing later collected or delivered;
- activation order and producer access matter;
- producer + lock + Drop combinations create dependency chains.

Producer placement and output must be deterministic under board RNG and fully represented in simulator/replay tooling. The implemented Producer uses a visible remaining-charge count. A qualifying adjacent/direct clear spends one charge and manufactures a crystal that remains on the forge; a later direct clear collects that crystal before the forge can finish its remaining production cycle.

### 951–1,000 — Color Wards / visible attention elements

Primary rule: a fixed Color Ward visibly shows the color-symbol it wants and opens when that color is cleared beside it. This is a selective-attention rule, not a hidden-memory test.

Decision changes:

- ordinary colors acquire situational value;
- visual search and selective attention become more important;
- mature Recall-Lock combinations can coexist with non-memory color-conditional elements.

Level 1,000 is a major human-data and cognitive-mechanic checkpoint. The owner explicitly requested stopping the current production pass at 1,000, so 901–1,000 is a 100-level milestone slice; 1,001–1,050 remains the unfinished tail of the normal 150-level production batch.

### 1,001–1,050 — Mastery plus Pattern Echo pilot

Use the remaining slice of the 901–1,050 production batch for recombination and review.

Pattern Echo / Magic Melody may receive a small, low-pressure pilot only if Recall Locks and Memory Blooms show good family engagement. It presents a short 2–4 item color/symbol sequence and asks the player to advance it in order; wrong colors do not reset the sequence.

### Player-data checkpoint A — level 1,000, with follow-up through 1,500

Before generating the remainder of the 3,000-level milestone at scale:

- consult the retained Cascade difficulty history (private canonical archive, with the GameFrame public-safe mirror for local comparison) rather than recomputing every earlier batch by default;
- export new family telemetry;
- measure clean first-pass rate and attempts-per-success by wave, mechanic family, and chapter;
- compare observed outcomes with the human-skilled persona;
- update persona calibration only if the discrepancy is systematic;
- inspect stopping points, retry clusters, objective deficits, and booster-free outcomes;
- preserve device-independent level difficulty;
- use mobile segmentation only for UX/input diagnosis.

At level 1,000, explicitly review both ordinary level difficulty and the new cognitive-accent mechanics: participation, clean first-pass rate, memory success/mismatch behavior, hint/re-show use, retries, stopping points, and direct family feedback. Continue collecting through 1,500 before locking later cognitive-mechanic density.

This checkpoint is deliberately before the campaign reaches 3,000 so the second half can benefit from real play.

### 1,051–1,250 — Regrowing / spreading blockers

Primary rule: an unresolved blocker can reproduce or reclaim cells at end of turn.

Decision changes:

- urgency and containment enter the puzzle;
- allowing a threat to survive has an opportunity cost;
- local tactics compete with long-term control.

Growth must be bounded and deterministic enough for the simulator to profile reliably. This family should not be stacked with difficult memory tasks on introduction.

### 1,251–1,450 — Reveal / access systems

Primary rule: curtains, gates, covers, or similar elements hide or isolate board regions until conditions are met.

Decision changes:

- the available board changes during the level;
- early moves can be about opening future space;
- objectives can be staged without requiring another scene.

These systems can later support memory-aware variants, but their initial form should remain visually explicit.

### 1,451–1,700 — Advanced producer / dependency chains

Generators/Producers are already introduced around 901–950. This later slice deepens them rather than introducing them again.

Use:

- producer + cage dependencies;
- producer + Drop routing;
- producers that create required objectives;
- controlled multi-step dependency chains.

No new cognitive family is required here unless level-1,000 family data clearly supports one.

### 1,701–1,950 — Portals

Primary rule: gravity can transfer pieces between linked entry/exit cells.

Decision changes:

- board topology becomes non-Euclidean;
- vertical planning no longer maps directly to screen position;
- Drop objects and producers gain substantially more depth.

Portals must expose their routing graph to the simulator and level validator.

### 1,951–2,200 — Conveyors / moving board elements

Primary rule: selected cells or occupants move automatically at turn boundaries.

Decision changes:

- board state changes even when the player does not directly touch an element;
- timing and prediction become important;
- moving objectives create controlled dynamism without random hazards.

### 2,201–2,450 — Special-only armor / charged devices

Primary rule: some elements require specials, combinations, or accumulated charge rather than ordinary matches.

Decision changes:

- special creation becomes mandatory rather than merely advantageous;
- players must preserve and position specials deliberately;
- Butterfly remains useful without becoming a universal answer.

### 2,451–2,650 — Toggle / alternating elements

Primary rule: elements change state on a deterministic turn cadence or after specific actions.

Decision changes:

- timing joins color and position as a planning axis;
- the same move can be good or bad depending on current state;
- the mechanic naturally exercises cognitive flexibility without becoming a memory test.

### 2,651–2,800 — Cross-system mastery prelude

Introduce few or no foundational mechanics.

Use the established vocabulary to practice:

- producer + portal routing;
- Recall Locks with already-mastered spatial systems;
- Ground + conveyors;
- toggles + color conditions;
- memory accents only when visual load remains manageable.

### 2,801–3,000 — First milestone mastery arc

The final 200 levels before the 3,000 milestone should introduce few or no foundational mechanics.

Their job is to prove that the permanent vocabulary supports rich combinations:

- drop + portals;
- cages + producers;
- spreading terrain + conveyors;
- color conditions + generators;
- special-only armor + Butterfly/stripe/bomb planning;
- reveal systems feeding multi-step objectives;
- controlled three-mechanic combinations where readability remains strong.

The milestone capstones should feel earned through mastery, not through arbitrary move starvation.

## Memory and attention mechanics

Memory and attention are now a controlled part of Cascade's core campaign identity rather than future optional-only concepts.

The canonical design is in `planning/cascade-cognitive-health-and-engagement.md`.

Campaign rules:

- explicit cognitive-accent content normally occupies about 4–6 levels per 30-level chapter;
- normal levels remain untimed;
- new cognitive mechanics debut on relief/normal beats;
- forgetting normally costs objective opportunity rather than causing punitive resets;
- cues use redundant color + symbol coding and fixed high-contrast anchors;
- human-like simulation must respect what the player has actually seen rather than reading hidden engine truth.

Quick Recall remains an optional concentrated sequence-memory intermission. Blitz remains an optional processing-speed mode.

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

## 150-level production pass

The current level-production workflow is the one proven by the accepted 451–600 expansion:

1. define the mechanic progression and internal chapter structure for the next 150-level range;
2. generate the full 150-level candidate range from the shared campaign rules;
3. validate schema, objective reachability, mechanic compatibility, and engine execution;
4. profile the new range with random, human-casual, human-skilled, greedy, and lookahead strategies;
5. run fragility analysis and inspect seed/geometry outliers;
6. tune specific bad levels or recipes rather than shrinking the production batch;
7. rerun the affected range and exact-head validation;
8. visually review new mechanics/presentation where applicable;
9. archive the accepted profile and fragility evidence with exact commit/workflow provenance.

Older shipped ranges are not re-simulated in full on every 150-level pass. Use retained historical evidence plus mechanic sentinels, escalating to a full historical sweep only for consequential engine changes, material sentinel drift, or deliberate major checkpoints.

Internal 30-level chapters remain useful for teaching arcs, map presentation, and recipe organization. They are not separate generation passes.

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

Historical accepted checkpoint for Butterfly, early-campaign balance, testing infrastructure, and outlier handling.

### Checkpoint 850

Drop/exit and cages are stable and reusable.

### Checkpoint 1,000

Run the first explicit cognitive-mechanic and player-data review before expanding the new vocabulary further.

### Checkpoint 1,500

Recheck persona calibration, cognitive-accent density, and mechanic avoidance/engagement using the larger family sample.

### Checkpoint 2,200

Validate producers, reveal systems, and portals before adding moving-board systems at scale.

### Archive each accepted batch

Before moving on from a profiled/tuned batch, retain its accepted compact profile and fragility snapshot in the private canonical archive. Mirror public-safe bot/fragility evidence into `data/cascade/difficulty-archive/` for repository-local comparison and CI integrity. Historical baselines let later work compare against earlier campaign regions without repeatedly simulating every shipped level.

Use sentinel levels from each established mechanic family after consequential engine changes. Escalate to a full historical sweep only when sentinels drift materially or at a deliberate major checkpoint.

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

## Implementation order from current main

1. 450-level Butterfly and human-testing foundation with the 10,000-level horizon — implemented.
2. Drop/exit objectives end-to-end plus the 451–600 production batch — implemented, profiled, tuned, accepted, and archived.
3. Production batch 601–750: advanced Drop, Locks/Cages, then low-pressure Recall Locks.
4. Production batch 751–900: Memory Blooms, Enchanted Ground, then controlled cognitive/spatial recombination.
5. Production batch 901–1,050: Producers, color-conditional attention elements, level-1,000 player-data checkpoint, and a small Pattern Echo pilot only if earlier memory systems test well.
6. Continue later mechanics in 150-level production batches, using level-1,000 and level-1,500 family data to decide cognitive-accent density.
7. Reassess batch policy only through an explicit later decision; do not silently revert to chapter-sized generation.
