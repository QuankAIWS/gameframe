---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 8
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
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cross-repository-integration-testing.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Roadmap

## Objective

Build one **campaign-agnostic GameFrame RPG Engine** that can materialize validated CampaignPackages into persistent playable 2D worlds, accept pluggable deterministic RPG Rulesets, and work with one Dungeon Master that remains a real referee/narrator while durable software owns identity, presence, observer knowledge, world state, mechanics, and recovery.

The player-facing hierarchy is **Games**. RPG campaigns live under **Role-Playing Games**. Standalone tactical scenarios live under **Battle Simulator**.

Monster Master proves one reusable game family across both surfaces without creating two combat engines:

- **Monster Master RPG** proves the complete embodied campaign experience using GameFrame RPG Engine + Monster Master Ruleset + CampaignPackage.
- **Monster Master Arena Battles** evolves inside Battle Simulator toward the same Monster Master Ruleset/tactical implementation using Battle Pack + BattleScenario setup instead of CampaignPackage lifecycle.

Campaign combat happens on the same materialized world map through **Tactical Activation**. It does not launch Battle Simulator or compile a substitute battlefield.

## Status rule

This shared roadmap controls cross-repository destination, milestone order, and exit gates.

Volatile implementation evidence remains local:

- GameFrame: `planning/ROADMAP.md`;
- RPG GM Runtime: `docs/project-status.md` and `docs/implementation-plan.md`.

Do not describe lower-level infrastructure as proof of a later player-experience milestone.

## Delivery mode decision — vertical playable evidence

The architecture/substrate phase has produced enough durable authority to change development mode.

Completed foundations now include:

- executable CampaignPackage v5 / Game Family / ruleset requirements;
- Entity Registry;
- Character Factory;
- Semantic Scene Registry;
- Observer Knowledge / People;
- authored WorldGraph/materialization intent;
- a strict viewer-authorized Runtime → GameFrame exploration projection with stable materialization identity/reconnect semantics.

From this point forward, the primary unit of progress is a **player journey**, not another generalized subsystem.

The first product target is one continuously playable Monster Master Crooked Checkpoint journey:

```text
Role-Playing Games
→ Monster Master RPG
→ materialize Crooked Checkpoint
→ walk around
→ see/interact with Pell, people, and objects
→ Ask Game Master / Do Something Else
→ change meaningful world state
→ travel to West Woods and return
→ enter same-map Tactical Mode
→ control the Master + ruleset-authorized monster(s)
→ finish combat
→ resume exploration on the same map
→ quit/reconnect
→ resume the same world
```

Development priority rule:

> Every substantive RPG PR should either advance this bounded journey or remove a demonstrated blocker to it.

Do not continue creating generalized architecture merely because a future system may need it. Add abstractions when the playable journey proves the requirement.

## Milestone 0 — Architecture/documentation/player-navigation alignment — complete

Accepted decisions:

- Campaign Architect and Dungeon Master remain the only campaign agents.
- GameFrame RPG Engine is internal reusable campaign-agnostic architecture, not a top-level player card.
- **Games** is the top-level player destination.
- **Role-Playing Games** is the generic campaign surface.
- **Battle Simulator** is the standalone tactical surface.
- RPG Ruleset is the reusable deterministic mechanic contract.
- Game Family is reusable rules/content identity shared by related campaign/simulator experiences.
- Battle Pack is future simulator-safe tactical content and never duplicates the family rules.
- campaign combat uses same-map Tactical Activation;
- semantic WorldGraph truth remains separate from GameFrame geometry/materialization;
- Observer Knowledge supports both player-safe projections and perspective-bounded entity performance;
- one shared active party scene is the initial multiplayer posture.

## Milestone 1 — Executable CampaignPackage and ruleset capability boundary — bounded foundation complete

Preserve:

- strict versioned CampaignPackage validation/hash/commitment/reload;
- player-safe/runtime-only separation;
- package provenance/migrations;
- initial entities/locations/WorldGraph/scenes/knowledge/events/objectives;
- ruleset/capability requirements rather than hidden Monster Master engine branches;
- semantic materialization/media intents with deterministic fallbacks.

The current Monster Master package is normalized/committed as package v5 and explicitly declares Monster Master game-family/ruleset capability requirements.

## Milestone 2 — Durable entity, scene, and observer-knowledge substrate — bounded foundation complete

