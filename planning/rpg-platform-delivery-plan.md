---
title: RPG Platform Delivery Plan
status: active
document_type: repository-plan
owner: Scribbles GameFrame
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime-integration
depends_on:
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-platform-roadmap.md
  - rpg-gm-runtime-boundary.md
  - rpg-gameframe-interface-contract.md
related:
  - ROADMAP.md
  - monster-master-rpg-current-creative-direction.md
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-cross-repository-integration-testing.md
---

# RPG Platform Delivery Plan

## Authority

`shared/rpg-platform-roadmap.md` controls cross-repository milestone order. This file defines the current GameFrame delivery posture.

Campaign combat never launches Battle Simulator. HTTP owns RPG commands/mutations; campaign WebSockets remain projection/notification-only.

## Delivery posture

```text
SEE      ✅ COMPLETE
MOVE     ✅ COMPLETE
MOBILE   ✅ COMPLETE
TALK     ✅ COMPLETE
CHANGE   ← ACTIVE
TRAVEL
FIGHT
PROVE
```

The physical world is the primary product surface. Narrative/history remains useful for opening narration, dialogue, arbitrary intent, Ask Game Master, fallback/accessibility, and the eventual Campaign Chronicle, but Chronicle UI polish is not the active milestone.

### Reuse-first rule

- reuse the existing Pixi renderer and terrain/materialization infrastructure;
- use authenticated HTTP for all RPG commands/mutations;
- keep WebSockets projection/notification-only;
- reuse deterministic tactical primitives and authenticated player/control infrastructure;
- reuse Runtime semantic authorities instead of creating GameFrame copies;
- add abstractions only when the next player action proves they are needed.

## Completed — SEE + MOVE + mobile

Deployed staging proves authenticated Runtime exploration attach → deterministic Crooked Checkpoint materialization → existing Pixi world rendering, plus desktop/touch movement, collision, facing, camera rotation/follow, optimistic physical revisions, SQLite recovery, and refresh/restart continuity without Runtime movement traffic.

The West Woods route remains a projected/physical affordance only. It does not yet transfer the player.

## Completed — TALK

Merged Runtime #112 and GameFrame #200 complete the first physically authorized conversation slice.

### GameFrame evidence

- nearby supported actors become viewer-safe Talk candidates;
- adjacency is derived from current GameFrame physical state;
- mobile and desktop use the same interaction path;
- multiple adjacent actors require explicit selection;
- browser submits only `interactionTargetId` and never canonical `targetEntityId`;
- GameFrame resolves the canonical entity only after current materialization/position/adjacency checks;
- generic command ingress cannot manufacture typed Talk authority;
- Talk delivery is durable/idempotent and an exact committed retry is recovered before another physical reauthorization;
- the shared composer preserves an uncertain Talk retry through campaign rerenders.

### Runtime evidence

- typed Talk becomes a distinct `entity-interaction` trigger;
- Dungeon Master performs Pell through perspective-bounded entity-performance context;
- Pell receives Pell's identity/goals/secrets/limits, recent explicit Observer Knowledge, current public location material, and viewer-safe known people;
- unrelated hidden campaign/referee truth is structurally absent;
- the referee-only sentinel canary remains visible to referee context but absent from Pell context;
- entity-performance output is dialogue-only in this first slice: no mechanics, semantic mutation, transition, or tactical activation;
- non-TALK semantic triggers continue through their normal planner path.

### Current speech scope

The first slice deliberately publishes Talk to the initiating player only. Real nearby audibility, overhearing, whispers, split-party propagation, and presentation fan-out are **not** claimed complete. This fails closed while the underlying observer/audience model is expanded later.

The first slice also limits Talk to actor targets that Runtime can currently perform. Do not expose roster-monster Talk until the performer contract supports that entity class.

## Bounded content cleanup

Continue only where it affects correctness or current play:

- unlearned canonical names must not leak into narration/dialogue/history;
- ordinary handheld capture cubes cannot physically shake a cart without another credible cause;
- opening narration should orient the player and return control rather than repeatedly forcing option funnels;
- do not create a separate Chronicle-polish milestone before the world is functional.

## CHANGE — ACTIVE: controls and arbitrary intent reach the same world

This is the next vertical target. It proves the graphics do not limit tabletop agency and that model prose does not bypass deterministic/semantic authority.

