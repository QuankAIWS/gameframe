---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-07
applies_to:
  - scribbles-gameframe-rpg-planning
related:
  - README.md
  - ROADMAP.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-platform-roadmap.md
  - monster-master-rpg-canonical-baseline.md
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

1. [`shared/rpg-agent-architecture-and-campaign-package.md`](shared/rpg-agent-architecture-and-campaign-package.md) — controlling two-agent architecture, official names, CampaignPackage handoff, handcrafted/generated equivalence, Monster Master role, campaign-opening rules, and testing requirements.
2. [`shared/rpg-platform-roadmap.md`](shared/rpg-platform-roadmap.md) — controlling cross-repository implementation order and milestone gates.
3. [`ROADMAP.md`](ROADMAP.md) — current GameFrame-local implementation direction and completed/active platform slices.
4. [`monster-master-rpg-canonical-baseline.md`](monster-master-rpg-canonical-baseline.md) — Monster Master-specific authority, lore, assets, and gold-standard package posture.
5. Read the specific GameFrame interface, creative, asset, or deployment contract required by the active slice.

Do not reconstruct the architecture from chat history, a sample fixture, a raw premise, an old work order, or an implementation branch.

## What the core documents answer

| Document | Question |
| --- | --- |
| `shared/rpg-agent-architecture-and-campaign-package.md` | What is the canonical RPG agent/package architecture? |
| `shared/rpg-platform-roadmap.md` | Where is the cross-repository RPG platform going? |
| `ROADMAP.md` | What GameFrame platform work is complete, active, or deferred? |
| `rpg-gameframe-interface-contract.md` | What does GameFrame expose to players/runtime? |
| `monster-master-rpg-canonical-baseline.md` | What Monster Master decisions are authoritative? |
| `rpg-platform-delivery-plan.md` | How does GameFrame delivery map onto the shared roadmap? |

Do not create a second local roadmap or competing architecture memo when one of these controlling documents can be updated.

## Official agent terms

- **Campaign Architect** creates complete CampaignPackages before play.
- **Dungeon Master** conducts live play from a committed CampaignPackage and the durable journal. Live DM is acceptable internal shorthand.
- Campaign compiler and plot agent are retired aliases for capabilities inside the Campaign Architect, not compatibility interfaces.
- There is no separate intro agent or intro-agent contract. The opening is the first Dungeon Master turn and is governed by the main agent/package contract.

## Platform and ownership

1. [`rpg-campaign-experience-directions.md`](rpg-campaign-experience-directions.md) — accepted all-GameFrame player experience.
2. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — durable product objective.
3. [`rpg-gm-runtime-boundary.md`](rpg-gm-runtime-boundary.md) — repository and authority boundaries.
4. [`rpg-gameframe-interface-contract.md`](rpg-gameframe-interface-contract.md) — player-facing and cross-repository interface contract.
5. [`shared/rpg-cloudflare-deployment-architecture.md`](shared/rpg-cloudflare-deployment-architecture.md) — VM-first deployment and later migration boundaries.

## Campaign architecture

1. [`shared/rpg-campaign-architect-contract.md`](shared/rpg-campaign-architect-contract.md) — detailed future Campaign Architect brief normalization and package construction contract.
2. [`shared/rpg-event-and-plot-pool-contract.md`](shared/rpg-event-and-plot-pool-contract.md) — plot families, committed truth, events, clues, consequences, and asset roles.
3. [`shared/rpg-monster-master-reference-campaign.md`](shared/rpg-monster-master-reference-campaign.md) — Monster Master as the handcrafted reference package and Arena Battles proving ground.
4. [`shared/rpg-cross-repository-integration-testing.md`](shared/rpg-cross-repository-integration-testing.md) — mock, fixture, actual service, durable recovery, browser, VM, and later migration test layers.

Campaign Architect is intentionally downstream of the handcrafted Monster Master proof and a materially different second package. Future-agent contracts must not displace current vertical-slice work.

## Monster Master creative and lore authority

1. [`monster-master-rpg-current-creative-direction.md`](monster-master-rpg-current-creative-direction.md) — current product, tone, agency, and production direction.
2. [`monster-master-rpg-lore-and-story.md`](monster-master-rpg-lore-and-story.md) — accepted detailed world decisions.
3. [`monster-master-rpg-lore-tone-and-agent-realization.md`](monster-master-rpg-lore-tone-and-agent-realization.md) — compatibility pointer only.
4. [`monster-master-rpg-npc-pool.md`](monster-master-rpg-npc-pool.md) — prepared role coverage and incidental NPC continuity.

## Asset and media authority

1. [`shared/rpg-media-theme-and-audio-pipeline.md`](shared/rpg-media-theme-and-audio-pipeline.md) — Campaign Architect asset intent, GameFrame materialization, and Dungeon Master usage boundary.
2. [`monster-master-rpg-asset-register.md`](monster-master-rpg-asset-register.md) — product-wide coverage, priority, lifecycle, and production sequence.
3. `assets/monster-master-rpg-asset-register.json` — machine-readable product registry.
4. `assets/monster-master-rpg-npc-role-catalog.json` — role-to-portrait-family planning.
5. `monster-master/assets/README.md` — concrete asset records.
6. [`shared/rpg-rendering-and-asset-contract.md`](shared/rpg-rendering-and-asset-contract.md) — renderer, source-master, derivative, and fallback rules.

## Roadmap authority

- `shared/rpg-platform-roadmap.md` is the durable cross-repository roadmap and owns RPG milestone order.
- `ROADMAP.md` is the GameFrame-local roadmap and records completed/active platform work.
- `rpg-platform-delivery-plan.md` maps GameFrame delivery onto the shared roadmap and must not reorder it.

The current product path remains: executable package/Dungeon Master semantics → truthful and durable Monster Master Arena handoff → complete single-player campaign proof → multiplayer/cooperative control → second package → Campaign Architect.

## Private runtime boundary

RPG GM Runtime owns package schemas, validation, private packages, hidden truth, Campaign Architect orchestration, Dungeon Master orchestration, prompts, continuity, clue answers, event eligibility, and instantiated NPC continuity.

GameFrame owns player-facing intake, package preview, presentation, semantic asset resolution and generation, structured deterministic mechanics, and Arena Battles authority.

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is canonical. Every listed document is mirrored byte-for-byte into RPG GM Runtime only after the GameFrame change merges.

Accepted order:

1. merge canonical GameFrame documents and manifest;
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

Local `related` and `depends_on` references must resolve. Shared documents additionally carry canonical repository/path/version metadata and `sync_policy: exact-byte-copy`.

Validate with:

```bash
python3 scripts/check-rpg-planning-docs.py
```

A focused GitHub Actions lane runs this check for RPG planning changes without requiring the full GameFrame test suite.

## Decision hygiene

Every new architecture or roadmap decision must update or explicitly supersede the controlling document. Do not add competing direction memos merely to preserve historical wording; Git history already preserves history.
