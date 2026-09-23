# Cascade Crush Testing Methodology

Status: active calibration framework  
Scope: Cascade Crush level solvability, human-like simulation, and family-playtest interpretation

## Purpose

Cascade needs two different kinds of automated evidence:

1. **Engine/solvability proof** — a strong agent should be able to finish every shipped level across sampled seeds without engine errors.
2. **Human-difficulty estimation** — a separate, non-clairvoyant policy should estimate how demanding a level is for a real player without knowing future refills, Butterfly destinations, or cascades.

Those jobs must not be collapsed into one bot.

## Current baseline

The 450-level Butterfly build established the reference baseline before adding human-like personas:

- all 450 shipped levels execute successfully;
- the lookahead strategy records at least one sampled win on every level;
- no relief or ordinary-level cliff violates the current solver safety gate;
- random Butterfly targeting restored more planning separation than the earlier deterministic best-target implementation.

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

## Long-term difficulty calibration

Cascade is designed around a **10,000-level campaign horizon**, with **3,000 levels as the immediate production milestone** rather than the start of endgame difficulty.

Two numbers must be kept separate:

1. **Player-facing first-pass goals** describe the intended family experience.
2. **Human-skilled simulator rates** are an uncalibrated proxy used for relative comparisons, outliers, and regression detection.

Do **not** quote a human-skilled bot percentage as if it were the expected pass rate of a real family player. Historical family traces have materially outperformed the current human-skilled proxy on overlapping level ranges, so the mapping is not 1:1.

### Player-facing design envelope

The product goal is a slow ramp that preserves momentum. The percentages below are internal authoring goals informed by family telemetry and the product objective; they are **not** percentages published by King or cognitive-science research.

| Level anchor | Relief | Normal | Hard | Super-hard | Approx. wave-average midpoint |
|---|---:|---:|---:|---:|---:|
| 1,000 | 98–100% | 94–97% | 86–92% | 72–84% | ~94% |
| 1,500 | 98–100% | 93–97% | 84–91% | 70–82% | ~93% |
| 2,000 | 97–100% | 92–96% | 82–90% | 68–80% | ~92% |
| 3,000 | 97–100% | 90–95% | 80–88% | 65–78% | ~91% |
| 5,000 | 95–99% | 88–94% | 76–86% | 60–75% | ~89% |
| 7,500 | 94–99% | 86–93% | 73–84% | 56–72% | ~87% |
| 10,000+ | 93–98% | 85–92% | 70–82% | 52–70% | ~86% |

These are rolling experience targets, not promises for every individual player. The ten-level tension wave remains essential: a hard/super-hard miss is acceptable because relief and ordinary levels restore momentum.

### Human-skilled simulator proxy envelope

Until move-choice replay calibrates the persona, the simulator should decline **more slowly** than the previous 82% -> 74% by level 3,000 doctrine.

| Level anchor | Relief | Normal | Hard | Super-hard | Approx. wave-average midpoint |
|---|---:|---:|---:|---:|---:|
| 301 | 90–98% | 82–94% | 70–84% | 55–72% | ~86% |
| 1,000 | 88–96% | 78–90% | 64–78% | 50–68% | ~82% |
| 1,500 | 88–96% | 78–90% | 64–78% | 50–68% | ~82% |
| 2,000 | 87–95% | 77–89% | 63–77% | 49–67% | ~81% |
| 3,000 | 86–95% | 76–88% | 62–76% | 48–66% | ~80% |
| 5,000 | 85–94% | 74–87% | 60–75% | 46–64% | ~79% |
| 7,500 | 84–93% | 72–86% | 58–73% | 44–62% | ~77% |
| 10,000+ | 83–92% | 71–85% | 57–72% | 43–61% | ~76% |

The simulator bands remain advisory until calibration. Their main job is to identify **relative drift**.

### Continuity guard

For post-1,000 production:

- a new 30-level chapter should normally stay within about **5 percentage points** of the preceding established chapter's human-skilled proxy average unless an explicit challenge arc is intended;
- a foundational-mechanic introduction should not create a sustained downward staircase across its teach/practice/mix/mastery chapters;
- relief and ordinary waves must recover after hard/super-hard beats;
- if lookahead remains near-perfect but human-skilled collapses across a chapter, tune objective/score pressure before assuming the new mechanic itself is bad;
- score targets are a secondary tuning control and must not silently become the dominant source of late-level failure.

King's published level-design material supports deliberate difficulty variation and bot-assisted outlier detection, not a universal first-pass percentage. Human telemetry remains the final calibration evidence.


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

## Historical evidence archive

The canonical long-term store for Cascade testing history is the private `QuankAIWS/rpg-gm-runtime` repository at `archive/cascade-testing/`. GameFrame remains the owner of the levels, simulator, telemetry contracts, calibration policy, and interpretation of the evidence; the private repository is only the storage boundary.

GitHub Actions artifacts are temporary execution evidence. Meaningful baselines used to tune levels, calibrate personas, establish regressions, or interpret family play must be copied into the private canonical archive before transient artifacts expire.

The public `data/cascade/difficulty-archive/` directory is a **public-safe compact mirror**, not a second canonical archive. It exists so GameFrame can run archive integrity checks, compare accepted bot baselines locally, and retain anonymous aggregate player evidence without exposing private telemetry.

For each accepted bounded level batch:

1. retain the exact tested GameFrame head SHA plus workflow run/job provenance;
2. retain the accepted compact profile and fragility evidence in the private canonical archive;
3. when safe, mirror compact bot/fragility snapshots into `data/cascade/difficulty-archive/` for CI/local comparison;
4. preserve sampling information and level range;
5. never replace older history;
6. keep candidate evidence labeled `candidate` until the corresponding code is accepted.

