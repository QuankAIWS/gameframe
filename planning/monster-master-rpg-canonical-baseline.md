---
title: Monster Master RPG Canonical Baseline
status: accepted
document_type: authority-index
authority: owner-approved
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - Monster Master RPG
  - Monster Master Arena Battles
  - Scribbles GameFrame
  - RPG GM Runtime
related:
  - rpg-documentation-index.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-monster-master-reference-campaign.md
  - monster-master-rpg-current-creative-direction.md
  - monster-master-rpg-lore-and-story.md
  - monster-master-rpg-encounter-rules.md
  - decisions/0006-monster-master-capture-cube-form-factor.md
---

# Monster Master RPG Canonical Baseline

## Purpose

Monster Master is the first handcrafted embodied campaign for the reusable RPG platform and the quality bar for later Campaign Architect output. It is not a special Dungeon Master implementation or a separate campaign engine.

Platform architecture is controlled by the shared contracts; implementation order is controlled by the shared roadmap; current creative behavior is controlled by `monster-master-rpg-current-creative-direction.md`.

## Product boundary

```text
Monster Master RPG
= GameFrame RPG Engine
+ Monster Master Ruleset / game-family content
+ committed Monster Master CampaignPackage
```

**Monster Master Arena Battles** lives inside Battle Simulator as standalone tactical play. Campaign combat never launches Arena Battles. Campaign initiative uses same-map Tactical Activation.

## Current product evidence

Deployed staging currently proves:

- CampaignPackage v5 staging campaign;
- viewer-safe Crooked Checkpoint semantic bootstrap;
- deterministic physical Crooked Checkpoint materialization;
- desktop and mobile exploration movement;
- collision/camera/reconnect;
- player-safe initial identity disclosure;
- a projected/visible West Woods route mouth.

Not yet proven: generic Interact/Talk, Do Something Else world mutation, real West Woods transfer, same-map tactical campaign combat, complete single-player chapter.

## Durable world rule

Campaign truth is not a transcript stored in model memory.

Runtime owns explicit semantic state for durable identities, scene membership, Observer Knowledge, objectives/events/clues/relationships and meaningful consequences. GameFrame owns materialized physical state, x/y/facing, collision/interaction range, deterministic mechanics/control, and tactical state.

Consequential prose is presentation. It does not become authoritative merely because the Dungeon Master wrote it.

## Player knowledge and identity

Canonical actor names are not automatic player knowledge.

A stable actor can progress for one observer:

```text
"the woman in inspector's gear"
→ "the checkpoint official"
→ "Mara Venn"
```

Narration, dialogue attribution, map labels, People views, and campaign history use the observer-authorized stage. A later model turn may not jump to the canonical name simply because the package contains it.

## Capture cubes

Ordinary capture cubes are **small handheld external devices** with much larger private interior living spaces.

- Ordinary cubes are not cage-sized containers.
- A cart may carry cube cases/racks or specialist equipment.
- Creature-scale motion inside an ordinary cube does not automatically make a full cart shake/jump.
- Larger relocation/quarantine/prison/industrial containment must be explicitly authored as separate specialist equipment.

See `decisions/0006-monster-master-capture-cube-form-factor.md` and the lore document.

## Opening and pacing

The Crooked Checkpoint opening should:

- orient the player to place, people, and immediate pressure;
- use only viewer-authorized identities;
- expose suspicious details without declaring one required solution;
- avoid physically implausible cart disturbance from handheld cubes;
- return control to the embodied world quickly.

Suggested approaches are optional help, not a story engine that repeatedly forces two/four options after every narration beat.

## Player interaction semantics

Distinguish:

- **Interact/Talk** — in-fiction targeted action toward a present entity/object;
- **Do Something Else** — first-class arbitrary plausible in-fiction intent;
- **Ask Game Master** — out-of-fiction referee/knowledge/rules communication.

Normal speech, whispers, private GM communication, and later multiplayer observations require explicit audience/audibility semantics. Talking to an NPC is not talking to the Game Master even when the same Dungeon Master capability performs the NPC through entity-performance context.

## Freeform action rule

The player has broad **attempt authority**, not authority to dictate world truth.

If the player types:

> I pull out Cinder's cube and release her beside me.

Runtime may interpret a deploy intent, but GameFrame/ruleset authority validates ownership, deployment limits, current state, and physical placement. Only an accepted commit makes Cinder actually present. Narration/history then reports the result.

The same rule prevents declarative text from bypassing locks, collision, combat rules, inventory, identity, or campaign truth.

## Campaign chronicle

The existing campaign feed is expected to mature into an observer-authorized **campaign chronicle** containing meaningful narration, heard dialogue, discoveries, consequential actions, world changes, mechanics, travel, and relevant GM interventions/rulings.

It is not intended to be a tiny combat log, but it is also not the mature primary control surface. Ordinary play should increasingly happen directly in the world.

Different observers may legitimately have different chronicle content when audibility, private GM answers, knowledge, or scene presence diverge.

## Same-map tactical rule

When initiative begins, the current materialized scene becomes tactical. Preserve, as supported:

- Master/trainer and deployed monsters;
- present allies/hostiles/noncombatants;
- important objects/hazards/exits;
- current positions/geometry;
- objectives and alternate terminal conditions;
- escape/withdrawal/surrender/recall/incapacitation semantics.

No campaign Arena handoff, substitute battle map, or Return-to-Campaign screen.

## Current implementation order

```text
SEE      complete
MOVE     complete
MOBILE   complete
TALK     active
CHANGE
TRAVEL
FIGHT
PROVE
```

Then: two-human one-scene → second handcrafted Game Family → Campaign Architect → dynamic Battle Simulator/Battle Packs → split-party later.

## Repository ownership

### GameFrame

- authenticated player UI/session;
- physical scene materialization;
- x/y/facing/collision/interaction range;
- contextual controls;
- deterministic rules/control/tactical state;
- observer-safe rendering/history presentation;
- Battle Simulator lifecycle.

### RPG GM Runtime

- CampaignPackage/WorldGraph/hidden truth;
- Entity/Scene/Observer Knowledge state;
- Dungeon Master context/orchestration;
- freeform intent interpretation;
- semantic world consequences and scene transfer;
- perspective-bounded entity performance;
- semantic Tactical Activation coordination/reconciliation.

## Required test posture

Keep separate evidence for package validation, entity/scene/knowledge truth, identity secrecy, context custody, physical materialization/movement, interaction targeting, freeform world changes, scene transfer, same-map tactical behavior, browser experience, restart/recovery, live provider, and deployed staging.

No canned narration, transport round trip, or standalone Arena result alone proves the campaign.

## Governing rule

> Handcraft Monster Master as a durable playable world: the renderer shows committed truth, the Dungeon Master interprets and performs without owning deterministic state, the player can attempt more than the buttons list, and meaningful observer-authorized history survives without replacing the game itself.
