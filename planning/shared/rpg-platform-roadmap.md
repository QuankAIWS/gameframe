---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 5
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

Build a reusable RPG platform in which a Campaign Architect can create bespoke semantic CampaignPackages, GameFrame can materialize those packages into persistent playable 2D worlds, and one Dungeon Master can referee any validated campaign while durable runtime state—not model memory—owns entity identity, physical presence, observer knowledge, world continuity, and mechanic/tactical consequences.

The mature ordinary loop is embodied exploration and direct interaction, not a transcript describing every movement. Freeform intent remains a first-class escape hatch for plausible actions the fixed UI does not model. The Dungeon Master remains a real player-facing GM for adjudication, rules/knowledge questions, dramatic interventions, unusual actions, and perspective-bounded NPC portrayal.

The first proof is a handcrafted Monster Master CampaignPackage. The next generality proof is a materially different handcrafted package through the same world/entity/scene/knowledge/exploration/Dungeon-Master/GameFrame abstractions. Campaign Architect generation follows only after those abstractions survive real handcrafted campaigns.

## Status rule

This shared roadmap defines cross-repository destination, milestone order, and exit gates. Volatile implementation evidence belongs in repository-local ledgers:

- GameFrame: `planning/ROADMAP.md`;
- RPG GM Runtime: `docs/project-status.md` and `docs/implementation-plan.md`.

Lower-level substrate does not satisfy a later milestone until that milestone's exit gate is actually exercised.

## Milestone 0 — Architecture and documentation baseline

- Keep Campaign Architect and Dungeon Master as the only campaign agents.
- Keep CampaignPackage as the durable pre-play handoff.
- Treat Entity Registry, Character Factory, Scene Registry, semantic knowledge, Context Compiler, exploration/world materialization adapters, and Encounter Scene Compiler as substrate rather than additional agents.
- Establish `rpg-embodied-exploration-and-character-performance-contract.md` as the controlling specialist contract for embodied world play, character-performance custody, realtime spatial state, and single-scene/multi-scene posture.
- Retire campaign compiler, plot agent, and intro agent as compatibility surfaces.
- Keep Monster Master as the handcrafted gold standard.
- Keep shared documents canonical in GameFrame and mirrored byte-for-byte into runtime.

**Exit gate:** documentation indexes, roadmaps, architecture documents, specialist contracts, and repository boundaries agree that the mature product is an embodied persistent RPG with GM/freeform escape hatches rather than a transcript-first campaign shell.

## Milestone 1 — Executable CampaignPackage contract

Required runtime work:

- strict versioned package schema and bounded validation;
- visibility scopes;
- package hash and provenance;
- persistence, reload, migration posture, and immutable commitment;
- player-safe projection separated from runtime-only truth;
- initial actors, locations, scene membership, clue graph, event definitions, mechanics, and resolution material sufficient for executable play;
- semantic world/location data sufficient to bootstrap later exploration materialization without embedding GameFrame geometry.

Required GameFrame work:

- capability declaration supplied to package validation;
- player-safe package preview primitives;
- deterministic presentation fallbacks.

**Exit gate:** the handcrafted Monster Master package validates, commits, reloads, and projects without semantic loss or secret leakage.

## Milestone 2 — Handcrafted Monster Master gold-standard package

The package must contain:

- campaign bible and operating rules;
- player roles and group cohesion;
- actual opening situation;
- fixed hidden truth;
- concrete important actors and locations;
- initial scene state;
- semantic location/world relationships for the reference slice;
- clue/evidence graph;
- event eligibility and pressure material;
- multiple credible approaches, including at least one route not represented as a mandatory menu choice;
- checks and tactical opportunities;
- complete resolution conditions;
- optional continuation seed;
- semantic asset/materialization manifest and deterministic fallbacks.

Additional plot families remain future packages or templates rather than being treated as one giant executable campaign.

**Exit gate:** the package can be committed without a model or media provider and contains enough exact state to initialize the runtime world and later materialize the reference exploration locations.

## Milestone 3 — Durable entity, scene, and observer-knowledge substrate

Before expecting model quality or visuals to cover continuity gaps, make exact campaign facts first-class runtime state.

Required runtime work:

- stable Entity Registry for package actors, trainers, monsters, promoted incidental NPCs, and materially relevant entities;
- deterministic/schema-first Character Factory for incidental NPC requests;
- Scene Registry with explicit enter/leave/current-presence semantics and zero-or-more active scenes;
- durable scene-relevant objects, creatures, hazards, exits, and local continuity;
- sparse semantic knowledge capable of representing player and relevant NPC/entity observers;
- viewer-specific player knowledge and Known People projections;
- canonical-name versus player-known-name separation;
- package-authored and incidental entity promotion rules;
- restart-safe reconstruction from committed journal state.

