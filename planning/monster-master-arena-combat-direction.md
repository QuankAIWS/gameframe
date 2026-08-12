---
title: Monster Master Arena Combat Direction
status: owner-approved
document_type: design
authority: owner-approved decisions
owner: Scribbles GameFrame
last_updated: 2026-08-12
applies_to:
  - Monster Master: Arena Battles
related:
  - monster-master-rules.md
  - monster-master-rpg-lore-and-story.md
---

# Monster Master Arena Combat Direction

This document records the current standalone Monster Master Arena direction. It does not define or modify Monster Master RPG combat implementation. The RPG may later reuse lessons from Arena development, but Arena work must not create a runtime dependency on the RPG or require RPG code changes.

## Core fantasy

The player is an embodied human Monster Master fighting on the battlefield alongside called monsters. The Master is not an off-screen commander and should remain mechanically distinct from monster companions, consistent with the accepted Monster Master lore.

The default Arena team fields:

- one human Master;
- up to three deployed monsters.

For the first four-combatant prototype, the existing approved battlefield art supports the Warden Master, Stone Bulwark, and Emberling. Until a third monster species is deliberately designed and given approved art, the third monster slot uses a second Emberling. This is a prototype roster decision, not new species canon.

## Default victory condition — protect the Master

The standard Monster Master Arena round ends immediately when a Master is defeated. The opposing player wins even if one or more of the defeated Master's monsters remain on the battlefield.

This makes the Master a strategically decisive protected combatant. Positioning, bodyguard play, pressure on the opposing Master, healing, terrain, and future trainer archetypes should be evaluated against that objective.

A later alternate mode may use a different victory condition, including full-team elimination, but alternate modes must be explicit rather than weakening the default Monster Master identity.

## Rules-development posture

Arena is the combat-development laboratory for Monster Master. We should use it to learn what produces good fights: activation structure, movement, ranges, attacks, abilities, trainer roles, monster roles, terrain, status effects, battle duration, balance, AI behavior, and combat UX.

Those lessons are design knowledge. They do not imply that another GameFrame mode or the Monster Master RPG must call into the Arena application or share its runtime implementation.

## Compatibility boundary

The existing base `monster-master-duel` definition remains available for explicitly configured states used by existing infrastructure. Standalone newly created Arena matches opt into the Arena rules profile instead. This keeps Arena evolution isolated from configured campaign-facing encounter state while the Arena rules are still being developed.
