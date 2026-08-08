---
title: Monster Master RPG Current Creative Direction
status: accepted
document_type: design-direction
authority: owner-approved
owner: Scribbles GameFrame
last_updated: 2026-08-08
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
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
---

# Monster Master RPG Current Creative Direction

## Purpose

This document controls current Monster Master creative direction. Platform architecture is controlled by shared contracts; implementation order is controlled by the shared roadmap.

Monster Master is the first handcrafted CampaignPackage and gold standard for future Campaign Architect output.

## Current creative deliverable

The immediate creative deliverable is **one complete executable embodied Monster Master CampaignPackage** that feels like a durable world rather than a sequence of model-written scenes.

The first package must commit:

- player-safe premise/group role;
- setting rules/continuity invariants;
- actual major actors/goals/fears/leverage/secrets/limits;
- actual locations and semantic relationships;
- opening situation/initial scene membership;
- hidden cause/causal history;
- clue/evidence graph/recovery paths;
- event eligibility/pressure state;
- tactical thresholds/objectives;
- consequence/resolution conditions;
- semantic world/materialization/asset requirements;
- forbidden retcons/provenance.

Additional plot families remain source material/future packages rather than one giant executable campaign.

## Embodied Monster Master direction

Monster Master should normally be **played by inhabiting the world**:

- walk around materialized 2D locations;
- approach characters/creatures/objects;
- talk directly to present NPCs;
- inspect/interact with world features;
- use supported mechanics directly;
- ask the Game Master separately when needed;
- use freeform Do Something Else for plausible actions outside fixed controls;
- enter Arena Battles from the same physical/semantic campaign scene.

The existing text/event shell remains fallback/testing/accessibility/GM-history infrastructure, not the mature ordinary movement loop.

## Crooked Checkpoint as first embodied reference location

Crooked Checkpoint is now the first gold-standard exploration/world-materialization target.

The semantic area should support at least:

- main road approach;
- checkpoint/inspection area;
- cart/cube storage situation;
- road barrier;
- Warden Pell starting/present area as appropriate;
- nearby woods as a credible alternate approach;
- creek/embankment/ridge or equivalent environment features where consistent with final package geography;
- exits/routes whose availability is semantic state rather than decorative art;
- tactical-capable space/exit semantics when an encounter is justified.

The exact Pixi layout belongs to GameFrame materialization. The package owns the meaning, relationships, required landmarks, and traversal assumptions.

## Alternate-route creative rule

The package should permit credible approaches that are not simply menu choices.

If the player says to Pell, "Let's cut through the woods and come at them from the other side," the system should be able to treat that as a real proposal when the established geography permits it.

The woods may already have a prepared materialization or may be materialized on demand from semantic world truth/world-kit requirements. Once accepted, revisiting those woods should return to that location identity rather than a freshly unrelated random forest.

Unexpected exploration may expose different event/hazard/encounter opportunities than the obvious road approach.

## Dungeon Master role

The Dungeon Master remains a distinct real GM.

It owns:

- adjudication of unusual/freeform actions;
- Ask-GM rules/character-knowledge responses;
- meaningful narration/framing;
- eligible event selection/pacing;
- campaign-compatible consequences;
- checks/tactical requests;
- occasional dramatic GM interventions;
- perspective-bounded portrayal of NPCs/entities.

The GM does not need to narrate every movement the renderer already makes obvious.

## Pell and character performance

Pell is the first preferred perspective-bounded character-performance proof.

When the player talks to Pell:

- Pell is physically present or explicitly remotely reachable;
- the interaction targets Pell's stable entity ID;
- Pell's performance context includes Pell's relevant goals, relationships, knowledge/beliefs, memories, observations, conditions, and bounded conversation context;
- package secrets Pell does not know are absent;
- Pell may be mistaken, uncertain, deceptive, helpful, annoyed, or otherwise character-consistent without becoming omniscient;
- durable promises/relationships/learned facts promote into semantic state when they matter.

The interface should clearly present Pell as Pell, not label his dialogue as GAME MASTER.

