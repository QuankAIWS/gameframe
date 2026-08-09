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

```text
CampaignPackage + RPG Ruleset + reusable game-family content
                         ↓
             GameFrame RPG Engine ←→ RPG GM Runtime
                         ↓
              persistent embodied campaign
```

Campaign combat never launches Battle Simulator.

## Delivery posture

The current player journey is:

```text
SEE      ✅
MOVE     ✅
MOBILE   ✅
TALK     ← ACTIVE
CHANGE
TRAVEL
FIGHT
PROVE
```

The physical world is now the primary product surface. The existing narrative/feed UI remains useful for narration, history, fallback, accessibility, testing, and GM communication, but feed UX is not the next product milestone.

### Reuse-first rule

- reuse the existing Pixi renderer and terrain/materialization infrastructure;
- use authenticated HTTP for all RPG commands/mutations, including exploration movement;
- keep WebSockets projection/notification-only;
- reuse deterministic tactical primitives;
- reuse authenticated player/control infrastructure;
- reuse Runtime semantic authorities instead of creating GameFrame copies;
- add abstractions only when the next player action proves they are needed.

## Completed — SEE

The deployed staging path proves authenticated Runtime exploration attach → deterministic Crooked Checkpoint materialization → existing Pixi world rendering with stable materialization identity and viewer-safe entities/objects/routes.

## Completed — MOVE + mobile

The deployed staging path proves desktop and touch movement over the same GameFrame-owned HTTP mutation authority, collision, facing, camera rotation/follow, optimistic physical position revisions, SQLite recovery, and refresh/restart continuity without Runtime movement traffic.

The West Woods route is currently only a projected/physical route affordance. It does not yet transfer the player.

## Bounded pre-TALK cleanup

Do these only where they affect correctness or the first playable scene:

- keep unlearned canonical names out of player narration/dialogue/history;
- change Crooked Checkpoint opening pressure so handheld capture cubes are never implied to physically shake a cart;
- reduce text-adventure funneling: orient the player, establish pressure, then return control to the embodied world;
- do not spend a separate milestone polishing the campaign-feed UI.

## TALK — interaction and context custody — ACTIVE

### GameFrame acceptance

The player can physically approach a viewer-authorized entity, acquire it as a valid nearby interaction target, and choose a contextual action. The interaction system must be generic enough for Pell, the cart, later exits, and future interactables.

Minimum controls:

- desktop/mouse/keyboard interaction;
- touch-friendly Interact on mobile;
- Talk for a conversational entity;
- Do Something Else for unsupported in-fiction intent;
- Ask Game Master as a distinct out-of-fiction surface.

### Runtime acceptance

Pell is the first entity-performance canary:

```text
referee knows hidden X
Pell does not know X
→ Pell context does not contain X
→ Pell cannot use X

Pell legitimately learns X
→ Observer Knowledge commits X
→ Pell may use X later
```

### Speech/audience semantics

Do not make all dialogue global merely because one client renders it.

- normal speech has a defined hearing/audience scope;
- a whisper can intentionally restrict that scope;
- Ask-GM is player-private by default and is not fictional speech;
- speaker/origin and audience are separate fields;
- presentation style does not own truth.

The first UI may be simple. Later the same authorized speech event may render as an in-world bubble/subtitle and as a campaign-history entry.

## CHANGE — controls and arbitrary intent reach the same world

This milestone proves that the graphics do not limit tabletop agency.

For common supported actions, GameFrame should expose direct controls. For unsupported/plausible actions, **Do Something Else** remains first-class.

Example acceptance:

```text
player types: "I pull out Cinder's cube and release her beside me."
→ Dungeon Master interprets deploy intent
→ deterministic ownership/deployment rules validate it
→ semantic + GameFrame physical state commit
→ Cinder appears in the current scene
→ narration/history describes the accepted result
→ refresh preserves Cinder's deployed state
```

The text itself never directly creates the state.

Promote only concrete operations the chapter needs: deploy/recall, inspect/use/take/open/change important objects, knowledge reveal/correction, checks, objective/event state, and meaningful relationship/memory consequences.

## TRAVEL — make West Woods real

```text
Crooked Checkpoint route/transition affordance
→ validate current available semantic exit
→ authoritative semantic scene transfer
→ materialize scene.west-woods
→ establish valid physical arrival state
→ explore
→ return
→ same Crooked Checkpoint materialization/state
```

Do not infer travel solely from client coordinates. Physical arrival at an exit enables the command; semantic transfer is a durable authoritative operation.

## FIGHT — same-map tactical authority

Promote the Monster Master rules/control boundary required for the current scene to become tactical:

- Master/trainer participation;
- ruleset-authorized deployed monster set;
- initiative/action economy/legal actions;
- current positions as tactical starting positions;
- current geometry/objects/exits retained;
- structured non-elimination outcomes where supported;
- semantic reconciliation;
- same-map exploration resume.

No campaign Arena handoff or replacement battle map.

## PROVE

Complete the bounded chapter before adding broad architecture:

1. human playthrough with multiple plausible actions;
2. restart/reconnect;
3. deterministic/machine-play;
4. live-provider proof;
5. deployed staging proof.

Only after that: two-human one-scene, second handcrafted Game Family, Campaign Architect, dynamic Battle Packs/Battle Simulator, split-party later.

## Campaign history / feed posture

The campaign feed is expected to evolve into an observer-authorized **campaign chronicle**, not a tiny combat log and not the permanent primary controller.

It should eventually retain meaningful:

- opening/scene narration;
- dialogue the observer actually heard or was party to;
- discoveries/knowledge reveals;
- consequential player actions;
- deterministic mechanic outcomes;
- world changes and scene transitions;
- GM interventions/rulings appropriate to that audience.

Different observers may legitimately have different histories. Nearby speech, whispers, private Ask-GM answers, and split-party scenes must respect audience/audibility rather than copying every line globally.

The architecture should preserve origin/audience/event semantics now so this presentation can be polished later without rewriting campaign truth.

## Development workflow

Each implementation PR begins with one concrete player acceptance statement. Inspect existing renderer, physical authority, semantic authority, and tests before inventing another subsystem.

Use the smallest trustworthy proof during iteration, then claim-appropriate gates before merge:

- GameFrame behavior → focused Node/browser + active-product browser acceptance;
- Runtime behavior → Fast Check;
- shared contract → shared drift/hygiene;
- cross-repo seam → current integration;
- persistence/recovery → durable recovery proof;
- context custody → deterministic hidden-fact/Observer-Knowledge canaries.

Docs should ride implementation when evidence changes. Separate docs-only PRs are appropriate for reconciliation/audits such as this one.

## Immediate order

1. **TALK — generic interaction targeting + Pell entity-performance + audience semantics.**
2. **CHANGE — real world mutations, including direct controls and freeform intent reaching the same authority.**
3. **TRAVEL — Crooked Checkpoint ↔ West Woods.**
4. **FIGHT — Monster Master control/rules + same-map Tactical Activation.**
5. **PROVE — complete single-player chapter/restart/provider/staging.**
6. two-human one-scene.
7. second handcrafted Game Family.
8. Campaign Architect + dynamic Role-Playing Games/Battle Packs.
9. dynamic Battle Simulator convergence.
10. split-party later.

## Governing rule

> Deliver the game by completing the next player action. Keep the world primary, keep freeform intent legal, require authoritative commits before narration claims consequences, and defer campaign-history presentation polish until ordinary play can be performed directly in the world.
