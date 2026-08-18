---
title: RPG Living World and Resolution Contract
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-18
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Monster Master RPG
  - future handcrafted and generated campaigns
shared_document_id: rpg-living-world-and-resolution-v1
shared_document_version: 1
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-living-world-and-resolution-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-living-world-and-resolution-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-campaign-architect-contract.md
  - rpg-platform-roadmap.md
---

# RPG Living World and Resolution Contract

## Decision

GameFrame RPG is a **video-game-first, rendered, persistent, free-form role-playing system** with tabletop-scale player freedom.

Players are expected to ignore plans, derail objectives, joke, test boundaries, pursue strange side interests, create unexpected alliances, abandon intended routes, and attempt actions for which no dedicated control or animation exists. That behavior is ordinary supported play, not an error condition.

The mature architecture therefore cannot be only:

```text
player command
→ Dungeon Master response
→ wait for next player command
```

The campaign is a durable world whose actors, situations, mechanics, consequences, and campaign structure can continue to develop in response to both players and the world itself.

## Product rule

> Build a real videogame world capable of supporting the freedom of a chaotic tabletop game. Render and simulate actions directly whenever GameFrame can; interpret unsupported intent without shrinking the action space; resolve uncertain outcomes through authoritative rules; let durable actors and world processes continue acting; and expand campaign structure through the Campaign Architect when play outruns what is already established.

## Core execution layers

The mature execution stack is:

```text
Campaign foundation + campaign-instance world
        ↓
World State Kernel
        ↓
player / actor / system / scheduled trigger
        ↓
Attempted Operation
        ↓
authority + legality + world validation
        ↓
GameFrame mechanic OR RPG Ruleset resolution
        ↓
committed outcome
        ↓
knowledge / relationships / intentions / world consequences
        ↓
bounded reaction and scene orchestration
        ↓
player-facing materialization / narration / Chronicle
```

When established campaign substrate is insufficient:

```text
play creates a durable expansion need
        ↓
Campaign Architect proposes continuity-safe expansion
        ↓
validate against protected campaign foundation/current truth
        ↓
commit campaign-instance expansion
        ↓
GameFrame materializes supported world semantics
        ↓
Dungeon Master conducts play inside the expanded world
```

## 1. World State Kernel

Durable software owns facts that must survive model calls, retries, reconnects, process restarts, and provider changes.

The kernel builds on CampaignPackage, campaign journal, Entity Registry, Scene Registry, Observer Knowledge, WorldGraph, GameFrame physical state, and ruleset state.

As capabilities mature, persistent actor/world state may include:

- stable entity identity and semantic presence;
- physical condition/resources/inventory through the correct authority;
- observer-specific facts, beliefs, suspicions, and corrections;
- relationships, promises, debts, obligations, injuries, and important memories;
- drives and durable goals;
- current intentions and activities;
- decision-policy/profile data;
- factions and faction relationships;
- active situations and unresolved consequences;
- world/campaign time where required;
- scheduled or due events/actions;
- objectives and current pressure;
- persistent important object/environment state.

No language-model session is the database for these facts.

## 2. Attempted Operation contract

All meaningful attempts should converge on one bounded operation concept rather than accumulate permanent per-feature pipelines.

Sources may include:

- direct player controls;
- player **Do Something Else** freeform intent;
- NPC heuristic/utility decisions;
- Dungeon Master interpretation;
- deterministic world systems;
- scheduled world events;
- Campaign Architect-created expansion hooks after commitment.

An attempted operation should carry enough typed information to validate and resolve the attempt without treating prose as authority. The exact schema may evolve, but it should represent concepts such as:

```text
operationId
source / provenance
actor
operation kind/capability
semantic target(s)
parameters
purpose/context where mechanically relevant
expected semantic/physical/rules revisions
```

Examples include move, talk, inspect, open, take, use, give, hide, follow, flee, travel, deploy, recall, attack, negotiate, assist, and ruleset-specific capabilities.

The operation vocabulary is extensible. The engine must not require every imaginable human action to be predefined before freeform play is legal.

Current Pell→Mara inspection, checkpoint-cart uncover, deploy/recall, and travel implementations are vertical proofs. They must not become the mature architecture through an ever-growing list of hardcoded actor/target/text special cases.

## 3. Video-game-first resolution

When GameFrame already has an expressive direct videogame mechanic, use it.

Examples:

- physical movement uses movement/collision/pathing;
- opening an unlocked supported door uses object interaction state;
- tactical attacks use the active ruleset/tactical system;
- inventory transfer uses actual inventory/custody authority;
- pathfinding executes actor movement rather than the Dungeon Master narrating teleportation.

Do not introduce hidden tabletop rolls merely because a role-playing game could use one.