Required GameFrame work:

- player-safe People/Characters view primitives;
- viewer-safe identity labels and entity inspection;
- current scene/participant presentation where useful.

**Exit gate:** scripted play can create an incidental person, revisit that same person, move entities between scenes, and show different valid identity/knowledge projections to different observers/viewers without relying on model recollection.

## Milestone 4 — Embodied exploration foundation

Build the first actual campaign-world exploration surface in GameFrame.

Required shared contracts:

- semantic world graph/location identity;
- exploration-scene specification/materialization identity;
- separation of runtime semantic world truth from GameFrame playable geometry;
- separation of durable semantic movement from ephemeral avatar transforms;
- scene-transition semantics;
- text/fallback representation when enhanced world rendering is unavailable.

Required GameFrame work:

- Pixi exploration scene shell;
- authenticated player avatar;
- movement, facing, camera, collision/picking, interaction range, and scene-local presentation;
- stable semantic anchors for entities, exits, and interactables;
- accepted/reproducible materialization identity;
- realtime movement projection that does not journal every frame;
- reconnect/recovery from durable/materialized authority.

Required runtime work:

- supply semantic current-scene/location/world truth;
- validate meaningful scene transfers and world changes;
- never treat browser coordinates as campaign authority.

**First reference target:** Crooked Checkpoint becomes a real explorable Monster Master scene with Pell and at least one meaningful object/exit.

**Exit gate:** one authenticated player can walk a materialized scene, approach a durable entity/object, reconnect, and recover the same semantic/materialized world without using freeform text for ordinary movement.

## Milestone 5 — Direct character performance, Ask-GM, and freeform escape hatch

### Perspective-bounded entity performance

The Dungeon Master portrays a targeted NPC/entity using entity-scoped context:

- only justified knowledge/beliefs/memories;
- current observations;
- relevant goals/relationships;
- bounded conversation context;
- package constraints required for correct portrayal.

Unrelated hidden truth must be absent from the character-performance input.

### Ask Game Master

Retain a distinct player-to-GM communication channel for rules, character knowledge, and clarification. It is out-of-fiction and player-private by default unless an explicit broader audience is requested.

### Do Something Else

Retain freeform player intent as a first-class action for plausible unsupported behavior. The graphical world does not define the limits of imagination.

### GM intervention

Support explicit GM-origin intervention/narration events, including a bounded dramatic presentation that may pause/freeze local exploration input without making presentation itself world authority.

**Exit gate:** the player can talk directly to Pell, Pell demonstrably lacks a hidden fact Pell should not know, the player can ask the GM a separate private question, and one unsupported plausible freeform action is adjudicated into validated world state.

## Milestone 6 — Connected scene materialization and party-cohesion transitions

Add a second connected exploration scene for the reference campaign.

Required work:

- semantic world adjacency/route truth;
- destination materialization on demand or from prepared content;
- deterministic party transition operation;
- stable revisit/materialization identity;
- relevant scene/object/entity persistence;
- first party-cohesion transition rule.

The first multiplayer-ready posture keeps the active party in **one shared exploration scene at a time**. A transition may require all relevant active party members to gather in the exit/transition area before transfer.

Architectural support for zero-or-more scenes remains intact; split-party productization is deliberately deferred.

**Reference target:** the player can choose a credible alternate Crooked Checkpoint route such as the woods, transition into a second scene, and later revisit a previously materialized scene without regenerating a different replacement.

**Exit gate:** at least two connected locations behave as one durable world, including restart/revisit.

## Milestone 7 — Secure package-aware Dungeon Master and typed world operations

Complete the production hidden-decision/safe-render and context-mode architecture over the embodied world substrate.

Required referee flow:

```text
semantic trigger
→ typed hidden context from package + current world/scene/knowledge
→ semantic decision without player-facing prose
→ deterministic validation/materialization
→ durable semantic commitment
→ authorized revelations/consequences
→ audience-specific safe world context
→ player-facing renderer/intervention
```

Required character-performance flow:

```text
target entity + interaction
→ entity-scoped knowledge/memory/observation context
→ bounded performance proposal
→ deterministic validation of consequential effects
→ durable semantic commit where required
→ viewer-safe dialogue/presentation
```

Promote typed operations for:

- identity/knowledge reveal/correction;
- entity creation/promotion;
- scene presence/transfer;
- relationship/NPC memory;
- objective update;
- event selection/use;
- world-object state;
- noncombat check request;
- encounter request.

