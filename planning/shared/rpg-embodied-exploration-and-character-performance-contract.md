---
title: RPG Embodied Exploration and Character Performance Contract
status: accepted
document_type: architecture-contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
  - future bespoke campaigns
shared_document_id: rpg-embodied-exploration-and-character-performance-v1
shared_document_version: 4
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-embodied-exploration-and-character-performance-contract.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-embodied-exploration-and-character-performance-contract.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-platform-roadmap.md
  - rpg-cloudflare-deployment-architecture.md
  - ../rpg-gameframe-interface-contract.md
---

# RPG Embodied Exploration and Character Performance Contract

## Decision

The mature RPG experience is an **embodied persistent 2D campaign world**, not a transcript-first adventure with separate battle maps.

Players normally move through materialized locations, approach entities/objects/routes, use supported mechanics, talk directly to characters, and continue through the same world when strict tactical resolution begins.

The Dungeon Master remains a real distinct campaign capability for adjudication, framing, narration, Ask-GM, unusual freeform actions, entity performance, pacing, consequences, and intervention.

> GameFrame materializes the campaign world but does not define the limits of player intent.

The existing text-first campaign surface remains useful for narration, history, fallback, accessibility, testing, recovery/debug, and GM communication. It is not the mature primary loop.

## Authority split

### Semantic world truth — RPG GM Runtime

Examples: entity identity, scene membership, WorldGraph adjacency, object semantic state, observer knowledge, clues/objectives/events, relationships/memories, travel availability, tactical activation reason.

### Materialized/physical authority — GameFrame

Examples: accepted scene materialization, geometry, collision/pathing, semantic anchors, transition zones, x/y/facing, interaction range, current deterministic rules/control state, tactical position/state.

### Presentation

Examples: pixels, speech bubbles, subtitles, narration panels, chronicle entries, animations, audio.

Presentation may visualize committed truth. It does not create truth by itself.

## Primary loop

```text
materialized exploration scene
→ movement / camera / target selection
→ direct entity/object/route interaction
→ deterministic mechanic when available
→ bounded semantic commit when world truth changes
→ player-safe projection/world presentation updates
→ continue exploring
```

At any point:

```text
Ask Game Master
Do Something Else / freeform intent
```

When initiative is required:

```text
exploration
→ Tactical Activation
→ same scene under turn-based authority
→ tactical resolution
→ semantic reconciliation
→ same scene returns to exploration
```

## Explore

GameFrame owns ordinary physical navigation, camera, collision/picking, current materialized world, nearby targeting, and supported deterministic world mechanisms.

High-frequency movement is not Runtime journal traffic. Current accepted movement mutation uses authenticated HTTP; WebSockets remain projection/notification-only.

## Interact / Talk

A player targets a viewer-authorized entity/object/route that is physically eligible under GameFrame interaction range/targeting rules.

Talking to Pell is an in-fiction act directed at Pell. The semantic target is stable; presentation labels remain observer-authorized.

GameFrame proves physical eligibility. Runtime proves semantic presence and compiles the appropriate Dungeon Master/entity context when needed.

## Entity performance and perspective custody

A character-performance turn is bound to exactly one performing durable entity.

Its context may include only relevant:

- stable identity/role;
- portrayal/personality constraints;
- goals/pressures;
- relationships;
- that entity's Observer Knowledge/beliefs;
- memories/promises;
- current observations;
- conditions/resources where relevant;
- bounded recent conversation;
- package invariants necessary for truthful portrayal without exposing unrelated hidden truth.

A model that can access hidden referee truth in another mode does not receive that truth in entity-performance mode unless the performing entity legitimately knows it.

### Pell canary

```text
referee context contains hidden X
Pell does not know X
→ Pell context excludes X
→ Pell output cannot use X

Pell legitimately learns X
→ Observer Knowledge commits X
→ Pell context may contain X later
```

This is semantic context construction, not post-hoc prose filtering.

## Do Something Else

Do Something Else is a first-class freeform escape hatch for plausible in-fiction intent not represented by dedicated controls.

The Dungeon Master interprets **attempted intent**. Deterministic/game/semantic authorities resolve what succeeds.

Example:

```text
"I pull out Cinder's cube and release her beside me."
→ interpret deploy intent
→ validate ownership/deployment limits/current state
→ commit accepted semantic + GameFrame physical state
→ Cinder appears in the world
→ narration/history reports the result
```

Declarative player language cannot itself bypass rules, locks, collision, inventory, control authority, or campaign truth.

Repeated useful freeform behaviors may later gain dedicated controls; the lack of a button is not evidence that a plausible action is impossible.

## Ask Game Master

Ask-GM is out-of-fiction communication with the Dungeon Master/referee.

