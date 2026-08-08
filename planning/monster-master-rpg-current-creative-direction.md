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
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
---

# Monster Master RPG Current Creative Direction

## Purpose

This document controls current Monster Master creative direction. Platform architecture is controlled by the shared agent/package and scene/entity/knowledge contracts; implementation order is controlled by the shared roadmap.

Monster Master is the first handcrafted CampaignPackage and gold standard for future Campaign Architect output.

## Current creative deliverable

The immediate creative deliverable is **one complete executable Monster Master CampaignPackage** that feels like a durable world rather than a sequence of model-written scenes.

The first package must commit:

- player-safe premise and group role;
- setting rules and continuity invariants;
- actual major actors, goals, fears, leverage, secrets, and limits;
- actual locations and relationships;
- opening situation and initial scene membership;
- hidden cause and causal history;
- clue/evidence graph with recovery paths;
- event eligibility and pressure state;
- tactical thresholds/objectives;
- consequence/resolution conditions;
- semantic assets/fallbacks;
- forbidden retcons and provenance.

Additional plot families remain source material/future packages. They are not all one executable campaign.

## Campaign Architect and Dungeon Master

For Monster Master, the team manually performs Campaign Architect work and may refine the package for as long as useful before commitment.

The future generated workflow should produce the same artifact:

```text
brief
→ generated draft
→ optional owner refinement
→ validation
→ commitment
```

The Dungeon Master runs the committed package. It owns narration, dialogue, pacing, interpretation of arbitrary plausible action, selection among eligible events, consequences, checks, and tactical requests.

The Dungeon Master does not own exact entity identity, scene membership, player knowledge, tactical outcomes, or package truth.

## Durable-world creative rule

If a fact matters to continuity, it should become explicit semantic state rather than survive only because the model remembers prose.

Examples:

- who is physically in the scene;
- which monster is in which cube;
- whether the cart still contains confiscated cubes;
- whether the road barrier is intact;
- which suspect fled;
- who learned a person's name;
- which character knows a clue;
- where an escaped monster went;
- who owes whom a favor;
- which NPC was injured.

This should make the Dungeon Master **more** improvisational, not less: the model can spend context on interpreting the scene instead of reconstructing bookkeeping.

## Player knowledge and identity

The player should not automatically know every package actor's canonical name because the runtime does.

Monster Master presentation should freely use descriptive identities before introductions:

- "the woman in inspector's gear";
- "the man holding the pack lizard";
- "the courier in the maintenance shed";
- "the glowing salamander inside the locked cube".

Once play establishes a name/role, the People projection upgrades the same durable entity instead of creating a new character.

The target People surface lets players review whom they have met and what their character actually knows.

## Incidental NPC posture

The prepared NPC pool remains an open foundation, not a closed cast.

When players reasonably seek an unprepared person, the Dungeon Master requests that role and runtime Character Factory materializes one stable incidental entity.

The Dungeon Master then portrays that person. If players create a promise, debt, relationship, injury, task, recurring interaction, or other continuity, the same entity persists.

Incidental people cannot retroactively replace package-bearing culprits, decisive witnesses, clue owners, or secret authorities unless the package intentionally left that role open.

Promotion does not require bespoke art.

## Adult-world posture

Monster Master is for adult gamers and should feel like a functioning society rather than a training simulator.

Good, competent, selfish, foolish, corrupt, compromised, dangerous, and ordinary people coexist. Institutions may help, fail, contradict themselves, contain decent professionals, or contain abusive individuals.

Heroic/lawful choices are valid but not mandatory. Practical, selfish, opportunistic, illegal, reckless, avoidant, and unexpected actions may all be credible when the fiction supports them.

Consequences arise through danger, relationships, resources, exposure, injury, reputation, law, creature welfare, opportunity, and lasting world changes rather than a morality lecture.

## Tone

Monster Master can move among:

- dry and sardonic humor;
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

The setting takes continuity and consequences seriously without protecting its dignity.

## Accepted character concept — Master Baiter

A respected monster-luring specialist may be known as **the Master Baiter**.

The title is funny, but the character is genuinely expert in bait, scent, sound, habitat, migration, feeding behavior, territorial displays, and nonviolent monster movement.

Use the character when a package gives him a functional role; do not turn every scene into commentary about the joke.

## Capture-cube physical presentation

Ordinary capture cubes are handheld externally despite containing substantial private interior living spaces.

Creative and generated descriptions should distinguish:

- handheld capture cube;
- cube case/rack;
- storage/cart carrying cases;
- specialist relocation/quarantine/industrial containment equipment.

