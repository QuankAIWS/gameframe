---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe-rpg-planning
related:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-platform-roadmap.md
  - monster-master-rpg-canonical-baseline.md
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
  - shared/rpg-campaign-compiler-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-one-shot-intro-agent-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-rendering-and-asset-contract.md
  - shared/rpg-cross-repository-integration-testing.md
---

# RPG GameFrame Documentation

## Required reading order

1. [`shared/rpg-agent-architecture-and-campaign-package.md`](shared/rpg-agent-architecture-and-campaign-package.md) — controlling two-agent architecture, official names, CampaignPackage handoff, handcrafted/generated equivalence, Monster Master role, and testing requirements.
2. [`shared/rpg-platform-roadmap.md`](shared/rpg-platform-roadmap.md) — controlling implementation order and milestone gates.
3. [`monster-master-rpg-canonical-baseline.md`](monster-master-rpg-canonical-baseline.md) — Monster Master-specific authority, lore, assets, and gold-standard package posture.

Do not reconstruct the architecture from chat history, a sample fixture, a raw premise, an old work order, or an implementation branch.

## Official agent terms

- **Campaign Architect** creates complete CampaignPackages before play. Campaign compiler and plot agent are older aliases for parts of this responsibility.
- **Dungeon Master** conducts live play from a committed CampaignPackage and the durable journal. Live DM is an acceptable internal shorthand.
- There is no separate intro agent. The opening is the first Dungeon Master turn.

## Platform and ownership

1. [`rpg-campaign-experience-directions.md`](rpg-campaign-experience-directions.md) — accepted all-GameFrame player experience.
2. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — durable product objective.
3. [`rpg-gm-runtime-boundary.md`](rpg-gm-runtime-boundary.md) — repository and authority boundaries.
4. [`rpg-gameframe-interface-contract.md`](rpg-gameframe-interface-contract.md) — player-facing and cross-repository interface contract.
5. [`shared/rpg-cloudflare-deployment-architecture.md`](shared/rpg-cloudflare-deployment-architecture.md) — VM-first deployment and later migration boundaries.

## Campaign architecture

1. [`shared/rpg-campaign-compiler-contract.md`](shared/rpg-campaign-compiler-contract.md) — detailed Campaign Architect brief normalization and package construction contract.
2. [`shared/rpg-event-and-plot-pool-contract.md`](shared/rpg-event-and-plot-pool-contract.md) — plot families, committed truth, events, clues, consequences, and asset roles.
3. [`shared/rpg-one-shot-intro-agent-contract.md`](shared/rpg-one-shot-intro-agent-contract.md) — compatibility filename for the campaign-opening and Dungeon Master contract; it does not define another agent.
4. [`shared/rpg-monster-master-reference-campaign.md`](shared/rpg-monster-master-reference-campaign.md) — Monster Master as the handcrafted reference package and Arena Battles proving ground.
5. [`shared/rpg-cross-repository-integration-testing.md`](shared/rpg-cross-repository-integration-testing.md) — mock, fixture, actual service, durable recovery, browser, VM, and later migration test layers.

## Monster Master creative and lore authority

1. [`monster-master-rpg-current-creative-direction.md`](monster-master-rpg-current-creative-direction.md) — current product, tone, agency, and production direction.
2. [`monster-master-rpg-lore-and-story.md`](monster-master-rpg-lore-and-story.md) — accepted detailed world decisions.
3. [`monster-master-rpg-lore-tone-and-agent-realization.md`](monster-master-rpg-lore-tone-and-agent-realization.md) — compatibility pointer only.
4. [`monster-master-rpg-npc-pool.md`](monster-master-rpg-npc-pool.md) — prepared role coverage and incidental NPC continuity.

## Asset and media authority

1. [`shared/rpg-media-theme-and-audio-pipeline.md`](shared/rpg-media-theme-and-audio-pipeline.md) — Campaign Architect asset intent, GameFrame materialization, and Dungeon Master usage boundary.
2. [`monster-master-rpg-asset-register.md`](monster-master-rpg-asset-register.md) — product-wide coverage, priority, lifecycle, and production sequence.
3. [`assets/monster-master-rpg-asset-register.json`](assets/monster-master-rpg-asset-register.json) — machine-readable product registry.
4. [`assets/monster-master-rpg-npc-role-catalog.json`](assets/monster-master-rpg-npc-role-catalog.json) — role-to-portrait-family planning.
5. [`monster-master/assets/README.md`](monster-master/assets/README.md) — concrete asset records.
6. [`shared/rpg-rendering-and-asset-contract.md`](shared/rpg-rendering-and-asset-contract.md) — renderer, source-master, derivative, and fallback rules.

## Roadmap authority

`shared/rpg-platform-roadmap.md` is the durable cross-repository roadmap. `rpg-platform-delivery-plan.md` maps GameFrame work onto that roadmap and must not reorder its milestones.

The current priority is executable CampaignPackage → handcrafted Monster Master package → package-aware Dungeon Master → machine-play proof → playable GameFrame campaign → Campaign Architect generated campaign.

## Private runtime boundary

RPG GM Runtime owns package schemas, validation, private packages, hidden truth, Campaign Architect orchestration, Dungeon Master orchestration, prompts, continuity, clue answers, event eligibility, and instantiated NPC continuity.

GameFrame owns player-facing intake, package preview, presentation, semantic asset resolution and generation, structured mechanics, and Arena Battles authority.

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is canonical. Every listed document is mirrored byte-for-byte into RPG GM Runtime only after the GameFrame change merges.

Accepted order:

1. merge canonical GameFrame documents and manifest;
2. synchronize runtime mirrors;
3. run exact-byte drift and focused integration checks;
4. merge runtime updates.

## Decision hygiene

Every new architecture or roadmap decision must update or supersede the controlling shared document. Do not add competing direction memos.
