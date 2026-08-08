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
shared_document_version: 8
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

The RPG platform uses separate evidence layers for package/ruleset structure, durable semantic world state, GameFrame materialization/realtime behavior, Dungeon Master perspective custody, deterministic mechanics/tactical mode, complete campaigns, browser UX, deployment, Campaign Architect behavior, and optional media/cloud migration.

Each layer claims only what it actually executes.

A transport round trip does not prove a campaign. A text transcript does not prove embodied world continuity. A standalone Monster Master duel does not prove campaign Tactical Activation. A browser navigation back from a separate battle does not prove the mature same-map model because the mature model has no such navigation.

Campaign Architect generation remains deferred until two materially different handcrafted campaigns prove the common GameFrame RPG Engine/runtime/ruleset abstractions.

## Ownership

### RPG GM Runtime owns testing for

- CampaignPackage validation/persistence;
- Entity Registry/Character Factory;
- semantic Scene Registry/Observer Knowledge;
- WorldGraph/semantic scene transitions;
- Dungeon Master context modes/machine-play;
- perspective-custody/secret-leak tests;
- semantic Tactical Activation coordination;
- mock GameFrame ports;
- runtime-owned cross-repository integration jobs;
- shared-document drift verification.

### GameFrame owns testing for

- GameFrame RPG Engine materialization/geometry;
- realtime movement/session behavior;
- viewer-safe player UI;
- direct interaction/GM surfaces;
- RPG Ruleset capability validation;
- authenticated control authority;
- deterministic mechanics/tactical mode;
- Monster Master tactical rules/Battle Arena;
- browser/visual/Worker/VM-facing GameFrame behavior;
- shared fixture validation.

## Evidence ladder

### Layer 1 — CampaignPackage and ruleset capability schema

Prove:

- package bounds/reference integrity;
- player-safe/runtime-only separation;
- hash/provenance/commitment/reload/migration;
- WorldGraph/location semantics;
- initial entity/scene/observer-knowledge bootstrap;
- explicit ruleset/profile/version requirements;
- materialization intents/fallbacks;
- exact retry/restart.

### Layer 2 — Entity, Scene, Character Factory, and Observer Knowledge

Prove deterministically:

- package entities normalize to stable IDs;
- incidental request creates exactly one stable entity;
- immediate creation + scene admission + initial awareness is atomic/idempotent;
- current semantic scene membership survives restart;
- absent entities cannot physically act without explicit remote semantics;
- two observers can know different facts about one entity;
- descriptor→role→proper-name progression updates the same entity;
- unknown existence/hidden canonical names remain omitted;
- semantic knowledge preserves provenance/correction.

### Layer 3 — GameFrame materialization

Prove:

- semantic scene/location materializes into valid playable geometry;
- materialization has stable identity/version/hash/provenance;
- collision/navigation/anchors/transition zones validate;
- required semantic landmarks/objects are represented;
- generated pixels do not own hit geometry;
- leaving/reloading/revisiting produces the same accepted location subject to committed changes;
- unsupported ruleset/materialization requirements fail before play.

### Layer 4 — Realtime embodied session

Prove:

- authenticated player joins exact scene session;
- bounded movement/facing/nearby transforms work;
- high-frequency transforms do not create RPG semantic journal traffic;
- missed/reordered realtime packets cannot mutate semantic authority;
- reconnect restores semantic scene + accepted materialization + valid GameFrame position/state;
- duplicate presence is rejected/recovered.

### Layer 5 — Dungeon Master context custody / machine-play

Use deterministic/mock providers and scripted players.

Required behaviors include expected, chaotic, avoidant, deceptive, early-correct-guess, missed clue, Ask-GM, direct entity interaction, Do Something Else, incidental NPC creation/revisit, and alternate-route exploration.

Prove:

- package truth never silently changes;
- referee context may access required hidden truth;
- Pell/entity-performance context excludes unrelated hidden truth;
- Ask-GM sees only player-authorized knowledge;
- direct NPC/entity identity/memory persists;
- eligible events/checks/consequences remain coherent;
- exact retry does not call decision provider twice or duplicate semantic effects;
- restart/resume preserves continuity.

### Layer 6 — Shared contract fixtures

Both repos consume versioned fixtures for jointly implemented seams.

Add fixtures progressively for:

- semantic scene/materialization linkage;
- viewer-safe current scene;
- People descriptor→role→name;
- Observer Knowledge divergence;
- Interact/Talk;
- Do Something Else;
- Ask-GM;
- presentation origin/audience;
- ruleset/profile/version capability declaration;
- principal/player-character/controlled-entity authorization;
- Tactical Activation request/snapshot linkage;
- structured tactical consequences;
- same-scene tactical→exploration resume.

Public fixtures must not contain private package secrets.

### Layer 7 — Actual GameFrame Node integration

A runtime-owned job checks out the exact intended GameFrame SHA and exercises real routes/services.

Prove actual serialization/validation for:

- semantic scene projections;
- materialization linkage;
- direct interaction/Ask-GM/freeform commands;
- ruleset capability validation;
- control authorization;
- tactical activation and terminal consequences;
- exact revision/idempotency behavior.

This layer must not fabricate tactical completion events.

### Layer 8 — Durable local two-service integration

Run both services with production-shaped separate persistence.

Cover:

- separate DBs/migrations;
- authenticated private service calls;
- package/journal/scene/materialization-link persistence;
- restart/lost-response recovery;
- no cross-service DB access;
- Tactical Activation coordination;
- deterministic tactical consequence consumption exactly once;
- same-scene resumable state after terminal tactical mode.

### Layer 9 — Complete single-player embodied Monster Master proof

Required journey:

