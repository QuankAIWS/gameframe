---
title: Monster Master RPG NPC Pool and Portrait Foundation
status: active
document_type: asset-and-presentation-plan
owner: Scribbles GameFrame
last_updated: 2026-08-08
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
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-event-and-plot-pool-contract.md
---

# Monster Master RPG NPC Pool and Portrait Foundation

## Decision

Monster Master maintains a reusable NPC role/portrait foundation.

The pool is source material for handcrafted CampaignPackages and future Campaign Architect output. It is not a closed cast, an executable campaign, or the runtime NPC-instance authority.

Three responsibilities are distinct:

- **Campaign Architect/manual authoring** binds package-bearing actors before play;
- **Character Factory** materializes bounded incidental NPC instances requested during play;
- **Dungeon Master** portrays those committed entities and reasons about their reactions.

GameFrame presents only viewer-safe identity/knowledge projections for those entities.

## Package-bearing actors

Campaign construction must bind any role that owns package invariants such as:

- hidden cause/responsible actor identity;
- decisive or required evidence;
- secret authority;
- mandatory campaign access;
- invariant relationship/obligation;
- recurring role required by the package.

Those entities receive concrete stable IDs, identities, motives, secrets, relationships, and semantic presentation roles in the package.

The Dungeon Master does not replace them because another character would be narratively convenient.

## Prepared role templates

Common role templates may include:

### Station and academy

- veteran warden/field guide;
- quartermaster/equipment clerk;
- cook/cafeteria worker/lunch lady;
- rival trainee/candidate;
- licensing clerk/administrator;
- cube technician/researcher/repair specialist.

### Creature care and field work

- creature medic/handler/stable specialist;
- farmhand/courier/road worker/stable hand/ordinary witness;
- intelligent-monster citizen/professional/traveler/official.

### Travel, commerce, and authority

- road patrol/town guard/junior warden;
- merchant/innkeeper/caravan worker/courier/traveler;
- festival organizer/announcer/performer/sponsor/volunteer;
- fixer/fence/scammer/false inspector/corrupt intermediary.

A template supplies bounded role vocabulary and presentation coverage. It is not automatically one permanent person, personality, culprit, or clue owner.

## Character Factory use

When live play reasonably requires an unprepared person, the Dungeon Master may request a role through the runtime Character Factory.

Example semantic request:

```text
role: station-cook
location: field-station
constraints: local civilian adult
```

The Character Factory returns one validated durable entity with, as appropriate:

- stable runtime entity ID;
- generated/selected name;
- role;
- appearance/portrait-family identity;
- manner/voice cues;
- affiliations/location;
- bounded competencies;
- initial ordinary knowledge justified by role/location;
- presentation fallback;
- provenance as campaign-created incidental entity.

The model does not directly invent a new durable ID through arbitrary prose/fact writes.

## Campaign truth boundary

An incidental NPC may:

- know ordinary local facts;
- notice justified details;
- misunderstand events;
- offer help;
- create trouble;
- become important because players make them important.

An incidental NPC may not become a committed culprit, decisive witness, secret authority, or owner of indispensable evidence unless the CampaignPackage explicitly declared that function open.

Knowledge, access, competence, and influence must follow role, location, relationships, and established events.

## Promotion to recurring character

Promote an incidental NPC when continuity matters, including when:

- players seek them again;
- they own a task, clue, promise, debt, favor, payment, or disputed fact;
- they suffer/cause a lasting consequence;
- a relationship changes materially;
- they join travel, employment, custody, rivalry, or another continuing role.

Promotion preserves the **same entity**, including:

- stable runtime ID;
- name and identity;
- appearance/portrait family;
- role and competence;
- facts learned/stated;
- promises/lies/gifts/insults/payments;
- injuries/debts/suspicions;
- relationships and attitudes.

Promotion does not require immediate bespoke art.

## Player knowledge boundary

Runtime canonical identity and player-known identity are separate.

GameFrame's People view uses the viewer-authorized label/facts for the same stable entity. A person may therefore appear first as:

```text
"a cafeteria worker with a flour-covered apron"
```

and later as:

```text
"Dessa Bram — station cook"
```

once the character actually learns that information.

Unknown people are absent from People projections. Hidden canonical names are not shown as redacted entries.

## Scene presence

NPC existence does not imply current physical presence.

Scene Registry determines whether an entity is currently in the scene. An absent NPC may be remembered/discussed/contacted through an explicit remote channel, but cannot physically speak/act in the scene because the model happened to remember them.

## Named continuity anchor

Warden Pell remains the initial named prepared continuity anchor because the veteran guide is expected to recur across the reference package.

Additional unique anchors should be created only when package/lore/play proves recurring value.

## Asset-resolution order

For a viewer-authorized NPC, GameFrame should resolve presentation in this order:

1. exact prepared entity identity;
2. assigned prepared role portrait;
3. portrait-family identity with role accessories;
4. composable incidental portrait;
5. stable named silhouette/text card.

The assignment persists when the entity returns.

## P0 portrait foundation

### Unique

- Warden Pell portrait + field token + useful expressions.

### Families

- service worker;
- candidate/rival;
- care/handler;
- technical/scholar;
- guard/patrol;
- trade/travel;
- incidental character-card/silhouette fallback.

Each common family should eventually have multiple visibly distinct identities at intended card size so repeated incidental characters do not look like literal clones.

## P1 portrait foundation

- civic official;
- public-event organizer/performer;
- underworld/false-authority;
- intelligent-monster citizen/professional.

Intelligent monsters should appear as ordinary members of society where lore permits, not only as companions/hazards/plot devices.

## Expression/accessory system

Useful expression states:

- neutral;
- amused;
- guarded;
- concerned;
- angry;
- frightened;
- injured where relevant.

Useful accessories:

- food-service gear;
- ledger/quartermaster keys;
- care/stable gear;
- cube tools/inspection lens;
- patrol insignia;
- merchant ledger/courier satchel;
- permits/seals/badges;
- festival accessories;
- forged-authority gear/contraband case.

Accessories communicate role without forcing one personality onto every instance.

## Field-token boundary

Prepare tactical tokens only for roles likely to enter tactical space:

- active guides;
- rivals;
- care specialists involved in encounters;
- patrols/guards;
- criminal/false-authority actors;
- intelligent-monster professionals;
- package actors whose physical positioning matters.

Ordinary social NPCs remain portrait-only unless play changes their operational role.

## Acceptance

The NPC foundation succeeds when:

- packages bind concrete important actors;
- an ordinary unprepared person can appear without blocking play;
- Character Factory gives that person one stable durable identity;
- revisiting them preserves identity/knowledge/relationships;
- incidental NPCs cannot rewrite committed package truth;
- People projections reveal only viewer-known identity/facts;
- scene presence is explicit rather than inferred from narration;
- promotion does not require bespoke art;
- likely tactical NPCs have usable field-token/fallback coverage.

## Governing rule

> Campaign authoring binds the people who carry plot truth; Character Factory materializes the ordinary people live play needs; the Dungeon Master portrays them; and GameFrame shows only the identity and facts the player character has actually learned.
