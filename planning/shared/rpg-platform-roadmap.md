---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GameFrame RPG
  - Monster Master RPG
  - Monster Master Battle Arena
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 6
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

Monster Master proves two related products without creating two combat engines:

- **Monster Master RPG** proves the complete embodied campaign experience using GameFrame RPG Engine + Monster Master Ruleset + CampaignPackage.
- **Monster Master Battle Arena** evolves the standalone tactical product toward the same Monster Master Ruleset and tactical implementation using standalone BattleScenario setup instead of CampaignPackage lifecycle.

Campaign combat happens on the same materialized world map through **Tactical Activation**. It does not launch the Battle Arena product or compile a substitute battlefield.

## Status rule

This shared roadmap controls cross-repository destination, milestone order, and exit gates.

Volatile implementation evidence remains local:

- GameFrame: `planning/ROADMAP.md`;
- RPG GM Runtime: `docs/project-status.md` and `docs/implementation-plan.md`.

Do not describe lower-level infrastructure as proof of a later player-experience milestone.

## Milestone 0 — Architecture/documentation alignment

Required decisions:

- Campaign Architect and Dungeon Master remain the only campaign agents.
- GameFrame RPG Engine is the reusable campaign-agnostic player/mechanics/world layer.
- RPG Ruleset is the reusable game-specific deterministic mechanic contract.
- Monster Master RPG and Monster Master Battle Arena are products using shared Monster Master rules rather than separate tactical semantics.
- Campaign combat uses same-map Tactical Activation.
- semantic WorldGraph/location truth remains separate from GameFrame geometry/materialization.
- observer knowledge supports both player-safe projections and perspective-bounded entity performance.
- one shared active party scene is the initial multiplayer product posture; zero-or-more semantic scenes remain architectural capability.

**Exit gate:** canonical/mirrored docs, local roadmaps, interface contracts, and Monster Master tactical direction agree on this model.

## Milestone 1 — Executable CampaignPackage and ruleset capability boundary

Preserve/complete:

- strict versioned CampaignPackage validation/hash/commitment/reload;
- player-safe/runtime-only separation;
- package provenance/migrations;
- initial entities/locations/WorldGraph/scenes/knowledge/events/objectives;
- ruleset/capability requirements rather than campaign-specific engine code;
- semantic materialization/media intents with deterministic fallbacks.

Add the generic **RPG Ruleset capability boundary** required to keep Monster Master mechanics out of campaign-agnostic engine control flow.

**Exit gate:** the handcrafted Monster Master package initializes through the generic engine/runtime contracts and explicitly requests Monster Master Ruleset capabilities rather than relying on hidden Monster Master-only branches.

## Milestone 2 — Durable entity, scene, and observer-knowledge substrate

Implement:

- Entity Registry;
- deterministic/schema-first Character Factory;
- zero-or-more semantic Scene Registry states with one authoritative presence collection;
- semantic Observer Knowledge / player People projections;
- descriptor → role → known-name identity progression;
- observer/NPC beliefs/memories needed for perspective custody;
- restart-safe reconstruction;
- typed scene enter/leave/transfer/object semantics.

**Exit gate:** one incidental person can be created/admitted/revisited durably; two observers can validly know different facts about the same entity; physical scene membership remains exact across restart.

## Milestone 3 — First GameFrame RPG world materialization

Use Monster Master Crooked Checkpoint as the first concrete proving scene.

GameFrame must provide:

- persistent materialization identity/version;
- playable Pixi geometry;
- collision/pathing/picking;
- semantic object/entity anchors;
- player avatar and world entities;
- transition/exit zones;
- deterministic placeholder/world-kit assets where final art is missing;
- reconnect/revisit without regenerating a different place.

Runtime provides semantic location/world truth, not pixel geometry.

**Exit gate:** the player can load, move through, leave, and revisit Crooked Checkpoint as the same durable location.

## Milestone 4 — Embodied realtime session

Extend GameFrame realtime transport for high-frequency **session state**, not campaign journal traffic.

Required:

- player movement/facing;
- nearby-player/entity transform projection as needed;
- scene-scoped authorization;
- reconnect/recovery from durable materialization + semantic presence;
- bounded heartbeats/reconnect/backpressure;
- no correctness dependency on permanently connected sockets.

Semantic scene transfers and meaningful world changes remain durable commands/commits.

**Exit gate:** ordinary walking is responsive and restart/reconnect does not create duplicate presence or make frame-by-frame movement campaign authority.

