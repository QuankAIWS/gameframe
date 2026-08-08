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
  - transcript-first ordinary RPG play as the mature primary experience
related:
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
---

# RPG Campaign Experience Direction

## Decision

The RPG is an **all-GameFrame embodied campaign experience**. GameFrame is the complete authenticated application for campaign creation, world exploration, direct interaction, Dungeon Master communication, mechanics, tactical encounters, history, and resume.

The mature primary loop is a playable persistent 2D world: players move through materialized locations, approach characters, inspect/interact with objects, take supported actions directly, and enter Arena Battles from the same campaign scene.

The Dungeon Master remains a real and visible GM. It does not disappear into the world. Players retain a dedicated Ask-GM communication/history surface, and the GM may proactively interrupt or freeze the world for meaningful narration/adjudication. Freeform intent remains available whenever fixed videogame interactions cannot express a plausible tabletop action.

Discord remains useful for voice, invitations, notifications, links, social conversation, and a future guided campaign-creation interview. It is not the authoritative gameplay interface and does not own campaign truth.

## Campaign creation experience

GameFrame should eventually let a player/group create a campaign through:

- a concise freeform concept;
- a detailed description;
- a structured campaign sheet;
- a guided GameFrame flow;
- an optional Discord interview;
- selection of a prepared campaign such as Monster Master.

Those inputs are sent through authenticated boundaries to the Campaign Architect when that agent exists. The Campaign Architect returns a player-safe preview and hidden validated CampaignPackage draft.

The package includes semantic world/location/materialization requirements as well as actors, events, clues, rules, and tactical opportunities. It does not embed Pixi geometry or generated map screenshots as campaign truth.

Monster Master initially enters as a handcrafted package. A materially different second handcrafted world must prove the same runtime/exploration abstraction before Campaign Architect generation becomes an active platform dependency.

## Mature campaign play experience

After package acceptance:

1. runtime initializes durable world/entity/scene/observer-knowledge state;
2. GameFrame materializes the starting exploration scene;
3. the player physically explores and interacts;
4. significant world changes commit through semantic authority;
5. the Dungeon Master handles unusual intent, GM communication, events, consequences, and character performance through bounded context modes;
6. tactical encounters become a stricter mode for the current scene and reconcile back into the same world.

GameFrame must eventually support:

- campaign joining, seats, invitations, and resume;
- playable 2D exploration scenes;
- player avatars, movement, camera, collision, picking, interaction range, and scene transitions;
- direct NPC/entity dialogue with viewer-safe speaker identity;
- perspective-bounded NPC performance rather than omniscient NPC dialogue;
- **Do Something Else** freeform input for plausible unsupported actions;
- **Ask Game Master** for rules/knowledge/clarification questions that do not automatically become fictional speech;
- GM-initiated interventions/narration, including occasional dramatic pause/freeze presentation;
- People/Characters showing only people/facts the player character actually knows;
- viewer-safe current scene/world information;
- player-safe entity inspection;
- character, creature, ability, condition, progression, inventory, and equipment views;
- quests, objectives, factions, clues, and known campaign information;
- locations, maps, exploration routes, and points of interest;
- checks, dice, consequences, and player-private reveals;
- tactical encounters using Arena Battles authority;
- authoritative return from encounters to the surrounding materialized scene after runtime reconciliation;
- GM communication log, campaign history, recap, reconnect, recovery, and later-session continuation.

Distinct modes may exist, but they remain one campaign application and authenticated session.

## Tabletop agency rule

The graphical world may not become the complete action vocabulary.

A player should normally click/use/walk for supported behavior. But if the player wants to attempt something plausible the software does not have a button for, they use Do Something Else and the Dungeon Master interprets it.

Examples:

- climb a tree to scout;
- cut through visible/known woods rather than use the road;
- ask Pell to hold position while the player circles around;
- improvise a distraction;
- manipulate a world object in an unusual but plausible way.

The absence of a dedicated control does not prove impossibility.

Repeated useful behaviors may later become dedicated deterministic mechanics. One-off improvisation remains valid without turning every action into a permanent subsystem.

## Direct NPC conversation

Talking to a character in the world is an in-fiction action targeted at that durable entity.

When the player interacts with Pell:

- Pell must be physically present or explicitly remotely reachable;
- the conversation is with Pell, not with an omniscient generic narrator;
- Pell-scoped performance context contains Pell's relevant knowledge, beliefs, memories, observations, goals, relationships, and current conditions;
- unrelated hidden package truth is absent;
- durable promises/relationships/knowledge changes promote into semantic state when continuity matters;
- nearby entities perceive the exchange only under explicit scene/audibility rules.

The Dungeon Master remains the performing campaign capability, but the context boundary makes the character genuinely perspective-bounded.

