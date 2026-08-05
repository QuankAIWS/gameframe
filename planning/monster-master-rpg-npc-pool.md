---
title: Monster Master RPG NPC Pool and Portrait Foundation
status: active
document_type: asset-and-presentation-plan
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - Monster Master RPG starter catalog
  - GameFrame character presentation
  - manual Monster Master asset production
related:
  - assets/monster-master-rpg-npc-role-catalog.json
  - monster-master-rpg-asset-register.md
  - assets/monster-master-rpg-asset-register.json
  - monster-master-rpg-current-creative-direction.md
  - shared/rpg-event-and-plot-pool-contract.md
---

# Monster Master RPG NPC Pool and Portrait Foundation

## Decision

Monster Master should prepare a reusable NPC role pool and portrait foundation.

We can predict many people the starter world is likely to need even though we cannot predict every person players will choose to approach. The prepared pool gives the plot agent and DM reliable social vocabulary and gives the asset team a bounded production target.

The pool remains open. A player may ask to speak to the lunch lady, a stable hand, a janitor, a random traveler, a shop worker, or another plausible person we never selected in advance. The DM may create that NPC and GameFrame must still present them coherently.

The machine-readable planning catalog is [`assets/monster-master-rpg-npc-role-catalog.json`](assets/monster-master-rpg-npc-role-catalog.json). The main RPG asset register remains the lifecycle and provenance authority when source production begins.

## Three NPC levels

### Named continuity anchors

These are specific people expected to recur across several sessions or starter packages. They receive unique prepared identity assets.

The initial anchor is:

- **Warden Pell** — veteran guide and field supervisor.

Other named anchors should be added only after lore, a selected plot family, or actual play establishes that they will recur.

### Prepared role templates

These are common world roles that can be instantiated with different names, appearances, attitudes, relationships, and motives.

Prepared templates include:

- station quartermaster or equipment clerk;
- station cook, cafeteria worker, or lunch lady;
- rival trainee or competing candidate;
- creature medic, handler, or stable specialist;
- cube technician, researcher, or repair specialist;
- road patrol officer, town guard, or junior warden;
- local farmhand, courier, road worker, stable hand, or witness;
- merchant, innkeeper, caravan worker, courier, or traveler;
- licensing clerk, inspector, or local official;
- festival organizer, announcer, performer, sponsor, or civic volunteer;
- fixer, fence, scammer, false inspector, or corrupt intermediary;
- intelligent monster citizen, professional, traveler, or official.

A role template is not one permanent face or personality. It maps likely functions to reusable portrait families and accessories.

### Incidental NPCs

These are people created because players interact with the world in an unplanned way.

GameFrame should be able to present an incidental NPC through:

1. an exact prepared role portrait;
2. a compatible portrait-family source with role accessories;
3. a composable portrait crop;
4. a named silhouette;
5. a text-only character card.

Once the DM assigns a visual identity, GameFrame should keep that identity when the NPC returns.

## Continuity and promotion

An incidental person can become important because players make them important.

Promotion occurs when:

- the players seek the NPC again;
- the NPC owns a task, clue, debt, favor, promise, payment, or disputed fact;
- the NPC suffers or causes a lasting consequence;
- a relationship changes materially;
- the NPC joins travel, employment, custody, rivalry, or another continuing role.

Promotion does not require immediate unique art. The NPC keeps their assigned portrait-family identity until manual production approves a bespoke source.

This protects emergent play without turning every unexpected conversation into an emergency asset request.

## P0 portrait foundation

### Unique anchor

- `npc.veteran-warden-guide.portrait`
  - Warden Pell;
  - unique source identity;
  - neutral, amused, suspicious, concerned, and alarmed expressions;
  - portrait and field token.

### Service-worker family

- `npc-family.service-worker`
  - quartermaster;
  - station cook or lunch lady;
  - cafeteria worker;
  - farmhand;
  - road worker;
  - stable hand;
  - ordinary witness.

Initial target: two visibly distinct source identities, with ledger-and-keys, apron or food-service, and work-gear variants.

### Candidate and rival family

- `npc-family.candidate-rival`
  - rival trainee;
  - competing candidate;
  - academy peer;
  - apprentice.

Initial target: two distinct identities, expressions from smug or amused through concerned and injured, plus field tokens.

