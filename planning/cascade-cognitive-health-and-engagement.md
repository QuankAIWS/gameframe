# Cascade Cognitive Health + Engagement Design

Status: canonical companion to the Cascade campaign roadmap  
Audience: Cascade level generation, mechanic design, simulator/telemetry work, and family-playtest interpretation  
Primary product audience: older family players

## Product objective

Cascade should be an excellent match-3 game first and a cognitively stimulating activity second.

The intended experience is a familiar, highly replayable Candy Crush / Royal Match-style game with a deliberately stronger but mostly invisible emphasis on:

- visual search and selective attention;
- spatial planning and reasoning;
- short-term / working memory;
- visuospatial memory;
- prospective memory (remembering to act on a cue later);
- cognitive flexibility and task switching;
- inhibition / restraint;
- optional processing-speed play.

Do not market or present Cascade as a treatment, diagnostic, dementia-prevention product, or proof that a player's cognition is improving. The evidence for cognitive training in older adults supports modest, domain-specific benefits and cognitive stimulation, not broad guaranteed transfer. Cognitive play is also only one part of healthy aging; it does not replace physical activity, social connection, hearing care, sleep, or management of cardiovascular/metabolic risk.

The health-oriented design goal is therefore:

> make the activity enjoyable enough to repeat, varied enough to exercise several cognitive processes, gentle enough for older players to sustain, and instrumented enough to learn what is actually fun and usable.

## Evidence boundary

The 2026 WHO risk-reduction guideline conditionally recommends cognitive training for older adults with normal cognition or mild cognitive impairment and conditionally encourages cognitive stimulation, while rating the evidence low or very low certainty. WHO also treats social activity as relevant to cognitive health.

Game-based cognitive-training meta-analysis has reported small-to-moderate improvements in processing speed, selective attention, and short-term memory. Long-term and far-transfer effects are less reliable than improvement on the trained or closely related tasks.

The ACTIVE randomized trial is important context: targeted reasoning and speed-of-processing training produced durable effects on the trained abilities and better self-reported everyday function at long follow-up, while memory effects were less durable.

Design implications:

- practice several domains rather than overfitting one memory task;
- repeat mechanics over time instead of treating them as one-off novelty;
- prefer meaningful game decisions over abstract test-like exercises;
- treat cognitive benefit as supplementary and probabilistic;
- preserve enjoyment, usability, and adherence because an exercise nobody wants to repeat has little practical value.

## Older-player design rules

### Normal campaign play is untimed

Ordinary levels remain move-limited, not clock-limited.

A game-based brain-training meta-analysis found non-time-pressure designs among the more favorable characteristics for community-dwelling older adults. Cascade Blitz can remain an optional processing-speed event, but timed pressure is not the cognitive-health backbone.

### Cognitive challenge and raw failure pressure are separate axes

A memory-heavy level does not also need to be move-starved.

When a cognitive mechanic is new or carrying substantial memory load:

- introduce it on relief/normal slots;
- do not debut it on hard or super-hard slots;
- lower geometry/objective pressure when necessary;
- avoid stacking two unfamiliar cognitive mechanics in one level;
- move cognitive difficulty upward only after repeated successful exposure.

### Memory information must be legible

Memory cues use redundant coding:

- color plus symbol/shape;
- large fixed anchors;
- high contrast;
- clear audio where useful;
- no requirement to distinguish subtle shades.

Do not make an older player remember a moving candy through cascades unless tracking that movement is explicitly the mechanic and has already been proven enjoyable.

### Forgetting should usually cost opportunity, not dignity

Memory failure should normally mean:

- the objective did not advance;
- the pair closes again;
- the gate remains locked;
- a clue can be shown again after repeated misses.

Avoid:

- wiping all memory progress;
- sudden level failure;
- hidden penalties;
- mocking feedback;
- losing unrelated rewards.

A player should think “damn, I forgot that one,” not “the game screwed me.”

### Provide useful feedback without pretending to diagnose cognition

Good feedback:

- “Perfect recall!”
- “You found the pair.”
- “Nice memory.”
- personal-best accuracy in optional bonus modes;
- visible progress toward the current game objective.

Do not expose “brain age,” dementia-risk scores, cognitive-health grades, or medical interpretations.

Older-adult cognitive-training research also shows strong interest in performance feedback and the ability to adjust challenge. When memory-specific assistance is implemented, prefer a simple re-show / clue mechanism over a settings maze. Mark assisted attempts separately for cognitive-mechanic analysis.

## Cognitive-dose model

Every normal match-3 level already exercises visual search, planning, inhibition, and spatial reasoning. Explicit memory mechanics therefore do not need to dominate the campaign.

