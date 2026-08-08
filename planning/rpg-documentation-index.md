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
---

# RPG GameFrame Documentation

## Required reading order

1. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — product hierarchy: GameFrame RPG Engine, RPG Rulesets, bespoke campaigns, Battle Arena, and generated-campaign destination.
2. [`shared/rpg-agent-architecture-and-campaign-package.md`](shared/rpg-agent-architecture-and-campaign-package.md) — two-agent architecture, CampaignPackage, engine/ruleset boundary, and Dungeon Master context modes.
3. [`shared/rpg-scene-entity-and-knowledge-contract.md`](shared/rpg-scene-entity-and-knowledge-contract.md) — durable entities, semantic scenes, materialization linkage, Observer Knowledge, control authority, and same-map Tactical Activation.
4. [`shared/rpg-embodied-exploration-and-character-performance-contract.md`](shared/rpg-embodied-exploration-and-character-performance-contract.md) — embodied exploration, WorldGraph/materialization, NPC perspective custody, GM/freeform surfaces, Tactical Activation, BattleScenario, and one-scene/multi-scene posture.
5. [`shared/rpg-platform-roadmap.md`](shared/rpg-platform-roadmap.md) — controlling cross-repository milestone order.
6. [`ROADMAP.md`](ROADMAP.md) — GameFrame-local implementation direction and transitional blockers.
7. [`monster-master-rpg-canonical-baseline.md`](monster-master-rpg-canonical-baseline.md) — Monster Master campaign/lore authority.
8. [`monster-master-rules.md`](monster-master-rules.md) — current narrow MM-0001 standalone tactical proof/regression contract.
9. [`monster-master-rpg-encounter-rules.md`](monster-master-rpg-encounter-rules.md) — Monster Master RPG Tactical Activation, control/class direction, and Battle Arena convergence.
10. Read interface/delivery/media/deployment/testing contracts for the active slice.

Do not reconstruct architecture from chat history, an old encounter fixture, or the current legacy separate-match implementation.

## Product terminology

- **GameFrame RPG Engine** — reusable campaign-agnostic embodied world/player/mechanics engine inside GameFrame.
- **GameFrame RPG** — future generic player-facing campaign creation/library/resume product.
- **RPG Ruleset** — deterministic game-specific mechanic/control capability independent of a single CampaignPackage.
- **Monster Master Ruleset** — shared Monster Master character/combat rules target.
- **Monster Master RPG** — GameFrame RPG Engine + Monster Master Ruleset + Monster Master CampaignPackage/theme/content.
- **Monster Master Battle Arena** — standalone tactical simulator using Monster Master Ruleset + BattleScenario setup.
- **Campaign Architect** — pre-play CampaignPackage authoring agent.
- **Dungeon Master** — live referee/GM/entity-performance/aftermath agent capability.
- **WorldGraph** — semantic locations/routes, not Pixi geometry.
- **Entity Registry** — stable durable campaign identity.
- **Character Factory** — bounded deterministic incidental-character materialization.
- **Scene Registry** — zero-or-more semantic scenes and physical semantic membership.
- **Observer Knowledge** — sparse knowledge/belief state for players/NPCs/other bounded observers.
- **Tactical Activation** — same materialized scene enters turn-based deterministic authority.
- **Tactical Activation Coordinator** — runtime semantic coordination replacing the old Encounter Scene Compiler destination.
- **BattleScenario** — standalone battle setup for Battle Arena, not CampaignPackage campaign state.

## Core product loop

```text
CampaignPackage + RPG Ruleset
→ durable semantic world
→ GameFrame materialized exploration scene
→ movement/direct interaction
→ perspective-bounded NPC performance / real GM as needed
→ deterministic mechanics
→ Tactical Activation on same map when initiative is required
→ same scene resumes exploration
```

Fixed controls are not the complete action space: **Do Something Else** remains the tabletop escape hatch.

## Monster Master product split

### Monster Master RPG

The bespoke campaign title and first full-engine proof.

### Monster Master Battle Arena

Standalone battle simulator. It may eventually provide character/loadout building, map selection/generation, teams, deployment, objectives, BattleBot/humans, replay, and rematch.

Campaign combat does **not** launch this product. Equivalent Monster Master Ruleset versions/profiles should produce equivalent combat semantics in the RPG and Arena.

### MM-0001

Keep the current narrow duel as regression infrastructure while shared Monster Master tactical semantics are extracted. Do not confuse it with the mature Monster Master Ruleset or campaign lifecycle.

## GameFrame RPG generic product

The Game Library may expose a **GameFrame RPG — Coming Soon** destination for:

- Create Campaign;
- My Campaigns;
- Import Campaign;
- future Campaign Architect intake/refinement/preview/commit/resume.

Bespoke campaigns such as Monster Master RPG remain direct library titles while using GameFrame RPG Engine underneath.

## Single-scene versus multi-scene posture

The architecture supports zero-or-more semantic scenes.

Implementation order:

```text
single human / one scene
→ two humans / one shared active scene with group transitions
→ second handcrafted campaign
→ Campaign Architect
→ later split-party simultaneous multi-scene play
```

Many persistent maps do not imply simultaneous split-party scenes.

## Shared fixtures/testing

Public shared fixtures should progressively cover:

- semantic scene/materialization linkage;
- Observer Knowledge/People;
- direct Interact/Talk;
- Ask-GM / Do Something Else / GM intervention;
- ruleset/profile/version;
- principal/player-character/controlled-entity authorization;
- scene route/transfer;
- Tactical Activation snapshot/linkage;
- structured tactical consequences;
- same-scene tactical→exploration resume.

Do not encode private package secrets into public fixtures.

## Asset/media authority

- `shared/rpg-media-theme-and-audio-pipeline.md` controls asset intent/materialization ownership.
- `shared/rpg-rendering-and-asset-contract.md` controls renderer/source-master/fallback rules.
- `shared/rpg-embodied-exploration-and-character-performance-contract.md` controls world-materialization and cinematic-script posture.

Generated media remains presentation. It does not own campaign truth/collision.

## Current implementation path

```text
preserve current staging correctness only as needed
→ Entity / Scene / Observer Knowledge
→ explicit GameFrame RPG Engine / RPG Ruleset boundary
→ Crooked Checkpoint materialization
→ realtime exploration
→ Pell interaction + Ask-GM + Do Something Else + GM intervention
→ connected West Woods scene / revisit
→ Monster Master Ruleset + generic control authority
→ same-map Tactical Activation
→ complete single-player embodied campaign
→ two-human one-scene campaign
→ second handcrafted campaign
→ Campaign Architect / GameFrame RPG generic product
→ Battle Arena richer convergence
→ split-party multi-scene later
```

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is canonical. Listed shared documents mirror byte-for-byte into RPG GM Runtime.

Accepted merge order:

1. merge canonical GameFrame shared docs/manifest;
2. synchronize runtime mirrors;
3. run exact-byte drift/focused integration checks;
4. merge runtime updates.

## Documentation hygiene

Managed RPG planning Markdown requires YAML front matter with at least:

- `title`;
- `status`;
- `document_type`;
- `owner`;
- `last_updated`;
- `applies_to`.

Validate locally/CI with:

```bash
python3 scripts/check-rpg-planning-docs.py
```

## Decision hygiene

Every architecture/roadmap decision should update/supersede the controlling document rather than create a competing status memo. Git history preserves old wording.