Implemented foundations include:

- Entity Registry;
- deterministic/schema-first Character Factory;
- zero-or-more semantic Scene Registry states with one authoritative membership collection;
- semantic Observer Knowledge / People projections;
- descriptor → role → known-name identity progression;
- restart-safe reconstruction;
- atomic immediate-scene incidental creation + justified awareness;
- viewer-authorized exploration projection to GameFrame.

The Runtime → GameFrame projection is a read-side semantic port only. It deliberately does not own or transmit x/y movement, geometry, collision, pathfinding, camera state, or frame-by-frame movement authority.

## Milestone 3 — SEE: first physical GameFrame RPG scene — ACTIVE

Use Monster Master Crooked Checkpoint as the first concrete playable scene.

GameFrame consumes the accepted viewer-safe exploration projection and reuses the existing Pixi/RPG rendering foundation rather than creating another RPG renderer.

Implement:

- deterministic semantic-layout materialization for `scene.crooked-checkpoint`;
- persistent materialization ID/version/hash;
- playable Pixi geometry;
- road/checkpoint barrier/inspection shelter/maintenance shed/confiscation cart/drainage edge/westbound exit sufficient for package semantics;
- semantic object/entity anchors for the player, Pell, known objects, and future interactable entities;
- collision/picking/navigation primitives required by the first scene;
- deterministic placeholder/world-kit assets where final art is missing;
- exact reconnect to the same accepted materialization.

Do **not** block this milestone on final art or a generalized procedural world generator.

**Exit gate:** an authenticated player opens Monster Master RPG and sees the actual Crooked Checkpoint materialized from the S6 semantic projection; refresh/reconnect returns the same accepted physical place without rematerialization drift.

## Milestone 4 — MOVE: embodied realtime session

Extend GameFrame realtime/session state for high-frequency physical state, not campaign-journal traffic.

Required:

- player movement/facing;
- camera and collision behavior;
- valid local position recovery;
- nearby transforms only where needed;
- scene-scoped authorization;
- bounded reconnect/backpressure;
- no correctness dependency on a permanently connected socket;
- no frame-by-frame Runtime journal/provider calls.

Semantic scene transfers and meaningful world changes remain durable commands/commits.

**Exit gate:** the player can walk around Crooked Checkpoint responsively, refresh/reconnect, and resume a valid position without duplicate semantic presence or Runtime movement journaling.

## Milestone 5 — TALK: direct interaction, character performance, and real GM surfaces

Drive Dungeon Master context-mode work through the real materialized scene rather than implementing it in isolation.

Implement:

- targetable Interact/Talk;
- Dungeon Master referee/world context;
- perspective-bounded entity-performance context;
- Ask Game Master context/surface;
- Do Something Else freeform intent;
- aftermath/intervention context and bounded pause/freeze presentation;
- semantic origin/audience separation;
- durable important NPC memory/relationship consequences only as the chapter requires them.

Pell is the first hard correctness target.

Required custody canary:

```text
referee context contains hidden fact X
Pell does not know X
→ Pell performance context excludes X
→ Pell output cannot use X

commit legitimate knowledge of X to Pell
→ Pell context may now contain the authorized fact
```

This exclusion must happen during semantic context construction, not by filtering prose after omniscient context was assembled.

**Exit gate:** the player can walk up to Pell, interact with Pell through entity-performance custody, separately Ask the GM, and use Do Something Else without confusing character speech, referee authority, or deterministic mechanics.

## Milestone 6 — CHANGE + TRAVEL: meaningful world state and connected scene

Promote only concrete typed world operations required by the Crooked Checkpoint chapter.

Examples include:

- important object state/custody;
- knowledge reveal/correction;
- objective/event state;
- deterministic check request/result;
- relationship/memory consequence;
- semantic scene transfer.

Then materialize West Woods and prove:

- WorldGraph route semantics;
- current Scene Registry exit authority;
- source→destination semantic transfer;
- on-demand destination materialization;
- stable revisit;
- meaningful world/object/entity continuity across locations;
- return to the same Crooked Checkpoint materialization;
- event/check eligibility based on semantic state rather than scripted menu order.

Do not build a generalized RPG DSL before these concrete operations require one.

**Exit gate:** the player can make at least one meaningful persistent world change, travel Crooked Checkpoint ↔ West Woods through ordinary play, and return without world or materialization drift.