After memory mechanics are introduced:

- target roughly **4–6 cognitive-accent levels per 30-level chapter** (about 13–20%);
- normally place **1–2 cognitive-accent levels per ten-level tension wave**;
- avoid more than two explicit memory-accent levels consecutively;
- first-introduction chapters may temporarily use more frequent, easier exposures;
- after mastery, recur old cognitive mechanics at spaced intervals and mix them with ordinary mechanics.

This is deliberately stronger than the current optional-only cognitive layer but far lighter than a dedicated brain-training application.

Quick Recall remains an optional recurring memory exercise. Blitz remains an optional processing-speed exercise. Neither substitutes for cognitive variety inside the main campaign.

## Core cognitive domains and mechanic mapping

### Visual search / selective attention

Already present throughout ordinary Cascade.

Strengthen with:

- color-conditional elements;
- layered objectives;
- board regions that matter differently;
- producers and target prioritization.

Avoid meaningless visual clutter.

### Spatial planning / reasoning

Already present strongly in:

- drop/exit objectives;
- cages and access constraints;
- producer dependencies;
- future portals/conveyors;
- special-piece positioning.

This is one reason the core match-3 game itself is cognitively useful without looking like training.

### Visuospatial memory — Memory Blooms

Recommended first dedicated core memory family.

Player-facing concept: magical flowers / jeweled blooms occupy fixed cells.

Basic rule:

1. A match beside a closed Bloom opens it and reveals a bold symbol.
2. The revealed symbol has a matching partner hidden in another fixed Bloom.
3. Opening the matching partner collects both.
4. Opening a nonmatching partner gives a short, clear reveal of both symbols, then both close again.
5. Previously seen locations remain the player's information; the game does not secretly move the pairs.
6. Large specials may reveal a Bloom, but only one Bloom interaction advances per cascade step so spectacle cannot bypass the memory task.

Start with two pairs and large distinct symbols. Later use three or four pairs.

Why this is preferred over the old Memory Fog concept:

- fixed spatial anchors survive cascades cleanly;
- the task is genuinely visuospatial;
- forgetting is recoverable;
- it integrates with normal matching rather than pausing for a quiz;
- it resembles mainstream match-3 “matching symbol” vocabulary while giving Cascade a stronger memory identity.

### Associative / prospective memory — Recall Locks

Recall Locks are a memory-bearing variant inside the locks/cages family, not an unrelated system.

Basic rule:

1. A lock briefly reveals a color + symbol condition.
2. The condition hides while the lock remains in a fixed location.
3. The player later opens it by making the remembered matching color beside it or satisfying the remembered cue.
4. On beginner versions the lock can remain immediately actionable.
5. Later prospective-memory versions reveal the cue, remain dormant for several moves, then become actionable.

Wrong-color matches do not reset unrelated progress.

This exercises remembering both **what** is required and **where/when** to act.

### Sequence working memory — Pattern Echo / Magic Melody

Keep this lighter than Memory Blooms and Recall Locks.

A short two-to-four-item color/symbol sequence is shown, then hidden. The player advances it by clearing the required colors in order.

Rules:

- wrong colors do not wipe the sequence;
- first appearances use two items;
- ordinary campaign use rarely exceeds four;
- optional Quick Recall can carry more concentrated sequence-memory practice.

Pattern Echo should enter only after the first two memory mechanics have proven fun in family play.

### Cognitive flexibility — alternating/toggle elements

Later campaign content can make an element switch state after moves or actions.

This is a good executive-function mechanic, but it should not be introduced at the same time as the first memory systems.

### Processing speed

Blitz is the dedicated optional speed mode.

Do not make normal-level rewards depend on fast responses. Older players should be free to inspect the board.

## Engagement architecture

The target is high voluntary return, not monetization pressure.

### Keep the offensive toolkit small

Royal Match's enduring core uses four creatable power-ups while most novelty comes from the board elements they interact with. Cascade should follow the same principle.

Current permanent offensive toolkit:

- Stripe;
- Bomb;
- Color Clearer;
- Butterfly.

Do not add another core special before level 1,000 unless a later design problem clearly requires it.

### Novelty comes from board vocabulary and combinations

Royal Match's observed 300–1,000 progression introduces new obstacles roughly every 50 levels, then slows the cadence later. Cascade targets an older audience, so use a gentler cadence:

- a substantial new family roughly every 75–100 levels in the 600–1,500 range;
- smaller variants/interactions can appear between those introductions;
- each new element must alter decisions, not merely add HP.

### Reward mastery with spectacle

Every important new board element needs:

