# Cascade Research — Cognitive Health, Aging, and Game Design

Status: living research reference  
Last reviewed: 2026-08-30  
Use with:
- `planning/cascade-cognitive-health-and-engagement.md`
- `planning/cascade-10000-campaign-roadmap.md`
- `planning/cascade-testing-methodology.md`

## Purpose

This file retains the evidence base behind Cascade's older-player cognitive design so future work can extend the research rather than repeatedly starting from zero.

Cascade is a family match-3 game, not a medical product. Research findings guide design choices but do not justify claims that Cascade prevents dementia, diagnoses impairment, or produces generalized cognitive improvement.

## Current evidence synthesis

### WHO 2026 risk-reduction guidance

The World Health Organization's second-edition dementia risk-reduction guideline was published 2026-07-15. It treats dementia risk reduction as multidomain and includes cognitive and social factors alongside physical activity, tobacco/alcohol exposure, cardiovascular/metabolic conditions, hearing and other risk factors.

Design implication:

- cognitive game play can be a useful supplementary activity;
- never position it as a substitute for broader healthy-aging behavior or clinical care;
- family/social play is valuable in its own right and is compatible with the product.

Source:
- WHO, *Risk reduction of cognitive decline and dementia: WHO guidelines, second edition* (2026): https://www.who.int/publications/i/item/9789240123557
- WHO news release (2026-07-15): https://www.who.int/news/item/15-07-2026-new-who-guidelines--up-to-45--of-dementia-risk-could-be-prevented-or-delayed

### Game-based brain training meta-analysis

Wang et al. synthesized 15 randomized trials involving 759 community-dwelling older adults.

Reported pooled effects versus control:

- processing speed: Hedges' g = 0.23;
- selective attention: g = 0.40;
- short-term memory: g = 0.35.

Subgroup analysis identified non-time-pressure games among favorable design characteristics; multiplayer, provider support, sessions no more than three times weekly, and sessions no longer than about 60 minutes also appeared favorable.

Interpretation boundary:

- these are modest/domain-specific effects;
- this does not establish far transfer to broad everyday cognition for Cascade;
- repeated voluntary use and appropriate challenge remain practical prerequisites.

Source:
- Wang G, Zhao M, Yang F, Cheng LJ, Lau Y. *Game-based brain training for improving cognitive function in community-dwelling older adults: A systematic review and meta-regression.* Arch Gerontol Geriatr. 2021;92:104260. PMID 32980574. https://pubmed.ncbi.nlm.nih.gov/32980574/

Cascade implications:

- keep ordinary campaign play untimed;
- exercise several domains rather than only sequence recall;
- make cognitive accents recurring rather than one-off tests;
- preserve player control and allow thinking time.

### ACTIVE 10-year randomized trial

The ACTIVE study enrolled 2,832 independent older adults (mean baseline age 73.6) in memory, reasoning, speed-of-processing, or control groups.

At 10 years:

- reasoning training retained a targeted reasoning effect;
- speed-of-processing training retained a larger targeted speed effect;
- the targeted memory-performance effect was no longer maintained;
- trained groups reported less difficulty with instrumental activities of daily living.

Interpretation:

- targeted cognitive abilities can respond differently;
- a broad cognitive "diet" is more defensible than building the game around memory alone;
- long-term memory benefit should not be assumed from immediate recall improvement.

Source:
- Rebok GW et al. *Ten-year effects of the Advanced Cognitive Training for Independent and Vital Elderly cognitive training trial on cognition and everyday functioning in older adults.* J Am Geriatr Soc. 2014;62(1):16-24. PMID 24417410. https://pubmed.ncbi.nlm.nih.gov/24417410/

Cascade implications:

- ordinary match-3 already supplies reasoning, planning, visual search, and inhibition;
- dedicated memory mechanics should augment rather than replace those demands;
- Blitz can remain an optional speed mode without turning normal levels into timed play.

### Prospective-memory training

Tse et al. reviewed prospective-memory training in older adults.

Among 29 RCTs used in meta-analysis:

- immediate training efficacy was moderate (Hedges' g = 0.54);
- long-term efficacy was smaller and not statistically significant (g = 0.20).

Prospective memory means remembering to execute an intention later.

Source:
- Tse ZCK et al. *Prospective Memory Training in Older Adults: A Systematic Review and Meta-Analysis.* Neuropsychol Rev. 2023;33(2):347-372. PMID 35543836. https://pubmed.ncbi.nlm.nih.gov/35543836/

Cascade implication:

- Recall Locks are useful because they can evolve from immediate associative recall into a delayed "remember what this fixed lock needs when it becomes actionable" task;
- do not overclaim durable transfer.

### Older-player usability and challenge

A recent systematic review of game-based cognitive assessments for older adults found generally positive usability but lower usability tendencies among some older/cognitively impaired groups. Appropriate challenge was repeatedly important for enjoyment.

The review emphasizes:

- clearly define the intended user;
- match game design to older users' needs;
- difficulty balancing/personalization can improve experience;
- overly complex game tasks can reduce usability for older or more impaired users.

Source:
- *Evaluating the User Experience and Usability of Game-Based Cognitive Assessments for Older People: Systematic Review.* PMCID PMC12198696. https://pmc.ncbi.nlm.nih.gov/articles/PMC12198696/

Cascade implications:

- redundant cues: color + symbol, not subtle color alone;
- fixed anchors for first memory systems;
- large touch/readability targets;
- no punishment-heavy memory failure;
- debut unfamiliar cognitive mechanics on relief/normal beats;
- separate cognitive load from raw move pressure.

## Cognitive-domain map for Cascade

| Domain | Existing or planned Cascade activity |
|---|---|
| Visual search / selective attention | finding matches, objectives, specials, color-conditional elements |
| Spatial reasoning | Drop routing, cages, geometry, future portals/conveyors |
| Planning | special creation/positioning, competing objectives |
| Inhibition | declining an obvious low-value match, preserving specials |
| Cognitive flexibility | changing objective priority, future toggle/state systems |
| Visuospatial memory | Memory Blooms |
| Associative memory | Recall Locks |
| Prospective memory | delayed Recall Lock conditions |
| Sequence working memory | Quick Recall; later Pattern Echo pilot |
| Processing speed | optional Blitz |

## Current design rules derived from evidence

1. Fun first; cognitive value never rescues an unfun mechanic.
2. Ordinary campaign levels are untimed.
3. Cognitive challenge and board-failure pressure are separate axes.
4. New memory systems begin with low item counts and fixed positions.
5. Forgetting usually costs opportunity, not unrelated progress.
6. Explicit cognitive-accent levels target roughly 13–20% after introduction.
7. Avoid more than two explicit memory-accent levels in a row.
8. Do not expose medicalized "brain age" or cognitive-health scores.
9. Human-like bots must respect the player's observation history.
10. Family telemetry and direct feedback determine whether a mechanic survives.

## Open research questions

Future research passes should extend this file with evidence on:

- dose/frequency of cognitively stimulating games in healthy older adults;
- visuospatial associative-memory training and transfer;
- adaptive difficulty for older adult recreational games;
- usability of hidden-information mechanics on phones/tablets;
- social/cooperative digital play and cognitive/psychological well-being;
- whether spaced/retrieval-practice principles can be translated into game mechanics without making play test-like.

When adding evidence, distinguish:
- randomized/controlled intervention evidence;
- systematic reviews/meta-analyses;
- usability studies;
- observational studies;
- design inference.

Do not collapse these evidence levels into one certainty claim.
