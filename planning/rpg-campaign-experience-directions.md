---
title: RPG Campaign Experience Direction
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
supersedes:
  - Discord-first illustrated campaign direction
  - unresolved Discord-first versus game-heavy evaluation
related:
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
---

# RPG Campaign Experience Direction

## Decision

The RPG is an **all-GameFrame interface experience**. GameFrame is the complete authenticated player-facing application for the campaign. The browser client and Discord Activity wrapper present the same game rather than splitting narration into Discord and mechanics into a separate tactical application.

Discord remains useful for voice, social conversation, invitations, notifications, and links into the active campaign. It is not the primary or authoritative gameplay interface.

## Required player experience

GameFrame must eventually support one continuous campaign session containing:

- campaign creation, joining, seats, invitations, and resume;
- narration, scene art, NPC dialogue, and cinematic presentation;
- freeform action entry and structured choices;
- character sheets, abilities, conditions, progression, inventory, and equipment;
- quests, objectives, factions, and known campaign information;
- locations, maps, exploration, and points of interest;
- checks, dice, consequences, and player-private reveals;
- tactical encounters using the existing GameFrame authority and renderer;
- return from encounters to the same campaign interface;
- durable history, reconnect, recovery, and later-session continuation.

GameFrame may present distinct modes such as scene, dialogue, character, inventory, exploration, encounter, and recap. They remain one product, one authenticated campaign session, and one coherent navigation model.

## Runtime boundary

The all-GameFrame decision concerns the interface, not ownership of all campaign reasoning.

RPG GM Runtime owns campaign continuity, semantic world state, NPC reasoning, narration, freeform-intent interpretation, audience-scoped secrets, model orchestration, and narrative consequences.

GameFrame owns authenticated player commands, the complete player presentation surface, structured player-visible projections, mechanics deliberately implemented in GameFrame, tactical state, replay, reconnect, and committed mechanical outcomes.

Scribbles Runtime owns Theo and the connector that lets Theo occupy an ordinary GameFrame player seat. Theo does not receive GM-only context or hidden campaign state.

## Improvisation without a generalized CRPG engine

All-GameFrame does not require every improvised narrative object to become a bespoke mechanic. The client should provide reusable semantic primitives for scenes, dialogue, cards, entities, choices, freeform actions, checks, maps, media, and handouts.

A narrative concept becomes a GameFrame-owned mechanic only when repeated product value justifies a stable schema, authoritative transitions, persistence, projections, UI, migration posture, and tests.

This preserves GM improvisation while keeping the entire player experience inside GameFrame.

## Presentation direction

The campaign interface should be battlefield-capable but not battlefield-dominated. Outside encounters, the map or scene art may remain the visual background while layered panels present dialogue, choices, character information, inventory, quests, or handouts. During tactical play, the existing GameFrame battlefield becomes authoritative and primary without ejecting players into another application.

Generated and composed media must be cached, versioned, and nonblocking. A missing portrait or scene image may reduce presentation quality but cannot prevent legal campaign play.

## Governing rule

> GameFrame is the whole player experience; RPG GM Runtime is the campaign intelligence behind it. Preserve one coherent interface without collapsing the two authority domains into one service.
