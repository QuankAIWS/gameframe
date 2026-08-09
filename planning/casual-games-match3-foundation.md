# Casual Games / Cascade Foundation

Status: first playable research slice  
Scope: GameFrame casual-games lane and the first match-3 title, **Cascade**

## Product thesis

The first casual GameFrame title should prove one narrow thing before the platform grows: can a simple, highly polished match-3 loop make an ordinary adult player voluntarily choose "one more level" and, in the family build, choose continuation priced in **IOU Dollars (IOU$)**?

The game must be original in presentation, content, level design, art, names, progression, and implementation. Match-3 swapping, limited moves, score/objective levels, boosters, lives, and cascades are genre mechanics; Candy Crush, Royal Match, and other products are references for product research rather than assets or level templates.

## Research conclusions that matter to the build

### 1. The strongest repeat-play mechanism is a good challenge/skill fit

Controlled Candy-Crush research found that flow and arousal jointly increased urge to continue playing, and that levels around a player's skill produced strong flow. Older-adult game research similarly found higher engagement when difficulty was incremental and adjustable.

**Implementation:** early levels teach one idea at a time, the first five levels should be highly passable, difficulty climbs by target/move pressure, and every fifth level is visibly harder. Long-term tuning should be data-driven rather than based on designer intuition alone.

### 2. Short, frictionless sessions matter more than constant pressure

Reporting from King's development organization describes Candy Crush as an extensively measured live product with continual level tuning and a focus on minimizing friction that makes players leave. The core loop remains readable in seconds: swap, match, cascade, resolve, continue.

**Implementation:** Cascade is immediately playable, one interaction model is used everywhere, invalid swaps are rejected, feedback is fast, and the next level is one tap away.

### 3. Goals and visible progress increase persistence

Consumer research on endowed progress and goal pursuit shows that visible advancement toward a goal can increase persistence.

**Implementation:** every level shows score, target, moves, run position, and streak. The first slice uses a 20-level run so the player always knows where the next concrete milestone is.

### 4. Successful match-3 economies sell relief at friction points

Official Candy Crush documentation describes five-life gating, timed life regeneration, extra moves after failure, pre-game/in-game/end-game boosters, and Gold Bars as a currency used for continuation/help. Royal Match documentation similarly describes coins that can buy extra lives, extra moves, and boosters.

**Implementation in the family build:** the same decision locations exist, but the currency is **IOU$**. The player sees what they currently owe and can inspect the full IOU ledger. The point is to observe which continuation choices players value enough to owe IOU$ for.

### 5. Randomized paid rewards and deceptive purchase flows are a different risk class

Systematic reviews consistently associate loot-box engagement/spending with problem gambling/problem gaming, while experimental work finds rare randomized rewards unusually arousing and urge-inducing. The FTC has also taken enforcement action over dark patterns that caused unintended in-game purchases.

**Implementation boundary:** no loot boxes, no paid randomness, no hidden prices, no default purchase, no false countdowns, and no impossible-to-dismiss modal. IOU choices remain explicit button presses with visible IOU$ prices.

## First playable: Cascade

### Board

- 8 × 8
- 6 tile types
- adjacent swaps only
- swaps must create a match
- horizontal/vertical matches of 3+
- gravity and refill
- automatic cascades
- cascade multiplier scoring
- board regeneration if no legal move remains

### Twenty-level opening run

The vertical slice uses twenty generated score-target levels:

- Level 1 starts with generous moves and a low target.
- Difficulty rises through target pressure and gradually tighter move budgets.
- Every fifth level receives an additional target increase and is marked as hard.
- Unused moves convert to bonus score after a win.
- The run tracks consecutive clears as a streak.

This is deliberately a calibration scaffold, not the final authored campaign. The next serious level-design pass should use automated playtesting plus real traces from the family test.

### Booster

The first booster is a hammer:

- two are granted initially;
- a hammer removes one selected tile without consuming a move;
- zero inventory exposes an IOU$ booster checkpoint.

Future boosters should be mechanically distinct, not merely larger numbers: row clear, column clear, color clear, free swap, pre-level special placement, and objective-specific tools.

## IOU$ experiment

IOU$ is a running game ledger. It does **not** have a cap: if a player keeps choosing continuation, the amount they owe keeps accumulating.

The first build has three explicit checkpoints:

1. **Out of moves:** +5 moves for 2 IOU$.
2. **Out of lives:** refill five lives for 5 IOU$.
3. **Out of hammers:** three hammers for 3 IOU$.

Product rules:

- no IOU$ cap;
- no ledger-history cap;
- player-facing copy uses direct IOU language rather than vague labels such as "Family Tab";
- the persistent summary reads **YOU OWE** followed by the IOU$ total;
- the detailed history is the **IOU Ledger**;
- offers use short, game-like copy rather than disclaimer language;
- the IOU$ action is the large, colorful primary continuation button;
- the ledger can be inspected and reset;
- state stays in browser localStorage;
- analytics stay in browser localStorage;
- no external telemetry is sent;
- one life regenerates every ten minutes.

This gives us a behavioral signal at familiar monetization decision points while keeping the joke legible: the player chose something now and owes IOU$ for it.

## Local research events

`window.cascadeResearch.exportEvents()` exposes the local event stream for inspection.

Events include:

- level start;
- valid move;
- invalid swap;
- match clear and cascade depth;
- board shuffle;
- level win/failure;
- booster armed/used;
- offer shown;
- offer declined;
- IOU accepted;
- ledger reset.

The event store is bounded to the most recent 500 events. The **IOU ledger itself is not bounded**.

## Metrics for the first family test

The first question is whether the core game is strong enough that continuation is voluntarily valuable.

Track:

- levels attempted and completed;
- failure rate by level;
- moves remaining on wins;
- distance from target on losses;
- retry rate after a failure;
- session return rate;
- maximum level reached;
- streak length;
- booster use rate;
- IOU$ offer impressions;
- IOU$ acceptance rate by offer type;
- cumulative IOU$ total per player profile.

A useful early signal is an IOU$ acceptance occurring after several genuinely enjoyable levels rather than immediately because the opening levels are artificially frustrating.

## Next development slices

1. Add special pieces created by 4- and 5-tile matches.
2. Add two objective families: clear blockers and collect specified colors.
3. Author the first 20 levels instead of relying on generated score targets.
4. Add an automated match-3 playtester to estimate solvability, expected remaining moves, and difficulty variance.
5. Add sound, haptics, better clear/cascade animation, and distinctive original art.
6. Add a lightweight level map and reward cadence.
7. Add a family-facing summary screen showing play/IOU$ metrics.
8. Only after real traces exist, tune difficulty and offer placement from evidence.

## Sources used for the initial design

- Dixon et al., *The relationship between the skill-challenge balance, game expertise, flow and the urge to keep playing complex mobile games*.
- Nunes & Drèze, *The Endowed Progress Effect: How Artificial Advancement Increases Effort*.
- King / Candy Crush Help Center: lives, boosters, controls, and game modes.
- Dream Games / Royal Match Help Center: coin acquisition and uses.
- Zendle and related systematic-review literature on loot boxes, microtransactions, problem gaming, and gambling.
- U.S. Federal Trade Commission: dark-pattern reports and Epic Games enforcement materials.
- Reporting on King's level-development and behavioral-science process used as secondary product-development context.