## Milestone 7 — FIGHT foundation: Tactical Mode, Monster Master Ruleset, and control authority

Reuse the useful existing GameFrame Pixi/tactical substrate rather than creating a second combat renderer.

Define/promote only what same-map campaign combat requires:

- generic GameFrame **Tactical Mode** over an existing materialized scene;
- **Tactical Activation** semantic boundary;
- Game Family/ruleset identity linkage;
- Monster Master Ruleset version/capability contract;
- principal → player-character/Master → controlled-entity authority;
- trainer/player-character tactical participation;
- class/ruleset-defined monster deployment/control counts;
- initiative/action economy/legal actions;
- tactical persistence/reconnect/replay where useful.

MM-0001 remains regression proof and the seed for Monster Master Arena Battles, not the campaign lifecycle.

**Exit gate:** the same Monster Master tactical rule implementation can operate over a standalone scenario and an already-materialized campaign scene without duplicated combat rules.

## Milestone 8 — FIGHT: same-map Monster Master campaign combat

At a real materialized campaign scene:

```text
exploration
→ tactical trigger
→ validate current scene/materialization/entities/control/resources
→ Tactical Activation
→ current positions become tactical starting positions
→ initiative / turn-based rules on current geometry
→ structured tactical consequences
→ semantic reconciliation
→ exploration resumes in place
```

Required direction:

- same map geometry/objects/exits remain authoritative;
- present persistent entities remain represented truthfully;
- escape/withdrawal/surrender/recall/incapacitation are explicit as implemented;
- noncombatants/support/protected/escaping roles are added only where the package proves the need;
- no replacement campaign battlefield;
- no campaign Return-to-Campaign navigation step.

**Exit gate:** initiative begins and ends on the existing physical scene, and post-combat exploration resumes on that same map with exact resulting state and reconnect safety.

## Milestone 9 — PROVE: complete single-player embodied Monster Master

Required journey:

```text
validated package
→ viewer-safe semantic projection
→ persistent Crooked Checkpoint materialization
→ realtime movement
→ direct Pell interaction
→ Pell perspective-bounded conversation
→ Ask-GM
→ Do Something Else
→ People/Observer Knowledge continuity
→ persistent world-state change
→ West Woods travel/revisit
→ event/check consequence
→ same-map Tactical Activation
→ Master + ruleset-authorized monster actions
→ structured tactical result
→ exploration resumes in place
→ bounded campaign resolution
→ service/browser restart + resume
```

Run human play first, then deterministic/machine-play, then live provider/staging proof.

**Exit gate:** one authenticated human completes the bounded engineering campaign without model-owned bookkeeping, secret leakage, duplicate entities, replacement battle maps, rematerialization drift, or developer intervention in ordinary execution.

## Milestone 10 — Two-human one-scene embodied campaign

After the single-player loop is proven, add:

- explicit join/party assignment;
- separate authenticated avatars/principals;
- public/party/player-private knowledge/presentation;
- realtime movement in one shared scene;
- direct interaction custody;
- group scene transitions;
- ruleset-defined cooperative tactical control;
- same-map Tactical Activation for both humans;
- reconnect/resume.

**Exit gate:** two humans complete the bounded campaign while remaining in one shared active scene at a time.

## Milestone 11 — Second handcrafted rules/content generality proof

Run a materially different handcrafted campaign/game family through the same:

- GameFrame RPG Engine;
- package/world/entity/scene/observer architecture;
- Dungeon Master context-mode architecture;
- materialization framework;
- compatible RPG Ruleset interface;
- Tactical Activation framework where combat exists.

If it requires a campaign-specific engine branch, repair the abstraction first.

**Exit gate:** two materially different campaigns work without separate campaign engines/control planes.

## Milestone 12 — Campaign Architect + dynamic Role-Playing Games + Battle Pack authoring

Only after the two handcrafted proofs, implement:

```text
idea / brief
→ compatible validated ruleset/profile + reusable game-family content
→ Campaign Architect draft CampaignPackage
→ optional owner refinement
→ validation/repair
→ player-safe preview
→ explicit commitment
→ ordinary play through the same engine
```

For combat-capable families, emit a simulator-safe Battle Pack referencing the same rules/content/assets without exposing forbidden campaign secrets or duplicating combat rules.

## Milestone 13 — Dynamic Battle Simulator and Monster Master convergence

