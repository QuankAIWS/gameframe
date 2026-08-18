---
title: RPG Platform Product Goals
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-18
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
shared_document_id: rpg-platform-product-goals-v1
shared_document_version: 9
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-product-goals.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-product-goals.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-living-world-and-resolution-contract.md
  - rpg-platform-roadmap.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Product Goals

## Product statement

The RPG platform is a persistent **embodied generative role-playing system** played through GameFrame.

It is **video-game first in presentation and execution** while preserving the free-form agency of a tabletop game with a capable live referee. The player should primarily inhabit and manipulate a rendered persistent world rather than operate a transcript-first text adventure.

RPG GM Runtime owns durable semantic campaign truth and bounded generative campaign intelligence. GameFrame materializes that truth into a persistent playable 2D world and owns deterministic mechanics, physical control, tactical authority, and presentation.

Ordinary supported actions should increasingly happen directly in the world. Generative intelligence remains available for campaign construction/expansion, narration/framing, NPC performance, Ask-GM, unusual freeform actions, consequences, rulings, and semantic work that fixed controls cannot express.

> The graphics visualize and operationalize the imagination; they do not define the limits of the imagination.

## Player behavior assumption

The product must assume real players will not politely follow an authored route.

Supported play includes players who:

- ignore or abandon intended objectives;
- deliberately test or break expected interaction patterns;
- behave unseriously in a serious campaign or seriously in an absurd one;
- pursue unexpected social, criminal, commercial, exploratory, romantic, recreational, or destructive side activity when permitted by product/content policy and the fiction;
- invent plans that have no dedicated control;
- create allies/enemies and recurring situations the original campaign author did not predict;
- turn a minor incidental place or person into a major part of the campaign.

The system should preserve consequences and world coherence rather than force such players back onto an invisible authored rail.

## Player-facing hierarchy

```text
Games
├── Role-Playing Games
│   ├── Monster Master RPG
│   ├── future handcrafted/generated RPGs
│   └── Create RPG / My Campaigns / Import Campaign
├── Battle Simulator
│   ├── Monster Master Arena Battles
│   ├── future Battle Packs
│   └── Custom Battle / generated battlefield / import
├── Clockwork Checkers
├── Othello
└── Tic-Tac-Toe
```

**GameFrame RPG Engine** is internal reusable architecture, not a player-facing game card.

Campaign tactical play and Battle Simulator may share ruleset/tactical implementation, but campaign combat never launches Battle Simulator.

## Product hierarchy

- **GameFrame RPG Engine** — reusable embodied campaign engine inside GameFrame.
- **RPG Ruleset** — deterministic game-specific mechanics/capabilities independent of one campaign.
- **Game Family** — reusable rules/content/assets identity shared by related campaign/simulator experiences.
- **CampaignPackage** — protected durable semantic campaign foundation plus rules for compatible campaign-instance growth.
- **Campaign-instance world** — mutable durable world state and continuity established through play and validated Architect expansion.
- **Battle Pack** — simulator-safe tactical content/configuration referencing the same game-family/ruleset without duplicating combat rules or leaking campaign secrets.
- **BattleScenario** — one standalone tactical setup.

Monster Master proves the first shared family:

```text
Monster Master RPG
= GameFrame RPG Engine
+ Monster Master Ruleset / family content
+ Monster Master CampaignPackage
+ durable campaign-instance world

Monster Master Arena Battles
= Battle Simulator
+ Monster Master Ruleset / family content
+ Monster Master Battle Pack
+ BattleScenario
```

## Specialized generative responsibilities

The architecture currently requires at least these distinct generative responsibilities:

1. **Campaign Architect** — constructs the initial CampaignPackage and performs continuity-safe live campaign expansion when play requires substantial new semantic world/story substrate.
2. **Dungeon Master** — conducts live established play: referee/world adjudication, narration, Ask-GM, entity performance, unusual intent interpretation, immediate pacing/consequences, and aftermath/intervention.

The architecture does **not** impose an eternal exact agent count. A new specialized agent/capability may be introduced when a materially different job requires different context, authority, cadence, evaluation, or cost controls.