**Exit gate:** hidden secrets remain absent from player-safe and character-scoped contexts unless authorized, while unexpected actions can still change the durable embodied world through validated semantics.

## Milestone 8 — Checks, executable events, and world-reactive campaign play

Implement only mechanics required by the gold-standard campaign.

- deterministic noncombat check authority;
- clue discovery and confidence state;
- executable event eligibility/cooldown/use predicates;
- scene/location-aware event selection;
- typed world-object and objective consequences;
- restart-safe bounded semantic repair;
- event/check behavior that can react to alternate routes rather than assuming one scene order.

**Exit gate:** Monster Master can progress, branch, avoid, or trigger relevant events/checks while players physically move through the reference world, without model-owned state-machine behavior.

## Milestone 9 — Scene-faithful tactical handoff and embodied return

Arena Battles becomes a stricter deterministic mode for the current embodied scene.

Required direction:

- encounter request derives from authoritative current scene;
- exact campaign entity IDs survive scene → GameFrame → terminal outcome → runtime aftermath;
- trainers participate when their deterministic tactical profiles are implemented;
- campaign-required allies, hostiles, neutrals, noncombatants, protected entities, or escaping entities are represented truthfully or launch fails closed;
- materially relevant scene objects/exits/objectives survive the handoff;
- asymmetric scenes are supported when implemented rather than reshaped into fake symmetric duels;
- withdrawal, escape, surrender, recall, and incapacitation are distinct structured outcomes;
- GameFrame remains sole tactical authority;
- post-encounter reconciliation updates the surrounding exploration scene/materialization before control resumes.

MM-0001 remains the fixed standalone Monster Master duel.

**Exit gate:** Crooked Checkpoint can enter Arena Battles from actual embodied scene truth and return to the same exploration world with committed participant/object/world consequences visible and ordinary control restored.

## Milestone 10A — Complete single-player embodied Monster Master proof

Prove one authenticated human through the complete production-shaped journey:

- package-first startup;
- durable entity/scene/observer-knowledge state;
- materialized Crooked Checkpoint exploration;
- movement/inspection/direct interaction;
- perspective-bounded Pell conversation;
- Ask-GM;
- Do Something Else unsupported-action adjudication;
- second connected scene/alternate route;
- revisit persistence;
- executable event/check progression;
- scene-faithful actual Arena match when justified;
- exact participant/objective outcomes;
- world/scene/materialization reconciliation;
- authoritative return to exploration;
- bounded campaign resolution;
- runtime + GameFrame restart/resume.

**Exit gate:** the complete one-human campaign passes without fabricated tactical outcomes, developer intervention in ordinary execution, hidden-name leakage, NPC omniscience, scene/entity discontinuity, or regenerated replacement locations.

## Milestone 10B — Two-human one-scene embodied campaign

After the single-player architecture is proven:

Required runtime work:

- campaign join distinct from startup;
- explicit party assignment;
- per-player roster and knowledge initialization;
- player-private and party-private knowledge projection;
- scene-scoped observation semantics;
- resume/recap behavior.

Required GameFrame work:

- authenticated invitations/membership;
- separate player avatars;
- realtime nearby-player movement projection;
- one shared active exploration scene;
- explicit party-cohesion transitions;
- public, party, and player-private GM presentation;
- cooperative tactical control;
- reconnect/resume.

**Exit gate:** two authenticated humans complete the bounded campaign while sharing one active exploration scene at a time, without audience leakage or duplicate presence.

## Milestone 11 — Generality proof with second handcrafted world

Run a materially different handcrafted package through the same:

- validator;
- WorldGraph/location semantics;
- Entity Registry;
- Scene Registry;
- observer/player knowledge;
- GameFrame exploration/materialization;
- perspective-bounded entity performance;
- Dungeon Master referee path;
- typed mechanics;
- tactical handoff where relevant.

If the second package requires a campaign-specific Dungeon Master execution branch, special exploration control plane, or breaks the generic world/entity/scene/knowledge model, repair the abstraction before automating campaign creation.

**Exit gate:** two materially different handcrafted campaigns/worlds use the same runtime/GameFrame architecture without campaign-specific control planes.

## Milestone 12 — Campaign Architect implementation

Implement Campaign Architect only after the common package/runtime/materialization abstraction is proven.

Initial inputs:

- concise freeform concept;
- structured owner/test brief;
- prepared mechanic/theme/world capabilities.

Initial output lifecycle:

```text
brief
→ generated draft CampaignPackage
→ optional owner refinement
→ validation / repair
→ player-safe preview
→ explicit commitment
```

