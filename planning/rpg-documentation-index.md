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

1. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — durable product objective and non-negotiable platform goals.
2. [`shared/rpg-agent-architecture-and-campaign-package.md`](shared/rpg-agent-architecture-and-campaign-package.md) — controlling two-agent architecture, CampaignPackage boundary, and runtime-substrate roles.
3. [`shared/rpg-scene-entity-and-knowledge-contract.md`](shared/rpg-scene-entity-and-knowledge-contract.md) — durable entities, Character Factory, Scene Registry, semantic/viewer knowledge, Context Compiler, Ask-GM semantics, and scene-to-Arena continuity.
4. [`shared/rpg-platform-roadmap.md`](shared/rpg-platform-roadmap.md) — controlling cross-repository milestone order and exit gates.
5. [`ROADMAP.md`](ROADMAP.md) — current GameFrame-local implementation direction and live blockers.
6. [`monster-master-rpg-canonical-baseline.md`](monster-master-rpg-canonical-baseline.md) — Monster Master-specific campaign/lore authority.
7. [`monster-master-rules.md`](monster-master-rules.md) — fixed standalone MM-0001 Arena rules.
8. [`monster-master-rpg-encounter-rules.md`](monster-master-rpg-encounter-rules.md) — evolving campaign-specific scene-faithful tactical rules.
9. Read the specific interface, creative, asset, deployment, or testing contract needed by the active slice.

Do not reconstruct architecture from chat history, a sample fixture, a raw premise, an old work order, or implementation accidents.

## What the core documents answer

| Document | Question |
| --- | --- |
| `shared/rpg-platform-product-goals.md` | What durable product behavior must the RPG platform ultimately provide? |
| `shared/rpg-agent-architecture-and-campaign-package.md` | What are the two agents and durable package boundary? |
| `shared/rpg-scene-entity-and-knowledge-contract.md` | Who exists, who is present, what does each viewer know, and how does that survive tactical mode? |
| `shared/rpg-platform-roadmap.md` | Where is the cross-repository platform going? |
| `ROADMAP.md` | What GameFrame platform work is complete, active, blocked, or deferred? |
| `rpg-gameframe-interface-contract.md` | What does GameFrame expose to players/runtime? |
| `monster-master-rpg-canonical-baseline.md` | What Monster Master campaign/lore decisions are authoritative? |
| `monster-master-rules.md` | What does fixed MM-0001 actually implement? |
| `monster-master-rpg-encounter-rules.md` | What must campaign tactical encounters eventually preserve? |
| `rpg-platform-delivery-plan.md` | How does GameFrame delivery map to the shared roadmap? |

Do not create a second local roadmap or competing architecture memo when one of these controlling documents can be updated.

## Official terms

- **Campaign Architect** creates complete CampaignPackage drafts before ordinary play and remains deferred until two handcrafted packages prove the common runtime abstraction.
- **Dungeon Master** conducts live play from a committed package and durable campaign state.
- **Character Factory** is deterministic/schema-first runtime substrate for bounded incidental-character materialization, not a third campaign agent.
- **Entity Registry** owns stable campaign entity identity.
- **Scene Registry** owns zero-or-more active scenes and explicit physical membership.
- **Semantic Knowledge / Player Knowledge Projection** owns sparse knowledge records and viewer-safe known people/facts.
- **Encounter Scene Compiler** carries exact source-scene entity/objective identity and scene revision/digest into tactical authority.
- Campaign compiler, plot agent, and intro agent are retired as separate services/interfaces.

## Core ownership

### RPG GM Runtime

Owns private package truth, campaign journal, entity/scene/knowledge state, Character Factory, Dungeon Master orchestration, hidden semantic decisions, event eligibility, NPC continuity, and mapping GameFrame outcomes back into campaign truth.

### GameFrame

Owns authenticated player identity, complete player interface, viewer-safe People/scene projections, Act/Speak and Ask-GM UI, deterministic mechanics explicitly implemented in GameFrame, tactical authority, campaign-bound terminal UX, and media materialization.

### Scribbles Runtime

Owns Theo and any future connector that lets Theo occupy an ordinary GameFrame seat. Theo has no Dungeon Master or hidden-package authority.

## Monster Master documents

