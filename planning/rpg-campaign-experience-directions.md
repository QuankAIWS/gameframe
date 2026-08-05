---
title: RPG Campaign Experience Direction
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-05
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
supersedes:
  - Discord-first illustrated campaign direction
  - unresolved Discord-first versus game-heavy evaluation
related:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-platform-roadmap.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
---

# RPG Campaign Experience Direction

## Decision

The RPG is an **all-GameFrame player experience**. GameFrame is the complete authenticated application for campaign creation, campaign play, mechanics, tactical encounters, history, and resume.

Discord remains useful for voice, invitations, notifications, links, social conversation, and a future guided campaign-creation interview. It is not the authoritative gameplay interface and does not own campaign truth.

## Campaign creation experience

GameFrame should eventually let a player or group create a campaign through:

- a concise freeform concept;
- a detailed description;
- a structured campaign sheet;
- a guided GameFrame flow;
- an optional Discord interview;
- selection of a prepared campaign such as Monster Master.

Those inputs are sent through authenticated boundaries to the Campaign Architect. The Campaign Architect returns a player-safe preview and a hidden validated CampaignPackage. GameFrame presents only player-safe assumptions, repair questions, and confirmation material.

Monster Master may initially enter as a handcrafted package rather than a generated one, but it uses the same preview, commitment, and Dungeon Master interface.

## Campaign play experience

After package acceptance, the Dungeon Master conducts the campaign through GameFrame.

GameFrame must eventually support:

- campaign joining, seats, invitations, and resume;
- narration, scene art, NPC dialogue, and cinematic presentation;
- freeform action entry as the primary narrative input;
- optional editable suggestions and rare structured choices;
- character, creature, ability, condition, progression, inventory, and equipment views;
- quests, objectives, factions, clues, and known campaign information;
- locations, maps, exploration, and points of interest;
- checks, dice, consequences, and player-private reveals;
- tactical encounters using Arena Battles authority;
- return from encounters to the same campaign;
- history, recap, reconnect, recovery, and later-session continuation.

Distinct modes may exist, but they remain one campaign application and authenticated session.

## Runtime boundary

RPG GM Runtime contains:

- the Campaign Architect, which creates CampaignPackages before play;
- the Dungeon Master, which runs committed packages during play;
- package validation, hidden truth, campaign journal, freeform interpretation, NPC continuity, model orchestration, and narrative consequences.

GameFrame owns authenticated intake and commands, player-safe package preview, complete presentation, structured mechanics, semantic asset materialization, tactical state, and committed mechanical outcomes.

Scribbles Runtime owns Theo and the connector that lets Theo occupy an ordinary GameFrame player seat. Theo receives no hidden package or Dungeon Master context.

## Freeform and improvisation rule

The Dungeon Master may respond to arbitrary plausible player action and may create compatible incidental detail. Suggestions are not the complete action space.

All-GameFrame does not require every improvised object to become a bespoke mechanic. GameFrame provides reusable semantic primitives. Repeated concepts become authoritative mechanics only when product value justifies schema, persistence, UI, migration, and tests.

## Presentation and media direction

The campaign interface should be battlefield-capable but not battlefield-dominated. Outside encounters, scene art or maps may remain the visual foundation while layered panels present dialogue, character information, clues, inventory, quests, or handouts.

The Campaign Architect declares semantic media needs. GameFrame resolves, composes, generates, caches, validates, and versions presentation assets. The Dungeon Master uses accepted identities during play.

Missing media may reduce presentation quality but cannot prevent legal campaign play.

## Governing rule

> GameFrame owns the complete player journey from campaign idea through campaign play; the Campaign Architect builds the package; the Dungeon Master runs it; and Discord remains an optional social and intake surface rather than a second game.
