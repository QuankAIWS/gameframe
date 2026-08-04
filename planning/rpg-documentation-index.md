---
title: RPG GameFrame Documentation Index
status: active
document_type: index
owner: Scribbles GameFrame
last_updated: 2026-08-04
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
6. [`shared/rpg-media-theme-and-audio-pipeline.md`](shared/rpg-media-theme-and-audio-pipeline.md) — theme translation, catalogs, composition, image generation, narration audio, provenance, and fallbacks.
7. [`shared/rpg-monster-master-reference-campaign.md`](shared/rpg-monster-master-reference-campaign.md) — Monster Master: Arena Battles, Monster Master RPG, prepared asset-pack strategy, and the first complete campaign proof.
8. [`shared/rpg-cross-repository-integration-testing.md`](shared/rpg-cross-repository-integration-testing.md) — mock, fixture, actual GameFrame, workerd, and deployed staging test layers.
9. [`tactical-battler-rpg-foundation.md`](tactical-battler-rpg-foundation.md) — existing tactical foundation and its role inside the wider RPG client.
10. [`rpg-platform-delivery-plan.md`](rpg-platform-delivery-plan.md) — phased implementation and acceptance gates.

## Shared-document policy

`planning/shared/shared-rpg-documents.json` is the canonical machine-readable manifest for cross-repository documents.

Every Markdown file listed by the manifest is canonical in GameFrame and has an exact-byte mirror under `docs/shared/` in `QuankAIWS/rpg-gm-runtime`. The runtime also mirrors the manifest itself.

The private runtime owns the synchronization and drift tooling because it can read public GameFrame files without exposing private runtime code or credentials to public CI.

Accepted update flow:

1. edit and merge the canonical GameFrame document and manifest;
2. run the runtime sync command to pull every canonical file;
3. run the exact-byte drift check;
4. merge the coordinated runtime update.

Do not independently edit a runtime mirror. Repository-specific extensions belong in separate local documents that link to the shared canonical document.

## Candidate rule

A document belongs in `planning/shared/` when all of the following are true:

- it controls behavior or sequencing in both repositories;
- GameFrame is the natural canonical owner or public integration reference;
- contradictory copies would create implementation drift;
- the complete document can be public without exposing runtime secrets or private campaign data.

Repository-internal implementation notes, private runtime prompts, provider credentials, incidents, and temporary branch plans are not shared-document candidates.

## Front-matter policy

Every canonical RPG Markdown document begins with YAML front matter containing `title`, `status`, `document_type`, `owner`, `last_updated`, and `applies_to`. Shared Markdown documents also declare stable identity, version, canonical path, mirrors, and exact-byte synchronization policy.

A later decision must update or explicitly supersede the controlling document instead of adding a competing direction memo.