It may answer rules, character knowledge, remembered information, licenses, local lore, or clarification.

Ask-GM is player-private by default. It does not automatically become fictional speech, make NPCs hear it, or advance fictional time merely because the player asked.

## GM intervention

The Dungeon Master may proactively address a player, party, or table through audience-scoped narration/advisory/dramatic presentation.

A presentation may pause local input or frame a dramatic moment, but any world-state change still requires validated authority/commit.

## Origin, audience, audibility, observation, presentation

These are distinct concepts:

- **origin** — player, entity, dungeon-master, deterministic-mechanic, system;
- **audience** — who may receive the event/presentation/history;
- **audibility/observation** — who in-fiction actually heard/saw it;
- **Observer Knowledge** — semantic knowledge actually acquired/held;
- **presentation** — how an authorized client displays it.

Do not infer one from another without an explicit rule.

### Normal speech

A normal spoken line may be audible to nearby observers according to scene/audibility rules. Those observers may receive the line and any justified knowledge acquisition.

### Whisper/private speech

A whisper or other intentionally private in-fiction communication can restrict audibility/audience. Nearby presence does not imply universal hearing.

### Ask-GM

Private GM communication is not audible in-fiction and does not give NPCs knowledge.

### Multiplayer implication

Party membership does not mean magically shared sensory knowledge. Two players may receive different dialogue/history/knowledge when they were in different places, out of earshot, or given private information.

## One event, multiple presentations

A semantic event should not be duplicated merely to support different UI forms.

Example:

```text
Pell speaks
→ one authorized entity-origin dialogue event
→ nearby client may show temporary speech bubble/subtitle
→ campaign chronicle may retain the same line
→ relevant Observer Knowledge may be updated separately when justified
```

Presentation can change later without changing what happened.

## Campaign Chronicle

GameFrame should retain an observer-authorized campaign chronicle/history surface.

It may contain:

- opening and important scene narration;
- dialogue the observer heard/participated in;
- important discoveries/knowledge reveals;
- consequential player actions;
- deterministic mechanic results;
- persistent world changes;
- travel/scene transitions;
- GM interventions/rulings appropriate to that audience.

It should not need every movement step, camera change, hover, animation, or other transient physical event.

The chronicle is not intended to collapse into a tiny combat log; it should be readable as campaign history. It is also not intended to remain the primary control surface once embodied interaction is mature.

Different observers may legitimately have different chronicle content.

## Observer-safe identity

Canonical entity identity is separate from what an observer knows.

A stable actor can appear to one observer as:

```text
"the woman in inspector's gear"
→ "the checkpoint official"
→ "Mara Venn"
```

Narration, dialogue attribution, map labels, People views, and chronicle entries use the observer-authorized identity stage. Another observer may remain at an earlier stage.

## WorldGraph and scene materialization

CampaignPackage/Runtime owns semantic location/route meaning. GameFrame owns playable materialization.

Materialization may use accepted assets, authored prefabs/world kits, deterministic/seeded composition, bounded generated presentation assets, and validated fallbacks.

Generated imagery does not define collision or semantic truth.

Once accepted for a campaign instance, materialization identity and meaningful state persist so revisiting returns to the same place.

## Semantic movement boundaries

Per-step movement is GameFrame physical state. Durable semantic operations occur when movement crosses a meaningful boundary, for example:

- scene transfer;
- locked/guarded threshold;
- significant object movement/use/destruction;
- tactical activation;
- reaching/using an exit that changes semantic location.

Physical arrival at an exit can enable a travel command; client coordinates alone do not authorize semantic transfer.

## Many maps, one active party scene first

Scene Registry supports zero-or-more semantic scenes. Initial multiplayer product posture remains one shared active party scene while the campaign may contain many persistent locations/maps.

Split-party simultaneous scenes come later because they require scene-local realtime subscriptions, audibility/knowledge divergence, concurrent causality, recovery, and tactical/time rules.

## NPC memory

Conversation transcript is not the sole authority for what an NPC remembers.

Important promises, debts, insults, learned names, witnessed events, injuries, custody, suspicions, tasks, and relationships should promote into typed semantic state when they matter. Bounded recent conversation may support continuity without becoming the entire memory model.

## Same-map tactical rule

Tactical Mode is a stricter deterministic control regime over the current materialized world scene.

Current positions, entities, important objects, terrain/collision, exits, and relevant resources remain. Tactical overlays/initiative/action economy/legal actions become active. Terminal results update the same world; exploration resumes in place after reconciliation.

No campaign battle-map loading or Return-to-Campaign step.

## Governing rule

> The player inhabits one durable world. Physical controls, targeted character interaction, arbitrary freeform intent, private GM communication, and readable observer-scoped history are different ways of interacting with that world—not competing sources of truth.