A normal cube is not a person-sized cage. See `decisions/0006-monster-master-capture-cube-form-factor.md`.

This rule preserves the existing comedic/luxury interior concept: a monster can demand a mansion, expensive kitchen, or gold toilet inside a device a trainer still carries in one hand.

## Starter source families

The broader source catalog includes materially different families such as:

- displaced domestic migration;
- counterfeit cube recall;
- rival certification sabotage;
- festival mascot breakout;
- false warden roadblock.

A misclassified Class 4 specialty hazard remains blocked until its fixed rule/countermeasure is authored. No confirmed Class Five material belongs in the starter package.

The current executable reference package uses the false-warden/crooked-checkpoint family. Other families remain later complete packages/templates.

## Crooked Checkpoint opening presentation

The opening should establish pressure without prematurely revealing hidden canonical identities.

The party knows Warden Pell because he is their assigned guide. Other checkpoint figures should begin through observable descriptors/roles until introductions, documents, dialogue, or investigation establish names.

The opening should therefore avoid assuming the player already knows "Mara Venn" or "Tollan Reed" merely because those names exist in hidden package truth.

## Scene and tactical relationship

Arena Battles should feel like the campaign scene becoming tactically strict, not like the fiction being replaced with an unrelated duel.

When a checkpoint scene becomes tactical, important current-scene truth should survive as supported:

- Orange/the player trainer;
- selected monster such as Cinder;
- Pell or other allies if they are still present and participating;
- actual established hostiles;
- Emberglass if present;
- the pack lizard if still relevant;
- cart/barrier/exits if they matter to objectives;
- escape/protection/recovery objectives.

Not every present entity must become a full combatant. But materially relevant people/creatures/objects should not vanish because tactical mode has only a fixed duel vocabulary.

## Fleeing and surrender

Campaign encounters should allow consequences other than fight-to-the-death elimination.

A creature or NPC whose established goal is to escape should be able to pursue an explicit exit objective. Structured outcomes should eventually distinguish fleeing, withdrawing, surrendering, being recalled, being incapacitated, and—where lethal rules explicitly support it—death.

For the Crooked Checkpoint, Emberglass is an obvious proving case: depending on circumstances, a frightened intelligent monster may want to escape rather than participate as ordinary opposition.

## Player-to-GM questions

The interface should let a player ask the Dungeon Master a rules/knowledge question without making their character say it aloud.

This supports natural questions such as:

- "Would my license authorize this?"
- "Do I recognize that insignia?"
- "What do I remember about intelligent-monster capture law?"

The answer should use player-authorized character knowledge. NPCs should not react unless the player separately speaks or acts in the fiction.

## Asset-production mode

The package declares semantic asset needs. GameFrame resolves them through prepared assets, generated assets, deterministic composition, silhouettes, cards, or text fallbacks.

Likely foundation coverage includes:

- academy/field-station environments;
- settled routes/modular roadside states;
- Warden Pell and reusable NPC portrait families;
- incidental NPC cards/silhouettes;
- handheld cubes, cube cases/racks, carts, signs, field kits, barriers, evidence/inspection props;
- conventional monsters and hazards;
- People/knowledge/current-scene UI;
- private observation/investigation/objective/aftermath UI;
- reusable Arena terrain/effects.

Cloudflare-backed image generation remains a later/parallel presentation capability, not a requirement for campaign correctness.

## Deterministic fixture rule

A deterministic fixture may select one package for CI but remains test-only as evidence. It must not dictate broader lore merely because it is convenient to simulate.

## Creative acceptance

Monster Master is on target when:

- one complete package produces a memorable coherent campaign;
- package truth survives unexpected play;
- the Dungeon Master adapts rather than recites a scene outline;
- people retain identity/continuity independently of model memory;
- players learn names/facts through play rather than hidden-package leakage;
- a plausible ordinary NPC can become durable without blocking play;
- People/current-scene views make the player's knowledge legible;
- heroic/opportunistic/avoidant/unexpected play remain credible;
- comedy, sincerity, and horror coexist;
- tactical mode preserves the same scene/entities/objectives as supported;
- fleeing/surrender/withdrawal can become real consequences;
- campaign reaches a satisfying resolution and optional continuation;
- other source families can later become materially different packages.

## Governing rule

> Handcraft Monster Master as a durable living campaign: let the Dungeon Master improvise aggressively inside exact world state, reveal people as the players actually learn them, and make Arena Battles resolve the scene they were already in rather than replacing it.