At larger campaign sizes, normal validation should profile the **new/changed range** and representative sentinel levels from older mechanic families. Full historical sweeps are reserved for major checkpoints, consequential rule changes, or sentinel drift suggesting broad regression.

### Scaled CI policy

Cascade validation is deliberately tiered so campaign growth does not turn every pull request into an exhaustive simulation:

1. **Fast contracts and UI:** engine/persistent-special contracts, browser journeys, persistence coverage, and visual review run only when their own implementation surfaces change.
2. **Campaign canary:** balance-semantic changes run a deterministic evenly spaced campaign sample rather than every shipped level. This is the broad historical smoke test for solver/simulator regressions.
3. **Changed-range deep profile:** when generated level definitions actually change, CI compares base and head `CASCADE_LEVELS`, finds the changed level numbers, and profiles that range with a 30-level seam on each side. The same range receives the human-skilled move-fragility scan.
4. **Broad rebalance exception:** if a real rebalance changes a wide historical range, the changed-range gate is allowed to become correspondingly expensive. That cost is justified because the balance itself changed.
5. **Nightly exhaustive regression:** `.github/workflows/cascade-nightly.yml` runs at 06:00 UTC and can also be dispatched manually. Scheduled execution skips when no balance-relevant Cascade work landed in the preceding 30 hours. When it runs, the full campaign is split into eight contiguous GitHub-hosted shards so wall-clock time stays bounded as the campaign grows.
6. **Telemetry calibration:** persona calibration against real player data remains an explicit milestone/weekly/on-demand activity. Do not retrain or retune human-like personas from every small family-play sample.

Pull-request canary and changed-range artifacts are diagnostic evidence. Nightly shard artifacts retain only short-term execution evidence. Accepted milestone baselines, meaningful regressions, and calibration checkpoints are the items promoted into the canonical private archive; routine nightlies are not permanent history.

Fast engine/unit contracts must follow the same scaling principle. They should exercise representative mechanic/chapter sentinels rather than independently simulating every shipped level when the dedicated full-campaign profile job already provides that coverage. Avoid duplicating the complete campaign sweep inside both the contract step and the profile step; this keeps validation runtime bounded as Cascade grows toward 1,000+ levels.

The production expansion cadence is defined by `planning/cascade-10000-campaign-roadmap.md`; the current default is **150 levels per generation/tuning pass**. A 30-level chapter or map window is an internal content/UI structure and must not be interpreted as the validation or generation batch size.

Raw player telemetry, display names, stable player IDs, session/attempt/event IDs, device metadata, diagnostics exports, and raw event streams never belong in the public GameFrame mirror. Public player evidence is limited to sanitized anonymous aggregates with source filename/hash provenance. Raw source files remain private.

If an old result must be reconstructed from an immutable historical GameFrame commit because the original bytes are gone, label it as reconstructed rather than presenting it as the original run.

Archive-only public-mirror edits route through the lightweight archive-validation lane and do not justify an expensive campaign simulation by themselves.

Public-mirror integrity is checked with:

```bash
npm run cascade:archive:check
```

A generated JSON profile can be compacted with:

```bash
npm run cascade:archive -- --profile=profile.json --out=archive.json --status=accepted --label=<batch-label> --run-id=<run> --job-id=<job> --head-sha=<sha>
```

## CI policy

The shipping gate remains conservative:

- engine contracts pass;
- every shipped level executes;
- lookahead records at least one sampled win per level;
- no unintended relief/normal solver cliff is introduced;
- human-persona results are recorded but remain advisory until calibrated.

After sufficient replayable human data exists, human-persona envelopes can become authoring warnings first. They should become hard CI gates only after the model has demonstrated useful agreement with real players.

## Hidden-information and cognitive-mechanic simulation

Memory mechanics introduce a hard observation boundary.

The authoritative engine may know every hidden symbol or condition. Human-like policies may not.

Requirements:

- human-casual and human-skilled receive only cues that have actually been revealed to the player;
- the simulator records reveal events, currently remembered cues, and move delay since reveal;
- human personas use an explicit imperfect-memory state rather than reading hidden board truth;
- greedy/lookahead may access hidden truth only when clearly labeled as oracle/upper-bound solvability evidence;
- replay telemetry must reconstruct what was visible before each human decision;
- clue/re-show usage is recorded explicitly.

Cognitive-mechanic analysis should track:

- recall/pair accuracy;
- mismatch and recovery;
- cue-to-response delay;
- number of concurrent remembered items;
- hint/re-show usage;
- abandonment/retry behavior;
- interaction with normal level success.

A memory-assisted attempt remains valid gameplay, but assisted and unassisted outcomes must be separated when estimating the intrinsic cognitive demand of a memory mechanic.

For Memory Blooms specifically, human-like policies may know which board cells contain closed Blooms because those flowers are visible, but they may not inspect a closed Bloom's hidden symbol. They may use symbols only after reveal and according to the persona's retained-memory state. An actively open Bloom is visible information, not a memory guess. Greedy/lookahead may access hidden pair truth only as explicitly labeled oracle evidence.

Cognitive-persona metrics remain advisory until calibrated against actual family traces. They must not become hard CI gates merely because the engine can model hidden information.

## Data interpretation boundary

Automated difficulty is one input, not the final product decision.

A level can be mathematically solvable and still feel bad. A level can also be easy for the lookahead agent and remain appropriately difficult for humans because the agent knows deterministic future outcomes that humans cannot see.

Human traces, level geometry, objective composition, and direct family feedback remain the final calibration evidence.