1. [`monster-master-rpg-current-creative-direction.md`](monster-master-rpg-current-creative-direction.md) — product tone, agency, package direction, and creative priorities.
2. [`monster-master-rpg-lore-and-story.md`](monster-master-rpg-lore-and-story.md) — accepted detailed world decisions.
3. [`decisions/0006-monster-master-capture-cube-form-factor.md`](decisions/0006-monster-master-capture-cube-form-factor.md) — controlling clarification that ordinary cubes are handheld externally despite large interior living spaces.
4. [`monster-master-rpg-npc-pool.md`](monster-master-rpg-npc-pool.md) — prepared role/portrait coverage and continuity expectations.
5. [`monster-master-rules.md`](monster-master-rules.md) — fixed standalone duel.
6. [`monster-master-rpg-encounter-rules.md`](monster-master-rpg-encounter-rules.md) — campaign encounter semantics: source-scene provenance, scene fidelity, campaign terminal UX, trainers, escape/withdrawal, asymmetric forces, and noncombatant/support roles as implemented.

`0006` resolves any ambiguity left by older lore prose that described cube interiors without stating exterior scale. Do not interpret the older interior/accommodation discussion as permission to depict ordinary cubes as cage-sized.

## Campaign authoring

- [`shared/rpg-campaign-architect-contract.md`](shared/rpg-campaign-architect-contract.md) defines the future generated-draft → owner-refinement → validation → commitment lifecycle.
- Handcrafted and generated packages use the same validator and runtime path.
- A materially different second handcrafted package is the generality gate before Campaign Architect implementation.
- An active package is not silently rewritten; foundational changes require explicit amendment/version/migration.
- Incidental live-play NPCs use Character Factory rather than rerunning Campaign Architect.

## GameFrame player experience

[`rpg-gameframe-interface-contract.md`](rpg-gameframe-interface-contract.md) requires the architecture to distinguish:

- **Act / Speak** versus **Ask Game Master**;
- Ask-GM fictional audibility versus presentation audience;
- event audience versus presentation origin;
- canonical runtime entity identity versus viewer-safe display identity;
- semantic knowledge authority versus display `knownFacts`;
- current scene projection versus tactical match state;
- fixed MM-0001 duel versus campaign-specific Monster Master RPG encounter semantics;
- browser return navigation versus authoritative post-encounter campaign unlock.

The target People surface shows only persons/facts known to that player character. Unknown entities are absent, not redacted placeholders.

## Shared fixtures and parallel development

The public shared fixture set is the preferred coordination seam for parallel GameFrame/runtime development.

As implementation lands, add versioned fixtures for:

- current scene;
- Known People descriptor→role→name progression;
- Act/Speak and Ask-GM;
- presentation origin and audience;
- player-safe entity inspection;
- encounter source scene/revision/digest;
- tactical roles/objectives;
- escape/withdrawal outcomes;
- authoritative campaign aftermath/unlock.

Do not encode private package secrets into public fixtures.

## Asset and media authority

- [`shared/rpg-media-theme-and-audio-pipeline.md`](shared/rpg-media-theme-and-audio-pipeline.md) controls semantic asset intent and materialization ownership.
- [`monster-master-rpg-asset-register.md`](monster-master-rpg-asset-register.md) remains the product-wide asset inventory/provenance authority.
- [`shared/rpg-rendering-and-asset-contract.md`](shared/rpg-rendering-and-asset-contract.md) controls rendering/source-master/fallback rules.

Generated media remains optional presentation. It does not own campaign truth or block text-first play.

## Roadmap authority

- `shared/rpg-platform-roadmap.md` owns durable cross-repository milestone order.
- `ROADMAP.md` owns GameFrame-local status/direction/live blockers.
- `rpg-platform-delivery-plan.md` maps GameFrame delivery onto the shared roadmap and must not reorder it.

The current path is:

```text
preserve executable staging + fix authoritative Arena return blocker
→ entity / scene / semantic knowledge substrate
→ secure hidden decision + safe rendering
→ Act/Speak vs Ask-GM + People/scene UI
→ executable events and typed campaign operations
→ scene-faithful Monster Master RPG tactical handoff
→ complete single-player campaign
→ multiplayer
→ second handcrafted package
→ Campaign Architect
```

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is canonical. Listed shared documents are mirrored byte-for-byte into RPG GM Runtime only after GameFrame canonical changes merge.

Accepted order:

1. merge canonical GameFrame documents/manifest;
2. synchronize runtime mirrors;
3. run exact-byte drift and focused integration checks;
4. merge runtime updates.

## Documentation hygiene

Managed RPG planning Markdown must have YAML front matter containing at least:

- `title`;
- `status`;
- `document_type`;
- `owner`;
- `last_updated`;
- `applies_to`.

Local `related` and `depends_on` paths must resolve. Shared documents additionally carry canonical repository/path/version metadata and `sync_policy: exact-byte-copy`.

Validate with:

```bash
python3 scripts/check-rpg-planning-docs.py
```

## Decision hygiene

Every new architecture or roadmap decision must update or explicitly supersede the controlling document. Git history preserves old wording; do not create duplicate roadmaps/status memos merely to preserve history.