- a distinctive readable silhouette;
- satisfying damage states;
- strong clear/complete animation;
- a recognizable sound;
- a meaningful final payoff.

Royal Match's obstacle variety works partly because clearing objects feels good, not just because the rules differ.

Memory success deserves the same treatment: paired Blooms burst together, Recall Locks open with a clear magical payoff, and remembered sequences resolve visibly.

### Borrow streak motivation carefully

Royal Match's Butler's Gift and Super Light Ball, and Candy Crush's Candy Necklace, all reward consecutive wins with escalating power and reset that power after failure.

Cascade can borrow the **visible momentum and anticipation**, but should not make authored difficulty depend on a streak booster.

Preferred direction for the family build:

- show a celebratory win-streak / momentum meter;
- make milestone rewards transparent and non-purchasable;
- prefer stars, cosmetic map/garden progress, spectacle, or occasional earned hammer value over stacking several free starting specials;
- if starting-special streak rewards are ever tested, profile levels both with and without them and keep the booster-free curve authoritative;
- avoid harsh “lose everything” framing for older players.

The retention goal is “I want to see what I unlock next,” not “I am afraid to stop or lose.”

### Family meta-progression

A lightweight shared **family garden / magical world restoration** layer is a strong future engagement candidate:

- ordinary stars contribute to personal and shared visible progress;
- weekly family goals can be cooperative rather than only competitive;
- rewards can be cosmetic, celebratory, or modest gameplay inventory;
- no ranking of cognitive scores or “brain performance.”

This preserves the social reinforcement used by major match-3 games while fitting the private family product and avoiding monetization pressure.

### Preserve flow

Candy Crush research supports challenge-skill balance, clear goals, feedback, and sense of control as contributors to flow and desire to continue.

Cascade therefore keeps:

- the ten-level tension wave;
- relief after pressure;
- clear objective HUD;
- strong cause-and-effect presentation;
- non-clairvoyant human-difficulty calibration;
- hard levels that reward decisions rather than waiting for a lucky seed.

Do not tune ordinary levels around assumed streak boosters or free starting specials. Streak rewards, if expanded later, should be bonuses rather than hidden prerequisites for the authored difficulty curve.

### Social/family engagement is useful

WHO's 2026 guidance also recognizes social activity as relevant to cognitive health.

Existing Weekly Blitz and family leaderboards are useful, but future family engagement should include cooperative as well as competitive surfaces, for example a shared weekly star/garden goal.

Avoid turning cognitive performance into a family ranking of who has the “best brain.”

## 601–1,050 campaign plan

The next three 150-level production passes should deliberately alternate mainstream match-3 depth with cognitive novelty.

### 601–750

- 601–650: advanced Drop mastery and combinations;
- 651–700: Locks/Cages introduction and practice;
- 701–750: Locks mixed with old mechanics plus first low-pressure Recall Lock variants.

No second brand-new memory family in this batch.

### 751–900

- 751–800: Memory Blooms introduction and practice;
- 801–850: Enchanted Ground / spread-coverage introduction;
- 851–900: controlled combinations of Blooms, Ground, Locks, Drop, Ice, and established specials.

Memory Blooms debut only on relief/normal beats.

### 901–1,050

- 901–950: Crystal Producers/Generators with visible charge counts and deterministic adjacent-clear activation;
- 951–1,000: visible Color Wards for selective attention, with mature Recall-Lock combinations used sparingly after the Ward rule is familiar;
- 1,001–1,050: mastery/recombination and a small Pattern Echo pilot if Memory Blooms and Recall Locks test well.

Level 1,000 remains a major human-data checkpoint inside this production batch rather than changing the 150-level generation cadence.

## Current difficulty baseline

The accepted 451–600 deep profile does not justify a wholesale raw-difficulty reset.

On the accepted Butterfly-era 20-run human-skilled sample, average win rates by tension label were approximately:

- relief: 86.3%;
- normal: 78.0%;
- hard: 65.7%;
- super-hard: 61.7%.

The accepted 451–600 fragility scan flagged no level at the 50-percentage-point brittle threshold. The largest observed -1/+1 move swing was 33 percentage points.

Earlier clean family telemetry through level 296 recorded an 88.2% hammer-clean first-pass rate overall, with expected separation among relief, normal, hard, and super-hard labels.

Interpretation:

- the pressure curve is serviceable enough to preserve;
- the major design opportunity is richer cognitive and board vocabulary rather than simply making levels harder;
- future tuning should still correct individual outliers and compare simulator output with new family traces;
- memory-heavy levels must not receive extra raw pressure merely because they are cognitively richer.