## Milestone 5 — Direct interaction, character performance, and real GM surfaces

Implement:

- targetable Interact/Talk;
- Dungeon Master entity-performance context mode;
- perspective-bounded observer knowledge;
- durable important NPC memory/relationship consequences;
- Ask Game Master communication/log;
- Do Something Else freeform intent;
- GM intervention presentation including bounded world freeze/cinematic pause;
- semantic origin/audience separation.

Pell is the first correctness target.

**Exit gate:** a hidden fact available to referee context is structurally absent from Pell performance context when Pell does not know it, while the player can separately ask the GM about authorized character knowledge.

## Milestone 6 — Connected world / second persistent exploration scene

Materialize a second connected Monster Master location such as West Woods and prove:

- WorldGraph route semantics;
- party-cohesion scene transfer;
- alternate approach chosen through ordinary/freeform play;
- on-demand scene materialization;
- stable revisit;
- world/object/entity state persisting across location changes;
- event/check eligibility based on semantic world state rather than menu choices.

**Exit gate:** players can choose a plausible route not represented as a scripted scene-order button, explore it, and return without world drift.

## Milestone 7 — GameFrame tactical mode and Monster Master Ruleset extraction

Preserve the useful current MM-0001 tactical substrate while extracting/promoting reusable semantics.

Define:

- generic GameFrame **Tactical Mode** over an existing materialized scene;
- **Tactical Activation** boundary;
- Monster Master Ruleset version/capability contract;
- principal → player-character → controlled-entity authority;
- trainer/player-character tactical participation;
- class/ruleset-defined monster deployment/control counts;
- initiative/action economy/legal actions;
- tactical persistence/reconnect/replay evidence where useful.

MM-0001 remains a regression proof, not the campaign lifecycle.

**Exit gate:** the same Monster Master tactical rule implementation can be exercised by a standalone scenario and by a current world scene without duplicating combat rules.

## Milestone 8 — Same-map Monster Master campaign combat

At Crooked Checkpoint or another real materialized campaign scene:

```text
exploration
→ tactical trigger
→ validate current scene/materialization/entities/control/resources
→ Tactical Activation
→ initiative / turn-based rules on current map
→ structured tactical consequences
→ semantic reconciliation
→ exploration resumes in place
```

Required direction:

- current positions are starting positions;
- same map geometry/objects/exits remain authoritative;
- present persistent entities are represented truthfully;
- escape/withdrawal/surrender/recall/incapacitation are explicit as implemented;
- noncombatants/support/protected/escaping roles are added as package needs prove them;
- no campaign Return-to-Campaign navigation step exists.

**Exit gate:** initiative begins and ends without loading a replacement battlefield, and post-combat exploration resumes on the same map with exact resulting state.

## Milestone 9 — Complete single-player embodied Monster Master proof

Required journey:

```text
validated package
→ persistent exploration scene
→ direct movement/interaction
→ Pell perspective-bounded conversation
→ Ask-GM
→ Do Something Else
→ People/observer knowledge continuity
→ second connected scene / alternate route
→ event/check/world consequence
→ same-map Tactical Activation
→ player-character + controlled monster actions
→ structured tactical result
→ exploration resumes in place
→ bounded campaign resolution
→ service/browser restart + resume
```

**Exit gate:** one authenticated human completes the bounded engineering campaign without model-owned bookkeeping, secret leakage, duplicate entities, replacement battle maps, or developer intervention in ordinary execution.

## Milestone 10 — Two-human one-scene embodied campaign

Add/prove:

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

Run a materially different handcrafted campaign through:

- same GameFrame RPG Engine;
- same package/world/entity/scene/observer-knowledge architecture;
- same Dungeon Master context-mode architecture;
- same materialization framework;
- a compatible existing or deliberately added RPG Ruleset interface;
- same tactical activation framework where combat exists.

If it requires a campaign-specific engine branch, repair the abstraction first.

**Exit gate:** two materially different campaigns work without separate campaign engines/control planes.

## Milestone 12 — Campaign Architect and GameFrame RPG generic player product

Implement future **GameFrame RPG** campaign home and Campaign Architect workflow:

```text
idea / brief
→ Campaign Architect draft CampaignPackage
→ optional owner refinement
→ validation/repair
→ player-safe preview
→ explicit commitment
→ world materialization
→ ordinary play through the same engine
```

Player-facing generic surfaces may include:

