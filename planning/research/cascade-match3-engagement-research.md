# Cascade Research — Match-3 Engagement and Content Architecture

Status: living research / competitive-design reference  
Last reviewed: 2026-08-30  
Use with:
- `planning/cascade-cognitive-health-and-engagement.md`
- `planning/cascade-10000-campaign-roadmap.md`
- `planning/casual-games-match3-foundation.md`

## Purpose

Retain external match-3 design evidence and observations so future agents can extend the competitive research rather than re-deriving basic Candy Crush / Royal Match lessons every time.

Cascade is a private family game with no monetization requirement. Borrow engagement principles that increase voluntary enjoyment and return play; do not copy manipulative purchase pressure.

## Candy Crush: challenge, flow, and urge to continue

Larche & Dixon tested experienced Candy Crush players on levels near their standing, levels that were too easy, and levels that were too hard.

Key findings:

- perceived skill/challenge balance was strongest near the player's normal level;
- easy levels produced the least flow;
- regular and hard levels produced comparable flow;
- too-hard play produced substantially more frustration;
- flow and arousal together predicted stronger urge to continue.

Source:
- Larche CJ, Dixon MJ. *The relationship between the skill-challenge balance, game expertise, flow and the urge to keep playing complex mobile games.* Comput Human Behav. PMID 33027060 / PMCID PMC8943660. https://pmc.ncbi.nlm.nih.gov/articles/PMC8943660/

Cascade implications:

- do not tune for permanent one-and-done ease;
- do not equate engagement with punishment;
- preserve the ten-level relief/normal/hard/super-hard wave;
- target "almost had it / one more try" rather than seed-dependent frustration;
- complexity can raise challenge without constantly cutting moves.

## Royal Match: small offensive toolkit, broad board vocabulary

Royal Match's official help material centers a small set of creatable power-ups:

- Rocket;
- TNT;
- Propeller;
- Light Ball.

Cascade's current permanent toolkit deliberately parallels this structural simplicity:

- Stripe;
- Bomb;
- Butterfly;
- Color Clearer.

Source:
- Royal Match Help Center, *Creating and Using the Power-Ups*: https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/6-creating-and-using-the-power-ups/

Design implication:

- resist adding another permanent core special merely for novelty;
- expand the board/objective vocabulary instead;
- let old specials gain new value as new board elements appear.

## Royal Match board-element patterns worth learning from

These are mechanic patterns, not art/name templates.

### Adjacent multi-hit blocker

Royal Match Box is removed through neighboring matches, with layered variants requiring multiple interactions.

Source:
- https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/351-box/

Cascade lesson:
- Locks/Cages can use adjacency while remaining mechanically distinct because the underlying candy is constrained and gravity compacts around it.

### Color-conditional adjacency

Royal Match Color Box requires neighboring matches of its corresponding color. Multi-layer variants require repeated correct-color interactions.

Source:
- https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/363-color-box/

Royal Match Dynamite Box similarly keys activation to matching its required color.

Source:
- https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/371-dynamite-box/

Cascade lesson:
- color-conditional elements create selective-attention decisions without another core special;
- Recall Locks can add a memory layer to a mainstream-readable color-condition pattern.

### Producer / dependency chain

Royal Match Cauldron first creates Pumpkins after repeated adjacent interaction; the created Pumpkins then require their own clearing interactions.

Source:
- https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/383-cauldron/

Cascade lesson:
- Producers should create multi-step dependency chains rather than merely act as another blocker;
- producer + cage + Drop can multiply decision space from existing systems.

### Symbol matching

Royal Match Matching Symbol opens after nearby matches, reveals a symbol, and has a corresponding matching symbol elsewhere on the board.

Source:
- https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/577-matching-symbol/

Cascade lesson:
- symbol-pair concepts are compatible with mainstream match-3;
- Memory Blooms should differentiate themselves by making fixed-location recall an intentional cognitive mechanic, with forgiving mismatch recovery and older-player readability.

## Novelty cadence

Industry deconstruction of Royal Match has observed a high obstacle-introduction cadence through its early/mid campaign, approximately one new obstacle every ~50 levels in part of the 300–1,000 range.

This is observational industry analysis, not an official Royal Match design specification.

Source:
- Mobile Game Scope, *Introducing New Obstacle In Royal Match*: https://www.mobilegamescope.com/deconstructions/introducing-new-obstacle-in-royal-match

Cascade policy:

- use a gentler substantial-family cadence around 75–100 levels during the 600–1,500 growth phase;
- smaller combinations/variants fill the gaps;
- older players should get time to master vocabulary before another rule arrives;
- 150-level production batches may contain multiple internal teaching arcs.

## Meta progression and reward

Royal Match's core loop ties level completion to stars used for castle-area renovation.

Official gameplay overview:
- https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/3-how-do-i-play-royal-match/

Cascade inference:

- a future Family Garden / magical-world restoration layer could turn earned stars into visible shared progress;
- family cooperation can supplement leaderboards;
- no paid currency is necessary for this reinforcement.

## Streak systems: borrow momentum, not dependency

Major match-3 games use escalating win-streak rewards to create continuation pressure. Cascade should borrow the visibility and celebration of momentum without balancing authored levels around streak boosters.

Policy:

- booster-free difficulty remains authoritative;
- a failed level should not erase a large pile of invisible competitive advantage;
- prefer transparent milestones, stars, cosmetics/world restoration, spectacle, or modest earned inventory;
- if starting-special streak rewards are ever tested, profile levels both with and without them.

## Engagement principles retained for Cascade

1. Appropriate challenge beats permanent ease.
2. Relief beats are necessary because pressure without breathing becomes fatigue.
3. Strong cause/effect presentation makes clearing satisfying.
4. Novel board vocabulary extends a small offensive toolkit.
5. New mechanics should alter decisions, not just increase hit points.
6. Recombination provides more longevity than endless one-off gimmicks.
7. Player mastery should visibly pay off with spectacle.
8. Streaks/progression should invite continuation without monetization fear.
9. Family/social progress can create a reason to return beyond raw level number.
10. Human telemetry outranks competitive-game imitation.

## Competitive-research hygiene

When extending this file:

- prefer official game help pages for current mechanic behavior;
- use wiki/community/industry deconstructions only for introduction chronology, sentiment, or patterns not documented officially;
- label observational/third-party evidence explicitly;
- verify modern games before assuming old introduction orders are still current;
- separate "this game does X" from "Cascade should do X."

The goal is not to clone Candy Crush or Royal Match. The goal is to understand why their core loops remain legible and replayable, then build a better fit for Cascade's older family audience.
