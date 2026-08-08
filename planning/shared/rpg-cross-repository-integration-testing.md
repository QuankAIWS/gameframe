---
title: RPG Cross-Repository and Agent-System Testing
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - GitHub Actions
  - campaign agent validation
  - VM staging validation
  - later Cloudflare and media validation
shared_document_id: rpg-cross-repository-integration-testing-v1
shared_document_version: 7
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
  - rpg-campaign-architect-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Cross-Repository and Agent-System Testing

## Decision

The RPG platform uses separate evidence layers for package structure, durable semantic world state, GameFrame exploration materialization, Dungeon Master referee/character-performance behavior, shared contract conformance, actual integration, persistence/restart, complete embodied campaign behavior, browser experience, deployment, Campaign Architect behavior, and optional media/cloud migration.

Each layer claims only what it executes.

A catalog-shape test does not prove an executable CampaignPackage. A model/provider stub does not prove Dungeon Master quality. A movement demo does not prove semantic scene continuity. A transport round trip does not prove a campaign. A browser return link does not prove Arena aftermath or embodied exploration resume. A one-scene party does not prove split-party/multi-map correctness.

Campaign Architect generation remains deferred until two materially different handcrafted worlds prove the common runtime/GameFrame abstraction.

## Ownership

RPG GM Runtime owns:

- CampaignPackage tests;
- semantic world/entity/scene/observer-knowledge tests;
- Character Factory tests;
- Dungeon Master referee and entity-performance machine-play tests;
- future Campaign Architect tests;
- mock GameFrame ports;
- checkout/execution of public GameFrame for private cross-repository integration;
- durable runtime/two-service integration;
- shared-document drift verification.

GameFrame owns:

- GameFrame unit/service/contract/browser/visual/Worker/encounter tests;
- exploration materialization/movement/reconnect tests;
- shared fixture validation;
- player-safe projections;
- direct NPC interaction/Ask-GM/Do-Something-Else browser behavior;
- deterministic stub-runtime behavior;
- public repository runner/secret-safety policy.

## Testing ladder

### Layer 1 — CampaignPackage schema/persistence

Prove:

- package bounds/reference integrity;
- player-safe/runtime-only separation;
- package validation/hash/provenance/commitment/reload/migration posture;
- handcrafted origin metadata;
- semantic WorldGraph/location/materialization requirements;
- initial entity/scene/knowledge bootstrap material;
- exact retry/restart.

Required fixtures include handcrafted Monster Master plus malformed/contradictory packages, world-graph inconsistencies, unsupported materialization requirements, and secret-projection attacks.

### Layer 2 — Entity, Scene, Character Factory, and Observer Knowledge

Prove deterministically:

- package actors/roster entities normalize to stable identities;
- one incidental request materializes exactly one stable entity;
- immediate materialization + scene admission + justified initial awareness commit atomically/idempotently;
- conflicting request-ID reuse fails;
- semantic physical scene membership survives restart;
- absent entities cannot physically act without explicit remote authority;
- observer-specific descriptor/role/name/fact progression updates the same entity;
- unknown entity existence remains omitted;
- NPC observer knowledge may differ from player knowledge;
- semantic facts retain provenance/correction/belief state.

### Layer 3 — GameFrame exploration/materialization unit behavior

Prove:

- one semantic scene becomes an accepted materialization with stable ID/version;
- collision/picking/transition anchors are deterministic/recoverable;
- player movement changes ephemeral transform state without advancing runtime narrative revision per frame;
- scene/session reconnect restores a valid authoritative materialization/avatar position policy;
- semantic object/entity anchors survive refresh;
- generated source art cannot redefine collision or semantic identity;
- revisiting an accepted materialization does not silently regenerate a different replacement.

This layer proves GameFrame exploration substrate, not Dungeon Master campaign behavior.

### Layer 4 — Dungeon Master context-mode machine-play

Use deterministic/mock providers and scripted players against committed packages.

Prove across multiple interactions:

- package truth never changes improperly;
- referee mode can interpret unexpected freeform intent;
- **Do Something Else** remains available outside fixed controls;
- Ask-GM remains distinct/out-of-fiction;
- entity-performance mode is bound to one target entity;
- a hidden fact present in referee context is absent from Pell/entity context when Pell does not know it;
- NPC memories/relationships persist through typed semantic state rather than transcript alone;
- only eligible events are selected;
- exact retry does not re-decide semantic truth;
- restart/resume preserves continuity.