Do not create agents for work deterministic software can own correctly. Rules resolution, persistence, WorldGraph, Entity/Scene/Observer state, scheduling, pathfinding, tactical mechanics, utility decisions, and bounded scene orchestration are substrate unless later evidence proves a distinct generative role is needed.

Character performance does not require one permanent LLM agent/session per NPC.

## Authority split

### RPG GM Runtime

Owns committed CampaignPackage/hidden truth, campaign-instance semantic expansion/continuity, WorldGraph/location semantics, Entity Registry, semantic Scene Registry/membership, Observer Knowledge, objectives/events/clues/relationships/semantic history, generative context modes and semantic decisions, semantic scene transfer and meaningful consequences, actor intentions where semantically durable, and semantic Tactical Activation requirements/reconciliation.

### GameFrame

Owns authenticated player/session authority, physical scene materialization, x/y/facing and physical position recovery, collision/pathing/camera/picking/interaction range, contextual player controls, deterministic RPG Ruleset mechanics, character/controlled-entity authorization, tactical state/outcomes/recovery, player-facing world/history presentation, and standalone Battle Simulator lifecycle.

## Embodied freedom rule

Direct controls are convenience and legibility, not the complete action vocabulary.

At any time a player may use **Do Something Else** to submit a plausible unsupported in-fiction intent. The Dungeon Master may interpret what the player is attempting; deterministic/semantic authorities determine what actually succeeds.

Example:

```text
"I pull out Cinder's cube and release her beside me."
→ interpret deploy intent
→ validate ownership/deployment rules/current state
→ commit accepted semantic + physical change
→ render Cinder in the world
→ narrate/log the accepted result
```

**Prose is not authority.** Declarative wording cannot create inventory, bypass collision/locks, mint entities, force NPC outcomes, or overwrite committed world truth.

Missing bespoke graphics or animations also do not automatically remove agency. When an otherwise valid action is not yet fully animated, the product should degrade through generic embodied representation and then readable text/UI narration rather than reject the action solely because presentation is incomplete.

## Interaction modes

The mature player experience distinguishes Explore, Interact, Talk, Do Something Else, Ask Game Master, GM Intervention, Tactical Mode, and Campaign Chronicle.

The world is the primary play surface. The chronicle/history is supporting presentation, not the permanent main controller.

## Living-world goal

Campaigns must not freeze into a strict player-command → model-response loop.

Durable actors may have goals, beliefs, relationships, commitments, current intentions, activities, and decision policies. Routine behavior should be resolved through inexpensive videogame/rules/heuristic systems where practical. Generative cognition/performance is used when human-like semantic reasoning is actually required.

NPCs may interact with one another and pursue consequential intentions without waiting for the player to explicitly ask what each person does next. Consequence propagation remains bounded by scene/world orchestration budgets and meaningful stop conditions.

Important background intentions/events may remain scheduled or due while the player is elsewhere. The system must not continuously run token-expensive simulations for inactive NPCs.

`rpg-living-world-and-resolution-contract.md` controls the detailed execution model.

## Campaign growth goal

A CampaignPackage protects foundational truth but does not define the maximum extent of the playable world.

When players require substantial new campaign substrate that is not already established—such as a meaningful new area, organization, venue, cast, side thread, or durable consequence branch—the Campaign Architect may propose a continuity-safe campaign-instance expansion.

The expansion must be validated against established world truth and then committed as durable semantic state before the Dungeon Master treats it as reality.

The Dungeon Master runs play inside established/expanded reality; it is not expected to silently become the campaign-construction agent whenever players leave the expected path.

## Rules/resolution goal

Use normal videogame mechanics whenever they can directly resolve an action. Do not turn ordinary movement, physical interaction, or tactical actions into hidden tabletop checks merely because the product is RPG-like.

For genuinely uncertain actions not fully represented by direct videogame mechanics, the active RPG Ruleset owns the mechanical mapping and outcome. Language-model reasoning may classify fuzzy semantic circumstances into bounded validated categories; it should not arbitrarily choose final numeric bonuses/difficulties or declare authoritative success.