## Game Master communication

Players retain a dedicated GM communication/history surface for questions like:

- "Would my license authorize this?"
- "Do I recognize that insignia?"
- "What do I remember about intelligent-monster capture law?"
- "Would my character think going through the creek is dangerous?"

Ask-GM is out-of-fiction. NPCs do not hear it unless the player separately speaks/acts.

The GM may proactively intervene. A dramatic intervention may freeze the scene and present a large GM frame/bubble before returning control.

## Tabletop-agency rule

The graphics are a representation of the imagined world, not the complete list of possible actions.

If a player wants to:

- climb something;
- take an odd route;
- ask Pell to wait;
- improvise with an object;
- create a distraction;
- attempt another plausible action with no dedicated interaction;

they should be able to use Do Something Else and receive Dungeon Master adjudication.

Repeated valuable behaviors may become mechanics later. One-off creativity remains legal without permanent UI support.

## Durable-world creative rule

If a fact matters to continuity, it becomes explicit semantic state rather than surviving only because a model remembers prose.

Examples:

- who is in the scene;
- which monster is in which cube;
- whether the cart still contains confiscated cubes;
- whether the road barrier is intact;
- which suspect fled and toward which route;
- who learned a person's name;
- what Pell knows/believes;
- which character knows a clue;
- where an escaped monster went;
- who owes whom a favor;
- which NPC was injured;
- whether a path/bridge/door changed;
- which accepted materialization represents a revisited location.

This lets the Dungeon Master spend context on interpretation/characterization rather than bookkeeping.

## Player knowledge and identity

The player does not automatically know every package actor's canonical name.

Monster Master presentation should freely use descriptive identities before introductions, for example:

- "the woman in inspector's gear";
- "the man holding the pack lizard";
- "the courier in the maintenance shed";
- "the glowing salamander inside the locked cube".

Once play establishes a name/role, People projection upgrades the same durable entity.

NPCs may have their own distinct knowledge/beliefs about those entities.

## Incidental NPC posture

The prepared NPC pool remains an open foundation, not a closed cast.

When players reasonably seek an unprepared person, the Dungeon Master requests that role and Character Factory materializes one stable entity.

If players create a promise/debt/relationship/injury/task/recurring interaction, the same entity persists.

Incidental people cannot retroactively replace package-bearing culprits/decisive witnesses/clue owners/secret authorities unless the package intentionally left that role open.

Promotion does not require bespoke art.

## Adult-world posture

Monster Master is for adult gamers and should feel like a functioning society rather than a training simulator.

Good, competent, selfish, foolish, corrupt, compromised, dangerous, and ordinary people coexist. Institutions may help/fail/contradict themselves and contain both decent and abusive individuals.

Heroic/lawful choices are valid but not mandatory. Practical, selfish, opportunistic, illegal, reckless, avoidant, and unexpected actions may all be credible when fiction supports them.

Consequences arise through danger, relationships, resources, exposure, injury, reputation, law, creature welfare, opportunity, and lasting world changes rather than a morality lecture.

## Tone

Monster Master can move among:

- dry/sardonic humor;
- broad situational comedy;
- slapstick;
- absurd professional titles/institutions/customs;
- selective meme-adjacent concepts without constant reference spam;
- sincere relationships;
- unsettling monster behavior;
- funny horror;
- bounded genuine horror;
- tactical danger;
- wonder/emotional weight.

The setting takes continuity/consequences seriously without protecting its dignity.

## Accepted character concept — Master Baiter

A respected monster-luring specialist may be known as **the Master Baiter**.

The title is funny, but the character is genuinely expert in bait, scent, sound, habitat, migration, feeding behavior, territorial displays, and nonviolent monster movement.

Use the character when a package gives him a functional role; do not turn every scene into commentary about the joke.

## Capture-cube physical presentation

Ordinary capture cubes are handheld externally despite substantial private interior living spaces.

Distinguish:

- handheld capture cube;
- cube case/rack;
- storage/cart carrying cases;
- specialist relocation/quarantine/industrial containment equipment.