### Care and handler family

- `npc-family.care-handler`
  - creature medic;
  - stable specialist;
  - handler;
  - field-care worker.

Initial target: two identities, care-kit and stable variants, and field tokens.

### Technical and scholar family

- `npc-family.technical-scholar`
  - cube technician;
  - researcher;
  - repair specialist;
  - inspection expert.

Initial target: two identities, tool, lens, and note variants.

### Guard and patrol family

- `npc-family.guard-patrol`
  - road patrol;
  - town guard;
  - junior warden;
  - checkpoint officer.

Initial target: two identities with interchangeable insignia and field tokens.

### Trade and travel family

- `npc-family.trade-travel`
  - merchant;
  - courier;
  - innkeeper;
  - caravan worker;
  - traveler.

Initial target: two identities with ledger, satchel, lodging, and caravan variants.

### Incidental character card

- `ui.incidental-npc-card`
  - stable name;
  - role label;
  - assigned portrait family or silhouette;
  - short manner cue;
  - clear fallback when no unique portrait exists.

## P1 portrait foundation

### Civic official family

- `npc-family.civic-official`
  - licensing clerk;
  - inspector;
  - local administrator;
  - minor official.

### Civic-event family

- `npc-family.civic-event`
  - festival organizer;
  - announcer;
  - performer;
  - sponsor;
  - volunteer.

### Underworld family

- `npc-family.underworld`
  - fixer;
  - fence;
  - scammer;
  - false inspector;
  - corrupt intermediary.

### Intelligent-monster citizen family

- `npc-family.intelligent-monster-citizen`
  - ordinary citizen;
  - licensed professional;
  - traveler;
  - merchant;
  - official;
  - specialist.

This family is important because intelligent monsters are part of ordinary society and should not appear only as companions, hazards, or exceptional plot devices.

### Diversity expansion

After each common P0 family has one working set, add second and later identities so one face does not become every cook, farmer, witness, and courier in the region.

A portrait family is not considered complete until it has at least two visibly distinct identities at intended card size.

## Expression and accessory system

Common expression targets:

- neutral;
- amused;
- guarded;
- concerned;
- angry;
- frightened;
- injured, where relevant.

Common role accessories:

- apron or food-service gear;
- ledger and quartermaster keys;
- care kit or stable gear;
- cube tools or inspection lens;
- patrol insignia;
- merchant ledger or courier satchel;
- permits, seals, or official badge;
- festival sash or announcer notes;
- forged authority gear or contraband case.

Accessories should communicate role while preserving the underlying identity. They should not make every role look like a costume-party caricature.

## Field-token boundary

Prepare field tokens for roles likely to enter tactical space:

- Warden Pell and other active guides;
- rivals;
- creature-care specialists involved in an encounter;
- road patrols and guards;
- underworld or false-authority actors;
- intelligent-monster professionals;
- selected package actors whose position matters tactically.

Cooks, clerks, merchants, shop workers, and ordinary witnesses may remain portrait-only unless play changes their operational role.

## Production sequence

1. create the incidental character card and silhouette fallback;
2. produce Pell’s unique portrait and field token;
3. produce two service-worker identities, including quartermaster and cook/lunch-lady presentation;
4. produce two candidate/rival identities and field tokens;
5. produce two care-handler identities and field tokens;
6. produce two technical-specialist identities;
7. produce two guard/patrol identities and field tokens;
8. produce two trade/travel identities;
9. test several scenes containing planned and improvised NPCs;
10. add civic, event, underworld, and intelligent-monster families as P1;
11. promote recurring incidental NPCs to bespoke art only when play proves the need.

## Acceptance

The NPC foundation is successful when:

- the likely starter cast can be presented without unique art for every role;
- a lunch lady or other unplanned person can appear immediately without blocking the DM;
- repeated appearances preserve the same visual identity;
- ordinary workers and social roles receive as much planning attention as suspects and combatants;
- NPCs may become recurring through player action;
- promotion does not force immediate bespoke production;
- portrait families remain visually distinct and readable at actual GameFrame size;
- tactical tokens exist only where operationally necessary.

## Governing rule

> Prepare a broad reusable cast foundation, let the DM create plausible people players actually seek, and preserve those people as stable characters without requiring bespoke art before they are allowed to matter.
