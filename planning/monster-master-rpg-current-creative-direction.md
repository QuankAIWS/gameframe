---
title: Monster Master RPG Current Creative Direction
status: accepted
document_type: design-direction
authority: owner-approved
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - Monster Master RPG
  - Monster Master gold-standard CampaignPackage
  - Monster Master asset production
  - Campaign Architect and Dungeon Master behavior
related:
  - monster-master-rpg-canonical-baseline.md
  - monster-master-rpg-lore-and-story.md
  - monster-master-rpg-asset-register.md
  - monster-master-rpg-npc-pool.md
  - monster-master-rpg-encounter-rules.md
  - decisions/0006-monster-master-capture-cube-form-factor.md
  - shared/rpg-platform-product-goals.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-monster-master-reference-campaign.md
---

# Monster Master RPG Current Creative Direction

## Purpose

This document controls current Monster Master creative direction. Platform architecture is controlled by shared contracts; implementation order is controlled by the shared roadmap.

Monster Master is the first handcrafted CampaignPackage and gold standard for future Campaign Architect output.

## Current creative deliverable

Build one complete executable **embodied** Monster Master campaign that feels like a durable world rather than a sequence of model-written scenes.

The package must commit meaningful actors, motives/secrets/limits, locations/routes, initial scene membership, player/observer knowledge, hidden cause, clue/recovery paths, event eligibility, pressure/escalation, tactical thresholds, consequences/resolution, semantic world/materialization requirements, and forbidden retcons.

The game world—not a transcript—is the ordinary place where the player acts.

## Embodied Monster Master direction

Normal play should be:

- walk around persistent 2D locations;
- approach characters, creatures, objects, and exits;
- use contextual actions for common mechanics;
- talk directly to present NPCs;
- inspect/use world features;
- deploy/recall/use monsters through ruleset-supported controls;
- use **Do Something Else** for plausible actions without dedicated controls;
- use **Ask Game Master** separately for out-of-fiction questions;
- enter **Tactical Mode on the same physical scene** when strict initiative is required.

The existing text/event shell remains useful as narration/history/fallback/accessibility/testing/GM communication. It is not the mature primary loop.

## Current playable state

Deployed staging currently proves:

- Crooked Checkpoint materialization;
- desktop + mobile movement;
- collision/camera/reconnect;
- viewer-safe initial identity where Warden Pell is known and the checkpoint official remains unnamed until learned;
- a visible/projected West Woods route mouth.

It does **not** yet prove direct interaction, TALK, object use, deploy/recall through the embodied world, West Woods transfer, or same-map Tactical Activation.

## Crooked Checkpoint opening presentation

The opening should orient rather than railroad.

Preferred shape:

1. establish the route/checkpoint visually and narratively;
2. establish Pell and the immediate social/environmental pressure;
3. expose a few observable irregularities without declaring what matters most;
4. hand control back to the player and let the world itself provide options.

Avoid the text-adventure habit of ending every narration beat with a forced list of two/four choices merely to keep prose moving. Suggested approaches may exist as accessibility/help, but they are never the complete action space and should not dominate mature play.

The Dungeon Master does not need to continually invent a fresh dilemma after every paragraph. Once the embodied world contains Pell, the official, the cart, the barrier, surrounding terrain, and routes, those things naturally create choices.

## Capture-cube/cart physical correction

Ordinary capture cubes are handheld externally.

Therefore:

- an ordinary cube cannot plausibly make a full confiscation cart jump, buck, or visibly shake merely because a monster moves inside its private interior space;
- narration must not treat the cube's extradimensional/private interior as mechanically transferring creature-scale impacts to the handheld shell unless a specific authored artifact says otherwise;
- a cart may still contain cube cases/racks and be important/suspicious;
- if the scene needs physical disturbance, use an explicit physical cause such as a person/creature in specialist containment, shifting cargo, a collision, sabotage, movement outside the cubes, or another authored mechanism.

The current Crooked Checkpoint content should be revised accordingly. Suspicion can come from guarded custody, mismatched paperwork/seals, odd handling procedure, noises from a physically plausible source, nervous handlers/animals, or other environmental details without making tiny cubes behave like cages.

## Pacing and pressure

The opening can be tense without immediately stacking every hook at maximum intensity.

Prefer layered escalation:

```text
arrive / orient
→ notice something off
→ choose what to inspect or whom to approach
→ learn/trigger additional pressure through play
→ escalation reacts to actual choices/time/state
```

This preserves agency and makes later escalation feel caused rather than pre-scripted.

## Pell and character performance

Pell is the first perspective-bounded character-performance proof.

When the player talks to Pell:

- Pell must be physically present or explicitly remotely reachable;
- GameFrame targets Pell's stable viewer-authorized entity;
- Pell's performance context includes Pell's relevant goals, relationships, knowledge/beliefs, memories, observations, conditions, and bounded conversation;
- package secrets Pell does not know are structurally absent;
- Pell may be mistaken, uncertain, deceptive, annoyed, helpful, etc. without becoming omniscient;
- durable promises/relationships/learned facts promote into semantic state when they matter.

