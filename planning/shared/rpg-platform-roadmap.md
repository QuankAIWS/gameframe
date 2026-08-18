---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-18
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 11
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-roadmap.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-roadmap.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-living-world-and-resolution-contract.md
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Roadmap

## Objective

Build one campaign-agnostic GameFrame RPG Engine that turns validated campaign foundation + durable campaign-instance truth into a persistent playable 2D world, accepts pluggable deterministic RPG Rulesets, supports a bounded living-world execution model, and uses specialized generative capabilities where semantic reasoning or campaign construction genuinely requires them.

The intended product is **video-game first in presentation/execution with free-form tabletop-scale agency**. The world—not a transcript—is the ordinary player surface.

Campaign combat happens through **Tactical Activation on the current materialized campaign scene**. It never launches Battle Simulator or compiles a substitute campaign battlefield.

`rpg-living-world-and-resolution-contract.md` controls the execution architecture for generalized attempted operations, rules resolution, actor intentions/decisions, bounded reaction chains, background consequences, and Campaign Architect live expansion.

## Authority

- GameFrame owns physical materialization, x/y/facing, collision/pathing/camera/picking/interaction range, deterministic rules/control/tactical state, and player-facing rendering.
- RPG GM Runtime owns CampaignPackage/protected semantic foundation, campaign-instance semantic truth, WorldGraph/scene/entity/Observer Knowledge, generative contexts, actor intentions where durable, expansion validation/commitment, and meaningful semantic consequences.
- RPG Rulesets own deterministic game-specific mechanical mapping/outcomes where direct GameFrame mechanics do not already resolve the action.
- **HTTP owns GameFrame RPG commands/mutations, including exploration movement and interaction.**
- **WebSockets are projection/notification-only and reconstructable from durable state.**
- Text/narration never becomes authoritative state merely because a model emitted it.
- Significant Campaign Architect expansion is committed semantic state, not disposable prose.

## Evidence already established

Preserve the accepted substrate and vertical proofs:

- CampaignPackage/WorldGraph and explicit Game Family/ruleset capability requirements;
- Entity Registry and bounded Character Factory;
- Semantic Scene Registry with durable membership authority;
- Observer Knowledge / People;
- viewer-safe Runtime → GameFrame exploration projection;
- private authenticated exploration ingress;
- deterministic Crooked Checkpoint Pixi materialization;
- GameFrame-owned durable x/y/facing physical state;
- authenticated HTTP movement/collision/revision/recovery;
- desktop/mobile movement and camera;
- Cloudflare/VM staging path and reset/reseed tooling;
- player-safe identity disclosure;
- physically authorized Talk/personhood context with hidden-truth custody;
- durable command retry/recovery;
- deploy/recall world-operation proof;
- bounded actor-inspection canary;
- bounded checkpoint-cart object-operation canary;
- Crooked Checkpoint ↔ West Woods travel path present in current code;
- current deterministic check primitive and mechanic journal.

These are valuable proofs. **They are not evidence that actor-specific or exact-text-specific interceptors are the mature general architecture.**

## Current architecture pivot — generalized living-world foundation

Stop broadening the RPG primarily by adding another permanent special-case player/NPC action.

The next shared work is to extract reusable execution primitives from the existing vertical proofs.

### Foundation A — generalized Attempted Operation

Create one versioned bounded operation/provenance contract that can be produced by:

- direct player controls;
- Do Something Else/freeform interpretation;
- NPC heuristic/utility decisions;
- Dungeon Master semantic interpretation;
- deterministic/system/scheduled events.

The contract must preserve retry/idempotency/revision authority and distinguish **attempt** from **outcome**.

Initial adapters should prove existing deploy/recall, actor inspection, object interaction, and travel can converge toward this boundary without breaking current behavior.

**Exit gate:** at least two materially different existing operations use the shared contract and exact retry does not duplicate or reroll them.

### Foundation B — Rules / Resolution Kernel

Separate:

1. direct videogame mechanics GameFrame can resolve without abstract checks;
2. uncertain operations requiring RPG Ruleset resolution;
3. fuzzy semantic classification that may need Dungeon Master reasoning before rules mapping.

Mature checks must not rely on unrestricted model-selected numeric difficulty/modifiers. Prefer validated ruleset-defined difficulty bands/circumstance factors/opposed mechanics or other Game Family-specific structures.

Consequential randomness must be deterministic/retry-safe and auditable.

**Exit gate:** one player and one NPC uncertainty case resolve through the same ruleset authority with stable retry/reconstruction and no model-owned final result.

### Foundation C — durable actor intentions and inexpensive decisions

Add the narrow durable actor state required to represent meaningful goals/current intentions/activities and decision policy without creating permanent LLM sessions.

Routine decisions should use deterministic/heuristic/utility logic when practical. Generative cognition is an escalation path for nuanced cases.

**Exit gate:** an NPC can form/retain an intention, emit an attempted operation, and recover that state after restart without the player directly operating that NPC.

### Foundation D — bounded Scene / Consequence Orchestrator

Allow NPC↔NPC/world reactions to continue through several meaningful committed steps rather than stopping after every single reply.

Hard-limit semantic actions, dialogue exchanges, consequence depth, fictional time advancement, and model-call/token budget. Stop at player decision, tactical escalation, task completion/failure, stability, or budget exhaustion.

**Exit gate:** one Pell/Mara-style multi-actor sequence completes, updates correct observer knowledge/state, and terminates without infinite recursion or hidden-knowledge leakage.

### Foundation E — scheduled/background world consequences

