---
title: RPG Campaign Experience Direction
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - scribbles-runtime-theo-connector
supersedes:
  - Discord-first illustrated campaign direction
  - unresolved Discord-first versus game-heavy evaluation
related:
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
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

Those inputs are sent through authenticated boundaries to the Campaign Architect when that agent exists. The Campaign Architect returns a player-safe preview and hidden validated CampaignPackage draft. GameFrame presents only player-safe assumptions, repair questions, owner-authorized editing surfaces, and confirmation material.

Monster Master initially enters as a handcrafted package. A materially different second handcrafted package must prove the same runtime abstraction before Campaign Architect generation becomes an active platform dependency.

## Campaign play experience

After package acceptance, the Dungeon Master conducts the campaign through GameFrame while durable runtime state owns exact identity, physical presence, knowledge, and campaign-instance continuity.

GameFrame must eventually support:

- campaign joining, seats, invitations, and resume;
- narration, scene art, NPC dialogue, and cinematic presentation;
- **Act / Speak** freeform input for in-fiction declarations;
- **Ask Game Master** for player-to-GM rules/knowledge/clarification questions that do not automatically become fictional speech;
- optional editable suggestions and rare structured choices;
- **People / Characters** showing only people and facts the player character actually knows;
- a viewer-safe **Current Scene** showing who/what is physically present as authorized;
- player-safe entity inspection;
- character, creature, ability, condition, progression, inventory, and equipment views;
- quests, objectives, factions, clues, and known campaign information;
- locations, maps, exploration, and points of interest;
- checks, dice, consequences, and player-private reveals;
- tactical encounters using Arena Battles authority;
- authoritative return from encounters to the same campaign after runtime aftermath/reconciliation;
- history, recap, reconnect, recovery, and later-session continuation.

Distinct modes may exist, but they remain one campaign application and authenticated session.

## Persistent-world player expectation

The player should not have to infer durable world facts from old narration.

As implemented, GameFrame should make legible:

- whom the character knows;
- the best identity label the character is currently entitled to use;
- who is physically present in the current scene;
- active objectives and important known facts;
- character/companion state;
- whether an Arena encounter is active, complete, reconciling, or ready to resume.

A hidden runtime canonical name is never a reason to show that name to the player.

## Runtime boundary

RPG GM Runtime contains:

- the Campaign Architect, which eventually creates CampaignPackages before play;
- the Dungeon Master, which runs committed packages during play;
- package validation and hidden truth;
- campaign journal;
- Entity Registry and Character Factory;
- Scene Registry;
- semantic knowledge/player projection;
- Dungeon Master Context Compiler;
- typed semantic validation and scene-to-encounter compilation.

GameFrame owns authenticated intake/commands, player-safe projections, complete presentation, structured mechanics, semantic asset materialization, tactical state, and committed mechanical outcomes.

Scribbles Runtime owns Theo and the connector that lets Theo occupy an ordinary GameFrame player seat. Theo receives no hidden package or Dungeon Master context.

## Freeform and improvisation rule

The Dungeon Master may respond to arbitrary plausible player action and may request compatible incidental detail/people. Suggestions are not the complete action space.

All-GameFrame does not require every improvised object to become a bespoke mechanic. Repeated concepts become authoritative mechanics only when product value justifies schema, persistence, UI, migration, and tests.

If an improvised person becomes durable, Character Factory/Entity Registry/Scene Registry—not model prose—own that identity and presence.

## Ask-GM posture

Ask-GM is out-of-fiction by default.

- present NPCs do not hear it;
- it does not advance fictional time merely because the question was asked;
- the answer uses only player-authorized character knowledge and committed rules/mechanics;
- if the character does not know, uncertainty remains uncertainty;
- request/response is player-private by default unless a later explicit command requests broader party/table visibility.

Fictional audibility and presentation audience are separate semantics.

## Tactical transition posture

Arena Battles is a stricter resolution mode for the current campaign scene.

Campaign-bound battles should preserve exact supported scene entities/objectives and use campaign-specific terminal presentation. A completed campaign encounter should lead primarily back to the campaign, not to generic `New Duel` or `Return Home` actions.

Returning to the RPG route is not itself authoritative aftermath. Narrative input remains fenced until runtime reconciliation publishes the post-encounter resumable state.

## Presentation and media direction

The campaign interface should be battlefield-capable but not battlefield-dominated. Outside encounters, scene art or maps may remain the visual foundation while layered panels present dialogue, People/current-scene information, character information, clues, inventory, quests, or handouts.

The Campaign Architect declares semantic media needs. GameFrame resolves, composes, generates, caches, validates, and versions presentation assets. The Dungeon Master uses accepted identities during play.

Missing media may reduce presentation quality but cannot prevent legal campaign play.

## Campaign-length posture

The engineering vertical slice may use a bounded starter chapter to prove the complete architecture. That is an evidence strategy, not the mature product ceiling.

The platform is intended for durable campaigns that can continue across multiple sessions, with longer progression, relationships, recurring locations, inventory/care, and continuation systems promoted as actual campaigns prove their need.

## Governing rule

> GameFrame owns the complete player journey; runtime owns the durable world behind it; the Dungeon Master interprets that world; and the UI makes action intent, known people, current scene, and authoritative tactical return explicit instead of asking the player to reconstruct them from prose.