## Existing 1–600 campaign

Do not rewrite the accepted 1–600 campaign wholesale merely to increase cognitive density.

Reasons:

- it is already profiled, tuned, accepted, and archived;
- family telemetry exists for the earlier range;
- normal match-3 play already exercises visual search, planning, and inhibition;
- Quick Recall offers recur throughout the existing campaign.

Instead:

- treat 1–600 as the established baseline;
- improve Quick Recall usability/adaptation separately when that lane is touched;
- introduce the stronger core cognitive identity from 701 onward;
- use future player data to decide whether a small number of earlier cognitive sentinel levels should ever be backported.

## Quick Recall refinement

Current Quick Recall is conceptually aligned with the cognitive goal but should evolve from a fixed 3/4/5 sequence into a gentler adaptive exercise.

Desired future behavior:

- begin with sequence lengths 2–3 for a new/struggling player;
- increase toward 4–5 after demonstrated success;
- allow a clear replay/clue affordance rather than hard failure;
- preserve optional/non-failing status;
- keep performance feedback playful rather than diagnostic;
- record assisted vs unassisted accuracy separately.

## Simulation and telemetry requirements for hidden-information mechanics

The deterministic engine may know hidden truth. Human-like bots must not.

Memory mechanics require an observation/memory boundary:

- the player policy receives only cues that were actually revealed;
- the simulator records reveal events and move-count delay since each cue;
- human-casual and human-skilled personas maintain imperfect Recall-Lock and Memory-Bloom state rather than reading hidden engine data;
- an actively open Bloom is treated as visible with certainty; retention uncertainty begins after its cue closes;
- lookahead/oracle agents may use hidden truth only as an explicit upper-bound solvability layer;
- replay telemetry must be able to reconstruct what the human had seen before each decision.

Future memory-persona calibration should measure:

- recall accuracy;
- number of items held;
- moves between cue and response;
- hint/re-show usage;
- mismatch/recovery behavior;
- interaction with overall win/fail results.

Memory-assisted attempts remain valid gameplay but should be separated when estimating intrinsic cognitive-mechanic difficulty, analogous to hammer-assisted attempts being excluded from intrinsic board-difficulty estimates.

## Success criteria

Cascade is moving toward the intended product when:

- parents voluntarily keep playing because the game itself is fun;
- new mechanics remain immediately legible;
- cognitive mechanics feel like magic-game rules rather than tests;
- memory challenge is noticeable but not humiliating;
- difficulty labels continue to reflect actual player experience;
- repeated memory/attention mechanics become familiar tools rather than one-off gimmicks;
- family telemetry shows continued participation rather than avoidance of cognitive-accent levels;
- ordinary levels remain beatable without assumed boosters;
- player feedback and behavior, not theoretical cognitive value alone, determine whether a cognitive mechanic survives.


## Living research references

Future research work should extend these two retained evidence files before repeating broad searches:

- `planning/research/cascade-cognitive-health-research.md` — older-adult cognition, training, usability, and evidence boundaries;
- `planning/research/cascade-match3-engagement-research.md` — Candy Crush / Royal Match engagement, mechanic, and content-architecture research.

## Research references

Health/cognition sources:

- World Health Organization. *Risk reduction of cognitive decline and dementia: WHO guidelines, second edition* (2026). https://www.who.int/publications/i/item/9789240123557
- Bonnechère B, et al. *Game-based brain training for improving cognitive function in community-dwelling older adults: A systematic review and meta-regression.* PMID 32980574.
- Rebok GW, et al. *Ten-year effects of the ACTIVE cognitive training trial on cognition and everyday functioning in older adults.* PMID 24417410.
- Tse ZCK, et al. *Prospective Memory Training in Older Adults: A Systematic Review and Meta-Analysis.* PMID 35543836.
- *Evaluating the User Experience and Usability of Game-Based Cognitive Assessments for Older People: Systematic Review.* PMCID PMC12198696.

Engagement/match-3 sources:

- Larche CJ, Dixon MJ. *The relationship between the skill-challenge balance, game expertise, flow and the urge to keep playing complex mobile games.* PMID 33027060.
- Royal Match Help Center. *Creating and Using the Power-Ups.* https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/6-creating-and-using-the-power-ups/
- Mobile Game Scope. *Introducing New Obstacle In Royal Match.* Industry deconstruction used only as observational evidence for obstacle-introduction cadence, not as an authoritative Royal Match design specification. https://www.mobilegamescope.com/deconstructions/introducing-new-obstacle-in-royal-match

These references inform design direction; family telemetry and direct player feedback remain the authority for whether a mechanic belongs in Cascade.