### Layer 5 — Runtime mock GameFrame port

Use a deterministic fake GameFrame connector for fast runtime development.

Cover:

- authenticated attachment;
- semantic scene/world projection;
- accepted materialization references;
- direct entity interaction;
- Do Something Else;
- Ask-GM;
- GM intervention presentation;
- People/current-scene projections;
- checks;
- scene-transfer proposals/results;
- encounter proposals;
- retry/conflict/stale revisions;
- malformed/unavailable responses;
- structured tactical outcomes.

This proves runtime behavior against contract, not actual GameFrame implementation.

### Layer 6 — Shared contract fixtures

Both repositories consume canonical versioned fixtures for jointly implemented features.

Expand fixtures to cover at least:

- semantic current-scene projection;
- materialization reference;
- Known People descriptor→role→name;
- observer/entity knowledge example;
- direct entity interaction;
- Do Something Else;
- Ask-GM;
- GM intervention origin/intensity/audience;
- scene transfer/route identity;
- encounter source scene/revision/digest;
- encounter roles/objectives;
- escape/withdrawal outcomes.

Neither repository imports the other's private implementation.

### Layer 7 — Actual GameFrame Node integration

A runtime-owned job checks out the real public GameFrame repository, records exact SHA, installs pinned dependencies, starts the real local service, and runs focused integration.

Prove actual serialization/validation, command custody, runtime linkage, viewer projections, semantic scene/materialization handshake, direct interaction, scene transfer, real Arena launch/outcome, embodied campaign return, and current GameFrame compatibility.

### Layer 8 — Durable local two-service integration

Run both services with production-shaped separate persistence.

Cover:

- separate databases/migrations;
- authenticated private service calls;
- package/journal/command/outcome persistence;
- materialization identity references without cross-database access;
- restart/lost-response recovery;
- no duplicate scene transfer/NPC/aftermath;
- backup/restore;
- encounter lifecycle through authoritative world/scene reconciliation.

### Layer 9 — Complete single-player embodied Monster Master proof

Required journey:

```text
validated handcrafted Monster Master package
→ package commitment
→ semantic world/entity/scene/observer-knowledge initialization
→ authenticated player attachment
→ Crooked Checkpoint materialization
→ movement through GameFrame scene
→ direct Pell interaction
→ prove Pell context lacks one hidden fact
→ Ask-GM with no fictional speech side effect
→ inspect/interact with one world object
→ Do Something Else unsupported plausible action
→ alternate route / second connected scene materialization
→ revisit prior scene without materialization drift
→ clue/event/check progression
→ real scene-derived Arena request
→ actual tactical match
→ exact structured terminal outcome
→ runtime world/scene reconciliation
→ updated exploration materialization
→ movement/interaction authoritatively resume
→ bounded campaign resolution
→ both services restart
→ player resumes without duplication/leakage/package or map drift
```

The journey must use configured production composition and actual GameFrame authority. It must not fabricate terminal encounter events, use in-memory completion shortcuts, or accept URL navigation as proof of return.

### Layer 10 — Two-human one-scene embodied acceptance

After single-player architecture is proven, prove:

- campaign join/party lifecycle;
- separate authenticated avatars;
- scene-scoped realtime movement projection;
- one shared active semantic/materialized scene;
- viewer-divergent knowledge where applicable;
- public/party/player-private GM presentation;
- explicit party-cohesion transition to another scene;
- cooperative tactical control;
- reconnect/restart for both players without duplicate presence.

This does **not** prove split-party/multi-map behavior.

### Layer 11 — Second handcrafted world generality proof

A materially different second handcrafted package must run through the same validator, WorldGraph, Entity Registry, Scene Registry, Observer Knowledge, GameFrame exploration/materialization, Dungeon Master context modes, and tactical handoff where relevant.

If it needs a campaign-specific control plane, repair the abstraction before Campaign Architect implementation.

### Layer 12 — Browser embodied campaign acceptance

Use real browser journeys for:

- package preview/confirmation;
- exploration movement/camera/interactions;
- direct NPC dialogue;
- Ask-GM and GM communication history;
- Do Something Else;
- GM dramatic intervention/freeze/unfreeze;
- People/current-scene/entity inspection;
- connected scene transition/revisit;
- Arena transition and authoritative embodied return;
- desktop/mobile interaction;
- reconnect and text/fallback mode.

