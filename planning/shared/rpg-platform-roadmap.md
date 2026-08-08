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
shared_document_version: 4
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-roadmap.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-roadmap.md
sync_policy: exact-byte-copy
related:
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cross-repository-integration-testing.md
  - rpg-media-theme-and-audio-pipeline.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Roadmap

## Objective

Build a reusable RPG platform in which a Campaign Architect can create bespoke CampaignPackages and one Dungeon Master can run any validated package through GameFrame while durable runtime state—not model memory—owns entity identity, physical scene presence, player knowledge, mechanics, and tactical participant continuity.

The first proof is a handcrafted Monster Master CampaignPackage. The next proof is a materially different package through the same runtime abstractions. Campaign Architect generation follows only after those abstractions survive real handcrafted campaigns.

## Status rule

This shared roadmap defines cross-repository destination, milestone order, and exit gates. Volatile implementation evidence belongs in repository-local ledgers:

- GameFrame: `planning/ROADMAP.md`;
- RPG GM Runtime: `docs/project-status.md` and `docs/implementation-plan.md`.

Lower-level substrate does not satisfy a later milestone until that milestone's exit gate is actually exercised.

## Milestone 0 — Architecture and documentation baseline

- Keep Campaign Architect and Dungeon Master as the only campaign agents.
- Keep CampaignPackage as the durable pre-play handoff.
- Treat Entity Registry, Character Factory, Scene Registry, player knowledge, Context Compiler, and Encounter Scene Compiler as runtime substrate rather than additional agents.
- Retire campaign compiler, plot agent, and intro agent as compatibility surfaces.
- Keep Monster Master as the handcrafted gold standard.
- Keep shared documents canonical in GameFrame and mirrored byte-for-byte into runtime.

**Exit gate:** documentation indexes, roadmaps, architecture documents, specialist contracts, and repository boundaries agree on one architecture and implementation order.

## Milestone 1 — Executable CampaignPackage contract

Required runtime work:

- strict versioned package schema and bounded validation;
- visibility scopes;
- package hash and provenance;
- persistence, reload, migration posture, and immutable commitment;
- player-safe projection separated from runtime-only truth;
- initial actors, locations, scene membership, clue graph, event definitions, mechanics, and resolution material sufficient for executable play.

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
- clue/evidence graph;
- event eligibility and pressure material;
- multiple credible approaches;
- checks and tactical opportunities;
- complete resolution conditions;
- optional continuation seed;
- semantic asset manifest and deterministic fallbacks.

Additional plot families remain future packages or templates rather than being treated as one giant executable campaign.

**Exit gate:** the package can be committed without a model or media provider and contains enough exact state to initialize the runtime world.

## Milestone 3 — Durable entity, scene, and knowledge substrate

Before expecting model quality to cover continuity gaps, make exact campaign facts first-class runtime state.

Required runtime work:

- stable Entity Registry for package actors, trainers, monsters, promoted incidental NPCs, and materially relevant entities;
- deterministic/schema-first Character Factory for incidental NPC requests;
- Scene Registry with explicit enter/leave/current-presence semantics;
- durable scene-relevant objects, creatures, hazards, exits, and local continuity;
- viewer-specific player knowledge and Known People projections;
- canonical-name versus player-known-name separation;
- package-authored and incidental entity promotion rules;
- restart-safe reconstruction from committed journal state.

Required GameFrame work:

- player-safe People/Characters view primitives;
- viewer-safe identity labels and entity inspection;
- current scene/participant presentation where useful.

**Exit gate:** scripted play can create an incidental person, revisit that same person, move entities between scenes, and show different valid identity/knowledge projections to different viewers without relying on model recollection.

## Milestone 4 — Secure package-aware Dungeon Master

Specialize the model-backed turn mechanism into the production Dungeon Master.

Required flow:

```text
GmTurnTrigger
→ typed hidden context compiled from package + current world/scene state
→ semantic decision without player-facing prose
→ deterministic validation/materialization
→ durable semantic commitment
→ authorized revelations/consequences
→ audience-specific safe scene/world/knowledge projection
→ separate player-facing renderer
→ GameFrame presentation
```

Required behavior:

