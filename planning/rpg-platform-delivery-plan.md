---
title: RPG Platform Delivery Plan
status: active
document_type: repository-plan
owner: Scribbles GameFrame
last_updated: 2026-08-18
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime-integration
depends_on:
  - shared/rpg-platform-product-goals.md
  - shared/rpg-agent-architecture-and-campaign-package.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-living-world-and-resolution-contract.md
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

The shared roadmap and living-world contract control cross-repository implementation order. This file defines the current GameFrame side of that work.

Campaign combat never launches Battle Simulator. HTTP owns RPG commands/mutations; campaign WebSockets remain projection/notification-only.

## Product posture

The physical world is the primary product surface. Direct controls are convenience, not the player's complete vocabulary. The target is a rendered videogame that retains free-form tabletop-scale agency, not a transcript-first adventure with a map attached.

GameFrame should execute directly whatever a normal videogame system can execute correctly. Missing bespoke presentation should degrade to generic embodied representation and readable text/UI rather than automatically make a plausible action unavailable.

## Preserved GameFrame foundation

Keep/reuse the current physical and integration substrate:

- Pixi campaign scene materialization;
- desktop/mobile movement, collision, camera, facing, and durable physical recovery;
- authenticated player/session authority;
- HTTP mutation boundary;
- viewer-safe Runtime exploration projection;
- physical interaction targeting/adjacency;
- deterministic control/rules/tactical primitives;
- durable command ingress/retry/publication;
- scene/object/route materialization bindings;
- observer-safe presentation guards;
- same-map tactical direction.

Do not replace working physical systems merely to match new terminology.

## G1 — Attempted Operation integration — ACTIVE

GameFrame needs a clean way to express/consume the shared `AttemptedOperation` boundary without surrendering physical/rules authority.

### Player direct controls

Existing direct controls should progressively map to typed attempted operations with stable provenance rather than each becoming a permanent bespoke cross-repository protocol.

### Freeform parity

When Runtime interprets a player's freeform request as the same underlying capability, direct control and freeform must converge on the same validation/resolution path.

### NPC/system operations

An actor-origin or scheduled attempted operation does **not** bypass GameFrame physical authority. If an NPC intends to approach, flee, inspect, use an object, or otherwise perform a physical action, GameFrame still validates/executes the physical portion using current materialization, pathing, collision, range, and deterministic mechanics.

### First integration proof

Use two materially different existing capabilities—prefer actor inspection plus travel/object control—to prove the shared operation envelope can cross or be reconstructed at the seam while preserving current retry/recovery.

## G2 — video-game-first Rules / Resolution integration

GameFrame should answer first:

> Can the actual videogame mechanic resolve this action directly?

If yes, use that mechanic instead of an abstract check.

If not, Runtime/Ruleset may request bounded abstract resolution using verified GameFrame/semantic facts. The active RPG Ruleset maps validated difficulty/circumstance concepts to mechanics. The model does not supply arbitrary final numbers or outcomes.

GameFrame should expose the narrow deterministic capability/state needed by the shared rules resolution rather than export raw renderer internals or hidden data.

## G3 — actor physical execution

Living NPCs need the same physical world to matter for them that matters for players.

GameFrame should support bounded server-authorized actor operations such as:

- approach/follow/flee/path to semantic target;
- interact with supported object/entity;
- use existing videogame mechanic;
- enter tactical authority when required.

These operations need stable actor/scene/materialization identity, legal path/range checks, recovery, and no browser ability to forge hidden actors.

Do not create one custom endpoint per NPC personality.

## G4 — bounded scene/world reaction presentation

Runtime may resolve several semantic reactions before returning control. GameFrame must be able to receive/apply the resulting committed physical operations/presentations in order without treating every intermediate line as a new player command.

Keep strict budgets and allow interruption/transition to tactical mode where the shared orchestrator requires it.

One semantic event may still fan out into world bubbles/subtitles and Campaign Chronicle without becoming multiple truths.

## G5 — scheduled/background consequence materialization

When Runtime reports a due off-screen consequence, GameFrame materializes only the physical state that belongs to its authority.

On revisit/reconnect, accepted materialization + Runtime semantic projection must agree on the changed world without replaying the event twice.

## G6 — Campaign Architect live expansion materialization

Campaign Architect expansion may introduce a new durable location, venue, organization/cast, or branch.

GameFrame receives only player-safe semantic materialization requirements and resolves them through:

```text
accepted prepared asset/world kit
→ deterministic composition/procedural materialization
→ bounded generated presentation asset
→ readable generic/text fallback
```

The Architect does not provide Pixi coordinates or collision meshes as truth. GameFrame creates/validates the physical realization and persists materialization identity for revisit.

First proof should be one meaningful expansion that did not exist as a sufficiently defined Crooked Checkpoint WorldGraph scene beforehand.

## G7 — same-map tactical + complete generalized proof

After the living-world foundation is working, prove the full single-player Monster Master path using the same current-world tactical model:

```text
embodied exploration
→ direct/freeform operation
→ actor intention/reaction
→ ruleset uncertainty
→ persistent consequence
→ travel/revisit
→ scheduled/off-screen change
→ Tactical Activation on current map
→ deterministic result
→ exploration resume
→ Architect-expanded location/revisit
→ restart/reconnect
```

## Compatibility posture for existing canaries

Current deploy/recall, actor inspection, cart/object, and travel paths are useful compatibility tests while the generalized seam lands.

Do not delete them before the shared operation path has equivalent authority/retry/recovery evidence. Do not add more exact-text or actor-pair special cases unless they are explicitly temporary canaries for a missing general primitive.

## Campaign Chronicle posture

Campaign Chronicle remains supporting observer-authorized history, not the primary controller. Preserve meaningful dialogue, discoveries, consequential actions, deterministic outcomes, world changes, travel, actor/world consequences, and appropriate GM interventions.

Do not log every movement step or internal orchestration transient.

## Immediate order

1. **Attempted Operation seam** — first GameFrame adapters/transport shape.
2. **Rules / Resolution seam** — direct videogame mechanic first, abstract rules only where needed.
3. **Actor physical execution** — generalized bounded actor operations.
4. **Scene reaction application** — ordered bounded multi-actor consequences.
5. **Scheduled consequence recovery.**
6. **Architect expansion materialization/revisit.**
7. **Same-map tactical + complete generalized single-player proof.**

## Governing rule

> GameFrame remains the actual videogame: it owns physical and deterministic reality, executes player and NPC operations through the same bounded world, and materializes continuity-safe campaign expansion without letting either model prose or missing bespoke animation define what the player is allowed to attempt.
