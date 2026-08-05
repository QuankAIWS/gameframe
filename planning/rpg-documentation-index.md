---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe-rpg-planning
related:
  - monster-master-rpg-canonical-baseline.md
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-cloudflare-deployment-architecture.md
  - shared/rpg-campaign-compiler-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-one-shot-intro-agent-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-rendering-and-asset-contract.md
  - shared/rpg-cross-repository-integration-testing.md
---

# RPG GameFrame Documentation

## Start here

Read [`monster-master-rpg-canonical-baseline.md`](monster-master-rpg-canonical-baseline.md) first. It reconciles document precedence, the campaign-compiler and live-DM split, repository ownership, tone, player agency, starter structure, NPC policy, asset authority, superseded material, implementation order, and the required campaign test harness.

Do not reconstruct the architecture from chat history, a sample fixture, an old work order, or an unmerged branch.

## Platform and ownership

1. [`rpg-campaign-experience-directions.md`](rpg-campaign-experience-directions.md) — accepted all-GameFrame player experience.
2. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — durable product objective and first complete proof.
3. [`rpg-gm-runtime-boundary.md`](rpg-gm-runtime-boundary.md) — authority, identity, and repository boundaries.
4. [`rpg-gameframe-interface-contract.md`](rpg-gameframe-interface-contract.md) — player-facing and cross-repository interface contract.
5. [`shared/rpg-cloudflare-deployment-architecture.md`](shared/rpg-cloudflare-deployment-architecture.md) — VM-first deployment and later migration boundaries.

## Campaign architecture

1. [`shared/rpg-campaign-compiler-contract.md`](shared/rpg-campaign-compiler-contract.md) — campaign brief normalization and committed package construction.
2. [`shared/rpg-event-and-plot-pool-contract.md`](shared/rpg-event-and-plot-pool-contract.md) — plot families, committed truth, event pools, clue graphs, consequences, and semantic asset roles.
3. [`shared/rpg-one-shot-intro-agent-contract.md`](shared/rpg-one-shot-intro-agent-contract.md) — bounded first-decision behavior using the ordinary live-DM path.
4. [`shared/rpg-monster-master-reference-campaign.md`](shared/rpg-monster-master-reference-campaign.md) — Monster Master RPG as the reference campaign and Arena Battles as the tactical path.
5. [`shared/rpg-cross-repository-integration-testing.md`](shared/rpg-cross-repository-integration-testing.md) — mock, fixture, real service, durable recovery, VM staging, and later migration tests.

## Monster Master creative and lore authority

1. [`monster-master-rpg-current-creative-direction.md`](monster-master-rpg-current-creative-direction.md) — current product, tone, agency, and production direction.
2. [`monster-master-rpg-lore-and-story.md`](monster-master-rpg-lore-and-story.md) — accepted detailed world decisions.
3. [`monster-master-rpg-lore-tone-and-agent-realization.md`](monster-master-rpg-lore-tone-and-agent-realization.md) — compatibility pointer; do not add new decisions there.
4. [`monster-master-rpg-npc-pool.md`](monster-master-rpg-npc-pool.md) — prepared role coverage, incidental NPC continuity, and promotion.

## Asset authority

1. [`monster-master-rpg-asset-register.md`](monster-master-rpg-asset-register.md) — product-wide coverage, priority, lifecycle, and production sequence.
2. [`assets/monster-master-rpg-asset-register.json`](assets/monster-master-rpg-asset-register.json) — machine-readable product registry.
3. [`assets/monster-master-rpg-npc-role-catalog.json`](assets/monster-master-rpg-npc-role-catalog.json) — NPC role-to-portrait-family planning.
4. [`monster-master/assets/README.md`](monster-master/assets/README.md) — concrete Monster Master asset records.
5. [`shared/rpg-rendering-and-asset-contract.md`](shared/rpg-rendering-and-asset-contract.md) — renderer geometry, source-master, derivative, and fallback rules.

The product-wide registry controls sequence. Earlier NPC-first style-lock work orders are superseded and removed.

## Private runtime boundary

RPG GM Runtime owns the private plot catalog, private NPC catalog, selected packages, hidden causes, clue answers, event eligibility, prompts, and campaign continuity. GameFrame owns only the public/shared contracts and presentation vocabulary.

The runtime must consume the existing model-backed live-GM planner. Monster Master package context may specialize that planner but must not create a parallel DM execution path.

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is the canonical shared-document manifest. Every listed Markdown document is canonical in GameFrame and mirrored byte-for-byte into RPG GM Runtime after the GameFrame change merges.

Accepted order:

1. merge the canonical GameFrame document and manifest;
2. synchronize runtime mirrors;
3. run exact-byte drift and focused integration checks;
4. merge the runtime update.

Repository-specific private material belongs in separate runtime documents and fixtures, not in shared mirrors.

## Decision hygiene

Every new decision must update or explicitly supersede the controlling document. Do not add another direction memo that competes with the canonical baseline.
