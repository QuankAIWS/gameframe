---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe-rpg-planning
related:
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
  - tactical-battler-rpg-foundation.md
  - rpg-platform-delivery-plan.md
  - monster-master-rpg-current-creative-direction.md
  - monster-master-rpg-lore-and-story.md
  - monster-master-rpg-lore-tone-and-agent-realization.md
  - monster-master-rpg-asset-register.md
  - monster-master-rpg-npc-pool.md
  - assets/monster-master-rpg-asset-register.json
  - assets/monster-master-rpg-npc-role-catalog.json
  - shared/rpg-platform-product-goals.md
  - shared/rpg-cloudflare-deployment-architecture.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-rendering-and-asset-contract.md
  - shared/rpg-campaign-compiler-contract.md
  - shared/rpg-one-shot-intro-agent-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-cross-repository-integration-testing.md
  - shared/shared-rpg-documents.json
---

# RPG GameFrame Documentation

Read the canonical RPG planning documents in this order:

1. [`rpg-campaign-experience-directions.md`](rpg-campaign-experience-directions.md) — accepted all-GameFrame product direction.
2. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — durable end-state, Cloudflare posture, Discord role, theme flexibility, and product acceptance proof.
3. [`rpg-gm-runtime-boundary.md`](rpg-gm-runtime-boundary.md) — authority, identity, and repository boundaries.
4. [`shared/rpg-cloudflare-deployment-architecture.md`](shared/rpg-cloudflare-deployment-architecture.md) — Workers, Durable Objects, invitations, projections, queues, storage, and failure isolation.
5. [`rpg-gameframe-interface-contract.md`](rpg-gameframe-interface-contract.md) — required full campaign interface and cross-repository contract.
6. [`shared/rpg-media-theme-and-audio-pipeline.md`](shared/rpg-media-theme-and-audio-pipeline.md) — future theme translation, catalogs, composition, image generation, narration audio, provenance, and fallbacks; these are not current Monster Master asset-production dependencies.
7. [`shared/rpg-rendering-and-asset-contract.md`](shared/rpg-rendering-and-asset-contract.md) — Monster Master as the RPG engine reference campaign, renderer geometry, runtime asset contracts, source-master rules, and the long-term campaign-generation blueprint.
8. [`shared/rpg-campaign-compiler-contract.md`](shared/rpg-campaign-compiler-contract.md) — deferred long-term conversion of player ideas, forms, and interviews into validated campaign packages.
9. [`shared/rpg-one-shot-intro-agent-contract.md`](shared/rpg-one-shot-intro-agent-contract.md) — starter catalog selection, committed-package projection, bounded hidden-DM intro, deterministic non-canonical fixture, and first-decision output contract.
10. [`shared/rpg-event-and-plot-pool-contract.md`](shared/rpg-event-and-plot-pool-contract.md) — multi-family catalog, package commitment, reusable state-aware events, clue graphs, consequences, semantic assets, and deterministic-fixture rules.
11. [`shared/rpg-monster-master-reference-campaign.md`](shared/rpg-monster-master-reference-campaign.md) — Monster Master: Arena Battles, Monster Master RPG, prepared asset strategy, replayable starter architecture, and the first complete campaign proof.
12. [`monster-master-rpg-current-creative-direction.md`](monster-master-rpg-current-creative-direction.md) — controlling current-phase direction: several starter possibilities, adult-world posture, broad tonal range, plot-agent package versus DM realization, the Master Baiter concept, open NPC pool, and manual asset production.
13. [`monster-master-rpg-lore-and-story.md`](monster-master-rpg-lore-and-story.md) — incremental owner-approved world decisions covering trainers, monsters, cubes, rights, licensing, travel, authorities, hazard classes, and starter structure.
14. [`monster-master-rpg-lore-tone-and-agent-realization.md`](monster-master-rpg-lore-tone-and-agent-realization.md) — controlling refinement to Decision 1: adult player freedom, comedy and horror range, multi-plot starter posture, plot-agent output, DM authority, consequences, and asset implications.
15. [`monster-master-rpg-asset-register.md`](monster-master-rpg-asset-register.md) — shared starter-foundation priorities, NPC portrait families, selected-family extensions, source-master lifecycle, attempt tracking, reuse audit, and acceptance evidence.
16. [`monster-master-rpg-npc-pool.md`](monster-master-rpg-npc-pool.md) — named anchors, prepared role templates, incidental NPC continuity, promotion rules, portrait families, and field-token boundaries.
17. [`assets/monster-master-rpg-asset-register.json`](assets/monster-master-rpg-asset-register.json) — machine-readable reuse, shared P0, selected-family P1, and deferred asset identities; no scenario package owns the register.
18. [`assets/monster-master-rpg-npc-role-catalog.json`](assets/monster-master-rpg-npc-role-catalog.json) — machine-readable NPC role-to-portrait-family coverage and incidental presentation fallbacks.
19. [`shared/rpg-cross-repository-integration-testing.md`](shared/rpg-cross-repository-integration-testing.md) — mock, fixture, actual GameFrame, workerd, and deployed staging test layers.
20. [`tactical-battler-rpg-foundation.md`](tactical-battler-rpg-foundation.md) — existing tactical foundation and its role inside the wider RPG client.
21. [`rpg-platform-delivery-plan.md`](rpg-platform-delivery-plan.md) — phased implementation and acceptance gates.

