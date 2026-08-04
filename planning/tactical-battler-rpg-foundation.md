---
title: Tactical Battler and RPG Foundation
status: active
document_type: architecture
owner: Scribbles GameFrame
last_updated: 2026-08-03
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
depends_on:
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
related:
  - rpg-gameframe-interface-contract.md
  - rpg-platform-delivery-plan.md
  - monster-master-rules.md
---

# Tactical Battler and RPG Foundation

## Purpose

GameFrame's deterministic tactical stack is the combat foundation for the all-GameFrame RPG experience. The RPG must reuse the existing map, movement, combat, replay, persistence, identity, projection, invitation, browser, and rendering systems rather than creating a second combat engine.

The tactical foundation is one subsystem of the broader RPG client. It does not define the whole campaign interface.

## Current foundation

Repository-proven capabilities include:

- authoritative revisioned matches and legal-action validation;
- deterministic replay and restorable snapshots;
- player-specific observations and hidden tactical information;
- authenticated principals, seats, invitations, and resume;
- tactical maps, weighted movement, occupancy, initiative, line of sight, attacks, effects, defeat, objectives, and terminal results;
- in-memory and Durable Object persistence paths;
- browser and Discord Activity delivery foundations;
- Monster Master as the current tactical game and visual proving ground;
- PixiJS battlefield rendering and responsive player UI.

These capabilities are reusable infrastructure, not a requirement that RPG campaigns use Monster Master rules or content.

## RPG extension model

The GameFrame RPG client adds campaign modes around the tactical engine:

```text
campaign shell
  scene and narration
  dialogue and choices
  character and party views
  inventory and equipment
  quests and objectives
  location and exploration
  checks and consequences
  campaign history and resume
        ↓
encounter transition
        ↓
existing tactical authority
  map, participants, objectives
  legal actions and turns
  effects and hidden state
  replay, reconnect, completion
        ↓
structured outcome
        ↓
resumed campaign shell
```

The player remains in one GameFrame application throughout this flow.

## Authoritative mechanics

GameFrame remains authoritative for mechanics explicitly represented through its contracts, including:

- tactical movement, occupancy, range, line of sight, turns, actions, damage, effects, objectives, and completion;
- structured character, inventory, quest, check, exploration, or progression mechanics once deliberately implemented;
- player-specific mechanical projections and hidden information;
- replay, stale-action rejection, idempotency, reconnect, and durable terminal outcomes.

RPG GM Runtime proposes authorized operations and consumes committed results. It does not directly assign board state, health, victory, inventory, or other GameFrame-owned values.

## Semantic presentation

Mechanics reference semantic concepts and stable content IDs, not concrete art files. Themes and campaign assets map those concepts to presentation recipes.

The renderer may combine:

- deterministic terrain, icon, frame, card, portrait-part, and effect libraries;
- campaign-specific theme manifests and stable asset references;
- selectively generated scene art, portraits, bosses, locations, and artifacts;
- temporary deterministic fallbacks while generated media is unavailable.

Media latency or failure must not block legal play.

## First RPG acceptance slice

The first integrated slice should prove:

1. Two authenticated players attach to one campaign in GameFrame.
2. The campaign presents a scene, NPC dialogue, and public and private information.
3. Players submit freeform actions and one bounded choice.
4. One deterministic noncombat check resolves and presents a consequence.
5. The campaign launches a configured tactical encounter through a versioned port.
6. Players complete the encounter using the existing tactical client.
7. GameFrame commits a structured terminal outcome.
8. RPG GM Runtime records the consequences and resumes the campaign in GameFrame.
9. A disconnect and exact retry do not duplicate state or lose continuity.
10. Theo can occupy a normal player seat without receiving GM-only information.

## Scope control

The first slice does not require a generalized open world, arbitrary model-authored mechanics, a universal D&D rules engine, fully procedural maps, final Monster Master balance, or final art.

Reusable campaign primitives should be added before bespoke systems. A new mechanic is promoted only after a real campaign need demonstrates that generic scene, card, choice, freeform-action, check, map, and encounter primitives are insufficient.

## Delivery sequence

- Freeze the RPG session and presentation contract.
- Build a deterministic mock campaign inside the GameFrame shell.
- Connect the shell to RPG GM Runtime fixtures.
- Add one real campaign vertical slice.
- Complete the tactical encounter round trip.
- Promote character, inventory, quest, progression, and exploration mechanics only as the playable campaign requires them.
- Add production model and media quality after deterministic recovery and authority are proven.