## 4. RPG Ruleset resolution

When an outcome is genuinely uncertain and direct videogame mechanics do not fully answer it, the active RPG Ruleset owns mechanical resolution.

The mature flow is:

```text
attempted operation
→ determine relevant verified world/mechanical facts
→ classify any genuinely fuzzy semantic circumstances
→ validate mechanical assessment
→ RPG Ruleset maps approved factors to mechanics
→ deterministic/seeded resolution where randomness is used
→ durable outcome
```

The Dungeon Master may help interpret **meaning** when software cannot reasonably classify a free-form situation. It does not receive unrestricted authority to invent arbitrary numeric bonuses, difficulty values, stats, inventory, or outcomes.

Prefer ruleset-defined semantic categories such as difficulty bands or circumstance factors over model-selected numbers. The ruleset decides what those categories mean mechanically for that Game Family.

Consequential random resolution must be retry-safe and auditable. The same authoritative attempt cannot be rerolled by retrying a request.

## 5. Actor cognition and decision policy

A durable NPC is an entity, not a permanently running LLM session.

Actors may persist:

- goals/drives;
- beliefs/knowledge;
- relationships and commitments;
- conditions/resources;
- current intentions/activities;
- bounded meaningful memory;
- decision-policy/personality parameters.

Routine or readily modelled decisions should use inexpensive deterministic/heuristic/utility systems where practical. A decision system chooses what an actor is inclined to **attempt**; it does not mint the outcome.

Example:

```text
Mara learns Pell detected forged credentials
→ exposure/self-preservation state changes
→ bluff / conceal evidence / flee / surrender / attack utilities change
→ Mara chooses an attempted action
→ ordinary operation/rules pipeline resolves it
```

Language-model cognition is an escalation path for genuinely nuanced decisions, social meaning, unusual situations, or dramatic character performance—not a requirement for every idle NPC reaction.

## 6. Bounded scene and consequence orchestration

NPCs must be able to interact with one another and continue a locally meaningful sequence without requiring the player to explicitly prompt every step.

A bounded scene-resolution cycle may process:

- the triggering operation/event;
- current participants;
- relevant actor intentions/goals;
- authorized observations/knowledge;
- resulting attempted operations;
- committed outcomes;
- immediate consequences and reactions.

The orchestrator must have hard stop conditions. Bounds may include:

- maximum semantic action count;
- maximum dialogue exchanges;
- maximum new intentions/reactions;
- maximum fictional time advancement;
- maximum consequence propagation depth;
- token/model-call budget where cognition is invoked.

Stop when, for example:

- the scene reaches a meaningful player decision point;
- tactical authority is required;
- the triggering task completes/fails;
- participants have no consequential next action;
- the local situation stabilizes;
- a configured budget is exhausted.

The purpose is not autonomous infinite simulation. The purpose is to prevent the world from freezing after every single line of dialogue while remaining bounded, recoverable, and economical.

## 7. Background and scheduled world activity

Important intentions and consequences may outlive the player's immediate scene.

Examples:

- an exposed suspect plans to flee later;
- a patrol is due to arrive;
- an NPC goes to warn another actor;
- a faction changes posture after a public event;
- evidence is moved or destroyed if nobody intervenes;
- an off-screen actor completes a routine task.

Background work should be event-driven and fidelity-scaled. Do not run high-frequency language-model simulation for inactive NPCs.

Routine background activity can use schedules, state machines, rules, utility decisions, and bounded deterministic resolution. Escalate to richer cognition only when the consequence is important or ambiguous enough to justify it.

## 8. Campaign foundation versus campaign-instance expansion

A committed CampaignPackage protects foundational truth. It is not a prison that defines every place, person, or story thread the players are ever allowed to encounter.

### Protected campaign foundation

Examples:

- setting laws and invariants;
- established historical/causal truth;
- committed package-bearing actors/functions;
- existing important geography;
- revealed facts and consequences;
- forbidden retcons;
- ruleset/Game Family identity and capabilities.

Changing these requires an explicit amendment/migration policy where appropriate.

### Mutable and expandable campaign-instance world

Ordinary play may establish or create durable:

- incidental locations and businesses;
- local routes consistent with geography;
- incidental/recurring NPCs;
- relationships and organizations;
- side situations and emergent threads;
- consequences and new opportunities;
- player-created assets/obligations/problems;
- world changes and new current goals.

Once committed, these become durable campaign-instance truth and are not disposable model prose.

## 9. Campaign Architect live expansion

The Campaign Architect is responsible for campaign construction **and continuity-safe campaign expansion**. It is not limited to a one-time pre-play compile.

The Architect should be invoked when play needs substantial new campaign substrate rather than ordinary local improvisation, for example:

