---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 7
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

The player-facing GameFrame hierarchy is **Games**. RPG campaigns live under **Role-Playing Games**. Standalone tactical scenarios live under **Battle Simulator**. Direct standalone games such as Clockwork Checkers, Othello, and Tic-Tac-Toe may remain top-level Games entries.

Monster Master proves one reusable game family across two surfaces without creating two combat engines:

- **Monster Master RPG** proves the complete embodied campaign experience using GameFrame RPG Engine + Monster Master Ruleset + CampaignPackage.
- **Monster Master Arena Battles** evolves inside Battle Simulator toward the same Monster Master Ruleset/tactical implementation using Battle Pack + BattleScenario setup instead of CampaignPackage lifecycle.

Campaign combat happens on the same materialized world map through **Tactical Activation**. It does not launch Battle Simulator or compile a substitute battlefield.

## Status rule

This shared roadmap controls cross-repository destination, milestone order, and exit gates.

Volatile implementation evidence remains local:

- GameFrame: `planning/ROADMAP.md`;
- RPG GM Runtime: `docs/project-status.md` and `docs/implementation-plan.md`.

Do not describe lower-level infrastructure as proof of a later player-experience milestone.

## Milestone 0 — Architecture/documentation/player-navigation alignment

Required decisions:

- Campaign Architect and Dungeon Master remain the only campaign agents.
- GameFrame RPG Engine is internal reusable campaign-agnostic player/mechanics/world architecture, not a top-level game card.
- the top-level player destination is **Games**;
- the player-facing generic campaign surface is **Role-Playing Games**;
- the player-facing standalone tactical surface is **Battle Simulator**;
- RPG Ruleset is the reusable game-specific deterministic mechanic contract;
- Game Family is reusable rules/content identity shared by related campaign/simulator experiences;
- Battle Pack is the future simulator-safe tactical content artifact and never duplicates an RPG's rules;
- Monster Master RPG and Monster Master Arena Battles use shared Monster Master rules rather than separate tactical semantics;
- Campaign combat uses same-map Tactical Activation;
- semantic WorldGraph/location truth remains separate from GameFrame geometry/materialization;
- observer knowledge supports both player-safe projections and perspective-bounded entity performance;
- one shared active party scene is the initial multiplayer product posture; zero-or-more semantic scenes remain architectural capability.

Current UI may expose static/stub Role-Playing Games and Battle Simulator menus before dynamic package discovery exists.

**Exit gate:** canonical/mirrored docs, local roadmaps, interface contracts, GameFrame Games navigation, and Monster Master tactical direction agree on this model.

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

## Milestone 7 — GameFrame tactical mode, Monster Master Ruleset extraction, and game-family boundary

Preserve the useful current MM-0001 tactical substrate while extracting/promoting reusable semantics.

Define:

- generic GameFrame **Tactical Mode** over an existing materialized scene;
- **Tactical Activation** boundary;
- generic Game Family identity/capability linkage;
- Monster Master Ruleset version/capability contract;
- principal → player-character → controlled-entity authority;
- trainer/player-character tactical participation;
- class/ruleset-defined monster deployment/control counts;
- initiative/action economy/legal actions;
- tactical persistence/reconnect/replay evidence where useful.

MM-0001 remains a regression proof and the seed for Monster Master Arena Battles, not the campaign lifecycle.

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

Run a materially different handcrafted campaign/game family through:

- same GameFrame RPG Engine;
- same package/world/entity/scene/observer-knowledge architecture;
- same Dungeon Master context-mode architecture;
- same materialization framework;
- a compatible existing or deliberately added RPG Ruleset interface;
- same tactical activation framework where combat exists.

If it requires a campaign-specific engine branch, repair the abstraction first.

**Exit gate:** two materially different campaigns work without separate campaign engines/control planes, and the game-family/ruleset boundary is credible outside Monster Master.

## Milestone 12 — Campaign Architect + Role-Playing Games product + Battle Pack authoring contract

Implement the future **Role-Playing Games** campaign home and Campaign Architect workflow:

```text
idea / brief
→ identify/select/create compatible validated ruleset profile + game-family content as needed
→ Campaign Architect draft CampaignPackage
→ optional owner refinement
→ validation/repair
→ player-safe preview
→ explicit commitment
→ world materialization
→ ordinary play through the same engine
```

