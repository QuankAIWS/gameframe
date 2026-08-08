---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe-rpg-planning
related:
  - README.md
  - ROADMAP.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rules.md
  - monster-master-rpg-encounter-rules.md
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
  - shared/rpg-campaign-architect-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-rendering-and-asset-contract.md
  - shared/rpg-cross-repository-integration-testing.md
  - decisions/0006-monster-master-capture-cube-form-factor.md
---

# RPG GameFrame Documentation

## Required reading order

1. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — durable embodied product objective and non-negotiable goals.
2. [`shared/rpg-agent-architecture-and-campaign-package.md`](shared/rpg-agent-architecture-and-campaign-package.md) — controlling two-agent architecture and semantic CampaignPackage boundary.
3. [`shared/rpg-scene-entity-and-knowledge-contract.md`](shared/rpg-scene-entity-and-knowledge-contract.md) — durable entity identity, semantic Scene Registry, materialization references, observer/player knowledge, and scene-to-Arena continuity.
4. [`shared/rpg-embodied-exploration-and-character-performance-contract.md`](shared/rpg-embodied-exploration-and-character-performance-contract.md) — controlling embodied exploration loop, WorldGraph/materialization boundary, realtime movement posture, perspective-bounded NPC performance, GM/freeform interaction, and single-scene versus multi-scene strategy.
5. [`shared/rpg-platform-roadmap.md`](shared/rpg-platform-roadmap.md) — controlling cross-repository milestone order and exit gates.
6. [`ROADMAP.md`](ROADMAP.md) — current GameFrame-local implementation direction/live blockers.
7. [`monster-master-rpg-canonical-baseline.md`](monster-master-rpg-canonical-baseline.md) — Monster Master-specific campaign/lore authority.
8. [`monster-master-rules.md`](monster-master-rules.md) — fixed standalone MM-0001 Arena rules.
9. [`monster-master-rpg-encounter-rules.md`](monster-master-rpg-encounter-rules.md) — evolving campaign scene-faithful tactical rules.
10. Read the specific interface/creative/asset/deployment/testing contract needed by the active slice.

Do not reconstruct architecture from chat history, sample fixtures, raw premises, old work orders, or implementation accidents.

## What the core documents answer

| Document | Question |
| --- | --- |
| `shared/rpg-platform-product-goals.md` | What product are we ultimately building? |
| `shared/rpg-agent-architecture-and-campaign-package.md` | What are the two agents and durable semantic package boundary? |
| `shared/rpg-scene-entity-and-knowledge-contract.md` | Who/what exists, where are they semantically, what does each observer know, and how does that survive mode changes? |
| `shared/rpg-embodied-exploration-and-character-performance-contract.md` | How does the semantic campaign become a playable world, how do NPC/GM contexts differ, and how do one-map/multi-map modes work? |
| `shared/rpg-platform-roadmap.md` | What is the cross-repository implementation order? |
| `ROADMAP.md` | What GameFrame work is complete/active/blocked/deferred? |
| `rpg-gameframe-interface-contract.md` | What commands/projections/realtime/materialization surfaces does GameFrame expose? |
| `rpg-campaign-experience-directions.md` | What should ordinary RPG play feel like? |
| `rpg-platform-delivery-plan.md` | How does GameFrame delivery map to the shared roadmap? |

Do not create a second roadmap or competing architecture memo when one of these controlling documents can be updated.

## Official terms

- **Campaign Architect** creates complete semantic CampaignPackage drafts before ordinary play and remains deferred until two handcrafted worlds prove common abstraction.
- **Dungeon Master** conducts live play from committed package/current state through referee, GM-communication, entity-performance, and aftermath/intervention context modes. These are not separate agents.
- **Character Factory** is deterministic/schema-first substrate for incidental-character materialization.
- **Entity Registry** owns stable campaign entity identity.
- **Scene Registry** owns zero-or-more active semantic scenes/physical membership.
- **Semantic Observer Knowledge** owns sparse knowledge/belief state; Player Knowledge Projection is the viewer-safe surface.
- **WorldGraph** owns semantic region/location/route relationships.
- **Exploration Materialization** is GameFrame's accepted playable realization of semantic scene/world intent.
- **Encounter Scene Compiler** carries exact source-scene entity/objective identity into tactical authority.
- Campaign compiler, plot agent, intro agent, and standalone NPC agent are not separate campaign services.

## Product loop

Target mature loop:

```text
semantic CampaignPackage/world
→ durable Entity/Scene/Observer Knowledge
→ GameFrame materialized exploration scene
→ movement/direct interaction
→ targeted perspective-bounded NPC performance as needed
→ Ask-GM / Do Something Else / GM intervention as needed
→ deterministic checks/events/mechanics
→ scene-faithful Arena when required
→ reconciliation back into exploration world
```

The text-first campaign shell remains fallback/testing/accessibility/GM-history infrastructure.

## Single-scene versus multi-scene posture

Architecture supports zero-or-more semantic scenes.

Product order is:

```text
single human / one active exploration scene
→ two humans / one shared exploration scene + cohesion transitions
→ second handcrafted world
→ Campaign Architect
→ later split-party / simultaneous multi-scene productization
```