Allow consequential intentions/events to become due without a constantly running token-expensive world simulation.

Use event-driven schedules, state machines, rules, heuristics, and bounded resolution. Rich cognition is invoked only when justified.

**Exit gate:** an off-screen/scheduled consequence can persist, become due, resolve once, and be visible on return/reconnect.

### Foundation F — Campaign Architect live expansion

Implement a bounded campaign-instance expansion contract separate from both ordinary Dungeon Master turns and protected package amendment.

Use it when play requires substantial new durable semantic substrate such as a meaningful destination, organization, venue, cast, or emergent branch that current world truth does not sufficiently define.

**Exit gate:** a player-created expansion need produces one validated/idempotent semantic expansion, GameFrame can materialize/fallback it, the Dungeon Master can run it, and revisit/restart returns to the same expanded truth.

## Existing embodied journey remains the proving laboratory

Crooked Checkpoint/West Woods remain the concrete human-play world while Foundations A–F land.

Continue to prove:

- direct movement and physical targeting;
- player/NPC/object operations;
- freeform intent parity;
- persistent world changes;
- West Woods/revisit;
- observer-safe speech/knowledge;
- same-map tactical activation;
- recovery/reconnect.

But when a proof exposes a missing general primitive, prefer extracting that primitive over installing another permanent Pell/Mara/cart-specific path.

## Video-game-first presentation rule

Use the richest implemented representation that is correct:

```text
dedicated mechanic + animation
→ generic mechanic + reusable animation/effect
→ generic embodied representation + UI/text
→ narration/card/text fallback
```

Missing bespoke animation does not by itself make a plausible freeform action illegal.

## Tactical proof

Promote same-map campaign combat requirements through the existing Monster Master ruleset/control work: principal → Master/player-character → deployed/controlled set, deployment limits, initiative/action economy/legal actions, current positions/geometry, resources/conditions/objectives, non-elimination exits, semantic reconciliation, and same-map exploration resume.

```text
exploration
→ tactical trigger
→ validate semantic/materialized/ruleset/control state
→ Tactical Activation
→ current positions become tactical starting positions
→ deterministic turn-based actions on current geometry
→ deterministic result
→ semantic reconciliation
→ exploration resumes in place
```

No replacement battlefield or Return-to-Campaign step.

## Single-player proof after living-world foundation

The gold-standard Monster Master proof becomes:

```text
Role-Playing Games
→ Monster Master RPG
→ persistent Crooked Checkpoint
→ embodied movement/interaction
→ direct + freeform attempted operations
→ NPC intention and bounded multi-actor reaction
→ deterministic/ruleset uncertainty outcome
→ persistent world/object/knowledge consequences
→ West Woods travel/revisit
→ scheduled/off-screen consequence
→ same-map tactical activation/result/resume
→ one Campaign Architect live-expansion canary
→ bounded campaign resolution or legitimate abandoned/altered objective path
→ restart/reconnect
→ same persistent world
```

Validation order: human play → deterministic/machine-play → live provider → deployed staging.

## Multiplayer/generalization sequence

After the above primitives are credible:

1. richer local audibility/whispers + two-human one-scene;
2. materially different second handcrafted Game Family to test engine/rules generality;
3. broader Campaign Architect initial campaign-generation workflow;
4. dynamic Role-Playing Games/Battle Pack productization;
5. Battle Simulator convergence where shared rules/content are truly compatible;
6. split-party/multi-scene concurrency only after explicit world-time/knowledge/concurrency policy exists.

Do not postpone the **live expansion boundary itself** until after the second family; it is required to prove the free-form product. Do postpone broad generated-campaign productization until generality evidence is strong enough.

## Campaign Chronicle direction

The existing campaign feed should mature into an observer-authorized **Campaign Chronicle** containing meaningful narration, authorized/heard dialogue, discoveries, consequential actions, mechanics, world changes, travel, actor/world consequences, and relevant GM interventions. It should be neither a tiny combat log nor the permanent primary control surface.

One semantic event may have multiple authorized presentations. Different observers may legitimately have different Chronicle content.

## Implementation discipline

For each slice:

1. start from a concrete player/world acceptance;
2. inspect existing authorities and current vertical canaries;
3. identify whether the missing capability is a reusable operation/rules/state/orchestration/expansion primitive;
4. implement the narrowest reusable contract rather than an exact-text/actor special case when feasible;
5. preserve idempotency/retry/restart and observer custody;
6. keep GameFrame physical authority and Runtime semantic authority separate;
7. test the primitive with Crooked Checkpoint before broadening it.

## Immediate order

1. **Attempted Operation V1** — shared identity/provenance/revision schema and first adapters.
2. **Rules / Resolution V1** — direct-gameplay vs abstract uncertainty boundary; retire model-owned numeric difficulty as mature design.
3. **Actor Intention V1** — durable current intention + cheap decision path.
4. **Scene Orchestrator V1** — bounded NPC↔NPC/world reaction chain.
5. **Scheduled Consequence V1** — durable due/off-screen action.
6. **Campaign Architect Expansion V1** — one validated live expansion canary.
7. **Same-map tactical + complete single-player proof** on the generalized foundation.
8. **Two-human one-scene + second Game Family.**
9. **Broader Campaign Architect/generated RPG productization.**

## Governing rule

> Deliver a real persistent videogame world with free-form tabletop-scale agency by extracting shared operation, resolution, actor, orchestration, and expansion primitives from real play; do not mistake a growing list of special-case action interceptors for the final RPG engine.