For combat-capable families, define and validate the **Battle Pack** authoring/export contract at the same boundary. Battle Pack material references the same ruleset/game-family content and exposes only simulator-safe material.

Battle Pack authoring requirements include:

- stable game-family/ruleset/profile/version linkage;
- playable templates/opponents/loadouts appropriate for standalone use;
- reusable map themes/world kits/materialization constraints;
- objectives/deployment/bot profiles/presets;
- asset references/provenance;
- spoiler-safe exposure/unlock policy;
- no duplicated combat rules.

Player-facing Role-Playing Games surfaces may include:

- available RPGs;
- Create RPG;
- My Campaigns;
- Import Campaign;
- draft review/refinement;
- explicit amendment/version/migration tools later.

**Exit gate:** a generated original campaign uses the same engine/runtime/ruleset boundaries without campaign-specific Dungeon Master or GameFrame control-plane code, and a combat-capable generated family can emit a valid simulator-safe Battle Pack without exposing forbidden campaign secrets.

## Milestone 13 — Battle Simulator dynamic packs and Monster Master convergence

Evolve the existing standalone Monster Master tactical game into **Monster Master Arena Battles**, an entry inside the generic **Battle Simulator** surface.

Implement Battle Simulator support for:

- Battle Pack discovery/selection;
- character/class/loadout builder;
- creature/opponent/team setup;
- map selection;
- generated standalone maps through GameFrame materialization;
- BattleScenario contract;
- objectives/deployment options;
- humans/bots;
- replay/rematch/analysis;
- exposure/unlock enforcement;
- imported/generated game-family Battle Packs.

Convergence requirement:

- use the same Monster Master Ruleset/tactical action semantics as Monster Master RPG where versions/capabilities match;
- do not create simulator-only combat rules that drift from the RPG;
- standalone setup convenience may differ from campaign lifecycle;
- generated game families should become selectable in Battle Simulator from their validated Battle Packs rather than through bespoke UI code.

**Exit gate:** equivalent ruleset profiles produce equivalent legal actions/outcomes in campaign tactical mode and Battle Simulator, and at least one non-Monster-Master Battle Pack can be discovered/rendered without changing the simulator control plane.

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
- richer generated game-family/ruleset tooling;
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

- schema/unit tests for package/ruleset/game-family/Battle-Pack/entity/scene/knowledge invariants;
- materialization/geometry tests for world correctness;
- machine-play for Dungeon Master/context custody;
- actual cross-repository services for integration truth;
- deterministic tactical tests for shared rules;
- campaign-versus-simulator equivalence tests for matching ruleset profiles;
- browser tests for embodied interaction and same-map tactical transitions;
- Battle Simulator browser tests for dynamic pack/setup flows;
- VM/Cloudflare canaries for deployed realtime/recovery;
- separate media-provider tests for generation claims.

Do not claim campaign correctness from transport tests or Battle Simulator correctness from one campaign-specific scripted fixture.

## Immediate priority rule

Current priority is:

1. preserve staging and repair existing authoritative post-combat/resume defects that block development;
2. Entity Registry → Character Factory → Scene Registry → Observer Knowledge;
3. Crooked Checkpoint materialization and exploration;
4. embodied realtime session;
5. Pell direct interaction + Ask-GM + Do Something Else + GM intervention;
6. second connected scene / alternate route;
7. generic Tactical Mode + Monster Master Ruleset/control authority + game-family boundary;
8. same-map tactical Monster Master campaign proof;
9. complete single-player embodied campaign;
10. two-human one-scene campaign;
11. second handcrafted campaign/game family;
12. Campaign Architect + dynamic Role-Playing Games product + Battle Pack authoring contract;
13. Battle Simulator dynamic Battle Packs + Monster Master convergence;
14. split-party multi-scene;
15. richer media/multi-session systems.

The static Games / Role-Playing Games / Battle Simulator navigation can exist before milestones 12–13; those milestones implement dynamic data-driven behavior behind the already-correct information architecture.

## Governing rule

> Build the generic RPG engine underneath reusable game families. Role-Playing Games runs durable campaigns, Battle Simulator runs standalone scenarios through Battle Packs, and when a family appears in both surfaces it shares one ruleset and reusable content foundation while campaign combat itself remains on the current world map.
