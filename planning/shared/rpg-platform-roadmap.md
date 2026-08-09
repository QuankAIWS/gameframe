---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
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
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 10
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-roadmap.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-roadmap.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Roadmap

## Objective

Build one campaign-agnostic GameFrame RPG Engine that turns validated CampaignPackages into persistent playable 2D worlds, accepts pluggable deterministic RPG Rulesets, and works with one Dungeon Master that remains a real referee/narrator while durable software owns identity, presence, Observer Knowledge, world state, mechanics, and recovery.

The player-facing hierarchy is **Games → Role-Playing Games / Battle Simulator / standalone games**. GameFrame RPG Engine is internal architecture.

Campaign combat happens through **Tactical Activation on the current materialized campaign scene**. It never launches Battle Simulator or compiles a substitute campaign battlefield.

## Authority

- GameFrame owns physical materialization, x/y/facing, collision/pathing/camera/picking/interaction range, deterministic rules/control/tactical state, and player-facing rendering.
- RPG GM Runtime owns CampaignPackages, WorldGraph/semantic scene/entity/objective truth, Observer Knowledge, Dungeon Master contexts/semantic decisions, and meaningful semantic consequences.
- **HTTP owns GameFrame RPG commands/mutations, including exploration movement and interaction.**
- **WebSockets are projection/notification-only and reconstructable from durable state.**
- Text/narration never becomes authoritative state merely because a model emitted it.

## Delivery mode

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

Primary progress is measured by a continuous player journey. The physical world is the primary product surface; Campaign Chronicle/feed presentation remains important but is not the active milestone while direct world interaction is incomplete.

## Completed foundations

Preserve the accepted substrate:

- CampaignPackage v5 and explicit Game Family/ruleset capability requirements;
- Entity Registry and Character Factory;
- Semantic Scene Registry with durable membership authority;
- Observer Knowledge / People;
- WorldGraph/location/materialization intent;
- viewer-safe Runtime → GameFrame exploration projection;
- private authenticated exploration ingress;
- deterministic Crooked Checkpoint Pixi materialization;
- GameFrame-owned durable x/y/facing position state;
- authenticated HTTP movement/collision/revision/recovery;
- desktop WASD/camera and mobile touch movement controls;
- Cloudflare/VM staging path and reset/reseed tooling;
- player-safe initial Crooked Checkpoint identity disclosure;
- physically authorized actor Talk with viewer-safe browser targets;
- Dungeon Master entity-performance context with Pell hidden-truth custody canary;
- durable Talk retry/recovery across uncertain delivery.

## Milestones 0–4 — complete bounded foundation

Architecture/navigation, CampaignPackage/ruleset boundary, Entity/Scene/Observer substrate, SEE, MOVE, and mobile are complete at the bounded Crooked Checkpoint level.

The West Woods route remains a projected/visible route mouth, not a completed scene transfer.

## Milestone 5 — TALK: physical interaction + character performance — COMPLETE

Merged Runtime #112 and GameFrame #200 establish the first production-shaped conversation path.

### GameFrame proof

- current materialization/position determines eligible Talk targets;
- only viewer-safe `interactionTargetId` crosses the browser boundary;
- first slice accepts supported actor targets only;
- multiple adjacent actors require explicit viewer-safe selection;
- canonical semantic target identity is resolved server-side only after current adjacency/materialization checks;
- generic command ingress cannot manufacture typed Talk authority;
- Talk is an authenticated HTTP mutation; WebSockets remain projection-only;
- exact committed retries resolve from durable ingress custody before another physical reauthorization;
- mobile controls and the shared composer preserve exact retry identity across rerenders.

### Runtime proof

- typed Talk becomes an `entity-interaction` semantic trigger;
- the Dungeon Master performs Pell in **entity-performance** mode rather than spawning another agent;
- performer context contains the actor's own authored interior state, recent explicit Observer Knowledge, public current-location material, and viewer-safe known people;
- hidden global plot/referee truth, unrelated actors' secrets, and hidden location facts are structurally absent;
- a referee-only sentinel remains available to referee context and absent from Pell context;
- entity-performance is dialogue-only in this first slice: no mechanic, semantic state change, transition, or Tactical Activation may be authored by the response;
- explicit encounter/system/non-TALK triggers retain their normal planner authority;
- bounded Observer Knowledge prioritizes the most recently revised records.

### Deliberately deferred speech scope

The first TALK slice fails closed to **initiating-player-private** presentation. It does not claim final multiplayer speech semantics.

Later work may add:

- true nearby audibility/overhearing;
- whispers/private fictional speech;
- split-party speech propagation;
- speech bubbles/subtitles plus Campaign Chronicle fan-out;
- entity-performance support for intelligent roster monsters and other non-actor classes.