## Ask-GM and GM presence

Ask-GM remains a dedicated out-of-fiction channel.

- present NPCs do not hear it;
- it does not advance fictional time merely because the question was asked;
- the answer uses only player-authorized character knowledge and committed rules/mechanics;
- if the character does not know, uncertainty remains uncertainty;
- request/response is player-private by default unless a later explicit command requests broader party/table visibility.

The GM may also proactively address the player/party/table.

A small GM intervention may appear as a message/overlay. A dramatic intervention may pause or freeze local exploration and present a large GM frame/bubble before returning control. Presentation intensity is explicit client state and not permission to mutate campaign truth without a semantic operation.

## Persistent-world player expectation

The player should not have to infer durable world facts from old narration.

As implemented, GameFrame should make legible:

- whom the character knows;
- the best identity label the character may use;
- who is physically present;
- relevant visible/known scene objects/exits;
- active objectives and important known facts;
- character/companion state;
- current location and meaningful route information;
- whether an Arena encounter is active, complete, reconciling, or ready to resume.

A hidden runtime canonical name is never a reason to show that name to the player.

## World materialization experience

The player experiences concrete maps/scenes, but the CampaignPackage owns semantic world truth.

A location may be:

- prepared/hand-authored;
- materialized from reusable world kits/prefabs;
- seeded/procedurally composed;
- enriched with generated campaign-specific assets;
- created on demand when the player's plausible route requires a bounded incidental area.

Once a scene is accepted/materialized for the campaign, returning to it should return to that scene identity. Important world changes persist.

Generated pixels do not define collision or secret campaign truth.

## Party cohesion and multiple maps

The authority model supports zero or more active semantic scenes. The first embodied multiplayer experience should nevertheless keep the active party together in **one exploration scene at a time**.

A first transition may require relevant party members to gather at an exit/edge/transition zone before one authoritative transfer loads/materializes the destination.

Later split-party play may allow simultaneous maps/scenes, but it requires scene-scoped realtime subscriptions, divergent observation/knowledge, cross-scene communication rules, concurrent DM/event custody, independent recovery, and rules for one subgroup entering tactical mode while another continues exploring.

Therefore: architect for multiple scenes now; productize one shared scene first.

## Runtime boundary

RPG GM Runtime contains:

- Campaign Architect;
- Dungeon Master context modes;
- package validation/hidden truth;
- campaign journal;
- Entity Registry/Character Factory;
- Scene Registry;
- semantic observer/player knowledge;
- semantic WorldGraph/location truth;
- Dungeon Master Context Compiler;
- typed semantic validation and scene-to-encounter compilation.

GameFrame owns authenticated intake/commands, player-safe projections, exploration materialization, movement/session projection, complete presentation, structured mechanics, semantic asset materialization, tactical state, and committed mechanical outcomes.

Scribbles Runtime owns Theo and the connector that lets Theo occupy an ordinary GameFrame player seat.

## Tactical transition posture

Arena Battles is a stricter resolution mode for the current campaign scene.

Campaign-bound battles preserve exact supported scene entities/objectives and use campaign-specific terminal presentation. Returning to the RPG route is not authoritative aftermath by itself.

After runtime reconciliation, the exploration scene/materialization reflects committed consequences and ordinary movement/interaction resumes.

## Presentation and media direction

The campaign interface is world-first rather than transcript-first.

Pixi/world presentation is the ordinary spatial foundation. HTML/CSS surfaces provide GM communication, dialogue, People/scene information, character data, clues, inventory, quests, handouts, and accessibility/fallback text.

The Campaign Architect declares semantic media/world-kit needs. GameFrame resolves, composes, generates, caches, validates, versions, and materializes presentation assets.

Missing media may reduce presentation quality but cannot prevent legal campaign play.

Cutscenes should ordinarily be semantic cinematic scripts executed by GameFrame rather than generated video.

## Text-mode posture

The existing text/event campaign surface remains valuable as:

- a deterministic testing harness;
- debugging/operator inspection;
- accessibility/fallback presentation;
- low-capability client fallback;
- optional old-school text play mode;
- GM communication/history.

It should not dictate the mature product loop.

## Campaign-length posture

The engineering vertical slice may use a bounded starter chapter to prove complete architecture. That is an evidence strategy, not the mature product ceiling.

The platform is intended for durable campaigns continuing across multiple sessions, with longer progression, relationships, recurring locations, inventory/care, and continuation systems promoted as actual campaigns prove their need.

## Governing rule

> GameFrame owns a world the player can actually inhabit; runtime owns the durable semantic truth behind that world; the Dungeon Master remains the referee and GM; and the player never loses the ability to attempt a plausible action merely because no videogame button was anticipated for it.
