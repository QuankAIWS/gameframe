# Cascade Crush Testing Methodology

Status: active calibration framework  
Scope: Cascade Crush level solvability, human-like simulation, and family-playtest interpretation

## Purpose

Cascade needs two different kinds of automated evidence:

1. **Engine/solvability proof** — a strong agent should be able to finish every shipped level across sampled seeds without engine errors.
2. **Human-difficulty estimation** — a separate, non-clairvoyant policy should estimate how demanding a level is for a real player without knowing future refills, Fish destinations, or cascades.

Those jobs must not be collapsed into one bot.

## Current baseline

The 450-level Fish build established the reference baseline before adding human-like personas:

- all 450 shipped levels execute successfully;
- the lookahead strategy records at least one sampled win on every level;
- no relief or ordinary-level cliff violates the current solver safety gate;
- random Fish targeting restored more planning separation than the earlier deterministic best-target implementation.

The lookahead and greedy agents are still intentionally stronger than a human because they evaluate candidate moves by cloning the seeded game RNG and resolving the resulting future state. They are therefore upper-bound/search agents, not human proxies.

## Automated strategy layers

### Random

Purpose: mechanical floor, luck sensitivity, and trivial-level detection.

Random chooses uniformly among legal moves.

### Human casual

Purpose: low-planning visible-board reference.

This persona:

- scores only information visible before the move;
- favors obvious matches, objective contact, and specials;
- uses probabilistic move choice;
- has a larger lapse/random-choice rate;
- never resolves a candidate move to inspect its future refill or cascade before choosing.

### Human skilled

Purpose: family-skilled / experienced-match-3 reference.

This persona:

- uses the same visible-only feature set as the casual persona;
- weights objective progress and special combinations more strongly;
- chooses more sharply among high-value visible moves;
- has a lower lapse/random-choice rate;
- still cannot see future RNG outcomes.

These persona weights are **heuristics until calibrated against replayable telemetry**. Their current output is advisory, not a shipping gate.

### Greedy

Purpose: tactical upper-bound reference.

Greedy resolves every candidate move against a cloned RNG state and takes the best immediate result. It is clairvoyant relative to a human.

### Lookahead

Purpose: solvability and planning upper bound.

Lookahead resolves candidate moves, retains the strongest immediate candidates, and evaluates a second move. It is deliberately unsuitable as a human-difficulty estimate.

## Long-term first-pass difficulty target

The first 300 levels may remain comparatively forgiving. They function as the long onboarding and retention runway for the current family build.

Starting after level 300, the authoring target begins a gradual ramp toward a mature deep-campaign difficulty envelope by approximately level 900.

The mature human-skilled first-pass target bands are:

| Beat | Mature target |
|---|---:|
| Relief | 68–82% |
| Normal | 48–62% |
| Hard | 34–50% |
| Super-hard | 25–42% |

Because the campaign repeats two relief beats, several normal beats, one hard beat, and one super-hard beat in each ten-level wave, the mature wave average lands in roughly the mid-50% range rather than forcing every individual level to 50%.

Levels 301–899 interpolate toward these bands. The bands are currently **advisory** and must not fail CI until the human personas are calibrated against replayable family traces.

## Family-playtest data policy

Historical telemetry is useful, but it contains known test contamination and schema limitations.

### Booster handling

Hammer-assisted attempts are excluded from intrinsic level-difficulty estimates.

If a player account was used to test broken or unusually generous hammer behavior, that account's hammer-usage rate must also be excluded from booster-behavior calibration. The playtest analyzer supports this explicitly:

```bash
npm run cascade:playtest -- playtest.json --exclude-booster-player=<display-name>
```

Non-hammer attempts from that player remain valid gameplay evidence.

### Invalid swaps

Invalid swaps are not treated as a skill signal. Family testing includes deliberate drag/swap exploration, so invalid-swap counts must not be interpreted as poor input ability or poor match-3 skill.

### Device class

Desktop and mobile use the same authored level difficulty.

Mobile telemetry may be segmented to diagnose viewport, readability, touch-target, or interaction-quality problems, but the level recipe is not made easier because the player is on a phone.

## Playtest metrics

The clean analyzer reports:

- resolved normal attempts;
- raw win rate;
- hammer-free win rate;
- hammer-clean first-pass rate;
- attempts per success through the first clean win;
- current difficulty-label aggregates;
- current chapter aggregates;
- booster contamination/exclusion status.

For intrinsic difficulty, hammer-assisted attempts are excluded automatically.

## Calibration sequence

### Phase 1 — visible-only personas

Implemented first.

Requirements:

- human personas cannot consume or inspect board RNG while choosing a move;
- move scoring is interpretable;
- persona choice remains probabilistic;
- CI continues to retain random, greedy, and lookahead reference agents.

### Phase 2 — telemetry replay

Requires the richer telemetry contract to provide a stable attempt/run identity plus the starting board/RNG state and complete move sequence.

For every recorded human decision:

1. restore the exact pre-move board;
2. enumerate all legal moves;
3. score each move with the visible-only policy;
4. record whether the human choice ranked top-1, top-3, or top-5;
5. fit persona weights and choice temperature against the observed decisions.

The first calibration should use a simple interpretable ranking/choice model rather than deep learning. The family sample is small enough that transparent parameters are preferable.

### Phase 3 — player-strength separation

Once enough replayable decisions exist, fit at least two skill profiles instead of one universal human:

- casual/low-planning;
- skilled/experienced match-3.

Player identity is calibration metadata, not a permanent hardcoded persona in the public repository.

### Phase 4 — paired-seed regression

For meaningful level or mechanic changes, profile the old and new rules against the exact same seed set and report:

- changed win rate by persona;
- changed moves remaining;
- changed objective-failure rate;
- levels with unusually large deltas.

This distinguishes a real difficulty change from ordinary sampling noise.

### Phase 5 — fragility analysis

Deep profiling should perturb candidate levels by small authoring changes:

- one move fewer / one move more;
- slightly heavier / lighter objective pressure;
- repeated seed families.

A level whose estimated human win rate collapses under a one-move perturbation is brittle even if its nominal pass rate looks acceptable.

## CI policy

The shipping gate remains conservative:

- engine contracts pass;
- every shipped level executes;
- lookahead records at least one sampled win per level;
- no unintended relief/normal solver cliff is introduced;
- human-persona results are recorded but remain advisory until calibrated.

After sufficient replayable human data exists, human-persona envelopes can become authoring warnings first. They should become hard CI gates only after the model has demonstrated useful agreement with real players.

## Data interpretation boundary

Automated difficulty is one input, not the final product decision.

A level can be mathematically solvable and still feel bad. A level can also be easy for the lookahead agent and remain appropriately difficult for humans because the agent knows deterministic future outcomes that humans cannot see.

Human traces, level geometry, objective composition, and direct family feedback remain the final calibration evidence.
