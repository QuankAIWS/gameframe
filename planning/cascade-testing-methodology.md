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

Cascade is designed around a **10,000-level campaign horizon**, with **3,000 levels as the immediate production milestone** rather than the start of endgame difficulty.

The campaign keeps two separate forms of progression:

- **complexity growth** can continue for thousands of levels as mechanics and interactions accumulate;
- **raw first-pass difficulty** rises slowly, oscillates inside the ten-level tension wave, and eventually plateaus instead of increasing forever.

The human-skilled target bands are piecewise anchors, not a single linear ramp:

| Level anchor | Relief | Normal | Hard | Super-hard | Approx. wave-average midpoint |
|---|---:|---:|---:|---:|---:|
| 301 | 90–98% | 82–94% | 70–84% | 55–72% | ~86% |
| 1,000 | 88–96% | 78–90% | 64–78% | 50–68% | ~82% |
| 2,000 | 85–94% | 73–87% | 59–74% | 45–63% | ~78% |
| 3,000 | 82–92% | 68–83% | 54–70% | 40–58% | ~74% |
| 5,000 | 78–90% | 60–78% | 46–64% | 33–52% | ~68% |
| 7,500 | 74–87% | 53–72% | 39–58% | 27–46% | ~62% |
| 10,000+ | 70–84% | 48–68% | 34–54% | 23–42% | ~58% |

Targets interpolate between anchors. Beyond level 10,000, the mature bands plateau until player data justifies another change.

Levels 301–450 therefore remain **early-campaign content**. They should not be tuned toward the mature 5,000–10,000 difficulty envelope merely because 450 is the current shipping ceiling.

These bands remain **advisory** and must not fail CI until the human personas are calibrated against replayable family traces.

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

### Outcome calibration available now

Before exact move replay is available, the current schema can still calibrate persona **outcomes** against hammer-clean first-pass results on the exact levels people actually played.

```bash
npm run cascade:profile -- --runs=40 --human-runs=20 --json=profile.json
npm run cascade:persona:calibrate -- playtest.json profile.json --exclude-booster-player=<display-name>
```

The calibration report weights the human-skilled simulation by the same level exposures present in the clean human sample and reports observed-versus-predicted first-pass rates by difficulty, chapter, and sufficiently observed individual levels. This is weaker than move-choice replay but better than tuning persona weights by intuition alone.

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

Implemented as a manual report-comparison tool.

Generate baseline and candidate JSON with identical seed/run settings, then compare them:

```bash
npm run cascade:profile -- --runs=40 --human-runs=20 --json=baseline.json
npm run cascade:profile -- --runs=40 --human-runs=20 --json=candidate.json
npm run cascade:profile:compare -- baseline.json candidate.json
```

The comparator refuses mismatched seed bases or run counts and reports materially changed levels by persona/solver win rate. This distinguishes a real difficulty change from ordinary sampling noise.

### Phase 5 — fragility analysis

Implemented initially as a paired ±1-move scan:

```bash
npm run cascade:fragility -- --from=301 --to=450 --runs=12 --strategy=human-skilled
```

The same seeds are run with one fewer move, the authored move count, and one extra move. A 50-point or larger win-rate swing across that two-move window is flagged as brittle.

Future extensions can add small objective-count perturbations once the human-persona calibration is trustworthy.

## CI policy

The shipping gate remains conservative:

- engine contracts pass;
- every shipped level executes;
- lookahead records at least one sampled win per level;
- no unintended relief/normal solver cliff is introduced;
- human-persona results are recorded but remain advisory until calibrated.

After sufficient replayable human data exists, human-persona envelopes can become authoring warnings first. They should become hard CI gates only after the model has demonstrated useful agreement with real players.

## Historical evidence archive

The canonical long-term store for Cascade testing history is the private `QuankAIWS/rpg-gm-runtime` repository at `archive/cascade-testing/`. This is a storage boundary only: GameFrame continues to own the Cascade levels, simulator, telemetry contracts, calibration policy, and interpretation of the evidence.

GitHub Actions artifacts are temporary execution evidence and must not be treated as durable history. Preserve a meaningful baseline when it is used to tune levels, calibrate a persona, establish a regression reference, or interpret family play by copying the relevant evidence into the private archive before the Actions artifact expires.

Each retained bot/calibration snapshot should record, when available:

- the exact GameFrame commit and related PR;
- workflow run/job and original artifact identifiers;
- simulator rules/version and level range;
- seed base and solver/human-persona run counts;
- exact machine-readable profile, fragility report, or surviving workflow-log profile block;
- whether the evidence is an original artifact, exact log recovery, deterministic reconstruction, or narrative historical record.

Do not overwrite an older snapshot when levels, rules, Fish behavior, persona weights, or simulator logic change. Add a new dated phase so later work can compare against the historical campaign state that actually produced the result.

Human playtest exports containing player IDs, session IDs, or raw event streams stay private. Public GameFrame may contain aggregate/anonymized conclusions and the analysis tooling, but not the raw player export. If an old artifact must be reconstructed from an immutable historical GameFrame commit because the original bytes are gone, label it as reconstructed rather than presenting it as the original run.

## Data interpretation boundary

Automated difficulty is one input, not the final product decision.

A level can be mathematically solvable and still feel bad. A level can also be easy for the lookahead agent and remain appropriately difficult for humans because the agent knows deterministic future outcomes that humans cannot see.

Human traces, level geometry, objective composition, and direct family feedback remain the final calibration evidence.
