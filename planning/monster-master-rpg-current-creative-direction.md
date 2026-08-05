---
title: Monster Master RPG Current Creative Direction
status: accepted
document_type: design-direction
authority: owner-approved
owner: Scribbles GameFrame
last_updated: 2026-08-05
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
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-platform-roadmap.md
  - shared/rpg-event-and-plot-pool-contract.md
  - shared/rpg-monster-master-reference-campaign.md
---

# Monster Master RPG Current Creative Direction

## Purpose

This document controls Monster Master creative direction. Platform architecture and implementation order are controlled by the shared agent architecture and roadmap.

Monster Master is the first handcrafted CampaignPackage and the gold standard for future Campaign Architect output.

## Current creative deliverable

The immediate creative deliverable is **one complete executable Monster Master CampaignPackage**, supported by the existing lore, plot-family catalog, event pools, NPC pool, and asset register.

The catalogs remain useful source material and future package templates. They are not themselves a finished campaign.

The first package must commit:

- player-safe premise and group role;
- setting rules and continuity invariants;
- actual major actors, goals, fears, leverage, secrets, and limits;
- actual locations and relationships;
- opening situation and immediate agency;
- hidden cause and causal history;
- clue and evidence graph with recovery paths;
- event eligibility and pressure state;
- tactical thresholds and objectives;
- consequence and resolution conditions;
- semantic asset requirements and deterministic fallbacks;
- forbidden retcons, package version, and provenance.

Additional plot families become later complete packages or Campaign Architect templates after the first package and Dungeon Master loop work.

## Campaign Architect and Dungeon Master roles

The **Campaign Architect** is the campaign-authoring agent. Older references to a plot agent or campaign compiler describe parts of this role.

For Monster Master, the team manually performs the Campaign Architect work to establish the quality bar.

The **Dungeon Master** consumes the committed CampaignPackage and owns:

- narration, dialogue, pacing, and scene framing;
- interpretation of arbitrary freeform player action;
- state-compatible event selection;
- NPC performance and reactions;
- compatible local detail and incidental NPC creation;
- consequences, checks, and tactical requests.

The Dungeon Master may adapt strongly but may not replace the package’s cause, responsible actors, evidence logic, established facts, prior consequences, or tactical outcomes.

There is no separate intro agent and no Monster Master-specific Dungeon Master implementation.

## Starter family source material

The current catalog contains materially different source families:

- **displaced domestic migration** — ecological pressure, creature care, route management, community conflict, and territorial danger;
- **counterfeit cube recall** — technical rescue, intelligent-occupant negotiation, black-market components, legal conflict, and funny or genuine horror;
- **rival certification sabotage** — social comedy, competition, deception, public embarrassment, and accidental escalation;
- **festival mascot breakout** — slapstick, crowd control, chase structure, publicity, bait, and nonlethal recovery;
- **false warden roadblock** — human crime, forged authority, confiscation, bribery, stealth, rescue, and confrontation.

A misclassified Class 4 specialty hazard remains blocked until its fixed rule and countermeasure are authored.

No family or deterministic fixture is the canonical Monster Master story.

## NPC posture

The package should draw from a curated but open NPC foundation:

- veteran guide;
- station quartermaster;
- station cook, cafeteria worker, or lunch lady;
- rival trainee;
- creature medic or handler;
- cube technician or researcher;
- road patrol or town guard;
- local worker, farmer, courier, merchant, innkeeper, or traveler;
- licensing official;
- festival organizer;
- underworld fixer or false inspector;
- intelligent-monster citizen or professional.

The Campaign Architect selects package-bearing roles and binds hidden actors, clue owners, and recurring cast before play where required.

The cast is not closed. When players seek a plausible unprepared person, the Dungeon Master may create that NPC, assign a stable identity and portrait family, preserve continuity, and promote them when play makes them important.

An incidental NPC may not retroactively replace a committed culprit, decisive witness, clue owner, or secret authority unless the CampaignPackage explicitly left that role open.

