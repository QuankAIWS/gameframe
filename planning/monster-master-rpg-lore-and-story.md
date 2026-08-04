---
title: Monster Master RPG Lore and Story Decisions
status: developing
document_type: design
authority: owner-approved decisions
owner: Scribbles GameFrame
last_updated: 2026-08-04
applies_to:
  - Monster Master RPG
  - Monster Master: Arena Battles presentation
related:
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-rendering-and-asset-contract.md
  - monster-master-rules.md
---

# Monster Master RPG Lore and Story Decisions

This document records accepted Monster Master RPG fiction, tone, character, and world decisions as they are made. It is intentionally built one bounded decision at a time. Unselected alternatives and speculative lore do not become canon merely because they were discussed.

## Decision 1 — Product tone and player role

Monster Master is a funny fantasy-adventure world where monster training is an established profession.

The player character is a human trainer and a full party member, not a monster or an off-screen commander. Trainers have archetypes, abilities, equipment, social roles, and meaningful participation in exploration and tactical combat. Depending on archetype, a trainer may fight beside called monsters, strengthen them, use ranged magic, heal, control positioning, or specialize in calling and managing a roster.

Monsters are distinct companions and combatants that trainers can call into battle.

The comedy should be dry, situational, and frequently sardonic. The setting may contain danger, consequences, and sincere character moments, but it should not default to solemn mythological exposition, melodramatic fantasy terminology, constant slapstick, or self-aware parody.

### Implementation consequences

- Trainer and monster assets remain separate families.
- The current bootstrap presentation of the Master as a creature is not permanent lore.
- Future combat design must support active trainer archetypes rather than reducing every trainer to the same support unit.
- Future story and lore decisions should be presented in small, separately approvable slices.

## Decision 2 — Capture cubes and monster accommodations

Trainers capture, carry, and call monsters using capture cubes. A cube contains a private interior living space for its assigned monster rather than functioning as a cramped physical container.

Capture cubes have quality tiers. As a monster becomes stronger and more accomplished, it expects better accommodations. A neglected monster becomes increasingly irritated and may eventually refuse to leave its cube until its trainer provides an acceptable upgrade.

Entry-level cubes provide basic shelter. Premium cubes can contain extravagant customized residences. A high-level monster may reasonably demand a mansion, luxury furnishings, automated amenities, and unnecessary fixtures such as gold toilets.

Cube expectations create a recurring progression cost, relationship pressure, status symbol, and source of dry comedy. They should matter without becoming constant inventory maintenance.

### Implementation consequences

- Monster records need an assigned cube, cube tier, accommodation preference, and satisfaction state.
- Progression and economy design must include cube purchases or upgrades.
- Refusal to deploy is a possible consequence of severe accommodation neglect, not a random combat failure.
- Cube interiors can become character scenes, customization spaces, rewards, and visual assets.
- The exact capture procedure and rules for placing a new monster into a cube remain undecided.
