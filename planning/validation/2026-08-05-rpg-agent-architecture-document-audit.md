---
title: RPG Agent Architecture Documentation Audit — 2026-08-05
status: complete
document_type: validation-record
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
related:
  - ../shared/rpg-agent-architecture-and-campaign-package.md
  - ../shared/rpg-platform-roadmap.md
  - ../monster-master-rpg-canonical-baseline.md
---

# RPG Agent Architecture Documentation Audit — 2026-08-05

## Purpose

Record the documentation audit that aligned the repositories to the owner-approved two-agent architecture and roadmap.

This is an evidence record, not a competing authority document.

## Controlling result

The canonical architecture now defines:

- one Campaign Architect;
- one Dungeon Master;
- one CampaignPackage handoff;
- Monster Master as the handcrafted gold-standard package;
- identical validation and Dungeon Master consumption for handcrafted and generated campaigns;
- GameFrame ownership of player experience, deterministic mechanics, Arena Battles, and media materialization;
- RPG GM Runtime ownership of package construction, hidden campaign truth, Dungeon Master intelligence, and campaign continuity;
- machine-play proof before human-ready claims;
- CampaignPackage and gameplay milestones ahead of additional deployment hardening and generated media.

## GameFrame documents changed

### New controlling shared documents

- `planning/shared/rpg-agent-architecture-and-campaign-package.md`
- `planning/shared/rpg-platform-roadmap.md`

### Updated canonical and index documents

- `planning/README.md`
- `planning/rpg-documentation-index.md`
- `planning/monster-master-rpg-canonical-baseline.md`

### Updated platform and ownership documents

- `planning/shared/rpg-platform-product-goals.md`
- `planning/rpg-campaign-experience-directions.md`
- `planning/rpg-gm-runtime-boundary.md`
- `planning/rpg-platform-delivery-plan.md`

### Updated agent and campaign contracts

- `planning/shared/rpg-campaign-compiler-contract.md`
- `planning/shared/rpg-one-shot-intro-agent-contract.md`
- `planning/shared/rpg-event-and-plot-pool-contract.md`
- `planning/shared/rpg-monster-master-reference-campaign.md`
- `planning/shared/rpg-cross-repository-integration-testing.md`

Compatibility filenames and shared document IDs remain where changing them would create unnecessary link drift. Their titles and bodies now use the controlling architecture.

### Updated Monster Master support documents

- `planning/monster-master-rpg-current-creative-direction.md`
- `planning/monster-master-rpg-npc-pool.md`

### Updated media contract

- `planning/shared/rpg-media-theme-and-audio-pipeline.md`

### Updated shared manifest

- `planning/shared/shared-rpg-documents.json`

The new architecture and roadmap are included in the exact-byte shared set for runtime synchronization.

## Reviewed and retained as compatible

### `planning/rpg-gameframe-interface-contract.md`

Retained because its technical identity, command, projection, revision, retry, encounter, and audience contracts are compatible with the new architecture. The new shared architecture controls which agent produces or consumes those contracts.

### `planning/monster-master-rpg-lore-and-story.md`

Retained as the detailed lore ledger. Its early dry-comedy wording is historical and explicitly superseded by:

1. `planning/monster-master-rpg-canonical-baseline.md`;
2. `planning/monster-master-rpg-current-creative-direction.md`.

All mechanical and world-lore decisions remain intact. Future edits should amend the ledger directly when touching that section, but the authority order is unambiguous now.

### Asset registry and asset record documents

Retained because they govern asset identity, production, provenance, and lifecycle rather than campaign-agent architecture. Their work is subordinate to CampaignPackage requirements and the shared roadmap.

### Deployment architecture and runbooks

Retained because the VM-first and Cloudflare-facing topology remains accepted. The roadmap now clarifies that additional hardening does not outrank CampaignPackage and agent-loop work unless a concrete deployment issue blocks development or play.

### Existing protocol and persistence implementation records

Retained as factual implementation evidence. They do not define campaign-agent architecture or roadmap priority.

## Contradictions removed

- campaign compiler, plot agent, and campaign generator no longer appear as separate product agents;
- the old intro-agent contract no longer defines a third agent;
- raw premise submission to the Dungeon Master is no longer accepted as campaign creation;
- Monster Master is no longer described as the platform architecture or a special Dungeon Master path;
- plot and NPC catalogs are no longer described as complete executable campaigns;
- theme-on-demand and generated media are no longer first-product-proof requirements;
- deployment and deterministic shell work no longer precede the executable package and agent milestones;
- transport tests and canned openings are explicitly prevented from claiming campaign functionality.

## Required runtime synchronization

After the GameFrame documentation change merges:

1. copy the updated shared manifest and every changed shared document byte-for-byte into `QuankAIWS/rpg-gm-runtime/docs/shared/`;
2. update runtime-local documentation indexes, architecture, product direction, implementation plan, and Monster Master private documents;
3. run exact-byte drift verification;
4. run focused runtime documentation and current-GameFrame checks;
5. merge the runtime documentation change.

## Audit conclusion

The GameFrame documentation set has one controlling architecture and one controlling roadmap. Remaining older terminology is either removed, explicitly an alias, or retained only in compatibility filenames and historical records with clear precedence.
