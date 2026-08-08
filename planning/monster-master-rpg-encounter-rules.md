---
title: Monster Master RPG Encounter Rules
status: accepted
document_type: contract
owner: Scribbles GameFrame
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - Monster Master RPG
  - RPG GM Runtime integration
related:
  - monster-master-rules.md
  - rpg-gameframe-interface-contract.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-monster-master-reference-campaign.md
  - ROADMAP.md
---

# Monster Master RPG Encounter Rules

## Purpose

Monster Master RPG encounters reuse GameFrame tactical primitives and ordinary authoritative match/session infrastructure, but they are not constrained forever to the fixed standalone `monster-master-duel` scenario defined by MM-0001.

MM-0001 remains the small deterministic standalone duel and regression target. This contract defines the campaign-facing direction for tactical encounters that must preserve the current fictional scene rather than replacing it with a generic duel roster.

## Governing principle

> Arena Battles is a stricter resolution mode for the current campaign scene. When tactical play starts, people, creatures, objectives, and materially relevant objects do not disappear merely because the rules engine changed modes.

## Input contract

The runtime supplies a validated encounter-scene projection derived from the authoritative current scene.

The projection must retain exact campaign entity identity for every required tactical participant and may include:

- human trainers;
- owned or allied monsters;
- hostile trainers and monsters;
- NPC allies;
- civilians and protected entities;
- neutral or frightened creatures;
- escaping entities;
- scene objects and barriers;
- exit/withdrawal zones;
- objectives and alternate terminal conditions.

GameFrame validates the requested surface against explicit implemented capability. Unsupported combat-relevant requirements fail closed before encounter custody.

## Tactical participant roles

The target bounded role vocabulary is:

- `allied-combatant`;
- `hostile-combatant`;
- `neutral`;
- `noncombatant`;
- `protected`;
- `escaping`;
- `support`;
- `objective-entity`.

The first implementation does not need every role at once. It must never silently omit a requested role that materially affects the encounter.

## Trainers

Campaign trainers are real player characters and may eventually participate tactically according to their committed trainer archetype and implemented GameFrame rules profile.

The current production materializer excludes trainers and materializes only supported creatures. That remains a bounded compatibility surface, not the desired final Monster Master RPG rule.

Trainer tactical support should be added through explicit profiles such as Vanguard, Commander, Arcanist, Medic, and Caller only when GameFrame implements their legal actions deterministically.

A trainer may not be silently replaced by the standalone MM-0001 `Warden Master` merely because that unit already exists.

## Scene fidelity

The Encounter Scene Compiler should preserve the current scene elements required by fiction and objectives.

Examples for the Crooked Checkpoint package include:

- the player's trainer;
- the player's deployed monster;
- Warden Pell if still present and participating;
- relevant opposition people/monsters;
- Emberglass if physically present;
- the pack lizard if still attached to the cart;
- the confiscation cart and road barrier when they materially constrain the scene;
- side-road or route exits used by escape objectives.

Whether every present entity becomes an independently controlled tactical unit is ruleset-specific. Presence must nevertheless be represented truthfully where it affects legal actions or terminal outcomes.

## Objectives

Campaign encounters must not be limited forever to `defeat all opposition`.

The target objective vocabulary should support bounded forms such as:

- defeat or incapacitate opposition;
- protect an entity;
- prevent removal of an object;
- reach or hold a location;
- escape or withdraw;
- prevent an escape;
- survive for a bounded interval;
- force surrender;
- recover or secure an objective entity.

A package may combine a small number of supported objectives. Unknown objective semantics fail closed.

## Escape and withdrawal

Campaign combat requires legal ways to leave tactical play without being eliminated.

Supported terminal participant outcomes should distinguish at least:

- `active`;
- `incapacitated`;
- `withdrew`;
- `fled`;
- `surrendered`;
- `recalled`.

When lethal rules are later enabled, `dead` is explicit and separate.

The preferred first primitive for physical withdrawal is an authored visible exit zone. A participant with an escape objective reaches the legal exit and leaves the tactical state through an authoritative action/effect.

A neutral or frightened creature whose fiction says it wants to flee should not be forced to attack indefinitely because elimination is the only terminal state.

## Asymmetric forces

Campaign encounters may naturally contain unequal numbers of tactical participants.

The current MM-0001 alternating deployment algorithm requires equal roster counts. The RPG path should eventually implement a deployment/materialization rule that can represent asymmetric sides without inventing duplicate units or dropping scene entities.

Until then, asymmetric requests fail closed rather than being reshaped into a symmetric duel.

## Opposition and non-player behavior

Built-in deterministic behavior remains `GameFrameBot`/game-specific bot behavior, not an AI persona claim.

Campaign encounter participants may eventually use bounded deterministic behavior profiles such as:

- defend;
- pursue;
- protect;
- flee;
- surrender-under-pressure;
- hold-position;
- escort;
- scripted-support.

These are rules policies executed by GameFrame, not hidden Dungeon Master authority over tactical results.

## Terminal outcome

GameFrame returns structured outcomes for exact campaign participant identities.

The result should be able to report:

- participant terminal state;
- health/condition/injury state supported by the ruleset;
- withdrawal/escape destination where relevant;
- captured or secured objectives;
- object damage or custody where supported;
- spent resources;
- winning/losing team when meaningful;
- objective completion/failure;
- authoritative revision and commit time.

Runtime maps those exact results back into campaign world/scene truth and only then asks the Dungeon Master to narrate aftermath.

## Crooked Checkpoint target proof

The reference campaign should eventually prove one encounter where tactical state derives from the actual checkpoint scene.

A valid implementation should support a scenario in which, depending on prior play:

- Orange and Cinder are present as exact campaign entities;
- Pell may be present as a bounded support ally rather than disappearing;
- Mara/Tollan or other established opposition are represented if they are the hostile participants;
- Emberglass can have an escape objective rather than a mandatory fight-to-the-death policy;
- the cart/barrier/exits required by the objective are preserved;
- the structured outcome records who fled, surrendered, was incapacitated, remained at the scene, and what happened to the cubes/evidence.

The exact participant set must come from current scene truth, not from a canned fixture.

## Relationship to MM-0001

Do not delete or silently mutate MM-0001's fixed three-unit standalone duel contract merely to obtain campaign fidelity.

Use this campaign-specific contract to evolve RPG encounter capability while continuing to reuse:

- tactical map primitives;
- legal action machinery;
- MatchSession;
- replay;
- persistence;
- authenticated action authority;
- deterministic bot infrastructure;
- rendering infrastructure.

When a capability becomes generally useful and stable, it may be promoted into reusable tactical-core or Monster Master rules primitives deliberately.

## Implementation order

1. retain current participant-faithful creature-only configured RPG path as the existing baseline;
2. add explicit encounter-scene contract and fail-closed role validation;
3. add withdrawal/escape terminal semantics and exit zones;
4. add asymmetric scene materialization;
5. add trainer tactical profiles required by the reference campaign;
6. add protected/noncombatant/support roles as actual package needs prove them;
7. prove the Crooked Checkpoint scene-faithful encounter and aftermath;
8. broaden only from demonstrated campaign requirements.

## Governing rule

> Keep the standalone duel small, but make Monster Master RPG combat a faithful tactical projection of the campaign scene, with exact entities, explicit objectives, and meaningful ways to flee, surrender, protect, or survive besides killing everything on the other side.