The interface presents Pell as Pell, not as GAME MASTER.

## Identity and introduction

Canonical package identity is not automatically player knowledge.

For example, the same actor may progress:

```text
"the woman in inspector's gear"
→ "the checkpoint official"
→ "Mara Venn"
```

Narration, speech attribution, labels, People views, and campaign history must use the observer-authorized stage. A later model response must not suddenly use a canonical name merely because the Runtime package knows it.

## Speech, whispers, and who hears what

In-fiction communication has physical/semantic audience.

- ordinary nearby speech may be heard by nearby observers as scene/audibility rules allow;
- a whisper to Pell may deliberately restrict who hears it;
- another player who is out of earshot should not gain the line or its implied knowledge merely because one client displayed it;
- Ask-GM is not audible in-fiction;
- later presentation may show speech as a bubble/subtitle in the world and also retain it in each authorized observer's campaign history.

The exact bubble/visual treatment is later polish; audibility/audience correctness is not optional.

## Do Something Else and stateful freeform actions

The graphics do not define the full action space.

A player may type a plausible action such as:

> I pull out Cinder's cube and release her beside me.

That sentence expresses intent. The Dungeon Master may interpret it as a deploy request, but success comes only after deterministic/semantic validation. If accepted, Cinder becomes genuinely deployed/present and GameFrame renders that committed state. Refresh/restart must preserve it.

Narration follows accepted state; narration does not create the state.

The same principle applies to climbing, sneaking, improvising with objects, unusual routes, deception, distractions, and actions with no dedicated button.

## Campaign chronicle / feed direction

The current campaign feed should eventually become a meaningful **campaign chronicle**, not a tiny combat log.

It may retain:

- opening and important scene narration;
- dialogue the viewer actually heard/participated in;
- important discoveries;
- consequential player actions;
- meaningful world changes;
- deterministic mechanic outcomes;
- scene travel;
- GM interventions/rulings appropriate to that viewer.

It should not need every WASD step, camera turn, hover, or transient animation.

The chronicle can be observer-specific. Two players may legitimately have different records when they heard different whispers, received private GM information, or occupied different scenes.

Do not spend the active TALK/CHANGE/TRAVEL milestones polishing this UI. Preserve the correct semantic event/audience/origin data now and revisit presentation once the game itself supports the intended world actions.

## Durable-world creative rule

If a fact matters to continuity, it becomes explicit semantic/game state rather than surviving only in prose.

Examples:

- who is in the scene;
- which monsters are deployed/recalled;
- which cubes/items are in custody;
- whether the barrier/cart/door/path changed;
- who learned a person's name;
- what Pell knows/believes;
- which clue each observer learned;
- where a fleeing actor went;
- relationships/promises/injuries;
- which materialization represents a revisited place.

## Alternate-route and travel rule

West Woods is a semantic location/route, not a decorative menu option. The current staging route mouth is only the first physical affordance.

When TRAVEL lands, a player should be able to approach the route, commit a legitimate semantic transfer, materialize/recover West Woods, and later return to the same Crooked Checkpoint world state.

Unexpected routes are valid when established geography permits them; they should not require the DM to force the player back onto a scripted road.

## Same-map tactical relationship

When a campaign scene becomes tactical, important current-scene truth survives:

- Master/trainer;
- deployed monsters;
- Pell/allies/hostiles/noncombatants as applicable;
- current important objects;
- exits/escape zones;
- current geometry/positions;
- objectives and alternative terminal conditions.

No Arena product handoff or substitute campaign map.

After outcome, exploration resumes on the same world with committed fleeing/withdrawal/injury/custody/object consequences.

## Tone

Monster Master can combine dry/sardonic humor, situational comedy, absurd professional culture, sincere relationships, unsettling monster behavior, funny horror, bounded genuine horror, tactical danger, wonder, and emotional weight.

The world should feel functional rather than like a tutorial machine. Heroic/lawful, selfish, opportunistic, illegal, reckless, avoidant, and unexpected choices may all be credible when fiction supports them. Consequences arise through the world rather than invisible morality correction.

## Creative acceptance

Monster Master is on target when:

- Crooked Checkpoint feels like a place the player inhabits rather than prose with a map attached;
- the opening orients and releases control instead of endlessly forcing choices;
- ordinary cube scale remains physically coherent;
- Pell can be approached/talked to directly without omniscient leakage;
- speech/whispers/private GM communication respect audience;
- contextual controls and Do Something Else reach the same authoritative world;
- changes persist visibly;
- West Woods becomes real travel/revisit;
- tactical mode uses the current scene;
- campaign history remains rich enough to read later without becoming the primary game surface;
- package truth survives unexpected play and restart.

## Governing rule

> Handcraft Monster Master as a world worth inhabiting: orient the player, hand them control, let direct play and arbitrary intent operate on the same durable world, let characters know only what they know, and record meaningful history without turning the campaign into a transcript-first adventure.