### Primary player acceptance

```text
Cinder is recalled
→ player chooses Deploy from a direct control
  OR types: "I pull out Cinder's cube and release her beside me."
→ both paths resolve to the same deploy operation
→ ownership/ruleset/deployment constraints validate it
→ semantic deployment commits
→ GameFrame chooses a legal physical placement
→ Cinder appears in the current scene
→ narration/history reflects the committed result
→ refresh/restart preserves deployment
```

### Required architecture

- direct UI and **Do Something Else** converge on the same underlying world/mechanic operation;
- natural language expresses attempted intent, not authoritative state;
- illegal or impossible intent stays uncommitted even if a model proposes it;
- Runtime owns semantic presence/deployment consequence; GameFrame owns physical placement and deterministic control/rules checks appropriate to its authority;
- retries are idempotent and recover from lost responses;
- deployment/control relationships come from the Monster Master ruleset/profile rather than generic-engine assumptions;
- the resulting exploration projection/materialization reflects the committed deployment without parallel shadow state.

### Follow-on CHANGE operations

Promote only what the chapter proves necessary after deploy/recall:

- inspect/use/open/take/change important objects;
- knowledge reveal/correction;
- deterministic checks;
- objective/event transitions;
- relationship/memory consequences.

The text itself never creates state. Commit first, then presentation/history.

## TRAVEL — make West Woods real

```text
Crooked Checkpoint route affordance
→ validate current available semantic exit
→ authoritative semantic scene transfer
→ materialize scene.west-woods
→ establish valid physical arrival state
→ explore
→ return
→ same Crooked Checkpoint materialization/state
```

Do not infer travel solely from client coordinates. Physical arrival enables the command; semantic transfer is durable authority.

## FIGHT — same-map tactical authority

Promote only current-scene Monster Master rules/control requirements: Master/trainer participation, ruleset-authorized deployed monsters, initiative/action economy/legal actions, current positions/geometry, resources/conditions/objectives, structured non-elimination outcomes, semantic reconciliation, and same-map exploration resume.

No campaign Arena handoff or replacement battle map.

## PROVE

Complete the bounded chapter before broadening architecture:

1. human playthrough with multiple plausible actions;
2. restart/reconnect;
3. deterministic/machine-play;
4. live-provider proof;
5. deployed staging proof.

Only after that: richer two-human local speech semantics, second handcrafted Game Family, Campaign Architect, dynamic Battle Packs/Battle Simulator, split-party later.

## Campaign Chronicle posture

The feed should mature into an observer-authorized **Campaign Chronicle**, not a tiny combat log and not the permanent primary controller. It should retain meaningful narration, dialogue the observer was authorized to hear, discoveries, consequential actions, mechanics, world changes, travel, and appropriate GM material.

One semantic event may have several authorized presentations. Origin, audience, audibility, Observer Knowledge, and presentation style remain distinct.

## Development workflow

```text
pick next player action
→ inspect existing authorities/code for reuse
→ state one concrete acceptance proof
→ implement smallest complete vertical slice
→ focused iteration tests
→ claim-appropriate gates
→ docs/evidence update
→ merge
→ play it
→ next action
```

Use focused Node/browser tests for GameFrame behavior, Fast Check for Runtime behavior, exact shared-doc drift/hygiene for shared contracts, cross-repo integration for seam changes, durable recovery tests for persistence, and hidden-fact/Observer-Knowledge canaries for context custody.

## Immediate order

1. **CHANGE — deploy/recall as the first persistent direct-control + freeform-parity world mutation.**
2. **TRAVEL — Crooked Checkpoint ↔ West Woods.**
3. **FIGHT — Monster Master control/rules + same-map Tactical Activation.**
4. **PROVE — complete single-player chapter/restart/provider/staging.**
5. richer multiplayer audibility/whispers + two-human one-scene.
6. second handcrafted Game Family.
7. Campaign Architect + dynamic Role-Playing Games/Battle Packs.
8. dynamic Battle Simulator convergence.
9. split-party later.

## Governing rule

> Deliver the game by completing the next player action. Keep the world primary, keep freeform intent legal, require authoritative commits before narration claims consequences, and defer Campaign Chronicle presentation polish until ordinary play can be performed directly in the world.