Screenshots support presentation evidence but do not replace state assertions.

### Layer 13 — VM, Cloudflare edge, Discord, and realtime canary

Staging proves:

- production topology;
- Cloudflare routing to GameFrame only;
- real authentication;
- public-network play without VPN;
- VM-backed exploration WebSocket/session behavior;
- movement without per-frame durable campaign writes;
- reconnect/recovery;
- private projection enforcement;
- actual campaign/Arena return;
- backup/restore;
- stopping tunnel removes public reachability.

Repository tests cannot claim this evidence.

### Layer 14 — Campaign Architect behavior

Only after complete Monster Master and second handcrafted world prove the common abstraction, add deterministic/mock Campaign Architect tests for brief normalization, assumptions/repair, originality transformation, semantic world construction, package completeness, materialization capability compatibility, validation repair, reproducibility where required, and owner-refinable draft lifecycle.

Then run a generated-package full journey through the same world/entity/scene/knowledge/Dungeon-Master/GameFrame harness.

### Layer 15 — Split-party / multi-scene integration

Productize and prove simultaneous separated scenes only after one-scene multiplayer is stable.

Required cases:

- two subgroups in distinct semantic/materialized scenes;
- independent realtime subscriptions;
- scene-scoped entity/event projections;
- divergent knowledge acquisition;
- explicit cross-scene communication rules;
- concurrent Dungeon Master turns without state corruption;
- one subgroup in tactical mode while another remains exploratory;
- independent reconnect/recovery;
- reunion/scene transfer without duplicate presence or chronology errors.

### Layer 16 — Media and optional Cloudflare-native validation

Media canaries prove catalog reuse, deterministic composition, queued generation, validation/moderation/provenance, placeholders, recurring identity continuity, world-kit consistency, budgets, caching, and failure behavior.

Cloudflare-native state tests are required only for an active migration.

## Coordinated branch policy

During active co-development:

1. update canonical GameFrame shared documents/fixtures;
2. run focused GameFrame checks;
3. test runtime branch against trusted GameFrame branch;
4. merge GameFrame canonical changes;
5. synchronize exact-byte runtime mirrors;
6. rerun runtime checks against GameFrame `main`;
7. merge runtime changes.

Private runtime workflows must not execute arbitrary fork/public PR code alongside private source/secrets.

## Trigger policy

Ordinary runtime PRs run focused runtime tests, shared fixture validation, shared-document drift, and affected current-GameFrame integration.

World/entity/scene/knowledge/Character Factory/Dungeon Master/tactical changes run relevant machine-play. Exploration/materialization changes run focused GameFrame/browser journeys. Persistence/deployment changes run durable integration. VM/provider claims require explicit canaries.

## Diagnostics

Preserve bounded evidence including:

- exact GameFrame/runtime SHAs;
- package/schema/contract versions;
- package hash/provenance;
- materialization ID/version/recipe/seed identity where relevant;
- semantic scene ID/revision;
- scripted player profile/turn at failure;
- stable error codes/revisions;
- retry/restart/outcome/backup receipts;
- browser traces only for browser journeys.

Do not place runtime-only package truth or credentials in ordinary artifacts.

## Acceptance criteria

The testing system is established when:

1. Monster Master and a materially different second handcrafted world pass the same validator and durable-world/exploration substrate;
2. Dungeon Master machine-play proves referee and perspective-bounded character-performance behavior;
3. secret/name/NPC-omniscience/plot-drift/continuity/Ask-GM/Do-Something-Else/retry/restart cases pass;
4. both repositories validate the same versioned shared fixtures;
5. actual GameFrame integration exercises real exploration/materialization routes and Arena Battles;
6. durable integration survives restarts/backup/restore;
7. one-human full-stack campaign proves authoritative embodied return without fabricated tactical outcomes;
8. browser tests prove world interaction and GM/entity distinctions;
9. two-human one-scene evidence is added separately;
10. Campaign Architect is implemented only after the two handcrafted worlds prove common abstraction;
11. split-party/multi-scene evidence remains a separate later layer;
12. VM canaries prove public routing/private-origin/realtime posture;
13. no player journey depends on Tailscale/router forwarding.

## Governing rule

> Prove the campaign as a world the player can inhabit: package truth, semantic world/entity/scene/knowledge, stable materialization, perspective-bounded characters, real GameFrame mechanics, authoritative Arena return, and only then broader generation or multi-scene complexity.