- a meaningful destination/region is insufficiently defined;
- players pursue a durable new organization/business/social environment;
- a substantial new cast or faction is required;
- consequences create a new branch that needs coherent structure;
- players abandon the expected campaign route and continue elsewhere;
- a live thread needs durable supporting locations, actors, relationships, or causal structure.

The Architect does not conduct the current conversation or live tactical turn. It proposes semantic expansion that is validated and committed, after which the Dungeon Master and world systems run play inside it.

Small incidental facts do not require an Architect call. Character Factory and ordinary world/DM capabilities remain appropriate for bounded local needs.

## 10. Agent-count rule

The architecture does **not** impose an eternal exact agent count.

Campaign Architect and Dungeon Master are currently the two required specialized generative responsibilities, but future specialized intelligence may be added when a materially different job requires different context, authority, cadence, evaluation, or cost controls.

Do not create agents merely to anthropomorphize deterministic services. Rules resolution, persistence, WorldGraph, Entity/Scene/Observer state, pathfinding, combat, scheduling, utility decisions, and scene orchestration remain software unless evidence demonstrates a distinct generative role is necessary.

One permanent agent/session per NPC is specifically not required.

## 11. Dungeon Master boundary

The Dungeon Master **conducts live established reality**.

It may:

- interpret unusual player intent;
- referee ambiguous immediate situations;
- perform characters from perspective-bounded context;
- understand social/semantic meaning;
- frame narration and consequences;
- decide what deserves immediate player attention;
- request/check supported mechanics;
- coordinate live dramatic pacing.

It should not be responsible for silently designing a whole new district, faction, long-running quest structure, or campaign branch when that work belongs to Campaign Architect expansion.

The DM may request expansion; the Architect owns the expansion proposal/validation boundary.

## 12. Presentation fallback ladder

Missing bespoke presentation must not remove otherwise plausible agency.

Preferred order:

1. dedicated videogame mechanic + dedicated presentation/animation;
2. generic supported mechanic + reusable animation/effect;
3. generic embodied representation/interaction state plus UI/text;
4. narration/card/text fallback when exact physical animation is not yet available.

Example: if a player climbs a tall tree and the game lacks a climbing animation, GameFrame can still move the character to the interaction point, resolve the attempt appropriately, and present the resulting elevated observation through text/UI rather than rejecting the action solely because no bespoke animation exists.

Once a newly generated/materialized location or entity is accepted for a campaign instance, its stable identity and meaningful state persist across revisit/reconnect.

## 13. Observer and information custody

Multi-actor simulation does not permit omniscient character performance.

The referee/world capability may access relevant hidden truth when adjudication requires it. Individual actor cognition/performance receives only that actor's justified knowledge/beliefs/observations plus its own private interior state.

Committed outcomes update Observer Knowledge only for actors who legitimately observe/learn the relevant facts. A character may act on a suspicion without that suspicion becoming canonical truth.

## 14. Cost and fidelity rule

Use the cheapest layer that can correctly preserve the intended behavior:

```text
direct deterministic videogame system
→ deterministic/heuristic living-world behavior
→ ruleset resolution
→ bounded language-model semantic interpretation/cognition/performance
→ Campaign Architect expansion when durable new campaign substrate is required
```

Do not spend model tokens to simulate idle movement, obvious routine reactions, known schedules, or mechanics software already understands.

## 15. Required proving sequence

Before broad campaign generation, prove the shared execution primitives in the Crooked Checkpoint world:

1. generalized attempted-operation identity/provenance/retry contract;
2. existing direct player actions and freeform actions converge on that operation boundary;
3. a non-player actor can form/emit an attempted operation without a player directly operating that actor;
4. rules/mechanics resolve the attempt without model-owned outcome authority;
5. knowledge and durable actor state update from committed outcomes;
6. at least one bounded multi-actor reaction chain resolves and terminates safely;
7. an actor intention can survive a turn/reconnect and later become due;
8. routine reactions avoid model calls where deterministic/heuristic behavior is sufficient;
9. a significant player-created expansion need can be handed to Campaign Architect, validated, committed, materialized, and revisited;
10. the complete path survives retry/restart without duplicate actions or rerolls.

Pell inspecting Mara is useful as a canary only if the proof generalizes beyond the hardcoded Pell/Mara pair.

## Governing rule

> Players may attempt whatever the fiction plausibly permits; GameFrame and RPG Rulesets own mechanical reality; durable world state owns continuity; NPCs may form and pursue intentions without permanent model sessions; bounded orchestration lets consequences propagate; the Dungeon Master conducts live play; and the Campaign Architect expands durable campaign possibility when play demands more world than currently exists.
