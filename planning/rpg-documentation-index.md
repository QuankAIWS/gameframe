---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe-rpg-planning
related:
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
  - tactical-battler-rpg-foundation.md
  - rpg-platform-delivery-plan.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-cloudflare-deployment-architecture.md
  - shared/rpg-media-theme-and-audio-pipeline.md
---

# RPG GameFrame Documentation

Read the canonical RPG planning documents in this order:

1. [`rpg-campaign-experience-directions.md`](rpg-campaign-experience-directions.md) — accepted all-GameFrame product direction.
2. [`shared/rpg-platform-product-goals.md`](shared/rpg-platform-product-goals.md) — durable end-state, Cloudflare posture, Discord role, theme flexibility, and product acceptance proof.
3. [`rpg-gm-runtime-boundary.md`](rpg-gm-runtime-boundary.md) — authority, identity, and repository boundaries.
4. [`shared/rpg-cloudflare-deployment-architecture.md`](shared/rpg-cloudflare-deployment-architecture.md) — Workers, Durable Objects, invitations, projections, queues, storage, and failure isolation.
5. [`rpg-gameframe-interface-contract.md`](rpg-gameframe-interface-contract.md) — required full campaign interface and cross-repository contract.
6. [`shared/rpg-media-theme-and-audio-pipeline.md`](shared/rpg-media-theme-and-audio-pipeline.md) — theme translation, catalogs, composition, image generation, narration audio, provenance, and fallbacks.
7. [`tactical-battler-rpg-foundation.md`](tactical-battler-rpg-foundation.md) — existing tactical foundation and its role inside the wider RPG client.
8. [`rpg-platform-delivery-plan.md`](rpg-platform-delivery-plan.md) — phased implementation and acceptance gates.

## Shared-document policy

The three documents under `planning/shared/` are canonical cross-repository documents. Exact-byte mirrors live under `docs/shared/` in `QuankAIWS/rpg-gm-runtime`. The runtime repository owns a scheduled and pull-request drift check against GameFrame `main` because the public GameFrame copy can be read without granting the public repository access to the private runtime.

Update the canonical GameFrame document first, merge it, then update the runtime mirror in a coordinated pull request. Do not independently edit a mirror.

## Front-matter policy

Every canonical RPG Markdown document begins with YAML front matter containing `title`, `status`, `document_type`, `owner`, `last_updated`, and `applies_to`. A later decision must update or explicitly supersede the controlling document instead of adding a competing direction memo.
