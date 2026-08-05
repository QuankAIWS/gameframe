---
title: Monster Master RPG NPC Pool and Portrait Foundation
status: active
document_type: asset-and-presentation-plan
owner: Scribbles GameFrame
last_updated: 2026-08-05
applies_to:
  - Monster Master gold-standard CampaignPackage
  - GameFrame character presentation
  - manual Monster Master asset production
related:
  - monster-master-rpg-canonical-baseline.md
  - assets/monster-master-rpg-npc-role-catalog.json
  - monster-master-rpg-asset-register.md
  - assets/monster-master-rpg-asset-register.json
  - monster-master-rpg-current-creative-direction.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-event-and-plot-pool-contract.md
---

# Monster Master RPG NPC Pool and Portrait Foundation

## Decision

Monster Master maintains a reusable NPC role pool and portrait foundation.

The pool is source material for the handcrafted Monster Master CampaignPackage and a reference for future Campaign Architect output. It is not a closed cast or an executable campaign by itself.

The **Campaign Architect** selects and binds likely recurring, plot-bearing, hidden, and clue-owning roles while constructing a CampaignPackage. For Monster Master, the team performs that authoring manually.

The **Dungeon Master** may create plausible incidental people when players seek or encounter someone not prepared in advance. Every introduced NPC receives stable identity and continuity.

The machine-readable planning catalog is `assets/monster-master-rpg-npc-role-catalog.json`. The main RPG asset register remains the lifecycle and provenance authority when source production begins.

## Three NPC levels

### Named continuity anchors

Specific people expected to recur across packages or sessions receive unique prepared identities.

The initial anchor is:

- **Warden Pell** — veteran guide and field supervisor.

Other anchors should be added only when lore, a complete CampaignPackage, or actual play establishes durable recurring value.

### Prepared role templates

Common roles may be instantiated with different names, appearances, attitudes, relationships, and motives.

Templates include:

- station quartermaster or equipment clerk;
- station cook, cafeteria worker, or lunch lady;
- rival trainee or competing candidate;
- creature medic, handler, or stable specialist;
- cube technician, researcher, or repair specialist;
- road patrol officer, town guard, or junior warden;
- local farmhand, courier, road worker, stable hand, or witness;
- merchant, innkeeper, caravan worker, courier, or traveler;
- licensing clerk, inspector, or local official;
- festival organizer, announcer, performer, sponsor, or volunteer;
- fixer, fence, scammer, false inspector, or corrupt intermediary;
- intelligent-monster citizen, professional, traveler, or official.

A role template is not a permanent face, personality, culprit, clue owner, or campaign actor. The CampaignPackage binds concrete identities and functions where campaign truth requires them.

### Incidental NPCs

Incidental NPCs are created because players interact with the world in an unplanned but plausible way.

GameFrame should present them through this order:

1. exact prepared role portrait;
2. compatible portrait-family identity with role accessories;
3. composable portrait;
4. named silhouette;
5. text-only character card.

Once assigned, the same visual and semantic identity must be preserved when the NPC returns.

## Campaign truth boundary

The Campaign Architect must bind before play any role that owns:

- the hidden cause;
- responsible actor identity;
- decisive or required evidence;
- secret authority;
- mandatory campaign access;
- an invariant relationship or obligation.

The Dungeon Master may not retroactively give those functions to an incidental NPC unless the committed CampaignPackage explicitly leaves the role open.

Incidental characters receive only knowledge, access, competence, motives, and relationships justified by their role, location, and established events.

## Continuity and promotion

An incidental person becomes recurring when:

- players seek them again;
- they own a task, clue, debt, favor, promise, payment, or disputed fact;
- they suffer or cause a lasting consequence;
- a relationship changes materially;
- they join travel, employment, custody, rivalry, or another continuing role.

Promotion preserves:

- stable runtime NPC ID;
- name and identity;
- appearance and assigned portrait family;
- role and known competence;
- established facts and knowledge;
- promises, lies, gifts, insults, payments, injuries, debts, suspicions, and relationships.

Promotion does not require immediate unique art. The assigned portrait-family identity remains until deliberate production supersedes it.

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

Initial target: two visibly distinct identities with ledger-and-keys, food-service, and work-gear variants.

### Candidate and rival family

- `npc-family.candidate-rival`
  - rival trainee;
  - competing candidate;
  - academy peer;
  - apprentice.

Initial target: two distinct identities, useful expressions, and field tokens.

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

Initial target: two identities with tool, lens, and note variants.

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
  - readable text fallback.

## P1 portrait foundation

- `npc-family.civic-official` — licensing clerks, inspectors, administrators, minor officials;
- `npc-family.civic-event` — organizers, announcers, performers, sponsors, volunteers;
- `npc-family.underworld` — fixers, fences, scammers, false inspectors, corrupt intermediaries;
- `npc-family.intelligent-monster-citizen` — citizens, professionals, travelers, merchants, officials, and specialists.

Intelligent monsters are part of ordinary society and should not appear only as companions, hazards, or exceptional plot devices.

Each common family should eventually have at least two visibly distinct identities at intended card size.

## Expression and accessory system

Common expressions:

- neutral;
- amused;
- guarded;
- concerned;
- angry;
- frightened;
- injured where relevant.

Common accessories:

- food-service gear;
- ledger and quartermaster keys;
- care kit or stable gear;
- cube tools or inspection lens;
- patrol insignia;
- merchant ledger or courier satchel;
- permits, seals, or official badge;
- festival accessory;
- forged authority gear or contraband case.

Accessories communicate role without turning every character into a costume caricature.

## Field-token boundary

Prepare field tokens for roles likely to enter tactical space:

- active guides;
- rivals;
- care specialists involved in encounters;
- patrols and guards;
- criminal or false-authority actors;
- intelligent-monster professionals;
- package actors whose positioning matters.

Ordinary social NPCs may remain portrait-only unless play changes their operational role.

## Production sequence

Asset production follows the product-wide asset register and the shared roadmap. Within the NPC foundation:

1. incidental character card and silhouette fallback;
2. Pell’s unique portrait and field token;
3. two service-worker identities;
4. two candidate/rival identities and tokens;
5. two care-handler identities and tokens;
6. two technical-specialist identities;
7. two guard/patrol identities and tokens;
8. two trade/travel identities;
9. scene tests containing package-selected and incidental NPCs;
10. civic, event, underworld, and intelligent-monster families;
11. bespoke art for recurring incidental NPCs only when play proves the need.

This production work supports the first complete CampaignPackage. It does not outrank package construction or Dungeon Master machine-play testing.

## Acceptance

The NPC foundation succeeds when:

- the gold-standard CampaignPackage can bind a concrete cast from prepared roles;
- likely social roles can appear without unique art for every person;
- an unplanned lunch lady or other plausible person can appear without blocking play;
- repeated appearances preserve semantic and visual identity;
- incidental NPCs cannot rewrite committed package truth;
- players can promote ordinary people into durable recurring characters;
- portrait families remain distinct and readable;
- tactical tokens exist only where operationally necessary.

## Governing rule

> The Campaign Architect binds campaign-bearing roles, the Dungeon Master creates plausible incidental people, and GameFrame preserves every introduced identity without requiring bespoke art before a character is allowed to matter.