Physical presence, audibility, audience, Observer Knowledge, and presentation remain separate authorities.

## Milestone 6 — CHANGE: persistent world state + freeform parity — ACTIVE

This milestone proves that graphics do not limit tabletop agency and that natural-language intent cannot bypass deterministic/semantic authority.

### Primary acceptance

```text
Cinder is recalled
→ player chooses Deploy directly
  OR says/types: "I pull out Cinder's cube and release her beside me."
→ both paths resolve to the same authoritative deploy operation
→ validate ownership + ruleset/profile deployment constraints
→ commit semantic deployment/presence
→ GameFrame chooses legal physical placement/control state
→ Cinder appears in the current scene
→ narration/history reports the committed result
→ refresh/restart preserves deployment
```

Required properties:

- direct controls and **Do Something Else** converge on the same underlying operation;
- freeform text expresses an attempted action, never a direct state write;
- failed/illegal intent remains uncommitted regardless of model prose;
- retries are idempotent/recoverable;
- ruleset/profile authority defines player-character → controlled/deployed monster relationships rather than generic engine assumptions;
- semantic truth commits before presentation claims the consequence;
- GameFrame physical placement never becomes a second semantic deployment database.

After deploy/recall, promote only concrete operations required by play: inspect/use/open/take/change important objects, knowledge reveal/correction, deterministic checks, objective/event changes, relationships/memory.

**Exit gate:** at least one meaningful world change can be caused through ordinary direct control and equivalent freeform intent, survives recovery, and is reflected consistently in semantic + physical projections.

## Milestone 7 — TRAVEL: Crooked Checkpoint ↔ West Woods

Turn current WorldGraph/exit/route-mouth evidence into real travel:

- physical route interaction/transition eligibility;
- validate current available semantic exit;
- commit source→destination semantic scene transfer;
- materialize/recover `scene.west-woods`;
- establish valid physical arrival state;
- return to the same Crooked Checkpoint materialization/state.

**Exit gate:** West Woods is a real persistent place the player can visit and revisit without world/materialization drift.

## Milestones 8–9 — FIGHT: rules/control + same-map Tactical Activation

Promote only same-map campaign combat requirements: Monster Master ruleset/profile/version, principal → Master/player-character → deployed/controlled set, deployment limits, Master participation, initiative/action economy/legal actions, current positions/geometry, resources/conditions/objectives, non-elimination exits, semantic reconciliation, and same-map exploration resume.

```text
exploration
→ tactical trigger
→ validate semantic/materialized/ruleset/control state
→ Tactical Activation
→ current positions become tactical starting positions
→ deterministic turn-based actions on current geometry
→ deterministic result
→ semantic reconciliation
→ exploration resumes in place
```

No replacement battlefield or Return-to-Campaign step.

## Milestone 10 — PROVE

Complete the bounded single-player journey:

```text
Role-Playing Games
→ Monster Master RPG
→ SEE / MOVE / MOBILE
→ TALK
→ persistent CHANGE
→ West Woods TRAVEL/revisit
→ event/check consequence
→ same-map FIGHT
→ exploration resume
→ bounded campaign resolution
→ restart/reconnect
```

Validation order: human play → deterministic/machine-play → live provider → deployed staging.

## Campaign Chronicle direction

The existing campaign feed should mature into an observer-authorized **Campaign Chronicle** containing meaningful narration, authorized/heard dialogue, discoveries, consequential actions, mechanics, world changes, travel, and relevant GM interventions. It should be neither a tiny combat log nor the permanent primary control surface.

One semantic event may have multiple authorized presentations. Different observers may legitimately have different Chronicle content.

Do not make Chronicle UI polish a blocker for CHANGE/TRAVEL/FIGHT. Preserve correct origin/audience/audibility/knowledge semantics now.

## Immediate order

1. **CHANGE — deploy/recall parity between direct control and freeform intent.**
2. **TRAVEL — Crooked Checkpoint ↔ West Woods.**
3. **FIGHT — Monster Master control/rules + same-map Tactical Activation.**
4. **PROVE — complete single-player chapter/restart/provider/staging.**
5. richer local audibility/whispers + two-human one-scene.
6. second handcrafted Game Family.
7. Campaign Architect + dynamic Role-Playing Games/Battle Packs.
8. dynamic Battle Simulator convergence.
9. split-party later.

## Governing rule

> Deliver the game by completing the next player action. Keep the world primary, keep arbitrary intent legal through validated adjudication, require authoritative commits before narration claims consequences, and let real play determine which abstractions deserve to exist.