Evolve Monster Master Arena Battles inside the generic Battle Simulator:

- Battle Pack discovery/selection;
- character/class/loadout and opponent/team setup;
- map selection/generation;
- BattleScenario objectives/deployment;
- humans/BattleBot;
- replay/rematch/analysis;
- exposure/unlock enforcement;
- imported/generated Battle Packs.

Matching Monster Master ruleset/profile versions must produce equivalent tactical semantics in campaign Tactical Mode and Battle Simulator.

## Milestone 14 — Split-party / simultaneous multi-scene play

Only after one-scene multiplayer is trustworthy, productize simultaneous active scenes with player-specific scene assignment/subscriptions, scene-local knowledge/audibility, independent recovery/materialization, cross-scene communication, and explicit global/tactical time semantics.

## Milestone 15 — Rich media, authoring, and multi-session systems

Promote only systems proven useful by real campaigns, including richer authoring, richer world-kit/generated asset coverage, semantic cinematics, progression/rest/inventory/equipment/injury/care, recurring objectives/factions/relationships, campaign inspection/correction, backups/restore/export/retention, and provider/storage/deployment observability.

## Explicitly deferred while the first playable loop is incomplete

Do not prioritize:

- Campaign Architect implementation;
- generated RPG productization;
- Battle Pack generation/dynamic Battle Simulator expansion;
- split-party concurrency;
- unrestricted procedural/open-world generation;
- generalized RPG DSLs;
- large final-art production;
- elaborate autonomous NPC-memory systems;
- Cloudflare-native semantic state migration;
- Theo integration;
- deeper legacy separate-match campaign features.

## Deployment sequencing

Initial production remains GameFrame and RPG GM Runtime as separate services on one VM behind Cloudflare, with player-facing GameFrame public and runtime/data/admin surfaces private.

Realtime embodied movement may use the existing Worker → Tunnel → VM WebSocket path while semantic commands/recovery remain durable and independently recoverable.

Do not move frame-by-frame campaign state into RPG GM Runtime or add Cloudflare state authorities merely because embodied play exists.

## Validation policy

Use the evidence layer matching the claim:

- schema/unit tests for package/ruleset/entity/scene/knowledge invariants;
- materialization/geometry tests for world correctness;
- browser tests for SEE/MOVE/TALK/TRAVEL/FIGHT player journeys;
- deterministic/mock-provider tests for Dungeon Master context custody;
- actual cross-repository services for semantic/materialization integration truth;
- deterministic tactical tests for shared rules;
- campaign-versus-simulator equivalence tests later;
- VM/Cloudflare canaries for deployed realtime/recovery;
- separate media-provider tests for generation claims.

Prefer one end-to-end vertical acceptance path plus narrow authority tests over many disconnected low-level proofs.

## Immediate priority rule

Current cross-repository order is:

1. preserve staging; repair legacy separate-match defects only when they block the new journey;
2. **SEE — materialize Crooked Checkpoint in GameFrame from the completed semantic exploration port**;
3. **MOVE — realtime movement/collision/camera/reconnect without Runtime movement journaling**;
4. **TALK — Dungeon Master context modes driven through Pell + Interact + Ask-GM + Do Something Else**;
5. **CHANGE/TRAVEL — concrete world operations + Crooked Checkpoint ↔ West Woods persistent transfer/revisit**;
6. **FIGHT foundation — Monster Master Ruleset/control authority + Tactical Activation over the current scene**;
7. **FIGHT — complete same-map tactical campaign transition and exploration resume**;
8. **PROVE — complete one-human Crooked Checkpoint engineering campaign, restart/resume, machine-play, live provider, staging**;
9. two-human one-scene campaign;
10. second handcrafted campaign/game family;
11. Campaign Architect + dynamic Role-Playing Games + Battle Pack authoring;
12. dynamic Battle Simulator + Monster Master convergence;
13. split-party multi-scene;
14. richer media/multi-session systems.

The static Games / Role-Playing Games / Battle Simulator navigation can exist before dynamic productization; it should not distract from completing the first playable RPG loop.

## Governing rule

> The graphics visualize the imagination; they do not define its boundaries. Build one truthful playable journey first, derive abstractions from the requirements that journey exposes, and keep Runtime as semantic campaign authority while GameFrame owns the physical playable world and deterministic control state.