Generated packages must include semantic world/location/materialization requirements without embedding renderer-specific geometry.

**Exit gate:** generated packages require no campaign-specific Dungeon Master, entity/scene runtime, or GameFrame exploration path.

## Milestone 13 — Rich intake, media, and world-kit authoring

- versioned `CampaignBrief`;
- player-facing campaign sheet;
- guided clarification/repair;
- GameFrame creation flow;
- optional Discord interview;
- draft package inspection and owner editing;
- theme/world-kit selection;
- semantic campaign theme and asset intents;
- prepared catalog reuse;
- deterministic composition;
- provider-neutral/Cloudflare-backed image generation where configured;
- recurring entity/location continuity;
- cinematic scripts and special poses;
- validation, provenance, moderation, budgets, caching, and replacement;
- text and placeholder fallbacks.

**Exit gate:** a bespoke campaign can receive coherent accepted world/character/media coverage without making live generation a gameplay dependency.

## Milestone 14 — Split-party / multi-scene productization

The Scene Registry is architected for zero-or-more active scenes from the beginning, but simultaneous separated parties are productized only after one-scene multiplayer is trustworthy.

Required work includes:

- per-player authoritative scene assignment;
- independent realtime scene subscriptions;
- scene-scoped observation and event delivery;
- explicit cross-scene communication semantics;
- concurrent Dungeon Master/context-mode custody;
- independent scene materialization/recovery;
- shared versus scene-local clocks/pressure/objectives;
- clear behavior when one scene enters tactical mode while another remains exploratory;
- UI that makes party separation and communication legible.

**Exit gate:** two subgroups can occupy separate maps/scenes, act concurrently, learn different information, reconnect, and later reunite without identity, chronology, audience, or campaign-state corruption.

## Milestone 15 — Multi-session systems and operational quality

Promote only systems proven necessary by playable campaigns:

- progression, rest, inventory, equipment, injuries, care, cube accommodation, and recovery;
- recurring quests, factions, relationships, and locations;
- campaign inspection/correction;
- exports, backups, restore, retention, and deletion;
- provider/storage/tunnel/service observability;
- cost, latency, continuity, and failure metrics;
- Theo as an ordinary GameFrame player;
- staged rollout and rollback.

## Deployment sequencing

Initial production remains GameFrame and RPG GM Runtime as separate services on one VM behind Cloudflare, with runtime/data/admin surfaces private and no player VPN or router port forwarding.

Embodied exploration should extend the existing VM-backed WebSocket path for bounded realtime movement/session projection while keeping durable semantic mutations and recovery on authoritative service/HTTP paths. Realtime socket state is never campaign truth.

Deployment defects that block campaign development or play are P0. Additional infrastructure hardening does not outrank durable world correctness, exploration continuity, secure Dungeon Master behavior, scene-faithful Arena handoff, and complete campaign proof.

## Validation policy

Use the evidence layer that matches the claim:

- schema/unit tests for package/entity/scene/knowledge/world invariants;
- deterministic exploration/materialization tests for GameFrame geometry/identity;
- deterministic machine-play for Dungeon Master referee and character-performance behavior;
- actual cross-repository services for integration truth;
- real Arena matches for tactical claims;
- browser tests for embodied player experience;
- VM/Cloudflare/Discord canaries for deployment/realtime claims;
- separate media-provider canaries for generation claims.

Do not claim a working embodied campaign from transport tests, catalog shape, a canned opening, or a lower evidence layer.

## Priority rule

Current priority is:

1. preserve executable staging and repair authoritative Arena aftermath/unlock when it blocks testing;
2. establish durable Entity Registry → Character Factory → Scene Registry → semantic observer/player knowledge;
3. define and implement one Crooked Checkpoint embodied exploration scene;
4. add direct perspective-bounded Pell interaction, Ask-GM, Do Something Else, and GM intervention semantics;
5. add a second connected scene/alternate-route materialization and one-scene party transition contract;
6. complete secure context-mode/hidden-decision/safe-render and typed world operations;
7. make event/check behavior world/route aware;
8. make Monster Master tactical handoff scene-faithful and return to the embodied world;
9. prove the complete single-player embodied campaign;
10. add two-human one-scene embodied play;
11. prove a second handcrafted world;
12. implement Campaign Architect;
13. add richer media/world-kit authoring;
14. productize split-party/multi-scene play later.

## Governing rule

> Prove campaigns as durable playable worlds, not model transcripts: packages define the world, runtime owns semantic identity/presence/knowledge, GameFrame materializes playable space, the Dungeon Master referees and performs bounded perspectives, and tactical mode returns consequences to the same world.