```text
validated handcrafted Monster Master CampaignPackage
→ semantic world/entity/scene/observer initialization
→ accepted Crooked Checkpoint GameFrame materialization
→ avatar movement/direct interaction
→ Pell perspective-bounded conversation
→ Ask-GM query
→ Do Something Else freeform action
→ People/knowledge progression
→ world object interaction
→ second connected scene / alternate route
→ event/check consequence
→ Tactical Activation on current materialized map
→ current positions retained as starting positions
→ Master + ruleset-authorized monster actions
→ deterministic tactical result including alternate terminal state where implemented
→ semantic consequences reconcile
→ same materialized scene returns to exploration mode
→ bounded campaign resolution
→ both services restart
→ player resumes without duplication, leakage, rematerialization drift, or tactical reset
```

No replacement campaign battlefield or campaign Return-to-Campaign navigation is permitted in the mature proof.

### Layer 10 — Browser campaign acceptance

Use real browser journeys for:

- campaign attach/resume;
- scene materialization/loading;
- movement/interaction;
- People/knowledge;
- NPC conversation;
- Ask-GM/GM log;
- Do Something Else;
- GM intervention/pause;
- scene transitions;
- same-map Tactical Activation;
- tactical overlays/legal controls;
- tactical→exploration transition on same route/map;
- reconnect/mobile/desktop/fallback behavior.

A screenshot supports visual evidence but does not replace state assertions.

### Layer 11 — Two-human one-scene acceptance

After single-player proof:

- two authenticated principals/avatars;
- one shared active semantic/materialized scene;
- realtime movement;
- viewer-divergent knowledge;
- direct interaction custody;
- public/party/private GM presentation;
- party-cohesion scene transfers;
- ruleset-defined cooperative control;
- same-map Tactical Activation for both players;
- reconnect/restart.

This does not prove split-party multi-scene behavior.

### Layer 12 — Second handcrafted campaign generality proof

A materially different handcrafted package must use the same:

- GameFrame RPG Engine;
- package validator;
- Entity/Scene/Observer Knowledge architecture;
- Dungeon Master context modes;
- materialization framework;
- RPG Ruleset interface;
- Tactical Activation framework where relevant.

Campaign-specific engine/DM branches fail this gate.

### Layer 13 — Monster Master Battle Arena equivalence

The standalone Battle Arena has its own setup/UX evidence, but equivalent Monster Master Ruleset versions/profiles should be tested for equivalent:

- character/control semantics;
- initiative/action economy;
- legal movement/actions;
- conditions/resources;
- objective/terminal states;
- deterministic outcomes.

Standalone setup may differ; combat rules must not silently fork from the RPG.

### Layer 14 — Campaign Architect behavior

Only after the two handcrafted campaign proofs:

- brief normalization;
- assumptions/repair;
- originality transformation;
- WorldGraph/package completeness;
- ruleset/capability compatibility;
- materialization intent completeness;
- reproducibility/provenance;
- owner-refinable draft lifecycle;
- generated package full journey through the same engine/runtime.

### Layer 15 — VM/Cloudflare/Discord canary

Prove deployed topology:

- public GameFrame through stable Cloudflare hostname;
- no player VPN/router forwarding;
- private runtime origin;
- authenticated HTTP semantic commands;
- authenticated scene-scoped realtime WebSocket path;
- reconnect after tunnel/service restart;
- one embodied world scene + direct interaction;
- same-map tactical transition;
- backup/restore;
- stopping tunnel removes public VM reachability.

### Layer 16 — Media/generation canaries

Separately prove:

- catalog reuse;
- deterministic world-kit composition;
- queued/async generation;
- provenance/moderation/budgets;
- stable recurring identity;
- materialization fallback;
- semantic cinematic scripts;
- optional generated standalone Battle Arena maps.

## Coordinated branch policy

During cross-repository work:

1. update canonical GameFrame shared docs/fixtures;
2. run focused GameFrame validation;
3. test runtime branch against intended GameFrame branch;
4. merge canonical GameFrame changes;
5. synchronize byte-identical runtime mirrors;
6. rerun runtime checks against GameFrame `main`;
7. merge runtime changes.

Private runtime workflows must never execute untrusted fork/public PR code alongside private source/secrets.

## Diagnostics

Preserve bounded evidence including:

- exact GameFrame/runtime SHAs;
- package/schema/ruleset versions;
- package hash/provenance;
- semantic scene/materialization IDs/versions;
- observer/player/scripted-turn context at failure;
- tactical activation/tactical revision IDs;
- retry/restart receipts;
- browser traces only for browser journeys.

Do not place runtime-only package truth or credentials in ordinary artifacts.

## Acceptance criteria

The testing system is established when:

1. Monster Master and a materially different second handcrafted package pass the same durable engine/runtime substrate;
2. perspective custody proves NPCs do not inherit referee omniscience;
3. embodied exploration/materialization/revisit survives restart;
4. Ask-GM and Do Something Else remain distinct;
5. both repositories validate the same shared fixtures;
6. actual GameFrame integration exercises real materialization/control/tactical behavior;
7. one-human Monster Master proves same-map Tactical Activation and exploration resume;
8. two-human one-scene acceptance is proven separately;
9. Battle Arena equivalence prevents Monster Master combat-rule drift;
10. Campaign Architect is tested only after handcrafted generality;
11. VM canaries prove public routing/private-origin/realtime recovery;
12. split-party multi-scene is not claimed until separately tested;
13. no player journey requires Tailscale/router forwarding.

## Governing rule

> Prove the thing the player will actually experience: one durable materialized world, perspective-correct characters and GM, ruleset-driven deterministic mechanics, and combat that turns on where the party is already standing rather than replacing the campaign with another battlefield.