- opening and later turns use the same path;
- freeform player action remains primary;
- local improvisation is allowed without changing package invariants;
- state changes commit before presentation;
- exact retry reuses committed semantic truth;
- renderer never receives unrevealed entity names, hidden motives, clue meanings, event eligibility, or unauthorized entity existence;
- Dungeon Master requests incidental NPCs through Character Factory instead of minting arbitrary durable people itself.

**Exit gate:** the Monster Master package produces coherent multi-turn play while hidden canonical names and secrets are absent from renderer input until explicitly authorized.

## Milestone 5 — Interaction semantics and machine-play harness

Required player/runtime semantics:

- distinct **Act / Speak** and **Ask Game Master** commands/triggers;
- presentation origin separate from audience;
- player action, player choice, campaign opening, encounter outcome, system event, and player-to-GM query remain distinct causes.

Required harness cases:

- expected, chaotic, avoidant, and early-correct-guess players;
- ignored or missed clue;
- refusal of obvious assignment;
- incidental NPC creation and revisit;
- absent-character physical-action rejection;
- name revelation and People projection update;
- partial/paraphrased secret-leak attempts;
- exact retry and restart;
- Ask-GM query that does not become NPC-heard dialogue.

**Exit gate:** deterministic machine-play reaches valid progression without plot drift, entity discontinuity, secret leakage, or action/query confusion.

## Milestone 6 — Checks, executable events, and typed campaign operations

Implement only mechanics required by the gold-standard campaign.

- deterministic noncombat check authority;
- clue discovery and confidence state;
- executable event eligibility/cooldown/use predicates;
- typed domain operations for reveal, NPC continuity, scene transition, objective update, event selection, check request, and encounter request;
- typed current-state context instead of generic fact/flag writes as the long-term primary domain model;
- restart-safe bounded semantic repair.

**Exit gate:** Monster Master can progress deterministically through relevant clues/events/checks and reach or avoid a tactical threshold without forged event authority or model-owned state-machine behavior.

## Milestone 7 — Scene-faithful tactical handoff

The existing participant-faithful creature-only Arena path is useful substrate but not the final campaign encounter model.

Required direction:

- encounter request derives from the authoritative current scene;
- exact campaign entity IDs survive scene → GameFrame → terminal outcome → runtime aftermath;
- trainers participate when their deterministic tactical profiles are implemented;
- campaign-required allies, hostiles, neutrals, noncombatants, protected entities, or escaping entities are represented truthfully or launch fails closed;
- materially relevant scene objects/exits/objectives survive the handoff;
- asymmetric scenes are supported when implemented rather than reshaped into fake symmetric duels;
- withdrawal, escape, surrender, recall, and incapacitation are distinct structured outcomes;
- lethal outcomes, if enabled, use explicit rules rather than assuming zero health means death;
- GameFrame remains sole tactical authority.

MM-0001 remains the fixed standalone Monster Master duel. Monster Master RPG evolves through its own campaign encounter contract while reusing tactical-core and MatchSession infrastructure.

**Exit gate:** the Crooked Checkpoint can enter Arena Battles from actual scene truth and return structured outcomes for the exact campaign entities and objectives without participants disappearing or being replaced by unrelated fixed-duel identities.

## Milestone 8A — Complete single-player Monster Master engineering proof

Prove one authenticated human plus Monster Master BattleBot through the complete production-shaped journey:

- package-first startup;
- real current scene/entity state;
- multiple freeform turns;
- People/knowledge continuity;
- Ask-GM and in-fiction action distinction;
- executable event progression;
- deterministic check;
- scene-faithful actual Arena match when triggered;
- exact participant outcomes including escape/withdrawal where applicable;
- automatic aftermath;
- bounded campaign resolution;
- runtime + GameFrame restart/resume.

**Exit gate:** the complete one-human campaign passes without fabricated tactical outcomes, developer intervention in ordinary execution, hidden-name leakage, or scene/entity discontinuity.

## Milestone 8B — Playable two-human Monster Master

After single-player architecture is proven:

Required runtime work:

- campaign join distinct from startup;
- explicit party assignment;
- per-player roster and knowledge initialization;
- player-private and party-private knowledge projection;
- resume/recap behavior.

