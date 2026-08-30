---
title: GameFrame Planning Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-07
applies_to:
  - scribbles-gameframe
  - scribbles-gameframe-rpg-planning
related:
  - rpg-documentation-index.md
  - ROADMAP.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-platform-roadmap.md
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rules.md
---

# GameFrame Planning


## Cascade Crush planning

For Cascade campaign or level-generation work, use these current authorities:

- [`cascade-10000-campaign-roadmap.md`](cascade-10000-campaign-roadmap.md) — campaign progression, difficulty horizon, and 150-level production cadence;
- [`cascade-cognitive-health-and-engagement.md`](cascade-cognitive-health-and-engagement.md) — older-player cognitive-health, memory-mechanic, and engagement design;
- [`research/cascade-cognitive-health-research.md`](research/cascade-cognitive-health-research.md) — retained health/cognition evidence and open research questions;
- [`research/cascade-match3-engagement-research.md`](research/cascade-match3-engagement-research.md) — retained Candy Crush / Royal Match engagement and mechanic research;
- [`cascade-testing-methodology.md`](cascade-testing-methodology.md) — simulator/persona, calibration, hidden-information, validation, and evidence policy;
- [`casual-games-match3-foundation.md`](casual-games-match3-foundation.md) — current Cascade product/gameplay foundation.

[`cascade-cognitive-design-and-playtesting.md`](cascade-cognitive-design-and-playtesting.md) is historical design material and is not operational authority.

For RPG work, start with [`rpg-documentation-index.md`](rpg-documentation-index.md). It defines the canonical reading order and separates platform contracts, Monster Master authority, Arena rules, media/assets, deployment, and integration evidence.

The controlling RPG architecture uses one **Campaign Architect**, one **Dungeon Master**, and one durable **CampaignPackage** handoff. Monster Master is the handcrafted gold-standard package used to prove that platform.

Core entry points:

- [`shared/rpg-agent-architecture-and-campaign-package.md`](shared/rpg-agent-architecture-and-campaign-package.md) — controlling cross-repository agent/package architecture;
- [`shared/rpg-platform-roadmap.md`](shared/rpg-platform-roadmap.md) — controlling RPG platform milestone order;
- [`monster-master-rpg-canonical-baseline.md`](monster-master-rpg-canonical-baseline.md) — Monster Master-specific campaign authority;
- [`monster-master-rules.md`](monster-master-rules.md) — fixed MM-0001 Arena rules and the boundary to future campaign-configured encounters;
- [`ROADMAP.md`](ROADMAP.md) — GameFrame-local implementation roadmap.

Do not reconstruct RPG architecture from chat history or treat a raw premise, deterministic fixture, plot catalog, old work order, or implementation branch as a complete campaign system.

RPG planning documents are expected to carry YAML front matter and valid local relationship links. Selected engineering documents also validate repository-relative source paths so stale module names fail the focused documentation-hygiene check.