Promotion does not require immediate bespoke art.

## Adult-world posture

Monster Master is built for adult gamers and should feel like a society rather than a training simulation.

Good, competent, brave, selfish, foolish, corrupt, compromised, and ordinary people coexist. Institutions may help, fail, contradict themselves, contain decent professionals, or contain people abusing their position.

Heroic and lawful choices are valid and rewarding but not mandatory. Practical, selfish, opportunistic, illegal, reckless, avoidant, and unexpected actions may be credible when the fiction supports them.

Consequences arise through leverage, information, danger, relationships, resources, exposure, injury, reputation, law, creature welfare, and future opportunity. The Dungeon Master does not preach or force a preferred alignment.

## Tone

Monster Master can move among:

- slapstick and physical comedy;
- absurd professional titles, names, institutions, and customs;
- selective meme-adjacent concepts without constant reference spam;
- sincere relationships;
- unsettling monster behavior;
- funny horror;
- genuine bounded horror;
- tactical danger;
- wonder and emotional weight.

The setting takes continuity and consequences seriously without protecting its dignity. Comedy must not erase stakes, and horror should permit a return to adventure, camaraderie, relief, or triumph.

## Accepted character concept — the Master Baiter

The setting includes a respected monster-luring specialist known as **the Master Baiter**.

The title is funny, but the character is not disposable. He is highly knowledgeable about bait, scent, sound, habitat, migration, feeding behavior, territorial displays, and nonviolent monster movement.

People in the profession treat his expertise seriously. The joke should land without every character explaining it. Include him only when a CampaignPackage gives him a functional role.

## Spine and event-pool application

The certification circuit is a useful chassis, not a mandatory lesson plan or fixed sequence.

Event pools describe authored situations and state transitions. The Campaign Architect selects and binds them into a complete CampaignPackage. The Dungeon Master realizes eligible events according to package truth, current state, players, location, actors, and prior choices.

At least one early situation should provide meaningful agency before formal briefing dominates play. Suggested approaches are examples, not buttons defining the action space.

## Asset-production mode

The current asset register is the production inventory and provenance authority.

Current production may include:

- interactive image generation during development;
- editing and cleanup;
- hand-authored interface elements and icons;
- deterministic crops, masks, derivatives, and manifests;
- reuse and improvement of Arena Battles assets;
- local screenshot and playable-scene review.

The CampaignPackage declares semantic asset needs. GameFrame resolves those needs through accepted assets, deterministic composition, generation, silhouettes, cards, or text fallback.

The foundation should cover:

- academy or field-station environments;
- settled routes and modular roadside states;
- veteran guide and reusable NPC portrait families;
- incidental NPC cards and silhouettes;
- carts, signs, cubes, field kits, barriers, and inspection props;
- domestic and conventional hazard creatures;
- private observation, investigation, warning, objective, and aftermath UI;
- reusable Arena Battles terrain and effects.

Cloudflare-backed campaign image generation is a future campaign-preparation capability. It is not required for package logic or Dungeon Master testing.

## Deterministic fixture rule

A deterministic fixture may select one package for CI. It must remain test-only, noncanonical, versioned, replaceable, absent from default campaign copy, and unable to dictate the complete asset roadmap.

## Creative acceptance

Monster Master is on target when:

- one complete CampaignPackage produces a memorable, coherent campaign;
- package truth survives unexpected player action;
- the Dungeon Master adapts instead of reciting a scene outline;
- heroic, opportunistic, avoidant, and unexpected play remain credible;
- comedy, sincerity, and horror coexist without destroying continuity;
- likely roles have prepared visual coverage;
- an incidental ordinary person can become a durable character;
- the package reaches a satisfying resolution and optional continuation;
- additional source families can later become materially different complete packages.

## Governing rule

> Handcraft one complete Monster Master CampaignPackage with broad creative range, let the Dungeon Master adapt it around real players, and retain the catalogs as reusable source material rather than mistaking them for the finished game.