## Private runtime design

Specific Monster Master catalog contents, selected causes, actor secrets, clue answers, event eligibility, pressure state, active packages, and instantiated NPC continuity belong in the private RPG GM Runtime repository.

The runtime currently stores the curated plot catalog, curated NPC pool, one explicitly non-canonical deterministic package, and intro implementation notes in:

- `docs/monster-master-event-and-plot-pools.md`;
- `docs/monster-master-npc-pool.md`;
- `docs/monster-master-one-shot-intro.md`;
- `fixtures/rpg-private/monster-master-event-and-plot-pools-v1.json`;
- `fixtures/rpg-private/monster-master-npc-pool-v1.json`;
- `src/rpg-gm/monster-master-one-shot-intro.ts`.

GameFrame owns public templates, lore direction, presentation semantics, semantic asset roles, NPC portrait-family planning, and the reusable production register. It must not become a second store for active hidden package truth or private NPC knowledge.

## Current creative-production boundary

The immediate Monster Master work is:

1. maintain several materially different approved starter plot families;
2. maintain a curated but open NPC role pool;
3. commit one selected package per run before meaningful investigation;
4. let the DM model realize that package and plausible incidental people dynamically around player action;
5. create, edit, clean, and integrate a shared starter asset and NPC portrait foundation;
6. add selected family extensions after the foundation is visually proven;
7. validate that deterministic CI packages prove contracts without becoming the default player story;
8. use what is learned to refine the future plot-agent template.

Cloudflare generation services, runtime-authored assets, provider orchestration, broad weighted plot selection, and live campaign-time generation remain future architecture.

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is the canonical machine-readable manifest for cross-repository documents.

Every Markdown file listed by the manifest is canonical in GameFrame and has an exact-byte mirror under `docs/shared/` in `QuankAIWS/rpg-gm-runtime`. The runtime also mirrors the manifest itself.

The private runtime owns synchronization and drift tooling because it can read public GameFrame files without exposing private runtime code or credentials to public CI.

Accepted update flow:

1. edit and merge the canonical GameFrame document and manifest;
2. run the runtime sync command to pull every canonical file;
3. run the exact-byte drift check;
4. merge the coordinated runtime update.

Do not independently edit a runtime mirror. Repository-specific extensions belong in separate local documents that link to the canonical source.

## Candidate rule

A document belongs in `planning/shared/` when all of the following are true:

- it controls behavior or sequencing in both repositories;
- GameFrame is the natural canonical owner or public integration reference;
- contradictory copies would create implementation drift;
- the complete document can be public without exposing runtime secrets or private campaign data.

Repository-internal implementation notes, private runtime prompts, provider credentials, selected packages, clue answers, instantiated NPC knowledge, and temporary branch plans are not shared-document candidates.

## Front-matter policy

Every canonical RPG Markdown document begins with YAML front matter containing `title`, `status`, `document_type`, `owner`, `last_updated`, and `applies_to`.

Shared Markdown documents also declare stable identity, version, canonical path, mirrors, and exact-byte synchronization policy.

A later decision must update or explicitly supersede the controlling document instead of adding a competing direction memo.