- Create Campaign;
- My Campaigns;
- Import Campaign;
- draft review/refinement;
- explicit amendment/version/migration tools later.

**Exit gate:** a generated original campaign uses the same engine/runtime/ruleset boundaries without campaign-specific Dungeon Master or GameFrame control-plane code.

## Milestone 13 — Monster Master Battle Arena convergence

Evolve the existing standalone Monster Master tactical game into the library product **Monster Master Battle Arena**.

Add as useful:

- character/class/loadout builder;
- monster/team setup;
- map selection;
- generated standalone maps through GameFrame materialization;
- BattleScenario contract;
- objectives/deployment options;
- humans/bots;
- replay/rematch/analysis.

Convergence requirement:

- use the same Monster Master Ruleset/tactical action semantics as Monster Master RPG where versions/capabilities match;
- do not create Battle-Arena-only combat rules that drift from the RPG;
- standalone setup convenience may differ from campaign lifecycle.

**Exit gate:** equivalent ruleset profiles produce equivalent legal actions/outcomes in campaign tactical mode and standalone Battle Arena.

## Milestone 14 — Split-party / simultaneous multi-scene play

Only after one-scene multiplayer is trustworthy, productize simultaneous active scenes.

Required semantics include:

- per-player scene assignment;
- independent realtime scene subscriptions;
- scene-local observation/audibility;
- observer-knowledge divergence;
- concurrent Dungeon Master/entity-performance work;
- party/global time/event/pressure rules;
- cross-scene communication;
- independent recovery/materialization;
- rules for one scene entering tactical mode while another remains in exploration;
- safe handling of overlapping global consequences.

**Exit gate:** split-party play remains one coherent campaign without knowledge leakage, causality corruption, duplicate world operations, or tactical/global-clock ambiguity.

## Milestone 15 — Rich media, authoring, and multi-session systems

Promote only systems proven useful by real campaigns:

- richer campaign-authoring interviews/sheets;
- world-kit and generated asset coverage;
- semantic cinematic scripts;
- progression/rest/inventory/equipment/injury/care;
- recurring quests/factions/relationships;
- campaign inspection/correction;
- exports/backups/restore/retention/deletion;
- provider/storage/tunnel/service observability;
- cost/latency/continuity/failure metrics;
- Theo as an ordinary GameFrame player;
- staged production rollout/rollback.

## Deployment sequencing

Initial production remains GameFrame and RPG GM Runtime as separate services on one VM behind Cloudflare, with player-facing GameFrame public and runtime/data/admin surfaces private.

Realtime embodied movement may use the existing Worker → Tunnel → VM WebSocket path while semantic commands/recovery remain durable and independently recoverable.

Do not move frame-by-frame campaign state into RPG GM Runtime or add Cloudflare state authorities merely because embodied play exists.

## Validation policy

Use the evidence layer matching the claim:

- schema/unit tests for package/ruleset/entity/scene/knowledge invariants;
- materialization/geometry tests for world correctness;
- machine-play for Dungeon Master/context custody;
- actual cross-repository services for integration truth;
- deterministic tactical tests for Monster Master rules;
- browser tests for embodied interaction and same-map tactical transitions;
- VM/Cloudflare canaries for deployed realtime/recovery;
- separate media-provider tests for generation claims.

Do not claim campaign correctness from transport tests or standalone Battle Arena correctness from one campaign-specific scripted fixture.

## Immediate priority rule

Current priority is:

1. preserve staging and repair existing authoritative post-combat/resume defects that block development;
2. Entity Registry → Character Factory → Scene Registry → Observer Knowledge;
3. Crooked Checkpoint materialization and exploration;
4. embodied realtime session;
5. Pell direct interaction + Ask-GM + Do Something Else + GM intervention;
6. second connected scene / alternate route;
7. generic Tactical Mode + Monster Master Ruleset/control authority;
8. same-map tactical Monster Master campaign proof;
9. complete single-player embodied campaign;
10. two-human one-scene campaign;
11. second handcrafted campaign;
12. Campaign Architect + generic GameFrame RPG product;
13. Battle Arena convergence/richer standalone tooling;
14. split-party multi-scene;
15. richer media/multi-session systems.

## Governing rule

> Build the generic RPG engine underneath the bespoke game: GameFrame RPG Engine materializes durable semantic worlds, rulesets define deterministic game behavior, the Dungeon Master handles imagination/refereeing, and tactical combat changes the rules of the current scene rather than replacing the world with another one.
