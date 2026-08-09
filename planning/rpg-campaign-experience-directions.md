---
title: RPG Campaign Experience Direction
status: accepted
document_type: decision
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Monster Master RPG
supersedes:
  - Discord-first illustrated campaign direction
  - unresolved Discord-first versus game-heavy evaluation
  - transcript-first ordinary RPG play as the mature primary experience
  - separate Arena-map campaign combat as the mature tactical experience
related:
  - shared/rpg-platform-product-goals.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
---

# RPG Campaign Experience Direction

## Decision

The RPG is an **all-GameFrame embodied campaign experience**.

The mature primary loop is a playable persistent 2D world:

```text
explore
→ approach / target / interact
→ supported deterministic action or freeform adjudication
→ accepted world/semantic change
→ world presentation updates
→ continue exploring
```

The player can always use **Do Something Else** for plausible intent outside fixed controls and **Ask Game Master** for out-of-fiction rules/knowledge/clarification.

When initiative is required, the current world scene enters same-map Tactical Mode. No campaign Battle Simulator/Arena handoff occurs.

## Current evidence and priority

```text
SEE      ✅
MOVE     ✅
MOBILE   ✅
TALK     ← ACTIVE
CHANGE
TRAVEL
FIGHT
PROVE
```

Staging currently supports entering Crooked Checkpoint and walking it on desktop/mobile with durable physical recovery. West Woods is visible as a route affordance but is not yet a functioning scene transfer. Direct Talk/object interaction is not yet implemented.

## Interaction modes

### Explore

Move through persistent materialized maps with avatar/camera controls, collision, picking, and supported world mechanisms.

### Interact

Target a nearby viewer-authorized person, creature, object, or route. GameFrame owns physical target/range eligibility. Contextual actions are conveniences, not the complete action space.

### Talk

Talk is in-fiction communication directed at a specific entity. Entity performance uses that entity's perspective-bound context rather than omniscient referee context.

### Do Something Else

First-class arbitrary plausible in-fiction intent.

Text describes what the player attempts. It does not directly write state.

```text
"I release Cinder from her cube."
→ interpret intent
→ validate rules/state
→ commit accepted deployment
→ Cinder appears
→ narration/history reports the result
```

### Ask Game Master

Out-of-fiction player→GM communication. Private by default. Present NPCs do not hear it and fictional time does not advance merely because the player asked.

### GM Intervention

The Dungeon Master may present audience-scoped narration/advisory/dramatic framing. Presentation may temporarily pause local control, but world-state consequences still require the correct semantic/mechanic commit.

### Tactical Mode

Initiative/action economy/legal tactical actions activate on the current materialized scene. Current positions/entities/objects/terrain/exits remain.

## Speech and social presence

In-fiction speech should feel like part of the world, not a universal chat room.

- ordinary speech may be heard by nearby observers;
- a whisper can intentionally restrict hearing;
- players outside audibility should not gain dialogue/knowledge merely because another client displayed it;
- Ask-GM remains outside the fiction;
- one authorized dialogue event may render as temporary in-world speech and later as campaign history.

The first TALK UI may be simple. Correct audience/audibility semantics matter before final speech-bubble polish.

## Campaign Chronicle

The current campaign feed should mature into a **Campaign Chronicle**: a readable observer-authorized record of meaningful play.

It may preserve:

- opening/scene narration;
- dialogue the observer actually heard or participated in;
- discoveries and knowledge reveals;
- consequential player actions;
- deterministic mechanic outcomes;
- persistent world changes;
- scene travel;
- relevant GM interventions/rulings.

It should not collapse into a tiny combat log. It also should not remain the mature primary controller once the world supports ordinary actions directly.

Different observers may legitimately have different chronicle entries.

## Opening/pacing expectation

Narration should establish place, pressure, and sensory context, then give control back.

Do not rely on the text-adventure habit of ending every narration beat with a forced two/four-option funnel. Suggested approaches can be optional help, but the physical world and Do Something Else provide the actual action space.

## Persistent-world expectation

Players should not reconstruct important facts solely from old prose. GameFrame/Runtime should retain and expose as implemented:

- current location/scene;
- present entities/objects;
- observer-authorized identities/knowledge;
- player character and deployed/controlled entities;
- objectives/resources/conditions/inventory where supported;
- meaningful world changes;
- campaign chronicle/history.

Hidden names/secrets never appear merely because referee context knows them.

## World/materialization experience

CampaignPackage/Runtime owns semantic WorldGraph/location meaning. GameFrame materializes supported locations into persistent playable scenes.

When semantic geography permits alternate routes, the player can propose/use them without being forced back onto a scripted path. Once a location materializes for the campaign, revisit returns to that durable place rather than rerolling an unrelated map.

## Many maps, one active party scene first

The campaign may contain many persistent scenes while initial multiplayer keeps the party in one shared active scene. Later split-party support can add simultaneous scenes without conflating party membership with sensory knowledge.

## Same-map tactical experience

Tactical Activation validates semantic scene/revision, materialization, current positions, participants/roles/control, ruleset/profile, resources/conditions, current geometry/objects/hazards/exits, and objectives.

A player twenty yards away when initiative begins remains there unless an explicit rule changes positioning.

When tactical resolution completes and consequences reconcile, ordinary exploration resumes in place.

## Monster Master Arena Battles

Monster Master Arena Battles is separate standalone Battle Simulator play. It may offer setup/loadouts/teams/maps/objectives/BattleBot/replay/rematch conveniences while converging on the same Monster Master Ruleset semantics used by campaign tactical mode.

Setup/lifecycle differ; compatible combat rules should not fork.

## Campaign-length posture

The engineering vertical can be a bounded starter chapter, but the product targets durable multi-session campaigns. Progression, inventory/care, recurring places/relationships/factions, richer media, and broader systems are promoted only when proven useful by real play.

## Governing rule

> GameFrame RPG should feel like one world the player inhabits: act directly when the game knows how, express anything plausible when it does not, keep the GM available without turning every action into chat, preserve rich observer-scoped campaign history, and let combat begin where initiative actually happens.
