---
title: RPG Cross-Repository and Agent-System Testing
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GitHub Actions
  - campaign agent validation
  - VM staging validation
shared_document_id: rpg-cross-repository-integration-testing-v1
shared_document_version: 9
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-cross-repository-integration-testing.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-cross-repository-integration-testing.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-platform-roadmap.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Cross-Repository and Agent-System Testing

## Decision

Evidence layers must claim only what they execute. A transport round trip does not prove a campaign; a transcript does not prove embodied world continuity; standalone Arena Battles does not prove same-map campaign Tactical Activation; a screenshot does not prove state correctness.

Campaign Architect generation remains deferred until two materially different handcrafted Game Families prove the common engine/runtime/ruleset architecture.

## Current authority invariant

- GameFrame owns physical materialization, movement, interaction range, deterministic mechanics/control/tactical state.
- Runtime owns semantic campaign/entity/scene/Observer Knowledge truth and Dungeon Master context/semantic consequences.
- **HTTP owns all RPG commands/mutations, including exploration movement.**
- **WebSockets are projection/notification-only.**
- freeform/model prose is not authoritative state.

## Current player-journey evidence

```text
SEE      ✅ deployed proof
MOVE     ✅ deployed proof
MOBILE   ✅ deployed proof
TALK     ← active next proof
CHANGE
TRAVEL
FIGHT
PROVE
```

## Layer 1 — CampaignPackage / ruleset / WorldGraph

Prove schema bounds/reference integrity, player-safe/runtime-only separation, hash/provenance/commit/reload/migration, WorldGraph semantics, initial entity/scene/Observer Knowledge bootstrap, explicit ruleset/profile requirements, materialization intents, and exact retry/restart.

## Layer 2 — Entity / Scene / Observer Knowledge

Prove stable IDs, Character Factory idempotency, scene membership/transfer reconstruction, observer divergence, descriptor→role→name progression, hidden-name omission, knowledge provenance/correction, and no physical action by absent entities without explicit remote semantics.

## Layer 3 — GameFrame materialization

Prove stable materialization identity/version/hash, deterministic playable geometry, collision/navigation/semantic anchors, required landmarks/objects/routes, generated-pixels-not-authority, and stable revisit/recovery.

Crooked Checkpoint SEE is complete bounded evidence.

## Layer 4 — GameFrame physical movement

Prove:

- authenticated HTTP `/exploration/move` is the sole movement mutation path;
- walls/bounds/visible entity/object occupancy block movement correctly;
- stale physical position revisions fail closed;
- x/y/facing persist in GameFrame authority;
- exact-materialization restart/reconnect recovers valid position;
- camera-relative desktop/mobile controls reconcile accepted state;
- WebSocket movement mutation frames are rejected;
- no per-step Runtime journal/provider traffic occurs.

MOVE + mobile are complete bounded evidence.

## Layer 5 — TALK / Dungeon Master context custody

Use deterministic/mock providers and real semantic state.

Prove:

- GameFrame physical target/range and Runtime semantic target/presence agree;
- referee context may contain hidden fact X;
- Pell entity-performance context excludes X until Pell legitimately learns it;
- Pell output cannot use unauthorized hidden truth;
- Observer Knowledge promotion makes later authorized knowledge available;
- Ask-GM receives player-authorized context and remains out-of-fiction;
- Talk, Ask-GM, and Do Something Else are distinct triggers/origins.

## Layer 6 — Speech audience / audibility / history

Prove independently:

- normal speech reaches only observers authorized/hearing it;
- whisper/private speech can restrict audience;
- Ask-GM is player-private by default and creates no NPC knowledge;
- one semantic dialogue event can render in-world and in campaign history without duplicate semantic truth/effects;
- canonical names never appear in narration/dialogue/history before that observer's identity knowledge authorizes them;
- two observers can legitimately receive different chronicle content.

## Layer 7 — CHANGE / freeform parity

Prove a common world operation through both direct control and freeform intent.

Reference acceptance:

```text
Cinder recalled
→ player uses deploy control OR writes "I release Cinder"
→ same ownership/rules/current-state validation
→ accepted semantic + physical deployment
→ Cinder appears
→ campaign chronicle presents accepted result
→ restart preserves deployed state
```

Also prove declarative text cannot bypass locks, inventory, collision, control authority, identity, or deterministic outcomes.

## Layer 8 — TRAVEL / connected scenes

Prove Crooked Checkpoint → West Woods → Crooked Checkpoint:

- physical route/transition eligibility;
- matching current available semantic exit;
- authoritative scene transfer;
- destination materialization/arrival;
- stable return/revisit;
- object/entity/Observer Knowledge continuity;
- stale/unauthorized transfer rejection.