This keeps the authority model future-proof without making the first multiplayer slice pay the full concurrency/knowledge/realtime/UI cost of split-party play.

## Monster Master documents

1. [`monster-master-rpg-current-creative-direction.md`](monster-master-rpg-current-creative-direction.md) — embodied Monster Master tone, agency, Crooked Checkpoint world target, and creative priorities.
2. [`monster-master-rpg-lore-and-story.md`](monster-master-rpg-lore-and-story.md) — accepted detailed world decisions.
3. [`decisions/0006-monster-master-capture-cube-form-factor.md`](decisions/0006-monster-master-capture-cube-form-factor.md) — ordinary cubes are handheld externally.
4. [`monster-master-rpg-npc-pool.md`](monster-master-rpg-npc-pool.md) — prepared role/portrait coverage/continuity expectations.
5. [`monster-master-rules.md`](monster-master-rules.md) — fixed standalone duel.
6. [`monster-master-rpg-encounter-rules.md`](monster-master-rpg-encounter-rules.md) — campaign encounter semantics/source-scene fidelity.

## Campaign authoring

- [`shared/rpg-campaign-architect-contract.md`](shared/rpg-campaign-architect-contract.md) defines generated semantic world/package → owner refinement → validation → commitment.
- Handcrafted/generated packages use same validator/runtime/materialization path.
- A materially different second handcrafted world is the generality gate before Campaign Architect implementation.
- Active package foundations require explicit amendment/version/migration.
- Incidental live NPCs use Character Factory; incidental explorable areas use validated semantic world/materialization rules rather than re-running Campaign Architect.

## GameFrame player experience

[`rpg-gameframe-interface-contract.md`](rpg-gameframe-interface-contract.md) distinguishes:

- Explore/realtime transforms versus durable semantic world changes;
- direct targeted interaction versus Do Something Else;
- entity dialogue versus Ask-GM/GM communication;
- event audience versus presentation origin;
- semantic scene versus GameFrame materialization;
- canonical entity identity versus viewer-safe identity;
- observer knowledge authority versus display facts;
- fixed MM-0001 versus campaign-specific tactical semantics;
- navigation versus authoritative embodied return.

## Shared fixtures and parallel development

Public shared fixtures are the preferred coordination seam.

As implementation lands, add versioned fixtures for:

- semantic current scene/materialization ref;
- Known People descriptor→role→name;
- observer/entity knowledge;
- direct entity interaction;
- Do Something Else;
- Ask-GM;
- GM intervention;
- scene transfer/route identity;
- encounter source scene/revision/digest;
- tactical roles/objectives/outcomes;
- authoritative embodied aftermath/unlock.

Do not encode private package secrets into public fixtures.

## Asset/media authority

- [`shared/rpg-media-theme-and-audio-pipeline.md`](shared/rpg-media-theme-and-audio-pipeline.md) controls semantic asset intent/materialization ownership.
- [`shared/rpg-rendering-and-asset-contract.md`](shared/rpg-rendering-and-asset-contract.md) controls renderer/source-master/fallback rules.
- [`shared/rpg-embodied-exploration-and-character-performance-contract.md`](shared/rpg-embodied-exploration-and-character-performance-contract.md) controls exploration materialization semantics and cinematic-script posture.

Generated media remains presentation. It does not own campaign truth/collision.

## Roadmap authority

- `shared/rpg-platform-roadmap.md` owns durable cross-repository milestone order.
- `ROADMAP.md` owns GameFrame-local status/direction/live blockers.
- `rpg-platform-delivery-plan.md` maps GameFrame delivery onto the shared roadmap.

Current path:

```text
preserve staging + repair authoritative Arena return
→ Entity / Scene / Observer Knowledge
→ Crooked Checkpoint exploration materialization
→ realtime movement
→ Pell interaction + Ask-GM + Do Something Else + GM intervention
→ connected woods/alternate-route scene + revisit
→ typed world events/checks
→ scene-faithful Arena + embodied return
→ complete single-player
→ two-human one-scene
→ second handcrafted world
→ Campaign Architect
→ later split-party/multi-scene
```

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is canonical. Listed shared documents are mirrored byte-for-byte into RPG GM Runtime only after GameFrame canonical changes merge.

Accepted order:

1. merge canonical GameFrame shared docs/manifest;
2. synchronize runtime mirrors;
3. run exact-byte drift/focused integration checks;
4. merge runtime updates.

## Documentation hygiene

Managed RPG planning Markdown must have YAML front matter containing at least:

- `title`;
- `status`;
- `document_type`;
- `owner`;
- `last_updated`;
- `applies_to`.

Local `related`/`depends_on` paths must resolve. Shared documents additionally carry canonical repository/path/version metadata and `sync_policy: exact-byte-copy`.

Validate with:

```bash
python3 scripts/check-rpg-planning-docs.py
```

## Decision hygiene

Every new architecture/roadmap decision must update or explicitly supersede the controlling document. Git history preserves old wording; do not create duplicate roadmaps/status memos merely to preserve history.