A normal cube is not a person-sized cage. See `decisions/0006-monster-master-capture-cube-form-factor.md`.

## Starter source families

Broader source catalog includes materially different families such as:

- displaced domestic migration;
- counterfeit cube recall;
- rival certification sabotage;
- festival mascot breakout;
- false warden roadblock.

A misclassified Class 4 specialty hazard remains blocked until its fixed rule/countermeasure is authored. No confirmed Class Five material belongs in the starter package.

The current executable reference package uses the false-warden/crooked-checkpoint family. Other families remain later complete packages/templates.

## Crooked Checkpoint opening presentation

The opening should establish pressure without prematurely revealing hidden canonical identities.

The party knows Warden Pell because he is their assigned guide. Other checkpoint figures begin through observable descriptors/roles until play establishes names.

The first framing may use a GM intervention/narration, then hand control to embodied exploration rather than forcing a sequence of narration turns.

## Scene and tactical relationship

Arena Battles should feel like the embodied campaign scene becoming tactically strict.

When checkpoint scene becomes tactical, important current-scene truth should survive as supported:

- player trainer;
- selected monster such as Cinder;
- Pell/allies if still present and participating;
- actual established hostiles;
- Emberglass if present;
- pack lizard if relevant;
- cart/barrier/exits if they matter;
- escape/protection/recovery objectives.

Not every present entity must become a full combatant. Materially relevant people/creatures/objects should not vanish because tactical mode has a fixed duel vocabulary.

After outcome, the exploration scene should reflect committed fleeing/withdrawal/injury/custody/object consequences before control resumes.

## Fleeing and surrender

Campaign encounters should allow consequences other than fight-to-the-death elimination.

A creature/NPC whose goal is escape should be able to pursue an explicit exit objective. Structured outcomes eventually distinguish fleeing, withdrawing, surrendering, recall, incapacitation, and death only under explicit lethal rules.

Emberglass remains an obvious proving case.

## Asset-production mode

The package declares semantic asset/world-kit needs. GameFrame resolves through prepared assets, generated assets, deterministic composition, silhouettes/cards, or text fallbacks.

Foundation coverage should increasingly include:

- academy/field-station environments;
- roads/paths/woods/creeks/modular roadside states;
- structures, doors, barriers, carts, signs, field props;
- reusable foliage/terrain/world kits;
- player/NPC exploration sprites and interaction states;
- Warden Pell and reusable NPC presentation families;
- incidental NPC cards/silhouettes;
- conventional monsters/hazards;
- handheld cubes/cases/racks;
- People/GM communication/current-scene UI;
- cinematic pose/effect vocabulary;
- reusable Arena terrain/effects.

Cloudflare-backed image generation is presentation capability, not campaign correctness.

## Cinematic posture

Ordinary cutscenes should be semantic GameFrame cinematic scripts using camera/entity/dialogue/GM/effect/audio commands.

Generate special poses/splash art only when worthwhile. Do not make generated video a dependency.

## Creative acceptance

Monster Master is on target when:

- one complete package produces a memorable coherent embodied campaign;
- Crooked Checkpoint is a place the player can walk around, not just prose;
- Pell can be approached/talked to directly without omniscient leakage;
- Ask-GM remains visibly distinct from talking to Pell;
- a plausible unsupported action can be adjudicated through Do Something Else;
- an alternate route such as the woods can become real exploration/world state;
- revisiting a location returns to the same durable place;
- package truth survives unexpected play;
- people retain identity/continuity independently of model memory;
- comedy/sincerity/horror coexist;
- tactical mode preserves the same scene/entities/objectives as supported;
- tactical aftermath returns to the embodied world;
- campaign reaches satisfying resolution/continuation;
- other source families can later become materially different worlds/packages.

## Governing rule

> Handcraft Monster Master as a world worth inhabiting: let players walk through it, let Pell be Pell instead of an omniscient mask, keep the real Game Master available, preserve freeform tabletop agency, and make every important consequence survive when the scene changes modes.