Consequential randomness must be deterministic/retry-safe enough that reconnect/retry cannot reroll history.

## Observer, audience, and communication goal

Physical presence, observer knowledge, audibility, semantic audience, and UI presentation are related but not interchangeable.

- nearby normal speech may be heard by nearby observers;
- a whisper may intentionally restrict who hears it;
- Ask-GM is player-private by default and is not fictional speech;
- another player does not learn a fact merely because one client's UI displayed it;
- canonical entity names remain hidden until that observer legitimately knows them.

One semantic event may have multiple authorized presentations. A Pell line can appear as a temporary in-world bubble/subtitle and later as a campaign-history entry without becoming two separate truths.

## Campaign Chronicle goal

The current campaign feed should mature into a readable **campaign chronicle**, not a tiny combat log and not the primary game controller.

It may retain meaningful opening/scene narration, dialogue the observer actually heard/participated in, discoveries and knowledge reveals, consequential player actions, deterministic mechanic outcomes, persistent world changes, scene transitions, and GM interventions/rulings appropriate to that audience.

It should not need every movement step, camera turn, hover, or transient animation. Different observers may legitimately have different chronicle entries.

## Persistent world goal

Campaigns are durable worlds, not disposable model conversations.

Preserve stable campaign/entity/location/item identities, semantic scene presence, observer-specific knowledge/beliefs, persistent/reproducible GameFrame materializations, meaningful environmental changes, actor goals/intentions where consequential, deterministic retry/reconnect, semantic correction/history, and separate Runtime/GameFrame authority positions.

High-frequency movement remains GameFrame physical/session state. Meaningful scene/world changes become durable semantic operations.

## Same-map tactical rule

When initiative is required, the **current materialized scene** enters Tactical Mode through validated Tactical Activation.

Current positions, people, monsters, objects, terrain, collision geometry, and exits remain the world. Tactical overlays/action economy become active, deterministic outcomes commit, semantic reconciliation occurs where required, and exploration resumes in place.

No campaign Arena handoff or Return-to-Campaign screen.

## Ruleset-defined control

The generic engine must not hardcode one principal → one unit. Monster Master must support a human principal controlling their own Master/trainer plus one or more deployed monsters according to class/ruleset limits.

## World/materialization goal

CampaignPackage and committed campaign-instance state own semantic WorldGraph/location intent. GameFrame realizes it through accepted assets, deterministic authored/procedural composition, reusable world kits/prefabs, bounded generated presentation assets when justified, and validated fallbacks.

Once accepted for a campaign instance, scene materialization identity and meaningful state persist across revisit/reconnect.

## Deployment goal

Initial production remains Cloudflare public boundary + private VM services:

- public GameFrame through Cloudflare;
- no inbound router forwarding/player VPN requirement;
- private loopback GameFrame RPG authority and RPG GM Runtime;
- separate services/stores/secrets;
- **HTTP owns RPG commands/mutations, including exploration movement**;
- **WebSockets are projection/notification-only and reconstructable from durable state**;
- no per-step movement traffic to RPG GM Runtime.

## Next product proof

The Crooked Checkpoint remains the proving world, but the target is now generalized execution rather than additional permanent canaries:

```text
Role-Playing Games
→ Monster Master RPG
→ persistent Crooked Checkpoint
→ movement / direct interaction / freeform intent
→ generalized attempted-operation boundary
→ deterministic/ruleset resolution
→ persistent actor intentions + observer knowledge
→ bounded NPC↔NPC/world reaction chain
→ West Woods/revisit and same-map tactical continuity
→ Campaign Architect continuity-safe expansion canary
→ restart/reconnect
→ same persistent expanded world
```

Then prove two humans in one shared scene and a materially different second Game Family while continuing to generalize only from real player behavior.

## Governing rule

> Make the world the game, keep arbitrary plausible intent legal, let durable inhabitants and consequences continue acting, let the Campaign Architect expand possibility when play outruns established campaign substrate, require authoritative mechanics/state before narration claims consequences, and preserve observer-scoped continuity without collapsing back into a transcript-first adventure.