Required GameFrame work:

- authenticated invitations/membership;
- public, party, and player-private presentation;
- cooperative tactical control without placing allied humans on opposing duel seats;
- exact participant/unit authorization and structured outcomes;
- reconnect/resume;
- desktop/mobile acceptance.

**Exit gate:** two authenticated humans complete the bounded campaign, including a cooperative Arena encounter, without ordinary developer intervention or audience leakage.

## Milestone 9 — Generality proof with second handcrafted package

Run a materially different handcrafted package through the same:

- validator;
- Entity Registry;
- Scene Registry;
- knowledge projection;
- Dungeon Master path;
- typed mechanics;
- GameFrame presentation;
- tactical handoff where relevant.

If the second package requires a campaign-specific Dungeon Master execution branch or breaks the generic entity/scene/knowledge model, repair the abstraction before automating campaign creation.

**Exit gate:** two materially different handcrafted campaigns use the same runtime architecture without campaign-specific control planes.

## Milestone 10 — Campaign Architect implementation

Implement Campaign Architect only after the common package/runtime abstraction is proven.

Initial inputs:

- concise freeform concept;
- structured owner/test brief;
- prepared mechanic/theme capabilities.

Initial output lifecycle:

```text
brief
→ generated draft CampaignPackage
→ optional owner refinement
→ validation / repair
→ player-safe preview
→ explicit commitment
```

Initial tests should create materially different original campaigns and run them through the same validator, entity/scene/knowledge substrate, and Dungeon Master harness as Monster Master.

**Exit gate:** generated packages require no campaign-specific Dungeon Master or entity/scene runtime path.

## Milestone 11 — Rich intake and authoring tools

- versioned `CampaignBrief`;
- player-facing campaign sheet;
- guided clarification/repair;
- GameFrame creation flow;
- optional Discord interview;
- draft package inspection and owner editing;
- preview/confirmation of player-safe assumptions;
- explicit package amendment/version/migration tools.

**Exit gate:** a player or owner can move from concept to accepted package without exposing hidden truth or requiring direct repository edits.

## Milestone 12 — Campaign media materialization

- semantic campaign theme and asset intents;
- prepared catalog reuse;
- deterministic composition;
- provider-neutral/Cloudflare-backed image generation where configured;
- recurring entity and location continuity;
- validation, provenance, moderation, budgets, caching, and replacement;
- text and placeholder fallbacks.

Media is presentation, not campaign authority.

**Exit gate:** a campaign receives coherent accepted media coverage without making live generation a gameplay dependency.

## Milestone 13 — Multi-session systems and operational quality

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

Deployment defects that block campaign development or play are P0. Additional infrastructure hardening does not outrank entity/scene/knowledge correctness, secure Dungeon Master behavior, scene-faithful Arena handoff, and complete campaign proof.

## Validation policy

Use the evidence layer that matches the claim:

- schema/unit tests for package/entity/scene/knowledge invariants;
- deterministic machine-play for Dungeon Master behavior;
- actual cross-repository services for integration truth;
- real Arena matches for tactical claims;
- browser tests for player experience;
- VM/Cloudflare/Discord canaries for deployment claims;
- separate media-provider canaries for generation claims.

Do not claim a working campaign from transport tests, catalog shape, a canned opening, or a lower evidence layer.

## Priority rule

Current priority is:

1. preserve the executable Monster Master package and current live staging path;
2. establish durable entity/scene/player-knowledge contracts and implementation substrate;
3. structurally split hidden decision from player-safe rendering;
4. distinguish Act/Speak from Ask-GM and improve presentation origin;
5. make event authority and typed current-state semantics executable/durable;
6. make Monster Master RPG tactical handoff scene-faithful, including escape/withdrawal and trainer support as implemented;
7. prove the complete single-player campaign;
8. add multiplayer lifecycle;
9. prove a second handcrafted package;
10. implement Campaign Architect;
11. add richer authoring/media/multi-session systems.

## Governing rule

> Prove campaigns as durable worlds, not model transcripts: packages define the world, runtime owns identity/presence/knowledge, the Dungeon Master interprets it, and GameFrame preserves that same world when presentation or tactical mode changes.