## Layer 9 — Shared fixtures

Add versioned public fixtures only when a joint seam exists. Useful fixtures include:

- semantic scene/materialization linkage;
- observer-safe descriptor→role→name;
- Talk/Interact;
- speech audience/audibility;
- Do Something Else;
- Ask-GM;
- world-operation results;
- scene transfer;
- ruleset/control relationships;
- Tactical Activation snapshot/outcome;
- same-scene tactical→exploration resume.

Public fixtures never contain private package secrets.

## Layer 10 — Actual GameFrame Node integration

Runtime-owned integration checks out the exact intended GameFrame revision and exercises real serialization/validation at the seam. Do not fabricate later-stage results merely to make integration green.

## Layer 11 — Durable two-service recovery

Use separate production-shaped persistence and prove authenticated private service calls, separate DBs, restart/lost-response recovery, no cross-service DB access, exactly-once semantic consequence handling, and correct state reconstruction.

## Layer 12 — FIGHT / same-map tactical proof

Prove:

- current semantic scene/materialization/positions/control state validate Tactical Activation;
- current positions/geometry become tactical starting state;
- deterministic legal actions run on the same map;
- alternate terminal outcomes work where supported;
- GameFrame commits tactical result exactly once;
- Runtime reconciles required semantic consequences;
- same scene resumes exploration;
- reconnect/restart preserves the result.

No replacement campaign battlefield or Return-to-Campaign navigation is allowed.

## Layer 13 — Complete single-player Monster Master

```text
package/world initialization
→ Crooked Checkpoint SEE/MOVE
→ Pell TALK
→ Ask-GM / Do Something Else
→ observer-safe knowledge/history
→ persistent CHANGE
→ West Woods TRAVEL/revisit
→ event/check consequence
→ same-map FIGHT
→ exploration resume
→ bounded campaign resolution
→ both services/browser restart
→ same persistent world
```

Proof order: human play → deterministic/machine-play → live provider → deployed staging.

## Layer 14 — Browser acceptance

Browser journeys should prove direct player behavior, including desktop/mobile controls, interaction targeting, NPC conversation, Ask-GM/freeform separation, history/audience rendering, world changes, scene transfer, tactical transition, and reconnect.

Screenshots support visual claims only.

## Layer 15 — Two-human one-scene

After single-player proof, test separate principals/avatars, shared scene movement, viewer-divergent Observer Knowledge, normal speech/whispers/private GM communication, party-cohesion transitions, cooperative tactical control, and reconnect.

This does not prove split-party multi-scene play.

## Layer 16 — Second handcrafted Game Family

A materially different campaign/family must use the same GameFrame RPG Engine, package/entity/scene/Observer architecture, context modes, materialization framework, ruleset interface, and Tactical Activation where relevant. Campaign-specific engine/DM branches fail this gate.

## Layer 17 — Battle Simulator equivalence

Monster Master Arena Battles has its own standalone setup/UX evidence. Matching Monster Master Ruleset versions/profiles should produce equivalent tactical semantics without sharing campaign lifecycle.

## Layer 18 — Campaign Architect

Only after handcrafted generality, test brief normalization, originality/repair, package completeness, WorldGraph, ruleset compatibility, reproducibility/provenance, owner refinement, and full generated-campaign journey through the same engine/runtime.

## Layer 19 — VM/Cloudflare staging

Prove exact paired GameFrame/Runtime revisions, public GameFrame/private origins, authenticated HTTP mutation routes, projection WebSocket behavior, tunnel/service restart recovery, reset/reseed, embodied world attach/movement, and later TALK/TRAVEL/FIGHT canaries as those features land.

No player journey requires Tailscale/router forwarding.

## Coordinated shared-document order

1. update canonical GameFrame shared docs/fixtures;
2. validate/merge GameFrame canonical change;
3. synchronize exact Runtime mirrors;
4. run Runtime shared drift/hygiene and relevant integration;
5. merge Runtime mirrors/local status.

Private Runtime workflows must never execute untrusted public fork/PR code with private source/secrets.

## Diagnostics

Preserve bounded evidence: exact SHAs, package/ruleset versions, materialization/scene/entity IDs, observer context at failure, command/revision/idempotency receipts, and browser traces only where useful. Never place runtime-only campaign secrets or credentials into ordinary artifacts.

## Governing rule

> Prove what the player actually experiences and what authority actually commits: one durable materialized world, perspective-correct characters, observer-scoped communication/history, deterministic rules, and same-map tactical play—without letting transport, prose, or screenshots stand in for state correctness.
